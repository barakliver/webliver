'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { requireAccount } from '@/lib/auth';
import { whyNotSaved } from '@/lib/writeFailure';
import { normalizeTime } from '@/lib/timeField';
import { generateRunOfShow, shiftAfter, addMinutes } from '@/lib/runOfShow';
import { WEDDING_DAY_KEY } from '@/content/weddingDay';
import type { Answer } from '@/lib/intake';

/**
 * The run of show's writes: build it from the answers, move everything
 * after a time, lock it, and the two things the evening itself writes.
 *
 * Building replaces only what building wrote. A line the producer typed
 * by hand or took from a template carries `source = manual|template` and
 * is never touched; the lines whose source begins `questionnaire:` are
 * deleted and written again, so "build" after a changed answer is the
 * same press as "build" the first time. A locked sheet refuses a build
 * and a shift until it is opened, and opening it is a new version.
 */
export type ShowResult = { ok: boolean; error?: string; added?: number; summary?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath(`/app/clients/${clientId}/runsheet`);
  revalidatePath(`/app/clients/${clientId}/live`);
  revalidatePath('/app/portal');
}

async function lockedAt(sb: Awaited<ReturnType<typeof supabaseServer>>, clientId: string): Promise<string | null> {
  const { data } = await sb.from('clients').select('runsheet_locked_at').eq('id', clientId).maybeSingle();
  return (data as { runsheet_locked_at?: string | null } | null)?.runsheet_locked_at ?? null;
}

export async function buildRunOfShow(_prev: ShowResult | null, form: FormData): Promise<ShowResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const account = await requireAccount();
  if (account.role === 'client') return { ok: false, error: 'רק המפיק בונה את הלו"ז' };
  const sb = await supabaseServer();
  if (await lockedAt(sb, clientId)) return { ok: false, error: 'הלו"ז נעול. לפתוח לעריכה קודם' };

  const { data } = await sb.from('questionnaire_responses')
    .select('question_key,answered_by,value,visibility,updated_at').eq('client_id', clientId).eq('form_key', WEDDING_DAY_KEY);
  const lines = generateRunOfShow((data ?? []) as Answer[]);
  if (lines.length === 0) return { ok: false, error: 'בלי שעת קבלת פנים אין ממה לבנות' };

  const { data: events } = await sb.from('events').select('id').eq('client_id', clientId)
    .order('event_date', { ascending: true, nullsFirst: false }).limit(1);
  const eventId = events?.[0]?.id ?? null;

  const { error: wipe } = await sb.from('day_schedule').delete().eq('client_id', clientId).like('source', 'questionnaire:%');
  if (wipe) return { ok: false, error: whyNotSaved(wipe) };
  const { error } = await sb.from('day_schedule').insert(lines.map((l) => ({ client_id: clientId, event_id: eventId, ...l })));
  if (error) {
    console.error('[runOfShow] build failed', error);
    return { ok: false, error: whyNotSaved(error) };
  }
  touch(clientId);
  return { ok: true, added: lines.length };
}

/** Everything at or after a time moves by N minutes: the cascade a
 *  changed chuppah asks for. Negative moves it earlier. */
export async function shiftSchedule(_prev: ShowResult | null, form: FormData): Promise<ShowResult> {
  const clientId = String(form.get('client_id') ?? '');
  const from = normalizeTime(String(form.get('from') ?? ''));
  const minutes = Math.round(Number(form.get('minutes') ?? 0));
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (!from) return { ok: false, error: 'נא לכתוב שעה, למשל 20:10' };
  if (!Number.isFinite(minutes) || minutes === 0 || Math.abs(minutes) > 300) return { ok: false, error: 'בין דקה לחמש שעות' };
  const sb = await supabaseServer();
  if (await lockedAt(sb, clientId)) return { ok: false, error: 'הלו"ז נעול. לפתוח לעריכה קודם' };
  const { data } = await sb.from('day_schedule').select('id,at_time').eq('client_id', clientId);
  const rows = (data ?? []) as { id: string; at_time: string }[];
  const moved = shiftAfter(rows, from, minutes).filter((r, k) => r.at_time !== rows[k].at_time);
  for (const r of moved) {
    const { error } = await sb.from('day_schedule').update({ at_time: r.at_time }).eq('id', r.id);
    if (error) return { ok: false, error: whyNotSaved(error) };
  }
  touch(clientId);
  return { ok: true, added: moved.length };
}

export async function lockRunsheet(_prev: ShowResult | null, form: FormData): Promise<ShowResult> {
  const clientId = String(form.get('client_id') ?? '');
  const open = String(form.get('open') ?? '') === '1';
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const account = await requireAccount();
  if (account.role === 'client') return { ok: false, error: 'רק המפיק' };
  const sb = await supabaseServer();
  if (open) {
    /* Opening a locked sheet is a new version: whoever holds the printed
       one is holding an old one now, and the number says so. */
    const { data: c } = await sb.from('clients').select('runsheet_version').eq('id', clientId).maybeSingle();
    const v = Number((c as { runsheet_version?: number } | null)?.runsheet_version ?? 1) + 1;
    const { data, error } = await sb.from('clients').update({ runsheet_locked_at: null, runsheet_version: v }).eq('id', clientId).select('id');
    if (error) return { ok: false, error: whyNotSaved(error) };
    if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  } else {
    const { data, error } = await sb.from('clients').update({ runsheet_locked_at: new Date().toISOString() }).eq('id', clientId).select('id');
    if (error) return { ok: false, error: whyNotSaved(error) };
    if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  }
  touch(clientId);
  return { ok: true };
}

