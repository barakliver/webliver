import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assess, type EventFacts } from '../gaps.ts';

/** A well run event with nothing missing, which every case below spoils in
 *  exactly one way. Writing the tests as deltas from this keeps each one about
 *  the rule it is checking. */
const healthy: EventFacts = {
  hasDate: true,
  daysLeft: 200,
  archived: false,
  tasks: 5,
  overdueTasks: 0,
  guests: 100,
  scheduleItems: 20,
  invites: 2,
  joinedInvites: 2,
  overdueMoney: 0,
  contracts: 1,
  signedContracts: 1,
};

const codes = (over: Partial<EventFacts>) =>
  assess({ ...healthy, ...over }).gaps.map((g) => g.code);

const levelOf = (over: Partial<EventFacts>, code: string) =>
  assess({ ...healthy, ...over }).gaps.find((g) => g.code === code)?.level;

test('a healthy event has nothing to say', () => {
  assert.deepEqual(codes({}), []);
});

test('an empty guest list is early at six months and late at six weeks', () => {
  assert.ok(!codes({ guests: 0, daysLeft: 180 }).includes('no_guests'));
  assert.equal(levelOf({ guests: 0, daysLeft: 60 }, 'no_guests'), 'soon');
  assert.equal(levelOf({ guests: 0, daysLeft: 30 }, 'no_guests'), 'now');
});

test('no run sheet only matters in the last month', () => {
  assert.ok(!codes({ scheduleItems: 0, daysLeft: 45 }).includes('no_schedule'));
  assert.equal(levelOf({ scheduleItems: 0, daysLeft: 20 }, 'no_schedule'), 'now');
});

test('nothing sent and something unsigned are different jobs', () => {
  assert.ok(codes({ contracts: 0, signedContracts: 0, daysLeft: 100 }).includes('no_contract'));
  assert.ok(codes({ contracts: 1, signedContracts: 0, daysLeft: 100 }).includes('contract_unsigned'));
  /* Never both: one of them is always the wrong advice. */
  const both = codes({ contracts: 0, signedContracts: 0, daysLeft: 100 });
  assert.ok(!both.includes('contract_unsigned'));
});

test('a contract turns urgent well before the event', () => {
  assert.equal(levelOf({ contracts: 0, daysLeft: 100 }, 'no_contract'), 'soon');
  assert.equal(levelOf({ contracts: 0, daysLeft: 30 }, 'no_contract'), 'now');
  assert.ok(!codes({ contracts: 0, daysLeft: 300 }).includes('no_contract'));
});

test('a passed event asks to be closed and stops nagging about the rest', () => {
  const past = { daysLeft: -3, guests: 0, scheduleItems: 0, tasks: 0, contracts: 0 };
  const out = codes(past);
  assert.ok(out.includes('closing'));
  assert.ok(!out.includes('no_guests'));
  assert.ok(!out.includes('no_schedule'));
  assert.ok(!out.includes('no_contract'));
  assert.ok(!out.includes('no_tasks'));
});

test('a closed event is not asked to be closed again', () => {
  assert.ok(!codes({ daysLeft: -3, archived: true }).includes('closing'));
  assert.equal(assess({ ...healthy, daysLeft: -3, archived: true }).needsClosing, false);
});

test('an event with no date still wants tasks, and says the date is missing', () => {
  const out = codes({ hasDate: false, daysLeft: null, tasks: 0 });
  assert.ok(out.includes('no_date'));
  assert.ok(out.includes('no_tasks'));
  /* Nothing that is judged by proximity fires without a date to judge from. */
  assert.ok(!out.includes('no_guests'));
  assert.ok(!out.includes('no_schedule'));
  assert.ok(!out.includes('no_contract'));
});

test('the couple not being attached outranks their not having logged in', () => {
  const none = codes({ invites: 0, joinedInvites: 0 });
  assert.ok(none.includes('no_couple'));
  assert.ok(!none.includes('not_joined'));
  assert.equal(levelOf({ invites: 0, joinedInvites: 0 }, 'no_couple'), 'now');
  /* After the event it is untidiness rather than a blockage. */
  assert.equal(levelOf({ invites: 0, joinedInvites: 0, daysLeft: -1 }, 'no_couple'), 'soon');

  const notIn = codes({ invites: 2, joinedInvites: 0 });
  assert.ok(notIn.includes('not_joined'));
  assert.ok(!notIn.includes('no_couple'));
});

test('overdue work is named with its count and is always urgent', () => {
  const one = assess({ ...healthy, overdueTasks: 1 }).gaps.find((g) => g.code === 'task_overdue');
  assert.equal(one?.label, 'משימה באיחור');
  assert.equal(one?.level, 'now');
  const three = assess({ ...healthy, overdueTasks: 3 }).gaps.find((g) => g.code === 'task_overdue');
  assert.equal(three?.label, '3 משימות באיחור');
});

test('the most expensive thing to ignore is listed first', () => {
  const out = codes({ overdueTasks: 2, overdueMoney: 500, hasDate: false, daysLeft: null, invites: 0 });
  assert.equal(out[0], 'task_overdue');
  assert.equal(out[1], 'pay_overdue');
});

test('today is not late', () => {
  /* The board is read every morning; an event happening tonight must not be
     told it has already passed. */
  const out = assess({ ...healthy, daysLeft: 0 });
  assert.equal(out.needsClosing, false);
  assert.ok(!out.gaps.map((g) => g.code).includes('closing'));
});
