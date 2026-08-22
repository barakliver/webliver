import { NextResponse } from 'next/server';
import { getSupabaseAnonClient } from '@/lib/supabase/server';
import { buildIcs } from '@/lib/domain/timeline';
import type { CalendarFeedPayload } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

/**
 * Calendar feed, served over `webcal://` so Apple Calendar, Google Calendar and
 * Outlook subscribe to it. Subscribing means the event updates in place when
 * the date or venue changes, instead of leaving a stale copy in the calendar.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const supabase = getSupabaseAnonClient();
  const { data, error } = await supabase.rpc('calendar_feed', { p_token: token });

  if (error || !data) {
    return new NextResponse('Calendar not found', { status: 404 });
  }

  const feed = data as CalendarFeedPayload;
  const ics = buildIcs({ feed, uid: `liver-${token}@liver-productions` });

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="event.ics"',
      // Subscribed clients re-poll; a short cache keeps edits visible quickly.
      'Cache-Control': 'public, max-age=900, must-revalidate',
    },
  });
}
