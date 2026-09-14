/**
 * The staffing rule, written down once.
 *
 * It has been an iron rule of this business for years and it lived in one
 * person's head: an evening up to 350 guests takes a manager and an assistant;
 * above 350 it takes a manager and two. Social is on offer at every evening
 * and is never required — some couples buy it and most do not.
 *
 * Written down here rather than in the screen that draws it, because a rule
 * in a component is a rule that gets a second, slightly different copy the
 * first time another screen needs it. Everything in this file is pure, so the
 * rule can be tested rather than eyeballed against a fixture.
 */

export const CREW_SLOTS = ['manager', 'assistant', 'social'] as const;
export type CrewSlot = (typeof CREW_SLOTS)[number];

export const isSlot = (v: unknown): v is CrewSlot =>
  typeof v === 'string' && (CREW_SLOTS as readonly string[]).includes(v);

/** The evening at which one assistant becomes two. */
export const BIG_EVENING = 350;

export type CrewNeed = {
  slot: CrewSlot;
  /** How many the rule asks for. Zero for the one that is always optional. */
  need: number;
  /** Offered rather than required, which is a different kind of empty: a
   *  missing social is not a hole in the evening. */
  optional: boolean;
};

/**
 * How many guests to staff against.
 *
 * The producer's own estimate and the size of the guest list are two answers
 * to the same question, and they disagree all year: the estimate is written
 * at signing and the list fills up over nine months. Take the larger of them.
 * Being one assistant over on a 340-guest evening costs a fee; being one
 * under on a 360-guest evening costs the evening.
 *
 * Attending is deliberately not it. Two hundred confirmed out of three hundred
 * invited six weeks out is not a 200-guest wedding, it is a wedding where a
 * hundred people have not opened the message yet.
 */
export function expectedGuests(
  { estimate, invited }: { estimate?: number | null; invited?: number | null },
): number | null {
  const n = (v: number | null | undefined) =>
    typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.floor(v) : null;
  const a = n(estimate);
  const b = n(invited);
  if (a === null && b === null) return null;
  return Math.max(a ?? 0, b ?? 0);
}

/**
 * What an evening of this size takes.
 *
 * A guest count nobody has written down yet returns the smaller staffing, not
 * nothing: every evening needs a manager and an assistant whatever else is
 * true, and a screen that says "unknown" where it could say "at least these
 * two" has made the producer do the arithmetic himself. `certain` is how the
 * screen knows to add the sentence about 350.
 */
export function crewNeeds(guests: number | null): { needs: CrewNeed[]; certain: boolean } {
  const big = guests !== null && guests > BIG_EVENING;
  return {
    certain: guests !== null,
    needs: [
      { slot: 'manager', need: 1, optional: false },
      { slot: 'assistant', need: big ? 2 : 1, optional: false },
      { slot: 'social', need: 0, optional: true },
    ],
  };
}

export type SlotState = {
  slot: CrewSlot;
  need: number;
  filled: number;
  optional: boolean;
  /** How many are still missing. Never negative: three assistants on a small
   *  evening is somebody's decision, not a fault to report. */
  short: number;
};

/** The rule against who is actually on the evening. */
export function crewState(
  guests: number | null,
  assigned: readonly { slot?: string | null }[],
): { slots: SlotState[]; short: number; certain: boolean } {
  const { needs, certain } = crewNeeds(guests);
  const count = (s: CrewSlot) => assigned.filter((a) => a.slot === s).length;

  const slots = needs.map((n) => {
    const filled = count(n.slot);
    return { ...n, filled, short: Math.max(0, n.need - filled) };
  });

  return { slots, certain, short: slots.reduce((t, s) => t + s.short, 0) };
}

/**
 * Who can be put in this role, best first.
 *
 * People who say they do this job come before people who do not — but the
 * ones who do not are still on the list rather than hidden. A crew list is a
 * description of who usually does what, and at eight in the evening two days
 * out, "usually" stops being the question.
 */
export function candidatesFor<T extends { roles?: readonly string[] | null; name: string }>(
  people: readonly T[],
  slot: CrewSlot,
): T[] {
  const can = (p: T) => (p.roles ?? []).includes(slot);
  return [...people].sort((a, b) => {
    if (can(a) !== can(b)) return can(a) ? -1 : 1;
    return a.name.localeCompare(b.name, 'he');
  });
}
