import { NextResponse } from 'next/server';

/**
 * Which version is being served right now.
 *
 * Deliberately the smallest thing that answers the question: no database, no
 * session, nothing to go wrong, and cheap enough that an installed app can ask
 * every time it comes back to the foreground.
 *
 * `no-store` on the way out matters more here than anywhere else in the
 * product. A cached answer to "what version are you" is the one response that
 * makes the whole mechanism report that everything is up to date forever.
 */

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev' },
    { headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } },
  );
}
