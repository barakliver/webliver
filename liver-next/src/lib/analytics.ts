/**
 * The numbers a producer runs a business on.
 *
 * Pure arithmetic over rows that were already fetched, for the same reason the
 * gap rules are: these are judgements about a business, and a judgement that
 * can only be exercised by standing up a database and six tables is a
 * judgement nobody checks.
 *
 * Two rules run through all of it. Nothing is invented from a small sample: a
 * conversion rate off three leads is noise wearing a percentage sign, so a
 * figure with too little behind it comes back null and the screen says so
 * rather than drawing a confident chart. And every rate carries the counts it
 * came from, because "forty percent" and "two out of five" are the same number
 * and only one of them can be argued with.
 */

import { isPastDue } from './clock.ts';
export type LeadRow = {
  id: string;
  status: 'new' | 'contacted' | 'meeting' | 'won' | 'lost' | string;
  source: string;
  created_at: string;
};

export type CallRow = { lead_id: string | null; created_at: string };
export type ContractRow = { client_id: string; signed_at: string | null };
export type PaymentRow = { amount: number | null; due_on: string | null; paid: boolean };
export type TaskRow = { due_on: string | null; done: boolean };

/** A step of the funnel, with the count under it always in reach. */
export type Step = { key: string; count: number; /** of the step before it */ rate: number | null };

export type Funnel = { steps: Step[]; total: number };

/** Below this, a percentage is decoration. Five is not a statistical
 *  threshold, it is the point at which a producer stops reading a rate as a
 *  fact about their business. */
const ENOUGH = 5;

const rate = (part: number, whole: number): number | null =>
  whole < ENOUGH ? null : Math.round((part / whole) * 1000) / 10;

/**
 * Enquiry to signed, one step at a time.
 *
 * Statuses are cumulative rather than exclusive: an enquiry that was won was
 * also contacted, whether or not anybody moved it through the middle states.
 * Counting them exclusively is what produces a funnel where more people signed
 * than were ever spoken to.
 */
export function funnelOf(leads: LeadRow[], calls: CallRow[]): Funnel {
  const total = leads.length;
  const withCall = new Set(calls.map((c) => c.lead_id).filter(Boolean));

  /* A logged call is contact, whether or not anybody remembered to move the
     status afterwards. Reading only the status is what lets a funnel show
     more meetings than conversations. */
  const spokeTo = (l: LeadRow) => l.status !== 'new' || withCall.has(l.id);
  const sat = (l: LeadRow) => l.status === 'meeting' || l.status === 'won' || withCall.has(l.id);

  const reached = leads.filter(spokeTo).length;
  const met = leads.filter(sat).length;
  const won = leads.filter((l) => l.status === 'won').length;

  return {
    total,
    steps: [
      { key: 'leads', count: total, rate: null },
      { key: 'contacted', count: reached, rate: rate(reached, total) },
      { key: 'meeting', count: met, rate: rate(met, reached) },
      { key: 'won', count: won, rate: rate(won, met) },
    ],
  };
}

/** Which channels actually bring work, rather than which bring volume. A
 *  source with one enquiry and one signing is not a hundred percent, it is one
 *  enquiry, and the screen has to be able to tell the two apart. */
export type SourceRow = { source: string; leads: number; won: number; rate: number | null };

export function bySource(leads: LeadRow[]): SourceRow[] {
  const groups = new Map<string, { leads: number; won: number }>();
  for (const l of leads) {
    const key = l.source || 'unknown';
    const g = groups.get(key) ?? { leads: 0, won: 0 };
    g.leads += 1;
    if (l.status === 'won') g.won += 1;
    groups.set(key, g);
  }
  return [...groups.entries()]
    .map(([source, g]) => ({ source, leads: g.leads, won: g.won, rate: rate(g.won, g.leads) }))
    .sort((a, b) => b.leads - a.leads);
}

/**
 * How long an enquiry waits before anybody answers it.
 *
 * The median rather than the mean, and it matters here more than usual: one
 * enquiry answered a fortnight late drags an average into uselessness while
 * the median keeps saying what a normal Tuesday looks like.
 *
 * Only leads that were actually answered are counted. Including the unanswered
 * ones as though they were slow would mix two different problems, and the
 * second one has its own number below.
 */
export type Response = { medianHours: number | null; answered: number; waiting: number };

export function responseTime(leads: LeadRow[], calls: CallRow[]): Response {
  const firstCall = new Map<string, number>();
  for (const c of calls) {
    if (!c.lead_id) continue;
    const at = Date.parse(c.created_at);
    if (Number.isNaN(at)) continue;
    const seen = firstCall.get(c.lead_id);
    if (seen === undefined || at < seen) firstCall.set(c.lead_id, at);
  }

  const gaps: number[] = [];
  let waiting = 0;

  for (const l of leads) {
    const created = Date.parse(l.created_at);
    if (Number.isNaN(created)) continue;

    const answered = firstCall.get(l.id);
    if (answered !== undefined && answered >= created) {
      gaps.push((answered - created) / 3_600_000);
    } else if (l.status === 'new') {
      waiting += 1;
    }
  }

  return { medianHours: median(gaps), answered: gaps.length, waiting };
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  const m = s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  return Math.round(m * 10) / 10;
}

