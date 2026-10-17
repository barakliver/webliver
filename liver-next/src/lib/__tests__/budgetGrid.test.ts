import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeLine, totals, groupItems, parseCell, parseTsv, pushChange, splitRemaining, moveCell, seedLines,
  type GridItem, type GridPayment,
} from '../budgetGrid.ts';
import { BASE_SPLITS } from '../budgetPlan.ts';

/**
 * The sheet's arithmetic, which is what the couple reads their money on.
 *
 * Each case is a shape the rows actually take: a price quoted without VAT,
 * a hall priced per plate, three payments against one line, a column that
 * arrives as strings. What is worth proving is that none of them turns a
 * figure into NaN, and that the totals are the sum of the lines they are
 * drawn above.
 */

const item = (over: Partial<GridItem> = {}): GridItem => ({
  id: over.id ?? 'a', category: 'photo', label: 'צלם', vendor: '', estimate: 10000, quoted: null, agreed: null,
  status: 'idea', includes_vat: true, vat_rate: 0.18, per_guest: false, guest_count_override: null,
  notes: '', paid_by: 'couple', due_date: null, visible_to_couple: true, sort_order: 0, source: 'manual',
  ...over,
});
const pay = (over: Partial<GridPayment> = {}): GridPayment => ({
  id: over.id ?? 'p', item_id: 'a', amount: 1000, paid_at: '2026-05-01', due_at: null,
  method: '', paid_by: '', reference: '', notes: '', ...over,
});

test('a price quoted without VAT costs more than it says', () => {
  const m = computeLine(item({ agreed: 10000, includes_vat: false }), [], null);
  assert.equal(m.agreedGross, 10000);
  assert.equal(m.agreedIncl, 11800);
  assert.equal(m.expected, 11800);
});

test('a per-plate price multiplies by the guests, the line\'s own count first', () => {
  assert.equal(computeLine(item({ agreed: 380, per_guest: true }), [], 250).agreedIncl, 95000);
  assert.equal(computeLine(item({ agreed: 380, per_guest: true, guest_count_override: 200 }), [], 250).agreedIncl, 76000);
  /* No count anywhere is zero, not NaN. */
  assert.equal(computeLine(item({ agreed: 380, per_guest: true }), [], null).agreedIncl, 0);
});

test('three payments against one line add up, and the next due is the nearest', () => {
  const ps = [
    pay({ id: '1', amount: '4000', paid_at: '2026-03-01' }),
    pay({ id: '2', amount: 3000, paid_at: '2026-04-01' }),
    pay({ id: '3', amount: 5000, paid_at: null, due_at: '2026-09-01' }),
    pay({ id: '4', amount: 2000, paid_at: null, due_at: '2026-07-15' }),
  ];
  const m = computeLine(item({ agreed: 14000, status: 'booked' }), ps, null);
  assert.equal(m.paid, 7000);
  assert.equal(m.remaining, 7000);
  assert.deepEqual(m.nextDue, { amount: 2000, date: '2026-07-15' });
});

test('expected is agreed, else the quote, else the plan', () => {
  assert.equal(computeLine(item(), [], null).expected, 10000);
  assert.equal(computeLine(item({ quoted: 12000 }), [], null).expected, 12000);
  assert.equal(computeLine(item({ quoted: 12000, agreed: 11000 }), [], null).expected, 11000);
  assert.equal(computeLine(item({ quoted: 12000, agreed: 11000 }), [], null).variance, 1000);
});

test('the totals are the sum of the live lines and a cancelled line counts nothing', () => {
  const items = [
    item({ id: 'a', estimate: 10000, agreed: 9000, status: 'booked' }),
    item({ id: 'b', estimate: 5000, quoted: 6000, status: 'quoted' }),
    item({ id: 'c', estimate: 50000, agreed: 50000, status: 'cancelled' }),
  ];
  const t = totals(items, [pay({ item_id: 'a', amount: 4000 })], null, null);
  assert.equal(t.planned, 15000);
  assert.equal(t.budget, 15000);
  assert.equal(t.agreed, 9000);
  assert.equal(t.expected, 15000);
  assert.equal(t.paid, 4000);
  assert.equal(t.remaining, 5000);
  assert.equal(t.quotedCount, 1);
  assert.equal(t.closedShare, 0.6);
});

