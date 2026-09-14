import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shiftWhen, sortShifts } from '../crewPortal.ts';

const TODAY = '2026-09-14';

test('an evening is past, today, or ahead, decided on the date and not the clock', () => {
  assert.equal(shiftWhen('2026-09-13', TODAY), 'past');
  assert.equal(shiftWhen('2026-09-14', TODAY), 'today');
  assert.equal(shiftWhen('2026-09-15', TODAY), 'ahead');
});

/* An evening with no date is something the producer has not finished setting
   up. It is not over, so it does not go to the bottom with last March. */
test('an evening with no date is ahead rather than past', () => {
  assert.equal(shiftWhen(null, TODAY), 'ahead');
});

test('a timestamp is read as the day it falls on', () => {
  assert.equal(shiftWhen('2026-09-14T23:30:00Z', TODAY), 'today');
});

test('the soonest evening is first and what is over is at the bottom', () => {
  const rows = [
    { event_date: '2026-03-01', name: 'march' },
    { event_date: '2026-10-02', name: 'october' },
    { event_date: '2026-09-20', name: 'september' },
  ];
  assert.deepEqual(
    sortShifts(rows, TODAY).map((r) => r.name),
    ['september', 'october', 'march'],
  );
});

/* Last night is the one somebody is still thinking about, not one from
   March, so the past runs the other way round. */
test('inside the past, the most recent evening comes first', () => {
  const rows = [
    { event_date: '2026-01-04', name: 'january' },
    { event_date: '2026-09-13', name: 'lastnight' },
  ];
  assert.deepEqual(
    sortShifts(rows, TODAY).map((r) => r.name),
    ['lastnight', 'january'],
  );
});

test('an evening with no date sits after the dated ones that are still ahead', () => {
  const rows = [
    { event_date: null, name: 'blank' },
    { event_date: '2026-09-20', name: 'september' },
    { event_date: '2026-01-04', name: 'january' },
  ];
  assert.deepEqual(
    sortShifts(rows, TODAY).map((r) => r.name),
    ['september', 'blank', 'january'],
  );
});

test('an empty list sorts to an empty list', () => {
  assert.deepEqual(sortShifts([], TODAY), []);
});
