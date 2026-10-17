import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreLead, RING_ANYWAY } from '../leadScore.ts';

const TODAY = '2026-10-17';

test('a full production, eight months out, with a phone, over budget, from a referral is the top', () => {
  const s = scoreLead({
    event_date: '2027-06-10', intent: 'full_production', phone: '0501234567',
    budget_min: 120000, budget_max: 160000, source: 'referral',
  }, TODAY);
  assert.equal(s.score, 100);
  assert.match(s.reason, /ארבעה עד ארבעה עשר חודשים \(30\)/);
  assert.match(s.reason, /הפקה מלאה \(30\)/);
  assert.match(s.reason, /יש טלפון \(15\)/);
  assert.match(s.reason, /תקציב מעל 100 אלף \(15\)/);
  assert.match(s.reason, /המלצה \(10\)/);
});

test('spam is zero whatever else it carries', () => {
  const s = scoreLead({ event_date: '2027-06-10', intent: 'spam', phone: '0501234567', source: 'referral' }, TODAY);
  assert.equal(s.score, 0);
  assert.equal(s.reason, 'נראה כמו ספאם');
});

test('no date and an address only is a thin enquiry', () => {
  const s = scoreLead({ email: 'a@b.co' }, TODAY);
  assert.equal(s.score, 15);
  assert.match(s.reason, /בלי תאריך \(10\)/);
  assert.match(s.reason, /אימייל בלבד \(5\)/);
});

test('the date window is read from today, not from the calendar year', () => {
  assert.equal(scoreLead({ event_date: '2026-12-01' }, TODAY).score, 10, 'under three months');
  assert.equal(scoreLead({ event_date: '2027-02-01' }, TODAY).score, 20, 'three to four');
  assert.equal(scoreLead({ event_date: '2027-03-01' }, TODAY).score, 30, 'four months');
  assert.equal(scoreLead({ event_date: '2027-12-01' }, TODAY).score, 30, 'thirteen months');
  assert.equal(scoreLead({ event_date: '2028-03-01' }, TODAY).score, 20, 'past fourteen');
  assert.equal(scoreLead({ event_date: '2026-01-01' }, TODAY).score, 0, 'already happened');
});

test('a phone beats an address, and both is not more than the phone', () => {
  assert.equal(scoreLead({ phone: '050', email: 'a@b.co' }, TODAY).score, 25);
  assert.equal(scoreLead({ phone: '050' }, TODAY).score, 25);
});

test('budget reads the larger of the two bounds and only above the line', () => {
  assert.equal(scoreLead({ budget_min: 90000, budget_max: 100000 }, TODAY).score, 10);
  assert.equal(scoreLead({ budget_min: 80000, budget_max: 130000 }, TODAY).score, 25);
  assert.equal(scoreLead({ budget_min: 130000 }, TODAY).score, 25);
});

test('the game and a referral are the only sources worth points', () => {
  assert.equal(scoreLead({ source: 'before_i_do' }, TODAY).score, 20);
  assert.equal(scoreLead({ source: 'instagram' }, TODAY).score, 10);
});

test('the score never passes a hundred and the ring line is eighty', () => {
  const s = scoreLead({
    event_date: '2027-06-10', intent: 'full_production', phone: '050',
    budget_max: 200000, source: 'before_i_do',
  }, TODAY);
  assert.equal(s.score, 100);
  assert.equal(RING_ANYWAY, 80);
});
