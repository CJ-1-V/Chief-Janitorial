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
      (req ? ' required' : '') + ' placeholder="' + esc_(PH) + '" autocomplete="street-address"><div class="hint">' + HINT + '</div></div>';
  }
  /* make the phone field required and add the pickup field right after it */
  function patchHtml(x, val) {
    x = String(x);
    x = x.replace(/<label(?: class="")?>Phone(?: \(optional\))?<\/label>/, '<label class="req">Mobile phone</label>')
      .replace(/(<input type="tel" name="phone"[^>]*?)(?: required)?>/, function (m, a) { return a + ' required inputmode="tel" autocomplete="tel">'; })
      .replace(/You can also sign in with this number\./, 'Required – the office and your crew lead call or text this number. You can also sign in with it.')
      .replace(/Contact only\. SMS reminders only if you add a phone\./, 'Required – the office and your crew lead call or text this number.');
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
  function checkFields(d) {
    if (!tenDigits(d.phone)) { toast('Please add a 10-digit mobile phone number – it is required.'); return false; }
    if (!addrOk(d.pickup)) { toast('Please add your pickup address – street and number, town and postal code.'); return false; }
    return true;
  }

  /* ---------- sign up ---------- */
  if (typeof VIEWS.signupForm === 'function') {
    var _sf = VIEWS.signupForm;
    VIEWS.signupForm = function (h) {
      var x = _sf(h), t = String(h || '').split('/')[2];
      if (!NEED[t]) return x;
      return patchHtml(x, '');
    };
  }
  if (typeof FORMS.signup === 'function') {
    var _su = FORMS.signup;
    FORMS.signup = function (f, d) {
      if (d && NEED[d.type]) {
        if (!checkFields(d)) return;
        var name = d.name, addr = cleanAddr(d.pickup), tries = 0;
        /* the live sign-up is asynchronous: once the new account is loaded, store the address and save */
        var tm = setInterval(function () {
          tries++;
          if (typeof ME !== 'undefined' && ME && ME.name === name && NEED[ME.type]) {
            if (ME.pickupAddress !== addr) { ME.pickupAddress = addr; if (typeof save === 'function') save(); }
            clearInterval(tm);
          } else if (tries > 120) clearInterval(tm);   /* ~60 s */
        }, 500);
      }
      return _su(f, d);
    };
  }

  /* ---------- my profile / my details ---------- */
  if (typeof VIEWS.profile === 'function') {
    var _pf = VIEWS.profile;
    VIEWS.profile = function () {
      var x = _pf();
      if (!(typeof ME !== 'undefined' && ME && NEED[ME.type])) return x;
      return patchHtml(x, ME.pickupAddress || '');
    };
  }
  if (typeof FORMS.profile === 'function') {
    var _fp = FORMS.profile;
    FORMS.profile = function (f, d) {
      if (typeof ME !== 'undefined' && ME && NEED[ME.type]) { if (!checkFields(d)) return; ME.pickupAddress = cleanAddr(d.pickup); }
      return _fp(f, d);
    };
  }
  ['worker:details', 'employee:details', 'worker:register', 'employee:register'].forEach(function (k) {
    if (typeof VIEWS[k] !== 'function') return;
    var o = VIEWS[k];
    VIEWS[k] = function (h) { var x = o(h); if (typeof ME !== 'undefined' && ME && NEED[ME.type] && String(x).indexOf('name="phone"') >= 0 && String(x).indexOf('name="pickup"') < 0) x = patchHtml(x, ME.pickupAddress || ''); return x; };
  });
  ['regWorker', 'regEmp'].forEach(function (k) {
    if (typeof FORMS[k] !== 'function') return;
    var o = FORMS[k];
    FORMS[k] = function (f, d) {
      if (typeof ME !== 'undefined' && ME && NEED[ME.type] && d && 'pickup' in d) { if (!checkFields(d)) return; ME.pickupAddress = cleanAddr(d.pickup); }
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
})();
