import { NextResponse } from 'next/server';
import { supabasePublic } from '@/lib/supabase/public';
import { buildIcs, eventInstant, type IcsEvent } from '@/lib/ics';
import { PLATFORM_HOST } from '@/lib/env';
import { site } from '@/content/site';

export const dynamic = 'force-dynamic';

/**
 * The subscription a calendar app can actually read.
 *
 * Deliberately anonymous. Apple Calendar and Google Calendar fetch a
 * subscription from their own servers, on their own schedule, with no cookies:
 * handed a session-protected URL they follow a redirect to the sign-in page,
 * parse the HTML as a calendar, find nothing, and report success. The
 * subscription then stays empty forever and nobody files a bug, because it
 * looked like it worked.
 *
 * So the token in the path is the credential, which is how every calendar feed
 * on the internet works. The database function behind it is the narrowest
 * thing that can produce a calendar — dated rows and nothing else, no ids to
 * follow — and an unknown or revoked token returns no rows rather than an
 * error, so a leaked link goes quiet instead of confirming it was ever real.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  /* Trimmed of the .ics that calendar apps and copy-paste both like to add. */
  const clean = token.replace(/\.ics$/i, '');

  const empty = () =>
    new NextResponse(buildIcs([], site.brand), {
      headers: {
        'content-type': 'text/calendar; charset=utf-8',
        'cache-control': 'no-store',
      },
    });

  if (clean.length < 32) return empty();

  const sb = supabasePublic();
  const { data, error } = await sb.rpc('calendar_by_token', { p_token: clean });
  if (error) {
    console.error('[feed] lookup failed', error);
    return empty();
  }

  type Row = { starts_on: string; at_time: string | null; title: string; detail: string; kind: string };
  const rows = (data ?? []) as Row[];

  const events: IcsEvent[] = rows.map((r, i) => {
    /* Stable across fetches. A calendar that re-subscribes every few hours
       must recognise the same line as the same entry, or every refresh
       duplicates the whole wedding. The row's own content is the identity,
       since the function deliberately hands back no ids. */
    const uid = `${r.kind}-${r.starts_on}-${r.at_time ?? ''}-${i}@${PLATFORM_HOST}`;

    if (r.at_time) {
      const start = eventInstant(r.starts_on, r.at_time.slice(0, 5));
      if (start) {
        return {
          uid,
          start,
          end: new Date(start.getTime() + 30 * 60 * 1000),
          summary: r.title,
          description: r.detail,
        };
      }
    }

    if (r.kind === 'event') {
      const start = eventInstant(r.starts_on, '19:00');
      if (start) {
        return {
          uid,
          start,
          end: new Date(start.getTime() + 6 * 60 * 60 * 1000),
          summary: r.title,
          description: r.detail,
          location: r.detail.split(' · ')[0] ?? '',
          alarmMinutes: 24 * 60,
        };
      }
    }

    return { uid, start: r.starts_on, allDay: true, summary: r.title, description: r.detail };
  });

  return new NextResponse(buildIcs(events, site.brand), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      /* An hour. Calendar apps poll on their own schedule anyway, and a feed
         that is never cached is re-queried by every one of them every time. */
      'cache-control': 'public, max-age=3600',
    },
  });
}
