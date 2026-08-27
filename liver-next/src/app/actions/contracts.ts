'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';

export type ContractResult = { ok: boolean; error?: string; id?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

/** Turns a database complaint into something a person can act on. The rules
 *  themselves live in the schema, so this is about wording only. */
function readable(message: string): string {
  if (/cannot be edited/i.test(message)) return 'הסכם חתום לא ניתן לעריכה';
  if (/signature cannot be altered/i.test(message)) return 'חתימה לא ניתנת לשינוי';
  if (/only be voided/i.test(message)) return 'הסכם חתום אפשר רק לבטל';
  if (/cannot be deleted/i.test(message)) return 'הסכם חתום לא נמחק, אפשר לבטל אותו';
  if (/couple signs this/i.test(message)) return 'את ההסכם חותם הזוג, לא המפיק';
  if (/already signed/i.test(message)) return 'ההסכם כבר חתום';
  if (/not open for signature/i.test(message)) return 'ההסכם עדיין לא נשלח לחתימה';
  if (/שם מלא/.test(message)) return 'נא לחתום בשם מלא';
  if (/row-level security/i.test(message)) return 'אין לך הרשאה לפעולה הזאת';
  return 'הפעולה נכשלה. נסו שוב.';
}

export async function saveContract(_prev: ContractResult | null, form: FormData): Promise<ContractResult> {
  const clientId = String(form.get('client_id') ?? '');
  const id = String(form.get('contract_id') ?? '');
  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const body = String(form.get('body') ?? '').trim().slice(0, 60000);
  const amountRaw = String(form.get('amount') ?? '').trim();
  const filePath = String(form.get('file_path') ?? '').trim() || null;

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (title.length < 2) return { ok: false, error: 'נא לתת שם להסכם' };
  if (!body && !filePath) return { ok: false, error: 'נא לכתוב תנאים או לצרף מסמך' };

  let amount: number | null = null;
  if (amountRaw) {
    amount = Number(amountRaw.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, error: 'סכום לא תקין' };
  }

  const sb = await supabaseServer();
  const row = {
    client_id: clientId, title, body, amount, file_path: filePath,
    /* Who the other side is. Blank for an agreement with the couple, whose
       identity the workspace already knows. */
    party_name: String(form.get('party_name') ?? '').trim().slice(0, 120),
    party_role: String(form.get('party_role') ?? '').trim().slice(0, 80),
  };

  const { data, error } = id
    ? await sb.from('contracts').update(row).eq('id', id).select('id').maybeSingle()
    : await sb.from('contracts').insert(row).select('id').maybeSingle();

  if (error) return { ok: false, error: readable(error.message) };
  touch(clientId);
  return { ok: true, id: data?.id };
}

/** Draft to sent. Separate from saving on purpose: sending is the moment the
 *  couple is asked to agree to something, and it should be a decision rather
 *  than a side effect of typing. */
export async function sendContract(form: FormData): Promise<void> {
  const id = String(form.get('contract_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  await sb.from('contracts')
    .update({ status: 'sent', sent_at: new Date().toISOString() })
    .eq('id', id).eq('status', 'draft');
  touch(clientId);
}

export async function signContract(_prev: ContractResult | null, form: FormData): Promise<ContractResult> {
  const id = String(form.get('contract_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const name = String(form.get('signed_name') ?? '').trim();

  if (!id) return { ok: false, error: 'חסר מזהה הסכם' };
  if (name.length < 2) return { ok: false, error: 'נא לחתום בשם מלא' };

  const sb = await supabaseServer();
  const { error } = await sb.rpc('sign_contract', { p_contract: id, p_name: name });
  if (error) return { ok: false, error: readable(error.message) };

  touch(clientId);
  return { ok: true };
}

export async function voidContract(form: FormData): Promise<void> {
  const id = String(form.get('contract_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('contracts').update({ status: 'void' }).eq('id', id);
  touch(clientId);
}

export async function deleteContract(form: FormData): Promise<void> {
  const id = String(form.get('contract_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  /* A signed one is refused by the database; this only ever removes a draft. */
  await sb.from('contracts').delete().eq('id', id);
  touch(clientId);
}

/** A short-lived link to the attached document. The bucket is private, so
 *  there is no URL to hand out that does not expire. */
export async function contractFileUrl(path: string): Promise<string | null> {
  if (!path) return null;
  const sb = await supabaseServer();
  const { data } = await sb.storage.from('contracts').createSignedUrl(path, 60 * 30);
  return data?.signedUrl ?? null;
}

/**
 * A link a supplier can sign from, with no account.
 *
 * The producer's half of 0037. The token is made in the database, not here: a
 * link minted in application code is a link whose secrecy depends on whoever
 * writes the next screen remembering to use the same generator.
 *
 * Issuing twice returns the same link rather than replacing it, so opening
 * this from two tabs cannot quietly kill the link already sitting in
 * somebody's WhatsApp. A draft becomes sent on the way, because a link to a
 * draft is a link to terms that can still change underneath it.
 */
export async function issueSignLink(_prev: ContractResult | null, form: FormData): Promise<ContractResult> {
  const id = String(form.get('contract_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return { ok: false, error: 'חסר מזהה הסכם' };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('issue_sign_link', { p_contract: id });
  if (error || typeof data !== 'string') {
    console.error('[contracts] could not issue a signing link', error);
    return { ok: false, error: 'לא הצלחנו ליצור קישור' };
  }

  touch(clientId);
  return { ok: true, id: `${publicEnv.siteUrl}/sign/${data}` };
}

/** Withdrawing one. Never un-signs anything: what was signed is a record, and
 *  the link is only the door. */
export async function revokeSignLink(form: FormData): Promise<void> {
  const id = String(form.get('contract_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('revoke_sign_link', { p_contract: id });
  if (error) console.error('[contracts] could not withdraw the link', error);
  touch(clientId);
}