test('a target is the budget when it exists, and the overrun is measured against it', () => {
  const t = totals([item({ agreed: 12000, status: 'booked' })], [], null, 10000);
  assert.equal(t.budget, 10000);
  assert.equal(t.overrun, 2000);
  assert.equal(t.closedShare, 1.2);
  assert.equal(totals([], [], null, null).closedShare, null);
});

test('the lines group by area in the plan\'s order and an empty area is not drawn', () => {
  const g = groupItems([
    item({ id: 'a', category: 'music', sort_order: 2 }),
    item({ id: 'b', category: 'venue' }),
    item({ id: 'c', category: 'music', sort_order: 1 }),
    item({ id: 'd', category: null, label: 'אולם הגן', status: 'cancelled' }),
  ], [], null);
  assert.deepEqual(g.map((x) => x.key), ['venue', 'music']);
  assert.deepEqual(g[1].items.map((x) => x.id), ['c', 'a']);
});

test('a cell reads a number the way people write one', () => {
  assert.equal(parseCell('12000'), 12000);
  assert.equal(parseCell('12,000'), 12000);
  assert.equal(parseCell('12k'), 12000);
  assert.equal(parseCell('12.5K'), 12500);
  assert.equal(parseCell('12 אלף'), 12000);
  assert.equal(parseCell('₪12,000'), 12000);
  assert.equal(parseCell('12,000 ש"ח'), 12000);
  assert.equal(parseCell('  '), null);
  assert.equal(parseCell('abc'), undefined);
  assert.equal(parseCell('-5'), undefined);
});

test('a pasted range is rows of cells', () => {
  assert.deepEqual(parseTsv('a\tb\r\nc\td\n'), [['a', 'b'], ['c', 'd']]);
});

test('the undo stack never holds more than fifty', () => {
  let s = pushChange([], { itemId: 'a', field: 'agreed', before: 1, after: 2 });
  for (let k = 0; k < 60; k++) s = pushChange(s, { itemId: 'a', field: 'agreed', before: k, after: k + 1 });
  assert.equal(s.length, 50);
  assert.equal(s[49].after, 60);
});

test('what is left splits to the agora and adds back exactly', () => {
  const parts = splitRemaining(10000, 3, '2026-01-31');
  assert.deepEqual(parts.map((p) => p.amount), [3333.33, 3333.33, 3333.34]);
  assert.deepEqual(parts.map((p) => p.due_at), ['2026-02-28', '2026-03-31', '2026-04-30']);
  assert.deepEqual(splitRemaining(0, 3, '2026-01-01'), []);
});

test('Tab moves to the next column and wraps rows; the edges hold', () => {
  assert.deepEqual(moveCell({ row: 0, col: 0 }, 'Tab', 3, 4), { row: 0, col: 1 });
  assert.deepEqual(moveCell({ row: 0, col: 3 }, 'Tab', 3, 4), { row: 1, col: 0 });
  assert.deepEqual(moveCell({ row: 2, col: 3 }, 'Tab', 3, 4), { row: 2, col: 3 });
  assert.deepEqual(moveCell({ row: 1, col: 0 }, 'ShiftTab', 3, 4), { row: 0, col: 3 });
  assert.deepEqual(moveCell({ row: 1, col: 2 }, 'Enter', 3, 4), { row: 2, col: 2 });
  assert.deepEqual(moveCell({ row: 2, col: 2 }, 'Enter', 3, 4), { row: 2, col: 2 });
  /* RTL: the arrow pointing left is the next column. */
  assert.deepEqual(moveCell({ row: 0, col: 1 }, 'Left', 3, 4), { row: 0, col: 2 });
  assert.deepEqual(moveCell({ row: 0, col: 1 }, 'Right', 3, 4), { row: 0, col: 0 });
});

test('the seed is one line per area, and the lines add back to the total', () => {
  const labels = Object.fromEntries(Object.keys(BASE_SPLITS).map((k) => [k, k])) as Record<keyof typeof BASE_SPLITS, string>;
  const lines = seedLines(150000, BASE_SPLITS, labels);
  assert.equal(lines.length, 10);
  assert.equal(lines.reduce((a, l) => a + l.estimate, 0), 150000);
  assert.equal(lines[0].estimate, 78000);
});
