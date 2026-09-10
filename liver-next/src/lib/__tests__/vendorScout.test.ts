import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  scout, styleScore, budgetScore, strengthScore, outreach, outreachGeneric, bestSendWindow, budgetLine,
  type ScoutVendor,
} from '../vendorScout.ts';

const v = (over: Partial<ScoutVendor>): ScoutVendor => ({
  id: 'x', name: 'ספק', category: 'photo', contact_name: '', phone: '', email: '', area: '', notes: '',
  agreed_price: null, bookings: 0, ...over,
});

test('style is the share of the couple\'s words the card echoes', () => {
  const a = styleScore(v({ notes: 'צילום חם וטבעי, לא מבוים' }), 'חם, טבעי, עריכה');
  assert.equal(a.score, 7);
  assert.deepEqual(a.matched, ['חם', 'טבעי']);
  assert.equal(styleScore(v({}), '').score, 5, 'no words, no opinion');
});

test('budget is ten inside the range and falls off with distance', () => {
  assert.equal(budgetScore(12000, 10000, 15000), 10);
  assert.equal(budgetScore(null, 10000, 15000), 5);
  assert.equal(budgetScore(16500, 10000, 15000), 8);
  assert.equal(budgetScore(30000, 10000, 15000), 0);
  assert.equal(budgetScore(9000, 10000, null), 8);
});

test('strength is bookings first, then how complete the card is', () => {
  assert.equal(strengthScore(v({})), 0);
  assert.equal(strengthScore(v({ bookings: 2, notes: 'x', phone: '05', email: 'a@b' })), 10);
  assert.equal(strengthScore(v({ bookings: 1 })), 3);
});

test('the scout ranks within the category, flags deal-breakers, and returns five', () => {
  const vendors = [
    v({ id: '1', name: 'א', notes: 'חם טבעי', agreed_price: 12000, bookings: 3, phone: '05' }),
    v({ id: '2', name: 'ב', notes: 'מבוים, מינימום 8 שעות', agreed_price: 12000, bookings: 1 }),
    v({ id: '3', name: 'ג', category: 'music', notes: 'חם טבעי', agreed_price: 12000, bookings: 9 }),
    v({ id: '4', name: 'ד', agreed_price: 40000 }),
    v({ id: '5', name: 'ה', area: 'צפון', notes: 'טבעי' }),
    v({ id: '6', name: 'ו' }),
    v({ id: '7', name: 'ז' }),
  ];
  const r = scout(vendors, { category: 'photo', style: 'חם טבעי', budgetLow: 10000, budgetHigh: 15000, area: 'צפון', dealBreakers: 'מינימום' });
  assert.equal(r.length, 5);
  assert.equal(r[0].vendor.id, '1');
  assert.ok(!r.some((x) => x.vendor.id === '3'), 'the DJ is not a photographer');
  assert.deepEqual(r.find((x) => x.vendor.id === '2')!.flags, ['מינימום']);
  assert.equal(r.find((x) => x.vendor.id === '5')!.areaMatch, true);
});

test('the outreach carries the facts the system knows and a bracket for the one it does not', () => {
  const t = outreach({
    vendorName: 'סטודיו לביא', contactName: 'נועה', couple: 'לי ורותם', date: '6.6.2027', venue: 'שדה חמד',
    guests: 180, budgetLow: 10000, budgetHigh: 15000, signAs: 'ברק', category: 'צילום',
  });
  assert.ok(t.startsWith('היי נועה,'));
  assert.ok(t.includes('לי ורותם'));
  assert.ok(t.includes('שדה חמד'));
  assert.ok(t.includes('180'));
  assert.ok(t.includes('בין ₪10,000 ל-₪15,000'));
  assert.ok(t.includes('['), 'a bracket for the portfolio detail');
  assert.ok(t.trim().endsWith('ברק'));
  assert.ok(!t.includes('—'));
  const g = outreachGeneric({ couple: 'לי ורותם', date: '6.6.2027', venue: '', guests: null, budgetLow: null, budgetHigh: 15000, signAs: 'ברק', category: 'צילום' });
  assert.ok(g.startsWith('היי [שם הספק],'));
  assert.equal(budgetLine(null, 15000), 'עד ₪15,000');
});

test('the best send window is Tuesday to Thursday, this week or next', () => {
  assert.deepEqual(bestSendWindow('2026-09-10'), { from: '2026-09-10', to: '2026-09-10', now: true }); // Thursday
  const sun = bestSendWindow('2026-09-13');
  assert.equal(sun.now, false);
  assert.equal(sun.from, '2026-09-15');
  assert.equal(sun.to, '2026-09-17');
  const fri = bestSendWindow('2026-09-11');
  assert.equal(fri.from, '2026-09-15');
});
