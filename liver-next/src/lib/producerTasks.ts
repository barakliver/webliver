/**
 * The producer's own list: when a routine comes back, and what order the
 * list is read in.
 *
 * Kept out of the server action and out of the component on purpose. Date
 * arithmetic is the part of this feature that can be wrong without looking
 * wrong — a monthly task set on the 31st, a weekly one ticked eleven days
 * late — and the only way to know it is right is to be able to ask it
 * questions without a database and without a browser.
 */

export const REPEATS = ['none', 'daily', 'weekly', 'monthly'] as const;
export type Repeat = (typeof REPEATS)[number];

export const isRepeat = (v: unknown): v is Repeat =>
  typeof v === 'string' && (REPEATS as readonly string[]).includes(v);

export type ProducerTask = {
  id: string;
  title: string;
  note: string;
  due_on: string | null;
  repeat_every: Repeat;
  done: boolean;
  done_on: string | null;
};

const PLAIN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** A plain date as its three numbers, or null if it is not one. */
function parts(date: string): [number, number, number] | null {
  const m = PLAIN.exec(date);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

const pad = (n: number) => String(n).padStart(2, '0');
const plain = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

/** How many days February has that year, and every other month. */
const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * One period on.
 *
 * Days and weeks are plain addition. Months are not: the 31st of January plus
 * a month is not the 31st of February, and a naive `setMonth` rolls it into
 * March — so "the last of the month" becomes "the first week of the month
 * after" and then walks forward a few days every time it is ticked. It is
 * clamped to the last day the month actually has instead, which is both the
 * obvious reading and the one that stays put.
 */
export function advance(date: string, repeat: Repeat): string {
  const p = parts(date);
  if (!p || repeat === 'none') return date;
  const [y, m, d] = p;

  if (repeat === 'daily' || repeat === 'weekly') {
    const step = repeat === 'daily' ? 1 : 7;
    const t = new Date(Date.UTC(y, m - 1, d + step));
    return plain(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
  }

  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  return plain(nextY, nextM, Math.min(d, daysInMonth(nextY, nextM)));
}

/**
 * When a routine is next due, having just been ticked.
 *
 * It advances from the date it was *due* rather than from today, so a weekly
 * task lands on the same weekday however late it was done — the rhythm is the
 * point of a routine. But it keeps advancing until it is past today, because
 * one week after a date eleven days ago is still in the past, and a task that
 * arrives already overdue is a task that teaches somebody to ignore the
 * colour red.
 *
 * A routine with no date starts from today.
 */
export function nextDue(dueOn: string | null, repeat: Repeat, today: string): string | null {
  if (repeat === 'none') return null;
  let next = dueOn && parts(dueOn) ? dueOn : today;
  /* Bounded rather than `while (true)`: a row whose date is years behind
     should not spin the server. Daily over ten years is the worst case worth
     surviving, and anything past that lands on today. */
  for (let i = 0; i < 4000 && next <= today; i++) next = advance(next, repeat);
  return next > today ? next : today;
}

/**
 * The order the list is read in.
 *
 * Late first, then today, then what is coming, then the ones with no date at
 * all. A list sorted by date alone buries "the van needs emptying" — which has
 * no date and never will — under three months of scheduled work, and a list
 * sorted by when it was written buries what is late.
 */
export function sortTasks<T extends { due_on: string | null; title: string }>(
  tasks: readonly T[],
): T[] {
  return [...tasks].sort((a, b) => {
    if (a.due_on && b.due_on) return a.due_on < b.due_on ? -1 : a.due_on > b.due_on ? 1 : a.title.localeCompare(b.title);
    if (a.due_on) return -1;
    if (b.due_on) return 1;
    return a.title.localeCompare(b.title);
  });
}

/** Late, due today, or neither — the one place that decides. */
export type Standing = 'late' | 'today' | 'ahead';
export const standing = (dueOn: string | null, today: string): Standing =>
  !dueOn ? 'ahead' : dueOn < today ? 'late' : dueOn === today ? 'today' : 'ahead';

/** How many are asking for attention now, for the heading. */
export const dueCount = (tasks: readonly ProducerTask[], today: string): number =>
  tasks.filter((t) => !t.done && t.due_on !== null && t.due_on <= today).length;
