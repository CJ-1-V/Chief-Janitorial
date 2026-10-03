/* Role-scoped data access.
 * CJ.api.emp.*   -> what an EMPLOYEE client may see. Sites are projected to {id, number} only:
 *                   client/farm names, addresses and legacy codes are stripped here and never
 *                   reach employee screens. (In production this projection MUST happen on the server.)
 * CJ.api.admin.* -> full records for the owner/admin. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  let db = null;

  function load() {
    try { db = JSON.parse(localStorage.getItem(CJ.STORE_KEY)); } catch (e) { db = null; }
    if (!db || db.version !== 5) { db = CJ.seed(); save(); }
    return db;
  }
  function save() { localStorage.setItem(CJ.STORE_KEY, JSON.stringify(db)); }
  function reset() { db = CJ.seed(); save(); }
  const user = (id) => db.users.find((u) => u.id === id);
  const site = (id) => db.sites.find((s) => s.id === id);
  const shift = (id) => db.shifts.find((s) => s.id === id);
  const fieldEdited = (s, f) => s.edits.some((e) => e.field === f);

  function validateTimes(inIso, outIso) {
    const now = Date.now();
    const i = new Date(inIso).getTime();
    if (isNaN(i)) return 'Clock-in time is missing.';
    if (i > now + 60000) return 'Clock-in can\'t be in the future.';
    if (outIso) {
      const o = new Date(outIso).getTime();
      if (isNaN(o)) return 'Clock-out time is invalid.';
      if (o <= i) return 'Clock-out must be after clock-in.';
      if (o > now + 60000) return 'Clock-out can\'t be in the future.';
      if ((o - i) / 3600000 > db.settings.maxShiftHours) return 'A shift can\'t be longer than ' + db.settings.maxShiftHours + ' hours. Ask the office if this is right.';
    }
    return null;
  }

  const validCrew = (c) => Number.isInteger(c) && c >= 1 && c <= 50;
  function doEdit(s, changes, byUserId, byRole) {
    if (!changes.reason || !changes.reason.trim()) return { error: 'Please give a reason for the change.' };
    const newIn = changes.clockIn || s.clockIn;
    const newOut = changes.clockOut === undefined ? s.clockOut : changes.clockOut || null;
    const err = validateTimes(newIn, newOut);
    if (err) return { error: err };
    const lk = CJ.ops && CJ.ops.lockGuard(s, changes, byRole); if (lk && lk.error) return lk; // billing-lock check
    const atIso = new Date().toISOString();
    let n = 0;
    if (changes.clockIn && new Date(changes.clockIn).getTime() !== new Date(s.clockIn).getTime()) { CJ.applyEdit(s, 'clockIn', new Date(changes.clockIn).toISOString(), byUserId, byRole, atIso, changes.reason.trim()); n++; }
    const curOut = s.clockOut ? new Date(s.clockOut).getTime() : null;
    const nextOut = newOut ? new Date(newOut).getTime() : null;
    if (changes.crewCount !== undefined && changes.crewCount !== null && changes.crewCount !== '') {
      const c = Number(changes.crewCount);
      if (!validCrew(c)) return { error: 'Workers on site must be a whole number from 1 to 50.' };
    } else if (newOut && s.crewCount == null) return { error: 'Enter how many workers were on site this shift.' };
    if (nextOut !== curOut) { CJ.applyEdit(s, 'clockOut', newOut ? new Date(newOut).toISOString() : null, byUserId, byRole, atIso, changes.reason.trim()); n++; }
    if (changes.crewCount !== undefined && changes.crewCount !== null && changes.crewCount !== '' && Number(changes.crewCount) !== s.crewCount) { CJ.applyEdit(s, 'crewCount', Number(changes.crewCount), byUserId, byRole, atIso, changes.reason.trim()); n++; }
    if (!n) return { error: 'Nothing changed.' };
    if (lk && lk.override) CJ.ops.recordOverride(s, s.edits.slice(-n), byUserId);
    save();
    return { ok: true };
  }

  // ---------- EMPLOYEE (restricted) ----------
  const empSite = (s) => ({ id: s.id, number: s.number }); // <- the privacy boundary
  function empShift(s, uid) {
    const st = site(s.siteId);
    const lastBy = (f) => { const e = [...s.edits].reverse().find((x) => x.field === f); return e ? { byMe: e.byUserId === uid, at: e.at } : null; };
    return {
      id: s.id, siteNumber: st ? st.number : null, clockIn: s.clockIn, clockOut: s.clockOut, notes: s.notes, outNote: s.outNote || '',
      inEdited: fieldEdited(s, 'clockIn'), outEdited: fieldEdited(s, 'clockOut'),
      inEdit: lastBy('clockIn'), outEdit: lastBy('clockOut'),
      crewCount: s.crewCount == null ? null : s.crewCount, // the employee's own reported crew size (a number only)
      // Office reasons are NOT exposed to employees (they could mention the client).
    };
  }
  const emp = {
    me(uid) { const u = user(uid); return u && { id: u.id, name: u.name, phone: u.phone, status: u.status, role: u.role, createdAt: u.createdAt }; },
    sites() { return db.sites.filter((s) => s.active).map(empSite); },
    recentSiteNumbers(uid) {
      const out = [];
      db.shifts.filter((s) => s.userId === uid).sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn)).forEach((s) => { const n = site(s.siteId).number; if (!out.includes(n)) out.push(n); });
      return out.slice(0, 3);
    },
    shifts(uid) { return db.shifts.filter((s) => s.userId === uid).sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn)).map((s) => empShift(s, uid)); },
    shift(uid, id) { const s = shift(id); return s && s.userId === uid ? empShift(s, uid) : null; },
    openShift(uid) { const s = db.shifts.find((x) => x.userId === uid && !x.clockOut); return s ? empShift(s, uid) : null; },
    canEdit(uid, id) {
      const s = shift(id); if (!s || s.userId !== uid) return false;
      if (CJ.ops && CJ.ops.isLockedShift(s)) return false; // billing-locked week: only the owner can override
      return (Date.now() - new Date(s.clockIn).getTime()) / 86400000 <= db.settings.empEditWindowDays;
    },
    // Weekly WORKED hours only (Atlantic Mon–Sun). Owner rule: employees never see paid hours, deductions,
    // billable hours or site/farm info — so none of those are computed or returned here.
    // Employee pay view (owner CONFIRMED Oct 3 9:14 AM): Worked, Unpaid break, Paid — per day per site, split punches combined.
    // Projection: NO billable hours, bill adjustment, 5 h minimum, money or farm fields.
    payDays(uid) {
      return CJ.rules.groupDays(db.shifts.filter((s) => s.userId === uid && s.clockOut)).map((g) => {
        const r = CJ.rules.apply(g.worked); const st = site(g.siteId);
        return { day: g.day, siteNumber: st ? st.number : null, shiftIds: g.shifts.map((x) => x.id), worked: r.worked, unpaidBreak: r.payDed, paid: r.paid };
      });
    },
    weekSummary(uid) {
      const days = emp.payDays(uid);
      const ws = CJ.tz.weekStart(CJ.tz.todayKey());
      const sum = (w) => { const d = days.filter((x) => CJ.rules.inWeek(x.day, w)); return { worked: d.reduce((a, x) => a + x.worked, 0), unpaidBreak: d.reduce((a, x) => a + x.unpaidBreak, 0), paid: d.reduce((a, x) => a + x.paid, 0), shifts: d.reduce((a, x) => a + x.shiftIds.length, 0), days: d.length }; };
      return { thisWeek: sum(ws), lastWeek: sum(CJ.tz.addDays(ws, -7)) };
    },
    breakRule() { return 'Unpaid break: shifts over 5 h have 0.5 h unpaid, 8 h or more have 1 h unpaid — worked out once per day per site (split shifts are added together).'; },
    editWindowDays() { return db.settings.empEditWindowDays; },
    clockIn(uid, siteId, notes, locMode) {
      const u = user(uid);
      if (!u || u.status !== 'active') return { error: 'Your account is waiting for approval.' };
      if (db.shifts.some((x) => x.userId === uid && !x.clockOut)) return { error: 'You are already clocked in.' };
      if (!site(siteId)) return { error: 'Pick a site first.' };
      const t = new Date().toISOString();
      const loc = CJ.ops ? CJ.ops.simulateLocation(siteId, locMode) : null;
      db.shifts.unshift({ id: 'sh' + Date.now(), userId: uid, siteId, clockIn: t, clockOut: null, notes: (notes || '').slice(0, 120), recordedIn: t, recordedOut: null, crewCount: null, recordedCrew: null, edits: [], location: loc });
      save(); return { ok: true, loc: loc && { status: loc.status, distanceM: loc.distanceM } };
    },
    // outNote: optional clock-out note, max 120 chars, saved ONCE and read-only afterwards (no API can change it).
    clockOut(uid, crewCount, incident, outNote) {
      const s = db.shifts.find((x) => x.userId === uid && !x.clockOut); if (!s) return { error: 'Not clocked in.' };
      const c = Number(crewCount); if (!validCrew(c)) return { error: 'Enter how many workers were on site (1–50) before clocking out.' };
      const note = String(outNote || '').replace(/\s+/g, ' ').trim(); if (note.length > 120) return { error: 'Clock-out note is limited to 120 characters.' };
      s.clockOut = s.recordedOut = new Date().toISOString(); s.crewCount = s.recordedCrew = c;
      if (note && !s.outNote) { s.outNote = note; s.outNoteAt = s.clockOut; }
      if (incident && incident.type && CJ.ops) CJ.ops.addIncident(s, incident);
      save(); return { ok: true };
    },
    edit(uid, id, changes) {
      const s = shift(id); if (!s || s.userId !== uid) return { error: 'You can only edit your own shifts.' };
      if (!emp.canEdit(uid, id)) return { error: 'This shift is older than ' + db.settings.empEditWindowDays + ' days. Ask the office to change it.' };
      return doEdit(s, changes, uid, 'worker');
    },
    signup(name, phone, password) {
      phone = (phone || '').replace(/\D/g, '');
      if (!name || !name.trim()) return { error: 'Enter your name.' };
      if (phone.length !== 10) return { error: 'Enter a 10-digit phone number.' };
      if (!password || password.length < 4) return { error: 'Password must be at least 4 characters.' };
      if (db.users.some((u) => u.phone === phone)) return { error: 'That phone number already has an account.' };
      const u = { id: 'u-' + Date.now(), name: name.trim(), phone, password, role: 'worker', status: 'pending', createdAt: new Date().toISOString() };
      db.users.push(u); save(); return { ok: true, id: u.id };
    },
  };

  // ---------- ADMIN (full) ----------
  const admin = {
    users: () => db.users, user, sites: () => db.sites, site, shift,
    shifts: () => [...db.shifts].sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn)),
    fieldEdited, settings: () => db.settings,
    pending: () => db.users.filter((u) => u.status === 'pending').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    processed: () => db.users.filter((u) => u.role === 'worker' && u.decidedAt && u.status !== 'pending').sort((a, b) => new Date(b.decidedAt) - new Date(a.decidedAt)),
    decide(uid, approve, note, byId) {
      const u = user(uid); if (!u || u.status !== 'pending') return { error: 'Request not found.' };
      u.status = approve ? 'active' : 'rejected'; u.decidedBy = byId; u.decidedAt = new Date().toISOString(); u.decisionNote = note || ''; save(); return { ok: true };
    },
    edit(id, changes, byId) { const s = shift(id); if (!s) return { error: 'Shift not found.' }; return doEdit(s, changes, byId, 'admin'); },
    addSite(name, type, location) {
      const number = Math.max(...db.sites.map((s) => s.number)) + 1;
      let pre = String(name).split(/\s+/).filter(Boolean).map((w) => w[0]).join('').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'CJ'; while (db.sites.some((s) => s.invoicePrefix === pre)) pre = pre.slice(0, 3) + number;
      // New sites start at the Charlottetown default point until the owner sets real coordinates; SAMPLE rate until entered.
      db.sites.push({ id: 's' + number, number, clientName: name, type, location, legacyCode: '', active: true, lat: 46.2382, lng: -63.1311, radiusM: type === 'Farm' ? 300 : 150, rate: 35, rateSample: true, invoicePrefix: pre }); save(); return { ok: true, number };
    },
    // Crew check for one site on one Atlantic day: distinct workers who clocked in vs crew counts reported at clock-out.
    crewCheck(siteId, dayKey) {
      const sh = db.shifts.filter((x) => x.siteId === siteId && CJ.tz.dayKey(x.clockIn) === dayKey);
      const clockedIn = new Set(sh.map((x) => x.userId)).size;
      const reported = [...new Set(sh.filter((x) => x.crewCount != null).map((x) => x.crewCount))].sort((a, b) => b - a);
      const mismatch = reported.length > 0 && reported.some((r) => r !== clockedIn);
      return { siteId, day: dayKey, clockedIn, reported, mismatch, label: mismatch ? 'Reported ' + reported.join('/') + ', clocked in ' + clockedIn : '' };
    },
    crewMismatches(days) {
      const since = CJ.tz.addDays(CJ.tz.todayKey(), -(days - 1)); const seen = new Set(); const out = [];
      db.shifts.forEach((x) => { const k = x.siteId + '|' + CJ.tz.dayKey(x.clockIn); if (seen.has(k) || CJ.tz.dayKey(x.clockIn) < since) return; seen.add(k); const c = admin.crewCheck(x.siteId, CJ.tz.dayKey(x.clockIn)); if (c.mismatch) out.push(c); });
      return out.sort((a, b) => b.day.localeCompare(a.day));
    },
    allEdits() {
      const out = []; db.shifts.forEach((s) => s.edits.forEach((e) => out.push({ ...e, shift: s }))); return out.sort((a, b) => new Date(b.at) - new Date(a.at));
    },
  };

  function login(phone, password) {
    phone = (phone || '').replace(/\D/g, '');
    const u = db.users.find((x) => x.phone === phone && x.password === password);
    return u ? { ok: true, id: u.id, role: u.role } : { error: 'Phone number or password is incorrect.' };
  }
  function roleOf(uid) { const u = user(uid); return u ? u.role : null; }

  CJ.api = { load, save, reset, emp, admin, login, roleOf, db: () => db, _internal: { user, site, shift, fieldEdited, validCrew } };
})();
