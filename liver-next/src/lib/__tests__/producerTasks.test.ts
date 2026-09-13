import { test } from 'node:test';
import assert from 'node:assert/strict';
import { advance, nextDue, sortTasks, standing, dueCount } from '../producerTasks.ts';

/* The case the clamping exists for. "The last of the month" is a real routine
   — the VAT, the bookkeeping — and written naively it walks: the 31st of
   January plus a month rolls into March, and from there the date drifts
   further every time it is ticked. */
test('the 31st of a month lands on the last day of the next, not in the one after', () => {
  assert.equal(advance('2026-01-31', 'monthly'), '2026-02-28');
  assert.equal(advance('2028-01-31', 'monthly'), '2028-02-29');
  assert.equal(advance('2026-03-31', 'monthly'), '2026-04-30');
  assert.equal(advance('2026-12-15', 'monthly'), '2027-01-15');
});

test('a day and a week are plain addition, across a month and a year', () => {
  assert.equal(advance('2026-09-13', 'daily'), '2026-09-14');
  assert.equal(advance('2026-09-30', 'daily'), '2026-10-01');
  assert.equal(advance('2026-12-31', 'daily'), '2027-01-01');
  assert.equal(advance('2026-09-13', 'weekly'), '2026-09-20');
  assert.equal(advance('2026-02-26', 'weekly'), '2026-03-05');
});

/* The rhythm is the point of a routine: a Sunday task stays on Sundays. */
test('a weekly task ticked on the day keeps its weekday', () => {
  assert.equal(nextDue('2026-09-13', 'weekly', '2026-09-13'), '2026-09-20');
});

/* And the thing that makes it usable when life happened: eleven days late,
   one week on is still in the past, and a task that arrives already overdue
   teaches somebody to ignore the colour red. */
test('a routine ticked late comes back in the future, on its own weekday', () => {
  const next = nextDue('2026-09-13', 'weekly', '2026-09-24');
  assert.equal(next, '2026-09-27');
  assert.ok(next! > '2026-09-24');
});

test('a routine with no date starts counting from today', () => {
  assert.equal(nextDue(null, 'daily', '2026-09-13'), '2026-09-14');
  assert.equal(nextDue('', 'monthly', '2026-09-13'), '2026-10-13');
});

test('a one-off has no next occurrence at all', () => {
  assert.equal(nextDue('2026-09-13', 'none', '2026-09-13'), null);
});

/* Years behind rather than days. The loop is bounded, and the guarantee that
   matters is that it never hands back a date in the past. */
test('a daily routine abandoned for years still comes back tomorrow', () => {
  const next = nextDue('2019-01-01', 'daily', '2026-09-13');
  assert.equal(next, '2026-09-14');
});

test('late first, then today, then what is coming, then the dateless', () => {
  const rows = [
    { due_on: null, title: 'לרוקן את הרכב' },
    { due_on: '2026-10-01', title: 'לחדש ביטוח' },
    { due_on: '2026-09-01', title: 'מע״מ' },
    { due_on: '2026-09-13', title: 'לחזור ללהקה' },
  ];
  assert.deepEqual(sortTasks(rows).map((r) => r.title), ['מע״מ', 'לחזור ללהקה', 'לחדש ביטוח', 'לרוקן את הרכב']);
});

test('a dateless task is never late, which is the whole reason it has no date', () => {
  assert.equal(standing(null, '2026-09-13'), 'ahead');
  assert.equal(standing('2026-09-12', '2026-09-13'), 'late');
  assert.equal(standing('2026-09-13', '2026-09-13'), 'today');
  assert.equal(standing('2026-09-14', '2026-09-13'), 'ahead');
});

test('the count on the heading is what is asking for attention today', () => {
  const tasks = [
    { id: '1', title: 'a', note: '', due_on: '2026-09-01', repeat_every: 'none' as const, done: false, done_on: null },
    { id: '2', title: 'b', note: '', due_on: '2026-09-13', repeat_every: 'weekly' as const, done: false, done_on: null },
    { id: '3', title: 'c', note: '', due_on: '2026-12-01', repeat_every: 'none' as const, done: false, done_on: null },
    { id: '4', title: 'd', note: '', due_on: null, repeat_every: 'none' as const, done: false, done_on: null },
    { id: '5', title: 'e', note: '', due_on: '2026-09-01', repeat_every: 'none' as const, done: true, done_on: '2026-09-02' },
  ];
  assert.equal(dueCount(tasks, '2026-09-13'), 2);
});
