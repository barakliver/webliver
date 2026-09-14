/**
 * What a crew member can see, and the shape it arrives in.
 *
 * Every read here goes through a security-definer function rather than a
 * table, which is the whole security model of this area: see 0091. The types
 * below are the contract those two functions promise, and if one of them ever
 * grows a column the change has to be made in both places on purpose.
 */

export type Shift = {
  client_id: string;
  display_name: string;
  event_date: string | null;
  venue: string;
  slot: string | null;
  role: string;
  call_time: string | null;
  note: string;
  brand: string;
};

export type ShiftDetail = {
  event: { id: string; name: string; date: string | null; venue: string; crewNote: string; brand: string };
  mine: { slot: string | null; role: string; callTime: string | null; note: string };
  schedule: { id: string; at: string; title: string; note: string; track: string }[];
  kit: { id: string; item: string; needed: boolean; sorted: boolean; note: string }[];
  crew: { name: string; slot: string | null; role: string }[];
};

/**
 * Past, today, or ahead.
 *
 * Pure, and separate from the screen, because "is this evening over" is the
 * one question the list is sorted and coloured by and it is off by one at
 * midnight if it is worked out from a timestamp rather than a date.
 */
export function shiftWhen(date: string | null, today: string): 'past' | 'today' | 'ahead' {
  if (!date) return 'ahead';
  const d = date.slice(0, 10);
  if (d < today) return 'past';
  if (d === today) return 'today';
  return 'ahead';
}

/** Soonest first, with what is already over at the bottom rather than at the
 *  top of somebody's screen on a Sunday morning. */
export function sortShifts<T extends { event_date: string | null }>(
  rows: readonly T[], today: string,
): T[] {
  const rank = (r: T) => (shiftWhen(r.event_date, today) === 'past' ? 1 : 0);
  return [...rows].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    /* Within the past, the most recent first: last night is the one somebody
       is still thinking about, not one from March. */
    const past = rank(a) === 1;
    return past
      ? b.event_date.localeCompare(a.event_date)
      : a.event_date.localeCompare(b.event_date);
  });
}
