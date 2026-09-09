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
      .catch(async () => {
        /* caches.match resolves to undefined on a miss, and passing
           undefined to respondWith throws — which shows the browser's own
           error page instead of the app. Always answer with a Response. */
        const cached = await caches.open(CACHE).then((c) => c.match(SHELL));
        return cached || new Response(
          '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8">' +
          '<title>אין חיבור</title>' +
          '<body style="font-family:system-ui,sans-serif;background:#f8f5ef;color:#14130f;' +
          'display:grid;place-items:center;min-height:100vh;margin:0;text-align:center;padding:24px">' +
          '<div><h1 style="font-weight:500">אין חיבור לאינטרנט</h1>' +
          '<p style="color:#6f6a60">התחברו לרשת ורעננו את העמוד.</p></div>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 }
        );
      })
  );
});
