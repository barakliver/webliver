'use client';

import { useEffect, useState } from 'react';

/**
 * Keeping the screen on while the evening is running.
 *
 * The one screen in this product somebody holds rather than reads. A producer
 * on a wedding floor at eleven at night has the run sheet in one hand and
 * something else in the other, and a phone that sleeps after thirty seconds
 * has to be woken, unlocked and scrolled back to where it was, every time
 * they glance at it. That is not an inconvenience on that night, it is the
 * reason somebody goes back to a printed page.
 *
 * Only while the console is actually live. Holding a screen awake on an event
 * that is next month would be a battery drained for nothing, so the caller
 * passes whether tonight is the night.
 *
 * The lock is dropped by the browser whenever the tab is hidden — switching to
 * WhatsApp to message a supplier is enough — and it does not come back on its
 * own, which is the part that makes a naive implementation look like it works
 * and then quietly stop. It is re-taken on every return to visibility.
 *
 * Unsupported browsers get nothing and say nothing. This is a comfort, not a
 * feature to warn somebody about, and Safari only learned it in 16.4.
 */
export function useScreenAwake(active: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (!active) return;
    /* Typed locally rather than depending on the DOM lib's version having it:
       the API is recent enough that a project's TypeScript may not know it,
       and a missing type is not a reason to leave the screen asleep. */
    const nav = navigator as Navigator & {
      wakeLock?: { request: (kind: 'screen') => Promise<{ release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void }> };
    };
    if (!nav.wakeLock) return;

    let sentinel: { release: () => Promise<void>; addEventListener: (t: string, f: () => void) => void } | null = null;
    let dropped = false;

    const take = async () => {
      if (dropped || document.visibilityState !== 'visible') return;
      try {
        sentinel = await nav.wakeLock!.request('screen');
        setHeld(true);
        /* The browser may let go for its own reasons — battery saver, a call
           coming in. Knowing it happened is what lets the indicator stop
           claiming something that is no longer true. */
        sentinel.addEventListener('release', () => setHeld(false));
      } catch {
        /* Refused. A denied wake lock is not an error worth showing anybody. */
        setHeld(false);
      }
    };

    const onVisible = () => { if (document.visibilityState === 'visible') void take(); };

    void take();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
      setHeld(false);
    };
  }, [active]);

  return held;
}
