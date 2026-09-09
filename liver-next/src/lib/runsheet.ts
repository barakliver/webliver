/**
 * Reading a schedule that crosses midnight.
 *
 * An Israeli wedding ends after midnight and is packed up after that, so a
 * normal evening has lines at 19:00, 00:30 and 01:00. Sorted as text — which
 * is what `order by at_time` does, and what every list here was doing — the
 * last two lines of the night sort to the top and the printed sheet opens with
 * the pack-down. Nobody reports this as a bug; they just stop trusting the
 * sheet.
 *
 * The fix is not a fixed cutoff hour. A sunrise ceremony at 05:00 is a real
 * event, and a rule that says "before six means tomorrow" moves it to the end
 * of its own day. So the schedule decides for itself: an early hour is
 * tomorrow only when the same schedule also has something in the evening. A
 * morning event has no evening lines and is left exactly as written.
 */

/** Postgres hands back "09:00:00"; nobody writes the seconds on a schedule. */
export const hhmm = (t: string) => (t || '').slice(0, 5);

const toMinutes = (t: string): number => {
  const [h, m] = hhmm(t).split(':');
  const hours = Number(h);
  const mins = Number(m);
  return Number.isFinite(hours) && Number.isFinite(mins) ? hours * 60 + mins : 0;
};

/** Anything at or after this is "the evening", and anything before the small
 *  hours mark is "after midnight" — but only when both are present. */
const EVENING = 18 * 60;
const SMALL_HOURS = 6 * 60;

/** True when this schedule runs past midnight, judged by the lines themselves
 *  rather than assumed. */
export function crossesMidnight(times: string[]): boolean {
  let evening = false;
  let early = false;
  for (const t of times) {
    const m = toMinutes(t);
    if (m >= EVENING) evening = true;
    if (m < SMALL_HOURS) early = true;
  }
  return evening && early;
}

/** Minutes from the start of the event's own day, so 01:00 after a 20:00
 *  chuppah is later than 20:00 rather than nineteen hours earlier. */
export function eventMinutes(time: string, wraps: boolean): number {
  const m = toMinutes(time);
  return wraps && m < SMALL_HOURS ? m + 24 * 60 : m;
}

export type Timed = { at_time: string };

/** The order somebody actually reads the day in. */
export function inDayOrder<T extends Timed>(items: T[]): T[] {
  const wraps = crossesMidnight(items.map((i) => i.at_time));
  return [...items].sort(
    (a, b) => eventMinutes(a.at_time, wraps) - eventMinutes(b.at_time, wraps)
  );
}

/** How long a line runs, and how it was decided.
 *
 *  A stated duration is used as stated. Otherwise the gap to the next line is
 *  shown, clearly marked as a gap, because "until the next thing" is a
 *  different claim from "forty minutes" and the sheet should not blur the two.
 *  The last line of the night has neither and says nothing, which is the
 *  honest answer. */
export function spanOf<T extends Timed & { duration_min?: number | null }>(
  items: T[],
  index: number
): { minutes: number | null; stated: boolean } {
  const item = items[index];
  if (item.duration_min && item.duration_min > 0) return { minutes: item.duration_min, stated: true };

  const wraps = crossesMidnight(items.map((i) => i.at_time));
  const start = eventMinutes(item.at_time, wraps);
  for (let i = index + 1; i < items.length; i += 1) {
    const next = eventMinutes(items[i].at_time, wraps);
    if (next > start) return { minutes: next - start, stated: false };
  }
  return { minutes: null, stated: false };
}

/** "45 דק׳", "שעה וחצי", "שעתיים". Written the way somebody says it out loud,
 *  because a run sheet is read aloud more often than it is read. */
export function humanSpan(minutes: number): string {
  if (minutes < 60) return `${minutes} דק׳`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? 'שעה' : h === 2 ? 'שעתיים' : `${h} שעות`;
  if (m === 0) return hours;
  if (m === 30) return h === 1 ? 'שעה וחצי' : `${hours} וחצי`;
  return `${hours} ו־${m} דק׳`;
}

/**
 * Lines that collide.
 *
 * Two things starting at once is normal and is not flagged — a wedding has the
 * band setting up while the couple is being photographed. What is flagged is
 * one line running into the next *on the same track*, because a track is one
 * person's morning and a person cannot be in two places. That is the version
 * of this warning somebody will act on rather than learn to ignore.
 *
 * Only stated durations count. Inferring an overlap from a gap we invented
 * would flag every schedule on earth.
 */
export type Overlap = { id: string; withTitle: string };

export function findOverlaps<T extends Timed & {
  id: string; title: string; track: string; duration_min?: number | null;
}>(items: T[]): Map<string, Overlap> {
  const wraps = crossesMidnight(items.map((i) => i.at_time));
  const out = new Map<string, Overlap>();

  const byTrack = new Map<string, T[]>();
  for (const i of items) {
    const list = byTrack.get(i.track) ?? [];
    list.push(i);
    byTrack.set(i.track, list);
  }

  for (const list of byTrack.values()) {
    const sorted = [...list].sort(
      (a, b) => eventMinutes(a.at_time, wraps) - eventMinutes(b.at_time, wraps)
    );
    for (let i = 0; i < sorted.length - 1; i += 1) {
      const cur = sorted[i];
      if (!cur.duration_min || cur.duration_min <= 0) continue;
      const ends = eventMinutes(cur.at_time, wraps) + cur.duration_min;
      const next = sorted[i + 1];
      if (eventMinutes(next.at_time, wraps) < ends) {
        out.set(cur.id, { id: next.id, withTitle: next.title });
      }
    }
  }
  return out;
}
