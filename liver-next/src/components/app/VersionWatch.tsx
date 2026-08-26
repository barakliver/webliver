'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { updateCopy as c } from '@/content/site';

/* What this copy of the app was built from. Baked in at build time, so it
   never changes while the app is running — which is the entire point. */
const MINE = process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev';

/* Half an hour. An app left open on a producer's second monitor should notice
   a deploy without anybody asking it to, and should not spend the day asking. */
const EVERY = 30 * 60 * 1000;

/**
 * Noticing that a newer version is being served, and doing something about it.
 *
 * An installed app is a copy somebody keeps on their home screen. It opens to
 * whatever it had, and without something like this it goes on serving that
 * until it is deleted and installed again — which is what was happening, and
 * why a deploy meant reinstalling.
 *
 * Two rules decide what happens when a new version turns up, and both exist to
 * protect work in progress:
 *
 *   · Coming back to the app after it was in the background is a safe moment
 *     to reload. Nobody is mid-sentence, and the reload is invisible.
 *   · While it is in front of somebody, it asks. Reloading a page under a
 *     producer who is halfway through typing an event loses what they typed,
 *     and no version is worth that.
 *
 * The check itself is one small request, and the service worker is told to look
 * for a new copy of itself at the same time.
 */
export function VersionWatch() {
  const [stale, setStale] = useState(false);

  /* True while somebody is actually working in a field. A reload here is the
     one that loses something. */
  const typing = () => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement
      || el instanceof HTMLTextAreaElement
      || el instanceof HTMLSelectElement
      || (el instanceof HTMLElement && el.isContentEditable);
  };

  const check = useCallback(async (returning: boolean) => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return;
      const { id } = (await res.json()) as { id?: string };
      if (!id || id === MINE || MINE === 'dev') return;

      /* Returning from the background, and not in the middle of writing
         something: reload without asking. This is the path an installed app
         takes almost every time, and it is why the update is invisible. */
      if (returning && !typing()) {
        window.location.reload();
        return;
      }
      setStale(true);
    } catch {
      /* Offline, or the server is restarting mid-deploy. Both are answered by
         asking again later rather than by telling anybody anything. */
    }
  }, []);

  useEffect(() => {
    void check(false);

    const onVisible = () => {
      if (document.visibilityState !== 'visible') return;
      void check(true);
      /* Ask the browser to look for a new service worker at the same moment.
         Without this it checks on its own schedule, which can be a day. */
      navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {});
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    const timer = window.setInterval(() => void check(false), EVERY);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
      window.clearInterval(timer);
    };
  }, [check]);

  if (!stale) return null;

  return (
    <div
      role="status"
      /* Above the tab bar on a phone and out of the way of the accessibility
         button, because a bar that covers a control is a bar somebody dismisses
         without reading. */
      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.25rem)] z-[55]
                 mx-auto flex max-w-[26rem] items-center justify-between gap-3
                 rounded-card border border-line-strong bg-card px-4 py-3 shadow-pop
                 lg:inset-x-auto lg:bottom-6 lg:end-6"
    >
      <p className="text-[13.5px] text-ink">{c.ready}</p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="btn-primary inline-flex shrink-0 items-center gap-1.5 px-4 py-1.5 text-[13px]"
      >
        <RefreshCw size={14} strokeWidth={1.5} aria-hidden />
        {c.refresh}
      </button>
    </div>
  );
}
