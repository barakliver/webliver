import { NextResponse } from 'next/server';
import { requireLiveProducer } from '@/lib/auth';
import { supabaseServer } from '@/lib/supabase/server';
import { getCalendar } from '@/lib/calendar';
import { buildIcs, eventInstant, type IcsEvent } from '@/lib/ics';
import { PLATFORM_HOST } from '@/lib/env';
import { site } from '@/content/site';

/** The producer's whole diary, subscribable from a phone.
 *
 *  Events get a real time because they have one; tasks and payments are dates
 *  rather than appointments and are written as whole-day entries, which is how
 *  a calendar shows something due rather than something happening. */
export async function GET() {
  await requireLiveProducer();
  const sb = await supabaseServer();
  const items = await getCalendar(sb);

  const events: IcsEvent[] = items.map((i) => {
    if (i.kind === 'event') {
      /* An evening wedding: doors at 19:00, running past midnight. Nobody has
         entered a time yet, so this is the shape of the day rather than a
         claim about it — and it is what makes the entry look like a wedding
         in a week view instead of a dot at midnight. */
      const start = eventInstant(i.date, '19:00')!;
      const end = new Date(start.getTime() + 6 * 60 * 60 * 1000);
      return {
        uid: `${i.id}@${PLATFORM_HOST}`,
        start, end,
        summary: i.title,
        description: i.detail,
        location: i.detail.split(' · ')[0] ?? '',
        alarmMinutes: 24 * 60,
      };
    }
    return {
      uid: `${i.id}@${PLATFORM_HOST}`,
      start: i.date,
      allDay: true,
      summary: i.kind === 'payment'
        ? `${i.title} · ${i.detail}${i.amount ? ` · ₪${Math.round(i.amount).toLocaleString('he-IL')}` : ''}`
        : `${i.title} · ${i.detail}`,
      description: i.done ? 'הושלם' : '',
    };
  });

  return new NextResponse(buildIcs(events, site.brand), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': 'attachment; filename="liver-productions.ics"',
      'cache-control': 'no-store',
    },
  });
}
