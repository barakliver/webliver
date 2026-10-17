/**
 * Whether a clock reading falls inside a window that may wrap past midnight.
 *
 * Pure and on its own so the test can hold it: the wrap is the case people
 * actually set ("23:00 to 07:30") and the one a naive comparison gets wrong.
 * Times are "HH:MM" in the events' zone; the caller formats the clock.
 */
const minutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

export function inQuietHours(now: string, start: string | null, end: string | null): boolean {
  if (!start || !end) return false;
  const n = minutes(now);
  const s = minutes(start);
  const e = minutes(end);
  if (s === e) return false;
  return s < e ? n >= s && n < e : n >= s || n < e;
}