/** The evening slipped: every line not yet done and at or after `from`
 *  gets an `actual_at` of its planned time plus the delay. The plan is
 *  not rewritten; the sheet keeps saying what was meant. */
export async function delaySchedule(_prev: ShowResult | null, form: FormData): Promise<ShowResult> {
  const clientId = String(form.get('client_id') ?? '');
  const from = normalizeTime(String(form.get('from') ?? ''));
  const minutes = Math.round(Number(form.get('minutes') ?? 0));
  if (!clientId || !from) return { ok: false, error: 'חסרה שעה' };
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > 300) return { ok: false, error: 'בין דקה לחמש שעות' };
  const sb = await supabaseServer();
  const { data } = await sb.from('day_schedule').select('id,at_time,done_at').eq('client_id', clientId);
  const rows = ((data ?? []) as { id: string; at_time: string; done_at: string | null }[]).filter((r) => !r.done_at && r.at_time.slice(0, 5) >= from);
  for (const r of rows) {
    const { error } = await sb.from('day_schedule').update({ actual_at: addMinutes(r.at_time.slice(0, 5), minutes) }).eq('id', r.id);
    if (error) return { ok: false, error: whyNotSaved(error) };
  }
  touch(clientId);
  return { ok: true, added: rows.length };
}

export async function liveNote(_prev: ShowResult | null, form: FormData): Promise<ShowResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const note = String(form.get('note_live') ?? '').trim().slice(0, 2000);
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה שורה' };
  const sb = await supabaseServer();
  const { data, error } = await sb.from('day_schedule').update({ note_live: note }).eq('id', id).select('id');
  if (error) return { ok: false, error: whyNotSaved(error) };
  if (!data?.length) return { ok: false, error: whyNotSaved({ code: 'PGRST116' }) };
  touch(clientId);
  return { ok: true };
}

/**
 * The evening, closed.
 *
 * One press after the last song: what moved, what was never ticked, and
 * every note typed during the night, as one entry in the event's log and
 * one task on the producer's own list for the debrief with the couple.
 * Nothing on the sheet is changed; the sheet is the record and this is
 * the reading of it.
 */
export async function closeDay(_prev: ShowResult | null, form: FormData): Promise<ShowResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  const account = await requireAccount();
  if (account.role === 'client') return { ok: false, error: 'רק המפיק' };
  const sb = await supabaseServer();
  const [{ data: rows }, { data: client }] = await Promise.all([
    sb.from('day_schedule').select('at_time,title,done_at,actual_at,note_live').eq('client_id', clientId).order('at_time'),
    sb.from('clients').select('display_name,producer_id').eq('id', clientId).maybeSingle(),
  ]);
  const cl = client as { display_name?: string; producer_id?: string } | null;
  if (!cl?.producer_id) return { ok: false, error: 'לא מצאנו את האירוע' };
  const lines = (rows ?? []) as { at_time: string; title: string; done_at: string | null; actual_at: string | null; note_live: string }[];
  const hhmm = (t: string | null) => (t ?? '').slice(0, 5);
  const moved = lines.filter((l) => l.actual_at && hhmm(l.actual_at) !== hhmm(l.at_time));
  const skipped = lines.filter((l) => !l.done_at);
  const notes = lines.filter((l) => l.note_live.trim());
  const parts = [
    moved.length ? `זז (${moved.length}): ` + moved.map((l) => `${l.title} ${hhmm(l.at_time)} ל-${hhmm(l.actual_at)}`).join('; ') : 'שום דבר לא זז.',
    skipped.length ? `לא סומן (${skipped.length}): ` + skipped.map((l) => l.title).join('; ') : 'הכול סומן.',
    notes.length ? 'הערות: ' + notes.map((l) => `${l.title}: ${l.note_live.trim()}`).join('; ') : 'בלי הערות.',
  ];
  const summary = parts.join('\n');
  await sb.from('activity_log').insert({
    producer_id: cl.producer_id, client_id: clientId, kind: 'day_closed', title: 'סיכום הערב',
    body: summary.slice(0, 4000), ref_table: 'day_schedule', actor: 'producer',
  });
  const title = `סיכום ומשוב לזוג: ${cl.display_name ?? ''}`;
  const { data: open } = await sb.from('producer_tasks').select('id').eq('producer_id', cl.producer_id).eq('title', title).eq('done', false).limit(1);
  if (!open?.length) {
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    await sb.from('producer_tasks').insert({ producer_id: cl.producer_id, title, note: summary.slice(0, 500), due_on: tomorrow, created_by: account.id });
  }
  touch(clientId);
  revalidatePath('/app');
  return { ok: true, summary };
}
