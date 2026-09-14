import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByYear, yearOf, isService } from '../eventGroups.ts';

const ev = (eventDate: string | null, service?: string, name = eventDate ?? 'none') =>
  ({ eventDate, service, name });

/* The whole point: nothing is configured. Open an event in 2028 and the 2028
   heading exists; have nothing in 2029 and there is no 2029. */
test('the years are whatever years the events are in, soonest first', () => {
  const groups = groupByYear([
    ev('2027-06-06'), ev('2026-11-02'), ev('2028-01-01'), ev('2026-04-07'),
  ]);
  assert.deepEqual(groups.map((g) => g.year), ['2026', '2027', '2028']);
  assert.deepEqual(groups[0].rows.map((r) => r.name), ['2026-11-02', '2026-04-07']);
});

test('a year with nothing in it does not exist', () => {
  const groups = groupByYear([ev('2026-04-07'), ev('2028-01-01')]);
  assert.deepEqual(groups.map((g) => g.year), ['2026', '2028']);
});

/* Last, not first. An event with no date is usually one just opened with
   nothing in it, and above a wedding four months out it would make the screen
   open on the least urgent thing on it. */
test('the events with no date come last, under their own heading', () => {
  const groups = groupByYear([ev(null, undefined, 'blank'), ev('2027-06-06')]);
  assert.deepEqual(groups.map((g) => g.year), ['2027', null]);
  assert.equal(groups[1].rows[0].name, 'blank');
});

test('inside a year the board’s own order is kept, not re-decided', () => {
  const groups = groupByYear([ev('2026-12-01'), ev('2026-03-04'), ev('2026-07-07')]);
  assert.deepEqual(groups[0].rows.map((r) => r.name), ['2026-12-01', '2026-03-04', '2026-07-07']);
});

test('production and management are separate inside the year, in a fixed order', () => {
  const groups = groupByYear([
    ev('2026-04-07', 'management', 'night'),
    ev('2026-06-06', 'production', 'whole'),
  ]);
  assert.deepEqual(groups[0].services.map((s) => s.service), ['production', 'management']);
  assert.deepEqual(groups[0].services[0].rows.map((r) => r.name), ['whole']);
  assert.deepEqual(groups[0].services[1].rows.map((r) => r.name), ['night']);
});

/* An event from before the column existed, and one carrying something the
   constraint would not accept, both read as the thing the business has been
   selling all along rather than disappearing from the screen. */
test('anything that is not one of the two reads as a production', () => {
  const groups = groupByYear([ev('2026-04-07'), ev('2026-05-05', 'nonsense')]);
  assert.equal(groups[0].services.length, 1);
  assert.equal(groups[0].services[0].service, 'production');
  assert.equal(groups[0].services[0].rows.length, 2);
});

test('a heading is never drawn over nothing', () => {
  const groups = groupByYear([ev('2026-04-07', 'management')]);
  assert.deepEqual(groups[0].services.map((s) => s.service), ['management']);
});

test('the year is read off the date, and a missing one is not a year', () => {
  assert.equal(yearOf('2027-06-06'), '2027');
  assert.equal(yearOf(null), null);
  assert.equal(yearOf(''), null);
  assert.equal(yearOf('not a date'), null);
  assert.equal(isService('production'), true);
  assert.equal(isService('managed'), false);
});

test('an empty board is an empty list rather than a year with nothing in it', () => {
  assert.deepEqual(groupByYear([]), []);
});
