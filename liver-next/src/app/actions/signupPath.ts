'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';
import { logFailure } from '@/lib/log';
import { noteFailure } from '@/lib/flash';

const PATHS = ['producer', 'wedding', 'business'] as const;

/**
 * A new account saying what it came for.
 *
 * A request and nothing more: this writes one column on the caller's own
 * profile and rings the root bell, and it grants nothing. The checks that
 * matter are in `choose_my_path` - only somebody still waiting, never the root
 * address - because a form is a suggestion and the database is the rule.
 *
 * Sent back to the same screen either way. On success it now says what was
 * asked and who is deciding; on failure it says so, rather than redrawing the
 * question as though nothing had been pressed.
 */
export async function chooseMyPath(formData: FormData): Promise<void> {
  const intent = String(formData.get('intent') ?? '');
  if (!(PATHS as readonly string[]).includes(intent)) redirect('/app/pending');

  const account = await currentAccount();
  if (!account) redirect('/login');

  const sb = await supabaseServer();
  const { error } = await sb.rpc('choose_my_path', { p_intent: intent });
  if (error) {
    logFailure('auth', 'choose_my_path failed', { at: '/app/pending', role: account.role, doing: 'choose-path', reason: 'rejected' });
    await noteFailure('הבקשה לא נשמרה. אפשר לנסות שוב.');
    redirect('/app/pending');
  }

  revalidatePath('/app/pending');
  revalidatePath('/app/admin');
  redirect('/app/pending');
}
