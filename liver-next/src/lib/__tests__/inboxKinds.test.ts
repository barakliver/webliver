import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateAction, ACTION_KINDS, QUIET_KINDS } from '../inbox/kinds.ts';

const ID = '11111111-2222-4333-8444-555555555555';

test('every kind in the enum answers, and an unknown one is refused', () => {
  for (const k of ACTION_KINDS) assert.equal(typeof validateAction(k, {}).ok, 'boolean', k);
  assert.deepEqual(validateAction('delete_everything', {}), { ok: false, error: 'סוג פעולה לא מוכר: delete_everything' });
});

test('a budget line needs a name and an amount, and reads the amount from the model\'s own words', () => {
  const v = validateAction('budget_add_item', { category: 'צילום', vendor_name: 'דני כהן', amount_quoted: '12,000 ₪', notes: 'כולל אלבום' });
  assert.ok(v.ok);
  /* A line born from a quote is a quote: the figure sits in the quote
     column and in the plan, and the status says so. */
  if (v.ok) assert.deepEqual(v.data, { category: 'צילום', label: 'דני כהן', estimate: 12000, quoted: 12000, agreed: null, status: 'quoted', vendor: 'דני כהן', notes: 'כולל אלבום' });
  assert.equal(validateAction('budget_add_item', { label: 'צלם' }).ok, false, 'no amount');
  assert.equal(validateAction('budget_add_item', { amount: 100 }).ok, false, 'no name');
});

test('an update needs a row and something to change', () => {
  assert.equal(validateAction('budget_update_item', { agreed: 5000 }).ok, false);
  assert.equal(validateAction('budget_update_item', { budget_item_id: ID }).ok, false);
  const v = validateAction('budget_update_item', { budget_item_id: ID, agreed: 5000 });
  assert.ok(v.ok && v.data.id === ID && v.data.agreed === 5000);
});

test('marking paid takes a real date or none, never a broken one', () => {
  const a = validateAction('budget_mark_paid', { payment_id: ID, paid_on: '2026-10-01' });
  assert.ok(a.ok && a.data.paid_on === '2026-10-01');
  const b = validateAction('budget_mark_paid', { payment_id: ID, paid_on: 'next week' });
  assert.ok(b.ok && b.data.paid_on === null);
  assert.equal(validateAction('budget_mark_paid', { paid_on: '2026-10-01' }).ok, false);
  /* Paid to a supplier against a line: a new payment on that line. */
  const c = validateAction('budget_mark_paid', { budget_item_id: ID, amount: '4,000', paid_on: '2026-10-01' });
  assert.ok(c.ok && c.data.item_id === ID && c.data.amount === 4000);
  assert.equal(validateAction('budget_mark_paid', { budget_item_id: ID }).ok, false, 'no amount');
});

test('a task needs a title; its owner is the producer unless the couple is named', () => {
  assert.equal(validateAction('task_create', { title: 'x' }).ok, false);
  const v = validateAction('task_create', { title: 'להחליט על צלם', due_date: '2026-10-30', owner: 'client' });
  assert.ok(v.ok && v.data.due_on === '2026-10-30' && v.data.owner === 'client');
  const w = validateAction('task_create', { title: 'להתקשר', owner: 'somebody' });
  assert.ok(w.ok && w.data.owner === 'producer' && w.data.due_on === null);
});

test('a couple field is one of five, and each is checked as itself', () => {
  assert.equal(validateAction('couple_field_update', { field: 'budget_target', value: 1 }).ok, false);
  assert.equal(validateAction('couple_field_update', { field: 'guest_estimate', value: 'many' }).ok, false);
  const g = validateAction('couple_field_update', { field: 'guest_estimate', value: '250' });
  assert.ok(g.ok && g.data.value === 250);
  assert.equal(validateAction('couple_field_update', { field: 'event_date', value: 'June' }).ok, false);
  const d = validateAction('couple_field_update', { field: 'event_date', value: '2027-06-10' });
  assert.ok(d.ok && d.data.value === '2027-06-10');
});

test('a schedule line needs a clock time in any spelling', () => {
  assert.equal(validateAction('timeline_update', { title: 'חופה', at_time: 'evening' }).ok, false);
  const v = validateAction('timeline_update', { title: 'חופה', time: '7:30' });
  assert.ok(v.ok && v.data.at_time === '07:30');
});

test('a draft reply writes nothing, and the quiet set says so', () => {
  assert.ok(QUIET_KINDS.has('reply_draft'));
  const v = validateAction('reply_draft', { text: 'היי דני, תודה' });
  assert.ok(v.ok && v.data.channel === 'whatsapp');
});
