'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireAccount } from '@/lib/auth';
import { whyNotSaved } from '@/lib/writeFailure';
import { INTAKE_KEY } from '@/content/intake';
import { formOf } from '@/lib/intake';
import { writeBrief } from '@/lib/ai/profileBrief';

/**
 * The questionnaire's writes.
 *
 * One answer, one upsert, keyed by who answered: both partners can answer
 * the same question and both rows are kept, which is what lets the
 * producer see where they differ. An answer in the private chapter is
 * written `private` whatever the form says, because the chapter decides
 * and not the request. Every change is a line in the activity log, the
 * questionnaire being alive rather than filed.
 */
export type IntakeResult = { ok: boolean; error?: string };

const privateKeys = (formKey: string) => new Set(formOf(formKey).chapters.filter((c) => c.private).flatMap((c) => c.questions.map((q) => q.key)));
const known = (formKey: string) => new Set(formOf(formKey).questions.map((q) => q.key));

function touch(clientId: string) {
  revalidatePath('/app/portal');
  revalidatePath('/app/portal/questionnaire');
  revalidatePath(`/app/clients/${clientId}`);
}

function readValue(raw: string): unknown {
  const s = raw.trim();
  if (!s) return '';
  if (s.startsWith('[') || s.startsWith('{')) {
    try { return JSON.parse(s); } catch { return s; }
  }
  return s;
}

export async function saveAnswer(_prev: IntakeResult | null, form: FormData): Promise<IntakeResult> {
  const clientId = String(form.get('client_id') ?? '');
  const key = String(form.get('question_key') ?? '');
  const formKey = formOf(String(form.get('form_key') ?? INTAKE_KEY)).key;
  if (!clientId || !known(formKey).has(key)) return { ok: false, error: 'שאלה לא מוכרת' };
  const account = await requireAccount();
  const value = readValue(String(form.get('value') ?? ''));
  if (JSON.stringify(value).length > 20000) return { ok: false, error: 'התשובה ארוכה מדי' };

  const sb = await supabaseServer();
  const { error } = await sb.from('questionnaire_responses').upsert({
    client_id: clientId, form_key: formKey, question_key: key, answered_by: account.id,
    value, visibility: privateKeys(formKey).has(key) ? 'private' : 'couple',
  }, { onConflict: 'client_id,form_key,question_key,answered_by' });
  if (error) {
    console.error('[intake] save failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }

  /* The producer's log, and never the private answer's text: the log is
     read by both partners when a line is marked for them. */
  const { data: c } = await sb.from('clients').select('producer_id').eq('id', clientId).maybeSingle();
  const producerId = (c as { producer_id?: string } | null)?.producer_id;
  if (producerId) {
    const q = formOf(formKey).questions.find((x) => x.key === key);
    await sb.from('activity_log').insert({
      producer_id: producerId, client_id: clientId, kind: 'questionnaire', title: `שאלון: ${q?.he ?? key}`,
      body: '', ref_table: 'questionnaire_responses', actor: account.role === 'client' ? 'couple' : 'producer',
    });
  }
  touch(clientId);
  return { ok: true };
}

export async function saveIntakeNote(_prev: IntakeResult | null, form: FormData): Promise<IntakeResult> {
  const clientId = String(form.get('client_id') ?? '');
  const key = String(form.get('question_key') ?? '');
  const note = String(form.get('note') ?? '').trim().slice(0, 4000);
  if (!clientId || !(known(INTAKE_KEY).has(key) || known('wedding_day').has(key))) return { ok: false, error: 'שאלה לא מוכרת' };
  if (!note) return { ok: false, error: 'הערה ריקה' };
  const account = await requireAccount();
  const sb = await supabaseServer();
  const { error } = await sb.from('questionnaire_notes').insert({ client_id: clientId, question_key: key, note, created_by: account.id });
  if (error) return { ok: false, error: whyNotSaved(error) };
  touch(clientId);
  return { ok: true };
}

/** "Prepare me for the meeting": one page from the answers, kept beside
 *  the private profile so it is read once and not generated on every
 *  visit. Refreshed on press. */
export async function prepareMeeting(_prev: IntakeResult | null, form: FormData): Promise<IntakeResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const account = await requireAccount();
  if (account.role === 'client') return { ok: false, error: 'רק המפיק' };
  const sb = await supabaseServer();
  const r = await writeBrief(sb, clientId, account.producer?.id ?? null);
  if (!r.ok) return r;
  touch(clientId);
  return { ok: true };
}
