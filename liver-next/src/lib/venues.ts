/**
 * What a hall actually costs.
 *
 * Four halls quote a couple four numbers and none of them mean the same
 * thing. One prices the plate before VAT and the bar per head; the next
 * prices the plate after VAT and the bar as a flat fee; a third leaves sound
 * and lighting out because "that is with your DJ", and the fourth adds twelve
 * per cent service on the food but not on the bar. The couple compares the
 * plate prices, because that is the only number all four said out loud, and
 * finds the rest out in March.
 *
 * This is the arithmetic that makes them one number. It is a pure module with
 * no database and no React in it, for the same reason the alcohol calculator
 * is: this is the part that has to be right, and the only way to know it is
 * right is to be able to test it without standing up a wedding.
 */

/** Israeli VAT, as a rate. Quoted per hall in this market either way, so both
 *  forms have to be normalised before two halls can be read against each
 *  other. A constant rather than a setting: a comparison run at a rate the
 *  law does not use is not a comparison, it is a guess with decimals. */
export const VAT = 0.18;

export type BarKind = 'flat' | 'per_person';

export type Venue = {
  id: string;
  venueName: string;
  location: string;
  platePrice: number;
  isVatIncluded: boolean;
  barCost: number;
  barType: BarKind;
  soundLightingCost: number;
  ancillaryFees: number;
  servicePercent: number;
  serviceFlat: number;
  contingencyPercent: number;
  prosCons: string[];
  quotePath: string;
  isSelected: boolean;
  contact: string;
  phone: string;
  touredOn: string | null;
  notes: string;
};

export type Costed = {
  /** The food, at whichever basis the comparison is being read on. */
  food: number;
  bar: number;
  soundLighting: number;
  ancillary: number;
  service: number;
  total: number;
  /** `total` with this venue's own buffer on top. */
  withBuffer: number;
  /** What one guest costs once the fixed fees are spread across them. This is
   *  the number a hall never quotes and the only one a couple can plan on. */
  perGuest: number;
};

const money = (n: number): number => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

/**
 * One hall, for one guest count, on one VAT basis.
 *
 * `withVat` is what the whole screen is being read on, not a property of the
 * hall: a couple decides once whether they are looking at prices with the tax
 * or without it, and every column follows. A hall that quoted the other way is
 * converted here rather than at the point it was typed in, so the number they
 * were told is the number the screen still shows them in its own field.
 */
export function cost(v: Venue, guests: number, withVat: boolean): Costed {
  const heads = Math.max(0, Math.floor(Number.isFinite(guests) ? guests : 0));

  /* Only the plate carries a VAT basis. The rest of what a hall charges is
     quoted as a sum to pay, and inventing a basis for it would be inventing
     a number rather than converting one. */
  const plate = v.isVatIncluded === withVat
    ? v.platePrice
    : withVat
      ? v.platePrice * (1 + VAT)
      : v.platePrice / (1 + VAT);

  const food = plate * heads;
  const bar = v.barType === 'per_person' ? v.barCost * heads : v.barCost;
  /* On the food, not on the whole evening: a service charge is a percentage
     of catering everywhere it is quoted, and applying it to the sound system
     would overstate every hall that has one. */
  const service = v.serviceFlat + (food * v.servicePercent) / 100;

  const total = food + bar + v.soundLightingCost + v.ancillaryFees + service;

  return {
    food: money(food),
    bar: money(bar),
    soundLighting: money(v.soundLightingCost),
    ancillary: money(v.ancillaryFees),
    service: money(service),
    total: money(total),
    withBuffer: money(total * (1 + v.contingencyPercent / 100)),
    /* Zero guests is a real state — a couple opens this before they know — and
       dividing by it would put Infinity on the screen. */
    perGuest: heads > 0 ? money(total / heads) : 0,
  };
}

/**
 * Which one is cheapest, once they are all the same shape.
 *
 * Returns the id rather than a flag on the row, because "best value" is a
 * property of the comparison and not of the hall: it changes the moment the
 * guest count moves, and a column that remembers it from the last render is a
 * badge on the wrong hall.
 *
 * Nothing is cheapest when there is one hall — a badge on the only column is
 * an award for showing up — or when two tie, because picking one of them by
 * row order would be inventing a difference the numbers do not have.
 */
export function bestValue(rows: { id: string; total: number }[]): string | null {
  if (rows.length < 2) return null;
  let best = rows[0];
  for (const r of rows) if (r.total < best.total) best = r;
  const tied = rows.filter((r) => r.total === best.total);
  return tied.length === 1 ? best.id : null;
}

/**
 * How much more than the cheapest, as a share.
 *
 * The comparison a couple actually makes out loud is not "which is cheapest"
 * but "how much is the nicer one going to cost me", and that is a percentage
 * rather than a shekel figure once the numbers are six digits long.
 */
export function overCheapest(total: number, cheapest: number): number {
  if (!(cheapest > 0) || total <= cheapest) return 0;
  return Math.round(((total - cheapest) / cheapest) * 1000) / 10;
}

/** The decision factors worth a badge. Keys rather than sentences, so the
 *  words are written once per language instead of typed into the database in
 *  whichever one the person adding the hall happened to be reading. */
export const VENUE_FLAGS = [
  'licence',    // רישיון עסק בתוקף
  'kosher',     // כשרות
  'volume',     // הגבלת ווליום אחרי 23:00
  'suite',      // חדר חתן־כלה
  'generator',  // גנרטור חירום
  'parking',    // חניה
  'accessible', // נגישות
] as const;

export type VenueFlag = (typeof VENUE_FLAGS)[number];

/** Only the ones on the list, and each of them once. A row read back from the
 *  database has been through a jsonb column, which will hold anything. */
export function readFlags(raw: unknown): VenueFlag[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: VenueFlag[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (!(VENUE_FLAGS as readonly string[]).includes(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item as VenueFlag);
  }
  return out;
}
