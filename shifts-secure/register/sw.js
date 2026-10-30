/* dob1b: retire the old registration copy's service worker so phones stop serving the Oct 26 build from cache. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k.indexOf('us-reg-') === 0).map((k) => caches.delete(k)))).then(() => self.registration.unregister())));
