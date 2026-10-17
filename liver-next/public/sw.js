/* ---------------------------------------------------------------------------
   The previous version cached the response to *any* navigation under the key
   "/" and served it as the offline fallback. Visit the signed-in portal once
   and the couple's own page became what the next person on that browser saw
   offline, at the address of the public site. A cache is shared by everyone
   who uses the device, so nothing behind a sign-in may ever go into it.

   This one precaches a single static offline page and nothing else. Requests
   go to the network first, so a deploy is picked up immediately, and only the
   fallback comes from the cache.
   --------------------------------------------------------------------------- */
const CACHE = 'liver-shell-v2';
const OFFLINE = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE, { cache: 'reload' })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* respondWith rejects the navigation outright if it is handed undefined, which
   is what a bare caches.match does when it misses — the browser then shows its
   own error page instead of ours. Open the cache explicitly, and keep a plain
   Response as the last resort so this handler always answers with something. */
async function offlineFallback() {
  const cache = await caches.open(CACHE);
  const hit = (await cache.match(OFFLINE)) || (await cache.match(new URL(OFFLINE, self.location.origin).href));
  if (hit) return hit;
  return new Response(
    '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">' +
    '<title>אין חיבור</title>' +
    '<body style="font-family:Heebo,system-ui,Arial;padding:40px;text-align:center;background:#FAF7F2;color:#1A1613">' +
    '<h1 style="font-size:20px">אין חיבור לאינטרנט</h1>' +
    '<p style="color:#6B6259">ברגע שהחיבור יחזור, רעננו את הדף.</p>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => offlineFallback()));
});

/* ---------------------------------------------------------------------------
   Push. The server sends a small JSON note — title, body, url, tag, silent —
   and the worker shows it. Tap focuses a window of the app that is already
   open, if there is one, and otherwise opens the url. Nothing from a push is
   cached: the note is shown and forgotten.
   --------------------------------------------------------------------------- */
self.addEventListener('push', (event) => {
  let note = { title: 'ליור', body: '', url: '/app', tag: undefined, silent: false };
  try { note = Object.assign(note, event.data ? event.data.json() : {}); } catch { /* a bare push shows the default */ }
  event.waitUntil(
    self.registration.showNotification(note.title, {
      body: note.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: note.tag,
      silent: Boolean(note.silent),
      data: { url: note.url || '/app' },
      dir: 'rtl',
      lang: 'he',
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || '/app', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client && new URL(client.url).origin === self.location.origin) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
