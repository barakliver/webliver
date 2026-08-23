'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker. Kept out of the layout body so the layout can
 * stay a Server Component, and scoped at the origin root so it controls every
 * route including the producer white-label portals.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    // A worker registered over http:// on a non-localhost host is rejected by
    // the browser, so don't attempt it.
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;

    const onLoad = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Registration failure must never break the page.
      });
    };
    if (document.readyState === 'complete') onLoad();
    else window.addEventListener('load', onLoad);
    return () => window.removeEventListener('load', onLoad);
  }, []);

  return null;
}
