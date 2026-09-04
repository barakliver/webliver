import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { publicEnv } from '@/lib/env';
import { logFailure } from '@/lib/log';

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

/**
 * Where this site actually is, from the point of view of the person's browser.
 *
 * Not `new URL(request.url).origin`, which is the trap this route fell into and
 * the reason signing in with Google ended on a connection refused. The app sits
 * behind a reverse proxy: the browser asks liverproductions.com over TLS, and
 * what arrives here is a plain request to 127.0.0.1:3000. Redirecting to the
 * origin of *that* sends somebody to their own machine, where nothing is
 * listening. It looks like a broken sign-in and it is a correct sign-in with
 * the wrong address on the envelope.
 *
 * The forwarded headers are what a proxy sets to say who was actually asked.
 * When they name a real host that is the answer; when they name a local one it
 * is either development, where local is right, or a proxy that is not passing
 * them on, where the configured site address is right and a local address is
 * certainly wrong.
 */
function siteOrigin(request: Request): string {
  const h = request.headers;
  const host = (h.get('x-forwarded-host') ?? h.get('host') ?? '').split(',')[0].trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\]|0\.0\.0\.0)(:\d+)?$/i.test(host);

  if (host && !(local && process.env.NODE_ENV === 'production')) {
    const proto = (h.get('x-forwarded-proto') ?? '').split(',')[0].trim()
      || (local ? 'http' : 'https');
    return `${proto}://${host}`;
  }

  /* Already refuses a local address on a production build, so this cannot
     quietly reintroduce the same failure from the other direction. */
  return publicEnv.siteUrl;
}

/** Only a path inside this site is ever followed, so a crafted ?next= cannot
 *  bounce somebody straight off to another origin the moment they sign in. */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/app';
  return value;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = siteOrigin(request);
  const tokenHash = url.searchParams.get('token_hash');
  const code = url.searchParams.get('code');
  const type = url.searchParams.get('type') ?? 'magiclink';
  const email = url.searchParams.get('email') ?? '';
  const next = safeNext(url.searchParams.get('next'));

  const backToLogin = (reason: string) => {
    const to = new URL('/login', origin);
    if (email) to.searchParams.set('email', email);
    to.searchParams.set('reason', reason);
    if (next !== '/app') to.searchParams.set('next', next);
    return NextResponse.redirect(to);
  };

  /* Supabase says why it refused, in the query string, and it is usually
     something an operator can act on rather than something the person
     clicking can. Passing it through to the log costs nothing and turns
     "the link did not work" into a sentence. */
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (refused) {
    logFailure('auth', 'the mail provider refused the link', {
      at: '/auth/callback', role: 'anon', doing: 'verify-link', reason: 'provider-refused',
    });
    return backToLogin('expired');
  }

  const sb = await supabaseServer();

  /* Two shapes of link reach here, depending on what the project's own mail
     template contains, and both are legitimate.

     `token_hash` is what `{{ .TokenHash }}` produces and what this app's own
     invitations carry. `code` is the exchange step of the PKCE flow, which is
     what arrives when Supabase's hosted verify endpoint hands the person back.
     Accepting only the first meant a project left on a stock template had no
     way in at all, and the screen told the person their link was incomplete,
     which is true of the configuration and not of anything they did. */
  if (code) {
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      logFailure('auth', 'code exchange failed', {
        at: '/auth/callback', role: 'anon', doing: 'exchange-code', reason: 'rejected',
      });
      return backToLogin('expired');
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  if (tokenHash) {
    const { error } = await sb.auth.verifyOtp({
      token_hash: tokenHash,
      type: type === 'invite' ? 'invite' : 'magiclink',
    });
    if (error) {
      logFailure('auth', 'one click sign-in failed', {
        at: '/auth/callback', role: 'anon', doing: 'verify-otp', reason: 'rejected', kind: type,
      });
      return backToLogin('expired');
    }
    return NextResponse.redirect(new URL(next, origin));
  }

  /* Nothing usable arrived. The likeliest cause by far is a mail template
     still on its stock wording, which sends the person through a redirect
     that leaves the credential in the URL fragment — and a fragment never
     reaches a server. Naming it here is the difference between an operator
     fixing one setting and an operator reading this file. */
  /* The parameter names are logged, never their values: the whole point of
     this branch is that a credential may be in the URL. */
  logFailure('auth', 'a sign-in link carried neither token_hash nor code. Check '
    + 'Authentication → Emails → Magic Link: the template needs {{ .Token }} for the '
    + 'six digit code this app asks for, or a link to '
    + '/auth/callback?token_hash={{ .TokenHash }}&type=magiclink', {
    at: '/auth/callback', role: 'anon', doing: 'verify-link', reason: 'no-credential',
    count: [...url.searchParams.keys()].length,
  });
  return backToLogin('missing');
}
