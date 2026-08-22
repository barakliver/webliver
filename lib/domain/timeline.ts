/**
 * Day-of operations: role-filtered timelines and the calendar feed.
 *
 * Pure and dependency-free so both the PDF/print view and the webcal route can
 * share it, and so the ICS escaping rules can be unit-tested.
 */

import type { CalendarFeedPayload } from '@/lib/supabase/database.types';

export type TimelineAudience = 'all' | 'couple' | 'photo' | 'crew';

export interface TimelineEntry {
  time: string;
  title: string;
  /** Audiences this entry is relevant to. Empty or absent means everyone. */
  audiences?: TimelineAudience[];
  owner?: string;
  location?: string;
  notes?: string;
}

export const AUDIENCE_LABELS: Record<TimelineAudience, { he: string; en: string }> = {
  all: { he: 'לוח זמנים מלא', en: 'Full timeline' },
  couple: { he: 'הזוג והמשפחה', en: 'Couple & family' },
  photo: { he: 'צוות הצילום', en: 'Photography team' },
  crew: { he: 'צוות טכני והפקה', en: 'Technical & production crew' },
};

/** Keyword fallback for entries that carry no explicit audience tags. */
const KEYWORDS: Record<Exclude<TimelineAudience, 'all'>, RegExp> = {
  couple:
    /(חופה|כלה|חתן|משפחה|איפור|שיער|קבלת פנים|ריקוד|סלואו|ברכות|bride|groom|family|ceremony|reception|first dance|makeup|hair|speech)/i,
  photo: /(צילום|צלם|מגנט|וידאו|סטילס|photo|video|magnet|shoot|portrait)/i,
  crew: /(סאונד|תאורה|במה|גנרטור|הגברה|ספק|פריקה|הקמה|טכני|sound|light|stage|rig|generator|vendor|load.?in|setup|crew)/i,
};

export function entryMatchesAudience(entry: TimelineEntry, audience: TimelineAudience): boolean {
  if (audience === 'all') return true;
  if (entry.audiences && entry.audiences.length > 0) {
    return entry.audiences.includes(audience) || entry.audiences.includes('all');
  }
  const haystack = `${entry.title} ${entry.owner ?? ''} ${entry.notes ?? ''}`;
  return KEYWORDS[audience].test(haystack);
}

/** Filters and sorts a timeline for one audience. */
export function filterTimeline(
  entries: TimelineEntry[],
  audience: TimelineAudience,
): TimelineEntry[] {
  return entries
    .filter((entry) => entryMatchesAudience(entry, audience))
    .slice()
    .sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
}

/** "19:30" -> 1170. Unparseable times sort last rather than throwing. */
export function toMinutes(time: string): number {
  const match = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
  if (!match) return Number.MAX_SAFE_INTEGER;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return Number.MAX_SAFE_INTEGER;
  return h * 60 + m;
}

// --------------------------------------------------------------------------
// ICS / webcal
// --------------------------------------------------------------------------

/** RFC 5545 §3.3.11 text escaping: backslash, semicolon, comma, newline. */
export function escapeIcsText(value: string): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\n|\r/g, '\\n');
}

/** RFC 5545 §3.1: fold content lines at 75 octets, continuing with a leading space. */
export function foldIcsLine(line: string): string {
  const encoder = new TextEncoder();
  if (encoder.encode(line).length <= 75) return line;

  const out: string[] = [];
  let current = '';
  let currentBytes = 0;

  for (const char of line) {
    const charBytes = encoder.encode(char).length;
    // Continuation lines carry a leading space, so their payload budget is 74.
    const limit = out.length === 0 ? 75 : 74;
    if (currentBytes + charBytes > limit) {
      out.push(current);
      current = char;
      currentBytes = charBytes;
    } else {
      current += char;
      currentBytes += charBytes;
    }
  }
  if (current) out.push(current);

  return out.map((part, i) => (i === 0 ? part : ` ${part}`)).join('\r\n');
}

export function toIcsUtc(date: Date): string {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

/**
 * Resolves the event window. Prefers explicit start/end; otherwise falls back
 * to the event date with a sensible default evening window.
 */
export function resolveEventWindow(feed: CalendarFeedPayload): { start: Date; end: Date } | null {
  if (feed.event_start) {
    const start = new Date(feed.event_start);
    if (!Number.isNaN(start.getTime())) {
      const end = feed.event_end ? new Date(feed.event_end) : new Date(start.getTime() + 6 * 3600_000);
      return { start, end: Number.isNaN(end.getTime()) ? new Date(start.getTime() + 6 * 3600_000) : end };
    }
  }
  if (feed.event_date) {
    // Israeli weddings run evening into the night; 19:00 local is the norm.
    const start = new Date(`${feed.event_date}T19:00:00+02:00`);
    if (!Number.isNaN(start.getTime())) {
      return { start, end: new Date(start.getTime() + 7 * 3600_000) };
    }
  }
  return null;
}

export interface BuildIcsOptions {
  feed: CalendarFeedPayload;
  uid: string;
  /** Overridden in tests for a deterministic DTSTAMP. */
  now?: Date;
}

/**
 * Builds a single-event calendar. Consumed over `webcal://` so Apple Calendar,
 * Google Calendar and Outlook subscribe rather than import — the event then
 * updates in place when the date moves.
 */
export function buildIcs({ feed, uid, now = new Date() }: BuildIcsOptions): string {
  const window = resolveEventWindow(feed);
  const location = [feed.venue_name, feed.venue_address].filter(Boolean).join(', ');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LIver Productions//Day-of//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(feed.display_name)}`,
    `X-WR-TIMEZONE:${escapeIcsText(feed.timezone || 'Asia/Jerusalem')}`,
    // Tells subscribing clients how often to re-poll the feed.
    'REFRESH-INTERVAL;VALUE=DURATION:PT12H',
    'X-PUBLISHED-TTL:PT12H',
  ];

  if (window) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${toIcsUtc(now)}`,
      `DTSTART:${toIcsUtc(window.start)}`,
      `DTEND:${toIcsUtc(window.end)}`,
      `SUMMARY:${escapeIcsText(feed.display_name)}`,
      ...(location ? [`LOCATION:${escapeIcsText(location)}`] : []),
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-P1D',
      'ACTION:DISPLAY',
      `DESCRIPTION:${escapeIcsText(feed.display_name)}`,
      'END:VALARM',
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return lines.map(foldIcsLine).join('\r\n') + '\r\n';
}

/** Milliseconds until the event, floored at zero. */
export function countdownMs(target: Date | null, from: Date = new Date()): number {
  if (!target || Number.isNaN(target.getTime())) return 0;
  return Math.max(0, target.getTime() - from.getTime());
}

export function splitCountdown(ms: number): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const totalSeconds = Math.floor(ms / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
  };
}
