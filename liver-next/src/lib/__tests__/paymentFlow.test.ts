import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paymentFlow, type FlowRow } from '../paymentFlow.ts';

const row = (p: Partial<FlowRow>): FlowRow => ({ amount: 1000, due_on: null, paid: false, paid_on: null, ...p });
const DAY = '2026-12-05';

test('what was paid and what is due are cut at the event date', () => {
  const f = paymentFlow([
    row({ amount: 5000, paid: true, paid_on: '2026-09-01' }),
    row({ amount: 3000, due_on: '2026-11-01' }),
    row({ amount: 2000, due_on: '2026-12-20' }),
  ], DAY);
  assert.equal(f.before.paid, 5000);
  assert.equal(f.before.due, 3000);
  assert.equal(f.after.due, 2000);
  assert.equal(f.paid, 5000);
  assert.equal(f.remaining, 5000);
  assert.equal(f.total, 10000);
});

test('the evening itself is before, and a payment made after it is after', () => {
  const f = paymentFlow([
    row({ amount: 100, due_on: DAY }),
    row({ amount: 200, paid: true, paid_on: DAY }),
    row({ amount: 400, paid: true, paid_on: '2026-12-06' }),
  ], DAY);
  assert.equal(f.before.due, 100);
  assert.equal(f.before.paid, 200);
  assert.equal(f.after.paid, 400);
});

test('an undated instalment is in the remaining and in neither half', () => {
  const f = paymentFlow([row({ amount: 700 }), row({ amount: 300, due_on: '2026-11-01' })], DAY);
  assert.equal(f.undated, 700);
  assert.equal(f.remaining, 1000);
  assert.equal(f.before.due + f.after.due, 300);
});

test('with no event date there is nothing to cut, only the totals', () => {
  const f = paymentFlow([row({ amount: 500, paid: true, paid_on: '2026-09-01' }), row({ amount: 500, due_on: '2026-10-01' })], null);
  assert.equal(f.split, false);
  assert.equal(f.paid, 500);
  assert.equal(f.remaining, 500);
  assert.equal(f.before.paid + f.before.due + f.after.paid + f.after.due, 0);
});

test('paid money is grouped by how and by whom, largest first, and unsaid is its own group', () => {
  const f = paymentFlow([
    row({ amount: 4000, paid: true, paid_on: '2026-08-01', method: 'transfer', paid_by: 'נועה' }),
    row({ amount: 1000, paid: true, paid_on: '2026-08-02', method: 'card', paid_by: 'איתי' }),
    row({ amount: 2500, paid: true, paid_on: '2026-08-03', method: 'transfer', paid_by: 'נועה' }),
    row({ amount: 300, paid: true, paid_on: '2026-08-04' }),
    row({ amount: 9999, method: 'cash', paid_by: 'נועה' }),
  ], DAY);
  assert.deepEqual(f.byMethod, [
    { key: 'transfer', amount: 6500 }, { key: 'card', amount: 1000 }, { key: '', amount: 300 },
  ]);
  assert.deepEqual(f.byPayer, [
    { key: 'נועה', amount: 6500 }, { key: 'איתי', amount: 1000 }, { key: '', amount: 300 },
  ]);
});

test('agorot add up without drifting', () => {
  const f = paymentFlow([row({ amount: 0.1, due_on: '2026-10-01' }), row({ amount: 0.2, due_on: '2026-10-02' })], DAY);
  assert.equal(f.before.due, 0.3);
});
