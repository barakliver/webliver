import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

/**
 * Where a one click sign-in link lands.
 *
 * The link in an invitation carries a token hash rather than a session. This
 * route trades it for one, sets the cookies, and sends the person on. It is
 * the whole difference between "copy the six digits from the email" and
 * "press the button".
 *
 * A link is single use and expires, so the failure path matters as much as the
 * success one: a couple opening a week-old invitation, or opening it twice,
 * must land somewhere that explains itself rather than on a blank error. They
 * go to the sign-in screen with their address already filled in and a line
 * saying the link is spent, which turns a dead end into one tap.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Only a path inside this site is ever followed, so a crafted ?next= cannot
 *  bounce somebody straight off to another origin the moment they sign in. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? 'magiclink';
  const email = url.searchParams.get('email') ?? '';
  const next = safeNext(url.searchParams.get('next'));

  const backToLogin = (reason: string) => {
    const to = new URL('/login', url.origin);
    if (email) to.searchParams.set('email', email);
    to.searchParams.set('reason', reason);
    if (next !== '/app') to.searchParams.set('next', next);
    return NextResponse.redirect(to);
  };

  if (!tokenHash) return backToLogin('missing');

  const sb = await supabaseServer();
  const { error } = await sb.auth.verifyOtp({
    token_hash: tokenHash,
    type: type === 'invite' ? 'invite' : 'magiclink',
  });

  if (error) {
    console.error('[auth] one click sign-in failed', { message: error.message });
    return backToLogin('expired');
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
