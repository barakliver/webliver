import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standingOf, stepsOf, type PhaseSignals } from '../phase.ts';

/**
 * The case this exists for is the last one in this file: two events ninety
 * days out, one ready and one not, which a countdown shows as identical.
 */

const bare: PhaseSignals = {
  daysToEvent: null,
  hasVenue: false,
  hasBudgetTarget: false,
  vendorsBooked: 0,
  guestsInvited: 0,
  guestsAnswered: 0,
  scheduleItems: 0,
};

const on = (over: Partial<PhaseSignals>): PhaseSignals => ({ ...bare, ...over });

test('an event with no date at all is at the beginning', () => {
  /* Not missing data. Plenty of events are agreed before a date is. */
  const r = standingOf(bare);
  assert.equal(r.phase, 'foundation');
  assert.equal(r.behind, 0);
});

test('a year out, nothing done, is not behind', () => {
  const r = standingOf(on({ daysToEvent: 400 }));
  assert.equal(r.phase, 'foundation');
  assert.equal(r.behind, 0);
});

test('work that ran ahead of the calendar is reported as ahead', () => {
  /* Ninety days out is experience design on this playbook's rhythm —
     invitations go six to eight weeks out, not three months. This event has
     already sent them and had three quarters answered, so it is a phase in
     front, and the screen says so rather than rounding it back down to the
     date. */
  const r = standingOf(on({
    daysToEvent: 90, hasVenue: true, hasBudgetTarget: true,
    vendorsBooked: 4, guestsInvited: 200, guestsAnswered: 150, scheduleItems: 3,
  }));
  assert.equal(r.expected, 'experience');
  assert.equal(r.phase, 'guests');
  assert.equal(r.ahead, 1);
  assert.equal(r.behind, 0);
});

test('level with the calendar is neither ahead nor behind', () => {
  const r = standingOf(on({
    daysToEvent: 120, hasVenue: true, hasBudgetTarget: true, vendorsBooked: 2,
  }));
  assert.equal(r.expected, 'experience');
  assert.equal(r.phase, 'experience');
  assert.equal(r.behind, 0);
  assert.equal(r.ahead, 0);
});

test('the work leads when it has not', () => {
  /* The same ninety days with nothing booked. A countdown would show these
     two events as the same thing. */
  const r = standingOf(on({ daysToEvent: 90, hasVenue: true }));
  assert.equal(r.expected, 'experience');
  assert.equal(r.phase, 'foundation');
  assert.ok(r.behind >= 2, `behind ${r.behind}`);
  assert.equal(r.ahead, 0);
});

test('a guest list does not buy a phase the suppliers have not', () => {
  /* Filling in two hundred names with nothing booked reaches guest
     operations and stops. It cannot reach final coordination, which needs
     the suppliers and the running order that come before it. */
  const r = standingOf(on({ daysToEvent: 20, guestsInvited: 200, guestsAnswered: 190 }));
  assert.equal(r.expected, 'guests');
  /* Not "guest operations, on track", which is what this returned before the
     levels were chained. No venue, no budget, no supplier: it is at the
     beginning, three phases behind, and that is the screen worth having. */
  assert.equal(r.phase, 'foundation');
  assert.equal(r.behind, 3);
});

test('final coordination has to be earned three ways', () => {
  const nearly = on({
    daysToEvent: 10, hasVenue: true, hasBudgetTarget: true,
    vendorsBooked: 3, guestsInvited: 100, guestsAnswered: 80, scheduleItems: 4,
  });
  assert.equal(standingOf(nearly).phase, 'guests', 'four schedule lines is not a running order');

  const there = standingOf({ ...nearly, scheduleItems: 5 });
  assert.equal(there.phase, 'final');
  assert.equal(there.behind, 0);
});

test('the day itself belongs to the calendar, however little was done', () => {
  /* A screen answering "still booking suppliers" on the morning of a wedding
     would be technically right and useless. */
  const r = standingOf(on({ daysToEvent: 0 }));
  assert.equal(r.phase, 'dayOf');
  assert.equal(r.behind, 0);
  assert.equal(r.ahead, 0);
});

test('and so does everything after it', () => {
  const r = standingOf(on({ daysToEvent: -9 }));
  assert.equal(r.phase, 'after');
  assert.equal(r.behind, 0);
});

test('the morning after is still the day of', () => {
  /* An event that finished at three is not a past event at nine, and the
     day-of console is still the screen somebody wants. */
  assert.equal(standingOf(on({ daysToEvent: -1 })).phase, 'dayOf');
});

test('replies count as a share, not as a number', () => {
  /* Eighty answers is most of a hundred guests and a tenth of eight hundred,
     and the phase should not think those are the same. */
  const small = standingOf(on({
    daysToEvent: 30, vendorsBooked: 3, scheduleItems: 6,
    guestsInvited: 100, guestsAnswered: 80,
  }));
  const large = standingOf(on({
    daysToEvent: 30, vendorsBooked: 3, scheduleItems: 6,
    guestsInvited: 800, guestsAnswered: 80,
  }));
  /* The smaller list is 80 per cent answered and reaches final coordination
     a phase ahead of the calendar; the larger is 10 per cent and does not. */
  assert.equal(small.phase, 'final');
  assert.equal(small.ahead, 1);
  assert.equal(large.phase, 'guests');
  assert.equal(large.behind, 0);
});

test('nobody invited yet is not everybody answered', () => {
  /* Zero out of zero must not read as a hundred per cent and carry an event
     into final coordination on an empty guest list. */
  const r = standingOf(on({ daysToEvent: 10, vendorsBooked: 4, scheduleItems: 8 }));
  assert.notEqual(r.phase, 'final');
});

test('the steps say what is done rather than what phase it is', () => {
  const done = stepsOf(on({
    daysToEvent: 30, hasVenue: true, hasBudgetTarget: true,
    vendorsBooked: 3, guestsInvited: 100, guestsAnswered: 90, scheduleItems: 6,
  }));
  assert.deepEqual(done.map((s) => s.done), [true, true, true, true, true]);

  const nothing = stepsOf(bare);
  assert.deepEqual(nothing.map((s) => s.done), [false, false, false, false, false]);
});

test('a step can be done while a later one is not, and that is the point', () => {
  /* This is what makes the list a checklist rather than a progress bar. */
  const steps = stepsOf(on({ daysToEvent: 200, hasVenue: true, hasBudgetTarget: true, vendorsBooked: 3 }));
  assert.deepEqual(steps.map((s) => s.done), [true, true, false, false, false]);
});
