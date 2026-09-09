/**
 * The run sheet, read on the evening rather than while planning it.
 *
 * The same forty lines are a different document once the event starts. Nobody
 * reads them top to bottom: the questions are what is happening now, what is
 * next, and what was supposed to be finished and is not. So the arithmetic
 * here is entirely about one moment in time, and it lives apart from the
 * planning helpers because it answers a different question about the same
 * rows.
 *
 * It is pure, and takes the clock as an argument, because a screen that
 * behaves differently at 23:50 than at 00:10 is a screen nobody can check by
 * looking at it.
 */

import { crossesMidnight, eventMinutes, spanOf, type Timed } from './runsheet.ts';

export type Line = Timed & {
  id: string;
  title: string;
  duration_min?: number | null;
  done_at?: string | null;
  /** Worth a countdown. A run sheet has forty lines and an alert before every
   *  one of them is an alert before none. */
  key_moment?: boolean | null;
};

/** Where a line stands right now.
 *
 *  `late` is the only one that asks for anything. It means the line had a
 *  stated or inferred end, that end has passed, and nobody ticked it — which
 *  on the evening is either a thing that slipped or a tick that was missed,
 *  and both are worth a glance. */
export type LineState = 'done' | 'now' | 'late' | 'soon' | 'later';

export type Placed = {
  line: Line;
  state: LineState;
  /** Minutes until it starts. Negative once it has started, null when the
   *  clock is not running against this schedule at all. */
  inMinutes: number | null;
};

/** Anything starting within this is worth surfacing as about to happen. */
const SOON = 30;

/** Minutes into the event's own day, so a 00:30 line on a schedule that runs
 *  past midnight is later than 23:00 and not seventeen hours earlier. */
export function clockMinutes(now: Date, wraps: boolean): number {
  const m = now.getHours() * 60 + now.getMinutes();
  return wraps && m < 6 * 60 ? m + 24 * 60 : m;
}

/**
 * Every line placed against the clock.
 *
 * `live` is false when the evening is not tonight. Then nothing is now, late
 * or soon: the same screen opened three weeks early would otherwise show every
 * line of the wedding as overdue, which is both alarming and useless. A line
 * already ticked stays ticked either way, since that is a fact about the line
 * and not about the clock.
 */
export function placeLines(items: Line[], now: Date, live: boolean): Placed[] {
  const wraps = crossesMidnight(items.map((i) => i.at_time));
  const ordered = [...items].sort(
    (a, b) => eventMinutes(a.at_time, wraps) - eventMinutes(b.at_time, wraps)
  );
  const nowM = clockMinutes(now, wraps);

  return ordered.map((line, i) => {
    if (line.done_at) return { line, state: 'done' as const, inMinutes: null };
    if (!live) return { line, state: 'later' as const, inMinutes: null };

    const start = eventMinutes(line.at_time, wraps);
    const span = spanOf(ordered, i).minutes;
    const end = span === null ? null : start + span;
    const inMinutes = start - nowM;

    /* A line with no end is the last of the night. It becomes "now" when its
       time arrives and stays there, because the honest answer to "is the
       pack-down over" is that only the person doing it knows. */
    if (start <= nowM && (end === null || nowM < end)) {
      return { line, state: 'now' as const, inMinutes };
    }
    if (end !== null && nowM >= end) return { line, state: 'late' as const, inMinutes };
    if (inMinutes <= SOON) return { line, state: 'soon' as const, inMinutes };
    return { line, state: 'later' as const, inMinutes };
  });
}

/** The two lines the evening is actually run from. Both can be missing, before
 *  the first line and after the last, and neither absence is an error. */
export function focus(placed: Placed[]): { now: Placed | null; next: Placed | null } {
  const now = placed.find((p) => p.state === 'now') ?? null;
  const next = placed.find((p) => p.state === 'soon' || (p.inMinutes !== null && p.inMinutes > 0)) ?? null;
  return { now, next };
}

/** "בעוד 20 דק׳", "עכשיו", "לפני שעה". Relative, because on the evening nobody
 *  subtracts the current time from a printed one. */
