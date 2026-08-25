'use server';

import { revalidatePath } from 'next/cache';
import { supabaseServer } from '@/lib/supabase/server';
import { TRACKS, AUDIENCES, type Track } from '@/content/lists';
import { templateById } from '@/content/runsheets';

export type DayResult = { ok: boolean; error?: string };

function touch(clientId: string) {
  revalidatePath(`/app/clients/${clientId}`);
  revalidatePath(`/app/clients/${clientId}/runsheet`);
  revalidatePath(`/app/clients/${clientId}/live`);
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
  key_moment: boolean;
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
    /* An unchecked box sends nothing at all, which is why this reads presence
       rather than a value. The field is only rendered for the producer, so a
       couple saving a line can never mark or unmark one. */
    key_moment: form.get('key_moment') === 'on',
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


/**
 * Ticking a line off on the evening.
 *
 * The time is written by the server rather than sent from the browser, for the
 * same reason it is everywhere else here: a phone with the wrong clock would
 * otherwise record a chuppah at four in the afternoon, and this timestamp is
 * the one the next wedding gets planned from.
 *
 * Untick is a real operation and not an oversight. A tick during a wedding is
 * made one-handed while walking, and the first thing anybody does after
 * hitting the wrong row is look for the way back.
 */
export async function markDayItem(form: FormData): Promise<void> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const undo = String(form.get('undo') ?? '') === '1';
  if (!id || !clientId) return;

  const sb = await supabaseServer();
  const { error } = await sb
    .from('day_schedule')
    .update({ done_at: undo ? null : new Date().toISOString() })
    .eq('id', id);

  if (error) console.error('[day] tick failed', error);
  touch(clientId);
}

/**
 * Moving a line earlier or later in the run sheet.
 *
 * The sheet has no order column and does not want one: it is ordered by the
 * time each thing happens, and a second, invisible ordering that could
 * disagree with the clock is a run sheet that lies on the day. So moving a
 * line up trades start times with the line above it. That is also what a
 * producer means by the words: this happens at the earlier slot now, and the
 * other one takes this slot.
 *
 * The swap can leave an overlap. That is not hidden: the sheet already marks
 * two lines that collide, and a move that creates one should say so rather
 * than be refused, because "photos and the reception in the same half hour"
 * is sometimes exactly what somebody is arranging on purpose.
 */
export async function moveDayItem(form: FormData): Promise<void> {
  const id = String(form.get('item_id') ?? '');
  const clientId = String(form.get('client_id') ?? '');
  const up = String(form.get('direction') ?? '') === 'up';
  if (!id || !clientId) return;

  const sb = await supabaseServer();

  const { data: me, error: meError } = await sb
    .from('day_schedule')
    .select('id,track,at_time')
    .eq('id', id)
    .single();
  if (meError || !me) {
    console.error('[day] move: line not found', meError);
    return;
  }

  /* The neighbour within the same track, because the tracks are read as
     separate columns and a line jumping between them is not a move. Ordered
     and limited rather than fetched whole: a sheet can be forty lines and
     only the adjacent one matters. */
  const neighbour = await sb
    .from('day_schedule')
    .select('id,at_time')
    .eq('client_id', clientId)
    .eq('track', me.track)
    .neq('id', id)
    [up ? 'lt' : 'gt']('at_time', me.at_time)
    .order('at_time', { ascending: !up })
    .limit(1)
    .maybeSingle();

  if (neighbour.error) {
    console.error('[day] move: neighbour lookup failed', neighbour.error);
    return;
  }
  /* Already first or already last. Nothing to say and nothing to do. */
  if (!neighbour.data) return;

  /* Two writes rather than one statement, because PostgREST has no swap and
     the pair has no uniqueness constraint to trip over in between. If the
     second fails the first is rolled back by hand, so the sheet is never left
     with both lines on the same minute. */
  const mine = me.at_time as string;
  const theirs = neighbour.data.at_time as string;

  const first = await sb.from('day_schedule').update({ at_time: theirs }).eq('id', id);
  if (first.error) {
    console.error('[day] move: first write failed', first.error);
    return;
  }
  const second = await sb.from('day_schedule').update({ at_time: mine }).eq('id', neighbour.data.id);
  if (second.error) {
    console.error('[day] move: second write failed, undoing the first', second.error);
    await sb.from('day_schedule').update({ at_time: mine }).eq('id', id);
    return;
  }

  touch(clientId);
}
