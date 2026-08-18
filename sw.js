/* Minimal service worker: exists so the browser's install (Add to Home
   Screen) criteria are met, and gives a basic offline fallback for the
   page itself. Does not aggressively cache — the site is a single large
   HTML file that changes when we deploy, so we always prefer network. */
const CACHE = 'liver-productions-v1';
const SHELL = './';

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add(SHELL).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        caches.open(CACHE).then((c) => c.put(SHELL, res.clone())).catch(() => {});
        return res;
      })
      .catch(() => caches.match(SHELL))
  );
});
