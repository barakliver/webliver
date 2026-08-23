/*
 * Service worker — offline shell and fast repeat loads.
 *
 * Deliberately conservative about what it caches:
 *   • Static build assets are immutable, so cache-first is safe.
 *   • HTML is network-first, so a deploy is picked up immediately and a signed-
 *     out user never sees another session's cached page.
 *   • Anything authenticated or mutating is never cached at all. Caching a
 *     Supabase response would hand one viewer another viewer's data.
 */

const VERSION = 'liver-v4';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const OFFLINE_URL = '/offline';

const SHELL = ['/', OFFLINE_URL, '/manifest.json', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => undefined))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

/** Requests that must never be served from, or written to, a cache. */
function isPrivate(url, request) {
  if (request.method !== 'GET') return true;
  if (url.pathname.startsWith('/api/')) return true;
  if (url.pathname.startsWith('/admin')) return true;
  if (url.pathname.startsWith('/rsvp/')) return true;
  // Supabase REST, auth, storage and realtime.
  if (/supabase\.(co|in)$/.test(url.hostname)) return true;
  if (request.headers.has('authorization')) return true;
  return false;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isPrivate(url, request)) return;

  // Immutable build output — cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // Navigations — network-first so a deploy lands immediately, with the offline
  // page as the last resort.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((hit) => hit || caches.match(OFFLINE_URL))
            .then((hit) => hit || new Response('Offline', { status: 503 })),
        ),
    );
  }
});
