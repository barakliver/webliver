/**
 * Two things the season knows that no single evening does.
 *
 * The first is that somebody is booked twice on the same night. Nothing in
 * this product could ever have said so: a clash is not visible from either of
 * the two events, because each of them is perfectly staffed on its own, and
 * the only place it exists is in the pair. It is also the mistake that costs
 * the most — nobody finds out until one of the two weddings is a manager
 * short at four in the afternoon.
 *
 * The second is what each person has earned across the year. The fee is on
 * the assignment, one row at a time, and nothing summed it per person.
 *
 * Pure, so both can be tested rather than eyeballed against a fixture.
 */

export type Placement = {
  clientId: string;
  memberId: string;
  /** What this person is paid for that evening. Null is a real value and
   *  contributes nothing rather than breaking the sum. */
  fee?: number | string | null;
};

/** Only what the clash needs: which day each event falls on. */
export type WhenBy = ReadonlyMap<string, string | null>;

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const day = (d: string | null | undefined): string | null =>
  d ? d.slice(0, 10) : null;

export type Clash = {
  memberId: string;
  /** The day, as four-two-two. */
  date: string;
  /** Every event that person is on that day. Always two or more. */
  clientIds: string[];
};

/**
 * The same person, twice on one night.
 *
 * Events with no date cannot clash with anything: an event nobody has dated
 * is not on a night yet, and reporting it as a double booking would put a red
 * mark on every half-opened file in the system.
 *
 * A person on two events on one day is reported once, with both events named,
 * rather than as two separate warnings about each other.
 */
export function clashes(placements: readonly Placement[], when: WhenBy): Clash[] {
  const seen = new Map<string, Map<string, string[]>>();

  for (const p of placements) {
    const d = day(when.get(p.clientId));
    if (!d) continue;
    const byDay = seen.get(p.memberId) ?? new Map<string, string[]>();
    /* The same event twice is not a clash, it is one booking read twice. */
    const on = byDay.get(d) ?? [];
    if (!on.includes(p.clientId)) byDay.set(d, [...on, p.clientId]);
    seen.set(p.memberId, byDay);
  }

  const out: Clash[] = [];
  for (const [memberId, byDay] of seen) {
    for (const [date, clientIds] of byDay) {
      if (clientIds.length > 1) out.push({ memberId, date, clientIds });
    }
  }
  /* Soonest first: a clash next Thursday is a phone call today, and one in
     March is a note. */
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Just the ids of the people who are double booked, for a screen that only
 *  needs to know whether to mark a chip. */
export function clashingMembers(placements: readonly Placement[], when: WhenBy): Set<string> {
  return new Set(clashes(placements, when).map((c) => c.memberId));
}

/**
 * What each person has been paid across everything they are on.
 *
 * Every assignment counts, past and future alike: the question this answers
 * is what somebody costs over a year, and half of it having already happened
 * is the half that is certain.
 *
 * Producer-only, wherever it is drawn. Two people working the same evening
 * for different money is ordinary and is not theirs to see — which is why the
 * crew's own two functions in 0091 select neither the fee nor the rate.
 */
export function earningsBy(placements: readonly Placement[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const p of placements) {
    out.set(p.memberId, (out.get(p.memberId) ?? 0) + num(p.fee));
  }
  return out;
}
