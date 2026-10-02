// Offline copy of the schedule page. Network first, so an edit made on GitHub
// shows as soon as there is signal; the saved copy only answers when the
// phone is offline (barns and fields have weak signal).
const CACHE = 'synrg26-v3';
const SHELL = ['./', './index.html', './icon.svg', './vendor/leaflet/leaflet.js', './vendor/leaflet/leaflet.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('synrg26') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    // ⚑ caches.open(CACHE).match, not caches.match: the latter searches every
    //   cache and returns the OLDEST hit (a lesson from an earlier app).
    }).catch(() => caches.open(CACHE).then((c) => c.match(req, { ignoreSearch: true })))
  );
});
