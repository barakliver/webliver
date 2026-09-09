'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';

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

export async function toggleTask(form: FormData): Promise<void> {
  const id = String(form.get('task_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const done = String(form.get('done') ?? '') === 'true';
  if (!id) return;

  const sb = await supabaseServer();
  await sb.from('tasks').update({ done: !done }).eq('id', id);

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
  await sb.from('tasks').delete().eq('id', id);

  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
  revalidatePath('/app');
}
