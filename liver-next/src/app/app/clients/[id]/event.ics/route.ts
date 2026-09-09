import { NextResponse } from 'next/server';
import { requireAccount } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { buildIcs, eventInstant, type IcsEvent } from '@/lib/ics';

/** One event, plus its run sheet, for the couple's own calendar.
 *
 *  requireAccount rather than producer-only: the couple wants this more than
 *  anybody. The policies on clients and day_schedule decide what comes back,
 *  so a workspace somebody is not on produces nothing. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAccount();
  const { id } = await params;

  const sb = await supabaseServer();
  const [{ data: client }, { data: day }] = await Promise.all([
    sb.from('clients').select('display_name,event_date,venue').eq('id', id).maybeSingle(),
    sb.from('day_schedule').select('id,at_time,title,note').eq('client_id', id).order('at_time'),
  ]);

  if (!client || !client.event_date) {
    return new NextResponse('', { status: 404 });
  }

  const events: IcsEvent[] = [];
  const start = eventInstant(client.event_date, '19:00')!;
  events.push({
    uid: `event-${id}@liverproductions.com`,
    start,
    end: new Date(start.getTime() + 6 * 60 * 60 * 1000),
    summary: client.display_name,
    location: client.venue ?? '',
    alarmMinutes: 24 * 60,
  });

  /* Each run-sheet line as its own half-hour entry, so the day reads as a
     sequence on the phone rather than one long block with a note attached. */
  for (const line of day ?? []) {
    const at = eventInstant(client.event_date, String(line.at_time).slice(0, 5));
    if (!at) continue;
    events.push({
      uid: `day-${line.id}@liverproductions.com`,
      start: at,
      end: new Date(at.getTime() + 30 * 60 * 1000),
      summary: line.title,
      description: line.note ?? '',
      location: client.venue ?? '',
    });
  }

  const safe = (client.display_name || 'event').replace(/[^\p{L}\p{N} _-]/gu, '').trim();
  const ascii = /^[\x20-\x7E]+$/.test(safe) ? safe : 'event';

  return new NextResponse(buildIcs(events, client.display_name), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition':
        `attachment; filename="${ascii}.ics"; filename*=UTF-8''${encodeURIComponent(safe)}.ics`,
      'cache-control': 'no-store',
    },
  });
}
