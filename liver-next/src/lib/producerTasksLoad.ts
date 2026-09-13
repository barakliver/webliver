import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { safeRows } from '@/lib/safe';
import { isRepeat, sortTasks, type ProducerTask } from '@/lib/producerTasks';

/**
 * The producer's own list, read.
 *
 * Split from `lib/producerTasks.ts` for the reason that module's own comment
 * gives: the arithmetic is imported by the browser, and a `server-only` line
 * in it would take the screen down. This is the half that talks to the
 * database.
 *
 * The row policy scopes the read to whoever is asking, so there is no
 * producer_id in the query — adding one would be a second, weaker copy of a
 * rule the database already enforces, and the two would eventually disagree.
 */
export async function loadMyTasks(sb: SupabaseClient): Promise<ProducerTask[]> {
  const rows = await safeRows<{
    id: string; title: string; note: string | null; due_on: string | null;
    repeat_every: string; done: boolean; done_on: string | null;
  }>('my tasks', sb.from('producer_tasks')
    .select('id,title,note,due_on,repeat_every,done,done_on')
    .order('due_on', { ascending: true, nullsFirst: false })
    .limit(200));

  return sortTasks(rows.map((r) => ({
    id: r.id,
    title: r.title,
    note: r.note ?? '',
    due_on: r.due_on,
    /* A value the database's own check constraint already limits. Read
       defensively anyway: this is the one field the component switches on,
       and a row written before a future constraint changed would otherwise
       render as a repeat that does not exist. */
    repeat_every: isRepeat(r.repeat_every) ? r.repeat_every : 'none',
    done: r.done,
    done_on: r.done_on,
  })));
}
