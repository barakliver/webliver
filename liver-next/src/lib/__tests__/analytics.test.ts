import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  funnelOf, bySource, responseTime, cashOf, overdueTasks, signedShare,
  type LeadRow, type CallRow,
} from '../analytics.ts';
import { appCopy } from '../../content/site.ts';

const lead = (id: string, status: string, source = 'instagram', created_at = '2026-01-01T09:00:00Z'): LeadRow =>
  ({ id, status, source, created_at });

const many = (n: number, status: string, source = 'instagram') =>
  Array.from({ length: n }, (_, i) => lead(`${source}-${status}-${i}`, status, source));

test('a funnel never widens on the way down', () => {
  /* The one thing a funnel must not do is show more signings than
     conversations. Statuses get skipped in real life, so the shape has to hold
     no matter which ones were filled in. */
  const leads = [
    lead('a', 'new'),
    lead('b', 'won'),      /* jumped straight from new to signed */
    lead('c', 'lost'),
    lead('d', 'meeting'),
    lead('e', 'contacted'),
    lead('f', 'won'),
  ];
  const { steps } = funnelOf(leads, []);
  const counts = steps.map((s) => s.count);
  for (let i = 1; i < counts.length; i += 1) {
    assert.ok(counts[i] <= counts[i - 1], `step ${steps[i].key} is wider than ${steps[i - 1].key}`);
  }
  assert.deepEqual(counts, [6, 5, 3, 2]);
});

test('a logged call counts as contact even if nobody moved the status', () => {
  /* This is the case that used to invert the funnel: a call against a lead
     still marked new made a meeting without a conversation before it. */
  const leads = [lead('a', 'new'), lead('b', 'new'), lead('c', 'new')];
  const calls: CallRow[] = [{ lead_id: 'a', created_at: '2026-01-01T10:00:00Z' }];
  const { steps } = funnelOf(leads, calls);
  const [, contacted, meeting] = steps;
  assert.equal(contacted.count, 1);
  assert.equal(meeting.count, 1);
  assert.ok(meeting.count <= contacted.count);
});

test('a rate off four enquiries is not a rate', () => {
  const four = funnelOf(many(4, 'won'), []);
  assert.equal(four.steps[1].rate, null);

  const five = funnelOf(many(5, 'won'), []);
  assert.equal(five.steps[1].rate, 100);
});

test('every step keeps the count its percentage came from', () => {
  const leads = [...many(6, 'won'), ...many(4, 'lost')];
  const { steps } = funnelOf(leads, []);
  const won = steps[3];
  assert.equal(won.count, 6);
  /* six of the ten that were spoken to, but only six sat down, so the last
     step is measured against the step above it and not against the top */
  assert.equal(steps[2].count, 6);
  assert.equal(won.rate, 100);
});

test('an empty book produces no percentages and no crash', () => {
  const f = funnelOf([], []);
  assert.equal(f.total, 0);
  assert.deepEqual(f.steps.map((s) => s.rate), [null, null, null, null]);
  assert.deepEqual(bySource([]), []);
  assert.deepEqual(responseTime([], []), { medianHours: null, answered: 0, waiting: 0 });
  assert.deepEqual(cashOf([]), { collected: 0, due: 0, overdue: 0, overdueCount: 0 });
  assert.equal(overdueTasks([]), 0);
  assert.deepEqual(signedShare([], 0), { signed: 0, of: 0 });
});

test('a source with one enquiry and one signing is one enquiry, not a hundred percent', () => {
  const rows = bySource([lead('a', 'won', 'referral'), ...many(6, 'new', 'instagram')]);
  const referral = rows.find((r) => r.source === 'referral')!;
  assert.equal(referral.leads, 1);
  assert.equal(referral.won, 1);
  assert.equal(referral.rate, null);
  /* and the busy channel sorts first, so the screen reads by volume */
  assert.equal(rows[0].source, 'instagram');
});

test('an unnamed source is grouped rather than dropped', () => {
  const rows = bySource([lead('a', 'new', ''), lead('b', 'new', '')]);
  assert.deepEqual(rows.map((r) => r.source), ['unknown']);
  assert.equal(rows[0].leads, 2);
});

test('one enquiry answered a fortnight late does not become the headline', () => {
  /* The reason for the median. Four answered within the hour and one forgotten
     for two weeks: the mean says nine hours, which describes nobody. */
  const leads = [
    lead('a', 'contacted'), lead('b', 'contacted'), lead('c', 'contacted'),
    lead('d', 'contacted'), lead('e', 'contacted'),
  ];
  const calls: CallRow[] = [
    { lead_id: 'a', created_at: '2026-01-01T10:00:00Z' },
    { lead_id: 'b', created_at: '2026-01-01T10:00:00Z' },
    { lead_id: 'c', created_at: '2026-01-01T11:00:00Z' },
    { lead_id: 'd', created_at: '2026-01-01T12:00:00Z' },
    { lead_id: 'e', created_at: '2026-01-15T09:00:00Z' },
  ];
  const r = responseTime(leads, calls);
  assert.equal(r.medianHours, 2);
  assert.equal(r.answered, 5);
});

