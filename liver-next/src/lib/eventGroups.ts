/**
 * The list of events, in the order a season is actually read.
 *
 * A flat list of every live event is right until there are twenty of them, and
 * then the question stops being "what is next" and becomes "what does next
 * summer look like". So: years, and inside a year the two things a couple can
 * be buying — the whole production, or the evening itself.
 *
 * Nothing here is configured. The years are whatever years the events fall in:
 * an event opened for 2028 makes a 2028 heading appear the moment it is saved,
 * and the year nobody has an event in does not exist. A list of years somebody
 * has to maintain is a list that is wrong the first time it is not.
 */

export const SERVICES = ['production', 'management'] as const;
export type Service = (typeof SERVICES)[number];

export const isService = (v: unknown): v is Service =>
  typeof v === 'string' && (SERVICES as readonly string[]).includes(v);

type Datedish = { eventDate: string | null; service?: string };

/** The year an event falls in, or null for one with no date yet. */
export function yearOf(date: string | null | undefined): string | null {
  if (!date) return null;
  const m = /^(\d{4})-\d{2}-\d{2}/.exec(date);
  return m ? m[1] : null;
}

export type YearGroup<T> = {
  /** The four digits, or null for the events with no date. */
  year: string | null;
  rows: T[];
  /** The same rows split by what the couple is buying, in a fixed order so
   *  the second heading does not move about between years. */
  services: { service: Service; rows: T[] }[];
};

/**
 * Years first, soonest first, with the dateless ones last.
 *
 * Last rather than first: an event with no date is usually one that has just
 * been opened and has nothing in it yet, and putting it above a wedding that
 * is in four months makes the screen open on the least urgent thing on it.
 *
 * Within a year the rows keep the order they arrived in, which is the order
 * the board already sorted them into — by date, soonest first. Re-sorting here
 * would be a second opinion about the same question.
 */
export function groupByYear<T extends Datedish>(rows: readonly T[]): YearGroup<T>[] {
  const byYear = new Map<string | null, T[]>();
  for (const r of rows) {
    const y = yearOf(r.eventDate);
    byYear.set(y, [...(byYear.get(y) ?? []), r]);
  }

  const years = [...byYear.keys()].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  return years.map((year) => {
    const group = byYear.get(year) ?? [];
    return {
      year,
      rows: group,
      /* Only the kinds that are actually there. A heading over nothing is a
         heading that teaches somebody to skip headings. */
      services: SERVICES
        .map((service) => ({
          service,
          rows: group.filter((r) => (isService(r.service) ? r.service : 'production') === service),
        }))
        .filter((s) => s.rows.length > 0),
    };
  });
}
