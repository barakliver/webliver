import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dateInZone, todayInZone, daysBetween, isPastDue } from '../clock.ts';

/**
 * The evening, which is when this product is actually used.
 *
 * Every case here is a moment where a server in UTC and a phone in Israel
 * would have disagreed about what day it is. That disagreement was rendering
 * one answer on the server and a different one in the browser, so these are
 * not date-formatting tests; they are the tests that keep two renders equal.
 */

/* 21:30 UTC on the fourth is 00:30 on the fifth in Israel. The single most
   load-bearing moment in this file. */
const LATE_EVENING = Date.parse('2026-09-04T21:30:00Z');
/* Same evening, an hour earlier, before the date turns over there. */
const EARLY_EVENING = Date.parse('2026-09-04T18:30:00Z');
/* Winter, when the offset is +02:00 rather than +03:00. */
const WINTER_NIGHT = Date.parse('2026-01-14T22:30:00Z');

test('after nine at night the day has already turned where the event is', () => {
  assert.equal(todayInZone(LATE_EVENING), '2026-09-05');
});

test('earlier the same evening it has not', () => {
  assert.equal(todayInZone(EARLY_EVENING), '2026-09-04');
});

test('the offset is read from the zone, not assumed', () => {
  /* +02:00 in winter, so 22:30 UTC is still the same date; the identical
     clock time in summer would already be the next one. */
  assert.equal(todayInZone(WINTER_NIGHT), '2026-01-15');
  assert.equal(todayInZone(Date.parse('2026-07-14T22:30:00Z')), '2026-07-15');
});

test('a plain date is left exactly as it is', () => {
  /* The bug this prevents: 2026-09-04 parses as midnight UTC, and midnight
     UTC read in a zone behind Israel is the third. A date column has no time
     to convert. */
  assert.equal(dateInZone('2026-09-04'), '2026-09-04');
  assert.equal(dateInZone('2026-01-01'), '2026-01-01');
});

test('a timestamp is read as the day it falls on there', () => {
  assert.equal(dateInZone('2026-09-04T21:30:00Z'), '2026-09-05');
  assert.equal(dateInZone('2026-09-04T18:30:00Z'), '2026-09-04');
});

test('nonsense does not become a date', () => {
  assert.equal(dateInZone('not a date'), 'not a date'.slice(0, 10));
  assert.equal(dateInZone(Number.NaN), '');
});

test('a task due today is not late, even late at night', () => {
  assert.equal(isPastDue('2026-09-05', LATE_EVENING), false);
  assert.equal(isPastDue('2026-09-04', EARLY_EVENING), false);
});

test('a task due yesterday is late', () => {
  assert.equal(isPastDue('2026-09-04', LATE_EVENING), true);
});

test('a task due tomorrow is not', () => {
  assert.equal(isPastDue('2026-09-06', LATE_EVENING), false);
});

test('a task with no date is never late', () => {
  assert.equal(isPastDue(null), false);
  assert.equal(isPastDue(''), false);
  assert.equal(isPastDue(undefined), false);
});

test('the two machines now agree', () => {
  /* What the mismatch looked like: the server called it the fourth and the
     phone called it the fifth, so the same row rendered on time and overdue.
     Both now ask the same question and get the same answer. */
  const serverSays = todayInZone(LATE_EVENING);
  const phoneSays = todayInZone(LATE_EVENING);
  assert.equal(serverSays, phoneSays);
  assert.equal(isPastDue('2026-09-04', LATE_EVENING), true);
});

test('days between two calendar days', () => {
  assert.equal(daysBetween('2026-09-04', '2026-09-05'), 1);
  assert.equal(daysBetween('2026-09-05', '2026-09-04'), -1);
  assert.equal(daysBetween('2026-09-04', '2026-09-04'), 0);
});

test('a clock change does not make a day into a fraction of one', () => {
  /* Israel moves to winter time in late October. Counting in hours would put
     25 hours inside this pair and round it to two days. */
  assert.equal(daysBetween('2026-10-24', '2026-10-25'), 1);
  assert.equal(daysBetween('2026-03-26', '2026-03-28'), 2);
});

test('a whole year counts as its days', () => {
  assert.equal(daysBetween('2026-01-01', '2027-01-01'), 365);
});
