import { daysBetween, dateInZone } from './clock.ts';
import type { TaskFact, PayFact } from './nextAction.ts';

/**
 * Where a couple stands, in one sentence, and the shape of the year behind it.
 *
 * The screen already answers two questions well. The countdown says how long
 * is left and the card under it says what to do next. Neither of them ever
 * says the thing a couple actually wants to hear, which is that they are
 * fine. A screen that only ever lists what is open teaches somebody that
 * opening it will produce more work, and a screen like that gets opened less
 * and less. "87 ימים" is the fear; nothing on the screen was the answer to it.
 *
 * The second half is the same gap seen from further away. Every figure on
 * that screen is about now: what is open, what is owed, who has replied.
 * There was no view of the year at all, so a couple had no way to tell a
 * crowded fortnight from a crowded wedding, and no sense of having got
 * anywhere. A couple who can see that August is closed and September holds
 * two things stops being afraid of September.
 *
 * Both halves are arithmetic over rows already in memory for the panels
 * below. No model, no second query, and a rule rather than a judgement, for
 * the reason `nextAction` gives next door: the couple has to be able to trust
 * that the screen is not making something up, and a rule is the only kind of
 * judgement anybody ever checks.
 *
 * Two decisions run through all of it.
 *
 * **Only their own things count.** A task the producer owns, overdue, is not
 * the couple being behind, and a sentence that tells them they are is a
 * sentence about work they have no button for. Payments are theirs either
 * way. The strip counts the same set as the sentence, because two figures on
 * one screen that are nearly the same thing is how a screen stops being
 * believed.
 *
 * **Only dated things are on the strip.** An undated task is open, not due,
 * and filing it under "this month" invents a deadline nobody agreed to. They
 * are counted once, in a line of their own, so nothing is quietly dropped.
 */

/* The fortnight the sentence is about. Long enough to be worth preparing for
   and short enough that "nothing in it" is a real relief rather than a
   statement about the whole year. */
const SOON = 14;
/* More than this inside the fortnight is a crowded one. Four is where the
   product's own rhythm puts it: the five opening questions, the four figures,
   the three tasks the card shows. */
const BUSY = 4;
/* Inside the last month, crowded is the ordinary shape of a wedding, and a
   screen that says "צפוף" every day for four weeks is a screen that says
   nothing. So `tight` is not said there. */
const CROWDED_FROM = 30;
/* Beyond a year the strip is not drawn and the verdict is that there is time.
   One number, two uses, so the sentence and the strip can never disagree
   about whether this couple is in the run-up. */
const A_YEAR = 365;
/* The most cells the strip will ever hold. Twelve across a phone is 26px
   each, which is a readable month label; thirteen is a bar chart. */
export const STRIP_MONTHS = 12;

export type StandingCode =
  /** Something of theirs is past its date. The only verdict that is not calm. */
  | 'behind'
  /** No date agreed yet, so nothing can be early or late. */
  | 'dateless'
  /** The wedding has happened. */
  | 'past'
  /** More than a year out and nothing late. */
  | 'early'
  /** In the run-up, and not one thing of theirs has a date on it yet. */
  | 'fresh'
  /** Nothing late, and the fortnight ahead is fuller than the rest of the year. */
  | 'tight'
  /** Nothing late, and an ordinary amount in the fortnight ahead. */
  | 'steady'
  /** Nothing late and nothing at all in the fortnight ahead. */
  | 'calm';

export type Standing = {
  code: StandingCode;
  /** Whatever the verdict counted: how many are late, or how many fall in
   *  the fortnight. Zero where it counted neither. The sentence deliberately
   *  does not print it — the card above names the one that matters and the
   *  strip below marks the month it sits in, and a third copy of the same
   *  figure is how a screen starts to feel like it is nagging. */
  n: number;
  /** Of their dated things, how many are behind them. The only figure here
   *  about what they have done rather than what is left. */
  closed: number;
  of: number;
  /** Whole calendar months to the wedding. Null with no date. */
  months: number | null;
  /** The earliest open dated thing of theirs. Lets the quiet sentence be
   *  concrete rather than merely reassuring. */
  nextOn: string | null;
  /** Whether this is good news, so the screen does not have to read the code
   *  to know which way to draw it. */
  calm: boolean;
};

export type StandingFacts = {
  /** Today where the event is, so an evening in Israel is not tomorrow. */
  today: string;
  /** Null with no date agreed, which is a real state and a common one. */
  eventDate: string | null;
  tasks: TaskFact[];
  payments: PayFact[];
  /** Whether the money module is open to this couple. A payment they cannot
   *  see must not appear in a sentence about them. */
  money: boolean;
  /** Whether their own list is open to them. */
  tasksOn: boolean;
};

/** One thing of theirs with a date on it, flattened out of two tables so the
 *  arithmetic below does not have to know which it came from. */
type Dated = { on: string; done: boolean };

/** Their dated things: their own tasks, and their payments where the money
 *  module is open. Both gates are checked here rather than at the call site,
 *  so a section switched off cannot leak into either half. */
function theirs(f: StandingFacts): Dated[] {
  const out: Dated[] = [];
  if (f.tasksOn) {
    for (const t of f.tasks) {
      if (t.owner !== 'client' || !t.due_on) continue;
      out.push({ on: dateInZone(t.due_on), done: t.done });
    }
  }
  if (f.money) {
    for (const p of f.payments) {
      if (!p.due_on) continue;
      out.push({ on: dateInZone(p.due_on), done: p.paid });
    }
  }
  return out.filter((d) => d.on !== '');
}

