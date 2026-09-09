/* ── Calendar files that land at the right hour ────────────────────────────
   A wedding at 19:00 has to arrive in somebody's phone as 19:00. That sounds
   trivial and is the part these files usually get wrong.

   The old app built its ICS in the browser: `new Date('2026-09-01T19:00')`
   parses in whatever zone the machine is set to, then `toISOString()` turns it
   into UTC. On a producer's laptop in Israel that is right by luck. Generated
   on a server, which is where this now runs and which is set to UTC, the same
   line makes 19:00 mean 19:00 UTC and the wedding shows up at ten at night.

   So the wall time is converted using the event's real zone, with the offset
   looked up for that specific date — which is what makes a March wedding and a
   June wedding differ by an hour, and why hard-coding +02:00 or +03:00 is
   wrong twice a year.                                                       */

export const EVENT_TZ = 'Asia/Jerusalem';

/** What the clock in `tz` reads at a given instant, minus the instant itself:
 *  the zone's offset there, in milliseconds. */
function offsetAt(utcMs: number, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date(utcMs));

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  const asIfUtc = Date.UTC(
    get('year'), get('month') - 1, get('day'),
    get('hour') % 24, get('minute'), get('second')
  );
  return asIfUtc - utcMs;
}

/**
 * The instant at which the clock in `tz` reads the given wall time.
 *
 * Two passes, not one. The offset has to be looked up at some instant, and the
 * only instant available to start with is the wrong one — so the first pass
 * gets close and the second corrects it. That matters exactly on the two
 * nights a year when the clocks move: a first guess landing on the far side of
 * a transition would otherwise be an hour out.
 */
export function wallToUtc(
  y: number, mo: number, d: number, h: number, mi: number, tz = EVENT_TZ
): Date {
  const wall = Date.UTC(y, mo - 1, d, h, mi, 0);
  let utc = wall - offsetAt(wall, tz);
  utc = wall - offsetAt(utc, tz);
  return new Date(utc);
}

/** "2026-09-01" + "19:00" as a real instant in the event's own timezone. */
export function eventInstant(dateIso: string, timeHhmm: string, tz = EVENT_TZ): Date | null {
  const dm = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!dm) return null;
  const tm = /^(\d{2}):(\d{2})/.exec(timeHhmm || '00:00');
  if (!tm) return null;
  return wallToUtc(+dm[1], +dm[2], +dm[3], +tm[1], +tm[2], tz);
}

/** UTC stamp in the form iCalendar wants: 20260901T160000Z */
export const stamp = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** A whole-day value: 20260901 */
export const dayStamp = (dateIso: string): string => dateIso.replace(/-/g, '');

/** Backslash, semicolon and comma are separators in this format, and a raw
 *  newline ends the property. All four have to be escaped or the file is not
 *  merely wrong, it fails to parse. */
export const escapeText = (s: string): string =>
  String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');

/**
 * Folds a property line to 75 octets, as the format requires.
 *
 * Octets, not characters — which is the whole difficulty here. Hebrew is two
 * bytes per letter in UTF-8, so a line that looks comfortably short is over
 * the limit, and a naive fold by character count splits in the middle of a
 * letter and produces mojibake in the middle of a wedding's name. So the
 * measure is bytes and the split points are whole code points.
 */
export function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = 75;

  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > limit) {
      out.push(current);
      current = ch;
      bytes = size;
      /* Continuation lines carry a leading space that counts toward the 75. */
      limit = 74;
    } else {
      current += ch;
      bytes += size;
    }
  }
  out.push(current);
  return out.join('\r\n ');
}

export type IcsEvent = {
  uid: string;
  start: Date | string;
  /** Omit for a whole-day event; `start` is then a date string. */
  end?: Date | string;
  allDay?: boolean;
  summary: string;
  description?: string;
  location?: string;
  /** Minutes before the start to alarm. Omitted means no alarm. */
  alarmMinutes?: number;
};

function eventBlock(e: IcsEvent, now: string): string[] {
  const lines: string[] = ['BEGIN:VEVENT', `UID:${e.uid}`, `DTSTAMP:${now}`];

  if (e.allDay) {
    /* DTEND on a whole-day event is exclusive, so a one-day event ends on the
       following date. Getting this wrong is why so many imported all-day
       events show up spanning two days. */
    const startIso = String(e.start);
    const next = new Date(startIso + 'T00:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    lines.push(`DTSTART;VALUE=DATE:${dayStamp(startIso)}`);
    lines.push(`DTEND;VALUE=DATE:${dayStamp(next.toISOString().slice(0, 10))}`);
  } else {
    lines.push(`DTSTART:${stamp(e.start as Date)}`);
    if (e.end) lines.push(`DTEND:${stamp(e.end as Date)}`);
  }

  lines.push(`SUMMARY:${escapeText(e.summary)}`);
  if (e.description) lines.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.location) lines.push(`LOCATION:${escapeText(e.location)}`);

  if (e.alarmMinutes && e.alarmMinutes > 0) {
    lines.push(
      'BEGIN:VALARM', 'ACTION:DISPLAY',
      `DESCRIPTION:${escapeText(e.summary)}`,
      `TRIGGER:-PT${Math.round(e.alarmMinutes)}M`,
      'END:VALARM'
    );
  }

  lines.push('END:VEVENT');
  return lines;
}

/** A complete calendar file. CRLF throughout, because a bare newline is not
 *  what the format says and some clients genuinely refuse it. */
export function buildIcs(events: IcsEvent[], calendarName: string): string {
  const now = stamp(new Date());
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liver Productions//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeText(calendarName)}`,
    `X-WR-TIMEZONE:${EVENT_TZ}`,
    ...events.flatMap((e) => eventBlock(e, now)),
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}
