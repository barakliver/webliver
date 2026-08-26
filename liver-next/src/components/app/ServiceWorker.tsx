'use client';

import { useEffect } from 'react';

/** isSecureContext rather than a protocol check: it is true for https and for
 *  localhost, so the app is testable locally and installable in production.
 *  Registration failing is not worth telling anybody about — the site works
 *  exactly the same without it. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker
        /* `updateViaCache: 'none'` makes the browser fetch the worker itself
           past its HTTP cache every time it checks. Without it a browser can
           sit on yesterday's copy for a day, and the worker is the thing that
           decides what everything else is allowed to do. */
        .register('/sw.js', { updateViaCache: 'none' })
        .catch(() => {});
    }, 1200); /* let the page finish painting first */
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
