import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarise } from '../finance.ts';

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
