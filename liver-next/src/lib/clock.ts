/**
 * What day it is, decided once instead of by whoever is asking.
 *
 * Two screens worked out "today" with `new Date()` and the machine's own
 * clock, which is two different answers at the same moment: the server runs in
 * UTC and the producer's phone runs in Israel, so between 21:00 and midnight
 * UTC they disagree about the date. A task due today rendered as on time on
 * the server and overdue on the phone, React found the two renders disagreed,
 * and the screen was rebuilt — the same class of failure as the sign-in shell,
 * arriving only in the evening, which is exactly when this product is used.
 *
 * Anchoring to one zone fixes the mismatch and is also the more correct
 * answer. A wedding on the fourth is on the fourth; the date on the row is a
 * plain date with no time and no zone attached, and the only reading of it
 * that means anything to the person holding the event is the local one. A
 * server in Virginia has no opinion worth having about when their day ends.
 */

/* Where the events happen. A constant rather than a setting: every producer on
   this platform runs events in Israel, and a per-account zone would be a
   column to get wrong in exchange for a case that does not exist yet. When it
   does, this is the one line that has to learn about it. */
export const EVENT_ZONE = 'Asia/Jerusalem';

const partsOf = new Intl.DateTimeFormat('en-US', {
  timeZone: EVENT_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
});

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A moment, as the plain date it falls on where the event is.
 *
 * A value that is already a plain date is returned untouched. Putting one
 * through a timezone conversion is how a date moves by a day: `2026-09-04`
 * parses as midnight UTC, and midnight UTC read in a zone behind it is the
 * third.
 */
export function dateInZone(value: string | number | Date): string {
  if (typeof value === 'string') {
    if (PLAIN_DATE.test(value)) return value;
    /* A timestamp that starts with a date, from a column that carries both. */
    if (PLAIN_DATE.test(value.slice(0, 10)) && value.length > 10) {
      const at = new Date(value);
      if (!Number.isNaN(at.getTime())) return format(at);
    }
    return value.slice(0, 10);
  }
  const at = value instanceof Date ? value : new Date(value);
  return Number.isNaN(at.getTime()) ? '' : format(at);
}

function format(at: Date): string {
  const p = partsOf.formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => p.find((x) => x.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Today where the event is. The same string on the server and in the
 *  browser, which is the whole point. */
export function todayInZone(now: number | Date = Date.now()): string {
  return format(now instanceof Date ? now : new Date(now));
}

/** Whole days from one plain date to another. Positive means `to` is later.
 *  Both sides are read as calendar days, so an hour of daylight saving cannot
 *  turn a day into a fraction of one. */
export function daysBetween(from: string, to: string): number {
  const a = asUtcMidnight(from);
  const b = asUtcMidnight(to);
  if (a === null || b === null) return 0;
  return Math.round((b - a) / 86_400_000);
}

function asUtcMidnight(isoDate: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Due before today, where the event is. A task due today is never late
 *  merely because it is the evening. */
export function isPastDue(due: string | null | undefined, now?: number | Date): boolean {
  if (!due) return false;
  const day = dateInZone(due);
  return day !== '' && day < todayInZone(now);
}
