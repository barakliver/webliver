import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TIMELINE, TIMELINE_CATEGORIES, buildTimeline, offsetFor, shiftDate, ABROAD_INVITE_DAYS,
} from '../../content/timeline.ts';

/**
 * The plan bends to the wedding, and the ways it bends are the ones a
 * planner would check by hand: the hall before the photographer, the
 * invitations before the replies, nine months for a wedding abroad, and a
 * short runway that says so rather than dating tasks into last year.
 */

const local = { eventDate: '2027-06-06', today: '2026-06-06', guests: 120, abroad: false };
const byId = <T extends { id: string }>(rows: T[], id: string): T | undefined => rows.find((r) => r.id === id);

test('every step has a category the screen knows and a reminder', () => {
  const ids = new Set<string>();
  for (const s of TIMELINE) {
    assert.ok((TIMELINE_CATEGORIES as readonly string[]).includes(s.category), `${s.id}: ${s.category}`);
    assert.ok(s.remindDays >= 1 && s.remindDays <= 30, `${s.id}: remind ${s.remindDays}`);
    assert.ok(!ids.has(s.id), `${s.id} twice`);
    ids.add(s.id);
  }
});

test('a year out, every step has a real date and the order holds', () => {
  const { rows, warnings } = buildTimeline(local);
  assert.deepEqual(warnings, []);
  assert.ok(rows.every((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.dueOn)));
  assert.ok(rows.every((r) => !r.atRisk));
  const at = (id: string) => byId(rows, id)!.dueOn;
  assert.ok(at('venue') < at('photo'), 'the hall before the photographer');
  assert.ok(at('save-date') < at('invites'), 'save the date before the invitations');
  assert.ok(at('invites') < at('rsvp-deadline'), 'invitations before the reply deadline');
  assert.ok(at('tasting') < at('headcount'), 'the tasting before the final numbers');
  assert.equal(at('day-of'), '2027-06-06');
  assert.equal(byId(rows, 'hotel'), undefined, 'no hotel block for a local wedding');
});

test('abroad, the invitations leave nine months out and the travel steps appear', () => {
  const { rows } = buildTimeline({ ...local, abroad: true });
  const inv = byId(rows, 'invites')!;
  assert.ok(shiftDate('2027-06-06', -ABROAD_INVITE_DAYS) >= inv.dueOn, `invitations at ${inv.dueOn}`);
  assert.ok(byId(rows, 'hotel'), 'hotel block');
  assert.ok(byId(rows, 'travel-guide'), 'travel guide');
  assert.ok(byId(rows, 'hotel')!.dueOn < inv.dueOn, 'rooms before invitations');
  const rsvp = byId(rows, 'rsvp-deadline')!;
  assert.ok(shiftDate('2027-06-06', -120) >= rsvp.dueOn, 'replies four months out');
});

test('a big wedding books the hall and closes the replies earlier', () => {
  const small = buildTimeline({ ...local, guests: 80 }).rows;
  const big = buildTimeline({ ...local, guests: 220 }).rows;
  assert.ok(byId(big, 'venue')!.dueOn < byId(small, 'venue')!.dueOn);
  assert.ok(byId(big, 'rsvp-deadline')!.dueOn < byId(small, 'rsvp-deadline')!.dueOn);
  assert.ok(byId(big, 'seating')!.dueOn < byId(small, 'seating')!.dueOn);
});

test('a short runway flags the late steps and dates none of them in the past', () => {
  const t = buildTimeline({ ...local, today: '2027-04-20' });
  assert.ok(t.warnings.includes('short'));
  const late = t.rows.filter((r) => r.atRisk);
  assert.ok(late.length > 10, `${late.length} at risk`);
  assert.ok(t.rows.every((r) => r.dueOn >= '2027-04-20'), 'nothing dated in the past');
  assert.ok(late.every((r) => r.dueOn <= '2027-05-04'), 'the late ones land within a fortnight');
  /* Their order survives the squeeze. */
  const venue = byId(t.rows, 'venue')!, photo = byId(t.rows, 'photo')!;
  assert.ok(venue.dueOn <= photo.dueOn);
  assert.ok(byId(t.rows, 'files')!.dueOn > '2027-06-06', 'after-the-wedding steps do not move');
});

test('abroad with under nine months says the invitations cannot make it', () => {
  const t = buildTimeline({ ...local, abroad: true, today: '2027-01-01' });
  assert.ok(t.warnings.includes('abroadShort'));
  assert.ok(byId(t.rows, 'invites')!.atRisk);
});

test('an owner chosen per area overrides the step, and only there', () => {
  const t = buildTimeline({ ...local, owners: { guests: 'producer' } });
  assert.ok(t.rows.filter((r) => r.category === 'guests').every((r) => r.owner === 'producer'));
  assert.equal(byId(t.rows, 'fitting-1')!.owner, 'client');
});

test('a bad date builds nothing rather than a plan for the year 0', () => {
  assert.deepEqual(buildTimeline({ ...local, eventDate: 'soon' }).rows, []);
  assert.equal(offsetFor(TIMELINE[0], { guests: null, abroad: false }), TIMELINE[0].offsetDays);
});
