import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { optional, publicEnv } from '@/lib/env';
import { exchangeCode, googleConfigured, readState } from '@/lib/google/oauth';
import { syncProducer } from '@/lib/google/sync';

/**
 * Google sends the producer back here with a code, and the code becomes
 * tokens, a calendar in their account, and a first sync.
 *
 * The state is checked before anything else: a forged or stale one is a
 * redirect to the calendar screen with a word, not a row. The tokens are
 * written with the service role, because nothing the producer's own
 * session may write holds them.
 */
export const dynamic = 'force-dynamic';

const back = (word: string) => NextResponse.redirect(`${publicEnv.siteUrl}/app/calendar?google=${word}`);

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!googleConfigured() || !optional('SUPABASE_SERVICE_ROLE_KEY')) return back('unconfigured');
  if (url.searchParams.get('error')) return back('denied');

  const producerId = readState(url.searchParams.get('state') ?? '');
  const code = url.searchParams.get('code') ?? '';
  if (!producerId || !code) return back('stale');

  const tokens = await exchangeCode(code);
  if ('error' in tokens) {
    console.error('[google] token exchange failed', tokens.error);
    return back('failed');
  }

  const sb = supabaseAdmin();
  const { error } = await sb.from('google_calendars').upsert({
    producer_id: producerId,
    email: tokens.email,
    refresh_token: tokens.refreshToken,
    access_token: tokens.accessToken,
    token_expires_at: tokens.expiresAt,
    sync_token: null,
    last_error: '',
    connected_at: new Date().toISOString(),
  });
  if (error) {
    console.error('[google] could not keep the tokens', error);
    return back('failed');
  }

  /* The calendar is created and everything dated goes in, before the
     producer sees the screen again. A failure here is written on the row
     and shown there; the link itself stands. */
  await syncProducer(producerId, sb);
  return back('connected');
}
