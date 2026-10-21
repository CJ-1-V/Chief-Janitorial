/* cj-live-store.js – cj-golive (Oct 21 2026). Saves + reloads the CJ schedule / tasks / photos / lean1 data in the LIVE app.
   Loaded right after store-supabase.js; does nothing in the mock (test) app or for any company other than 'cj'.
   Each collection lives in its own CJ-only table (migration cj-golive 02, part D): id, company_id 'cj', data = the app object.
   The database decides who may write what (row-level security); the rules below only avoid sending changes that the
   signed-in role can never make (so they do not show "not saved" warnings). Photos go to the private bucket cj-task-photos
   (SITE/YYYY-MM-DD/<task>/<photo id>.jpg); the table keeps the path only, never the image. */
(function (W) {
  'use strict';
  var H = W.REG_HOOKS; if (!W.REG_LIVE || !H || !W.REG_STORE || W.REG_STORE.companyId !== 'cj') return;
  var BUCKET = 'cj-task-photos', KEEP = 50, BASE = {}, UID = null, LOADED = {};   // LOADED: what the server holds for the derived (virt) collections
  function cl(o) { return JSON.parse(JSON.stringify(o)); }
  function st(o) { return JSON.stringify(o, function (k, v) { return v && typeof v === 'object' && !Array.isArray(v) ? Object.keys(v).sort().reduce(function (a, k2) { a[k2] = v[k2]; return a; }, {}) : v; }); }
  function day() { try { if (typeof today === 'function') return today(); } catch (e) {} return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Halifax' }); }
  function addD(d, n) { var x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); }
  function db() { return W.DB || (typeof DB !== 'undefined' ? DB : null); }
  function office(x) { return x.OFFICE; } function firm(x) { return x.ROLE === 'firm'; } function crew(x) { return !x.OFFICE && x.ROLE !== 'firm'; }
  function fo(x) { return x.OFFICE || x.ROLE === 'firm'; } function co(x) { return x.OFFICE || crew(x); }
  function photoPl(rec) { var d = cl(rec); Object.keys(d).forEach(function (k) { if (Array.isArray(d[k])) d[k] = d[k].map(function (p) { p = Object.assign({}, p); if (p.path || p.removed) delete p.data; return p; }); }); return d; }
  // c = DB collection, t = table, obj = DB[c] is an object keyed by id (else an array), key = row id
  var COLS = [
    { c: 'calReqs',   t: 'cj_cal_requests',  ins: fo, upd: office, del: office },
    { c: 'calOv',     t: 'cj_cal_overrides', key: function (r) { return r.site + '|' + r.date; }, ins: fo, upd: office, del: office },
    { c: 'calBlocks', t: 'cj_cal_blocks',    ins: fo, upd: office, del: office },
    { c: 'calHand',   t: 'cj_handovers',     ins: function (x, r) { return x.OFFICE || (crew(x) && r.fromId === UID); }, upd: function (x, r) { return x.OFFICE || (crew(x) && r.toId === UID); }, del: office },
    { c: 'calAssign', t: 'cj_assign',        key: function (r) { return r.site + '|' + r.date + '|' + r.toId; }, ins: office, upd: office, del: office },
    { c: 'waxReqs',   t: 'cj_wax_requests',  ins: fo, upd: office, del: office },
    { c: 'waxVisits', t: 'cj_wax_visits',    key: function (r) { return 'wv|' + (r.reqId || r.no); }, ins: office, upd: office, del: office },
    { c: 'taskDone',  t: 'cj_task_ticks',    obj: true, ins: co, upd: co, del: office },
    { c: 'taskPhotos', t: 'cj_task_photos',  obj: true, ins: co, upd: co, del: office, pl: photoPl },
    { c: 'visitLogs', t: 'cj_visit_logs',    skip: function (r) { return r.clientView; }, ins: function (x, r) { return x.OFFICE || (crew(x) && r.userId === UID); }, upd: function (x, r) { return x.OFFICE || (crew(x) && r.userId === UID); }, del: office },
    { c: 'signoffs',  t: 'cj_signoffs',      ins: fo, upd: function () { return false; }, del: function () { return false; } },
    { c: 'issues',    t: 'cj_issues',        ins: fo, upd: office, del: office },
    { c: '__prefs',   t: 'cj_site_prefs',    virt: function (D) { var o = {}; (D.sites || []).forEach(function (s) { if (s.code && Array.isArray(s.photoTasks)) o[s.code] = { photoTasks: s.photoTasks }; }); return o; }, obj: true, ins: fo, upd: fo, del: function () { return false; } },
    { c: '__team',    t: 'cj_team_access',   virt: function (D) { var o = {}; (D.users || []).forEach(function (u) { if (u.type === 'firm' && u.team && u.loginOf && u.id) o[u.id] = { loginOf: u.loginOf, teamSites: u.teamSites || null, loginRole: u.loginRole || '' }; }); return o; }, obj: true, ins: office, upd: office, del: office }
  ];
  function rowsOf(col, D, x) {
    var out = {};
    if (col.virt) { if (col.c === '__team' && !x.OFFICE) return out; var v = col.virt(D); Object.keys(v).forEach(function (k) { out[k] = { r: v[k], pl: st(v[k]) }; }); return out; }
    if (col.obj) { var o = D[col.c] || {}; Object.keys(o).forEach(function (k) { out[k] = { r: o[k], pl: JSON.stringify((col.pl || cl)(o[k])) }; }); return out; }
    (D[col.c] || []).forEach(function (r) {
      if (!r || (col.skip && col.skip(r))) return;
      var k = col.key ? col.key(r) : (r.id || (r.id = (col.c.slice(0, 2) + Date.now().toString(36) + Math.random().toString(36).slice(2, 6))));
      var p = cl(r); delete p.firmName; out[k] = { r: r, pl: JSON.stringify(p) };
    });
    return out;
  }
  function baseline(x) { var D = db(); if (!D) return; BASE = {}; COLS.forEach(function (col) { var b = BASE[col.c] = {}; if (col.virt) { Object.assign(b, LOADED[col.c] || {}); return; } var m = rowsOf(col, D, x); Object.keys(m).forEach(function (k) { b[k] = m[k].pl; }); }); }

  /* ---------- reload ---------- */
  async function getUid(sb) { try { var s = await sb.auth.getSession(); UID = s && s.data && s.data.session && s.data.session.user ? s.data.session.user.id : null; } catch (e) { UID = null; } return UID; }
  async function load(D, x) {
    var sb = x.sb; await getUid(sb);
    LOADED = {};
    var me = (D.users || []).filter(function (u) { return u.id === x.MY_ID; })[0];
    var team = x.ROLE === 'firm' && !!(me && me.loginOf);              // a client team login (acts for its client)
    if (team) { var ts = await sb.rpc('cj_team_sites'); if (!ts.error && Array.isArray(ts.data)) D.sites = ts.data; }
    for (var i = 0; i < COLS.length; i++) {
      var col = COLS[i]; if (col.c === '__team' && !x.OFFICE) continue;
      if (col.c === 'visitLogs' && x.ROLE === 'firm') {
        var v = await sb.rpc('cj_client_visit_logs', { p_from: addD(day(), -120), p_to: addD(day(), 1) });
        D.visitLogs = !v.error && Array.isArray(v.data) ? v.data : []; continue;
      }
      var q = await sb.from(col.t).select('id,data').order('created_at');
      var rows = !q.error && q.data ? q.data : [];
      if (col.virt) { LOADED[col.c] = {}; rows.forEach(function (r) { LOADED[col.c][r.id] = st(r.data || {}); }); }
      if (col.c === '__prefs') { var by = {}; rows.forEach(function (r) { by[r.id] = r.data || {}; }); (D.sites || []).forEach(function (s) { if (by[s.code] && Array.isArray(by[s.code].photoTasks)) s.photoTasks = by[s.code].photoTasks; }); continue; }
      if (col.c === '__team') { var tb = {}; rows.forEach(function (r) { tb[r.id] = r.data || {}; }); (D.users || []).forEach(function (u) { if (tb[u.id]) u.teamSites = tb[u.id].teamSites || null; }); continue; }
      if (col.obj) { var o = {}; rows.forEach(function (r) { o[r.id] = r.data || {}; }); D[col.c] = o; }
      else D[col.c] = rows.map(function (r) { var d = r.data || {}; if (!col.key) d.id = r.id; return d; });
    }
    await signPhotos(sb, D.taskPhotos || {});
    function hi(l, re) { var n = 0; (l || []).forEach(function (r) { var m = re.exec(String(r.no || '')); if (m) n = Math.max(n, +m[1]); }); return n; }
    D.calSeq = Math.max(D.calSeq || 0, hi(D.calReqs, /(\d+)$/)); D.waxSeq = Math.max(D.waxSeq || 0, hi(D.waxReqs, /(\d+)$/));
    D.handSeq = Math.max(D.handSeq || 0, hi(D.calHand, /(\d+)$/)); D.issueSeq = Math.max(D.issueSeq || 0, hi(D.issues, /(\d+)$/));
  }
  async function signPhotos(sb, P) {
    var want = [], cut = addD(day(), -KEEP);
    Object.keys(P).forEach(function (key) { var d = key.split('|')[1], r = P[key]; Object.keys(r).forEach(function (k) { if (!Array.isArray(r[k])) return; r[k] = r[k].map(function (p) {
      if (!p || !p.path || p.removed) return p;
      if (d < cut) return { id: p.id, removed: true, takenAt: p.takenAt, path: p.path };
      want.push(p); return p; }); }); });
    if (!want.length) return;
    var s = await sb.storage.from(BUCKET).createSignedUrls(want.map(function (p) { return p.path; }), 3600);
    var url = {}; ((s && s.data) || []).forEach(function (u) { if (u && u.signedUrl && !u.error) url[u.path] = u.signedUrl; });
    want.forEach(function (p) { if (url[p.path]) p.data = url[p.path]; else { p.removed = true; delete p.data; } });
  }

  /* ---------- saving ---------- */
  function blobOf(dataUrl) { var m = /^data:(image\/(jpeg|png|webp));base64,(.*)$/.exec(dataUrl || ''); if (!m) return null; var b = atob(m[3]), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return { blob: new Blob([a], { type: m[1] }), type: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] }; }
  async function uploadPhotos(sb, key, rec, oldPl) {
    var site = key.split('|')[0], d = key.split('|')[1], keep = {};
    for (var k of Object.keys(rec)) { if (!Array.isArray(rec[k])) continue; for (var p of rec[k]) {
      if (p && p.path) keep[p.path] = 1;
      if (!p || p.path || p.removed || !/^data:/.test(p.data || '')) continue;
      var b = blobOf(p.data); if (!b) throw { message: 'Photo is not an image.' };
      var path = site + '/' + d + '/' + String(k).replace(/[^\w-]/g, '') + '/' + String(p.id).replace(/[^\w-]/g, '') + '.' + b.ext;
      var up = await sb.storage.from(BUCKET).upload(path, b.blob, { contentType: b.type, upsert: false });
      if (up.error && !/exists|duplicate/i.test(up.error.message || '')) throw up.error;
      p.path = path; keep[path] = 1; } }
    var gone = []; if (oldPl) { var o = JSON.parse(oldPl); Object.keys(o).forEach(function (k) { (Array.isArray(o[k]) ? o[k] : []).forEach(function (p) { if (p && p.path && !keep[p.path] && !p.removed) gone.push(p.path); }); }); }
    if (gone.length) await sb.storage.from(BUCKET).remove(gone);
  }
  async function flush(x) {
    var D = db(), sb = x.sb, failed = 0, err = null; if (!D) return { failed: 0 };
    if (!UID) await getUid(sb);
    function bad(e) { failed++; err = err || e || { message: 'Not allowed for your account.' }; }
    var plan = COLS.map(function (col) { return { col: col, now: rowsOf(col, D, x), base: BASE[col.c] || (BASE[col.c] = {}) }; });
    for (var i = plan.length - 1; i >= 0; i--) {                       // removals first, children before parents
      var p = plan[i]; for (var bk in p.base) if (!(bk in p.now)) {
        if (!p.col.del(x, null)) { delete p.base[bk]; continue; }        // e.g. a list trimmed on screen: nothing to remove for this role
        var dq = await sb.from(p.col.t).delete().eq('id', bk).select('id');
        if (dq.error) bad(dq.error); else delete p.base[bk];
      }
    }
    for (var j = 0; j < plan.length; j++) {                            // then adds / changes, parents before children
      var c = plan[j].col, now = plan[j].now, base = plan[j].base;
      for (var k of Object.keys(now)) {
        var it = now[k], isNew = !(k in base);
        if (!isNew && base[k] === it.pl) continue;
        if (!(isNew ? c.ins : c.upd)(x, it.r)) continue;
        try { if (c.c === 'taskPhotos') { await uploadPhotos(sb, k, it.r, base[k]); it.pl = JSON.stringify(photoPl(it.r)); if (!isNew && base[k] === it.pl) continue; } }
        catch (e) { bad(e); continue; }
        var data = JSON.parse(it.pl), q;
        if (isNew) { q = await sb.from(c.t).insert({ id: k, company_id: 'cj', data: data });
          if (q.error && q.error.code === '23505' && c.upd(x, it.r)) q = await sb.from(c.t).update({ data: data }).eq('id', k).select('id'); }
        else { q = await sb.from(c.t).update({ data: data }).eq('id', k).select('id'); if (!q.error && !(q.data || []).length) q = { error: { message: 'Not allowed for your account.' } }; }
        if (q.error) bad(q.error); else base[k] = it.pl;
      }
    }
    return { failed: failed, err: err };
  }
  H.load.push(load); H.flush.push(flush); H.baseline.push(baseline);
  W.CJ_LIVE = { load: load, flush: flush, baseline: baseline, _base: function () { return BASE; }, COLS: COLS };
})(typeof window !== 'undefined' ? window : globalThis);
