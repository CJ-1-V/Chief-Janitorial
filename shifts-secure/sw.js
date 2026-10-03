/* Service worker for the installable app. Caches ONLY the static app files listed below (same origin, GET).
 * It never caches Supabase / API responses or any data: every other request goes straight to the network. */
const CACHE = 'st-static-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/styles.css', 'css/app.css', 'js/config.js', 'js/tz.js', 'js/core.js',
  'js/employee.js', 'js/admin.js', 'vendor/supabase.js', 'assets/logo.png', 'assets/logo-dark.png', 'assets/unscramble-logo.svg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const SCOPE = new URL('./', self.location).href;
const STATIC = new Set(FILES.map((f) => new URL(f, SCOPE).href));
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const r = e.request; if (r.method !== 'GET') return;
  const u = new URL(r.url); u.search = ''; u.hash = '';
  if (!STATIC.has(u.href)) return;                         // not an app file (e.g. Supabase): browser handles it, nothing cached
  // network first so updates show up at once; the cached copy is only a fallback when offline
  e.respondWith(fetch(r).then((res) => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(u.href, copy)); } return res; })
    .catch(() => caches.match(u.href)));
});
