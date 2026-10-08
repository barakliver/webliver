import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standing, timeline, type StandingFacts } from '../standing.ts';

/**
 * Both halves of this are the kind of thing that looks right on a screen
 * whatever it does. Every branch produces a plausible Hebrew sentence and a
 * plausible row of boxes, so the only way to know the verdict is the correct
 * one is to state the situation and assert the answer.
 *
 * The one failure that would make the whole thing worthless is a screen that
 * says a couple is fine while something of theirs is overdue, so that is the
 * first test and it is checked from several directions.
 */

const TODAY = '2026-10-08';

const facts = (over: Partial<StandingFacts> = {}): StandingFacts => ({
  today: TODAY,
  eventDate: '2027-02-14',
  tasks: [],
  payments: [],
  money: true,
  tasksOn: true,
  ...over,
});

const task = (due: string | null, done = false, owner: 'client' | 'producer' = 'client') =>
  ({ title: 'x', due_on: due, done, owner } as const);
const pay = (due: string | null, paid = false, amount = 1000) =>
  ({ title: 'y', amount, due_on: due, paid } as const);

test('one thing of theirs past its date beats every other verdict', () => {
  /* Including a wedding years away, where every other rule would say there
     is time. A supplier owed money does not become not-owed because the
     wedding is far off. */
  const far = standing(facts({ eventDate: '2029-05-01', payments: [pay('2026-09-01')] }));
  assert.equal(far.code, 'behind');
  assert.equal(far.calm, false);
  assert.equal(far.n, 1);

  /* And a wedding already behind them, which is where an unpaid supplier is
     most likely to be sitting. */
  const after = standing(facts({ eventDate: '2026-08-01', payments: [pay('2026-07-20')] }));
  assert.equal(after.code, 'behind');

  /* And a wedding with no date at all. A task can carry a date before the
     evening does, so "no date yet" must not be allowed to swallow an
     overdue one. */
  const undated = standing(facts({ eventDate: null, tasks: [task('2026-09-20')] }));
  assert.equal(undated.code, 'behind');
  assert.equal(undated.months, null);
});

test("the producer's own overdue work is not the couple being behind", () => {
  /* The sentence is a claim about them. Telling somebody they are behind on
     work they have no button for is the one thing this card must never do. */
  const s = standing(facts({ tasks: [task('2026-09-01', false, 'producer')] }));
  assert.notEqual(s.code, 'behind');
  assert.equal(s.calm, true);
  /* And it is not quietly counted into the schedule either. */
  assert.equal(s.of, 0);
});

test('a module switched off keeps its rows out of both halves', () => {
  /* A payment a couple cannot see must not put a mark on their screen, and
     the same for their list. Checked here rather than at the call site,
     because the call site is where it would be forgotten. */
  const noMoney = standing(facts({ money: false, payments: [pay('2026-09-01')] }));
  assert.notEqual(noMoney.code, 'behind');
  assert.equal(noMoney.of, 0);

  const noTasks = standing(facts({ tasksOn: false, tasks: [task('2026-09-01')] }));
  assert.notEqual(noTasks.code, 'behind');

  const t = timeline(facts({ money: false, payments: [pay('2026-11-04')] }));
  assert.equal(t.kind, 'bare');
});

test('a done thing is not late, however long ago its date was', () => {
  const s = standing(facts({
    tasks: [task('2026-01-01', true)],
    payments: [pay('2026-02-01', true)],
  }));
  assert.notEqual(s.code, 'behind');
  assert.equal(s.closed, 2);
  assert.equal(s.of, 2);
});

test('a quiet fortnight is said plainly, and names what is next', () => {
  const s = standing(facts({ tasks: [task('2026-11-20'), task('2026-12-02')] }));
  assert.equal(s.code, 'calm');
  assert.equal(s.nextOn, '2026-11-20');
  assert.equal(s.calm, true);
});

test('a thing due today is neither late nor merely coming', () => {
  /* The boundary that breaks in the evening: a plain date compared against a
     machine's clock in another zone turns today into yesterday. */
  const s = standing(facts({ tasks: [task(TODAY)] }));
  assert.equal(s.code, 'steady');
  assert.equal(s.n, 1);
  assert.equal(s.nextOn, TODAY);
});

test('crowded is said in the run-up and never in the last month', () => {
  const six = ['2026-10-09', '2026-10-10', '2026-10-11', '2026-10-12', '2026-10-13', '2026-10-14'];
  const tight = standing(facts({ tasks: six.map((d) => task(d)) }));
  assert.equal(tight.code, 'tight');
  assert.equal(tight.n, 6);

  /* The same six, a fortnight before the wedding. Everything is crowded
     then, and a screen that says so every day for four weeks is a screen
     that has stopped saying anything. */
  const final = standing(facts({ eventDate: '2026-10-22', tasks: six.map((d) => task(d)) }));
  assert.equal(final.code, 'steady');
});

test('beyond a year there is time, and inside it an empty list is not a reproach', () => {
  assert.equal(standing(facts({ eventDate: '2028-06-01' })).code, 'early');
  assert.equal(standing(facts({ eventDate: '2027-01-01' })).code, 'fresh');
  assert.equal(standing(facts({ eventDate: null })).code, 'dateless');
  assert.equal(standing(facts({ eventDate: null })).months, null);
  assert.equal(standing(facts({ eventDate: '2026-09-01' })).code, 'past');
});

