'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { TRACKS, AUDIENCES, type Track } from '@/content/lists';
import { templateById } from '@/content/runsheets';

export type DayResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath(`/app/clients/${clientId}/runsheet`);
  revalidatePath('/app/portal');
}

/** Only roles the database will accept. Anything else is dropped rather than
 *  rejected: a line whose audience got mangled should still reach the sheet,
 *  addressed to everyone, instead of being lost over a checkbox. */
function readAudience(form: FormData): string[] {
  const known = new Set(AUDIENCES.map((a) => a.value as string));
  return form.getAll('audience').map(String).filter((a) => known.has(a));
}

/** Minutes, or nothing. Nothing is a real answer — most lines have no agreed
 *  length and pretending otherwise puts a number on the sheet that nobody
 *  said. Out of range is treated as unsaid rather than as an error, because
 *  the check constraint would refuse the whole row over a typo in a field that
 *  is optional to begin with. */
function readDuration(form: FormData): number | null {
  const raw = String(form.get('duration_min') ?? '').trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 && n <= 960 ? Math.round(n) : null;
}

type DayFields = {
  track: Track; at_time: string; title: string; note: string;
  owner: string; audience: string[]; duration_min: number | null;
};

function readFields(form: FormData): DayFields | string {
  const title = String(form.get('title') ?? '').trim();
  const time = String(form.get('at_time') ?? '').trim();
  const trackRaw = String(form.get('track') ?? 'shared');

  if (title.length < 2) return 'נא לכתוב מה קורה';
  if (!/^\d{2}:\d{2}$/.test(time)) return 'נא לבחור שעה';

  return {
    track: TRACKS.includes(trackRaw as Track) ? (trackRaw as Track) : 'shared',
    at_time: time,
    title: title.slice(0, 160),
    note: String(form.get('note') ?? '').trim().slice(0, 500),
    owner: String(form.get('owner') ?? '').trim().slice(0, 80),
    audience: readAudience(form),
    duration_min: readDuration(form),
  };
}

export async function addDayItem(_prev: DayResult | null, form: FormData): Promise<DayResult> {
  const clientId = String(form.get('client_id') ?? '');
  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };

  const fields = readFields(form);
  if (typeof fields === 'string') return { ok: false, error: fields };

  const sb = await supabaseServer();
  const { error } = await sb.from('day_schedule').insert({ client_id: clientId, ...fields });
  if (error) {
    console.error('[day] insert failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את השורה' };
  }

  touch(clientId);
  return { ok: true };
}

/** Correcting a line rather than deleting and retyping it.
 *
 *  Its absence was the single most annoying thing about this panel: a time
 *  typed as 19:00 instead of 09:00 had to be destroyed and rebuilt, so on a
 *  forty line schedule the correction was deferred and then forgotten. */
export async function updateDayItem(_prev: DayResult | null, form: FormData): Promise<DayResult> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  if (!id || !clientId) return { ok: false, error: 'חסר מזהה שורה' };

  const fields = readFields(form);
  if (typeof fields === 'string') return { ok: false, error: fields };

  const sb = await supabaseServer();
  const { error } = await sb.from('day_schedule').update(fields).eq('id', id);
  if (error) {
    console.error('[day] update failed', error);
    return { ok: false, error: 'לא הצלחנו לשמור את השינוי' };
  }

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

/**
 * Filling an empty schedule from a starting point.
 *
 * Refused outright once a schedule has anything in it. A template is a
 * hundred rows; merging it into an evening somebody already planned would be
 * unpickable, and there is no undo here. The database is asked whether the
 * schedule is empty rather than the browser, because between the render that
 * showed the button and the click that used it, a partner may have started
 * writing.
 */
export async function applyRunsheetTemplate(_prev: DayResult | null, form: FormData): Promise<DayResult> {
  const clientId = String(form.get('client_id') ?? '');
  const template = templateById(String(form.get('template') ?? ''));

  if (!clientId) return { ok: false, error: 'חסר מזהה אירוע' };
  if (!template) return { ok: false, error: 'לא מצאנו את הלוז הזה' };

  const sb = await supabaseServer();

  const { data: empty, error: checkError } = await sb.rpc('day_schedule_is_empty', { p_client: clientId });
  if (checkError) {
    console.error('[day] emptiness check failed', checkError);
    return { ok: false, error: 'לא הצלחנו לבדוק את הלוז הקיים' };
  }
  if (!empty) return { ok: false, error: 'כבר יש שורות בלוז. אפשר להוסיף שורות ידנית.' };

  const rows = template.lines.map((l) => ({
    client_id: clientId,
    track: l.track ?? 'shared',
    at_time: l.at,
    title: l.title,
    note: l.note ?? '',
    owner: l.owner ?? '',
    audience: l.audience ?? [],
    duration_min: l.minutes ?? null,
  }));

  const { error } = await sb.from('day_schedule').insert(rows);
  if (error) {
    console.error('[day] template insert failed', error);
    return { ok: false, error: 'לא הצלחנו לפתוח את הלוז' };
  }

  touch(clientId);
  return { ok: true };
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
