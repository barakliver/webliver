'use client';

import { useEffect, useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { auth as copy } from '@/content/site';

/**
 * A session that arrived in the address bar, rescued.
 *
 * Some sign-in links hand the session back in the URL *fragment* rather than
 * as a code the server can exchange — Supabase's implicit flow, which is what
 * a stock mail template and a password recovery link both use. A fragment
 * never reaches a server, so the callback route sees a request carrying
 * nothing, correctly says the link was incomplete, and redirects here. The
 * credential is then sitting in the address bar, valid, and thrown away.
 *
 * This picks it up. It runs in the browser, which is the only place that can
 * see a fragment at all, hands the pair to the client library so the session
 * becomes cookies like any other, and continues to wherever the person was
 * going. The fragment is stripped first, so a reload does not replay it and a
 * screenshot of this screen does not carry a working key.
 *
 * It is a rescue, not a route. Invitations this app sends carry a token hash
 * and are exchanged on the server; this exists so a link built by somebody
 * else's template still works instead of dead-ending.
 */
export function HashSession({ next = '/app' }: { next?: string }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash.includes('access_token')) return;

    const params = new URLSearchParams(hash);
    const access_token = params.get('access_token');
    const refresh_token = params.get('refresh_token');
    if (!access_token || !refresh_token) return;

    /* Out of the address bar before anything else, so the credential is not
       left in history, in a screenshot, or replayed by a reload. */
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setBusy(true);

    void (async () => {
      const { error } = await supabaseBrowser().auth.setSession({ access_token, refresh_token });
      if (error) { setBusy(false); return; }
      /* A hard navigation rather than a router push: the session is now a
         cookie, and every server component on the next screen has to be
         rendered by a request that carries it. */
      window.location.replace(next.startsWith('/') && !next.startsWith('//') ? next : '/app');
    })();
  }, [next]);

  if (!busy) return null;
  return (
    <p role="status" className="mb-4 rounded-control border border-line bg-surface-100 px-4 py-3 text-center text-[14px] text-ink-soft">
      {copy.signingIn}
    </p>
  );
}
