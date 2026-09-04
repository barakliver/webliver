import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise, ledgerOf } from '../finance.ts';

/**
 * The one calculation the couple is asked to trust.
 *
 * Every case here is a shape the real data actually takes: a numeric column
 * that arrives as a string, a line agreed at zero, a target that was never
 * set, an event with nothing in it yet. The arithmetic is simple; what is
 * worth testing is that none of those shapes turns a figure into NaN or a
 * negative balance on the screen a couple reads their money on.
 */

const line = (estimate: number | string, agreed: number | string | null = null) => ({ estimate, agreed });
const pay = (amount: number | string, paid = true) => ({ amount, paid });

test('an event with nothing in it is five zeros, not five NaNs', () => {
  const f = summarise([], [], null);
  assert.equal(f.committed, 0);
  assert.equal(f.paid, 0);
  assert.equal(f.remaining, 0);
  assert.equal(f.target, null);
  assert.equal(f.variance, null);
  assert.equal(f.underTarget, null);
  assert.equal(f.paidPct, 0);
  assert.equal(f.pendingPct, 0);
});

test('a line with nothing agreed still costs its estimate', () => {
  const f = summarise([line(10_000), line(20_000, 18_000)], [], null);
  assert.equal(f.committed, 28_000);
});

test('a supplier agreed at zero is agreed, not un-agreed', () => {
  /* `agreed ?? estimate` rather than `agreed || estimate`: a favour from a
     friend priced at nothing must not silently fall back to the estimate. */
  const f = summarise([line(5_000, 0)], [], null);
  assert.equal(f.committed, 0);
});

test('numeric columns that arrive as strings still add up', () => {
  const f = summarise([line('12000.50', '12000.50')], [pay('3000.25')], 20_000);
  assert.equal(f.committed, 12_000.5);
  assert.equal(f.paid, 3_000.25);
  assert.equal(f.remaining, 9_000.25);
  assert.equal(f.variance, 7_999.5);
});

test('only payments marked paid are cash out', () => {
  const f = summarise([line(50_000, 50_000)], [pay(10_000), pay(15_000, false)], null);
  assert.equal(f.paid, 10_000);
  assert.equal(f.remaining, 40_000);
});

test('an overpayment floors the balance rather than showing a negative', () => {
  const f = summarise([line(10_000, 10_000)], [pay(12_000)], null);
  assert.equal(f.remaining, 0);
  assert.equal(f.paidPct, 100, 'and the bar does not run past its end');
});

test('inside the target is headroom, past it is an overrun', () => {
  const under = summarise([line(80_000, 80_000)], [], 100_000);
  assert.equal(under.variance, 20_000);
  assert.equal(under.underTarget, true);

  const over = summarise([line(130_000, 130_000)], [], 100_000);
  assert.equal(over.variance, -30_000);
  assert.equal(over.underTarget, false);

  /* Exactly on the number is inside it. A couple who spent their budget to
     the shekel has not overrun. */
  const exact = summarise([line(100_000, 100_000)], [], 100_000);
  assert.equal(exact.variance, 0);
  assert.equal(exact.underTarget, true);
});

test('no target is not a target of zero', () => {
  const f = summarise([line(40_000, 40_000)], [], null);
  assert.equal(f.variance, null, 'an event with no ceiling is not over budget');
  assert.equal(f.underTarget, null);
});

test('the two shares of the bar always add to a hundred', () => {
  for (const [committed, paid] of [[3, 1], [7, 3], [90_000, 30_001], [1, 0]] as const) {
    const f = summarise([line(committed, committed)], [pay(paid)], null);
    assert.equal(f.paidPct + f.pendingPct, 100, `${paid} of ${committed} left a gap in the bar`);
  }
});

/* ── the producer's side ──────────────────────────────────────────────────
 *
 * The couple's ledger above answers "are we inside our number". This one
 * answers "is there anything left of this event after everybody is paid",
 * which is a question the product could not previously ask on any screen.
 */

const crew = (fee: number | string | null) => ({ fee });

test('an event with nothing in it has no margin rather than a margin of zero', () => {
  /* Zero per cent is a claim about a business. Null is the absence of one,
     and a new event has not earned the right to either. */
  const l = ledgerOf([], [], []);
  assert.equal(l.billed, 0);
  assert.equal(l.costs, 0);
  assert.equal(l.margin, 0);
  assert.equal(l.marginPct, null);
});

test('the margin is what is left after suppliers and crew', () => {
  const l = ledgerOf(
    [pay(100000), pay(50000, false)],
    [line(40000), line(30000, 25000)],
    [crew(5000), crew(3000)],
  );
  assert.equal(l.billed, 150000);
  assert.equal(l.suppliers, 65000, 'the agreed price wins over the estimate');
  assert.equal(l.crew, 8000);
  assert.equal(l.costs, 73000);
  assert.equal(l.margin, 77000);
  assert.equal(l.marginPct, 51);
});

test('billed drives the margin and received drives the cash', () => {
  /* An invoice that has not been paid yet is still revenue that was agreed.
     Conflating the two makes a business read as broke in the month before a
     wedding and rich in the month after, on the same event. */
  const l = ledgerOf([pay(80000, false), pay(20000)], [line(30000)], []);
  assert.equal(l.billed, 100000);
  assert.equal(l.received, 20000);
  assert.equal(l.outstanding, 80000);
  assert.equal(l.margin, 70000, 'the unpaid invoice still counts as revenue');
});

test('a loss is reported as a loss', () => {
  /* The single most useful thing this can say, and the one a rounded-up or
     floored figure would hide until it was too late to fix. */
  const l = ledgerOf([pay(50000)], [line(60000)], [crew(4000)]);
  assert.equal(l.margin, -14000);
  assert.ok(l.marginPct !== null && l.marginPct < 0, `${l.marginPct}`);
});

test('a crew list with no fees agreed yet costs nothing, not NaN', () => {
  /* Half a crew list is names before it is fees, and a null must not turn the
     whole ledger into a NaN on the screen a producer checks before signing. */
  const l = ledgerOf([pay(10000)], [], [crew(null), crew(2000), crew(null)]);
  assert.equal(l.crew, 2000);
  assert.equal(l.margin, 8000);
});

test('numbers that arrive from the database as strings still add up', () => {
  /* Every numeric column comes back as a string over the wire, and string
     concatenation instead of addition is the failure that looks like a
     plausible number rather than an error. */
  const l = ledgerOf([pay('100000')], [line('0', '30000')], [crew('5000')]);
  assert.equal(l.billed, 100000);
  assert.equal(l.costs, 35000);
  assert.equal(l.margin, 65000);
});

test('costs booked before anything is billed are flagged, not treated as a loss', () => {
  /* The ordinary case: suppliers are signed months before the final invoice
     goes out. The margin is arithmetically a loss and saying so plainly would
     be alarming and wrong, so the shape of it is reported instead. */
  const l = ledgerOf([], [line(20000)], []);
  assert.equal(l.costsWithoutBilling, true);
  assert.equal(l.marginPct, null);

  const normal = ledgerOf([pay(50000)], [line(20000)], []);
  assert.equal(normal.costsWithoutBilling, false);
});

test('overpayment does not make what is owed negative', () => {
  /* Same rule as the couple's ledger: an overpayment is a bookkeeping
     question rather than a negative number to put on a screen. */
  const l = ledgerOf([pay(10000)], [], []);
  assert.equal(l.outstanding, 0);
});
