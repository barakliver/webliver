import type { Locale } from './locale.ts';
import type { PieceData } from '@/components/brand/Pieces';
import { splitNames } from '@/content/brandKit';
import { weekdayDate } from './appDates.ts';
import { formatDate, daysUntil } from './dates.ts';
import { shiftDate } from '@/content/timeline';

/** RSVPs are asked for three weeks before the day. */
const RSVP_DAYS = 21;

/**
 * What the pieces print, from what the event knows. One function for the
 * producer's tab, the couple's screen, the print sheet and the harness, so
 * the mockup and the sheet cannot disagree about a date.
 */
export function pieceDataFor(input: {
  displayName: string;
  eventDate: string | null;
  venue: string | null;
  moments: { at_time: string; title: string; key_moment?: boolean | null }[];
  tables: { name: string }[];
  siteUrl: string;
  locale: Locale;
  dateTbd: string;
}): PieceData {
  const fmt = weekdayDate(input.locale);
  /* The key moments if any were marked, else the whole running order, cut
     to what a program card can hold. */
  const marked = input.moments.filter((m) => m.key_moment);
  const key = (marked.length > 0 ? marked : input.moments).slice(0, 8);
  const first = key[0]?.at_time ?? '';
  return {
    names: splitNames(input.displayName),
    displayName: input.displayName,
    dateText: formatDate(fmt, input.eventDate, input.dateTbd),
    timeText: first ? first.slice(0, 5) : '',
    venue: input.venue?.trim() ?? '',
    rsvpByText: input.eventDate ? formatDate(fmt, shiftDate(input.eventDate, -RSVP_DAYS), '') : '',
    siteUrl: input.siteUrl,
    moments: key.map((m) => ({ at: m.at_time, title: m.title })),
    tables: input.tables.map((t) => t.name),
    daysLeft: daysUntil(input.eventDate),
  };
}
