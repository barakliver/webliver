import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inQuietHours } from '../quietHours.ts';

test('a window inside one day', () => {
  assert.equal(inQuietHours('13:00', '12:00', '14:00'), true);
  assert.equal(inQuietHours('12:00', '12:00', '14:00'), true, 'the start is inside');
  assert.equal(inQuietHours('14:00', '12:00', '14:00'), false, 'the end is outside');
  assert.equal(inQuietHours('11:59', '12:00', '14:00'), false);
});

test('a window that wraps past midnight, which is the one people set', () => {
  assert.equal(inQuietHours('23:30', '23:00', '07:30'), true);
  assert.equal(inQuietHours('02:00', '23:00', '07:30'), true);
  assert.equal(inQuietHours('07:29', '23:00', '07:30'), true);
  assert.equal(inQuietHours('07:30', '23:00', '07:30'), false);
  assert.equal(inQuietHours('12:00', '23:00', '07:30'), false);
});

test('no window, or an empty one, is never quiet', () => {
  assert.equal(inQuietHours('03:00', null, null), false);
  assert.equal(inQuietHours('03:00', '23:00', null), false);
  assert.equal(inQuietHours('03:00', '03:00', '03:00'), false);
});
