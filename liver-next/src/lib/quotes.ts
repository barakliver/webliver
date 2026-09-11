/**
 * Quotes side by side, and what choosing one does to the budget.
 *
 * The halls have had this since the venue comparison; every other supplier
 * had nothing, and three photographers' quotes were compared in a WhatsApp
 * thread with the budget finding out in March. This is the arithmetic for
 * the rest of them, kept pure so it can be checked: which suppliers are worth
 * a comparison, what order they go in, what an hour costs, and exactly what
 * a press on "choose" would take out of the budget and put in.
 *
 * Two things it refuses to do. It never invents a number: an amount nobody
 * wrote down is unknown, sorts last, and is drawn as unknown rather than as
 * nought. And it never treats a chosen quote as a booking: the effect it
 * describes is on the estimate column and nothing else.
 */

export type QuoteVendor = {
  id: string;
  name: string;
  category: string;
  status: string;
  chosen: boolean;
  quote_amount: number | string | null;
  quote_hours: number | string | null;
  quote_scope: string;
  quote_includes: string;
  quote_extras: string;
  quote_terms: string;
};

/** A budget line that belongs to a supplier. `agreed` null is an estimate;
 *  a figure is a commitment, and a comparison never removes one. */
export type QuoteLine = {
  event_vendor_id: string | null;
  estimate: number | string;
  agreed: number | string | null;
};

const num = (v: number | string | null | undefined): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const amountOf = (v: QuoteVendor): number | null => num(v.quote_amount);
export const hoursOf = (v: QuoteVendor): number | null => num(v.quote_hours);

/** What an hour costs, where both halves are known. A photographer at 9,000
 *  for six hours and one at 11,000 for ten are not the order the amounts
 *  put them in. */
export function perHour(v: QuoteVendor): number | null {
  const a = amountOf(v);
  const h = hoursOf(v);
  if (a === null || h === null || h <= 0) return null;
  return Math.round(a / h);
}

/** Has anything at all been written on the quote. */
export const hasQuote = (v: QuoteVendor): boolean =>
  amountOf(v) !== null || hoursOf(v) !== null
  || !!v.quote_scope.trim() || !!v.quote_includes.trim() || !!v.quote_extras.trim() || !!v.quote_terms.trim();

/** Cheapest first, unknown last, name as the tiebreak so the order is the
 *  same on every render. */
const byAmount = (a: QuoteVendor, b: QuoteVendor) => {
  const x = amountOf(a);
  const y = amountOf(b);
  if (x === null && y === null) return a.name.localeCompare(b.name, 'he');
  if (x === null) return 1;
  if (y === null) return -1;
  return x - y || a.name.localeCompare(b.name, 'he');
};

export type QuoteGroup = { category: string; vendors: QuoteVendor[] };

/**
 * The categories worth a table: any with two suppliers or more, or one with
 * a quote written on it. A category with one supplier and no quote is a
 * name on a list, and a comparison table with one row and no figures is a
 * table that teaches somebody to stop reading tables.
 */
export function quoteGroups(vendors: QuoteVendor[]): QuoteGroup[] {
  const by = new Map<string, QuoteVendor[]>();
  for (const v of vendors) {
    if (v.status === 'cancelled') continue;
    const key = v.category || 'other';
    by.set(key, [...(by.get(key) ?? []), v]);
  }
  return [...by.entries()]
    .filter(([, list]) => list.length >= 2 || list.some(hasQuote))
    .map(([category, list]) => ({ category, vendors: [...list].sort(byAmount) }))
    .sort((a, b) => a.category.localeCompare(b.category, 'he'));
}

export type ChoiceEffect = {
  /** The suppliers whose estimate lines would leave the budget. */
  replaces: { name: string; amount: number }[];
  /** What this quote would put in, or update the line to. */
  adds: number;
  /** Net change to the budget's estimates. */
  delta: number;
  /** Already the chosen one, with its line already at this amount. */
  noop: boolean;
};

/**
 * What a press on "choose" would do, before it is pressed.
 *
 * Read from the same rows the screen already has, so the sentence beside
 * the button and the rows after the save cannot disagree. A sibling's line
 * with an agreed figure is not counted as leaving: the database will not
 * delete it, and the sentence must not promise that it will.
 */
export function effectOfChoosing(id: string, vendors: QuoteVendor[], lines: QuoteLine[]): ChoiceEffect | null {
  const me = vendors.find((v) => v.id === id);
  const adds = me ? amountOf(me) : null;
  if (!me || adds === null) return null;

  const lineOf = (vid: string) => lines.find((l) => l.event_vendor_id === vid);
  const replaces = vendors
    .filter((v) => v.id !== me.id && v.category === me.category && v.chosen)
    .map((v) => ({ v, line: lineOf(v.id) }))
    .filter(({ line }) => line && num(line.agreed) === null)
    .map(({ v, line }) => ({ name: v.name, amount: num(line!.estimate) ?? 0 }));

  const mine = lineOf(me.id);
  const current = mine ? num(mine.estimate) ?? 0 : 0;
  const removed = replaces.reduce((s, r) => s + r.amount, 0);
  const delta = adds - current - removed;
  const noop = me.chosen && mine !== undefined && current === adds && replaces.length === 0;
  return { replaces, adds, delta, noop };
}
