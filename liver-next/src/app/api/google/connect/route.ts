import { NextResponse } from 'next/server';
import { currentAccount } from '@/lib/auth';
import { authUrl, googleConfigured, makeState } from '@/lib/google/oauth';
import { publicEnv } from '@/lib/env';

/**
 * The producer is sent to Google to say yes.
 *
 * Producer only: the calendar is theirs and the tokens act as them. The
 * state carries their producer id, signed, so the callback knows whose
 * tokens arrived without trusting the browser to say.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const account = await currentAccount();
  if (!account?.producer) return NextResponse.redirect(`${publicEnv.siteUrl}/app/calendar?google=denied`);
  if (!googleConfigured()) return NextResponse.redirect(`${publicEnv.siteUrl}/app/calendar?google=unconfigured`);
  return NextResponse.redirect(authUrl(makeState(account.producer.id)));
}
