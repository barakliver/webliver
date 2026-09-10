'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';
import { optional } from '@/lib/env';
import { syncProducer } from '@/lib/google/sync';

export type DiaryResult = { ok: boolean; error?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

const touch = () => { revalidatePath('/app/calendar'); revalidatePath('/app'); };

/** The phone hears about it now rather than at a quarter past. Best
 *  effort: a Google that is down does not stop an entry being saved. */
async function nudge(producerId: string) {
  if (!optional('SUPABASE_SERVICE_ROLE_KEY')) return;
  try {
    const sb = supabaseAdmin();
    const { data } = await sb.from('google_calendars').select('producer_id').eq('producer_id', producerId).maybeSingle();
    if (data) await syncProducer(producerId, sb);
  } catch (e) { console.error('[diary] sync after save failed', e); }
}

function readForm(form: FormData) {
  const title = String(form.get('title') ?? '').trim().slice(0, 160);
  const on = String(form.get('on_date') ?? '');
  const time = String(form.get('at_time') ?? '').trim();
  const duration = Math.max(5, Math.min(1440, Number(form.get('duration_min')) || 60));
  const note = String(form.get('note') ?? '').trim().slice(0, 1000);
  const clientId = String(form.get('client_id') ?? '') || null;
  return { title, on, time: TIME.test(time) ? time : '', duration, note, clientId };
}

/** One entry on one day, the producer's own. */
export async function addDiaryEntry(_prev: DiaryResult | null, form: FormData): Promise<DiaryResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };
  const f = readForm(form);
  if (!f.title) return { ok: false, error: 'חסרה כותרת' };
  if (!DATE.test(f.on)) return { ok: false, error: 'חסר תאריך' };

  const sb = await supabaseServer();
  const { error } = await sb.from('diary_entries').insert({
    producer_id: account.producer.id, client_id: f.clientId, title: f.title,
    on_date: f.on, at_time: f.time || null, duration_min: f.duration, note: f.note, created_by: account.id,
  });
  if (error) {
    console.error('[diary] insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור. אפשר לנסות שוב.' };
  }
  touch();
  await nudge(account.producer.id);
  return { ok: true };
}

export async function updateDiaryEntry(_prev: DiaryResult | null, form: FormData): Promise<DiaryResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };
  const id = String(form.get('id') ?? '');
  const f = readForm(form);
  if (!id || !f.title || !DATE.test(f.on)) return { ok: false, error: 'חסרים פרטים' };

  const sb = await supabaseServer();
  const { error } = await sb.from('diary_entries').update({
    client_id: f.clientId, title: f.title, on_date: f.on, at_time: f.time || null, duration_min: f.duration, note: f.note,
  }).eq('id', id);
  if (error) {
    console.error('[diary] update failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור. אפשר לנסות שוב.' };
  }
  touch();
  await nudge(account.producer.id);
  return { ok: true };
}

export async function deleteDiaryEntry(form: FormData): Promise<void> {
  const account = await currentAccount();
  const id = String(form.get('id') ?? '');
  if (!account?.producer || !id) return;
  const sb = await supabaseServer();
  const { error } = await sb.from('diary_entries').delete().eq('id', id);
  if (error) {
    console.error('[diary] delete failed', error);
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  }
  touch();
  await nudge(account.producer.id);
}
