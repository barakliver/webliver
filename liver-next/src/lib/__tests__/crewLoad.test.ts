import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clashes, clashingMembers, earningsBy, monthsOf } from '../crewLoad.ts';

const when = (pairs: [string, string | null][]) => new Map(pairs);

/* The mistake nothing in this product could ever see: each of the two events
   is perfectly staffed on its own, and the clash exists only in the pair. */
test('the same person on two events on one night is a clash', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' }],
    when([['a', '2026-09-20'], ['b', '2026-09-20']]),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].memberId, 'tal');
  assert.equal(out[0].date, '2026-09-20');
  assert.deepEqual(out[0].clientIds.sort(), ['a', 'b']);
});

test('two events on different nights are not a clash', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' }],
    when([['a', '2026-09-20'], ['b', '2026-09-21']]),
  );
  assert.deepEqual(out, []);
});

test('two different people on the same night are not a clash', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'idan' }],
    when([['a', '2026-09-20'], ['b', '2026-09-20']]),
  );
  assert.deepEqual(out, []);
});

/* An event nobody has dated is not on a night yet. Reporting it would put a
   red mark on every half-opened file in the system. */
test('an event with no date cannot clash with anything', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' }],
    when([['a', null], ['b', null]]),
  );
  assert.deepEqual(out, []);
});

test('a dated event and an undated one are not a clash either', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' }],
    when([['a', '2026-09-20'], ['b', null]]),
  );
  assert.deepEqual(out, []);
});

test('a timestamp counts as the day it falls on', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' }],
    when([['a', '2026-09-20T18:00:00Z'], ['b', '2026-09-20']]),
  );
  assert.equal(out.length, 1);
});

/* One booking read twice is not two bookings. Without this the board reports
   a clash against the event itself the moment a row arrives twice. */
test('the same event listed twice for one person is not a clash', () => {
  const out = clashes(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'a', memberId: 'tal' }],
    when([['a', '2026-09-20']]),
  );
  assert.deepEqual(out, []);
});

test('three events on one night are one clash naming all three', () => {
  const out = clashes(
    [
      { clientId: 'a', memberId: 'tal' },
      { clientId: 'b', memberId: 'tal' },
      { clientId: 'c', memberId: 'tal' },
    ],
    when([['a', '2026-09-20'], ['b', '2026-09-20'], ['c', '2026-09-20']]),
  );
  assert.equal(out.length, 1);
  assert.equal(out[0].clientIds.length, 3);
});

/* A clash next Thursday is a phone call today; one in March is a note. */
test('clashes come soonest first', () => {
  const out = clashes(
    [
      { clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' },
      { clientId: 'c', memberId: 'idan' }, { clientId: 'd', memberId: 'idan' },
    ],
    when([
      ['a', '2027-03-01'], ['b', '2027-03-01'],
      ['c', '2026-10-02'], ['d', '2026-10-02'],
    ]),
  );
  assert.deepEqual(out.map((x) => x.memberId), ['idan', 'tal']);
});

test('the set of double-booked people is just their ids', () => {
  const s = clashingMembers(
    [{ clientId: 'a', memberId: 'tal' }, { clientId: 'b', memberId: 'tal' }],
    when([['a', '2026-09-20'], ['b', '2026-09-20']]),
  );
  assert.equal(s.has('tal'), true);
  assert.equal(s.has('idan'), false);
});

test('what each person has earned is the sum of their own fees', () => {
  const out = earningsBy([
    { clientId: 'a', memberId: 'tal', fee: 1800 },
    { clientId: 'b', memberId: 'tal', fee: '1500' },
    { clientId: 'a', memberId: 'idan', fee: 900 },
  ]);
  assert.equal(out.get('tal'), 3300);
  assert.equal(out.get('idan'), 900);
});

/* An evening with no agreed fee is not an evening worked for nothing, but it
   is worth nothing to a total until somebody writes the number down. */
test('an assignment with no fee contributes nothing rather than breaking the sum', () => {
  const out = earningsBy([
    { clientId: 'a', memberId: 'tal', fee: null },
    { clientId: 'b', memberId: 'tal', fee: 1800 },
    { clientId: 'c', memberId: 'tal' },
  ]);
  assert.equal(out.get('tal'), 1800);
});

test('nobody assigned is an empty tally rather than a zero for everybody', () => {
  assert.equal(earningsBy([]).size, 0);
});

/* ── hours on top of the fee, and the month they are paid in ─────────────── */

test('the hours are paid at the rate on the assignment, on top of the fee', () => {
  const out = earningsBy([
    { clientId: 'a', memberId: 'tal', fee: 1800, extra_hours: 3, hour_rate: 120 },
  ]);
  assert.equal(out.get('tal'), 2160);
});

/* The hours are the fact and the rate is a decision somebody has not made
   yet. Recording one without the other must not invent money. */
test('hours with no rate are worth nothing, and a rate with no hours likewise', () => {
  assert.equal(earningsBy([{ clientId: 'a', memberId: 'tal', fee: 1000, extra_hours: 4 }]).get('tal'), 1000);
  assert.equal(earningsBy([{ clientId: 'a', memberId: 'tal', fee: 1000, hour_rate: 120 }]).get('tal'), 1000);
});

test('the evenings are grouped by the month they fell in, newest month first', () => {
  const out = monthsOf(
    [
      { clientId: 'a', memberId: 'tal', fee: 1800 },
      { clientId: 'b', memberId: 'tal', fee: 1500 },
      { clientId: 'c', memberId: 'tal', fee: 900 },
    ],
    when([['a', '2026-09-04'], ['b', '2026-09-28'], ['c', '2026-08-11']]),
  );
  assert.deepEqual(out.map((m) => m.month), ['2026-09', '2026-08']);
  assert.equal(out[0].people[0].total, 3300);
  assert.equal(out[1].total, 900);
});

/* The list is worked down while making transfers, so the evenings behind a
   figure have to be in the order they happened. */
test('inside a month, a person’s evenings run in date order', () => {
  const out = monthsOf(
    [
      { clientId: 'b', memberId: 'tal', fee: 1000 },
      { clientId: 'a', memberId: 'tal', fee: 1000 },
    ],
    when([['a', '2026-09-04'], ['b', '2026-09-28']]),
  );
  assert.deepEqual(out[0].people[0].lines.map((l) => l.clientId), ['a', 'b']);
});

test('the largest bill of the month comes first', () => {
  const out = monthsOf(
    [
      { clientId: 'a', memberId: 'small', fee: 500 },
      { clientId: 'a', memberId: 'big', fee: 5000 },
    ],
    when([['a', '2026-09-04']]),
  );
  assert.deepEqual(out[0].people.map((p) => p.memberId), ['big', 'small']);
});

/* It has not happened, so nobody is owed for it. */
test('an evening with no date belongs to no month', () => {
  const out = monthsOf([{ clientId: 'a', memberId: 'tal', fee: 1800 }], when([['a', null]]));
  assert.deepEqual(out, []);
});

test('a month total is the sum of the people in it, hours included', () => {
  const out = monthsOf(
    [
      { clientId: 'a', memberId: 'tal', fee: 1800, extra_hours: 2, hour_rate: 100 },
      { clientId: 'a', memberId: 'idan', fee: 900 },
    ],
    when([['a', '2026-09-04']]),
  );
  assert.equal(out[0].total, 2900);
  assert.equal(out[0].people.find((p) => p.memberId === 'tal')!.lines[0].hours, 2);
});
