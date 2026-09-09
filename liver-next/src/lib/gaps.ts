/**
 * When a missing thing stops being early and starts being late.
 *
 * Split out from the query that feeds it so it can be checked. These rules are
 * the judgement the board exists to make, and judgement that can only be
 * exercised by standing up a database, a producer and six tables is judgement
 * nobody checks. Everything here is arithmetic on numbers, so it can be, and
 * `npm test` does.
 */

export type GapLevel = 'now' | 'soon';

export type Gap = {
  code: string;
  label: string;
  level: GapLevel;
};

/* Thresholds, named rather than sprinkled through the checks. These are the
   points at which a missing thing stops being early and starts being late. */
const NEEDS_TASKS_WITHIN = 120;
const NEEDS_GUESTS_WITHIN = 90;
const NEEDS_SCHEDULE_WITHIN = 30;
/* A contract is the one gap that is worse the earlier it is ignored: work
   starts, money moves, and the thing that says what was agreed is a
   conversation somebody half remembers. So it is raised early and turns urgent
   long before the event. */
const NEEDS_CONTRACT_WITHIN = 150;
const CONTRACT_URGENT_WITHIN = 45;

/** What one event is missing, given plain facts about it.
 *
 *  Pure on purpose. These rules are the judgement the board exists to make —
 *  when an empty guest list stops being early and starts being late — and
 *  judgement that can only be exercised by standing up a database, a producer
 *  and six tables is judgement nobody checks. Everything here is arithmetic on
 *  numbers, so it can be. */
export type EventFacts = {
  hasDate: boolean;
  /** Whole days until the event; negative once it has passed, null with no date. */
  daysLeft: number | null;
  archived: boolean;
  tasks: number;
  overdueTasks: number;
  guests: number;
  scheduleItems: number;
  invites: number;
  joinedInvites: number;
  overdueMoney: number;
  contracts: number;
  signedContracts: number;
};

export function assess(f: EventFacts): { gaps: Gap[]; needsClosing: boolean } {
  const passed = f.daysLeft !== null && f.daysLeft < 0;
  const needsClosing = passed && !f.archived;
  const within = (d: number) => f.daysLeft !== null && f.daysLeft >= 0 && f.daysLeft <= d;

  const gaps: Gap[] = [];

  /* Ordered by what it costs to ignore, because the first chip is the one that
     gets read. */
  if (needsClosing) gaps.push({ code: 'closing', label: 'האירוע עבר, לסגור תיק', level: 'now' });
  if (f.overdueTasks > 0) {
    gaps.push({
      code: 'task_overdue',
      label: f.overdueTasks === 1 ? 'משימה באיחור' : `${f.overdueTasks} משימות באיחור`,
      level: 'now',
    });
  }
  if (f.overdueMoney > 0) gaps.push({ code: 'pay_overdue', label: 'תשלום באיחור', level: 'now' });
  if (!f.hasDate) gaps.push({ code: 'no_date', label: 'אין תאריך', level: 'soon' });

  if (f.invites === 0) {
    /* Before the event this is the thing blocking everything else — the couple
       cannot do their half of the work. Afterwards it is only untidy. */
    gaps.push({ code: 'no_couple', label: 'הזוג עוד לא צורף', level: passed ? 'soon' : 'now' });
  } else if (f.joinedInvites === 0) {
    gaps.push({ code: 'not_joined', label: 'הזוג עוד לא נכנס', level: 'soon' });
  }

  if (!passed && f.tasks === 0 && (within(NEEDS_TASKS_WITHIN) || !f.hasDate)) {
    gaps.push({ code: 'no_tasks', label: 'אין משימות', level: 'soon' });
  }
  if (!passed && f.guests === 0 && within(NEEDS_GUESTS_WITHIN)) {
    gaps.push({ code: 'no_guests', label: 'אין רשימת אורחים', level: within(45) ? 'now' : 'soon' });
  }
  if (!passed && f.scheduleItems === 0 && within(NEEDS_SCHEDULE_WITHIN)) {
    gaps.push({ code: 'no_schedule', label: 'אין לוז ליום האירוע', level: 'now' });
  }

  /* Two different problems wearing one word. Nothing sent at all is a job for
     the producer; something sent and unsigned is a job for the couple, and
     telling them apart is the difference between writing a contract and making
     a phone call. */
  if (!passed && within(NEEDS_CONTRACT_WITHIN)) {
    if (f.contracts === 0) {
      gaps.push({
        code: 'no_contract',
        label: 'אין הסכם',
        level: within(CONTRACT_URGENT_WITHIN) ? 'now' : 'soon',
      });
    } else if (f.signedContracts === 0) {
      gaps.push({
        code: 'contract_unsigned',
        label: 'ההסכם לא נחתם',
        level: within(CONTRACT_URGENT_WITHIN) ? 'now' : 'soon',
      });
    }
  }

  return { gaps, needsClosing };
}