test('the earliest call is the answer, later ones are follow-ups', () => {
  const calls: CallRow[] = [
    { lead_id: 'a', created_at: '2026-01-03T09:00:00Z' },
    { lead_id: 'a', created_at: '2026-01-01T10:00:00Z' },
  ];
  assert.equal(responseTime([lead('a', 'contacted')], calls).medianHours, 1);
});

test('unanswered and slow are two different problems', () => {
  const leads = [lead('a', 'contacted'), lead('b', 'new'), lead('c', 'new')];
  const r = responseTime(leads, [{ lead_id: 'a', created_at: '2026-01-01T12:00:00Z' }]);
  assert.equal(r.answered, 1);
  assert.equal(r.waiting, 2);
  assert.equal(r.medianHours, 3);
});

test('a call logged before its enquiry is ignored rather than counted as negative', () => {
  const calls: CallRow[] = [{ lead_id: 'a', created_at: '2025-12-01T09:00:00Z' }];
  const r = responseTime([lead('a', 'contacted')], calls);
  assert.equal(r.answered, 0);
  assert.equal(r.medianHours, null);
});

test('a rubbish timestamp is skipped and never becomes NaN hours', () => {
  const leads = [lead('a', 'contacted', 'instagram', 'not a date'), lead('b', 'contacted')];
  const calls: CallRow[] = [
    { lead_id: 'a', created_at: '2026-01-01T10:00:00Z' },
    { lead_id: 'b', created_at: 'nonsense' },
    { lead_id: 'b', created_at: '2026-01-01T10:00:00Z' },
  ];
  const r = responseTime(leads, calls);
  assert.equal(r.answered, 1);
  assert.equal(r.medianHours, 1);
});

test('late money is counted twice on purpose: it is still due, and it is also late', () => {
  const today = new Date('2026-03-10T00:00:00Z');
  const c = cashOf([
    { amount: 10000, due_on: '2026-01-01', paid: true },
    { amount: 5000, due_on: '2026-02-01', paid: false },  /* late */
    { amount: 7000, due_on: '2026-06-01', paid: false },  /* still coming */
  ], today);
  assert.equal(c.collected, 10000);
  assert.equal(c.due, 12000);
  assert.equal(c.overdue, 5000);
  assert.equal(c.overdueCount, 1);
});

test('a payment due today is not late yet', () => {
  const today = new Date('2026-03-10T12:00:00Z');
  const c = cashOf([{ amount: 100, due_on: '2026-03-10', paid: false }], today);
  assert.equal(c.overdueCount, 0);
  assert.equal(c.due, 100);
});

test('a milestone with no date and no amount cannot be late and cannot be money', () => {
  const c = cashOf([
    { amount: null, due_on: null, paid: false },
    { amount: 500, due_on: null, paid: false },
  ], new Date('2026-03-10T00:00:00Z'));
  assert.equal(c.overdueCount, 0);
  assert.equal(c.due, 500);
});

test('a paid milestone is never overdue, however old', () => {
  const c = cashOf([{ amount: 900, due_on: '2020-01-01', paid: true }], new Date('2026-03-10T00:00:00Z'));
  assert.equal(c.overdue, 0);
  assert.equal(c.collected, 900);
});

test('only unfinished work with a date behind it counts as slipped', () => {
  const today = new Date('2026-03-10T00:00:00Z');
  const n = overdueTasks([
    { due_on: '2026-03-01', done: false },  /* slipped */
    { due_on: '2026-03-01', done: true },   /* finished, late or not */
    { due_on: '2026-03-10', done: false },  /* today */
    { due_on: '2026-04-01', done: false },  /* ahead */
    { due_on: null, done: false },          /* no date to slip past */
    { due_on: 'rubbish', done: false },
  ], today);
  assert.equal(n, 1);
});

test('two contracts on one event are one signed event', () => {
  const s = signedShare([
    { client_id: 'x', signed_at: '2026-01-01' },
    { client_id: 'x', signed_at: '2026-02-01' },
    { client_id: 'y', signed_at: null },
  ], 3);
  assert.deepEqual(s, { signed: 1, of: 3 });
});

/* ── every step the funnel emits has a Hebrew word for it ─────────────────
   The chart falls back to the raw key when a label is missing, which is the
   right thing for it to do and the wrong thing to ship: `meeting` renders as
   English text in the middle of a Hebrew column, and it looks like a design
   choice rather than a missing string. Renaming a step is a two file change
   and this is the half that gets forgotten. */
test('every funnel step has a label in the Hebrew copy', () => {
  const funnel = funnelOf(
    [lead('a', 'new'), lead('b', 'meeting'), lead('c', 'won')],
    [],
  );
  for (const step of funnel.steps) {
    const label = (appCopy.insights.funnel as Record<string, string>)[step.key];
    assert.equal(
      typeof label, 'string',
      `funnel step "${step.key}" has no entry in appCopy.insights.funnel, `
      + 'so the chart would print the key itself onto a Hebrew screen',
    );
    assert.ok(label.length > 0, `funnel step "${step.key}" has an empty label`);
    assert.match(label, /[֐-׿]/, `funnel step "${step.key}" is not Hebrew`);
  }
});
