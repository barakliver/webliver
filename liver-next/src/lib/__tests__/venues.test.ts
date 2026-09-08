import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cost, bestValue, overCheapest, readFlags, VAT, type Venue } from '../venues.ts';

const hall = (over: Partial<Venue> = {}): Venue => ({
  id: 'v1',
  venueName: 'אחוזת הכפר',
  location: 'שרון',
  platePrice: 300,
  isVatIncluded: false,
  barCost: 0,
  barType: 'flat',
  soundLightingCost: 0,
  ancillaryFees: 0,
  servicePercent: 0,
  serviceFlat: 0,
  contingencyPercent: 10,
  prosCons: [],
  quotePath: '',
  isSelected: false,
  contact: '',
  phone: '',
  touredOn: null,
  notes: '',
  ...over,
});

test('the plate is what most of an evening costs', () => {
  const c = cost(hall({ platePrice: 300 }), 250, false);
  assert.equal(c.food, 75000);
  assert.equal(c.total, 75000);
  assert.equal(c.perGuest, 300);
});

test('a flat bar does not grow with the guest list and a per-head bar does', () => {
  const flat = cost(hall({ barCost: 20000, barType: 'flat' }), 250, false);
  const head = cost(hall({ barCost: 80, barType: 'per_person' }), 250, false);
  assert.equal(flat.bar, 20000);
  assert.equal(head.bar, 20000);

  /* Same money at 250 people, and that is the whole trap: the two quotes read
     as identical until the list moves. */
  const flatBigger = cost(hall({ barCost: 20000, barType: 'flat' }), 300, false);
  const headBigger = cost(hall({ barCost: 80, barType: 'per_person' }), 300, false);
  assert.equal(flatBigger.bar, 20000);
  assert.equal(headBigger.bar, 24000);
});

test('service is a share of the food, not of the sound system', () => {
  const c = cost(hall({ platePrice: 300, servicePercent: 10, soundLightingCost: 15000 }), 250, false);
  assert.equal(c.food, 75000);
  assert.equal(c.service, 7500);
  assert.equal(c.total, 75000 + 15000 + 7500);
});

test('a flat service charge and a percentage can both be quoted, and both count', () => {
  const c = cost(hall({ platePrice: 100, servicePercent: 10, serviceFlat: 2000 }), 100, false);
  assert.equal(c.food, 10000);
  assert.equal(c.service, 3000);
});

test('a hall that quoted before VAT and one that quoted after are made comparable', () => {
  const before = hall({ platePrice: 300, isVatIncluded: false });
  const after = hall({ platePrice: 300 * (1 + VAT), isVatIncluded: true });

  /* The same hall, described the two ways this market describes halls. Read
     on either basis they have to land on the same money. */
  assert.equal(cost(before, 250, false).total, cost(after, 250, false).total);
  assert.equal(cost(before, 250, true).total, cost(after, 250, true).total);

  /* And reading with the tax has to be more than reading without it. */
  assert.ok(cost(before, 250, true).total > cost(before, 250, false).total);
});

test('only the plate carries a VAT basis; a flat fee is a sum to pay', () => {
  const c = cost(hall({ platePrice: 0, soundLightingCost: 15000, ancillaryFees: 5000 }), 250, true);
  assert.equal(c.soundLighting, 15000);
  assert.equal(c.ancillary, 5000);
  assert.equal(c.total, 20000);
});

test('the buffer is on top and the default is a tenth', () => {
  const c = cost(hall({ platePrice: 400, contingencyPercent: 10 }), 250, false);
  assert.equal(c.total, 100000);
  assert.equal(c.withBuffer, 110000);
  assert.equal(cost(hall({ platePrice: 400, contingencyPercent: 0 }), 250, false).withBuffer, 100000);
  assert.equal(cost(hall({ platePrice: 400, contingencyPercent: 20 }), 250, false).withBuffer, 120000);
});

test('the real cost per guest absorbs the fixed fees', () => {
  const c = cost(hall({ platePrice: 300, soundLightingCost: 15000, ancillaryFees: 10000 }), 250, false);
  /* The hall said three hundred. */
  assert.equal(c.perGuest, 400);
});

test('a fixed fee hurts a small wedding far more than a large one', () => {
  const v = hall({ platePrice: 300, soundLightingCost: 20000 });
  assert.equal(cost(v, 100, false).perGuest, 500);
  assert.equal(cost(v, 400, false).perGuest, 350);
});

test('no guests yet is a real state and does not divide by zero', () => {
  const c = cost(hall({ platePrice: 300, soundLightingCost: 15000 }), 0, false);
  assert.equal(c.total, 15000);
  assert.equal(c.perGuest, 0);
  assert.ok(Number.isFinite(c.perGuest));
});

test('a guest count that is not a number does not poison the total', () => {
  const c = cost(hall({ platePrice: 300 }), Number.NaN, false);
  assert.equal(c.total, 0);
  assert.equal(c.perGuest, 0);
});

test('half a guest is not a guest', () => {
  assert.equal(cost(hall({ platePrice: 100 }), 10.7, false).food, 1000);
});

test('the cheapest is named, and only when there is a comparison to win', () => {
  assert.equal(bestValue([{ id: 'a', total: 90 }, { id: 'b', total: 100 }]), 'a');
  assert.equal(bestValue([{ id: 'a', total: 90 }]), null, 'one hall has nothing to beat');
  assert.equal(bestValue([]), null);
});

test('a tie is not a winner', () => {
  assert.equal(bestValue([{ id: 'a', total: 100 }, { id: 'b', total: 100 }]), null);
  assert.equal(
    bestValue([{ id: 'a', total: 100 }, { id: 'b', total: 100 }, { id: 'c', total: 120 }]),
    null,
  );
});

test('how much more the nicer one costs, as a share', () => {
  assert.equal(overCheapest(110000, 100000), 10);
  assert.equal(overCheapest(100000, 100000), 0);
  assert.equal(overCheapest(90000, 100000), 0, 'the cheapest is not above itself');
  assert.equal(overCheapest(100000, 0), 0, 'nothing to be a share of');
});

test('the flags are only ever the ones on the list', () => {
  assert.deepEqual(readFlags(['kosher', 'licence']), ['kosher', 'licence']);
  assert.deepEqual(readFlags(['kosher', 'kosher']), ['kosher'], 'each of them once');
  assert.deepEqual(readFlags(['<script>', 'kosher', 42, null]), ['kosher']);
  assert.deepEqual(readFlags('kosher'), [], 'a column holding anything is not a list');
  assert.deepEqual(readFlags(null), []);
});
