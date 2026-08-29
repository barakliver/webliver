'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';
import { auth as copy } from '@/content/site';

/** Google's own mark. Drawn rather than fetched: Google's brand guidelines
 *  require the four colours unaltered, and an <img> from their CDN is a
 *  request the content security policy would have to allow and a dependency on
 *  somebody else's uptime for a button that must always render. */
function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden focusable="false">
      <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.2-.4-4.7H24v8.9h11.8c-.5 2.8-2.1 5.1-4.4 6.7v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.4z" />
      <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.7-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z" />
      <path fill="#FBBC05" d="M11.6 28.1c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.7H4.3A22 22 0 0 0 2 24c0 3.6.9 6.9 2.3 9.8l7.3-5.7z" />
      <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.7-5.2 6.6-9.1 12.4-9.1z" />
    </svg>
  );
}

/**
 * One tap instead of a code that has to arrive.
 *
 * The most common way somebody fails to get into this product is not a wrong
 * password — there are no passwords — it is a code that landed in spam, or
 * arrived while they were standing in a venue not looking at their email. This
 * removes that failure for the large majority of people, and removes nothing:
 * the code and the phone are still under it, because an older parent without a
 * Google account on their phone is a real person who has to get in.
 *
 * The exchange happens through the callback route this app already has. The
 * browser client uses PKCE, so what comes back is a code the server trades for
 * a session — not a token in a URL fragment, which is the failure the
 * invitations were quietly hitting.
 *
 * One caveat worth stating where it is implemented: authorisation in this
 * product is keyed on an email address. Somebody invited at one address who
 * signs in with a Google account at another is signed in and belongs to
 * nothing. The screen they land on says so by name rather than showing them an
 * empty page.
 */
export function GoogleButton({ next = '/app' }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const go = async () => {
    setBusy(true);
    setError('');

    const to = new URL('/auth/callback', window.location.origin);
    if (next.startsWith('/') && !next.startsWith('//')) to.searchParams.set('next', next);

    const { error: err } = await supabaseBrowser().auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: to.toString(),
        /* Ask for the address and the name, and nothing else. Every extra
           scope is another line on the consent screen for something this
           product does not use. */
        scopes: 'email profile',
      },
    });

    /* Only reached if the redirect never happened. On success the page is
       already on its way to Google and this component is gone. */
    if (err) { setBusy(false); setError(copy.googleFailed); }
  };

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className="inline-flex min-h-[48px] w-full items-center justify-center gap-3 rounded-button border border-line-strong bg-card text-[15px] font-medium text-ink transition hover:border-accent/40 hover:bg-surface-100 disabled:opacity-60"
      >
        <GoogleMark />
        {busy ? copy.googleGoing : copy.google}
      </button>

      {error && <p role="alert" className="text-[14px] text-bad">{error}</p>}

      {/* A rule with the word on it, rather than a bare rule. The point is to
          say these are two ways to do the same thing, not that one of them is
          a footnote. */}
      <div className="flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-line" />
        <span className="text-[12.5px] text-ink-mute">{copy.or}</span>
        <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
