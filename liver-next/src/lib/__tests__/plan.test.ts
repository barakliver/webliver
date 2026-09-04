import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standingOf, PHASES, type PhaseSignals } from '../phase.ts';
import { FIRST_PLAN } from '../../content/plan.ts';

/**
 * The plan and the phase engine have to be one rhythm, not two.
 *
 * The dashboard tells a producer they are a phase behind. The task list is
 * meant to tell them what a phase behind actually consists of. If the plan
 * puts "send the invitations" at ninety days and the engine calls ninety days
 * the experience phase, then the two screens are describing different
 * weddings, and the producer believes whichever one they looked at last.
 *
 * Nothing prevents that drift except this file. Move a threshold in phase.ts
 * and these fail by name.
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

/** What the calendar alone calls an event this far out. */
const calendarPhase = (daysToEvent: number) =>
  standingOf({ ...bare, daysToEvent }).expected;

test('every step lands in the phase it claims', () => {
  for (const step of FIRST_PLAN) {
    /* An offset is days from the wedding; days-to-event is its opposite. */
    const actual = calendarPhase(-step.offsetDays);
    assert.equal(
      actual, step.phase,
      `"${step.title}" at ${step.offsetDays} days is ${actual}, not ${step.phase}`,
    );
  }
});

test('the plan covers every phase', () => {
  /* A phase with no step in it is a stretch of the year where the system has
     nothing to say, which for the producer reads as nothing to do. */
  for (const phase of PHASES) {
    assert.ok(
      FIRST_PLAN.some((s) => s.phase === phase),
      `no step anywhere in ${phase}`,
    );
  }
});

test('the steps run in order', () => {
  /* They are applied in file order and read in file order, so a step that is
     out of sequence in the file is out of sequence on the screen. */
  const offsets = FIRST_PLAN.map((s) => s.offsetDays);
  const sorted = [...offsets].sort((a, b) => a - b);
  assert.deepEqual(offsets, sorted);
});

test('no two steps share a title', () => {
  /* Applying a template skips a title that already exists on the event, so a
     duplicate inside the template silently loses one of the two. */
  const titles = FIRST_PLAN.map((s) => s.title);
  assert.equal(new Set(titles).size, titles.length);
});

test('titles fit the column they are stored in', () => {
  /* The insert truncates at 200 characters, and a truncated title is also a
     title that stops matching itself on a second apply. */
  for (const step of FIRST_PLAN) {
    assert.ok(step.title.length <= 200, step.title);
    assert.ok(step.title.trim().length > 0);
  }
});

test('the couple is never handed the internal money', () => {
  /* Supplier balances and equipment call sheets are the producer's side of
     the job. A couple reading "settle the outstanding supplier balances" in
     their own area is being shown the machinery. */
  const shown = FIRST_PLAN.filter((s) => s.visibleToClient);
  assert.ok(!shown.some((s) => s.title.includes('יתרות תשלום')));
  assert.ok(!shown.some((s) => s.title.includes('תשלומים אחרונים')));
});

test('what the couple is asked to do is theirs to do', () => {
  /* Anything owned by the client has to be visible to them, or it is a task
     assigned to somebody who cannot see it. */
  for (const step of FIRST_PLAN) {
    if (step.owner === 'client') {
      assert.ok(step.visibleToClient, `${step.title} is the couple's and hidden from them`);
    }
  }
});

test('the day of the wedding is the day of the wedding', () => {
  /* Zero is the one offset that must not drift: it is what puts the day-of
     console in somebody's hand on the right morning. */
  const dayOf = FIRST_PLAN.filter((s) => s.phase === 'dayOf');
  assert.equal(dayOf.length, 1);
  assert.equal(dayOf[0].offsetDays, 0);
});
