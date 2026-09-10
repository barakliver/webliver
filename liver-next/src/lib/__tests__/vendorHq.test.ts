import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hqRows, atRisk, summary, suggestedMessage, contractFor, type HqVendor } from '../vendorHq.ts';

const v = (over: Partial<HqVendor>): HqVendor => ({
  id: 'v', name: 'ספק', category: 'photo', status: 'booked', phone: '', notes: '',
  deposit: null, deposit_paid_on: null, balance_due_on: null, last_contact_on: null, waiting_on: null, next_action: '',
  ...over,
});
const today = '2026-09-10';

test('a contract is matched to a supplier by name, loosely', () => {
  const cs = [{ party_name: 'סטודיו לביא בע"מ', status: 'signed', signed_at: '2026-01-01' }];
  assert.equal(contractFor(v({ name: 'לביא' }), cs), 'signed');
  assert.equal(contractFor(v({ name: 'רון' }), cs), 'none');
  assert.equal(contractFor(v({ name: 'לביא' }), [{ party_name: 'לביא', status: 'sent', signed_at: null }]), 'pending');
});

test('red for money or paper due within a week, or silence past two weeks', () => {
  const rows = hqRows([
    v({ id: 'a', name: 'א', balance_due_on: '2026-09-14', deposit: 2000, deposit_paid_on: '2026-08-01' }),
    v({ id: 'b', name: 'ב', last_contact_on: '2026-08-20', waiting_on: 'them' }),
    v({ id: 'c', name: 'ג', waiting_on: 'me', last_contact_on: '2026-09-09' }),
    v({ id: 'd', name: 'ד', last_contact_on: '2026-09-09' }),
    v({ id: 'e', name: 'ה', status: 'cancelled' }),
  ], [
    { party_name: 'א', status: 'signed', signed_at: '2026-01-01' },
    { party_name: 'ד', status: 'signed', signed_at: '2026-01-01' },
  ], [
    { event_vendor_id: 'a', estimate: 12000, agreed: 12000 },
    { event_vendor_id: 'd', estimate: 5000, agreed: null },
  ], today);
  const by = (id: string) => rows.find((r) => r.vendor.id === id)!;
  assert.equal(rows.length, 4, 'a cancelled supplier is not a relationship');
  assert.equal(by('a').tone, 'red');
  assert.equal(by('a').balance, 10000, 'the paid deposit comes off the balance');
  assert.equal(by('a').action, 'payBalance');
  assert.equal(by('b').tone, 'red');
  assert.equal(by('b').action, 'nudge');
  assert.equal(by('b').silentDays, 21);
  assert.equal(by('c').tone, 'yellow');
  assert.equal(by('c').action, 'reply');
  assert.equal(by('d').tone, 'green');
  assert.equal(by('d').agreed, 5000, 'the estimate stands in until a price is agreed');
  assert.ok(by('c').flags.includes('noContract'));
  assert.equal(rows[0].tone, 'red', 'red rows first');
});

test('the producer\'s own words win over the derived action', () => {
  const [r] = hqRows([v({ waiting_on: 'me', next_action: 'לשלוח את סקיצת החופה' })], [], [], today);
  assert.equal(r.action, 'own');
  assert.ok(suggestedMessage(r, { couple: 'לי ורותם', date: '', signAs: 'ברק' }).includes('סקיצת החופה'));
});

test('at-risk is the worst three, and the summary counts what the Monday letter needs', () => {
  const rows = hqRows([
    v({ id: 'a', name: 'א', balance_due_on: '2026-09-20', deposit: 1000, deposit_paid_on: '2026-08-01' }),
    v({ id: 'b', name: 'ב', last_contact_on: '2026-08-01', waiting_on: 'them' }),
    v({ id: 'c', name: 'ג' }),
    v({ id: 'd', name: 'ד', last_contact_on: '2026-09-09' }),
  ], [{ party_name: 'ד', status: 'signed', signed_at: '2026-01-01' }, { party_name: 'א', status: 'signed', signed_at: '2026-01-01' }],
  [{ event_vendor_id: 'a', estimate: 30000, agreed: 30000 }], today);
  const risky = atRisk(rows);
  assert.equal(risky.length, 3);
  assert.equal(risky[0].vendor.id, 'b', 'six weeks of silence is the worst');
  assert.ok(!risky.some((r) => r.vendor.id === 'd'));
  const s = summary(rows, today);
  assert.equal(s.total, 4);
  assert.equal(s.locked, 2);
  assert.equal(s.depositsPaid, 1);
  assert.equal(s.dueSoon, 29000);
  assert.equal(s.first?.vendor.id, 'b');
});

test('every suggested message names the supplier and signs off, and never an em dash', () => {
  const rows = hqRows([
    v({ id: 'a', name: 'רון', balance_due_on: '2026-09-12', deposit: 0 }),
    v({ id: 'b', name: 'עדי', last_contact_on: '2026-08-01', waiting_on: 'them' }),
    v({ id: 'c', name: 'מיכל', waiting_on: 'me' }),
    v({ id: 'd', name: 'נועה' }),
  ], [{ party_name: 'עדי', status: 'sent', signed_at: null }], [{ event_vendor_id: 'a', estimate: 1000, agreed: 1000 }], today);
  for (const r of rows) {
    const m = suggestedMessage(r, { couple: 'לי ורותם', date: '6.6.2027', signAs: 'ברק' });
    if (r.action === 'wait') { assert.equal(m, ''); continue; }
    assert.ok(m.startsWith(`היי ${r.vendor.name}`), r.action);
    assert.ok(m.trim().endsWith('ברק'), r.action);
    assert.ok(!m.includes('—'));
  }
});
