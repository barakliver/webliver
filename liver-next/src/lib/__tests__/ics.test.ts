import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineInstant, eventInstant } from '../ics.ts';

/**
 * The calendar a producer subscribes to on their phone.
 *
 * A run-sheet line is a clock and an event is a date, and pairing the two
 * naively puts the small hours at the wrong end of the wedding. On the
 * eight-in-the-morning-to-three-at-night template this product ships, that is
 * the whole end of the night appearing before the ceremony.
 */

const WEDDING = '2026-09-04';

/** What the instant reads as on a wall clock in Israel, which is the only
 *  form worth asserting: the point is where somebody sees it, not the UTC. */
const wall = (d: Date | null) => {
  assert.ok(d, 'no instant');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d);
};

test('an evening that ends before midnight is left alone', () => {
  /* wraps is false, so nothing moves, whatever the hour. */
  assert.equal(wall(lineInstant(WEDDING, '17:00', false)), '04/09/2026, 17:00');
  assert.equal(wall(lineInstant(WEDDING, '23:30', false)), '04/09/2026, 23:30');
});

test('the small hours of a wrapping evening land on the next day', () => {
  /* The bug this exists for: 03:00 on the night of a wedding that started at
     17:00 is ten hours after the chuppah, not fourteen hours before it. */
  assert.equal(wall(lineInstant(WEDDING, '03:00', true)), '05/09/2026, 03:00');
  assert.equal(wall(lineInstant(WEDDING, '01:00', true)), '05/09/2026, 01:00');
});

test('the evening itself stays on the wedding day even when the night wraps', () => {
  /* Only the small hours move. An 08:00 hair and make-up call is the morning
     of the wedding on any schedule. */
  assert.equal(wall(lineInstant(WEDDING, '08:00', true)), '04/09/2026, 08:00');
  assert.equal(wall(lineInstant(WEDDING, '17:00', true)), '04/09/2026, 17:00');
  assert.equal(wall(lineInstant(WEDDING, '23:00', true)), '04/09/2026, 23:00');
});

test('the whole night reads in order once it is placed', () => {
  /* The property that actually matters to somebody scrolling a phone: every
     line of the evening is later than the one before it. */
  const times = ['08:00', '17:00', '19:30', '22:00', '23:45', '01:15', '03:00'];
  const stamps = times.map((t) => lineInstant(WEDDING, t, true)!.getTime());
  for (let i = 1; i < stamps.length; i += 1) {
    assert.ok(stamps[i] > stamps[i - 1], `${times[i]} is not after ${times[i - 1]}`);
  }
});

test('without the wrap flag the same night is out of order, which is the bug', () => {
  /* Kept as a test rather than a comment: it is the behaviour every caller
     had before lineInstant existed, and it should stay visible so nobody
     re-introduces it thinking eventInstant alone is enough. */
  const late = eventInstant(WEDDING, '03:00')!.getTime();
  const chuppah = eventInstant(WEDDING, '17:00')!.getTime();
  assert.ok(late < chuppah, 'plain eventInstant puts three in the morning first');
});

test('a line the clock cannot be read from is skipped rather than guessed', () => {
  assert.equal(lineInstant(WEDDING, '', true), null);
  assert.equal(lineInstant(WEDDING, 'nonsense', true), null);
});

test('the day rolls over a month and a year end', () => {
  /* Adding a day is arithmetic somebody always gets wrong at the boundary,
     and a New Year's Eve wedding is a real booking. */
  assert.equal(wall(lineInstant('2026-09-30', '02:00', true)), '01/10/2026, 02:00');
  assert.equal(wall(lineInstant('2026-12-31', '02:00', true)), '01/01/2027, 02:00');
});

test('the clocks changing does not move the wall time', () => {
  /* Israel ends summer time in late October, so this night is twenty-five
     hours long. Adding a fixed twenty-four to the instant would put a 02:00
     line at 01:00, on exactly the night somebody is reading a run sheet off
     a phone. */
  assert.equal(wall(lineInstant('2026-10-24', '02:00', true)), '25/10/2026, 02:00');
});
