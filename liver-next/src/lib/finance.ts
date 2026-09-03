/**
 * The event's money, worked out once.
 *
 * This arithmetic was written inline inside the summary component, which
 * meant the one calculation the couple is asked to trust could not be
 * tested, and a second screen wanting the same five figures would have
 * derived them again slightly differently. A plain module rather than
 * something beside the server action, for the reason `fileTypes.ts` gives:
 * both a client component and a server prompt need it.
 *
 * Deliberately total: every figure is defined for an event with no budget
 * lines, no payments and no target, because that is what a new event is and
 * it must render as five zeros rather than as ₪NaN.
 */

/** What a budget line contributes. A line with nothing agreed yet still
 *  costs its estimate, so the comparison is like for like instead of
 *  flattering whatever has not been booked. */
export type CostLine = { estimate: number | string; agreed: number | string | null };

/** What a payment contributes. Only the ones marked paid are cash out. */
export type PaidLine = { amount: number | string; paid: boolean };

export type Finance = {
  /** The ceiling, when one was set. */
  target: number | null;
  /** Every line at its agreed price, or its estimate until agreed. */
  committed: number;
  /** Cash that has actually left the account. */
  paid: number;
  /** Committed minus paid, floored at zero: an overpayment is a bookkeeping
   *  question, not a negative balance to display. */
  remaining: number;
  /** Target minus committed. Positive is headroom, negative is an overrun.
   *  Null when no target exists, which is a different thing from zero. */
  variance: number | null;
  /** Whether the commitments are inside the target. Null with no target. */
  underTarget: boolean | null;
  /** The bar: two shares of the commitment that always sum to 100, or to 0
   *  when nothing is committed yet. */
  paidPct: number;
  pendingPct: number;
};

/* One coercion for every figure that arrives from the database, where a
   numeric column comes back as a string and a missing one as null. */
const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

export function summarise(
  items: readonly CostLine[],
  payments: readonly PaidLine[],
  target: number | null,
): Finance {
  const committed = items.reduce((a, i) => a + num(i.agreed ?? i.estimate), 0);
  const paid = payments.reduce((a, p) => (p.paid ? a + num(p.amount) : a), 0);
  const remaining = Math.max(committed - paid, 0);

  const cap = target === null || !Number.isFinite(Number(target)) ? null : num(target);
  const variance = cap === null ? null : cap - committed;

  /* Rounded once, and the pending share is taken from the paid one rather
     than computed separately, so the two always add to 100 and the bar never
     shows a hairline gap at 33.4%. */
  const paidPct = committed > 0 ? Math.min(100, Math.max(0, Math.round((paid / committed) * 100))) : 0;

  return {
    target: cap,
    committed,
    paid,
    remaining,
    variance,
    underTarget: variance === null ? null : variance >= 0,
    paidPct,
    pendingPct: committed > 0 ? 100 - paidPct : 0,
  };
}