export function relative(minutes: number): string {
  if (minutes === 0) return 'עכשיו';
  const abs = Math.abs(minutes);
  const unit = abs < 60
    ? `${abs} דק׳`
    : abs < 120
      ? 'שעה'
      : `${Math.floor(abs / 60)} שעות`;
  return minutes > 0 ? `בעוד ${unit}` : `לפני ${unit}`;
}

/**
 * Everyone who has to be somewhere, on one list.
 *
 * Crew and suppliers are two tables and one question. Merging them here rather
 * than showing two panels is the whole point of the screen: at 16:40 the
 * producer wants to know who is due in the next twenty minutes, not who is due
 * from each table.
 *
 * People without a call time sort last rather than first. A blank is "nobody
 * said", and an empty time sorting to the top of the list puts the unknowns
 * where the earliest arrivals belong.
 */
export type Caller = {
  id: string;
  name: string;
  role: string;
  phone: string;
  call_time: string | null;
  kind: 'crew' | 'vendor';
  arrived_at?: string | null;
};

export function callSheet(crew: Caller[], vendors: Caller[]): Caller[] {
  const all = [...crew, ...vendors];
  const wraps = crossesMidnight(all.map((c) => c.call_time ?? '').filter(Boolean));
  return all.sort((a, b) => {
    if (!a.call_time && !b.call_time) return a.name.localeCompare(b.name, 'he');
    if (!a.call_time) return 1;
    if (!b.call_time) return -1;
    return eventMinutes(a.call_time, wraps) - eventMinutes(b.call_time, wraps);
  });
}

/** Who is due within the next stretch, so the screen can say "these three
 *  people should be walking in" without the producer reading the whole list. */
export function dueSoon(sheet: Caller[], now: Date, live: boolean, within = 45): Caller[] {
  if (!live) return [];
  const wraps = crossesMidnight(sheet.map((c) => c.call_time ?? '').filter(Boolean));
  const nowM = clockMinutes(now, wraps);
  return sheet.filter((c) => {
    if (!c.call_time) return false;
    const at = eventMinutes(c.call_time, wraps);
    return at >= nowM && at - nowM <= within;
  });
}

/** True when the event is happening on the day the screen is being looked at.
 *  A date-only comparison: the run sheet's own times decide the rest. */
export function isToday(eventDate: string | null, now: Date): boolean {
  if (!eventDate) return false;
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return false;
  return d.getUTCFullYear() === now.getFullYear()
      && d.getUTCMonth() === now.getMonth()
      && d.getUTCDate() === now.getDate();
}


/**
 * The moment worth interrupting somebody for.
 *
 * Only lines the producer marked, only within the window, and only one at a
 * time: two banners shouting at once is the state in which both get dismissed
 * without being read. The nearest one wins, because it is the one about to
 * happen.
 *
 * A line already ticked never alerts. The chuppah that started early should
 * not be counted down to.
 */
export const ALERT_WINDOW = 10;

export function pendingAlert(placed: Placed[], within = ALERT_WINDOW): Placed | null {
  const due = placed.filter(
    (p) =>
      p.line.key_moment
      && p.state !== 'done'
      && p.inMinutes !== null
      && p.inMinutes >= 0
      && p.inMinutes <= within,
  );
  if (due.length === 0) return null;
  return due.reduce((a, b) => ((a.inMinutes ?? 0) <= (b.inMinutes ?? 0) ? a : b));
}

/** Who was due and is not here. The list the emergency button is aimed at, and
 *  the one worth a red count at the top of the screen.
 *
 *  Somebody with no call time cannot be late, which is a real distinction: the
 *  photographer who was told "after the ceremony" is not missing at 16:00. */
export function missing(sheet: Caller[], now: Date, live: boolean): Caller[] {
  if (!live) return [];
  const wraps = crossesMidnight(sheet.map((c) => c.call_time ?? '').filter(Boolean));
  const nowM = clockMinutes(now, wraps);
  return sheet.filter((c) => {
    if (c.arrived_at || !c.call_time) return false;
    return eventMinutes(c.call_time, wraps) < nowM;
  });
}

/** How the evening is going, in one line: here, still coming, late. */
export function headcount(sheet: Caller[], now: Date, live: boolean) {
  const here = sheet.filter((c) => c.arrived_at).length;
  return { here, of: sheet.length, late: missing(sheet, now, live).length };
}
