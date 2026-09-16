import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pressOnCircle, VENDOR_CATEGORIES } from '../../content/eventFile.ts';

const task = (over: Partial<Parameters<typeof pressOnCircle>[0]> = {}) => ({
  done: false, category: null, ...over,
});

test('an errand is ticked, and ticking it is the whole of it', () => {
  assert.equal(pressOnCircle(task()), 'tick');
  assert.equal(pressOnCircle(task({ category: 'mikveh' })), 'tick');
});

test('a supplier task asks who was hired', () => {
  assert.equal(pressOnCircle(task({ category: 'photography' })), 'capture');
});

test('unticking never asks for a supplier', () => {
  /* Somebody unhiring a photographer being asked for his phone number is a
     form nobody can get past: there is nothing to type and the tick never
     comes off. */
  assert.equal(pressOnCircle(task({ done: true, category: 'photography' })), 'untick');
  assert.equal(pressOnCircle(task({ done: true })), 'untick');
});

test('a supplier task belonging to no celebration still asks who was hired', () => {
  /* This asserted the opposite for months and the reasoning under it was
     false: a supplier row is keyed on the client and has no celebration
     column, so there was never anywhere for a celebration to be needed. Most
     events never split into celebrations, so the condition quietly turned the
     supplier form off for almost every task in the product. */
  assert.equal(pressOnCircle(task({ category: 'venue' })), 'capture');
});

test('the categories the checklist stamps are the ones this rule recognises', () => {
  /* The list lived in two files once, and the copy the button read was nine
     categories long: no makeup, no hair, no rabbi, no sound. */
  for (const c of ['venue', 'catering', 'dj', 'makeup', 'hair', 'rabbi', 'sound', 'printing', 'transport']) {
    assert.ok((VENDOR_CATEGORIES as readonly string[]).includes(c), `${c} is a supplier`);
    assert.equal(pressOnCircle(task({ category: c })), 'capture');
  }
});
