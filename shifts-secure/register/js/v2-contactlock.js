/* v2-contactlock.js – contactlock1 (Oct 7 2026). Loaded after v2-farmhome.js. TEST COPY until the owner OKs it.
   Owner, Oct 7 2026 12:37 AM ET: "Make either the phone or email must for farms and employees to register and they
   can not change that without office approval". Owner rule: "employee" includes subcontractors (also workers / crew leads).
   - Farms (firm) + employees + workers + crew leads + subcontractors: at least one of phone OR email on register /
     invite / profile create. Clear message if both empty. Existing accounts that already have one stay locked;
     accounts with neither get a blocking banner and must add one before continuing.
   - Once phone and/or email is saved, those fields are read-only for the person. Note: "Contact the office to change
     your phone or email". "Request change" → types new values → office Approves / Rejects (stored on the user record
     as contactChangeReq; no DB migration – rides in reg_accounts.data JSON like other profile fields).
   - Office can edit phone/email directly on People → Open, and approve/reject pending requests there.
   Real farm names are never shown to employees/subcontractors (unchanged). UnScramble theme. Turn off: remove the tags. */
'use strict';
(function () {
  var CL_TYPES = { firm: 1, employee: 1, worker: 1, sub: 1 };
  var LOCK_NOTE = 'Contact the office to change your phone or email';
  var NEED_MSG = 'Please add a phone number or an email – at least one is required to register.';
  var FORCE_MSG = 'Please add a phone number or an email before you continue. At least one is required.';

  function clApplies(u) { return !!(u && CL_TYPES[u.type]); }
  function clEmail(u) { return String((u && u.email) || '').trim(); }
  function clPhone(u) { return String((u && u.phone) || '').trim(); }
  function clHasEmail(u) { return !!clEmail(u); }
  function clHasPhone(u) { return !!clPhone(u); }
  function clHasContact(u) { return clHasEmail(u) || clHasPhone(u); }
  function clNeed(u) { return clApplies(u) && !clHasContact(u); }
  function clLocked(u) { return clApplies(u) && clHasContact(u); }
  function clPhoneOk(p) {
    p = String(p || '').trim();
    if (!p) return true;
    if (typeof loginDigits === 'function') return !!loginDigits(p);
    var d = p.replace(/\D/g, '');
    return d.length === 10 || (d.length === 11 && d[0] === '1');
  }
  function clEmailOk(e) {
    e = String(e || '').trim();
    if (!e) return true;
    if (typeof validEmail === 'function') return validEmail(e);
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
  }
  function clCheck(email, phone) {
    var e = String(email || '').trim(), p = String(phone || '').trim();
    if (!e && !p) return NEED_MSG;
    if (e && !clEmailOk(e)) return 'That email does not look right.';
    if (p && !clPhoneOk(p)) return 'Please enter a 10-digit phone number, or an email.';
    return null;
  }
  function clPending(u) {
    var r = u && u.contactChangeReq;
    return r && r.status === 'Pending' ? r : null;
  }
  function clIsOffice() { return ME && ME.type === 'admin'; }

  window.clHasContact = clHasContact;
  window.clNeed = clNeed;
  window.clLocked = clLocked;
  window.clCheck = clCheck;
  window.clApplies = clApplies;

  /* Mock seed: firmB / worker2 ship with neither phone nor email for username-only demos.
     Give them a phone so they behave as "already has contact → locked" (owner rule 4).
     Force-add for accounts with neither is still covered by a dedicated test user. */
  (function () {
    if (typeof seedData !== 'function') return;
    var os = seedData;
    seedData = function () {
      var db = os.apply(this, arguments);
      (db.users || []).forEach(function (u) {
        if (u.username === 'firmB' && !String(u.email || '').trim() && !String(u.phone || '').trim()) u.phone = '902-555-0202';
        if (u.username === 'worker2' && !String(u.email || '').trim() && !String(u.phone || '').trim()) u.phone = '902-555-0203';
        if (u.username === 'tester2' && !String(u.email || '').trim() && !String(u.phone || '').trim()) { /* testers not in CL_TYPES */ }
      });
      return db;
    };
  })();

  /* ---------- Force-add gate (accounts with neither phone nor email) ---------- */
  (function () {
    if (typeof gateRoute !== 'function' || typeof gateNav !== 'function') return;
    var or = gateRoute, on = gateNav;
    gateRoute = function (h) {
      h = or(h);
      if (!ME || !clNeed(ME)) return h;
      if (h === '#/profile' || h === '#/pending' || h === '#/changepw' || h === '#/terms') return h;
      return '#/profile';
    };
    gateNav = function (u) {
      var g = on(u);
      if (!clNeed(u)) return g;
      if (g) return g.concat([['#/profile', 'Add phone or email']]);
      return [['#/profile', 'Add phone or email']];
    };
  })();

  /* ---------- Signup: require phone OR email (relax old "email required" for employee/sub/firm) ---------- */
  (function () {
    if (typeof VIEWS === 'undefined' || !VIEWS.signup) return;
    var os = VIEWS.signup;
    VIEWS.signup = function () {
      return String(os()).replace(
        /Phone number is optional for every account type\./g,
        'Farms, employees and subcontractors need a phone number or an email (at least one).'
      );
    };
  })();

  (function () {
    if (typeof VIEWS === 'undefined' || !VIEWS.signupForm) return;
    var of = VIEWS.signupForm;
    VIEWS.signupForm = function (h) {
      var t = (h || '').split('/')[2], x = of(h);
      if (!CL_TYPES[t] || t === 'firm') return x; /* firm form is overridden in v2-farmrates; patched below */
      x = x.replace(/req:(t==='sub'\|\|t==='employee')/g, 'req:false'); /* no-op if already rendered */
      /* Rendered HTML: flip required email → optional, update hints, mark phone as (phone or email) */
      if (t === 'employee' || t === 'sub') {
        x = x.replace(/<label class="req">Personal email<\/label>/, '<label>Personal email</label>')
          .replace(/<label class="req">Business email<\/label>/, '<label>Business email</label>')
          .replace(/(name="email"[^>]*?) required/g, '$1')
          .replace(/Needed for Wagepoint \(payroll portal\)\./g, 'Phone or email – at least one is required. Wagepoint uses email when you have one.')
          .replace(/Needed for invoices and alerts\./g, 'Phone or email – at least one is required.')
          .replace(/<label>Phone \(optional\)<\/label>/, '<label>Phone</label>')
          .replace(/You can also sign in with this number\./g, 'Phone or email – at least one is required. You can also sign in with either.');
      }
      if (t === 'worker') {
        x = x.replace(/You need a username, an email or a phone number\./g, 'You need a phone or an email (at least one). A username is optional.')
          .replace(/Optional if you give a username or a phone number\./g, 'Phone or email – at least one is required.')
          .replace(/<label>Phone \(optional\)<\/label>/, '<label>Phone</label>');
      }
      return x;
    };
  })();

  (function () {
    if (typeof FORMS === 'undefined' || !FORMS.signup) return;
    var os = FORMS.signup;
    FORMS.signup = function (f, d) {
      if (CL_TYPES[d.type]) {
        var err = clCheck(d.email, d.phone);
        if (err) { toast(err); return; }
        /* Allow employee/sub with phone-only (old code required email) */
        if ((d.type === 'sub' || d.type === 'employee') && !String(d.email || '').trim() && String(d.phone || '').trim()) {
          d = Object.assign({}, d);
          /* pass through – wrap by temporarily relaxing: call after patching check */
        }
      }
      if (CL_TYPES[d.type] && (d.type === 'sub' || d.type === 'employee') && !String(d.email || '').trim()) {
        /* Old FORMS.signup bails if !d.email for sub/employee. Call a patched path. */
        if (!d.username && !d.email && !loginDigits(d.phone)) { toast(NEED_MSG); return; }
        if (d.pw.length < 6) { toast('That password is too short.'); return; }
        if (d.pw !== d.pw2) { toast('The two passwords are not the same. Please type them again.'); return; }
        if (loginTaken(d.username, d.email) || (!d.username && !d.email && DB.users.some(function (x) {
          var p = loginDigits(x.phone); return p && p === loginDigits(d.phone);
        }))) { toast('That login is already used. Try signing in, or use a different email, phone or username.'); return; }
        if (d.type === 'worker' && !d.subId) { toast('Please choose your employer (the crew company that hired you).'); return; }
        var u = { id: uid('u'), type: d.type, name: d.name, username: d.username, email: d.email || '', phone: d.phone || '', passHash: hashPw(d.pw), active: true, suspended: false, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(), profile: {}, roles: [], orientations: [], approved: d.type === 'tester' };
        if (d.type === 'sub') {
          var code = d.name.replace(/[^A-Za-z]/g, '').toUpperCase().slice(0, 3) || 'SUB';
          while (users('sub').some(function (s) { return s.code === code; })) code = code.slice(0, 2) + String.fromCharCode(65 + Math.floor(Math.random() * 26));
          u.code = code;
          u.company = { legalName: d.name, email: d.email || '', phone: d.phone || '', mainContact: {}, emergency: {}, periodStart: today() };
        }
        if (d.type === 'employee') {
          var nm = d.name.split(' ');
          u.profile = { firstName: nm[0], lastName: nm.slice(1).join(' '), provEmp: 'PE', payFreq: 'Bi-weekly', vacPct: 4 };
        }
        DB.users.push(u); ME = u; sessionStorage.setItem('us-test-me', u.id);
        recordConsent(u, !!d.consent);
        audit('Account created', u.name, TYPES[u.type]);
        track('signup', '#/signup/' + d.type);
        notify('admin', 'New ' + TYPES[u.type] + ' sign-up: ' + u.name);
        save(); toast('Account created ✓'); go(missingTerms(u).length ? '#/terms' : '#/home');
        return;
      }
      return os(f, d);
    };
  })();

  /* Farm signup (v2-farmrates FORMS.firmsignup): phone OR email */
  (function () {
    function patchFirmView() {
      if (typeof VIEWS === 'undefined' || !VIEWS.signupForm) return;
      var of = VIEWS.signupForm;
      VIEWS.signupForm = function (h) {
        var x = of(h);
        if ((h || '').split('/')[2] !== 'firm') return x;
        return x
          .replace(/<label class="req">Business email<\/label>/, '<label>Business email</label>')
          .replace(/(name="email"[^>]*?) required/g, '$1')
          .replace(/<label>Phone \(optional\)<\/label>/, '<label>Phone</label>')
          .replace(/(name="phone"[^>]*>)/, '$1')
          .replace(
            /After you send this, your account is <b>Pending office review<\/b>\./,
            'Phone or email – at least one is required. After you send this, your account is <b>Pending office review</b>.'
          );
      };
    }
    patchFirmView();
    /* Re-patch after a tick in case farmrates wrapped after us – we load after farmhome, farmrates loads earlier so we're after it. */
  })();

  (function () {
    if (typeof FORMS === 'undefined') return;
    var wrapFirm = function () {
      if (!FORMS.firmsignup || FORMS.firmsignup._cl) return;
      var of = FORMS.firmsignup;
      FORMS.firmsignup = function (f, d) {
        var err = clCheck(d.email, d.phone);
        if (err) { toast(err); return; }
        if (!d.name || !d.contact) { toast('Enter the farm name and contact person.'); return; }
        if (d.pw.length < 6) { toast('Password must be at least 6 characters.'); return; }
        if (d.pw !== d.pw2) { toast('Passwords do not match.'); return; }
        if (loginTaken(d.username, d.email)) { toast('That username or email is already used.'); return; }
        if (!String(d.email || '').trim() && String(d.phone || '').trim()) {
          /* phone-only farm: old firmsignup required email – create here */
          var u = { id: uid('u'), type: 'firm', name: d.name, username: d.username, email: '', phone: d.phone, passHash: hashPw(d.pw), active: true, suspended: false, approved: false, accountApproved: false, createdAt: new Date().toISOString(), lastLogin: new Date().toISOString(), profile: {}, roles: [], orientations: [], firm: { billRate: 0, contact: d.contact, siteRequest: d.site || '' } };
          DB.users.push(u); ME = u; sessionStorage.setItem('us-test-me', u.id);
          audit('Farm sign-up requested', u.name, 'Pending office review');
          notify('admin', 'New farm sign-up – Pending office review: ' + u.name + ' (contact ' + d.contact + ', phone ' + d.phone + '). Set its labour rates in Farms.');
          if (typeof logLogin === 'function') logLogin(u, u.username || u.phone, true, 'New farm account (signed up)');
          save(); toast('Request sent – pending office review.'); go('#/pending');
          return;
        }
        return of(f, d);
      };
      FORMS.firmsignup._cl = 1;
    };
    wrapFirm();
    setTimeout(wrapFirm, 0);
  })();

  /* Employee / worker registration forms */
  (function () {
    if (typeof FORMS === 'undefined') return;
    if (FORMS.regEmp) {
      var oe = FORMS.regEmp;
      FORMS.regEmp = function (f, d) {
        if (clLocked(ME)) {
          d = Object.assign({}, d, { email: ME.email || '', phone: ME.phone || '' });
        } else {
          var err = clCheck(d.email, d.phone);
          if (err) { toast(err); return; }
        }
        return oe(f, d);
      };
    }
    if (FORMS.regWorker) {
      var ow = FORMS.regWorker;
      FORMS.regWorker = function (f, d) {
        if (clLocked(ME)) {
          d = Object.assign({}, d, { email: ME.email || '', phone: ME.phone || '' });
        } else {
          var err = clCheck(d.email, d.phone);
          if (err) { toast(err); return; }
        }
        return ow(f, d);
      };
    }
  })();

  /* Registration views: lock phone/email fields when already set */
  function clLockFieldsInHtml(x, u) {
    if (!clLocked(u)) return x;
    var note = '<div class="cl-locknote hint">' + esc(LOCK_NOTE) + '</div>';
    /* Make email + phone inputs readonly (keep values in FormData) and drop required */
    x = x.replace(/(<input[^>]*name="email"[^>]*)(\/?>)/gi, function (m, a, b) {
      if (/\breadonly\b/i.test(a) || /\bdisabled\b/i.test(a)) return m;
      return a.replace(/\srequired\b/gi, '') + ' readonly class="cl-locked"' + b;
    });
    x = x.replace(/(<input[^>]*name="phone"[^>]*)(\/?>)/gi, function (m, a, b) {
      if (/\breadonly\b/i.test(a) || /\bdisabled\b/i.test(a)) return m;
      return a.replace(/\srequired\b/gi, '') + ' readonly class="cl-locked"' + b;
    });
    if (x.indexOf('cl-locknote') < 0) {
      var i = x.search(/name="phone"/i);
      if (i < 0) i = x.search(/name="email"/i);
      if (i >= 0) {
        var close = x.indexOf('</div>', i);
        if (close > 0) x = x.slice(0, close + 6) + note + x.slice(close + 6);
      }
    }
    return x;
  }

  (function () {
    ['employee:register', 'worker:register'].forEach(function (k) {
      if (!VIEWS[k]) return;
      var ov = VIEWS[k];
      VIEWS[k] = function () {
        var u = ME, x = ov();
        if (clLocked(u)) return clLockFieldsInHtml(x, u);
        if (clApplies(u)) {
          /* Phone OR email – drop the old "email required" on the registration form */
          x = x.replace(/<label class="req">Personal email<\/label>/, '<label>Personal email</label>')
            .replace(/(name="email"[^>]*?) required/g, '$1')
            .replace(/Wagepoint uses it to invite you to the employee portal\./g, 'Phone or email – at least one is required. Wagepoint uses email when you have one.')
            .replace(/<label[^>]*>Phone \(optional\)<\/label>/, '<label>Phone</label>')
            .replace(/(name="phone"[^>]*>)/, function (m) { return m; });
          if (x.indexOf('cl-orhint') < 0) {
            x = x.replace('<fieldset><legend>Basic information</legend>',
              '<div class="hint cl-orhint">Phone or email – at least one is required.</div><fieldset><legend>Basic information</legend>');
          }
        }
        return x;
      };
    });
  })();

  /* ---------- Profile: lock / force-add / request change ---------- */
  (function () {
    if (typeof VIEWS === 'undefined' || !VIEWS.profile) return;
    var op = VIEWS.profile;
    VIEWS.profile = function () {
      var u = ME, x = op();
      if (!clApplies(u)) return x;

      if (clNeed(u)) {
        var banner = '<div class="alert bad cl-force" id="clforce"><b>' + esc(FORCE_MSG) + '</b> Add a phone number or an email below, then Save.</div>';
        x = x.replace('<form data-form="profile">', banner + '<form data-form="profile" class="cl-forceform">');
        /* Ensure email/phone are editable and not required individually */
        x = x.replace(/(name="email"[^>]*?) required/g, '$1')
          .replace(/<label class="req">Email<\/label>/, '<label>Email</label>')
          .replace(/Phone \(optional\)/g, 'Phone')
          .replace(/Contact only\. SMS reminders only if you add a phone\./g, 'Phone or email – at least one is required.');
        return x;
      }

      if (clLocked(u)) {
        x = clLockFieldsInHtml(x, u);
        var pend = clPending(u);
        var box = '<div class="card cl-reqcard" id="clreq"><h3 style="margin-top:0">Phone &amp; email</h3>' +
          '<p class="small">' + esc(LOCK_NOTE) + '</p>' +
          '<div class="kv"><div>Email</div><div>' + esc(clEmail(u) || '(none)') + '</div><div>Phone</div><div>' + esc(clPhone(u) || '(none)') + '</div></div>';
        if (pend) {
          box += '<div class="alert warn small cl-pend">Change requested – waiting for the office' +
            (pend.email != null ? '<br>New email: ' + esc(pend.email || '(clear)') : '') +
            (pend.phone != null ? '<br>New phone: ' + esc(pend.phone || '(clear)') : '') +
            '</div>';
        } else {
          box += '<form data-form="clreq"><div class="grid2">' +
            inp('email', 'New email (optional)', '', { type: 'email', hint: 'Leave blank to keep your current email, or type a new one.' }) +
            inp('phone', 'New phone (optional)', '', { type: 'tel', hint: 'Leave blank to keep your current phone, or type a new one.' }) +
            '</div><p class="small muted">Send at least one new value. The office must approve before it changes.</p>' +
            '<button class="sec" type="submit">Request change</button></form>';
        }
        box += '</div>';
        /* Insert request card after the first profile card */
        var m = x.match(/<\/form><\/div>/);
        if (m) {
          var at = x.indexOf(m[0]) + m[0].length;
          x = x.slice(0, at) + box + x.slice(at);
        } else {
          x += box;
        }
      }
      return x;
    };
  })();

  FORMS.clreq = function (f, d) {
    var u = ME;
    if (!clApplies(u) || !clLocked(u)) { toast('Not available.'); return; }
    if (clPending(u)) { toast('You already have a change waiting for the office.'); return; }
    var ne = String(d.email || '').trim(), np = String(d.phone || '').trim();
    if (!ne && !np) { toast('Enter a new phone or a new email to request.'); return; }
    if (ne && !clEmailOk(ne)) { toast('That email does not look right.'); return; }
    if (np && !clPhoneOk(np)) { toast('Please enter a 10-digit phone number.'); return; }
    if (ne && loginTaken(null, ne, u.id)) { toast('That email is already used by another account.'); return; }
    /* Keep current value when the other field is left blank */
    var req = {
      id: uid('cc'),
      email: ne || clEmail(u),
      phone: np || clPhone(u),
      emailChanged: !!ne && ne !== clEmail(u),
      phoneChanged: !!np && np !== clPhone(u),
      at: new Date().toISOString(),
      status: 'Pending',
      by: u.name
    };
    if (!req.emailChanged && !req.phoneChanged) { toast('That is already your phone/email.'); return; }
    /* If they only typed one field, still require resulting contact non-empty (always true if locked) */
    var err = clCheck(req.email, req.phone);
    if (err) { toast(err); return; }
    u.contactChangeReq = req;
    audit('Requested contact change', u.name, (req.emailChanged ? 'email→' + req.email : '') + (req.phoneChanged ? ' phone→' + req.phone : ''));
    notify('admin', u.name + ' asks to change ' + (req.emailChanged && req.phoneChanged ? 'phone and email' : req.emailChanged ? 'email' : 'phone') + '. Review in People.');
    save(); toast('Request sent to the office.'); render();
  };

  (function () {
    if (typeof FORMS === 'undefined' || !FORMS.profile) return;
    var op = FORMS.profile;
    FORMS.profile = function (f, d) {
      var u = ME;
      if (!clApplies(u)) return op(f, d);

      if (clLocked(u)) {
        /* Ignore any submitted phone/email – keep locked values */
        d = Object.assign({}, d, { email: u.email || '', phone: u.phone || '' });
        return op(f, d);
      }

      /* Force-add path: must set at least one */
      var err = clCheck(d.email, d.phone);
      if (err) { toast(err === NEED_MSG ? FORCE_MSG : err); return; }
      if (d.email && loginTaken(d.username, d.email, u.id)) { toast('That username or email is already taken. Please try another.'); return; }
      return op(f, d);
    };
  })();

  /* ---------- Office: edit contact + approve/reject ---------- */
  FORMS.cloffice = function (f, d) {
    if (!clIsOffice()) { denied('cloffice'); return; }
    var u = user(d.id);
    if (!u || !clApplies(u)) { toast('Not a farm or employee account.'); return; }
    var err = clCheck(d.email, d.phone);
    if (err) { toast(err); return; }
    if (d.email && loginTaken(null, d.email, u.id)) { toast('That email is already used by another account.'); return; }
    var oldE = clEmail(u), oldP = clPhone(u);
    u.email = String(d.email || '').trim();
    u.phone = String(d.phone || '').trim();
    if (u.contactChangeReq && u.contactChangeReq.status === 'Pending') {
      u.contactChangeReq.status = 'Approved';
      u.contactChangeReq.resolvedAt = new Date().toISOString();
      u.contactChangeReq.resolvedBy = ME.name;
      u.contactChangeReq.via = 'office edit';
    }
    audit('Office set contact', u.name, 'email ' + (oldE || '(none)') + '→' + (u.email || '(none)') + '; phone ' + (oldP || '(none)') + '→' + (u.phone || '(none)'));
    notify(u.id, 'The office updated your phone/email. Sign-in still works with your username' + (u.email ? ', email' : '') + (u.phone ? ' or phone' : '') + '.');
    save(); toast('Contact saved.'); showPerson(u.id);
  };

  ACT.clapprove = function (el) {
    if (!clIsOffice()) { denied('clapprove'); return; }
    var u = user(el.dataset.id), r = clPending(u);
    if (!u || !r) { toast('No pending request.'); return; }
    var err = clCheck(r.email, r.phone);
    if (err) { toast(err); return; }
    if (r.email && loginTaken(null, r.email, u.id)) { toast('That email is already used by another account.'); return; }
    var oldE = clEmail(u), oldP = clPhone(u);
    u.email = r.email || '';
    u.phone = r.phone || '';
    r.status = 'Approved';
    r.resolvedAt = new Date().toISOString();
    r.resolvedBy = ME.name;
    audit('Office approved contact change', u.name, 'email ' + oldE + '→' + u.email + '; phone ' + oldP + '→' + u.phone);
    notify(u.id, 'The office approved your phone/email change.');
    save(); toast('Approved ✓'); showPerson(u.id);
  };

  ACT.clreject = function (el) {
    if (!clIsOffice()) { denied('clreject'); return; }
    var u = user(el.dataset.id), r = clPending(u);
    if (!u || !r) { toast('No pending request.'); return; }
    r.status = 'Rejected';
    r.resolvedAt = new Date().toISOString();
    r.resolvedBy = ME.name;
    audit('Office rejected contact change', u.name);
    notify(u.id, 'The office did not approve your phone/email change. Your current contact is unchanged. Contact the office if you need help.');
    save(); toast('Rejected.'); showPerson(u.id);
  };

  if (typeof ADMIN_ONLY_ACT !== 'undefined') {
    ['clapprove', 'clreject'].forEach(function (a) { if (ADMIN_ONLY_ACT.indexOf(a) < 0) ADMIN_ONLY_ACT.push(a); });
  }
  if (typeof ADMIN_ONLY_FORM !== 'undefined' && ADMIN_ONLY_FORM.indexOf('cloffice') < 0) ADMIN_ONLY_FORM.push('cloffice');

  (function () {
    if (typeof showPerson !== 'function') return;
    var op = showPerson;
    showPerson = function (id) {
      op(id);
      var u = user(id), m = document.querySelector('#modal .modal');
      if (!m || !u || !clApplies(u)) return;
      var pend = clPending(u);
      var x = '<h3>Phone &amp; email (office)</h3><p class="small muted">Farms and employees cannot change these themselves. Edit here, or approve a request.</p>';
      if (pend) {
        x += '<div class="alert warn small" id="clpendoffice">Pending change from ' + esc(u.name) +
          '<br>Email: ' + esc(clEmail(u) || '(none)') + ' → <b>' + esc(pend.email || '(none)') + '</b>' +
          '<br>Phone: ' + esc(clPhone(u) || '(none)') + ' → <b>' + esc(pend.phone || '(none)') + '</b>' +
          '<div class="row" style="margin-top:6px"><button class="small" data-act="clapprove" data-id="' + u.id + '">Approve</button> ' +
          '<button class="small danger" data-act="clreject" data-id="' + u.id + '">Reject</button></div></div>';
      }
      x += '<form data-form="cloffice"><input type="hidden" name="id" value="' + u.id + '"><div class="grid2">' +
        inp('email', 'Email', u.email || '', { type: 'email' }) +
        inp('phone', 'Phone', u.phone || '', { type: 'tel' }) +
        '</div><button class="small">Save phone / email</button></form>';
      var d = document.createElement('div');
      d.className = 'cl-office';
      d.innerHTML = x;
      /* Insert near top after the kv block */
      var kv = m.querySelector('.kv');
      if (kv && kv.parentNode) kv.parentNode.insertBefore(d, kv.nextSibling);
      else m.appendChild(d);
    };
  })();

  (function () {
    if (typeof adminFlags !== 'function') return;
    var of = adminFlags;
    adminFlags = function () {
      var f = of();
      var n = (DB.users || []).filter(function (u) { return clPending(u); }).length;
      if (n) f.unshift({ t: 'Contact changes', c: 's-pend', h: n + ' phone/email change request(s) waiting. Open the person in People to Approve or Reject.' });
      var miss = (DB.users || []).filter(function (u) { return u.active !== false && clNeed(u); }).length;
      if (miss) f.push({ t: 'Missing contact', c: 's-warn', h: miss + ' farm/employee account(s) have no phone or email – they will be asked to add one.' });
      return f;
    };
  })();

  /* Allow clreq / cloffice while gated (pending account, force contact) */
  (function () {
    if (typeof actionAllowed !== 'function') return;
    var oa = actionAllowed;
    actionAllowed = function (name, kind) {
      if (ME && ME.accountApproved === false && (name === 'clreq' || name === 'profile')) return true;
      if (ME && clNeed(ME) && (name === 'profile' || name === 'clreq' || name === 'logout' || name === 'closeModal' || name === 'pw')) return true;
      return oa(name, kind);
    };
  })();
})();
