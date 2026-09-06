import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addOnce } from '../loadFailures.ts';

/**
 * A failure has to be able to say it failed.
 *
 * Containing a broken read so it cannot take the whole page down is right,
 * and it leaves the screen showing an empty list — which is exactly what a
 * guest list nobody has started shows. `addOnce` is the judgement inside the
 * part that stops that emptiness from being read as a fact.
 *
 * Only this function is exercised. The per-request scoping around it is
 * React's `cache`, which memoises inside a render and does nothing outside
 * one, so a unit test of it would be a test of nothing dressed up as a
 * passing assertion. Its failure mode is written down where it lives: the
 * list reads empty and the header says nothing, which is where the product
 * already was.
 */

test('a screen with nothing wrong reports nothing', () => {
  /* The ordinary morning, and the case the header must stay silent on. */
  assert.deepEqual(addOnce([], ''), []);
});

test('a failed read is named', () => {
  assert.deepEqual(addOnce([], 'guests'), ['guests']);
});

test('the same failure is named once, not once per attempt', () => {
  /* Two panels reading the same table both fail on the same afternoon. The
     screen should say so once rather than stack identical lines. */
  const list: string[] = [];
  addOnce(list, 'guests');
  addOnce(list, 'guests');
  addOnce(list, 'guests');
  assert.deepEqual(list, ['guests']);
});

test('failures keep the order they broke in', () => {
  const list: string[] = [];
  addOnce(list, 'guests');
  addOnce(list, 'seating');
  addOnce(list, 'payments');
  assert.deepEqual(list, ['guests', 'seating', 'payments']);
});

test('a label that is only whitespace is not a failure worth naming', () => {
  /* A loader with an empty label would otherwise put a nameless entry in the
     list, and the header would warn about something nobody can look up. */
  const list: string[] = [];
  addOnce(list, '   ');
  addOnce(list, '');
  assert.deepEqual(list, []);
});

test('a label is matched after trimming, so one read is not named twice', () => {
  const list: string[] = [];
  addOnce(list, 'guests');
  addOnce(list, '  guests  ');
  assert.deepEqual(list, ['guests']);
});
