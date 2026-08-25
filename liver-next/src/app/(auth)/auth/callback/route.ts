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
  const code = url.searchParams.get('code');
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

  /* Supabase says why it refused, in the query string, and it is usually
     something an operator can act on rather than something the person
     clicking can. Passing it through to the log costs nothing and turns
     "the link did not work" into a sentence. */
  const refused = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (refused) {
    console.error('[auth] the mail provider refused the link', { reason: refused });
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
      console.error('[auth] code exchange failed', { message: error.message });
      return backToLogin('expired');
    }
    return NextResponse.redirect(new URL(next, url.origin));
  }

  if (tokenHash) {
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

  /* Nothing usable arrived. The likeliest cause by far is a mail template
     still on its stock wording, which sends the person through a redirect
     that leaves the credential in the URL fragment — and a fragment never
     reaches a server. Naming it here is the difference between an operator
     fixing one setting and an operator reading this file. */
  console.error(
    '[auth] a sign-in link arrived carrying neither token_hash nor code. '
    + 'Check Authentication → Emails → Magic Link: the template needs '
    + '{{ .Token }} for the six digit code this app asks for, or a link to '
    + '/auth/callback?token_hash={{ .TokenHash }}&type=magiclink.',
    { params: [...url.searchParams.keys()] },
  );
  return backToLogin('missing');
}