/**
 * Money in, money promised, money late.
 *
 * Three numbers rather than one, because they answer three different
 * questions: what has arrived, what is still coming, and what should have
 * arrived and has not. A single "outstanding" figure hides the third inside
 * the second, and the third is the only one that needs doing something about
 * today.
 */
export type Cash = { collected: number; due: number; overdue: number; overdueCount: number };

export function cashOf(payments: PaymentRow[], today = new Date()): Cash {
  /* Late where the event is, which is the same question the instalment row
     on the event's own screen asks. They used to answer it from two different
     clocks, so the headline count of overdue payments could disagree with the
     rows a producer saw when they went looking for them. */
  const isLate = (due: string | null) => isPastDue(due, today);

  const amount = (p: PaymentRow) => Number(p.amount) || 0;
  const unpaid = payments.filter((p) => !p.paid);
  const late = unpaid.filter((p) => isLate(p.due_on));

  return {
    collected: Math.round(payments.filter((p) => p.paid).reduce((s, p) => s + amount(p), 0)),
    due: Math.round(unpaid.reduce((s, p) => s + amount(p), 0)),
    overdue: Math.round(late.reduce((s, p) => s + amount(p), 0)),
    overdueCount: late.length,
  };
}

/** Work that has slipped. Counted rather than listed, because the list already
 *  exists on every event's own screen and a second copy of it would go stale. */
export function overdueTasks(tasks: TaskRow[], today = new Date()): number {
  return tasks.filter((t) => !t.done && isPastDue(t.due_on, today)).length;
}

/** How many of the events on the books have a signed agreement behind them.
 *  The one ratio a producer should never have to work out by hand. */
export function signedShare(contracts: ContractRow[], clientCount: number): { signed: number; of: number } {
  const signed = new Set(contracts.filter((c) => c.signed_at).map((c) => c.client_id)).size;
  return { signed, of: clientCount };
}

export type ConvertedRow = { lead_id: string | null; created_at: string };

/** What became of the enquiries: how many turned into events, and how long
 *  they took to. */
export type Conversion = {
  /** Enquiries in the period. */
  leads: number;
  /** Of them, the ones an event was actually built from. */
  converted: number;
  /** As a percentage, rounded. Null when there were no enquiries, because
   *  zero out of zero is not zero per cent, it is not a rate at all. */
  rate: number | null;
  /** Days from enquiry to event, at the middle of the set. Null when nothing
   *  converted. */
  medianDays: number | null;
};

/**
 * The step the funnel could not see.
 *
 * `funnelOf` reads the status column, so a lead marked won counts as won —
 * which is a producer's opinion, recorded by hand, on a screen with a
 * dropdown. Whether an event actually exists is a different question, and
 * until events carried a reference back to the enquiry there was no way to
 * ask it. A lead marked won that produced no event is the single most
 * expensive thing to be wrong about on this screen.
 *
 * The median rather than the mean, because one enquiry that sat for a year
 * before somebody finally booked drags an average somewhere no real enquiry
 * has ever been.
 */
export function conversionOf(leads: LeadRow[], clients: ConvertedRow[]): Conversion {
  const fromLead = new Map<string, string>();
  for (const c of clients) {
    if (!c.lead_id) continue;
    /* The earliest event per lead. A lead converted twice is a bug elsewhere,
       and counting it twice here would hide that bug behind a better number. */
    const seen = fromLead.get(c.lead_id);
    if (!seen || c.created_at < seen) fromLead.set(c.lead_id, c.created_at);
  }

  const days: number[] = [];
  let converted = 0;
  for (const l of leads) {
    const at = fromLead.get(l.id);
    if (!at) continue;
    converted++;
    const gap = Math.round((new Date(at).getTime() - new Date(l.created_at).getTime()) / 86_400_000);
    /* An event dated before the enquiry it came from is a clock or an import,
       not a negative wait. */
    if (Number.isFinite(gap) && gap >= 0) days.push(gap);
  }

  days.sort((a, b) => a - b);
  const mid = days.length === 0 ? null
    : days.length % 2 === 1 ? days[(days.length - 1) / 2]
    : Math.round((days[days.length / 2 - 1] + days[days.length / 2]) / 2);

  return {
    leads: leads.length,
    converted,
    rate: leads.length === 0 ? null : Math.round((converted / leads.length) * 100),
    medianDays: mid,
  };
}
