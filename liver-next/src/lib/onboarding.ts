import type { PlanCategory } from './budgetPlan.ts';

/**
 * The short opening flow, and the three tasks it ends with.
 *
 * A couple invited onto an event arrives at a screen that knows their names
 * and nothing else. Asking them five questions is worth doing once and
 * insulting to do twice, so the flow is built from what the event record is
 * still missing rather than from a fixed list of steps: a producer who
 * already agreed a date with a hall does not get asked for one.
 *
 * Five questions at most, and every one of them may be skipped. "We have not
 * decided" is a real answer about a wedding date and the commonest one on the
 * first call — a flow that will not move past a date is a flow that gets
 * abandoned by the couples who most need what is on the other side of it.
 *
 * It ends with three tasks rather than a congratulation. Which three depends
 * on what they said, because that is the whole reason for asking: a wedding
 * fourteen months out starts by choosing a hall, one three months out starts
 * by getting invitations out, and one with no date at all starts by agreeing
 * the date.
 *
 * Everything here is pure. The questions and the tasks are the judgement this
 * flow exists to make, and judgement that can only be exercised by standing
 * up a database and a signed-in couple is judgement nobody checks.
 */

export type Question = 'date' | 'guests' | 'region' | 'budget' | 'priorities';

export const QUESTIONS: readonly Question[] = ['date', 'guests', 'region', 'budget', 'priorities'];

/** What the event record already holds. Null and empty mean "nobody has
 *  said", which is the only thing that puts a question on the list. */
export type EventBasics = {
  eventDate: string | null;
  guestEstimate: number | null;
  region: string;
  budgetTarget: number | null;
  hasPlan: boolean;
};

/** What the couple answered. Every field may be absent: skipping is an
 *  answer, and an absent one leaves the blank blank. */
export type Answers = {
  /** Null for "we have not decided", which is not the same as not asked. */
  date?: string | null;
  guests?: number | null;
  region?: string;
  budget?: number | null;
  /** Up to three areas they would rather overspend on. */
  must?: PlanCategory[];
};

/** Which questions are still worth asking. */
export function remaining(b: EventBasics): Question[] {
  const out: Question[] = [];
  if (!b.eventDate) out.push('date');
  if (b.guestEstimate === null) out.push('guests');
  if (!b.region.trim()) out.push('region');
  if (b.budgetTarget === null) out.push('budget');
  if (!b.hasPlan) out.push('priorities');
  return out;
}

/** Nothing left to ask. The flow does not appear at all, rather than
 *  appearing and congratulating somebody for having nothing to fill in. */
export const settled = (b: EventBasics): boolean => remaining(b).length === 0;

/** At most three. More than three priorities is no priorities, which is the
 *  failure the question exists to prevent. */
export const MAX_MUST = 3;

export type StartTask = {
  /** What to do, as a key the copy turns into a sentence. */
  key: StartKey;
  /** Days from today, or null where the date is what is missing. */
  inDays: number | null;
  category: string;
};

export type StartKey =
  | 'agreeDate' | 'shortlistVenues' | 'bookVenue' | 'guestList'
  | 'sendInvites' | 'photographer' | 'music' | 'budgetLines' | 'board';

/* The runway, in days, at which a wedding's first three moves change. Drawn
   from the production playbook's own rhythm rather than anything generic:
   halls here are held about ten months out, invitations go two months out,
   and inside six weeks the work is confirmations rather than choosing. */
const LONG = 300;
const MID = 120;
const SHORT = 45;

/**
 * The three things to do first, given what they just told us.
 *
 * Three, and only three. A couple handed twenty-eight steps on their first
 * morning closes the tab; the twenty-eight are the producer's plan and stay
 * on the producer's screen.
 */
export function startingTasks(a: Answers, daysLeft: number | null): StartTask[] {
  /* No date is its own situation. Everything else waits on it — a hall
     cannot be held, invitations cannot be printed — so the first task is
     agreeing one, and the other two are the work that does not need it. */
  if (daysLeft === null) {
    return [
      { key: 'agreeDate', inDays: 14, category: 'venue' },
      { key: 'guestList', inDays: 21, category: 'rsvp' },
      { key: 'board', inDays: 30, category: 'decor' },
    ];
  }

  if (daysLeft <= SHORT) {
    return [
      { key: 'sendInvites', inDays: 3, category: 'printing' },
      { key: 'guestList', inDays: 7, category: 'rsvp' },
      { key: 'budgetLines', inDays: 10, category: 'other' },
    ];
  }

  if (daysLeft <= MID) {
    return [
      { key: 'sendInvites', inDays: 10, category: 'printing' },
      { key: 'guestList', inDays: 14, category: 'rsvp' },
      { key: 'photographer', inDays: 21, category: 'photography' },
    ];
  }

  if (daysLeft <= LONG) {
    return [
      { key: 'bookVenue', inDays: 14, category: 'venue' },
      { key: 'guestList', inDays: 21, category: 'rsvp' },
      /* Whichever they said they care most about gets the third slot, so the
         list reads as theirs rather than as a template. */
      third(a),
    ];
  }

  return [
    { key: 'shortlistVenues', inDays: 21, category: 'venue' },
    { key: 'guestList', inDays: 30, category: 'rsvp' },
    third(a),
  ];
}

function third(a: Answers): StartTask {
  const must = a.must ?? [];
  if (must.includes('photo')) return { key: 'photographer', inDays: 30, category: 'photography' };
  if (must.includes('music')) return { key: 'music', inDays: 30, category: 'dj' };
  if (must.includes('design')) return { key: 'board', inDays: 30, category: 'decor' };
  return { key: 'board', inDays: 30, category: 'decor' };
}
