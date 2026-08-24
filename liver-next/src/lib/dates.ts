/**
 * Dates that cannot take a page down.
 *
 * Every screen in this app checks a date for null before formatting it, and
 * none of them checked it for being a date. `Intl.DateTimeFormat.format` does
 * not return "Invalid Date" the way `toString` does — it throws
 * `RangeError: Invalid time value`. Thrown during a server render, that is a
 * blank page with a stack trace in the log, from one row whose column happened
 * to hold something unexpected.
 *
 * Today those columns are Postgres `date` and `timestamptz`, so they are always
 * well formed and none of this fires. That is exactly why it is worth having:
 * the day a date arrives from a webhook, a CSV import or a hand-written SQL
 * fix, the screen should show a dash rather than nothing at all. A missing date
 * is information; a missing page is a bug report.
 */

/** A real Date, or null. Never throws, whatever it is handed. */
export function parseDate(value: string | number | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === '') return null;

  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Formatted, or the fallback. The fallback is required rather than defaulted,
 *  so every call site has decided what an absent date should read as instead of
 *  inheriting somebody else's choice of dash. */
export function formatDate(
  fmt: Intl.DateTimeFormat,
  value: string | number | Date | null | undefined,
  fallback: string
): string {
  const d = parseDate(value);
  if (!d) return fallback;
  try {
    return fmt.format(d);
  } catch {
    /* Belt and braces. parseDate has already ruled out the one case that
       throws, and a formatter that finds another is still not worth a page. */
    return fallback;
  }
}

/** Whole days from today to a date, counted on calendar dates so a late evening
 *  visit does not shave a day off a countdown. Null when there is no usable
 *  date, which is a different answer from zero.
 *
 *  This existed in four files, twice with a different signature and once
 *  rounding the other way. Two of them are now this one. The other two take a
 *  precomputed epoch because they run once per row over a whole board, and
 *  folding them in would trade a real cost for a tidier import. */
export function daysUntil(value: string | null | undefined, from: Date = new Date()): number | null {
  const d = parseDate(value);
  if (!d) return null;
  const today = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const then = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((then - today) / 86_400_000);
}

/** True when a due date is before today. Compared on calendar dates, so
 *  something due today never reads as late, and false when there is no date:
 *  a task nobody dated is waiting, not overdue. */
export function isOverdue(value: string | null | undefined, from: Date = new Date()): boolean {
  const days = daysUntil(value, from);
  return days !== null && days < 0;
}
