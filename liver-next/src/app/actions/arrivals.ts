'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Marking somebody in on the evening.
 *
 * A single action for crew and suppliers, because on screen they are one list
 * and the producer tapping a name does not know which table it came from.
 *
 * Untick is a first-class operation rather than an afterthought. A tap made
 * one-handed while walking through a hall goes to the wrong row often enough
 * that the way back has to be the next thing under the thumb.
 */
export async function markArrival(form: FormData): Promise<void> {
  const kind = String(form.get('kind') ?? '');
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const undo = String(form.get('undo') ?? '') === '1';

  if (!id || !clientId || (kind !== 'crew' && kind !== 'vendor')) return;

  const sb = await supabaseServer();
  const { error } = await sb.rpc('mark_arrival', { p_kind: kind, p_id: id, p_undo: undo });
  if (error) console.error('[arrival] failed', error);

  revalidatePath(`/app/clients/${clientId}/live`);
  revalidatePath(`/app/clients/${clientId}`);
}
