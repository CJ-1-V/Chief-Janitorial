/* pickup1 – workers and employees must give a mobile phone number and a pickup address.
   Owner, Oct 21 2026: "make it mandatory to add phone number and a pickup address".
   - Sign up (worker / employee): Phone is required (10 digits); new required field "Pickup address".
   - My profile and My details: same two fields, same rules; the pickup address can be changed there.
   - Office person record: shows the pickup address.
   Stored on the person as u.pickupAddress (synced with the rest of the record). */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof FORMS === 'undefined') return;
  var NEED = { worker: 1, employee: 1 };
  var LABEL = 'Pickup address';
  var HINT = 'Street and number, town and postal code – where the crew van picks you up.';
  var NOTICE = 'Your home or pickup address is used only by the UnScramble office (and your employer, if you work for a subcontractor) to plan crew-van pickups. Farms and other clients never see it.';
  var PH = 'e.g. 12 Main St, Kensington C0B 1M0';

  function esc_(s) { return typeof esc === 'function' ? esc(s) : String(s == null ? '' : s); }
  function tenDigits(s) {
    var d = String(s || '').replace(/\D/g, '');
    if (d.length === 11 && d[0] === '1') d = d.slice(1);
    return d.length === 10 ? d : '';
  }
  function cleanAddr(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function addrOk(s) { s = cleanAddr(s); return s.length >= 8 && /\d/.test(s) && /[A-Za-z]{3,}/.test(s); }
  function pickupField(val, req) {
    return '<div><label' + (req ? ' class="req"' : '') + '>' + LABEL + '</label><input type="text" name="pickup" value="' + esc_(val) + '"' +
      (req ? ' required' : '') + ' placeholder="' + esc_(PH) + '" autocomplete="street-address"><div class="hint">' + HINT + '</div><div class="hint pk-privacy">' + esc_(NOTICE) + '</div></div>';
  }
  /* phone/email are locked (changed through "Request change") once a person has one on file – never block that person */
  function phoneLocked() { try { return typeof clLocked === 'function' && typeof ME !== 'undefined' && ME && clLocked(ME); } catch (e) { return false; } }
  /* make the phone field required (unless locked) and add the pickup field right after it */
  function patchHtml(x, val, phoneReq) {
    x = String(x);
    if (phoneReq) x = x.replace(/<label(?: class="")?>Phone(?: \(optional\))?<\/label>/, '<label class="req">Mobile phone</label>')
      .replace(/(<input type="tel" name="phone"[^>]*?)(?: required)?>/, function (m, a) { return a + ' required inputmode="tel" autocomplete="tel">'; })
      .replace(/You can also sign in with this number\./, 'Required – the office and your crew lead call or text this number. You can also sign in with it.')
      .replace(/Contact only\. SMS reminders only if you add a phone\./, 'Required – the office and your crew lead call or text this number.')
      .replace(/Phone or email – at least one is required\. You can also sign in with either\./, 'Required – the office and your crew lead call or text this number. You can also sign in with it.')
      .replace(/Phone or email – at least one is required\. Wagepoint uses email when you have one\./, 'Optional. Wagepoint (payroll) uses your email when you have one.')
      .replace(/Phone or email – at least one is required\./, 'Optional. You can also sign in with it.')
      .replace(/You need a phone or an email \(at least one\)\. A username is optional\./, 'Optional – if you skip it, your phone number is your login.');
    /* insert after the phone block (the <div> that holds the phone input) */
    var i = x.indexOf('name="phone"');
    if (i < 0) return x;
    var end = x.indexOf('</div></div>', i);          /* end of hint + wrapper  */
    var endNoHint = x.indexOf('></div>', i);         /* phone field without a hint */
    var cut;
    if (end >= 0 && (endNoHint < 0 || end <= endNoHint + 40)) cut = end + '</div></div>'.length;
    else cut = endNoHint + '></div>'.length;
    return x.slice(0, cut) + pickupField(val, true) + x.slice(cut);
  }
  function checkFields(d, phoneReq) {
    if (phoneReq && !tenDigits(d.phone)) { toast('Please add a 10-digit mobile phone number – it is required.'); return false; }
    if (!addrOk(d.pickup)) { toast('Please add your pickup address – street and number, town and postal code.'); return false; }
    return true;
  }

  /* ---------- sign up ---------- */
  if (typeof VIEWS.signupForm === 'function') {
    var _sf = VIEWS.signupForm;
    VIEWS.signupForm = function (h) {
      var x = _sf(h), t = String(h || '').split('/')[2];
      if (!NEED[t]) return x;
      return patchHtml(x, '', true);
    };
  }
  /* pickup1 (Oct 21 2026): the address now travels WITH the sign-up call (user_metadata pickup_address, stored by the
     sign-up trigger – migration 027-pickup1). Backup: the address is kept in sessionStorage (this tab only) and saved by
     ACCOUNT ID the first time that account opens in this tab – no time limit, no name matching. If sign-up fails, the
     backup is dropped at once (the old 60 s poll is gone). */
  var PKEY = 'us-pickup-pending';
  function pend() { try { return JSON.parse(sessionStorage.getItem(PKEY) || 'null'); } catch (e) { return null; } }
  function setPend(o) { try { if (o) sessionStorage.setItem(PKEY, JSON.stringify(o)); else sessionStorage.removeItem(PKEY); } catch (e) {} }
  window.REG_PICKUP_ADDR = function (d) { return d && NEED[d.type] && addrOk(d.pickup) ? cleanAddr(d.pickup).slice(0, 300) : null; };
  /* called by store-supabase.js selfSignup when it ends: id = the new account id, or null when sign-up failed */
  window.REG_PICKUP_SIGNUP_DONE = function (id) { var p = pend(); if (!p) return; if (!id) setPend(null); else { p.id = String(id); setPend(p); applyPend(); } };
  function applyPend() {
    var p = pend(); if (!p || !p.id || typeof ME === 'undefined' || !ME || String(ME.id) !== p.id) return false;
    if (NEED[ME.type] && !cleanAddr(ME.pickupAddress)) { ME.pickupAddress = p.addr; if (typeof save === 'function') save(); }
    setPend(null); return true;
  }
  window.REG_PICKUP_APPLY = applyPend;
  if (typeof FORMS.signup === 'function') {
    var _su = FORMS.signup;
    FORMS.signup = function (f, d) {
      if (!(d && NEED[d.type])) return _su(f, d);
      if (!checkFields(d, true)) return;
      setPend({ addr: cleanAddr(d.pickup).slice(0, 300), id: null, at: Date.now() });
      var n = (typeof DB !== 'undefined' && DB.users) ? DB.users.length : -1;
      var out = _su(f, d);
      if (!window.REG_LIVE) {                     /* mock / local test: sign-up is synchronous */
        var made = n >= 0 && DB.users.length > n ? DB.users[DB.users.length - 1] : null;
        if (made) { window.REG_PICKUP_SIGNUP_DONE(made.id); if (typeof ME !== 'undefined' && ME === made) { applyPend(); } }
        else setPend(null);
      }
      return out;
    };
  }

  /* ---------- my profile / my details ---------- */
  if (typeof VIEWS.profile === 'function') {
    var _pf = VIEWS.profile;
    VIEWS.profile = function () {
      var x = _pf();
      if (!(typeof ME !== 'undefined' && ME && NEED[ME.type])) return x;
      return patchHtml(x, ME.pickupAddress || '', !phoneLocked());
    };
  }
  if (typeof FORMS.profile === 'function') {
    var _fp = FORMS.profile;
    FORMS.profile = function (f, d) {
      if (typeof ME !== 'undefined' && ME && NEED[ME.type]) { if (!checkFields(d, !phoneLocked())) return; ME.pickupAddress = cleanAddr(d.pickup); }
      return _fp(f, d);
    };
  }
  ['worker:details', 'employee:details', 'worker:register', 'employee:register'].forEach(function (k) {
    if (typeof VIEWS[k] !== 'function') return;
    var o = VIEWS[k];
    VIEWS[k] = function (h) { var x = o(h); if (typeof ME !== 'undefined' && ME && NEED[ME.type] && String(x).indexOf('name="phone"') >= 0 && String(x).indexOf('name="pickup"') < 0) x = patchHtml(x, ME.pickupAddress || '', !phoneLocked()); return x; };
  });
  ['regWorker', 'regEmp'].forEach(function (k) {
    if (typeof FORMS[k] !== 'function') return;
    var o = FORMS[k];
    FORMS[k] = function (f, d) {
      if (typeof ME !== 'undefined' && ME && NEED[ME.type] && d && 'pickup' in d) { if (!checkFields(d, !phoneLocked())) return; ME.pickupAddress = cleanAddr(d.pickup); }
      return o(f, d);
    };
  });

  /* ---------- office: person record ---------- */
  if (typeof showPerson === 'function') {
    var _sp = showPerson;
    showPerson = function (id) {
      _sp(id);
      try {
        var u = typeof user === 'function' ? user(id) : null;
        if (!u || !NEED[u.type]) return;
        var kv = document.querySelector('#modal .kv');
        if (kv && kv.innerHTML.indexOf('>' + LABEL + '<') < 0) kv.insertAdjacentHTML('beforeend', '<div>' + LABEL + '</div><div>' + esc_(u.pickupAddress || '(not given yet)') + '</div>');
      } catch (e) {}
    };
  }

  /* ---------- pickup1: optional "Text me sign-in codes" consent (sign-up + My profile) ----------
     Stored on the person (smsConsent, smsConsentAt) and – live – in auth user_metadata (sms_consent, sms_consent_at,
     app 'us', phone_e164). Nothing here turns on or calls Supabase phone auth or SMS. */
  var SMS_TEXT = "We'll text sign-in codes from UnScramble. Msg rates may apply. Reply STOP to stop.";
  function e164(ph) { var d = tenDigits(ph); return d ? '+1' + d : null; }
  window.REG_SMS_E164 = e164;
  function smsField(on) {
    return '<div class="pk-sms"><label class="inline"><input type="checkbox" name="smsConsent"' + (on ? ' checked' : '') + '> Text me sign-in codes</label>' +
      '<div class="hint">' + esc_(SMS_TEXT) + ' Optional.</div></div>';
  }
  function addSms(x, on) {
    x = String(x); if (x.indexOf('name="smsConsent"') >= 0) return x;
    var i = x.indexOf('name="pickup"'); if (i < 0) i = x.indexOf('name="phone"'); if (i < 0) return x;
    var j = x.indexOf('<div class="hint pk-privacy">', i), cut;
    if (j >= 0 && x.indexOf('name="pickup"') >= 0) cut = x.indexOf('</div></div>', j) + 12;
    else { var f = x.indexOf('</form>', i); var bt = x.lastIndexOf('<button', f); cut = bt > i ? bt : -1; }
    return cut > 0 ? x.slice(0, cut) + smsField(on) + x.slice(cut) : x;
  }
  window.REG_SMS_META = function (d) {
    var on = !!(d && d.smsConsent);
    return { app: 'us', sms_consent: on, sms_consent_at: on ? new Date().toISOString() : null, phone_e164: e164(d && d.phone) };
  };
  if (typeof VIEWS.signupForm === 'function') {
    var _sf2 = VIEWS.signupForm;
    VIEWS.signupForm = function (h) { var x = _sf2(h), t = String(h || '').split('/')[2]; return t === 'firm' ? x : addSms(x, false); };
  }
  if (typeof FORMS.signup === 'function') {
    var _su2 = FORMS.signup;
    FORMS.signup = function (f, d) {
      var n = (typeof DB !== 'undefined' && DB.users) ? DB.users.length : -1, out = _su2(f, d);
      if (!window.REG_LIVE && n >= 0 && DB.users.length > n && d) {       /* mock: put it on the new person */
        var u = DB.users[DB.users.length - 1], m = window.REG_SMS_META(d);
        u.smsConsent = m.sms_consent; u.smsConsentAt = m.sms_consent_at; if (typeof save === 'function') save();
      }
      return out;
    };
  }
  if (typeof VIEWS.profile === 'function') {
    var _pf2 = VIEWS.profile;
    VIEWS.profile = function () { var x = _pf2(); return (typeof ME !== 'undefined' && ME && ME.type !== 'firm') ? addSms(x, !!ME.smsConsent) : x; };
  }
  if (typeof FORMS.profile === 'function') {
    var _fp2 = FORMS.profile;
    FORMS.profile = function (f, d) {
      if (typeof ME !== 'undefined' && ME && d && f && f.querySelector && f.querySelector('[name="smsConsent"]')) {
        var on = !!d.smsConsent, was = !!ME.smsConsent;
        if (on !== was) {
          ME.smsConsent = on; ME.smsConsentAt = on ? new Date().toISOString() : null;
          if (typeof audit === 'function') audit('Text sign-in codes consent ' + (on ? 'given' : 'withdrawn'), ME.name, '');
          if (window.REG_SMS_UPDATE) window.REG_SMS_UPDATE({ app: 'us', sms_consent: on, sms_consent_at: ME.smsConsentAt, phone_e164: e164(d.phone || ME.phone) });
        }
      }
      return _fp2(f, d);
    };
  }

  /* ---------- pickup1: sign-in with no address -> My profile, field highlighted ---------- */
  function needsAddr(u) { return !!(u && NEED[u.type] && !u.usCrew && !cleanAddr(u.pickupAddress)); }
  window.REG_PICKUP_MISSING = needsAddr;
  /* office People: a red "No pickup address" badge on each worker/employee row that has none */
  function pkBadges() {
    var bar = document.getElementById('pk-filter'); if (!bar || typeof DB === 'undefined') return;
    DB.users.filter(needsAddr).forEach(function (u) {
      var b = document.querySelector('#app [data-act="person"][data-id="' + String(u.id).replace(/"/g, '') + '"]'); if (!b) return;
      var row = b.closest('tr') || b.parentNode, cell = row.querySelector('td') || row;
      if (!cell.querySelector('.pk-badge')) cell.insertAdjacentHTML('beforeend', ' <span class="pk-badge" title="Worker/employee has no pickup address">No pickup address</span>');
    });
  }
  /* ui.js binds hashchange to the ORIGINAL render, so this runs both from a wrapped render() and from its own
     hashchange listener (added after ui.js's, so it runs after the screen is drawn). */
  function pkAfter() {
    try {
      pkBadges();
      if (typeof ME === 'undefined' || !ME) return;
      applyPend();
      var h = (location.hash || '#/').split('?')[0];
      if (needsAddr(ME) && !ME.mustChangePw && (h === '#/' || h === '#/home' || h === '')) {
        PAGE_STATE.pickupNeed = true; location.hash = '#/profile'; return;          /* hashchange draws My profile */
      }
      var el = document.querySelector('#app input[name="pickup"]');
      if (el && PAGE_STATE.pickupNeed && needsAddr(ME)) {
        var box = el.parentNode; box.classList.add('pk-need');
        if (!document.getElementById('pk-need-msg')) box.insertAdjacentHTML('afterbegin', '<div id="pk-need-msg" class="alert warn">Please add your pickup address – the crew van needs it. Then press Save.</div>');
        setTimeout(function () { try { el.scrollIntoView({ block: 'center' }); el.focus(); } catch (e) {} }, 50);
      } else if (!needsAddr(ME)) PAGE_STATE.pickupNeed = false;
    } catch (e) {}
  }
  if (typeof render === 'function') {
    var _render = render;
    render = window.render = function () { var r = _render.apply(this, arguments); pkAfter(); return r; };
  }
  window.addEventListener('hashchange', function () { setTimeout(pkAfter, 0); });
  (function () { try { var st = document.createElement('style'); st.textContent = '.pk-need{outline:3px solid #e0a100;outline-offset:4px;border-radius:8px;background:#fff8e1;padding:6px}.pk-badge{display:inline-block;margin-left:6px;padding:1px 7px;border-radius:10px;background:#fde2e1;color:#8a1c14;font-size:12px;font-weight:600;white-space:nowrap}'; document.head.appendChild(st); } catch (e) {} })();

  /* ---------- pickup1: office People – "No pickup address" badge + filter ---------- */
  if (VIEWS['admin:people']) {
    var _pp = VIEWS['admin:people'];
    VIEWS['admin:people'] = function () {
      var only = !!PAGE_STATE.pkMissOnly, all = DB.users, x;
      try {
        if (only) DB.users = all.filter(needsAddr);
        x = String(_pp.apply(this, arguments));
      } finally { DB.users = all; }
      if (x.indexOf('<h1>People') < 0) return x;          /* a person page is open – leave it */
      var miss = all.filter(needsAddr);
      var bar = '<div class="row" id="pk-filter"><button class="small ' + (only ? '' : 'sec') + '" data-act="pkmiss">' + (only ? 'Show everyone' : 'Missing pickup address (' + miss.length + ')') + '</button></div>';
      var k = x.indexOf('</form>'); x = k >= 0 ? x.slice(0, k + 7) + bar + x.slice(k + 7) : bar + x;
      return x;
    };
    ACT.pkmiss = function () { PAGE_STATE.pkMissOnly = !PAGE_STATE.pkMissOnly; render(); };
  }
})();
