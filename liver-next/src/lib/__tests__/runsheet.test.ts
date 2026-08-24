import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inDayOrder, spanOf, humanSpan, findOverlaps, crossesMidnight } from '../runsheet.ts';

/** A normal Israeli evening: it ends after midnight, and the pack-down is the
 *  last line of the night rather than the first line of the day. */
const wedding = [
  { id: 'a', at_time: '19:00:00', title: 'קבלת פנים', track: 'shared' },
  { id: 'b', at_time: '01:00:00', title: 'פינוי', track: 'shared' },
  { id: 'c', at_time: '20:00:00', title: 'חופה', track: 'shared' },
  { id: 'd', at_time: '00:30:00', title: 'שיר אחרון', track: 'shared' },
  { id: 'e', at_time: '15:00:00', title: 'איפור', track: 'partner_a' },
];

test('an evening that runs past midnight is ordered as one evening', () => {
  assert.equal(crossesMidnight(wedding.map((i) => i.at_time)), true);
  assert.deepEqual(inDayOrder(wedding).map((i) => i.id), ['e', 'a', 'c', 'd', 'b']);
});

test('a morning event is left exactly as written', () => {
  /* The rule is not a fixed cutoff hour. A sunrise ceremony at 05:00 is a real
     event, and "before six means tomorrow" would move it to the end of its own
     day. An early hour is tomorrow only when the same schedule has an evening. */
  const morning = [
    { id: 'a', at_time: '05:30:00', title: 'זריחה', track: 'shared' },
    { id: 'b', at_time: '09:00:00', title: 'טקס', track: 'shared' },
    { id: 'c', at_time: '13:00:00', title: 'פינוי', track: 'shared' },
  ];
  assert.equal(crossesMidnight(morning.map((i) => i.at_time)), false);
  assert.deepEqual(inDayOrder(morning).map((i) => i.id), ['a', 'b', 'c']);
});

test('a stated length is used, a gap is inferred, and the last line claims nothing', () => {
  const sorted = inDayOrder(wedding);
  assert.deepEqual(spanOf(sorted, 3), { minutes: 30, stated: false });
  assert.deepEqual(spanOf(sorted, 4), { minutes: null, stated: false });

  const stated = [
    { id: 'x', at_time: '19:00:00', duration_min: 75, title: 't', track: 'shared' },
    { id: 'y', at_time: '21:00:00', duration_min: null, title: 'u', track: 'shared' },
  ];
  assert.deepEqual(spanOf(stated, 0), { minutes: 75, stated: true });
});

test('a length is written the way somebody says it out loud', () => {
  assert.equal(humanSpan(45), '45 דק׳');
  assert.equal(humanSpan(60), 'שעה');
  assert.equal(humanSpan(90), 'שעה וחצי');
  assert.equal(humanSpan(120), 'שעתיים');
  assert.equal(humanSpan(150), 'שעתיים וחצי');
  assert.equal(humanSpan(180), '3 שעות');
  assert.equal(humanSpan(100), 'שעה ו־40 דק׳');
});

test('a collision is one person in two places, not two things at once', () => {
  const clash = [
    { id: '1', at_time: '15:00:00', duration_min: 120, title: 'איפור', track: 'partner_a' },
    { id: '2', at_time: '16:00:00', duration_min: 30, title: 'צילומי הכנות', track: 'partner_a' },
    { id: '3', at_time: '15:00:00', duration_min: 120, title: 'הקמה', track: 'shared' },
    { id: '4', at_time: '16:00:00', duration_min: 30, title: 'סאונד', track: 'shared' },
  ];
  const found = findOverlaps(clash);
  assert.deepEqual([...found.keys()].sort(), ['1', '3']);
  assert.equal(found.get('1')?.withTitle, 'צילומי הכנות');

  /* A wedding has the band setting up while the couple is photographed. Two
     tracks running together is the normal case and is never flagged. */
  const crossTrack = [
    { id: '1', at_time: '15:00:00', duration_min: 120, title: 'a', track: 'partner_a' },
    { id: '2', at_time: '15:30:00', duration_min: 30, title: 'b', track: 'partner_b' },
  ];
  assert.equal(findOverlaps(crossTrack).size, 0);
});

test('an overlap is never inferred from a length nobody stated', () => {
  const noDuration = [
    { id: '1', at_time: '15:00:00', duration_min: null, title: 'a', track: 'partner_a' },
    { id: '2', at_time: '15:30:00', duration_min: null, title: 'b', track: 'partner_a' },
  ];
  assert.equal(findOverlaps(noDuration).size, 0);
});

test('an empty schedule is an empty schedule', () => {
  assert.deepEqual(inDayOrder([]), []);
  assert.equal(crossesMidnight([]), false);
});
