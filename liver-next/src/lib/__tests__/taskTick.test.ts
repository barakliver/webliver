import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressOnCircle, VENDOR_CATEGORIES } from '../../content/eventFile.ts';

const task = (over: Partial<Parameters<typeof pressOnCircle>[0]> = {}) => ({
  done: false, category: null, event_id: null, ...over,
});

test('an errand is ticked, and ticking it is the whole of it', () => {
  assert.equal(pressOnCircle(task()), 'tick');
  assert.equal(pressOnCircle(task({ category: 'mikveh', event_id: 'e1' })), 'tick');
});

test('a supplier task on a celebration asks who was hired', () => {
  assert.equal(pressOnCircle(task({ category: 'photography', event_id: 'e1' })), 'capture');
});

test('unticking never asks for a supplier', () => {
  /* Somebody unhiring a photographer being asked for his phone number is a
     form nobody can get past: there is nothing to type and the tick never
     comes off. */
  assert.equal(pressOnCircle(task({ done: true, category: 'photography', event_id: 'e1' })), 'untick');
  assert.equal(pressOnCircle(task({ done: true })), 'untick');
});

test('a supplier task belonging to no celebration is ticked rather than stuck', () => {
  /* The supplier is filed under a celebration, so with none there is nothing
     to file and the form would have nowhere to put what it collected. The
     row still has to be tickable. */
  assert.equal(pressOnCircle(task({ category: 'venue' })), 'tick');
});

test('the categories the checklist stamps are the ones this rule recognises', () => {
  /* The list lived in two files once, and the copy the button read was nine
     categories long: no makeup, no hair, no rabbi, no sound. */
  for (const c of ['venue', 'catering', 'dj', 'makeup', 'hair', 'rabbi', 'sound', 'printing', 'transport']) {
    assert.ok((VENDOR_CATEGORIES as readonly string[]).includes(c), `${c} is a supplier`);
    assert.equal(pressOnCircle(task({ category: c, event_id: 'e1' })), 'capture');
  }
});
