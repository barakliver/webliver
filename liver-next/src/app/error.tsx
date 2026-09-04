'use client';

import { useEffect, useState } from 'react';
import { RotateCw, Home, MessageCircle } from 'lucide-react';
import { siteErrorCopy } from '@/content/site';
import { siteErrorCopyEn } from '@/content/site.en';
import { publicEnv } from '@/lib/env';

/**
 * Something on the public site threw.
 *
 * The workspace has had its own boundary for a while; the site a stranger sees
 * had none, so a failure anywhere outside `/app` reached the browser's own
 * blank page. That is the worst place in the product to have no answer: the
 * person is deciding whether to trust us with their wedding, and what they got
 * was a white screen.
 *
 * The two buttons differ from the workspace's on purpose. Somebody signed in
 * wants to try again or go back to their events; a visitor has neither, so the
 * second door here is a person. The fault code is shown for the same reason it
 * is shown there — it is the one string that finds the matching line in the
 * server log, and a visitor reading it out over WhatsApp turns a shrug into a
 * fix.
 *
 * The language is taken from the document rather than from the server, because
 * an error boundary is a client component and cannot ask. Reading it during
 * render would be a server and client branch, which is the bug that put six
 * screens in this state to begin with, so it is read after mounting and starts
 * from the site's own language.
 */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [c, setCopy] = useState<typeof siteErrorCopy | typeof siteErrorCopyEn>(siteErrorCopy);

  useEffect(() => {
    if (document.documentElement.lang.startsWith('en')) setCopy(siteErrorCopyEn);
  }, []);

  useEffect(() => { console.error('[site] render failed', error); }, [error]);

  return (
    <main id="main" className="shell flex min-h-[70vh] flex-col justify-center py-16">
      <div className="measure">
        <h1 className="font-display text-display font-semibold leading-tight text-ink">{c.title}</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-ink-soft">{c.body}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn-primary inline-flex items-center gap-2">
            <RotateCw size={17} strokeWidth={1.5} aria-hidden />
            <span>{c.retry}</span>
          </button>

          <a href="/" className="btn-ghost inline-flex items-center gap-2">
            <Home size={17} strokeWidth={1.5} aria-hidden />
            <span>{c.home}</span>
          </a>

          <a
            href={`https://wa.me/${publicEnv.whatsapp}`}
            className="btn-ghost inline-flex items-center gap-2"
            target="_blank" rel="noopener noreferrer"
          >
            <MessageCircle size={17} strokeWidth={1.5} aria-hidden />
            <span>{c.whatsapp}</span>
          </a>
        </div>

        {error.digest && (
          <p className="mt-10 border-t border-line pt-5 text-[13px] text-ink-mute">
            {c.ref}: <code className="font-mono" dir="ltr">{error.digest}</code>
          </p>
        )}
      </div>
    </main>
  );
}
