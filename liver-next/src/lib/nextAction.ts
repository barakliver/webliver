import { daysBetween } from './clock.ts';

/**
 * The one thing worth doing next, and why.
 *
 * A couple opens this app and sees a countdown, sixteen rows of figures and
 * eleven panels. All of it is true and none of it answers the question they
 * actually arrived with, which is "what do we do now". A number is not an
 * instruction: 42 open tasks tells somebody they are behind without telling
 * them on what, and the only thing it invites is to feel bad about it.
 *
 * So one action, chosen by rule rather than by model. Deterministic on
 * purpose and for two reasons. The couple has to be able to trust that the
 * screen is not making something up — every line of this is arithmetic over
 * rows they can see for themselves. And a rule can be checked: this is the
 * judgement the dashboard exists to make, and judgement that can only be
 * exercised by standing up a database and six tables is judgement nobody
 * checks.
 *
 * The order is what it costs to ignore the thing, not how urgent it feels.
 * Money late is first because it is the only one that is already costing
 * somebody something. A wedding with no guest list ninety days out is next,
 * because the guest list is what every other number on the screen is a
 * function of. A photograph nobody has saved to the board is last, because
 * nothing breaks.
 *
 * Nothing here proposes an action the couple cannot perform. Their producer's
 * own work is not their to-do list, and a dashboard that tells somebody to do
 * a thing they have no button for is worse than a dashboard that says nothing.
 */

export type NextActionCode =
  | 'payLate'
  | 'taskLate'
  | 'paySoon'
  | 'taskSoon'
  | 'guestsChase'
  | 'guestsEmpty'
  | 'budgetOver'
  | 'budgetEmpty'
  | 'boardEmpty'
  | 'start'
  | 'clear';

/** Where the button goes. Every one of these is a section already on the
 *  couple's own screen, so the action is one scroll away rather than a
 *  navigation into somewhere they have to find their way back from. */
export type Section = 'tasks' | 'payments' | 'guests' | 'budget' | 'board';

export type NextAction = {
  code: NextActionCode;
  /** The row's own words, where the action is about one row: a task's title,
   *  a payment's name, the budget area that is over. Empty otherwise. */
  subject: string;
  /** Whatever number the sentence needs — how many are late, how many have
   *  not replied. Zero where the sentence needs none. */
  n: number;
  due: string | null;
  late: boolean;
  section: Section;
};

export type TaskFact = {
  title: string;
  due_on: string | null;
  done: boolean;
  owner: 'producer' | 'client';
};

export type PayFact = {
  title: string;
  amount: number;
  due_on: string | null;
  paid: boolean;
};

export type PlanFacts = {
  /** Today where the event is, so an evening in Israel is not tomorrow. */
  today: string;
  /** Null with no date agreed, which is a real state: plenty of weddings are
   *  booked before a date is. */
  daysLeft: number | null;
  tasks: TaskFact[];
  payments: PayFact[];
  guestsInvited: number;
  guestsAnswered: number;
  budgetLines: number;
  budgetTarget: number | null;
  /** The area past its planned figure, named by whatever already computes
   *  that. Null when nothing is over or there is no plan to be over. */
  overArea: string | null;
  boardImages: number;
  /** Sections switched off for this couple. An action pointing at a panel
   *  they cannot see is an action they cannot take. */
  can: (key: string) => boolean;
};

/* When a missing thing stops being early and starts being late. The same
   rhythm the rest of the product uses for a wedding in Israel: invitations go
   about two months out, so replies are chased inside forty-five days, and a
   guest list that does not exist three months out is the thing holding up
   the hall, the caterer and the seating all at once. */
const CHASE_REPLIES_WITHIN = 45;
const NEEDS_GUESTS_WITHIN = 90;
const NEEDS_BUDGET_WITHIN = 150;
const PAYMENT_SOON = 10;
const TASK_SOON = 7;
/* A board is worth starting early and pointless to nag about late. */
const BOARD_WORTH_IT_FROM = 45;

/** Theirs first, then the earliest date, then whatever order they were given
 *  in. A task with no date sorts last: it is open, not due. */
const byUrgency = (a: TaskFact, b: TaskFact) => {
  if ((a.owner === 'client') !== (b.owner === 'client')) return a.owner === 'client' ? -1 : 1;
  if (!a.due_on && !b.due_on) return 0;
  if (!a.due_on) return 1;
  if (!b.due_on) return -1;
  return a.due_on < b.due_on ? -1 : a.due_on > b.due_on ? 1 : 0;
};

/** The open tasks, most urgent first. The card shows the top of this and the
 *  list below shows all of it, in the order the couple dragged them into. */
