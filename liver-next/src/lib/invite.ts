import 'server-only';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { optional } from '@/lib/env';
import { publicEnv } from '@/lib/env';

/**
 * A one click way in, for somebody who was invited.
 *
 * Generated rather than sent by Supabase. `generateLink` hands back the URL and
 * mails nothing, so the invitation goes out through this app's own mail path
 * with this business's wording, its own template, and instructions for putting
 * the thing on a phone. It also means an invitation does not depend on
 * Supabase's built in mail, which is the thing that is currently failing with
 * "Error sending confirmation email".
 *
 * It needs the service role key, which is the one credential that bypasses
 * every policy in the database. That is a real cost, so it is used for exactly
 * this and nothing else, and its absence is not an error: without it the
 * invitation still goes out, carrying a link to the sign-in screen with the
 * address filled in. One tap more, and nothing broken.
 */

export type InviteLink =
  | { kind: 'magic'; url: string }
  | { kind: 'plain'; url: string };

/** Where the link lands. The address rides along so a spent link can send
 *  somebody to the sign-in screen with it already filled in. */
function callbackFor(email: string, next: string): string {
  const site = publicEnv.siteUrl.replace(/\/+$/, '');
  const to = new URL(`${site}/auth/callback`);
  to.searchParams.set('email', email);
  if (next !== '/app') to.searchParams.set('next', next);
  return to.toString();
}

export async function inviteLinkFor(email: string, next = '/app/portal'): Promise<InviteLink> {
  const site = publicEnv.siteUrl.replace(/\/+$/, '');
  const plain = `${site}/login?email=${encodeURIComponent(email)}`;

  if (!optional('SUPABASE_SERVICE_ROLE_KEY')) {
    /* Not a failure, and not silent: whoever set this server up should know
       why invitations take one tap more than they could. */
    console.warn('[invite] no service role key, so the invitation carries a sign-in link rather than a one click link');
    return { kind: 'plain', url: plain };
  }

  try {
    const admin = supabaseAdmin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: callbackFor(email, next) },
    });

    if (error || !data?.properties?.action_link) {
      console.error('[invite] could not generate a one click link', error);
      return { kind: 'plain', url: plain };
    }
    return { kind: 'magic', url: data.properties.action_link };
  } catch (e) {
    console.error('[invite] link generation threw', e);
    return { kind: 'plain', url: plain };
  }
}
