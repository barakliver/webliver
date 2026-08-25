'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { TRACKS, type Track } from '@/content/lists';

export type DayResult = { ok: boolean; error?: string };


function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath('/app/portal');
}

export async function addDayItem(_prev: DayResult | null, form: FormData): Promise<DayResult> {
  const clientId = String(form.get('client_id') ?? '');
  const title = String(form.get('title') ?? '').trim();
  const time = String(form.get('at_time') ?? '').trim();
  const trackRaw = String(form.get('track') ?? 'shared');
  const track: Track = TRACKS.includes(trackRaw as Track) ? (trackRaw as Track) : 'shared';

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (title.length < 2) return { ok: false, error: 'נא לכתוב מה קורה' };
  if (!/^\d{2}:\d{2}$/.test(time)) return { ok: false, error: 'נא לבחור שעה' };

  const sb = await supabaseServer();
  const { error } = await sb.from('day_schedule').insert({
    client_id: clientId, track, at_time: time, title,
    note: String(form.get('note') ?? '').trim(),
  });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את השורה' };

  touch(clientId);
  return { ok: true };
}

export async function deleteDayItem(form: FormData): Promise<void> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id) return;
  const sb = await supabaseServer();
  await sb.from('day_schedule').delete().eq('id', id);
  touch(clientId);
}

/** The two track names are the couple's own words, and the clients row is
 *  otherwise producer-only, so this goes through the narrow function that
 *  touches nothing but those labels. */
export async function renameTracks(_prev: DayResult | null, form: FormData): Promise<DayResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const sb = await supabaseServer();
  const { error } = await sb.rpc('set_day_track_labels', {
    p_client: clientId,
    p_a: String(form.get('track_a_label') ?? '').slice(0, 40),
    p_b: String(form.get('track_b_label') ?? '').slice(0, 40),
  });
  if (error) return { ok: false, error: 'לא הצלחנו לשמור את השמות' };

  touch(clientId);
  return { ok: true };
}
