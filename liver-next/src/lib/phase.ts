/**
 * Where an event actually is, which is not the same as how close it is.
 *
 * A countdown is not a plan. Two weddings ninety days out are in completely
 * different places if one has a venue, a caterer and a band and the other has
 * a date and a spreadsheet, and a screen that shows both as "90 days to go" is
 * telling a producer the one thing they already knew.
 *
 * So the phase is read twice and both answers are kept.
 *
 *   The work says where the event has actually earned its way to. No supplier
 *   booked means it is still choosing suppliers, whatever the date says. This
 *   is the phase, because it is where the event is.
 *
 *   The calendar says where it ought to be by now, and the distance between
 *   them is the number worth putting on a screen.
 *
 * An earlier version took the lower of the two and it was wrong in one
 * direction: an event thirty days out that had already finished its guest
 * operations was shown as being in guest operations, because the calendar
 * said so. Understating an event that is ahead is a smaller failure than
 * flattering one that is behind, but it is still the screen lying about
 * something it knows. Both gaps are reported now, in the direction they
 * actually run.
 *
 * Pure arithmetic over rows that were already fetched, for the same reason
 * the gap rules and the analytics are: a judgement about somebody's business
 * that can only be exercised by standing up a database and six tables is a
 * judgement nobody will ever check.
 */

export const PHASES = [
  'foundation',   // vision, date, budget, where
  'bookings',     // venue, catering, photography, music, production
  'experience',   // the guest's evening, the look, logistics
  'guests',       // invitations, replies, seating, access, diets
  'final',        // confirmations, balances, the running order, contacts
  'dayOf',        // it is happening
  'after',        // final payments, files, feedback, archive
] as const;

export type Phase = (typeof PHASES)[number];

const order = (p: Phase) => PHASES.indexOf(p);

/**
 * What the screens already know about an event, in the shape this needs.
 *
 * Counts rather than rows: nothing here should tempt a caller into passing a
 * whole guest list to work out a phase.
 */
export type PhaseSignals = {
  /** Negative once the event is behind us. Null when no date is set, which is
   *  a real state rather than missing data: plenty of events are booked
   *  before a date is agreed. */
  daysToEvent: number | null;
  hasVenue: boolean;
  hasBudgetTarget: boolean;
  /** Suppliers with a booking, not suppliers on a shortlist. */
  vendorsBooked: number;
  guestsInvited: number;
  guestsAnswered: number;
  /** Lines on the running order. */
  scheduleItems: number;
};

export type Standing = {
  /** Where the work has reached. Once the day arrives, the day. */
  phase: Phase;
  /** Where the calendar says it should be. */
  expected: Phase;
  /** Phases the work lags the calendar. Zero when level or ahead. */
  behind: number;
  /** Phases the work leads it. Zero when level or behind. */
  ahead: number;
};

/* The calendar half. Thresholds are the production playbook's own rhythm for
   a wedding in Israel rather than anything generic: suppliers are signed
   around six months out, invitations go two months out, and the last fortnight
   is confirmations and balances. */
function byCalendar(days: number | null): Phase {
  if (days === null) return 'foundation';
  if (days < -1) return 'after';
  if (days <= 0) return 'dayOf';
  if (days <= 14) return 'final';
  if (days <= 60) return 'guests';
  if (days <= 150) return 'experience';
  if (days <= 300) return 'bookings';
  return 'foundation';
}

/**
 * The work half. Chained on purpose.
 *
 * Each level asks for its own evidence *and* everything under it, which is
 * the difference between a ladder and a set of unrelated badges. The first
 * version of this was the badges: it read the guest count on its own, so an
 * event twenty days out with two hundred replies and no venue, no budget and
 * no supplier came out as "guest operations, on track". That event is in
 * serious trouble and the screen was congratulating it.
 *
 * A guest list is the easiest of these to fill in and the least evidence that
 * anything has been produced.
 */
function byWork(s: PhaseSignals): Phase {
  const answered = s.guestsInvited > 0 ? s.guestsAnswered / s.guestsInvited : 0;

  const bookings = s.vendorsBooked >= 1 || (s.hasVenue && s.hasBudgetTarget);
  const experience = bookings && s.vendorsBooked >= 2;
  const guests = experience && (s.scheduleItems >= 1 || s.guestsInvited > 0);
  const final = guests && s.vendorsBooked >= 3 && s.scheduleItems >= 5 && answered >= 0.7;

  if (final) return 'final';
  if (guests) return 'guests';
  if (experience) return 'experience';
  if (bookings) return 'bookings';
  return 'foundation';
}

/**
 * The phase, and the gap.
 *
 * The day itself and everything after it are the calendar's alone. An event
 * happening tomorrow is happening tomorrow however little was done, and a
 * screen that answered "still booking suppliers" on the morning of a wedding
 * would be technically right and useless.
 */
export function standingOf(s: PhaseSignals): Standing {
  const expected = byCalendar(s.daysToEvent);

  if (expected === 'dayOf' || expected === 'after') {
    return { phase: expected, expected, behind: 0, ahead: 0 };
  }

  const earned = byWork(s);
  const gap = order(expected) - order(earned);

  return {
    phase: earned,
    expected,
    behind: Math.max(0, gap),
    ahead: Math.max(0, -gap),
  };
}

/**
 * The one thing to do next.
 *
 * Keyed on the phase rather than written into a screen, because the couple's
 * side and the producer's side ask the same question and should not drift
 * into two different answers to it.
 */
export type NextStep = { key: Phase; done: boolean };

export function stepsOf(s: PhaseSignals): NextStep[] {
  const answered = s.guestsInvited > 0 ? s.guestsAnswered / s.guestsInvited : 0;
  return [
    { key: 'foundation', done: s.hasVenue && s.hasBudgetTarget && s.daysToEvent !== null },
    { key: 'bookings', done: s.vendorsBooked >= 3 },
    { key: 'experience', done: s.scheduleItems >= 1 },
    { key: 'guests', done: s.guestsInvited > 0 && answered >= 0.7 },
    { key: 'final', done: s.scheduleItems >= 5 && s.vendorsBooked >= 3 && answered >= 0.7 },
  ];
}
