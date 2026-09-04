import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { optional } from '@/lib/env';
import { EVENT_ZONE } from '@/lib/clock';

/**
 * The nightly sweep: close what the calendar has closed, and send the
 * anniversary reminders that fall due.
 *
 * Two jobs in one endpoint because they are one thought. An event closes a
 * fortnight after it happened; closing it schedules its first anniversary; a
 * year later the reminders come due. Splitting them would mean two secrets,
 * two schedules and two things to notice have stopped running.
 *
 * **Idempotent by construction, not by convention.** `fire_due_anniversaries`
 * marks and returns in one statement, so two runs overlapping cannot both
 * claim a row — the second finds nothing. Running this twice an hour would be
 * wasteful and harmless, which is the property a cron actually needs.
 *
 * It runs with the service role, because there is nobody signed in at four in
 * the morning and every row it touches belongs to somebody else. Which is
 * exactly why the door is bolted: without the key set it refuses everything
 * rather than running open, and the refusal is a 503 with a line in the log
 * for whoever is setting it up.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* One month before, one week before, one day before — the same three the
   database schedules, spelled here so the notification reads as a sentence. */
const WHEN: Record<string, string> = {
  month: 'בעוד חודש',
  week: 'בעוד שבוע',
  day: 'מחר',
};

const dateFmt = new Intl.DateTimeFormat('he-IL', { timeZone: EVENT_ZONE,
  day: 'numeric', month: 'long', year: 'numeric',
});

type Due = {
  client_id: string;
  producer_id: string;
  owner_id: string | null;
  milestone: string;
  couple: string;
  event_date: string;
  kind: string | null;
};

/** Timing safe, so a caller cannot learn the key one character at a time by
 *  measuring how long a refusal takes. */
function keyMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i += 1) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

function authorised(req: Request): boolean {
  const expected = optional('CRON_KEY');
  if (!expected) return false;

  /* Either header. `Authorization: Bearer …` is what most schedulers send;
     `x-cron-key` is what a curl in a crontab tends to. Neither is in the URL,
     deliberately: a query string ends up in an access log. */
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  return keyMatches(bearer, expected)
    || keyMatches(req.headers.get('x-cron-key') ?? '', expected);
}

export async function POST(req: Request) {
  if (!optional('CRON_KEY')) {
    console.error('[cron] CRON_KEY is not set; refusing every run');
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });
  }
  if (!authorised(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }
  if (!optional('SUPABASE_SERVICE_ROLE_KEY')) {
    console.error('[cron] no service role key, so the sweep cannot read anybody\'s rows');
    return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });
  }

  const sb = supabaseAdmin();
  const out = { archived: 0, reminded: 0, errors: [] as string[] };

  /* Fourteen days of grace. The week after a wedding is when the last invoice
     arrives and the run sheet gets its final correction; freezing the snapshot
     on the Sunday morning would freeze it wrong. */
  const { data: closed, error: closeErr } = await sb.rpc('archive_past_events', { p_grace: 14 });
  if (closeErr) out.errors.push(`archive: ${closeErr.message}`);
  else out.archived = Number(closed) || 0;

  const { data: due, error: dueErr } = await sb.rpc('fire_due_anniversaries');
  if (dueErr) {
    out.errors.push(`anniversaries: ${dueErr.message}`);
  } else {
    for (const r of (due ?? []) as Due[]) {
      if (!r.owner_id) continue;
      const when = WHEN[r.milestone] ?? '';
      const date = dateFmt.format(new Date(r.event_date));
      const couple = r.couple || 'זוג';

      const { error } = await sb.rpc('notify', {
        p_profile: r.owner_id,
        p_kind: 'anniversary',
        p_title: `שנה ל${couple}`,
        p_body: `${when} מציינים שנה ל${r.kind === 'corporate' ? 'אירוע' : 'חתונה'} של ${couple}, ${date}.`,
        p_href: `/app/clients/${r.client_id}`,
      });

      if (error) out.errors.push(`notify ${r.client_id}: ${error.message}`);
      else out.reminded += 1;
    }
  }

  if (out.errors.length) console.error('[cron] finished with problems', out);
  return NextResponse.json({ ok: out.errors.length === 0, ...out });
}

/** A GET says whether the door is wired, and nothing else. Useful when setting
 *  a scheduler up, and it neither runs the sweep nor reveals the key. */
export function GET() {
  return NextResponse.json({
    ok: true,
    configured: Boolean(optional('CRON_KEY')) && Boolean(optional('SUPABASE_SERVICE_ROLE_KEY')),
  });
}
