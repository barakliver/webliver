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
 *
 * Like the tick on the schedule, it answers. The headcount on this screen is
 * what a producer decides on — whether to hold the entrance, whether to start
 * ringing people — and a check-in that quietly did not save is a number that
 * is wrong in the direction that matters, on the one night nobody has time to
 * go back and audit it.
 */
export type ArrivalResult = { ok: boolean; error?: string };

export async function markArrival(
  _prev: ArrivalResult | null,
  form: FormData,
): Promise<ArrivalResult> {
  const kind = String(form.get('kind') ?? '');
  const id = String(form.get('id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const undo = String(form.get('undo') ?? '') === '1';

  if (!id || !clientId || (kind !== 'crew' && kind !== 'vendor')) {
    return { ok: false, error: 'חסרים פרטים' };
  }

  const sb = await supabaseServer();
  const { error } = await sb.rpc('mark_arrival', { p_kind: kind, p_id: id, p_undo: undo });
  if (error) {
    console.error('[arrival] failed', error);
    return { ok: false, error: 'לא נשמר' };
  }

  revalidatePath(`/app/clients/${clientId}/live`);
  revalidatePath(`/app/clients/${clientId}`);
  return { ok: true };
}
