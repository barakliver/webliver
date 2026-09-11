import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextAction, upcoming, type PlanFacts, type TaskFact } from '../nextAction.ts';

const TODAY = '2026-06-01';

const task = (o: Partial<TaskFact> = {}): TaskFact => ({
  title: 'משימה', due_on: null, done: false, owner: 'client', ...o,
});

const facts = (o: Partial<PlanFacts> = {}): PlanFacts => ({
  today: TODAY,
  daysLeft: 120,
  tasks: [],
  payments: [],
  guestsInvited: 0,
  guestsAnswered: 0,
  budgetLines: 0,
  budgetTarget: null,
  overArea: null,
  boardImages: 0,
  can: () => true,
  ...o,
});

test('money that is already late comes before everything else', () => {
  const a = nextAction(facts({
    payments: [{ title: 'מקדמה לאולם', amount: 15000, due_on: '2026-05-20', paid: false }],
    tasks: [task({ title: 'לשלוח רשימה', due_on: '2026-05-01' })],
    guestsInvited: 0,
  }));
  assert.equal(a.code, 'payLate');
  assert.equal(a.subject, 'מקדמה לאולם');
  assert.equal(a.section, 'payments');
  assert.ok(a.late);
});

test('several late payments are one action carrying the whole sum', () => {
  const a = nextAction(facts({
    payments: [
      { title: 'מקדמה', amount: 15000, due_on: '2026-05-20', paid: false },
      { title: 'תשלום שני', amount: 22000, due_on: '2026-05-25', paid: false },
      { title: 'שולם', amount: 9000, due_on: '2026-04-01', paid: true },
    ],
  }));
  assert.equal(a.code, 'payLate');
  assert.equal(a.n, 37000, 'the paid one is not counted');
  assert.equal(a.subject, 'מקדמה', 'named after the one that has waited longest');
});

test('a task past its date is named, and the rest are counted', () => {
  const a = nextAction(facts({
    tasks: [
      task({ title: 'לבחור שיר', due_on: '2026-05-28' }),
      task({ title: 'לסגור הסעות', due_on: '2026-05-10' }),
      task({ title: 'כבר נעשה', due_on: '2026-04-01', done: true }),
    ],
  }));
  assert.equal(a.code, 'taskLate');
  assert.equal(a.subject, 'לסגור הסעות');
  assert.equal(a.n, 2, 'the finished one is not late');
});

test('a task due today is not late', () => {
  const a = nextAction(facts({ tasks: [task({ title: 'היום', due_on: TODAY })] }));
  assert.equal(a.code, 'taskSoon');
  assert.equal(a.late, false);
});

test('their own task outranks the producer\'s, at the same date', () => {
  const a = nextAction(facts({
    tasks: [
      task({ title: 'של המפיק', due_on: '2026-05-10', owner: 'producer' }),
      task({ title: 'שלנו', due_on: '2026-05-10', owner: 'client' }),
    ],
  }));
  assert.equal(a.subject, 'שלנו');
});

test('a payment due next week comes before a task due next week', () => {
  const a = nextAction(facts({
    payments: [{ title: 'תשלום שני', amount: 22000, due_on: '2026-06-05', paid: false }],
    tasks: [task({ title: 'לבחור שיר', due_on: '2026-06-04' })],
  }));
  assert.equal(a.code, 'paySoon');
  assert.equal(a.n, 22000);
});

test('replies are chased inside forty-five days and not before', () => {
  const invited = { guestsInvited: 120, guestsAnswered: 90 };
  assert.equal(nextAction(facts({ ...invited, daysLeft: 30 })).code, 'guestsChase');
  assert.equal(nextAction(facts({ ...invited, daysLeft: 30 })).n, 30, 'how many have not answered');
  assert.notEqual(nextAction(facts({ ...invited, daysLeft: 200 })).code, 'guestsChase');
});

test('everyone has answered, so there is nothing to chase', () => {
  const a = nextAction(facts({ guestsInvited: 120, guestsAnswered: 120, daysLeft: 30, boardImages: 4 }));
  assert.equal(a.code, 'clear');
});

test('an empty guest list is raised three months out, not a year out', () => {
  assert.equal(nextAction(facts({ daysLeft: 80, boardImages: 1 })).code, 'guestsEmpty');
  assert.notEqual(nextAction(facts({ daysLeft: 300, boardImages: 1 })).code, 'guestsEmpty');
});

test('an area over its plan is named', () => {
  const a = nextAction(facts({ overArea: 'עיצוב', daysLeft: 200, boardImages: 1 }));
  assert.equal(a.code, 'budgetOver');
  assert.equal(a.subject, 'עיצוב');
  assert.equal(a.section, 'budget');
});

test('an event with nothing on it at all is offered somewhere to begin', () => {
  const a = nextAction(facts({ daysLeft: 300 }));
  assert.equal(a.code, 'start');
  assert.equal(a.section, 'tasks');
});

test('a closed section is never the action', () => {
  /* The couple was not sold the money module. A card telling them to look at
     a payment they have no panel for is a card pointing at nothing. */
  const noMoney = nextAction(facts({
    can: (k) => k !== 'budget',
    payments: [{ title: 'מקדמה', amount: 15000, due_on: '2026-05-20', paid: false }],
    tasks: [task({ title: 'לבחור שיר', due_on: '2026-05-10' })],
  }));
  assert.equal(noMoney.code, 'taskLate');

  const noTasks = nextAction(facts({
    can: (k) => k !== 'tasks' && k !== 'moodboard',
    tasks: [task({ title: 'לבחור שיר', due_on: '2026-05-10' })],
    daysLeft: 300,
    guestsInvited: 4, guestsAnswered: 4,
    budgetLines: 2,
  }));
  assert.equal(noTasks.code, 'clear');
});

test('the board is a suggestion early and never a nag late', () => {
  assert.equal(nextAction(facts({ daysLeft: 300, budgetLines: 1 })).code, 'boardEmpty');
  assert.equal(nextAction(facts({ daysLeft: 20, budgetLines: 1, guestsInvited: 2, guestsAnswered: 2 })).code, 'clear');
});

test('a wedding with no date still gets an answer', () => {
  /* Plenty are booked before a date is agreed, and that couple has the most
     to do rather than the least. */
  const a = nextAction(facts({ daysLeft: null, budgetLines: 1 }));
  assert.equal(a.code, 'boardEmpty');
  assert.equal(nextAction(facts({ daysLeft: null })).code, 'start');
});

test('the next three are theirs first, then by date, with no dates last', () => {
  const rows = upcoming([
    task({ title: 'ללא תאריך' }),
    task({ title: 'של המפיק מוקדם', due_on: '2026-06-02', owner: 'producer' }),
    task({ title: 'שלנו מאוחר', due_on: '2026-07-01' }),
    task({ title: 'שלנו מוקדם', due_on: '2026-06-03' }),
    task({ title: 'נעשה', due_on: '2026-06-01', done: true }),
  ], 3);
  assert.deepEqual(rows.map((t) => t.title), ['שלנו מוקדם', 'שלנו מאוחר', 'ללא תאריך']);
});

test('a budget with a target and no lines is raised, one with no target is not', () => {
  const shared = { daysLeft: 100, boardImages: 1, guestsInvited: 2, guestsAnswered: 2 };
  assert.equal(nextAction(facts({ ...shared, budgetTarget: 260000 })).code, 'budgetEmpty');
  assert.equal(nextAction(facts({ ...shared, budgetTarget: null })).code, 'clear');
});
