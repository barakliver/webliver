import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { optional } from '@/lib/env';
import { processInbox } from '@/lib/inbox/intake';

/**
 * The second chance.
 *
 * Every door reads what it receives on the spot. This is for what did not
 * get read: a model that was down, a process that was restarted between
 * the insert and the reading. Anything still `new` after two minutes, or
 * `failed`, is read again, twenty at a time, by the cron key. It is the
 * same door the sweep uses, so the one secret covers it.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorised(req: Request): boolean {
  const expected = optional('CRON_KEY') || optional('INBOX_PROCESS_SECRET');
  if (!expected) return false;
  const given = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '') || (req.headers.get('x-cron-key') ?? '');
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) { timingSafeEqual(b, b); return false; }
  return timingSafeEqual(a, b);
}

export async function POST(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  const sb = supabaseAdmin();
  const { data, error } = await sb.from('inbox_items').select('id')
    .or(`status.eq.failed,and(status.eq.new,created_at.lt.${new Date(Date.now() - 120_000).toISOString()})`)
    .order('created_at', { ascending: true }).limit(20);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  let done = 0;
  for (const r of (data ?? []) as { id: string }[]) {
    await processInbox(sb, r.id);
    done += 1;
  }
  return NextResponse.json({ ok: true, processed: done });
}
