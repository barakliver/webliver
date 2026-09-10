'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { noteFailure } from '@/lib/flash';

export type TaskResult = { ok: boolean; error?: string };

/** Whose job the task is. Who wrote it is recorded by the database and is
 *  never taken from the browser. */
const OWNERS = ['producer', 'client'] as const;
type Owner = (typeof OWNERS)[number];

export async function addTask(_prev: TaskResult | null, form: FormData): Promise<TaskResult> {
  const clientId = String(form.get('client_id') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const dueOn = String(form.get('due_on') ?? '').trim();
  const ownerRaw = String(form.get('owner') ?? 'producer');
  const owner: Owner = OWNERS.includes(ownerRaw as Owner) ? (ownerRaw as Owner) : 'producer';

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (title.length < 2) return { ok: false, error: 'נא לכתוב מה צריך לעשות' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const sb = await supabaseServer();
  const { error } = await sb.from('tasks').insert({
    client_id: clientId,
    title,
    due_on: dueOn || null,
    owner,
  });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את המשימה' };

  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
  return { ok: true };
}

/** Unticking a supplier task takes back what ticking it wrote.
 *
 *  Ticking "צלם סטילס" asks who and for how much and puts them on the
 *  suppliers list and the budget. Unticking it used to leave both standing,
 *  so a tick made by mistake was a photographer nobody hired sitting on the
 *  couple's screen with a line of money under him. Only the supplier this
 *  task produced is removed — the pointer is set by that form alone — and the
 *  budget line that points at that supplier goes with him. A supplier typed
 *  in by hand on the suppliers tab has no task pointing at him and is not
 *  touched. */
async function takeBackSupplier(sb: Awaited<ReturnType<typeof supabaseServer>>, taskId: string) {
  const { data: task } = await sb.from('tasks').select('event_vendor_id').eq('id', taskId).maybeSingle();
  const vendorId = task?.event_vendor_id as string | null | undefined;
  if (!vendorId) return;
  const { error: lineError } = await sb.from('budget_items').delete().eq('event_vendor_id', vendorId);
  const { error: vendorError } = await sb.from('event_vendors').delete().eq('id', vendorId);
  if (lineError || vendorError) {
    console.error('[tasks] takeBackSupplier failed', lineError ?? vendorError);
    await noteFailure('המשימה בוטלה, אבל הספק שנרשם ממנה נשאר ברשימת הספקים. אפשר למחוק אותו שם.');
  }
}

export async function toggleTask(form: FormData): Promise<void> {
  const id = String(form.get('task_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const done = String(form.get('done') ?? '') === 'true';
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('tasks').update({ done: !done }).eq('id', id);
  if (error) {
    console.error('[tasks] toggleTask failed', error);
    await noteFailure('לא הצלחנו לעדכן. אפשר לנסות שוב.');
  } else if (done) {
    await takeBackSupplier(sb, id);
  }

  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
}

/** Deleting is limited in the database to whoever wrote the task, plus the
 *  producer who owns the workspace. A refusal here is that policy speaking. */
export async function deleteTask(form: FormData): Promise<void> {
  const id = String(form.get('task_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  const { error } = await sb.from('tasks').delete().eq('id', id);
  if (error) {
    console.error('[tasks] deleteTask failed', error);
    await noteFailure('לא הצלחנו למחוק. אפשר לנסות שוב.');
  }

  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
}

/**
 * The result of a drag, in one call.
 *
 * The database writes the whole new order in one statement, so a half applied
 * drag cannot exist — and it matches each row by id against what the caller
 * may already read, so an array carrying somebody else's task id reorders
 * everything except that one rather than failing outright.
 */
export async function reorderTasks(clientId: string, ids: string[]): Promise<TaskResult> {
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
  if (ids.length > 500) return { ok: false, error: 'יותר מדי שורות' };
  if (!ids.every((id) => /^[0-9a-f-]{36}$/i.test(id))) {
    return { ok: false, error: 'סדר לא תקין' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.rpc('reorder_tasks', { p_ids: ids });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את הסדר' };

  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}
