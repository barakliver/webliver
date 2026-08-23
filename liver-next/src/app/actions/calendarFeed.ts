'use server';

import { supabaseServer } from '@/lib/supabase/server';
import { currentAccount } from '@/lib/auth';

export type FeedResult = { ok: boolean; token?: string; error?: string };

/**
 * The address a calendar app can subscribe to.
 *
 * Handed out on request rather than minted with every account, because it is a
 * credential: the token in the URL is the whole of the authentication, so one
 * should exist only once somebody has actually asked for it.
 *
 * The database reuses an existing token rather than issuing a second one.
 * Pressing the button twice must hand back the same address, or every press
 * would leave another working credential behind that nobody remembers to
 * revoke.
 */
export async function feedLink(clientId?: string): Promise<FeedResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const sb = await supabaseServer();
  const { data, error } = await sb.rpc('calendar_feed_token', { p_client: clientId ?? null });

  if (error || !data) {
    console.error('[feed] token failed', error);
    return { ok: false, error: 'לא הצלחנו ליצור קישור ליומן' };
  }
  return { ok: true, token: String(data) };
}

/** Turning a leaked link off. The next fetch by every calendar subscribed to
 *  it returns an empty calendar, which is the correct shape of "revoked": the
 *  entries disappear rather than the app reporting an error nobody will see. */
export async function revokeFeed(clientId?: string): Promise<FeedResult> {
  const account = await currentAccount();
  if (!account) return { ok: false, error: 'צריך להתחבר' };

  const sb = await supabaseServer();
  const { error } = await sb.rpc('revoke_calendar_feed', { p_client: clientId ?? null });
  if (error) {
    console.error('[feed] revoke failed', error);
    return { ok: false, error: 'לא הצלחנו לבטל את הקישור' };
  }
  return { ok: true };
}
