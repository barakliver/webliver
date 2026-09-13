'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteDone, noteFailure } from '@/lib/flash';
import { todayInZone } from '@/lib/clock';
import { isRepeat, nextDue, type Repeat } from '@/lib/producerTasks';

export type MyTaskResult = { ok: boolean; error?: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/* The overview is where the list is read, and the calendar carries whatever
   has a date on it. Both are rebuilt on every write, because a list that is
   one navigation behind is a list somebody ticks twice. */
const touch = () => { revalidatePath('/app'); revalidatePath('/app/calendar'); };

function readForm(form: FormData) {
  const title = String(form.get('title') ?? '').trim().slice(0, 200);
  const note = String(form.get('note') ?? '').trim().slice(0, 1000);
  const due = String(form.get('due_on') ?? '').trim();
  const repeatRaw = String(form.get('repeat_every') ?? 'none');
  const repeat: Repeat = isRepeat(repeatRaw) ? repeatRaw : 'none';
  return { title, note, due: DATE.test(due) ? due : '', repeat, dueGiven: due };
}

/** One thing he has to do, his own rather than any wedding's. */
export async function addMyTask(_prev: MyTaskResult | null, form: FormData): Promise<MyTaskResult> {
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };

  const f = readForm(form);
  if (f.title.length < 2) return { ok: false, error: 'נא לכתוב מה צריך לעשות' };
  if (f.dueGiven && !f.due) return { ok: false, error: 'התאריך לא תקין' };

  /* A routine with no date has to start somewhere, and the only date that
     needs no explanation is today. Without this the row is a routine that
     never comes round, which reads as the repeat having been ignored. */
  const due = f.due || (f.repeat === 'none' ? null : todayInZone());

  const sb = await supabaseServer();
  const { error } = await sb.from('producer_tasks').insert({
    producer_id: account.producer.id,
    title: f.title,
    note: f.note,
    due_on: due,
    repeat_every: f.repeat,
    created_by: account.id,
  });
  if (error) {
    console.error('[producerTasks] insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את המשימה' };
  }

  await noteDone('נוסף לרשימה שלך.');
  touch();
  return { ok: true };
}

/** The same row, corrected. The tick has its own action, so nothing here
 *  moves `done` or the day it was last done. */
export async function updateMyTask(_prev: MyTaskResult | null, form: FormData): Promise<MyTaskResult> {
  const id = String(form.get('task_id') ?? '');
  const account = await currentAccount();
  if (!account?.producer) return { ok: false, error: 'צריך להתחבר כמפיק' };
  if (!id) return { ok: false, error: 'חסר מזהה משימה' };

  const f = readForm(form);
  if (f.title.length < 2) return { ok: false, error: 'נא לכתוב מה צריך לעשות' };
  if (f.dueGiven && !f.due) return { ok: false, error: 'התאריך לא תקין' };
  const due = f.due || (f.repeat === 'none' ? null : todayInZone());

  const sb = await supabaseServer();
  const { error } = await sb.from('producer_tasks')
    .update({ title: f.title, note: f.note, due_on: due, repeat_every: f.repeat })
    .eq('id', id);
  if (error) {
    console.error('[producerTasks] update failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את השינוי' };
  }

  await noteDone('המשימה עודכנה.');
  touch();
  return { ok: true };
}

/**
 * The tick, and the one piece of behaviour that makes a routine a routine.
 *
 * A one-off is simply done, and untickable, because a tick by mistake should
 * cost one press rather than being retyped. A routine is never done: ticking
 * it writes the day it happened and moves the date to the next occurrence, so
 * one row carries "every Sunday" for its whole life instead of the producer
 * writing it out again every Sunday — which is the thing he actually asked
 * for and the thing a plain task list cannot do.
 *
 * The current state is read from the database rather than taken from the
 * form: a stale screen posting `done=false` for a row somebody already
 * ticked would otherwise skip an occurrence.
 */
export async function toggleMyTask(form: FormData): Promise<void> {
  const id = String(form.get('task_id') ?? '');
  if (!id) return;
  const account = await currentAccount();
  if (!account?.producer) return;

  const sb = await supabaseServer();
  const { data: row, error: readError } = await sb.from('producer_tasks')
    .select('due_on,repeat_every,done').eq('id', id).maybeSingle();
  if (readError || !row) {
    console.error('[producerTasks] toggle could not read the row', readError);
    await noteFailure('לא הצלחנו לעדכן. אפשר לנסות שוב.');
    return;
  }

  const repeat: Repeat = isRepeat(row.repeat_every) ? row.repeat_every : 'none';
  const today = todayInZone();

  const patch = repeat === 'none'
    ? { done: !row.done, done_on: row.done ? null : today }
    : { done: false, done_on: today, due_on: nextDue(row.due_on, repeat, today) };

  const { error } = await sb.from('producer_tasks').update(patch).eq('id', id);
  if (error) {
    console.error('[producerTasks] toggle failed', error);
    await noteFailure('לא הצלחנו לעדכן. אפשר לנסות שוב.');
  }
  touch();
}

export async function deleteMyTask(form: FormData): Promise<void> {
  const id = String(form.get('task_id') ?? '');
  if (!id) return;
  const account = await currentAccount();
  if (!account?.producer) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('producer_tasks').delete().eq('id', id);
  if (error) {
    console.error('[producerTasks] delete failed', error);
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  } else {
    await noteDone('המשימה נמחקה.');
  }
  touch();
}