test('the strip runs from this month to the wedding month and stops', () => {
  const t = timeline(facts({ eventDate: '2027-01-20', tasks: [task('2026-11-04')] }));
  assert.equal(t.kind, 'strip');
  if (t.kind !== 'strip') return;
  assert.deepEqual(t.cells.map((c) => c.key), ['2026-10', '2026-11', '2026-12', '2027-01']);
  assert.equal(t.cells[0].thisMonth, true);
  assert.equal(t.cells.at(-1)!.wedding, true);
  assert.equal(t.cells.filter((c) => c.wedding).length, 1);
  /* The months with nothing in them are still cells. The gap is the
     information: the whole point is a couple seeing that December is empty. */
  assert.equal(t.cells[2].due, 0);
  assert.equal(t.cells[1].due, 1);
});

test('a wedding in the same month is one cell, both marks on it', () => {
  const t = timeline(facts({ eventDate: '2026-10-31', tasks: [task('2026-10-20')] }));
  assert.equal(t.kind, 'strip');
  if (t.kind !== 'strip') return;
  assert.equal(t.cells.length, 1);
  assert.equal(t.cells[0].thisMonth, true);
  assert.equal(t.cells[0].wedding, true);
});

test('late things sit on this month, and the strip never grows backwards', () => {
  /* Otherwise the first thing on the screen is a couple's own history of
     being behind, running back to whenever they started. */
  const t = timeline(facts({
    eventDate: '2026-12-05',
    tasks: [task('2026-03-01'), task('2025-11-01')],
  }));
  assert.equal(t.kind, 'strip');
  if (t.kind !== 'strip') return;
  assert.deepEqual(t.cells.map((c) => c.key), ['2026-10', '2026-11', '2026-12']);
  assert.equal(t.cells[0].late, 2);
  /* And they are not also counted as due in it, which would double them. */
  assert.equal(t.cells[0].due, 0);
});

test('a month reads closed when everything dated into it is done', () => {
  const t = timeline(facts({
    eventDate: '2026-12-05',
    tasks: [task('2026-11-04', true), task('2026-11-18', true), task('2026-12-01')],
  }));
  assert.equal(t.kind, 'strip');
  if (t.kind !== 'strip') return;
  const nov = t.cells.find((c) => c.key === '2026-11')!;
  assert.equal(nov.due, 2);
  assert.equal(nov.closed, 2);
  const dec = t.cells.find((c) => c.key === '2026-12')!;
  assert.equal(dec.due, 1);
  assert.equal(dec.closed, 0);
});

test('month keys cross a year boundary without arithmetic of their own', () => {
  const t = timeline(facts({ eventDate: '2027-03-01' }, ));
  assert.equal(t.kind, 'bare');
  const withRows = timeline(facts({ eventDate: '2027-03-01', tasks: [task('2027-02-10')] }));
  assert.equal(withRows.kind, 'strip');
  if (withRows.kind !== 'strip') return;
  assert.deepEqual(withRows.cells.map((c) => c.key),
    ['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03']);
  assert.deepEqual(withRows.cells.map((c) => c.month), [10, 11, 12, 1, 2, 3]);
  assert.deepEqual(withRows.cells.map((c) => c.year), [2026, 2026, 2026, 2027, 2027, 2027]);
});

test('a strip is never more than a year wide', () => {
  /* Thirteen cells on a phone is a bar chart nobody can read, so beyond the
     window the panel says so in a sentence instead. */
  const t = timeline(facts({ eventDate: '2027-10-20', tasks: [task('2026-11-01')] }));
  assert.equal(t.kind, 'far');
  if (t.kind !== 'far') return;
  assert.equal(t.months, 12);

  const edge = timeline(facts({ eventDate: '2027-09-20', tasks: [task('2026-11-01')] }));
  assert.equal(edge.kind, 'strip');
  if (edge.kind !== 'strip') return;
  assert.equal(edge.cells.length, 12);
});

test('no date and no year left are two different answers', () => {
  const none = timeline(facts({ eventDate: null }));
  assert.equal(none.kind, 'far');
  if (none.kind === 'far') assert.equal(none.months, null);
  assert.equal(timeline(facts({ eventDate: '2026-09-30' })).kind, 'past');
  /* A wedding earlier this month is over too. The month it fell in is still
     the current one, and drawing a one cell year for it would put the past
     under a heading about the year ahead. */
  assert.equal(timeline(facts({ eventDate: '2026-10-02' })).kind, 'past');
  /* The evening itself is not over. */
  assert.equal(timeline(facts({ eventDate: TODAY, tasks: [task(TODAY)] })).kind, 'strip');
});

test('undated things are counted once and never given a month', () => {
  /* An undated task is open, not due. Filing it under this month would
     invent a deadline nobody agreed to; leaving it out silently would lose
     it. So it is counted in a line of its own. */
  const t = timeline(facts({
    eventDate: '2026-12-05',
    tasks: [task('2026-11-04'), task(null), task(null), task(null, true), task(null, false, 'producer')],
    payments: [pay(null)],
  }));
  assert.equal(t.kind, 'strip');
  if (t.kind !== 'strip') return;
  assert.equal(t.undated, 3);
  assert.equal(t.cells.reduce((n, c) => n + c.due, 0), 1);
});
