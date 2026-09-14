import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clashes, clashingMembers, earningsBy } from '../crewLoad.ts';

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
