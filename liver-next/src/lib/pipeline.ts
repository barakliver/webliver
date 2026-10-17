/**
 * The pipeline, read off the cards.
 *
 * Nothing here is stored: the columns are the statuses the row already
 * carries, "unanswered" is a card that has sat in `new` past the line the
 * brief draws, and the three figures at the top are counted from the same
 * rows the board draws. Pure, so the test can set the clock, and so the
 * board and the morning digest cannot disagree about who is waiting.
 */

export const PIPELINE = ['new', 'contacted', 'meeting', 'proposal_sent', 'won', 'nurture', 'lost'] as const;
export type Stage = (typeof PIPELINE)[number];

export type BoardLead = {
  id: string;
  full_name: string;
  partner_name?: string | null;
  phone: string;
  email: string;
  event_date: string | null;
  guest_count: number | null;
  source: string;
  status: string;
  score?: number | null;
  summary?: string | null;
  created_at: string;
  first_response_at?: string | null;
  next_action?: string | null;
  next_action_at?: string | null;
  location?: string | null;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

/** Two hours in `new` is the line the brief draws for "nobody answered". */
export const UNANSWERED_AFTER_MS = 2 * HOUR;

export const isStage = (s: string): s is Stage => (PIPELINE as readonly string[]).includes(s);

export function isUnanswered(lead: Pick<BoardLead, 'status' | 'created_at' | 'first_response_at'>, now: number): boolean {
  if (lead.status !== 'new' || lead.first_response_at) return false;
  return now - new Date(lead.created_at).getTime() > UNANSWERED_AFTER_MS;
}

/** Cards by column, in the pipeline's order, newest first inside each. */
export function byStage(leads: BoardLead[]): Record<Stage, BoardLead[]> {
  const out = Object.fromEntries(PIPELINE.map((s) => [s, [] as BoardLead[]])) as Record<Stage, BoardLead[]>;
  for (const l of leads) {
    const s = isStage(l.status) ? l.status : 'new';
    out[s].push(l);
  }
  for (const s of PIPELINE) out[s].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return out;
}

export type Filter = { source?: string; minScore?: number; unanswered?: boolean };

export function filterLeads(leads: BoardLead[], f: Filter, now: number): BoardLead[] {
  return leads.filter((l) => {
    if (f.source && l.source !== f.source) return false;
    if (f.minScore && (l.score ?? 0) < f.minScore) return false;
    if (f.unanswered && !isUnanswered(l, now)) return false;
    return true;
  });
}

export type Stats = {
  /** Arrived in the last seven days. */
  newThisWeek: number;
  /** Of everything that arrived in the last ninety days and is not spam,
   *  the share that reached a meeting or further. Null under five cards:
   *  a percentage of three is a coin toss dressed up. */
  toMeeting: number | null;
  /** Median hours from arrival to first response, over the last ninety
   *  days. Null when fewer than three were answered. */
  responseHours: number | null;
  unanswered: number;
};

const PAST_MEETING = new Set<string>(['meeting', 'proposal_sent', 'won']);

export function pipelineStats(leads: BoardLead[], now: number): Stats {
  const week = leads.filter((l) => now - new Date(l.created_at).getTime() < 7 * DAY).length;

  const recent = leads.filter((l) => now - new Date(l.created_at).getTime() < 90 * DAY);
  const real = recent.filter((l) => l.status !== 'lost' || (l.score ?? 1) > 0);
  const met = real.filter((l) => PAST_MEETING.has(l.status)).length;
  const toMeeting = real.length >= 5 ? Math.round((100 * met) / real.length) : null;

  const hours = recent
    .filter((l) => l.first_response_at)
    .map((l) => (new Date(l.first_response_at as string).getTime() - new Date(l.created_at).getTime()) / HOUR)
    .filter((h) => Number.isFinite(h) && h >= 0)
    .sort((a, b) => a - b);
  const responseHours = hours.length >= 3
    ? Math.round(hours[Math.floor(hours.length / 2)] * 10) / 10
    : null;

  return {
    newThisWeek: week,
    toMeeting,
    responseHours,
    unanswered: leads.filter((l) => isUnanswered(l, now)).length,
  };
}

/** The distinct sources on the board, for the filter, most common first. */
export function sourcesOf(leads: BoardLead[]): string[] {
  const n = new Map<string, number>();
  for (const l of leads) n.set(l.source, (n.get(l.source) ?? 0) + 1);
  return [...n.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}

/** How long ago, as a unit and a count, for the copy to word. */
export function ago(iso: string, now: number): { unit: 'minutes' | 'hours' | 'days'; n: number } {
  const ms = Math.max(0, now - new Date(iso).getTime());
  if (ms < HOUR) return { unit: 'minutes', n: Math.max(1, Math.round(ms / 60_000)) };
  if (ms < DAY) return { unit: 'hours', n: Math.round(ms / HOUR) };
  return { unit: 'days', n: Math.round(ms / DAY) };
}
