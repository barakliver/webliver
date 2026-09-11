import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  remaining, settled, startingTasks, MAX_MUST, QUESTIONS,
  type EventBasics,
} from '../onboarding.ts';

const blank: EventBasics = {
  eventDate: null, guestEstimate: null, region: '', budgetTarget: null, hasPlan: false,
};

test('an event nobody has filled in asks everything, once', () => {
  assert.deepEqual(remaining(blank), [...QUESTIONS]);
  assert.equal(settled(blank), false);
});

test('a question already answered on the event is never asked', () => {
  /* The producer agreed a date with a hall. Asking the couple for one is how
     a flow gets an answer that contradicts a booking. */
  const some = remaining({ ...blank, eventDate: '2026-12-05', guestEstimate: 180 });
  assert.deepEqual(some, ['region', 'budget', 'priorities']);
});

test('whitespace is not a region', () => {
  assert.ok(remaining({ ...blank, region: '   ' }).includes('region'));
  assert.ok(!remaining({ ...blank, region: 'הצפון' }).includes('region'));
});

test('zero guests is an answer and zero budget is not treated as one', () => {
  /* guest_estimate of 0 is a number somebody typed. budget_target null is
     nobody having said. The two are different and the column says which. */
  assert.ok(!remaining({ ...blank, guestEstimate: 0 }).includes('guests'));
  assert.ok(remaining({ ...blank, budgetTarget: null }).includes('budget'));
});

test('an event with everything on it shows no flow at all', () => {
  assert.ok(settled({
    eventDate: '2026-12-05', guestEstimate: 180, region: 'השרון',
    budgetTarget: 260000, hasPlan: true,
  }));
});

test('no date at all starts by agreeing one', () => {
  const t = startingTasks({}, null);
  assert.equal(t.length, 3);
  assert.equal(t[0].key, 'agreeDate');
  assert.ok(t.every((x) => x.inDays !== null), 'each one still gets a date of its own');
});

test('a year out starts with a shortlist, three months out with invitations', () => {
  assert.equal(startingTasks({}, 400)[0].key, 'shortlistVenues');
  assert.equal(startingTasks({}, 200)[0].key, 'bookVenue');
  assert.equal(startingTasks({}, 100)[0].key, 'sendInvites');
  assert.equal(startingTasks({}, 20)[0].key, 'sendInvites');
});

test('a wedding six weeks out is not told to shortlist halls', () => {
  const keys = startingTasks({}, 30).map((t) => t.key);
  assert.ok(!keys.includes('shortlistVenues'));
  assert.ok(!keys.includes('bookVenue'));
});

test('what they said they care about takes the third slot', () => {
  assert.equal(startingTasks({ must: ['photo'] }, 400)[2].key, 'photographer');
  assert.equal(startingTasks({ must: ['music'] }, 400)[2].key, 'music');
  assert.equal(startingTasks({ must: ['venue'] }, 400)[2].key, 'board', 'the hall is already the first task');
  assert.equal(startingTasks({}, 400)[2].key, 'board');
});

test('every starting task carries a supplier category the checklist knows', () => {
  /* The category is what makes ticking "לסגור צלם" ask who was hired. A key
     nothing recognises makes it an errand. */
  const known = ['venue', 'rsvp', 'decor', 'printing', 'photography', 'dj', 'other'];
  for (const days of [null, 20, 100, 200, 400]) {
    for (const t of startingTasks({ must: ['photo'] }, days)) {
      assert.ok(known.includes(t.category), `${t.key} carries ${t.category}`);
    }
  }
});

test('the three are always three, whatever was answered', () => {
  for (const days of [null, 0, 30, 45, 46, 119, 120, 121, 300, 301, 900]) {
    assert.equal(startingTasks({ must: ['photo', 'music', 'design'] }, days).length, 3);
  }
});

test('three is the cap on priorities', () => {
  assert.equal(MAX_MUST, 3);
});
