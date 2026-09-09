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
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }, 1200); /* let the page finish painting first */
    return () => window.clearTimeout(id);
  }, []);
  return null;
}
