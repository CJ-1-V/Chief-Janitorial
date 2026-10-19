/* offline1 (from pwainstall1) – UnScramble service worker (scope /shifts-secure/register/ only). Owner OK for a test copy Oct 19 2026, 2:27 AM.
 * WHAT IT DOES
 *   - Pages (index.html / any navigation): NETWORK FIRST, revalidated every time (cache:'no-cache'), never stored. So a deploy shows up
 *     on the next open. With no internet it shows a small built-in page: "No internet. Connect to clock in."
 *   - App files (js, css, images, manifest) of THIS folder only: served from the cache for speed, then refreshed from the network in the
 *     background (stale-while-revalidate). Keyed by the full URL incl. ?v=..., so a new ?v= in index.html is a new file; older copies of
 *     the same file are deleted when the new one arrives. js/store-*.js (feature switches) are always fetched fresh (cache = offline only).
 *   - NEVER touches data: Supabase / any other site, any POST/PUT/DELETE, any request with an Authorization header, anything outside
 *     /shifts-secure/register/ and anything that is not a plain app file goes straight to the network and is never stored.
 *     Also never stored: an app file with any query other than ?v=, a redirect, or a reply marked no-store / private / Set-Cookie.
 * UPDATES: change VERSION below in a deploy only when this file itself changes. The new worker takes over at once (skipWaiting +
 *   clients.claim) and deletes its own old caches (prefix "us-reg-" only – the old Shift Tracker cache "st-static-…" is left alone).
 *   The page is never reloaded by the worker (a clock-in in progress is never interrupted).
 * ROLLBACK / SWITCH OFF: replace this file with tools/sw-off.js from the offline1 bundle (same path, /shifts-secure/register/sw.js).
 *   On a single phone: open the app with ?sw=off (e.g. /shifts-secure/register/?sw=off). */
'use strict';
const VERSION = '20261019-pwa1';
const PREFIX = 'us-reg-';
const SHELL = PREFIX + 'shell-' + VERSION;
const SCOPE_PATH = new URL('./', self.location).pathname;          // "/shifts-secure/register/"
const APP_FILE = /\.(?:js|css|png|svg|ico|webp|jpg|jpeg|gif|woff2?|webmanifest)$/i;
const FRESH = /\/js\/store-[^\/]*\.js$/i;                           // feature switches + data layer: network first
const OFFLINE_HTML = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  '<meta name="theme-color" content="#332E57"><title>No internet – UnScramble</title><style>' +
  'html,body{margin:0;height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;background:#f6f5fb;color:#1d1b2e}' +
  'body{display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}' +
  '.c{background:#fff;border-radius:18px;box-shadow:0 8px 30px rgba(51,46,87,.15);padding:28px 24px;max-width:360px;width:100%;text-align:center}' +
  '.lg{width:72px;height:72px;border-radius:16px;margin:0 auto 14px;display:block}' +
  '.wf{width:56px;height:56px;margin:0 auto 6px;display:block;color:#332E57}' +
  'h1{font-size:26px;margin:4px 0 6px;color:#332E57}p{font-size:19px;margin:0 0 20px;line-height:1.4}' +
  'button{font:inherit;font-size:19px;font-weight:700;background:#332E57;color:#fff;border:0;border-radius:12px;padding:14px 22px;width:100%;min-height:52px;cursor:pointer}' +
  '</style></head><body><main class="c" role="main">' +
  '<svg class="lg" viewBox="0 0 72 72" aria-hidden="true"><rect width="72" height="72" rx="16" fill="#332E57"/><rect y="62" width="72" height="10" fill="#D9A03C"/>' +
  '<text x="36" y="47" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="34" fill="#fff">Us</text></svg>' +
  '<svg class="wf" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
  '<path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r="1" fill="currentColor"/><path d="M3 3l18 18" stroke="#c0392b"/></svg>' +
  '<h1>No internet</h1><p>Connect to clock in.</p>' +
  '<button type="button" onclick="location.reload()">Try again</button></main>' +
  '<script>addEventListener("online",function(){location.reload()});</script></body></html>';

function offlinePage() {
  return new Response(OFFLINE_HTML, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

self.addEventListener('install', () => { self.skipWaiting(); });

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k.indexOf(PREFIX) === 0 && k !== SHELL).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function prune(cache, url) {            // keep one copy per file: drop the same path with an older ?v=
  return cache.keys().then((ks) => Promise.all(ks.filter((k) => { const u = new URL(k.url); return u.pathname === url.pathname && k.url !== url.href; })
    .map((k) => cache.delete(k)))).catch(() => {});
}

function okToStore(res) {               // only a plain 200 app file from this site; never a redirect or anything marked private/no-store
  if (!res || !res.ok || res.status !== 200 || res.type !== 'basic' || res.redirected) return false;
  const cc = (res.headers.get('Cache-Control') || '').toLowerCase();
  return cc.indexOf('no-store') < 0 && cc.indexOf('private') < 0 && !res.headers.has('Set-Cookie');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;                                   // writes: never touched
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                    // Supabase / other sites: never touched
  if (url.pathname.indexOf(SCOPE_PATH) !== 0) return;                 // outside this app: never touched
  if (req.headers.has('authorization') || req.headers.has('range')) return;

  if (req.mode === 'navigate') {                                       // pages: network first, never stored
    e.respondWith(fetch(req, { cache: 'no-cache' }).catch(() => offlinePage()));
    return;
  }
  if (!APP_FILE.test(url.pathname)) return;                           // not an app file: straight to the network
  for (const k of url.searchParams.keys()) if (k !== 'v') return;      // app files with ?v= only; any other query: network only, never stored

  if (FRESH.test(url.pathname)) {                                      // switches: network first, cached copy only when offline
    e.respondWith(caches.open(SHELL).then((c) => fetch(req).then((res) => {
      if (okToStore(res)) { c.put(req, res.clone()); e.waitUntil(prune(c, url)); }
      return res;
    }).catch(() => c.match(req).then((hit) => hit || Promise.reject(new Error('offline'))))));
    return;
  }
  e.respondWith(caches.open(SHELL).then((c) => c.match(req).then((hit) => {   // app files: cache, refreshed in the background
    const net = fetch(req).then((res) => {
      if (okToStore(res)) { const copy = res.clone(); e.waitUntil(c.put(req, copy).then(() => prune(c, url))); }
      return res;
    });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  })));
});
