import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase/public';
import { buildIcs, eventInstant } from '@/lib/ics';
import { PLATFORM_HOST } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Row = {
  event_name: string; event_date: string | null; venue: string | null;
  moments: { at?: string; title?: string }[] | null;
};

/** "Add to calendar" on the guests' page: one entry, the evening itself.
 *
 *  Starts at the first key moment when the schedule has one and at seven
 *  otherwise, runs six hours, and reminds the day before. The same shape the
 *  producer's own calendar gives an event, because it is the same evening. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const gone = () => new NextResponse('not found', { status: 404 });
  if (!/^[a-f0-9]{32}$/.test(token)) return gone();

  const { data, error } = await supabasePublic().rpc('guest_site', { p_token: token });
  if (error) { console.error('[guest site] ics lookup failed', error); return gone(); }
  const row = (Array.isArray(data) ? data[0] : data) as Row | null;
  if (!row || !row.event_date) return gone();

  const first = (row.moments ?? []).map((m) => m.at).find((a): a is string => typeof a === 'string');
  const start = eventInstant(row.event_date, first ? first.slice(0, 5) : '19:00');
  if (!start) return gone();

  const ics = buildIcs([{
    uid: `guest-${token}@${PLATFORM_HOST}`,
    start,
    end: new Date(start.getTime() + 6 * 60 * 60 * 1000),
    summary: row.event_name,
    location: row.venue ?? '',
    alarmMinutes: 24 * 60,
  }], row.event_name);

  return new NextResponse(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="event.ics"',
      'cache-control': 'no-store',
    },
  });
}
