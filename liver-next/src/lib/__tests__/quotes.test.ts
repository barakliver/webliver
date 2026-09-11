import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteGroups, perHour, effectOfChoosing, hasQuote, type QuoteVendor, type QuoteLine } from '../quotes.ts';

const v = (o: Partial<QuoteVendor> & { id: string }): QuoteVendor => ({
  name: o.id, category: 'photo', status: 'shortlist', chosen: false,
  quote_amount: null, quote_hours: null, quote_scope: '', quote_includes: '', quote_extras: '', quote_terms: '',
  ...o,
});

test('cheapest first, unknown last, and a name breaks the tie', () => {
  const [g] = quoteGroups([
    v({ id: 'c', name: 'ג', quote_amount: 11000 }),
    v({ id: 'a', name: 'א', quote_amount: null }),
    v({ id: 'b', name: 'ב', quote_amount: 9000 }),
    v({ id: 'd', name: 'ד', quote_amount: 9000 }),
  ]);
  assert.deepEqual(g.vendors.map((x) => x.name), ['ב', 'ד', 'ג', 'א']);
});

test('a category with one supplier and no quote is not a table', () => {
  assert.equal(quoteGroups([v({ id: 'a' })]).length, 0);
  assert.equal(quoteGroups([v({ id: 'a', quote_amount: 5000 })]).length, 1);
  assert.equal(quoteGroups([v({ id: 'a' }), v({ id: 'b' })]).length, 1);
});

test('a cancelled supplier is out of the comparison', () => {
  assert.equal(quoteGroups([v({ id: 'a', status: 'cancelled', quote_amount: 1 }), v({ id: 'b' })]).length, 0);
});

test('an hour costs what the quote says, and nothing when half is missing', () => {
  assert.equal(perHour(v({ id: 'a', quote_amount: 9000, quote_hours: 6 })), 1500);
  assert.equal(perHour(v({ id: 'a', quote_amount: 9000 })), null);
  assert.equal(perHour(v({ id: 'a', quote_hours: 6 })), null);
  /* Numbers arrive from the database as strings; that is not unknown. */
  assert.equal(perHour(v({ id: 'a', quote_amount: '11000', quote_hours: '10' })), 1100);
});

test('a quote with only words on it is still a quote', () => {
  assert.ok(hasQuote(v({ id: 'a', quote_terms: '50% מקדמה' })));
  assert.ok(!hasQuote(v({ id: 'a' })));
});

test('choosing says what leaves and what enters, before anything is pressed', () => {
  const vendors = [
    v({ id: 'a', name: 'סטודיו א', quote_amount: 9000, chosen: true }),
    v({ id: 'b', name: 'סטודיו ב', quote_amount: 11000 }),
  ];
  const lines: QuoteLine[] = [{ event_vendor_id: 'a', estimate: 9000, agreed: null }];
  const e = effectOfChoosing('b', vendors, lines)!;
  assert.deepEqual(e.replaces, [{ name: 'סטודיו א', amount: 9000 }]);
  assert.equal(e.adds, 11000);
  assert.equal(e.delta, 2000);
  assert.equal(e.noop, false);
});

test('a line with an agreed figure is a commitment and does not leave', () => {
  const vendors = [
    v({ id: 'a', name: 'א', quote_amount: 9000, chosen: true }),
    v({ id: 'b', name: 'ב', quote_amount: 11000 }),
  ];
  const lines: QuoteLine[] = [{ event_vendor_id: 'a', estimate: 9000, agreed: 9000 }];
  const e = effectOfChoosing('b', vendors, lines)!;
  assert.deepEqual(e.replaces, []);
  assert.equal(e.delta, 11000, 'the new estimate is added beside the commitment, not instead of it');
});

test('choosing the chosen one again changes nothing, and says so', () => {
  const vendors = [v({ id: 'a', quote_amount: 9000, chosen: true }), v({ id: 'b', quote_amount: 11000 })];
  const e = effectOfChoosing('a', vendors, [{ event_vendor_id: 'a', estimate: 9000, agreed: null }])!;
  assert.equal(e.noop, true);
  assert.equal(e.delta, 0);
});

test('a quote whose amount changed updates its own line rather than adding a second', () => {
  const vendors = [v({ id: 'a', quote_amount: 9500, chosen: true })];
  const e = effectOfChoosing('a', vendors, [{ event_vendor_id: 'a', estimate: 9000, agreed: null }])!;
  assert.equal(e.delta, 500);
  assert.equal(e.noop, false);
});

test('no amount, no choosing', () => {
  assert.equal(effectOfChoosing('a', [v({ id: 'a' })], []), null);
});
