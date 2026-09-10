import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allocate, categoryOf, track, weekly, readPlan, BASE_SPLITS, PLAN_CATEGORIES, type BudgetPlan,
} from '../budgetPlan.ts';

/**
 * The money module's promises: a split that always sums to the total, a
 * line that lands in the right area whatever vocabulary it was written in,
 * a flag that fires at ten percent and not before, and a Sunday sentence
 * that names the right things.
 */

test('the baseline sums to one hundred', () => {
  assert.equal(Object.values(BASE_SPLITS).reduce((a, b) => a + b, 0), 100);
});

test('an allocation sums to one hundred percent whatever was named', () => {
  const cases = [
    { must: [], nice: [] },
    { must: ['photo'], nice: ['invites', 'other'] },
    { must: ['venue', 'photo', 'design'], nice: [] },
    { must: PLAN_CATEGORIES.filter((k) => k !== 'contingency'), nice: [] },
    { must: [], nice: PLAN_CATEGORIES.filter((k) => k !== 'contingency') },
  ] as const;
  for (const c of cases) {
    const a = allocate({ total: 200000, guests: 180, must: c.must, nice: c.nice });
    assert.equal(a.lines.reduce((s, l) => s + l.pct, 0), 100, JSON.stringify(c));
    assert.ok(a.lines.find((l) => l.key === 'contingency')!.pct >= 5, 'the safety margin is never cut');
  }
});

test('a must goes up, a nice-to-have goes down, and the rest gives way', () => {
  const a = allocate({ total: 200000, guests: 180, must: ['photo'], nice: ['invites'] });
  const line = (k: string) => a.lines.find((l) => l.key === k)!;
  assert.ok(line('photo').pct > BASE_SPLITS.photo);
  assert.equal(line('photo').moved, 'must');
  assert.ok(line('invites').pct < BASE_SPLITS.invites);
  assert.equal(line('invites').moved, 'nice');
  assert.ok(line('venue').pct < BASE_SPLITS.venue, 'the hall gave a little');
  assert.equal(a.perHead, Math.round(line('venue').amount / 180));
  assert.ok(a.lines.every((l) => l.amount % 100 === 0), 'amounts in round hundreds');
});

test('a line lands in its area by key, by Hebrew label, or not at all', () => {
  assert.equal(categoryOf({ category: 'photography', label: '' }), 'photo');
  assert.equal(categoryOf({ category: 'catering', label: '' }), 'venue');
  assert.equal(categoryOf({ category: '', label: 'צלם סטילס' }), 'photo');
  assert.equal(categoryOf({ category: 'צילום', label: 'קרא' }), 'photo');
  assert.equal(categoryOf({ category: '', label: 'דיג׳יי והגברה' }), 'music');
  assert.equal(categoryOf({ category: '', label: 'אולם וקייטרינג' }), 'venue');
  assert.equal(categoryOf({ category: '', label: 'בלת״מ' }), 'contingency');
  assert.equal(categoryOf({ category: '', label: 'מתנות לאורחים' }), 'other');
});

const plan: BudgetPlan = {
  total: 200000, guests: 180, must: ['photo'], nice: ['invites', 'other'],
  splits: { venue: 50, bar: 5, photo: 15, music: 5, design: 8, look: 5, invites: 1, transport: 2, other: 2, contingency: 7 },
};

test('the tracker flags an area past ten percent and offers a nice-to-have to cut', () => {
  const items = [
    { category: 'photo', label: 'צלם', estimate: 30000, agreed: 34000 },      // planned 30000: over by 13%
    { category: 'music', label: 'DJ', estimate: 10000, agreed: 10500 },       // planned 10000: over by 5%, not flagged
    { category: '', label: 'הזמנות', estimate: 500, agreed: null },           // planned 2000
  ];
  const t = track(items, plan);
  assert.deepEqual(t.flagged.map((r) => r.key), ['photo']);
  assert.equal(t.rows.find((r) => r.key === 'music')!.over, false);
  assert.equal(t.tradeOff?.cut, 'other', 'the nice-to-have with the most room');
  assert.equal(t.rows.find((r) => r.key === 'photo')!.pct, 113);
});

test('without a plan the tracker still adds up what is booked', () => {
  const t = track([{ category: 'bar', label: 'אלכוהול', estimate: 18000, agreed: null }], null);
  assert.equal(t.rows.length, 1);
  assert.equal(t.rows[0].actual, 18000);
  assert.equal(t.flagged.length, 0);
});

test('the Sunday sentence names the week, the watch, and the next payment', () => {
  const items = [
    { category: 'photo', label: 'צלם', estimate: 30000, agreed: 34000, created_at: '2026-09-08T10:00:00Z' },
    { category: 'venue', label: 'אולם', estimate: 100000, agreed: 100000, created_at: '2026-01-01T10:00:00Z' },
  ];
  const payments = [
    { title: 'מקדמה לצלם', amount: 5000, paid: true, paid_on: '2026-09-07', due_on: '2026-09-07' },
    { title: 'יתרה לאולם', amount: 50000, paid: false, paid_on: null, due_on: '2026-10-01' },
    { title: 'יתרה לצלם', amount: 29000, paid: false, paid_on: null, due_on: '2027-05-01' },
  ];
  const w = weekly(items, payments, plan, 200000, '2026-09-13');
  assert.deepEqual(w.added.map((a) => a.label), ['צלם']);
  assert.deepEqual(w.paid.map((p) => p.title), ['מקדמה לצלם']);
  assert.equal(w.overall.committed, 134000);
  assert.equal(w.overall.pct, 67);
  assert.equal(w.watch?.key, 'photo');
  assert.equal(w.nextDue?.title, 'יתרה לאולם');
  assert.equal(w.tradeOff?.cut, 'other');
});

test('a plan column is read defensively', () => {
  assert.equal(readPlan(null), null);
  assert.equal(readPlan({ total: 'lots' }), null);
  const p = readPlan({ total: 150000, must: ['photo', 'nonsense'], nice: [], splits: { venue: '50', photo: 12 } });
  assert.equal(p?.total, 150000);
  assert.deepEqual(p?.must, ['photo']);
  assert.equal(p?.splits.venue, 50);
  assert.equal(p?.splits.bar, 0);
});
