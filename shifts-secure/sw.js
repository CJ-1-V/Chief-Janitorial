/* Retired Shift Tracker worker (Oct 21 2026): removes the old caches and unregisters itself.
 * The UnScramble and Chief Janitorial apps have their own workers in /shifts-secure/register/ and /shifts-secure/cj/. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('st-static') === 0; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.registration.unregister(); })
    .then(function () { return self.clients.matchAll({ type: 'window' }); })
    .then(function (cs) { cs.forEach(function (c) { c.navigate(c.url); }); }));
});
