/* UnScramble Registration – REAL data layer (Supabase). Loaded LAST, after every UI script.
 * In mode 'mock' this file does nothing and the app is exactly the owner's test app.
 * In mode 'supabase' it swaps only the plumbing underneath the unchanged screens:
 *   load/save      -> one read call (reg_snapshot, filtered by row-level security) + small background saves of what changed
 *   sign in / up   -> Supabase Auth, the SAME login as Shift Tracker (one session for both, same website)
 *   files          -> private storage bucket "reg-docs" (short signed links to view)
 *   SIN / bank     -> encrypted on the server (reg_set_sensitive / reg_reveal_sensitive); never kept in the browser
 *   quizzes        -> graded on the server (answers never sent to phones)
 * It never writes real data to localStorage. Keep UI changes in the test app; re-sync with tools/sync-from-test.sh. */
(function () {
  'use strict';
  var C = window.REG_STORE;
  if (!C || C.mode !== 'supabase') return;
  if (!window.supabase || !window.supabase.createClient) { document.addEventListener('DOMContentLoaded', function () { document.getElementById('app').innerHTML = '<div class="alert bad">Could not load the sign-in library. Please reload.</div>'; }); return; }
  window.REG_LIVE = true;
  try { document.removeEventListener('DOMContentLoaded', start); } catch (e) {}

  var sb = window.supabase.createClient(C.url, C.key, { auth: { storageKey: C.authStorageKey, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  window.REG_SB = sb;

  /* ---------- collections -> tables ---------- */
  var MAP = { users: 'reg_accounts', sites: 'reg_client_sites', docs: 'reg_documents', acceptances: 'reg_terms_acceptances', consents: 'reg_consents',
    shifts: 'reg_bookings', time: 'reg_time_entries', invoices: 'reg_sub_invoices', records: 'reg_records_requests', feedback: 'reg_feedback',
    notes: 'reg_alerts_outbox', audit: 'reg_audit', events: 'reg_events', logins: 'reg_login_history', privacyReq: 'reg_privacy_requests',
    marketing: 'reg_marketing', convReq: 'reg_conversion_requests', rates: 'reg_sub_rates', deductions: 'reg_deductions',
    holdbackReleases: 'reg_holdback_releases', firmSigs: 'reg_client_signatures', farmRates: 'reg_client_rates', quizAttempts: 'reg_quiz_attempts',
    trainConfirms: 'reg_training_confirmations', clientInvoices: 'reg_client_invoices', crewOrders: 'reg_crew_orders', docBypass: 'reg_doc_bypass',
    changes: 'reg_time_proposals',
    timeVoided: 'reg_time_voided', payExports: 'reg_pay_exports' };                // 016i manual timesheets (office only, insert-only)
  var INSERT_ONLY = { acceptances: 1, consents: 1, firmSigs: 1, audit: 1, events: 1, logins: 1, timeVoided: 1, payExports: 1 };          // history: never changed or removed
  var NEVER_DELETE = { notes: 1, audit: 1, events: 1, logins: 1, acceptances: 1, consents: 1, firmSigs: 1, quizAttempts: 1, docBypass: 1,
    changes: 1, crewOrders: 1, farmRates: 1, users: 1, timeVoided: 1, payExports: 1 };                                                      // the app trims these lists locally
  var SERVER_ONLY = { quizAttempts: 1 };                                                                        // written by server functions only
  var HIDDEN_ID = { audit: 1, events: 1, logins: 1 };
  // 016h (Oct 5 2026): pre-loaded client records (no login yet) are saved to reg_clients (office only; saved before accounts so a
  // login can be linked to a client made in the same save); invite codes (SHA-256 hash only, never the code) to reg_client_invites.
  MAP = Object.assign({ clientRecs: 'reg_clients' }, MAP, { clientInvites: 'reg_client_invites' });
  NEVER_DELETE.clientRecs = 1; NEVER_DELETE.clientInvites = 1;
  function rowsOf(c) { return c === 'clientRecs' ? (DB.users || []).filter(function (u) { return u.preloaded; }) : (DB[c] || []); }
  var MY_ID = null;                                        // the signed-in account (a linked farm login acts for its client; see v2-clientlink.js)

  var BASE = {}, SUSPEND = false, HOLD = 0, TIMER = null, BUSY = false, AGAIN = false, SIGNED_IN = false, SESSION_USER = null;
  var FILES = {}, WARNED = {}, LAST_REFRESH = 0, OFFICE = false, ROLE = null, LOADING = false;

  /* ---------- helpers ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rowKey(coll, row) {
    if (coll === 'sites') return row.id || row.code;
    if (HIDDEN_ID[coll]) { if (!row._id) row._id = uid(coll.slice(0, 2)); return row._id; }
    if (!row.id) row.id = uid(coll.slice(0, 2));
    return row.id;
  }
  function payload(coll, row) {
    var d = clone(row); delete d._id;
    if (coll === 'users' || coll === 'clientRecs') {
      delete d.passHash; delete d.failed; delete d.lockedUntil; delete d.twoStep;
      if (d.profile) { delete d.profile.sin; delete d.profile.bankAcct; }
      if (d.company) { delete d.company.bankAcct; }
    }
    return d;
  }
  function skipRow(coll, row) {
    if (coll === 'users') return row.type === 'admin' || row.employerView || row.crewView || row.anonymous
      || !!row.preloaded                                   // saved as 'clientRecs' (reg_clients)
      || (ROLE === 'firm' && !!MY_ID && row.id !== MY_ID);  // a farm login only ever saves its own account (the client record is office-edited)
    if (coll === 'clientRecs' || coll === 'clientInvites') return !OFFICE;
    if (coll === 'time') return String(row.id || '').indexOf('st-') === 0 || ROLE === 'firm';
    if (coll === 'shifts') return ROLE === 'firm';
    return false;
  }
  function authEmail(login) {
    var s = String(login || '').trim().toLowerCase(), dg = s.replace(/\D/g, '');
    if (!s) return '';
    if (s.indexOf('@') > 0) return s;
    if (/^[\d\s().+-]+$/.test(s) && (dg.length === 10 || (dg.length === 11 && dg[0] === '1'))) return dg.slice(-10) + '@' + C.loginDomain;
    return 'u-' + s.replace(/[^a-z0-9._-]/g, '') + '@' + C.loginDomain;
  }
  /* what a new person signs in with: email if given, otherwise phone (like Shift Tracker), otherwise username */
  function signupLogin(d) {
    if (d.email) return { email: String(d.email).trim().toLowerCase(), shown: String(d.email).trim().toLowerCase() };
    var dg = digits(d.phone);
    if (dg.length === 10 || (dg.length === 11 && dg[0] === '1')) return { email: dg.slice(-10) + '@' + C.loginDomain, shown: dg.slice(-10) };
    if (d.username) return { email: authEmail(d.username), shown: String(d.username).trim() };
    return null;
  }
  function friendly(err) {
    var m = String((err && (err.message || err.error_description)) || err || '');
    if (/Invalid login credentials/i.test(m)) return 'Wrong login or password.';
    if (/already registered|already been registered|duplicate key.*username/i.test(m)) return 'That login is already used. Try signing in, or use a different email / phone / username.';
    if (/rate limit|too many/i.test(m)) return 'Too many tries. Please wait a few minutes and try again.';
    if (/Failed to fetch|NetworkError|network/i.test(m)) return 'No connection. Check your internet and try again.';
    return m.replace(/^.*?ERROR:\s*/, '') || 'Something went wrong.';
  }
  function busy(on, msg) {
    var el = document.getElementById('reg-busy');
    if (on) { if (!el) { el = document.createElement('div'); el.id = 'reg-busy'; el.className = 'toast'; el.style.cssText = 'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9999'; document.body.appendChild(el); } el.textContent = msg || 'Working…'; }
    else if (el) el.remove();
  }

  /* ---------- the app must never seed fake data or keep real data in this browser ---------- */
  var _seedData = window.seedData, SEED_SETTINGS = null;
  function baseSettings() {
    if (!SEED_SETTINGS) { var s = _seedData().settings; s.simDate = ''; SEED_SETTINGS = JSON.stringify(s); }
    return JSON.parse(SEED_SETTINGS);
  }
  function emptyDB() {
    var d = { version: 1, createdAt: new Date().toISOString(), settings: baseSettings(), orderSeq: 0 };
    Object.keys(MAP).forEach(function (k) { d[k] = []; });
    return d;
  }
  Object.keys(window).forEach(function (k) { if (/^seed[A-Z]/.test(k) && typeof window[k] === 'function') window[k] = function () {}; });
  window.seedData = emptyDB;
  window.resetData = function () {};
  try { localStorage.removeItem(STORE_KEY); } catch (e) {}

  function installDB(db) {
    var json = JSON.stringify(db), gi = Storage.prototype.getItem;
    Storage.prototype.getItem = function (k) { return k === STORE_KEY ? json : gi.apply(this, arguments); };
    SUSPEND = true;
    try { load(); } finally { Storage.prototype.getItem = gi; SUSPEND = false; }
    DB.settings.simDate = '';                          // no simulated dates in the real app
    (DB.firmSigs || []).forEach(decorateSig);
    takeBaseline();
  }
  function takeBaseline() {
    BASE = {};
    Object.keys(MAP).forEach(function (c) { BASE[c] = {}; rowsOf(c).forEach(function (r) { if (!skipRow(c, r)) BASE[c][rowKey(c, r)] = JSON.stringify(payload(c, r)); }); });
    BASE.__settings = JSON.stringify(settingsPayload());
    BASE.__banks = JSON.stringify((DB.settings && DB.settings.quizBanks) || {});
  }
  function settingsPayload() { var s = clone(DB.settings || {}); delete s.simDate; delete s.quizBanks; return s; }
  function applyMasks(u) {
    var m = u.sensitiveMask || {};
    if (m.sin) { u.profile = u.profile || {}; u.profile.sin = '•••••' + m.sin; }
    if (m.bank) { if (u.type === 'sub') { u.company = u.company || {}; u.company.bankAcct = '••••' + m.bank; } else { u.profile = u.profile || {}; u.profile.bankAcct = '••••' + m.bank; } }
  }

  /* ---------- reading ---------- */
  async function loadPublic() {
    var db = emptyDB(), r = await sb.rpc('reg_public_info');
    if (!r.error && r.data) { Object.assign(db.settings, r.data.settings || {}); db.users = (r.data.subs || []).map(function (s) { s.profile = {}; s.roles = []; s.orientations = []; return s; }); }
    ROLE = null; OFFICE = false; MY_ID = null; installDB(db); ME = null; sessionStorage.removeItem('us-test-me');
  }
  async function loadSnapshot() {
    var r = await sb.rpc('reg_snapshot');
    if (r.error) throw r.error;
    var s = r.data || {};
    if (s.role === 'none') { await loadPublic(); PAGE_STATE.notReg = true; return false; }
    ROLE = s.role; OFFICE = s.role === 'office'; MY_ID = s.me || null;
    var db = emptyDB();
    Object.keys(MAP).forEach(function (k) { db[k] = s[k] || []; });
    db.settings = Object.assign(baseSettings(), s.settings || {});
    db.orderSeq = s.orderSeq || 0;
    db.users.forEach(applyMasks);
    if (OFFICE) {                                       // 016i: voided manual hours + Wagepoint export records (office-only tables, not in reg_snapshot)
      for (var mk of ['timeVoided', 'payExports']) {
        var mq = await sb.from(MAP[mk]).select('id,data').order('created_at');
        db[mk] = (!mq.error && mq.data) ? mq.data.map(function (x) { return Object.assign(x.data || {}, { id: x.id }); }) : [];
      }
    }
    if (OFFICE) {                                       // office edits quiz banks: load them (with answers) from the server
      var q = await sb.from('reg_quiz_questions').select('bank,qid,q,opts,ans,why,sort').eq('active', true).order('sort');
      if (!q.error && q.data) { var by = {}; q.data.forEach(function (x) { (by[x.bank] = by[x.bank] || []).push({ id: x.qid, q: x.q, opts: x.opts, ans: x.ans, why: x.why }); }); Object.keys(by).forEach(function (b) { QUIZ_BANK[b] = by[b]; }); }
    }
    /* unstrip-live1: a Shift Tracker shift that was moved into reg_time_entries (data.stShiftId) is shown once – drop the read-only
       'st-<id>' copy that reg_st_shifts() still adds to the snapshot, so hours are never counted twice. */
    try {
      var movedSt = {}; (db.time || []).forEach(function (t) { if (t && t.stShiftId) movedSt['st-' + t.stShiftId] = 1; });
      if (Object.keys(movedSt).length) db.time = db.time.filter(function (t) { return !(t && movedSt[t.id]); });
    } catch (e) { console.warn('st dedupe', e); }
    if (typeof scopeDbToCompany === 'function') {
      try { scopeDbToCompany(db); } catch (e) { console.warn('company scope', e); }
    }
    installDB(db);
    ME = user(s.me);
    if (ME) {
      sessionStorage.setItem('us-test-me', ME.id);
      if (OFFICE) ME.officeRoles = s.officeRoles || [];
      try { var mc = await sb.rpc('must_change_password'); ME.mustChangePw = !!(mc && mc.data === true); } catch (e) { ME.mustChangePw = false; }
      BASE.users && ME.id in BASE.users && (BASE.users[ME.id] = JSON.stringify(payload('users', ME)));
    }
    LAST_REFRESH = Date.now();
    return !!ME;
  }
  async function refresh(why) {
    if (LOADING) return; LOADING = true;
    try { var h = location.hash; await loadSnapshot(); if (why) toast(why); if (location.hash === h) render(); }
    catch (e) { toast('Could not reload: ' + friendly(e)); }
    finally { LOADING = false; }
  }
  window.REG_REFRESH = refresh;
  // signinload1 (Oct 6 2026): count reads that are still loading the account (sign-in, page load, refresh). The 2-second
  // check below signs out when SIGNED_IN is set but ME is not (idle sign-out); during a sign-in / page load ME is not set
  // YET, so a tick landing inside the read used to sign the person out again in the background.
  var _loadSnapshot = loadSnapshot, SNAP_BUSY = 0;
  loadSnapshot = async function () { SNAP_BUSY++; try { return await _loadSnapshot.apply(this, arguments); } finally { SNAP_BUSY--; } };

  /* ---------- saving: only what changed, in the background ---------- */
  save = function () { if (SUSPEND || !SIGNED_IN || !ME) return true; clearTimeout(TIMER); TIMER = setTimeout(flush, 300); return true; };
  window.REG_FLUSH = function () { clearTimeout(TIMER); return flush(); };

  function walkFiles(obj, fn, path) {
    if (!obj || typeof obj !== 'object') return;
    Object.keys(obj).forEach(function (k) {
      var v = obj[k];
      if (typeof v === 'string' && v.indexOf('data:') === 0 && v.length > 64) fn(obj, k, v);
      else if (v && typeof v === 'object') walkFiles(v, fn);
    });
  }
  function fileFolder(row) {
    var c = [row.userId, row.workerId, row.subId, row.firmId, ME.id];   // firmId: client invoice files (e.g. uploaded past invoices) go in that client's folder so the client can read them
    for (var i = 0; i < c.length; i++) { var x = c[i]; if (!x) continue; if (x === ME.id || OFFICE) return x; var u = user(x); if (ME.type === 'sub' && u && u.subId === ME.id) return x; }
    return ME.id;
  }
  async function uploadFiles(coll, row) {
    var jobs = [];
    walkFiles(row, function (o, k, v) {
      var mime = (v.slice(5).split(/[;,]/)[0]) || 'application/octet-stream';
      var nm = String(o.fileName || o.name || k).replace(/[^A-Za-z0-9._-]+/g, '_').slice(-60) || 'file';
      var path = fileFolder(row) + '/' + rowKey(coll, row) + '-' + Math.random().toString(36).slice(2, 8) + '-' + nm;
      jobs.push((async function () {
        var bin = atob(v.split(',')[1] || ''), a = new Uint8Array(bin.length);
        for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
        var up = await sb.storage.from(C.bucket).upload(path, a, { contentType: mime, upsert: false });
        if (up.error) throw up.error;
        FILES['sb:' + path] = v; o[k] = 'sb:' + path;
        if (coll === 'docs' && k === 'fileData') row.storagePath = path;
      })());
    });
    await Promise.all(jobs);
  }
  function needsSensitive(u) {
    var p = u.profile || {}, c = u.company || {};
    return /^enc:/.test(p.sin || '') || /^enc:/.test(p.bankAcct || '') || /^enc:/.test(c.bankAcct || '');
  }
  async function saveSensitive(u) {
    var p = u.profile || {}, c = u.company || {}, args = { p_user: u.id }, sin = null, acct = null;
    if (/^enc:/.test(p.sin || '')) { sin = dec(p.sin); args.p_sin = sin; }
    if (u.type === 'sub' && /^enc:/.test(c.bankAcct || '')) { acct = dec(c.bankAcct); args.p_bank = { inst: c.bankInst || '', transit: c.bankTransit || '', acct: acct }; }
    else if (/^enc:/.test(p.bankAcct || '')) { acct = dec(p.bankAcct); args.p_bank = { inst: p.bankInst || '', transit: p.bankTransit || '', acct: acct }; }
    var r = await sb.rpc('reg_set_sensitive', args);
    if (r.error) throw r.error;
    u.sensitiveMask = Object.assign({}, u.sensitiveMask || {});
    if (sin) { u.sensitiveMask.sin = sin.slice(-3); p.sin = '•••••' + sin.slice(-3); }
    if (acct) { u.sensitiveMask.bank = acct.slice(-4); if (u.type === 'sub') c.bankAcct = '••••' + acct.slice(-4); else p.bankAcct = '••••' + acct.slice(-4); }
    if (BASE.users[u.id]) { var b = JSON.parse(BASE.users[u.id]); b.sensitiveMask = u.sensitiveMask; BASE.users[u.id] = JSON.stringify(b); }
  }
  function clockReminders(u) {
    if (typeof clockDocItems !== 'function') return null;
    try { var seen = {}; return clockDocItems(u).map(function (b) { return docShort(b.m); }).filter(function (m) { if (seen[m]) return false; seen[m] = 1; return true; }); } catch (e) { return null; }
  }
  function warnOnce(sig, msg) { if (WARNED[sig]) return; WARNED[sig] = 1; toast(msg); }

  async function flush() {
    if (BUSY) { AGAIN = true; return; }
    if (!SIGNED_IN || !ME || HOLD) return;
    BUSY = true; var failed = 0, firstErr = null;
    try {
      // keep the Shift Tracker clock reminders current (informational only – never blocks clocking)
      (OFFICE ? DB.users.filter(function (u) { return u.type === 'worker' || u.type === 'employee'; }) : (ME.type === 'worker' || ME.type === 'employee') ? [ME] : []).forEach(function (u) {
        var m = clockReminders(u); if (m && JSON.stringify(m) !== JSON.stringify(u.clockReminders || [])) u.clockReminders = m;
      });
      for (var c in MAP) {
        if (SERVER_ONLY[c]) continue;
        var rows = rowsOf(c), seen = {}, ins = [], upd = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i]; if (skipRow(c, r)) continue;
          var k = rowKey(c, r); seen[k] = 1;
          if (c === 'users' && needsSensitive(r)) { try { await saveSensitive(r); } catch (e) { failed++; firstErr = firstErr || e; } }
          var hasFile = false; walkFiles(r, function () { hasFile = true; });
          var pl = JSON.stringify(payload(c, r));
          if (BASE[c][k] === pl) continue;
          if (hasFile) { try { await uploadFiles(c, r); pl = JSON.stringify(payload(c, r)); } catch (e) { failed++; firstErr = firstErr || e; continue; } }
          if (BASE[c][k] === undefined && c !== 'users') ins.push({ k: k, r: r, pl: pl }); else if (!INSERT_ONLY[c]) upd.push({ k: k, r: r, pl: pl });
        }
        if (ins.length) {
          // ask for the saved row back only where the server fills something in (crew order number); many people may
          // add a row they cannot read afterwards (e.g. an audit line or an alert to the office)
          var RET = c === 'crewOrders';
          var qi = sb.from(MAP[c]).insert(ins.map(function (x) { return { id: x.k, data: JSON.parse(x.pl) }; }));
          var res = await (RET ? qi.select('id,data') : qi);
          if (res.error) {                            // one bad row must not lose the others: retry one by one
            for (var j = 0; j < ins.length; j++) {
              var q1 = sb.from(MAP[c]).insert({ id: ins[j].k, data: JSON.parse(ins[j].pl) });
              var one = await (RET ? q1.select('id,data') : q1);
              if (one.error && one.error.code === '23505' && !INSERT_ONLY[c]) { upd.push(ins[j]); continue; }
              if (one.error) { if (!(INSERT_ONLY[c] && one.error.code === '23505')) { failed++; firstErr = firstErr || one.error; } continue; }
              accept(c, ins[j], one.data && one.data[0]);
            }
          } else ins.forEach(function (x) { accept(c, x, (res.data || []).filter(function (y) { return y.id === x.k; })[0]); });
        }
        for (var u2 = 0; u2 < upd.length; u2++) {
          var x = upd[u2], q;
          if (c === 'users') q = await sb.rpc('reg_account_save', { p_id: x.k, p_data: JSON.parse(x.pl) });
          else q = await sb.from(MAP[c]).update({ data: JSON.parse(x.pl) }).eq('id', x.k).select('id,data');
          if (q.error || (c !== 'users' && !(q.data || []).length)) { failed++; firstErr = firstErr || q.error || { message: 'Not allowed for your account.' }; continue; }
          accept(c, x, c === 'users' ? { id: x.k, data: q.data } : q.data[0]);
        }
        if (!NEVER_DELETE[c]) {
          for (var bk in BASE[c]) if (!seen[bk]) {
            var del = await sb.from(MAP[c]).delete().eq('id', bk).select('id');
            if (del.error || !(del.data || []).length) { failed++; firstErr = firstErr || del.error || { message: 'Not allowed to remove that.' }; } else delete BASE[c][bk];
          }
        }
      }
      if (OFFICE) {
        var sp = JSON.stringify(settingsPayload());
        if (sp !== BASE.__settings) {
          var s1 = await sb.from('reg_settings').upsert({ id: 'main', data: JSON.parse(sp) }).select('id');
          if (s1.error) { failed++; firstErr = firstErr || s1.error; } else BASE.__settings = sp;
        }
        var banks = (DB.settings && DB.settings.quizBanks) || {}, oldB = JSON.parse(BASE.__banks || '{}');
        for (var b in banks) if (JSON.stringify(banks[b]) !== JSON.stringify(oldB[b])) {
          var s2 = await sb.rpc('reg_quiz_bank_save', { p_bank: b, p_questions: banks[b] });
          if (s2.error) { failed++; firstErr = firstErr || s2.error; }
        }
        BASE.__banks = JSON.stringify(banks);
      }
    } catch (e) { failed++; firstErr = firstErr || e; }
    finally { BUSY = false; }
    if (failed) {
      var msg = friendly(firstErr);
      warnOnce(msg, 'Some changes were not saved: ' + msg);
      if (Date.now() - LAST_REFRESH > 60000) refresh();   // show the real saved state again
    }
    if (AGAIN) { AGAIN = false; flush(); }
  }
  function accept(c, x, srv) {
    if (srv && srv.data) {
      if (c === 'crewOrders' && srv.data.no && x.r.no !== srv.data.no) x.r.no = srv.data.no;          // server-given order number
      if (c === 'users') { ['approved', 'accountApproved', 'active', 'suspended', 'subId', 'type', 'crewLead', 'jobRole'].forEach(function (f) { if (f in srv.data) x.r[f] = srv.data[f]; }); }
    }
    BASE[c][x.k] = JSON.stringify(payload(c, x.r));
  }

  /* Screens run some housekeeping for whoever is looking (remove blocked people from future crews, expiry alerts).
   * With real data each person sees only their own part, so that housekeeping runs for the office only.
   * (Later: a nightly server job – see GO-LIVE.md.) */
  var _sweep = sweepBookings; sweepBookings = function () { return OFFICE ? _sweep() : false; };
  var _runAlerts = runAlerts; runAlerts = function () { if (OFFICE) return _runAlerts(); processTemp(); };

  /* ---------- files: view through a 60-second private link ---------- */
  /* Oct 4, 2026 (past invoices, js/v2-pastinvoices.js): turn a stored file ('sb:path' or data URL) into a blob URL, or '' if not allowed */
  window.REG_FILE_BLOB = function (data) {
    data = String(data || '');
    if (data.indexOf('data:') === 0) return Promise.resolve(dataToBlobUrl(data));
    if (FILES[data]) return Promise.resolve(dataToBlobUrl(FILES[data]));
    if (data.indexOf('sb:') !== 0) return Promise.resolve('');
    return sb.storage.from(C.bucket).download(data.slice(3)).then(function (r) { return r.error ? '' : URL.createObjectURL(r.data); }, function () { return ''; });
  };
  var _showFile = showFile;
  showFile = function (name, type, data, label) {
    data = String(data || '');
    if (data.indexOf('sb:') !== 0) return _showFile(name, type, data, label);
    if (FILES[data]) return _showFile(name, type, FILES[data], label);
    modal('<h2>' + esc(label || name) + '</h2><p class="muted">Opening the file…</p>');
    sb.storage.from(C.bucket).download(data.slice(3)).then(function (r) {
      if (r.error) { modal('<h2>' + esc(label || name) + '</h2><div class="alert bad">You do not have access to this file, or it is no longer available.</div>'); return; }
      var url = URL.createObjectURL(r.data);
      modal('<h2>' + esc(label || name) + '</h2>' + (/^image\//.test(type) ? '<img src="' + url + '" style="max-width:100%;border:1px solid #ddd">' : /pdf/.test(type) ? '<iframe src="' + url + '" style="width:100%;height:65vh;border:1px solid #ddd"></iframe>' : '<p>Preview not available for this file type.</p>') + '<p><a class="btn sec" href="' + url + '" download="' + esc(name) + '">Download ' + esc(name) + '</a></p>');
    });
  };

  /* ---------- sign in ---------- */
  VIEWS.login = function () {
    var m = PAGE_STATE.loginMsg; PAGE_STATE.loginMsg = null;
    var nr = PAGE_STATE.notReg; PAGE_STATE.notReg = false;
    var switchHtml = (typeof companySwitchHtml === 'function') ? companySwitchHtml('us') : '';
    return (m ? '<div class="login-wrap" style="margin-bottom:0"><div class="alert warn">' + esc(m) + '</div></div>' : '') +
      '<div class="login-wrap"><img class="logo-big" src="assets/unscramble-logo.svg" alt="UnScramble"><div class="card"><h1>Sign in to UnScramble</h1>' +
      switchHtml +
      (nr ? '<div class="alert info small">This login has no UnScramble account yet. Create an account below or ask the office.</div>' : '') +
      '<form data-form="login">' + inp('login', 'Email, phone number or username', '', { req: true, extra: ' data-autofocus autocomplete="username"' }) + inp('password', 'Password', '', { type: 'password', req: true, extra: ' autocomplete="current-password"' }) +
      '<div class="row" style="margin-top:12px"><button type="submit">Sign in</button><a href="#/forgot" class="right small">Forgot password?</a></div></form>' +
      '<div style="margin-top:16px;border-top:1px solid #eee;padding-top:12px"><span class="muted small">New here?</span><br><a class="btn" href="#/signup" style="margin-top:6px">Create an account</a></div></div></div>';
  };
  VIEWS.forgot = function () {
    return '<div class="login-wrap"><div class="card"><h1>Forgot your password?</h1><p>Please contact the UnScramble office. They will give you a temporary password, and you choose a new one the next time you sign in.</p><p><a href="#/">Back to sign in</a></p></div></div>';
  };
  FORMS.reset1 = FORMS.reset2 = function () { go('#/forgot'); };
  /* 016l: self-service forgot + office temp-password email (gated by store-config flags). v2-pwemail.js
     replaces VIEWS.forgot / FORMS.reset1/reset2 when forgotPassword is on. */
  FORMS.login = async function (f, d) {
    var email = authEmail(d.login); if (!email) return;
    busy(true, 'Signing in…');
    var r = await sb.auth.signInWithPassword({ email: email, password: d.password });
    /* Oct 4, 2026 (016g): an account made with an email AND a phone/username signs in with the email. If the phone or
       username was typed, ask the server for that account's real login (it answers only when the password is right). */
    if (r.error && /Invalid login credentials/i.test(String(r.error.message || '')) && String(d.login || '').indexOf('@') < 0) {
      try {
        var alt = await sb.rpc('reg_login_email', { p_login: String(d.login || '').trim(), p_password: d.password });
        if (alt.error && /too many/i.test(String(alt.error.message || ''))) r = { error: alt.error };
        else if (!alt.error && alt.data && alt.data !== email) r = await sb.auth.signInWithPassword({ email: alt.data, password: d.password });
      } catch (e) {}
    }
    if (r.error) { busy(false); toast(friendly(r.error)); return; }
    try { await afterSignIn('Password'); } finally { busy(false); }
  };
  async function afterSignIn(how) {
    SIGNED_IN = true;
    var ok = await loadSnapshot();
    if (!ok) { SIGNED_IN = false; await sb.auth.signOut(); go('#/'); render(); return; }
    var u = ME; u.lastLogin = new Date().toISOString(); touch();
    logLogin(u, u.username || u.email, true, 'Signed in (' + how + ')'); audit('Signed in', u.name, how); runAlerts(); save();
    homeOrClock(true);
  }
  window.finishLogin = function () { homeOrClock(true); };
  ACT.logout = function () { if (ME) { audit('Signed out', ME.name); } window.REG_FLUSH().then(signOutLocal); };
  async function signOutLocal(msg) {
    SIGNED_IN = false; ME = null; sessionStorage.removeItem('us-test-me');
    try { await sb.auth.signOut(); } catch (e) {}
    await loadPublic(); if (msg) PAGE_STATE.loginMsg = msg; go('#/');
  }
  // the idle timer (security.js) clears ME after 30 minutes: also end the real session and wipe the data from memory
  setInterval(function () { if (SIGNED_IN && !ME && !SNAP_BUSY) { var m = PAGE_STATE.loginMsg; signOutLocal(m); } }, 2000);
  ACT.resetData = function () {};
  ACT.quick = function () {};

  /* ---------- passwords (Shift Tracker functions) ---------- */
  async function changePw(f, d, forced) {
    if (d.pw !== (d.pw2 == null ? d.pw : d.pw2)) { toast('Passwords do not match.'); return; }
    var chk = pwCheck(d.pw, ME); if (!chk.ok) { toast('Password needs: ' + chk.msgs.join(', ') + '.'); return; }
    var r = await sb.rpc('change_my_password', { p_current: d.old, p_new: d.pw });
    if (r.error) { toast(friendly(r.error)); return; }
    ME.mustChangePw = false; audit(forced ? 'Changed password (forced reset)' : 'Changed password', ME.name); save();
    toast('Password saved. Please sign in again with the new password.');
    signOutLocal('Password changed. Please sign in with your new password.');
  }
  FORMS.pw = function (f, d) { changePw(f, d, false); };
  FORMS.forcepw = function (f, d) { changePw(f, d, true); };
  async function officeReset(id) {
    var u = user(id), r = await sb.rpc('admin_reset_password', { p_user: id });
    if (r.error) { toast(friendly(r.error)); return; }
    // the server made ONE temporary password, signed the person out, set must-change and wrote its own audit row
    audit('Office reset password', u ? u.name : id, 'Temporary password made by the server and shown once (never stored in the log). Must choose a new password at next sign-in.'); save();
    if (typeof window.showTempPassword === 'function') { window.showTempPassword(u, r.data); return; }   // js/v2-pwreset.js
    modal('<h2>Temporary password</h2><p>Give this to ' + esc(u ? u.name : 'the person') + ' in person or by phone. They must choose a new one when they sign in.</p><p style="font-size:1.4em"><code>' + esc(r.data) + '</code></p><p class="small muted">It is shown only now.</p>');
  }
  window.REG_OFFICE_RESET = officeReset;                   // Oct 4, 2026: used by js/v2-pwreset.js (one Reset password flow)
  FORMS.adminpw = function (f, d) { officeReset(d.id); };
  ACT.forcereset = function (el) { if (!confirmBox('fr' + el.dataset.id, 'Give this person a temporary password (they must change it at next sign-in)?')) return; officeReset(el.dataset.id); };
  ACT.unlock = function () { toast('Sign-in limits are handled by the login service – nothing to unlock. Use "Reset password" if needed.'); };
  ACT.toggle2fa = ACT.my2fa = function () { toast('2-step sign-in will be added with the login service later (owner decision).'); };

  /* ---------- sign up (self) ---------- */
  async function selfSignup(d, kind, extra) {
    var L = signupLogin(d); if (!L) { toast('Enter an email, a 10-digit phone number or a username to sign in with.'); return; }
    if (d.pw !== d.pw2) { toast('Passwords do not match.'); return; }
    var chk = pwCheck(d.pw, d); if (!chk.ok) { toast('Password needs: ' + chk.msgs.join(', ') + '.'); return; }
    if (kind === 'worker' && !d.subId) { toast('Choose your employer.'); return; }
    busy(true, 'Creating your account…');
    try {
      var r = await sb.auth.signUp({ email: L.email, password: d.pw, options: { data: { company: (C.companyId || 'us'), reg_kind: kind, reg_sub: d.subId || null,
        full_name: d.name, username: d.username || null, contact_email: d.email || null, phone: digits(d.phone).slice(-10) || null } } });
      if (r.error) { toast(friendly(r.error)); return; }
      if (!r.data.session) { r = await sb.auth.signInWithPassword({ email: L.email, password: d.pw }); if (r.error) { toast('Account created. Please sign in.'); go('#/'); return; } }
      SIGNED_IN = true;
      if (!(await loadSnapshot())) { toast('Account created, but it is not ready yet. Please contact the office.'); return; }
      var u = ME;
      if (extra) extra(u);
      if (kind === 'tester' && d.acceptTerms) recordAcceptance(u, 'app_testing');
      recordConsent(u, !!d.consent);
      audit('Account created', u.name, TYPES[u.type]); track('signup', '#/signup/' + kind);
      notify('admin', 'New account waiting for your approval: ' + u.name + ' (' + TYPES[u.type] + ').' + (u.subId ? ' Employer: ' + employerName(u) : ''));
      if (u.subId) notify(u.subId, 'New worker registered under your company: ' + u.name + '. Please confirm them in your Workers page.');
      logLogin(u, L.shown, true, 'New account (signed up)'); save();
      toast('Account created. You sign in with: ' + L.shown); go('#/pending');
    } catch (e) { toast(friendly(e)); }
    finally { busy(false); }
  }
  FORMS.signup = function (f, d) { if (!TYPES[d.type] || d.type === 'admin' || d.type === 'firm') return; selfSignup(d, d.type); };
  FORMS.firmsignup = function (f, d) {
    if (!d.name || !d.contact || !d.email) { toast('Enter the business name, contact person and email.'); return; }
    // 016h: optional invite code from the office (js/v2-clientlink.js). Nothing about the client is shown; the office links after approval.
    var rawInv = String(d.invite || '').trim(), inv = rawInv && typeof clNormCode === 'function' ? clNormCode(rawInv) : '';
    if (rawInv && !inv) { toast('Invite codes look like ABCD-2345 (8 letters/numbers). Check the code, or leave it empty.'); return; }
    selfSignup(d, 'firm', function (u) { u.firm = Object.assign({}, u.firm || {}, { contact: d.contact, siteRequest: d.site || '' });
      if (inv) { u.firm.inviteCode = inv; audit('Sign-up with invite code', u.name, 'code ending ' + inv.slice(-4) + ' – waiting for office approval'); } });
  };

  /* ---------- accounts made by someone else (a subcontractor adds a worker, the office adds a client) ----------
   * Uses a second, throw-away sign-up client so the person doing it stays signed in. The new person signs in with
   * the email / phone / username typed in the form and the password given to them. */
  function wrapCreate(name, kind) {
    var orig = FORMS[name]; if (!orig) return;
    FORMS[name] = async function (f, d) {
      var n = DB.users.length; HOLD++;
      var created = null;
      try {
        orig(f, d);
        if (DB.users.length > n) created = DB.users[DB.users.length - 1];
        if (!created) return;
        var L = signupLogin(d); if (!L) { throw new Error('Enter an email, a 10-digit phone or a username for the new account.'); }
        busy(true, 'Creating the account…');
        var tmp = window.supabase.createClient(C.url, C.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'reg-create-tmp' } });
        var r = await tmp.auth.signUp({ email: L.email, password: d.pw, options: { data: { company: (C.companyId || 'us'), reg_kind: kind, reg_sub: kind === 'worker' ? ME.id : null,
          full_name: created.name, username: created.username || null, contact_email: created.email || null, phone: digits(created.phone).slice(-10) || null } } });
        if (r.error || !r.data.user) throw (r.error || new Error('Could not create the account.'));
        try { await tmp.auth.signOut(); } catch (e) {}
        rekey(created.id, r.data.user.id);
        created.accountApproved = false; delete created.passHash;
        toast('Account created. They sign in with: ' + L.shown);
      } catch (e) {
        if (created) { DB.users = DB.users.filter(function (u) { return u !== created; }); }
        toast(friendly(e)); HOLD--; refresh(); return;
      } finally { busy(false); }
      HOLD--; save(); render();
    };
  }
  function rekey(oldId, newId) {
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach(function (k) { var v = o[k]; if (v === oldId) o[k] = newId; else if (typeof v === 'string' && v.indexOf(oldId) >= 0 && /\|/.test(v)) o[k] = v.split(oldId).join(newId); else if (v && typeof v === 'object') walk(v); });
    })(DB);
    BASE.users[newId] = JSON.stringify({});           // exists on the server (made by sign-up): save it as an update
  }
  wrapCreate('addworker', 'worker');
  wrapCreate('newfirm', 'firm');

  /* ---------- 016j: office "Add person", welcome email, username changes, new login details ----------
   * STAGED – NOT DEPLOYED, NOT RUN AGAINST LIVE. Paste into app/js/store-supabase.js right after
   *   wrapCreate('newfirm', 'firm');
   * (uses that file's sb, C, digits, friendly, busy, loadSnapshot, HOLD). Needs migration 016j (+016h, 016e recommended)
   * and, for "Send welcome email", the Edge Function reg-send-welcome deployed with its email secrets.
   * Front end: js/v2-addperson.js calls these hooks only in live mode. */
  function throwawayPw() { var a = new Uint8Array(24); crypto.getRandomValues(a); return Array.from(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('') + 'Aa1!'; }
  async function reloadData() { try { if (window.REG_FLUSH) await window.REG_FLUSH(); } catch (e) {} await loadSnapshot(); }
  window.REG_OFFICE_ADD_PERSON = async function (p) {
    HOLD++; busy(true, 'Creating the account…');
    try {
      var email = String(p.email || '').trim().toLowerCase();
      var chk = await sb.rpc('reg_add_person_check', { p: p });             // office only: username / email / role rules
      if (chk.error) return { error: friendly(chk.error) };
      if (chk.data && chk.data.error) return { error: chk.data.error };
      var me = (await sb.auth.getUser()).data.user; if (!me) return { error: 'Please sign in again.' };
      var kind = { employee: 'employee', worker: 'worker', crewlead: 'worker', sub: 'sub', firm: 'firm' }[p.role];
      // throw-away client: the office stays signed in. "Confirm email" is OFF in this project, so Supabase sends nothing.
      var tmp = window.supabase.createClient(C.url, C.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'reg-create-tmp' } });
      var r = await tmp.auth.signUp({ email: email, password: throwawayPw(), options: { data: { company: (C.companyId || 'us'), reg_kind: kind,
        reg_sub: kind === 'worker' ? p.subId : null, full_name: p.name, username: p.username, contact_email: email,
        phone: digits(p.phone).slice(-10) || null, added_by_office: me.id } } });
      if (r.error || !r.data.user) return { error: friendly(r.error || 'Could not create the account.') };
      try { await tmp.auth.signOut(); } catch (e) {}
      // server: temporary password (same generator as Reset password), must-change flag, approval, audit row
      var f = await sb.rpc('reg_office_add_person', { p_user: r.data.user.id, p: p });
      if (f.error) return { error: friendly(f.error) + ' (A sign-in was started but not finished: it is not approved and its password is unknown to anyone, so it cannot be used.)' };
      await reloadData();
      return { id: r.data.user.id, tempPassword: f.data.temp_password };
    } catch (e) { return { error: friendly(e) }; }
    finally { busy(false); HOLD--; }
  };
  // the office clicked "Send welcome email" after seeing the exact preview (owner rule: no automatic outside email)
  // Gate: only wire the sender when store-config has welcomeEmail:true (Edge Function + secrets live).
  if (C.welcomeEmail) window.REG_SEND_WELCOME = async function (userId, tempPassword) {
    busy(true, 'Sending the welcome email…');
    try {
      var r = await sb.functions.invoke('reg-send-welcome', { body: { user_id: userId, temp_password: tempPassword } });
      if (r.error) { var m = r.error.message; try { var j = await r.error.context.json(); m = j.error || m; } catch (e) {} return { error: friendly(m) }; }
      if (!r.data || !r.data.ok) return { error: (r.data && r.data.error) || 'The email could not be sent. Use "Copy login details".' };
      return { ok: true };
    } catch (e) { return { error: friendly(e) }; }
    finally { busy(false); }
  };
  window.REG_CHANGE_USERNAME = async function (userId, name) {
    var r = await sb.rpc('reg_change_username', { p_user: userId, p_new: name });
    if (r.error) return { error: friendly(r.error) };
    if (r.data && r.data.error) return { error: r.data.error };
    await reloadData();
    return { ok: true, username: r.data.username };
  };
  // "Send login details again": the existing one-password reset (signs the person out, must change at next sign-in)
  window.REG_NEW_TEMP_PASSWORD = async function (userId) {
    var r = await sb.rpc('admin_reset_password', { p_user: userId });
    if (r.error) return { error: friendly(r.error) };
    return { tempPassword: r.data };
  };

  // ---------- 016l: password reset by email (self-service + office temp-password email) ----------
  // Gate: store-config forgotPassword / resetEmail. Needs migration 016l + Edge Functions.
  if (C.forgotPassword) {
    window.REG_FORGOT_REQUEST = async function (login) {
      busy(true, 'Sending…');
      try {
        var r = await sb.functions.invoke('reg-forgot-password', { body: { action: 'request', login: String(login || '').trim() } });
        // Always succeed from the person's point of view (neutral message). Network/setup errors still surface.
        if (r.error) {
          var m = r.error.message;
          try { var j = await r.error.context.json(); m = j.error || m; } catch (e) {}
          // If the function is missing, tell them to contact the office without revealing account state.
          if (/not set up|Failed to send|FunctionsRelayError|404/i.test(String(m))) {
            return { error: 'Password reset by email is not available right now. Please contact the UnScramble office.' };
          }
        }
        return { ok: true };
      } catch (e) { return { error: friendly(e) }; }
      finally { busy(false); }
    };
    window.REG_FORGOT_CONFIRM = async function (login, code, password) {
      busy(true, 'Saving your new password…');
      try {
        var r = await sb.functions.invoke('reg-forgot-password', { body: { action: 'confirm', login: String(login || '').trim(), code: String(code || '').trim(), password: password } });
        if (r.error) {
          var m = r.error.message;
          try { var j = await r.error.context.json(); m = j.error || m; } catch (e) {}
          return { error: friendly(m) };
        }
        if (!r.data || !r.data.ok) return { error: (r.data && r.data.error) || 'That code is not valid or has expired. Request a new one, or contact the office.' };
        return { ok: true };
      } catch (e) { return { error: friendly(e) }; }
      finally { busy(false); }
    };
  }
  if (C.resetEmail) {
    window.REG_SEND_TEMP_PW = async function (userId, tempPassword) {
      busy(true, 'Sending the email…');
      try {
        var r = await sb.functions.invoke('reg-send-temp-pw', { body: { user_id: userId, temp_password: tempPassword } });
        if (r.error) { var m = r.error.message; try { var j = await r.error.context.json(); m = j.error || m; } catch (e) {} return { error: friendly(m) }; }
        if (!r.data || !r.data.ok) return { error: (r.data && r.data.error) || 'The email could not be sent. Use Copy.' };
        return { ok: true };
      } catch (e) { return { error: friendly(e) }; }
      finally { busy(false); }
    };
  }



  /* ---------- SIN / bank reveal: password re-check + log on the server ---------- */
  FORMS.reauthreveal = async function (f, d) {
    var u = user(d.id), r = await sb.rpc('reg_reveal_sensitive', { p_user: d.id, p_password: d.pass });
    if (r.error) { toast(friendly(r.error)); return; }
    if (!r.data || !r.data.ok) { toast('Password does not match.'); audit('Failed re-authentication for sensitive data', u ? u.name : ''); save(); return; }
    var b = r.data.bank || {};
    document.getElementById('revealbox').innerHTML = '<div class="alert warn small">Sensitive – shown after password check (logged). ' + (u && u.type === 'employee' ? 'SIN: <b>' + esc(r.data.sin || '–') + '</b> · ' : '') + 'Bank: <b>' + esc(b.inst || '') + '-' + esc(b.transit || '') + ' ' + esc(b.acct || '–') + '</b></div>';
    audit('Re-authenticated and viewed SIN/bank', u ? u.name : ''); save();
    setTimeout(function () { var el = document.getElementById('revealbox'); if (el) el.innerHTML = '<p class="small muted">Hidden again.</p>'; }, 60000);
  };

  /* ---------- quizzes: graded on the server ---------- */
  FORMS.quizsubmit = async function (f, d) {
    var Q = PAGE_STATE.quiz; if (!Q) { go('#/training'); return; }
    var miss = Q.qs.filter(function (q, i) { return d['q' + i] == null || d['q' + i] === ''; }).length;
    if (miss) { toast('Please answer every question (' + miss + ' left).'); return; }
    var it = TRAIN_ITEMS[Q.item];
    var sheet = Q.qs.map(function (q, i) { return { qid: q.id, perm: q.perm, shown: +d['q' + i] }; });
    busy(true, 'Checking your answers…');
    var r = await sb.rpc('reg_quiz_submit', { p_item: Q.item, p_bank: it.quiz, p_answers: sheet, p_started: Q.started });
    busy(false);
    if (r.error) { toast(friendly(r.error)); return; }
    var a = r.data;
    a.answers.forEach(function (x) { var b = bankQ(Q.item, x.qid); if (b) { b.ans = x.correct; b.why = x.why; } });   // for the review screen
    (DB.quizAttempts = DB.quizAttempts || []).push(a);
    audit('Quiz attempt' + (a.test ? ' (TEST)' : ''), ME.name, it.label + ': ' + a.correct + '/' + a.total + ' (' + a.score + '%) ' + (a.pass ? 'PASS' : 'FAIL'));
    if (a.pass && ME.subId && !a.test) notify(ME.subId, ME.name + ' passed ' + it.label + ' (' + a.score + '%). Please confirm it in your Workers page.');
    PAGE_STATE.quiz = null; PAGE_STATE.quizResult = a.id; save(); go('#/quizresult');
  };

  /* ---------- UnScramble clock (no Shift Tracker hand-off) ----------
   * Approved workers/employees stay in this app. v2-clock.js already owns
   * worker:home / employee:home and writes DB.time → reg_time_entries.
   * Do NOT redirect to Shift Tracker. */
  function clockReady(u) { return u && (u.type === 'worker' || u.type === 'employee') && u.accountApproved !== false && !gateNav(u); }
  function homeOrClock(fromLogin) {
    if (fromLogin) go('#/home');
  }
  function clockCard() { return ''; }

  /* ---------- no client legal names (owner decision, Oct 4 2026) ----------
   * A signature record keeps only the client id, site codes, the signer's role, versions and time. The signed PDF is
   * filed in Google Drive by the office. Names shown on screen come from display-only getters (not enumerable, so
   * they are never saved). The database strips these fields too (migration 016, section 11). */
  var SIGNER = 'an authorized signer';
  function decorateSig(s) {
    if (!s) return s;
    ['firmName', 'signerName', 'signature', 'text', 'legalName'].forEach(function (k) { delete s[k]; });
    var nm = function () { var u = user(s.firmId); return u ? u.name : 'Client'; };
    Object.defineProperty(s, 'firmName', { get: nm, enumerable: false, configurable: true });
    Object.defineProperty(s, 'signerName', { get: function () { return SIGNER; }, enumerable: false, configurable: true });
    Object.defineProperty(s, 'signature', { get: function () { return ''; }, enumerable: false, configurable: true });
    Object.defineProperty(s, 'text', { get: function () { try { return firmAgreementText(nm()); } catch (e) { return ''; } }, enumerable: false, configurable: true });
    return s;
  }
  if (FORMS.firmsign) {
    var _firmsign = FORMS.firmsign;
    FORMS.firmsign = function (f, d) {
      if (!d.title) { toast('Enter your role (e.g. Owner, Farm Manager).'); return; }
      d.signerName = d.signature = SIGNER;
      var n = (DB.firmSigs || []).length; _firmsign(f, d);
      (DB.firmSigs || []).slice(n).forEach(function (s) {
        s.siteCodes = (DB.sites || []).filter(function (x) { return x.firmId === s.firmId; }).map(function (x) { return x.code; });
        decorateSig(s);
      });
      render();
    };
  }
  if (typeof firmAgrCard === 'function') {
    var _agrCard = firmAgrCard;
    firmAgrCard = function (firm, forOffice) {
      return _agrCard(firm, forOffice)
        .replace(/<div><label[^>]*>[^<]*<\/label><input type="text" name="(?:signerName|signature)"[^>]*><\/div>/g, '')
        .replace(/Your title \(e\.g\./g, 'Your role (e.g.')
        .replace(/Your name, title,/g, 'Your role,')
        .replace(/<button>Sign agreement/, '<div class="hint"><b>No names are stored in the app.</b> After you accept, print or save the PDF copy, sign it by hand and send it to the office – the office files the signed PDF.</div><button>Sign agreement');
    };
  }
  if (typeof firmSigHtml === 'function') {
    var _sigHtml = firmSigHtml;
    firmSigHtml = function (s) {
      return _sigHtml(s).replace(/<div class="t">[^<]*<\/div>/, '')
        .replace(/Signature \(typed\): <i>[^<]*<\/i><br>Name: [^·<]*· Title:/, 'Signature: ______________________________<br>Name (print): ______________________________ · Role:')
        .replace(/\(it includes[^)]*\)/, '');
    };
  }

  function noLegalNames(html) {
    return String(html).replace(/Farm \(or other client\) legal name|Farm \/ business legal name|Firm name \(fake in this test\)/g, 'Client display name (short name – not the legal business name)')
      .replace(/Use fake names in this test \(e\.g\. "Test Farm C"\)\./g, 'Use a short display name – never the legal business name.');
  }
  // The agreement text never fills in a client name: the legal name is written by hand on the signed PDF copy.
  if (typeof firmAgreementText === 'function') {
    var _fat = firmAgreementText;
    firmAgreementText = function (name, industry) {
      if (!industry && name && typeof clientTypeOf === 'function') { var f = users('firm').filter(function (u) { return u.name === name; })[0]; if (f) industry = clientTypeOf(f); }
      return _fat(null, industry);
    };
  }
  if (VIEWS.signupForm) { var _suf = VIEWS.signupForm; VIEWS.signupForm = function (h) { return noLegalNames(_suf.apply(this, arguments)); }; }

  /* ---------- live look: UnScramble chrome; no ST clock link ---------- */
  var _layout = layout;
  layout = function (content) {
    var html = _layout(content);
    html = html.replace(/<div class="testbar">[\s\S]*?<\/div>/, '');
    html = html.replace(/(<div style="font-weight:700">)Registration &amp; Compliance(<\/div>)/, '$1UnScramble$2');
    html = html.replace(/Shift Tracker – test build/g, 'Clock, farms &amp; compliance');
    html = html.replace(/(<footer[^>]*>)([\s\S]*?)(<\/footer>)/g, function (m, a, b, z) { return a + 'UnScramble – The HR Company Inc.' + z; });
    html = noLegalNames(html);
    return html;
  };

  /* ---------- start ---------- */
  async function boot() {
    var app = document.getElementById('app');
    if (app) app.innerHTML = '<div class="login-wrap"><div class="card"><p class="muted">Loading…</p></div></div>';
    try {
      var s = await sb.auth.getSession();
      if (s.data && s.data.session) { SIGNED_IN = true; if (!(await loadSnapshot())) { SIGNED_IN = false; } }
      else await loadPublic();
    } catch (e) {
      try { await loadPublic(); } catch (x) { DB = emptyDB(); }
      PAGE_STATE.loginMsg = 'Could not reach the server: ' + friendly(e);
    }
    if (ME) { touch(); runAlerts(); save(); homeOrClock(false); }
    render();
  }
  sb.auth.onAuthStateChange(function (ev) { if (ev === 'SIGNED_OUT' && SIGNED_IN) { SIGNED_IN = false; ME = null; loadPublic().then(function () { go('#/'); }); } });
  window.addEventListener('beforeunload', function () { if (TIMER) { clearTimeout(TIMER); flush(); } });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