export function upcoming(tasks: TaskFact[], limit: number): TaskFact[] {
  return tasks.filter((t) => !t.done).sort(byUrgency).slice(0, limit);
}

export function nextAction(f: PlanFacts): NextAction {
  const none = (code: NextActionCode, section: Section): NextAction =>
    ({ code, subject: '', n: 0, due: null, late: false, section });

  const within = (d: number) => f.daysLeft !== null && f.daysLeft >= 0 && f.daysLeft <= d;
  const daysTo = (iso: string) => daysBetween(f.today, iso);

  const money = f.can('budget');
  const open = f.tasks.filter((t) => !t.done);
  const owed = money ? f.payments.filter((p) => !p.paid && p.due_on) : [];

  /* ── money that is already late ─────────────────────────────────────────
     First because it is the only thing on this screen that is costing
     somebody something while it sits there. */
  const latePay = owed.filter((p) => daysTo(p.due_on!) < 0)
    .sort((a, b) => (a.due_on! < b.due_on! ? -1 : 1));
  if (latePay.length > 0) {
    return {
      code: 'payLate',
      subject: latePay[0].title,
      n: latePay.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      due: latePay[0].due_on,
      late: true,
      section: 'payments',
    };
  }

  /* ── a task of theirs, past its date ────────────────────────────────────
     Only one is named. A card that lists nine late things is the raw count
     again, wearing a card. */
  const tasksOn = f.can('tasks');
  const lateTasks = tasksOn
    ? open.filter((t) => t.due_on && daysTo(t.due_on) < 0).sort(byUrgency)
    : [];
  if (lateTasks.length > 0) {
    return {
      code: 'taskLate',
      subject: lateTasks[0].title,
      n: lateTasks.length,
      due: lateTasks[0].due_on,
      late: true,
      section: 'tasks',
    };
  }

  /* ── money about to be due ──────────────────────────────────────────────*/
  const soonPay = owed.filter((p) => daysTo(p.due_on!) <= PAYMENT_SOON)
    .sort((a, b) => (a.due_on! < b.due_on! ? -1 : 1));
  if (soonPay.length > 0) {
    return {
      code: 'paySoon',
      subject: soonPay[0].title,
      n: Number(soonPay[0].amount) || 0,
      due: soonPay[0].due_on,
      late: false,
      section: 'payments',
    };
  }

  /* ── a task of theirs, this week ────────────────────────────────────────*/
  const soonTasks = tasksOn
    ? open.filter((t) => t.due_on && daysTo(t.due_on) <= TASK_SOON).sort(byUrgency)
    : [];
  if (soonTasks.length > 0) {
    return {
      code: 'taskSoon',
      subject: soonTasks[0].title,
      n: soonTasks.length,
      due: soonTasks[0].due_on,
      late: false,
      section: 'tasks',
    };
  }

  /* ── the guest list, which everything else is a function of ─────────────*/
  const guestsOn = f.can('guests');
  if (guestsOn && f.guestsInvited > 0 && within(CHASE_REPLIES_WITHIN)) {
    const waiting = f.guestsInvited - f.guestsAnswered;
    if (waiting > 0) {
      return { code: 'guestsChase', subject: '', n: waiting, due: null, late: false, section: 'guests' };
    }
  }
  if (guestsOn && f.guestsInvited === 0 && within(NEEDS_GUESTS_WITHIN)) {
    return none('guestsEmpty', 'guests');
  }

  /* ── the budget, over or absent ─────────────────────────────────────────*/
  if (money && f.overArea) {
    return { code: 'budgetOver', subject: f.overArea, n: 0, due: null, late: false, section: 'budget' };
  }
  if (money && f.budgetLines === 0 && f.budgetTarget !== null && within(NEEDS_BUDGET_WITHIN)) {
    return none('budgetEmpty', 'budget');
  }

  /* ── an event with nothing on it at all ─────────────────────────────────
     Before the board, because a couple who has done nothing needs somewhere
     to begin rather than a suggestion to save photographs. */
  const nothingAtAll = open.length === 0 && f.guestsInvited === 0
    && f.budgetLines === 0 && f.payments.length === 0 && f.boardImages === 0;
  if (nothingAtAll) return none('start', 'tasks');

  /* ── the one that is only ever a suggestion ─────────────────────────────*/
  if (f.can('moodboard') && f.boardImages === 0
      && (f.daysLeft === null || f.daysLeft >= BOARD_WORTH_IT_FROM)) {
    return none('boardEmpty', 'board');
  }

  /* Everything that could be chased is chased. Said plainly rather than by
     showing the least important thing left, which is how a screen teaches
     somebody to stop reading it. */
  return none('clear', 'tasks');
}
