import { sumIls } from './money.ts';

/**
 * What a couple has paid and will pay, cut at the evening itself.
 *
 * The question a producer is asked while a couple works out what the wedding
 * costs is not "how much is owed" - the panel already says that - but "how
 * much goes out before the day, and how much is still to go after it", and
 * through what, and from whose account. So the instalments are cut at the
 * event date: what was paid on or before it and what is due on or before it
 * are the first half, the rest is the second.
 *
 * Two edges, both chosen rather than fallen into. The day itself is before,
 * because an instalment due on the wedding is paid for the wedding. And an
 * instalment nobody has dated is neither: it is counted on its own line,
 * because filing it under "after" would tell a couple the year is lighter
 * than it is, and under "before" the opposite. A settled payment always has a
 * date, the database insists, so only unpaid ones can be undated.
 *
 * With no event date at all there is no cut to make; `split` says so and the
 * halves are empty, so the screen shows the totals and a sentence rather than
 * a split that would be a guess.
 *
 * Pure and tested. Sums go through `sumIls`, which adds in agorot.
 */
export type FlowRow = {
  amount: number;
  due_on: string | null;
  paid: boolean;
  paid_on: string | null;
  paid_by?: string | null;
  method?: string | null;
};

export type Flow = {
  total: number;
  paid: number;
  remaining: number;
  /** False when there is no event date, so no before and after to draw. */
  split: boolean;
  before: { paid: number; due: number };
  after: { paid: number; due: number };
  /** Unpaid and with no due date: in the remaining, in neither half. */
  undated: number;
  /** What was paid, by how. Largest first; the empty key is "not said". */
  byMethod: { key: string; amount: number }[];
  /** What was paid, by whom. Largest first; the empty key is "not said". */
  byPayer: { key: string; amount: number }[];
};

const grouped = (rows: FlowRow[], by: (r: FlowRow) => string) => {
  const sums = new Map<string, number[]>();
  for (const r of rows) {
    const k = by(r);
    sums.set(k, [...(sums.get(k) ?? []), r.amount]);
  }
  return [...sums.entries()]
    .map(([key, amounts]) => ({ key, amount: sumIls(amounts) }))
    .sort((a, b) => b.amount - a.amount);
};

export function paymentFlow(rows: FlowRow[], eventDate: string | null): Flow {
  const amount = (r: FlowRow) => Number(r.amount);
  const paidRows = rows.filter((r) => r.paid);
  const openRows = rows.filter((r) => !r.paid);
  const split = !!eventDate;
  const day = eventDate ?? '';

  const paidBefore = paidRows.filter((r) => split && r.paid_on !== null && r.paid_on <= day);
  const paidAfter = paidRows.filter((r) => split && r.paid_on !== null && r.paid_on > day);
  const dueBefore = openRows.filter((r) => split && r.due_on !== null && r.due_on <= day);
  const dueAfter = openRows.filter((r) => split && r.due_on !== null && r.due_on > day);

  return {
    total: sumIls(rows.map(amount)),
    paid: sumIls(paidRows.map(amount)),
    remaining: sumIls(openRows.map(amount)),
    split,
    before: { paid: sumIls(paidBefore.map(amount)), due: sumIls(dueBefore.map(amount)) },
    after: { paid: sumIls(paidAfter.map(amount)), due: sumIls(dueAfter.map(amount)) },
    undated: sumIls(openRows.filter((r) => r.due_on === null).map(amount)),
    byMethod: grouped(paidRows.map((r) => ({ ...r, amount: amount(r) })), (r) => r.method ?? ''),
    byPayer: grouped(paidRows.map((r) => ({ ...r, amount: amount(r) })), (r) => (r.paid_by ?? '').trim()),
  };
}