/** Months as one number, so a difference across a year boundary is exact and
 *  the 31st of anything cannot shift it. */
const ym = (iso: string): number => Number(iso.slice(0, 4)) * 12 + (Number(iso.slice(5, 7)) - 1);

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * The verdict.
 *
 * The ladder is ordered by what it costs to be wrong about, not by how the
 * situation feels. Being told everything is fine while a payment is overdue
 * is the one failure that would make the whole sentence worthless, so
 * `behind` is checked before anything else and before the wedding is even
 * known to be in the future: a supplier unpaid after the evening is still
 * unpaid.
 */
export function standing(f: StandingFacts): Standing {
  const items = theirs(f);
  const open = items.filter((d) => !d.done);
  const late = open.filter((d) => d.on < f.today).length;
  const ahead = open.filter((d) => d.on >= f.today).sort((a, b) => (a.on < b.on ? -1 : 1));
  const soon = ahead.filter((d) => daysBetween(f.today, d.on) <= SOON).length;

  const daysLeft = f.eventDate ? daysBetween(f.today, f.eventDate) : null;
  const base = {
    n: 0,
    closed: items.filter((d) => d.done).length,
    of: items.length,
    months: f.eventDate ? ym(f.eventDate) - ym(f.today) : null,
    nextOn: ahead[0]?.on ?? null,
  };
  const say = (code: StandingCode, n = 0): Standing =>
    ({ ...base, code, n, calm: code !== 'behind' });

  if (late > 0) return say('behind', late);
  if (f.eventDate === null) return say('dateless');
  if (daysLeft !== null && daysLeft < 0) return say('past');
  if (daysLeft !== null && daysLeft > A_YEAR) return say('early');
  if (base.of === 0) return say('fresh');
  if (soon > BUSY && (daysLeft ?? 0) > CROWDED_FROM) return say('tight', soon);
  if (soon > 0) return say('steady', soon);
  return say('calm');
}

/** One month on the strip. */
export type MonthCell = {
  /** `YYYY-MM`, sortable and unique across a year boundary. */
  key: string;
  year: number;
  /** 1 to 12, which is what a formatter wants. */
  month: number;
  /** A plain date inside the month, for whatever writes the name. The 15th
   *  rather than the 1st, so a month read in another zone cannot slip into
   *  the one before it. */
  on: string;
  /** Things of theirs dated into this month, done ones included. */
  due: number;
  /** Of those, how many are closed. */
  closed: number;
  /** Open things past their date. Every one of them is folded onto the
   *  current month rather than drawn where it fell, because a strip that
   *  grows backwards opens on a couple's own history of being behind, and
   *  late is the sentence's job and not the calendar's. */
  late: number;
  thisMonth: boolean;
  wedding: boolean;
};

export type Timeline =
  /** More than a year out, or no date. The strip is not drawn and a line
   *  says why, the same move the bingo makes under nine tasks. */
  | { kind: 'far'; months: number | null }
  /** In the window and not one dated thing to lay across it. */
  | { kind: 'bare'; months: number }
  | { kind: 'strip'; cells: MonthCell[]; undated: number }
  /** The wedding is behind them. There is no year left to draw, which is a
   *  missing object rather than a panel hiding on its own data. */
  | { kind: 'past' };

/**
 * The months from this one to the wedding's, inclusive.
 *
 * A month with nothing in it is still a cell, and that is the whole point:
 * the gap is the information. A strip that drew only the months with work in
 * them would be a strip whose spacing lies, and the thing a couple is
 * actually looking for is the empty September.
 */
export function timeline(f: StandingFacts): Timeline {
  if (f.eventDate === null) return { kind: 'far', months: null };
  /* Over when the evening is over, not when its month is: a wedding on the
     second drawn as a one cell year for the rest of October is a strip of
     the past wearing the title of the year ahead. */
  if (f.eventDate < f.today) return { kind: 'past' };
  const months = ym(f.eventDate) - ym(f.today);
  if (months >= STRIP_MONTHS) return { kind: 'far', months };

  const items = theirs(f);
  /* Nothing dated at all. Said in a sentence rather than drawn as twelve
     empty boxes, which reads as a panel that failed to load rather than as a
     year with nothing in it. */
  if (items.length === 0) return { kind: 'bare', months };

  const here = ym(f.today);
  const cells: MonthCell[] = [];
  for (let i = 0; i <= months; i += 1) {
    const at = here + i;
    const year = Math.floor(at / 12);
    const month = (at % 12) + 1;
    cells.push({
      key: `${year}-${pad(month)}`,
      year,
      month,
      on: `${year}-${pad(month)}-15`,
      due: 0,
      closed: 0,
      late: 0,
      thisMonth: i === 0,
      wedding: i === months,
    });
  }

  const at = new Map(cells.map((c) => [c.key, c]));
  for (const d of items) {
    const cell = at.get(d.on.slice(0, 7));
    if (!d.done && d.on < f.today) {
      /* Late, wherever it fell. It belongs to this month's mark. */
      cells[0].late += 1;
      continue;
    }
    if (!cell) continue;
    cell.due += 1;
    if (d.done) cell.closed += 1;
  }

  return { kind: 'strip', cells, undated: undatedCount(f) };
}

/** Open things of theirs with no date, which the strip cannot place and must
 *  not invent a place for. Counted so the figure under it can say they are
 *  there. */
function undatedCount(f: StandingFacts): number {
  let n = 0;
  if (f.tasksOn) n += f.tasks.filter((t) => t.owner === 'client' && !t.done && !t.due_on).length;
  if (f.money) n += f.payments.filter((p) => !p.paid && !p.due_on).length;
  return n;
}
