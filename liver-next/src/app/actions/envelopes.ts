'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';

/** The envelopes: cash that changes hands on the night, one row each.
 *
 *  Every action here returns what happened. A refused write that leaves the
 *  screen exactly as it was reads as "the button did not register", and the
 *  couple presses it again — which, for the row that marks an envelope as
 *  handed over, is how a rabbi gets paid twice. */
export type EnvelopeResult = { ok: boolean; error?: string };

const MISSING = 'חסרים פרטים';
const NO_SESSION = 'צריך להתחבר';
const FAILED = 'לא הצלחנו לשמור. אפשר לנסות שוב.';

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

const money = (raw: string): number | null => {
  const s = raw.trim().replace(/[^\d.]/g, '');
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : NaN;
};

export async function addEnvelope(_prev: EnvelopeResult | null, form: FormData): Promise<EnvelopeResult> {
  const clientId = String(form.get('client_id') ?? '');
  const label = String(form.get('label') ?? '').trim();
  const recipient = String(form.get('recipient') ?? '').trim();
  const note = String(form.get('note') ?? '').trim();
  const amount = money(String(form.get('amount') ?? ''));
  const cash = String(form.get('cash') ?? 'true') !== 'false';

  if (!clientId) return { ok: false, error: MISSING };
  if (label.length < 1) return { ok: false, error: 'למי המעטפה?' };
  if (Number.isNaN(amount)) return { ok: false, error: 'סכום לא תקין' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: NO_SESSION };
  const sb = await supabaseServer();

  /* New rows go to the end of the list the couple has already ordered. */
  const { data: last } = await sb.from('event_envelopes')
    .select('sort').eq('client_id', clientId).order('sort', { ascending: false }).limit(1).maybeSingle();

  const { error } = await sb.from('event_envelopes').insert({
    client_id: clientId,
    label: label.slice(0, 80),
    recipient: recipient.slice(0, 80),
    note: note.slice(0, 400),
    amount,
    cash,
    sort: (last?.sort ?? 0) + 1,
  });
  if (error) {
    console.error('[envelopes] insert failed', error);
    return { ok: false, error: FAILED };
  }
  touch(clientId);
  return { ok: true };
}

export async function removeEnvelope(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) { await noteFailure(MISSING); return; }
  const sb = await supabaseServer();
  const { error } = await sb.from('event_envelopes').delete().eq('id', id).eq('client_id', clientId);
  if (error) {
    console.error('[envelopes] delete failed', error);
    await noteFailure('המעטפה לא נמחקה. אפשר לנסות שוב.');
    return;
  }
  touch(clientId);
}

/** Handed over, or not after all. Stamped with the moment rather than a
 *  boolean, because "when did the photographer get his envelope" is a
 *  question that gets asked. */
export async function toggleDelivered(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const delivered = String(form.get('delivered') ?? '') === 'true';
  if (!id || !clientId) { await noteFailure(MISSING); return; }
  const sb = await supabaseServer();
  const { error } = await sb.from('event_envelopes')
    .update({ delivered_at: delivered ? null : new Date().toISOString() })
    .eq('id', id).eq('client_id', clientId);
  if (error) {
    console.error('[envelopes] toggle failed', error);
    await noteFailure('הסימון לא נשמר. אפשר לנסות שוב.');
    return;
  }
  touch(clientId);
}
