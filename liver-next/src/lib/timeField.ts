/**
 * A time as a person types it, made into the one shape the schedule stores.
 *
 * The run sheet's time field was a native time input, and on a machine set
 * to a twelve hour clock it can show "07:30" with no AM or PM chosen and
 * submit an empty string — the screen said a time, the form carried none,
 * and the answer was "please choose a time" over a field that plainly had
 * one. The field is typed now, and this accepts what people type: 19:30,
 * 1930, 19.30, 7:30, 19:30:00. Anything else is null, and the form says so
 * before it is sent.
 */
export function normalizeTime(raw: string): string | null {
  const s = raw.trim().replace(/[.׳’']/g, ':');
  let m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) {
    const digits = s.match(/^(\d{3,4})$/);
    if (!digits) return null;
    const d = digits[1].padStart(4, '0');
    m = [d, d.slice(0, 2), d.slice(2)] as unknown as RegExpMatchArray;
  }
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}
