/* Network first for navigations so a deploy is picked up immediately, with the
   last good shell kept as an offline fallback. */
const CACHE = 'liver-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const c = res.clone(); caches.open(CACHE).then(x => x.put('/', c)).catch(() => {}); return res; })
      .catch(() => caches.match('/'))
  );
});
