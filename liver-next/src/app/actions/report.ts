'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';

export type ReportResult = { ok: boolean; error?: string };

/**
 * A couple saying something is wrong.
 *
 * Filed as a message on their own workspace rather than as a new kind of
 * record. It is a thing said to the producer about this event, which is
 * exactly what the messages table already is, and a second inbox is a second
 * place to forget to look.
 *
 * The topic is prefixed rather than stored in a column of its own for the same
 * reason: the producer reads a thread, not a form, and one line at the top
 * saying what this is about does the whole job a column would.
 */
export async function fileReport(
  clientId: string, topic: string, body: string
): Promise<ReportResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const text = body.trim().slice(0, 1000);
  if (text.length < 2) return { ok: false, error: 'נא לכתוב מה קרה' };

  const sb = await supabaseServer();
  const { error } = await sb.from('messages').insert({
    client_id: clientId,
    author_id: account.id,
    body: `${topic}\n${text}`,
  });

  if (error) {
    console.error('[report] failed', error);
    return { ok: false, error: 'לא הצלחנו לשלוח. נסו שוב.' };
  }

  revalidatePath('/app/portal');
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}
