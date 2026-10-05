/* Data layer switch (public settings only – the publishable key is meant to be in the browser; all access is enforced
 * by row-level security in the database). NEVER put a service key, DB password or client name here.
 *   mode 'mock'     = the original test behaviour: fake data in this browser (localStorage). Used by the 373-check test suite.
 *   mode 'supabase' = the real database (Shift Tracker project) with the Shift Tracker login.
 * Override for testing (only on this computer / file://): ?store=mock or ?store=supabase (remembered for this tab). */
window.REG_STORE = {
  mode: 'supabase',
  manualTime: true,                                   // 016i: Add hours manually on
  welcomeEmail: true,                                 // 016j/016k: Send welcome email ON (Edge Function reg-send-welcome, Google SMTP from admin@unscramble.ca)                                         // the deploy build (tools/build-dist.sh) sets 'supabase'
  url: 'https://lfefpmzfnvgwuicthlyg.supabase.co',
  key: 'sb_publishable_3T6uAqwjHXpv4HUY5gOPGQ_gWqA88JI',
  loginDomain: 'example.com',                           // same as Shift Tracker: phone 9025551234 -> 9025551234@example.com
  authStorageKey: 'st-secure-auth',                     // SAME key as Shift Tracker, so one sign-in works for both (same website)
  clockUrl: '../#/emp/clock',                           // Shift Tracker clock screen (registration app lives at /shifts-secure/register/)
  bucket: 'reg-docs'
};
(function () {
  try {
    var local = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
    if (!local) return;                                  // on the real website nothing can be switched by a link
    var m = /[?&]store=(mock|supabase)\b/.exec(location.search);
    if (m) sessionStorage.setItem('reg-store-mode', m[1]);
    var s = sessionStorage.getItem('reg-store-mode'); if (s) window.REG_STORE.mode = s;
    // Local test stack only: the database address can be swapped ONLY when the page itself runs on this computer,
    // so a link with ?sburl= can never send a real user's password somewhere else.
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var u = /[?&]sburl=([^&]+)/.exec(location.search);
      if (u) sessionStorage.setItem('reg-store-url', decodeURIComponent(u[1]));
      var su = sessionStorage.getItem('reg-store-url'); if (su) window.REG_STORE.url = su;
    }
  } catch (e) {}
})();
