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
    '<body style="font-family:system-ui,Arial;padding:40px;text-align:center;background:#f7fafd;color:#0b1220">' +
    '<h1 style="font-size:20px">אין חיבור לאינטרנט</h1>' +
    '<p style="color:#3c4657">ברגע שהחיבור יחזור, רעננו את הדף.</p>',
    { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(fetch(event.request).catch(() => offlineFallback()));
});
