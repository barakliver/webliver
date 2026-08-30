'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

/* Closing and reopening are not here.
 *
 * They live in `clients.ts`, on `setArchived`, which is what the button on the
 * board already calls. A second pair of actions doing the same thing is how
 * this feature broke in the first place: 0042 added the snapshot, this file
 * added a close action to write it, and the button went on calling the old one
 * — so events were closed and the shelf stayed empty. One way in, and it is
 * the one the screen already uses.
 */

/** A producer calling off one anniversary reminder. The row stays, marked,
 *  rather than being deleted: "we decided not to" is worth being able to see. */
export async function cancelAnniversary(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('anniversary_reminders')
    .update({ cancelled_at: new Date().toISOString() })
    .eq('id', id);
  revalidatePath('/app');
}
