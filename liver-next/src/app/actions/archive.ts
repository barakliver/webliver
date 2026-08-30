'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

export type ArchiveResult = { ok: boolean; error?: string };

const refresh = (clientId?: string) => {
  revalidatePath('/app/clients');
  revalidatePath('/app/clients/archive');
  if (clientId) revalidatePath(`/app/clients/${clientId}`);
};

/**
 * Closing an event.
 *
 * One call, because closing is two things that must not come apart: the
 * workspace is marked closed, and a snapshot is frozen of the supplier sheet,
 * the crew, the money and the run sheet as they stood on the night. The
 * database does both in one function so a half closed event cannot exist.
 *
 * The anniversary reminders for the year to come are scheduled by the same
 * call. Closing is the moment the anniversary becomes a fact.
 */
export async function closeEvent(form: FormData): Promise<ArchiveResult> {
  const clientId = String(form.get('client_id') ?? '');
  const note = String(form.get('note') ?? '').trim().slice(0, 2000);
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const sb = await supabaseServer();
  const { error } = await sb.rpc('close_event', { p_client: clientId, p_note: note });

  if (error) {
    console.error('[archive] close_event refused', { message: error.message });
    return { ok: false, error: 'לא הצלחנו לסגור את האירוע' };
  }

  refresh(clientId);
  return { ok: true };
}

/**
 * Reopening one.
 *
 * The snapshot is deliberately left where it is. A reopened event is almost
 * always a correction being made a week later, and throwing away the record of
 * what the night looked like in order to make that correction is exactly
 * backwards. Closing it again refreshes nothing, which is why close_event does
 * nothing on conflict.
 */
export async function reopenEvent(form: FormData): Promise<ArchiveResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const sb = await supabaseServer();
  const { error } = await sb.from('clients').update({ archived_at: null }).eq('id', clientId);
  if (error) return { ok: false, error: 'לא הצלחנו לפתוח את האירוע מחדש' };

  refresh(clientId);
  return { ok: true };
}

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
