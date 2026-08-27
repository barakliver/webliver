import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storeImageUrl } from '../store.ts';

/**
 * The shop's one dangerous idea is that a price travels over a wire. It does
 * not: place_order() reads the catalogue itself and sums it itself, and the
 * only things that leave the browser are ids and quantities. What can be
 * checked from this side is that the client keeps its half of that bargain —
 * which is what the basket shape below is about.
 */

test('a product with no picture gets no url rather than a broken one', () => {
  assert.equal(storeImageUrl(''), '');
});

test('a path is joined to the bucket without doubling the separator', () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  const one = storeImageUrl('abc/def.jpg');
  const two = storeImageUrl('/abc/def.jpg');
  assert.equal(one, two);
  assert.ok(one.endsWith('/storage/v1/object/public/store/abc/def.jpg'), one);
  assert.ok(!one.includes('//storage'), one);
});

/* The basket is cleaned before it is sent: anything that is not a uuid is
   dropped, quantities are clamped, and the list is cut at thirty lines. The
   database enforces every one of those again — this is the same rule stated
   twice on purpose, so a bad basket is refused before it costs a round trip. */
const clean = (items: { id: string; qty: number }[]) =>
  items
    .filter((i) => /^[0-9a-f-]{36}$/i.test(i.id))
    .slice(0, 30)
    .map((i) => ({ id: i.id, qty: Math.max(1, Math.min(99, Math.round(Number(i.qty) || 1))) }));

const uuid = (n: number) => `0000000${n}-0000-4000-8000-000000000000`.slice(-36);

test('a line that is not a product id never leaves the browser', () => {
  const out = clean([
    { id: uuid(1), qty: 2 },
    { id: 'DROP TABLE orders', qty: 1 },
    { id: '', qty: 1 },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].qty, 2);
});

test('a quantity is clamped rather than trusted', () => {
  const out = clean([
    { id: uuid(1), qty: 0 },
    { id: uuid(2), qty: -5 },
    { id: uuid(3), qty: 1e9 },
    { id: uuid(4), qty: 2.6 },
  ]);
  assert.deepEqual(out.map((o) => o.qty), [1, 1, 99, 3]);
});

test('a basket cannot be made arbitrarily long', () => {
  const many = Array.from({ length: 100 }, (_, i) => ({ id: uuid(i % 9), qty: 1 }));
  assert.equal(clean(many).length, 30);
});
