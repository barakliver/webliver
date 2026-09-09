'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';

export type MessageResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

/** Posting to an event's thread. The author is taken from the session and
 *  never from the form — the database enforces the same thing, so a screen
 *  that got this wrong would be refused rather than believed. */
export async function sendMessage(_prev: MessageResult | null, form: FormData): Promise<MessageResult> {
  const clientId = String(form.get('client_id') ?? '');
  const body = String(form.get('body') ?? '').trim();

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (body.length === 0) return { ok: false, error: 'אין מה לשלוח' };
  if (body.length > 4000) return { ok: false, error: 'ההודעה ארוכה מדי' };

  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const sb = await supabaseServer();
  const { error } = await sb.from('messages').insert({
    client_id: clientId, author_id: account.id, body,
  });
  if (error) return { ok: false, error: 'ההודעה לא נשלחה. נסו שוב.' };

  touch(clientId);
  return { ok: true };
}

/** Taking back something you said. Only your own, and it goes rather than
 *  quietly changing — the policy says the same. */
export async function deleteMessage(form: FormData): Promise<void> {
  const id = String(form.get('message_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;

  const sb = await supabaseServer();
  await sb.from('messages').delete().eq('id', id);
  touch(clientId);
}

/** Called once the thread has actually been rendered, so "read" means read
 *  rather than "the page that contains it was opened". */
export async function markThreadRead(clientId: string): Promise<void> {
  if (!clientId) return;
  const sb = await supabaseServer();
  await sb.rpc('mark_thread_read', { p_client: clientId });
}
