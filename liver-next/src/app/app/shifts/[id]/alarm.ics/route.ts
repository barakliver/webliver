import { NextResponse } from 'next/server';
import { requireCrew } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { serverCopy } from '@/lib/serverLocale';
import { buildIcs, eventInstant } from '@/lib/ics';
import { fill } from '@/lib/copyText';
import { UID_HOST } from '@/lib/env';
import type { ShiftDetail } from '@/lib/crewPortal';

/** One entry at the call time with a ring before it, for the crew member's own
 *  calendar.
 *
 *  A web page cannot set an alarm on a phone, but it can hand the calendar a
 *  file with one in it, and the calendar rings with the screen off, which a
 *  tab never does. Read through `crew_my_event` like the screen it belongs to,
 *  so it can carry nothing the screen may not: the venue, the time and the
 *  role, never a fee. No call time, no file. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireCrew();
  const { id } = await params;
  const asked = Number(new URL(req.url).searchParams.get('m'));
  /* Ten minutes to twelve hours, and ninety when the number is nonsense. */
  const minutes = Number.isFinite(asked) && asked >= 10 && asked <= 720 ? Math.round(asked) : 90;

  const sb = await supabaseServer();
  const { data } = await sb.rpc('crew_my_event', { p_client: id });
  const detail = data as ShiftDetail | null;
  const date = detail?.event.date?.slice(0, 10);
  const call = detail?.mine.callTime?.slice(0, 5);
  const start = date && call ? eventInstant(date, call) : null;
  if (!detail || !start) return new NextResponse('', { status: 404 });

  const ui = await serverCopy();
  const summary = fill(ui.crew.shiftAlarmSummary, { name: detail.event.name });
  const body = buildIcs([{
    uid: `shift-${id}@${UID_HOST}`,
    start,
    end: new Date(start.getTime() + 6 * 60 * 60 * 1000),
    summary,
    description: detail.mine.role || '',
    location: detail.event.venue || '',
    alarmMinutes: minutes,
  }], summary);

  return new NextResponse(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="shift.ics"',
      'cache-control': 'no-store',
    },
  });
}
