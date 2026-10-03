/* Data operations for the Oct-2026 feature batch (schedules, alerts, location, incidents, crew sign-off,
 * timesheet workflow + billing lock, invoices, A/R, accounting export, season summary).
 * Employee-facing functions are merged into CJ.api.emp and return site NUMBERS and worked hours only. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const db = () => CJ.api.db(); const save = () => CJ.api.save();
  const T = () => CJ.tz; const F = () => CJ.F;
  const site = (id) => db().sites.find((s) => s.id === id);
  const user = (id) => db().users.find((u) => u.id === id);
  const dk = (s) => T().dayKey(s.clockIn);
  const workedH = (s) => (s.clockOut ? (new Date(s.clockOut) - new Date(s.clockIn)) / 3600000 : 0);
  const S = () => db().settings;
  const tsKey = (siteId, ws) => siteId + '|' + ws;
  const fmtShort = (iso) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Halifax', weekday: 'short', hour: 'numeric', minute: '2-digit' });

  // ---------- Location ----------
  function simulateLocation(siteId, mode) {
    const st = site(siteId); if (!st) return null;
    const m = mode || 'onsite';
    if (m === 'off') return { lat: null, lng: null, distanceM: null, status: 'none', simulated: true, at: new Date().toISOString() };
    const metres = m === 'near' ? Math.round(st.radiusM * 1.6) : m === 'far' ? 5200 : 25;
    const p = F().offsetEast(st, metres); const c = F().locCheck(st, p);
    return { lat: p.lat, lng: p.lng, distanceM: c.distanceM, status: c.status, simulated: true, at: new Date().toISOString() };
  }
  const locFlag = (s) => s.location && s.location.status !== 'ok' && !s.location.reviewed;

  // ---------- Schedules ----------
  const userShifts = (uid) => db().shifts.filter((x) => x.userId === uid);
  const schedStatus = (x, now) => F().schedStatus(x, userShifts(x.userId), now || Date.now(), S());
  function addSchedule(userId, siteId, day, start, end, byId) {
    if (!user(userId) || !site(siteId) || !/^\d{4}-\d\d-\d\d$/.test(day) || !/^\d\d:\d\d$/.test(start) || !/^\d\d:\d\d$/.test(end)) return { error: 'Fill in employee, site, date, start and end.' };
    const [h1, m1] = start.split(':').map(Number), [h2, m2] = end.split(':').map(Number);
    const startIso = T().zoned(day, h1, m1).toISOString(); let endD = T().zoned(day, h2, m2); if (endD <= new Date(startIso)) endD = T().zoned(T().addDays(day, 1), h2, m2);
    db().schedules.push({ id: 'sc' + Date.now(), userId, siteId, day, start, end, startIso, endIso: endD.toISOString(), createdBy: byId, createdAt: new Date().toISOString() }); save(); return { ok: true };
  }
  const schedFor = (s) => db().schedules.find((x) => x.userId === s.userId && x.siteId === s.siteId && x.day === dk(s));

  // ---------- Alerts ----------
  function missedList(now) { return db().shifts.filter((s) => !s.clockOut).map((s) => ({ shift: s, m: F().missedClockOut(s, schedFor(s), now || Date.now(), S()) })).filter((x) => x.m); }
  function weekHours(uid, ws) { return userShifts(uid).filter((s) => CJ.rules.inWeek(dk(s), ws)).reduce((a, s) => a + (s.clockOut ? workedH(s) : F().missedClockOut(s, schedFor(s), Date.now(), S()) ? 0 : (Date.now() - new Date(s.clockIn)) / 3600000), 0); } // missed clock-outs count 0 until fixed
  function otList() {
    const ws = T().weekStart(T().todayKey());
    return db().users.filter((u) => u.role === 'worker' && u.status === 'active').map((u) => ({ user: u, hours: weekHours(u.id, ws), status: F().otStatus(weekHours(u.id, ws), S()) })).filter((x) => x.status).sort((a, b) => b.hours - a.hours);
  }
  function fatigueList() {
    return db().users.filter((u) => u.role === 'worker').map((u) => ({ user: u, days: F().consecutiveDays(userShifts(u.id).map(dk), T().todayKey(), T().addDays) })).filter((x) => x.days >= S().maxConsecDays).sort((a, b) => b.days - a.days);
  }
  function noShowList(now) { const since = T().addDays(T().todayKey(), -7); return db().schedules.filter((x) => x.day >= since && x.day <= T().todayKey()).map((x) => ({ sched: x, st: schedStatus(x, now) })).filter((x) => x.st.key === 'noshow'); }
  // In-app reminders to employees (idempotent) — nothing leaves the app.
  function refreshReminders() {
    let n = 0;
    missedList().forEach(({ shift, m }) => {
      const key = 'missed|' + shift.id; if (db().notifications.some((x) => x.key === key)) return;
      db().notifications.push({ id: 'nt' + Date.now() + n++, key, userId: shift.userId, shiftId: shift.id, kind: 'missed', text: `You're still clocked in at Site ${site(shift.siteId).number} since ${fmtShort(shift.clockIn)}. Please clock out, or fix your time in My shifts.`, at: new Date().toISOString(), read: false });
    });
    if (n) save();
  }
  function alerts() {
    refreshReminders();
    const lastWk = T().addDays(T().weekStart(T().todayKey()), -7);
    return {
      missed: missedList().map((x) => ({ ...x, reminded: db().notifications.some((n) => n.key === 'missed|' + x.shift.id) })),
      noShows: noShowList(), offsite: db().shifts.filter(locFlag).sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn)),
      crew: CJ.api.admin.crewMismatches(14), ot: otList(), fatigue: fatigueList(),
      incidents: db().incidents.filter(incOpen),
      unsigned: unsignedSiteDays(lastWk, T().addDays(T().todayKey(), -1)),
      overdue: invoiceRows().filter((r) => r.balance > 0.005 && r.age >= 30),
    };
  }

  // ---------- Incidents ----------
  const INC_TYPES = ['Injury', 'Near miss', 'Chemical', 'Other'];
  const incOpen = (i) => i.wcbStatus === 'WCB review needed' || i.wcbStatus === 'WCB follow-up needed';
  const WCB = ['WCB review needed', 'WCB follow-up needed', 'Reported to WCB', 'No WCB needed — closed'];
  function addIncident(s, inc) { db().incidents.push({ id: 'in' + Date.now(), shiftId: s.id, userId: s.userId, siteId: s.siteId, type: INC_TYPES.includes(inc.type) ? inc.type : 'Other', text: (inc.text || '').slice(0, 500), photo: inc.photo || null, at: s.clockOut, wcbStatus: 'WCB review needed', history: [{ status: 'WCB review needed', by: s.userId, at: s.clockOut }] }); }
  function setWcb(id, status, byId) { const i = db().incidents.find((x) => x.id === id); if (!i || !WCB.includes(status)) return { error: 'Unknown' }; i.wcbStatus = status; i.history.push({ status, by: byId, at: new Date().toISOString() }); save(); return { ok: true }; }

  // ---------- Crew lead sign-off ----------
  const signoff = (siteId, day) => db().signoffs.find((x) => x.siteId === siteId && x.day === day);
  function siteDaysBetween(from, to) { const m = {}; db().shifts.forEach((s) => { const d = dk(s); if (d >= from && d <= to) (m[s.siteId + '|' + d] = m[s.siteId + '|' + d] || []).push(s); }); return m; }
  function unsignedSiteDays(from, to) { return Object.keys(siteDaysBetween(from, to)).filter((k) => { const [sid, d] = k.split('|'); return !signoff(sid, d); }).map((k) => ({ siteId: k.split('|')[0], day: k.split('|')[1] })); }
  function doSignoff(siteId, day, byUserId, byRole) {
    if (isLocked(siteId, T().weekStart(day))) return { error: 'This week is billing-locked.' };
    if (signoff(siteId, day)) return { error: 'Already signed off.' };
    const list = db().shifts.filter((s) => s.siteId === siteId && dk(s) === day);
    if (list.some((s) => !s.clockOut)) return { error: 'Someone is still clocked in for this day.' };
    db().signoffs.push({ siteId, day, byUserId, byRole, at: new Date().toISOString(), hours: list.reduce((a, s) => a + workedH(s), 0) }); save(); return { ok: true };
  }

  // ---------- Timesheet workflow + billing lock ----------
  const tsStatus = (siteId, ws) => db().tsStatus[tsKey(siteId, ws)] || { status: 'draft', history: [] };
  const isLocked = (siteId, ws) => tsStatus(siteId, ws).status === 'locked';
  const isLockedShift = (s) => isLocked(s.siteId, T().weekStart(dk(s)));
  function lockIssues(siteId, ws) {
    const shifts = db().shifts.filter((s) => s.siteId === siteId && CJ.rules.inWeek(dk(s), ws)); const out = [];
    shifts.filter((s) => !s.clockOut).forEach((s) => out.push({ type: 'missed', label: 'Missed clock-out — ' + user(s.userId).name, day: dk(s), shiftId: s.id }));
    CJ.rules.groupDays(shifts).filter((g) => !(g.worked > 0)).forEach((g) => out.push({ type: 'zero', label: '0 h worked — ' + user(g.userId).name, day: g.day }));
    [...new Set(shifts.map(dk))].forEach((d) => { const c = CJ.api.admin.crewCheck(siteId, d); if (c.mismatch) out.push({ type: 'crew', label: 'Crew mismatch — ' + c.label, day: d }); });
    shifts.filter(locFlag).forEach((s) => out.push({ type: 'offsite', label: (s.location.status === 'none' ? 'No location' : 'Off-site ' + (s.location.distanceM / 1000).toFixed(1) + ' km') + ' — ' + user(s.userId).name + ' (needs review)', day: dk(s), shiftId: s.id }));
    [...new Set(shifts.filter((s) => s.clockOut).map(dk))].forEach((d) => { if (!signoff(siteId, d)) out.push({ type: 'unsigned', label: 'Day not signed off', day: d }); });
    return out.sort((a, b) => a.day.localeCompare(b.day));
  }
  function advance(siteId, ws, next, byName) {
    const cur = tsStatus(siteId, ws); const chk = F().canAdvance(cur.status, next, next === 'locked' ? lockIssues(siteId, ws) : []);
    if (!chk.ok) return { error: chk.why };
    const rec = db().tsStatus[tsKey(siteId, ws)] = { status: next, history: [...(cur.history.length ? cur.history : [{ status: 'draft', byName: 'System', at: new Date().toISOString(), note: 'Generated' }]), { status: next, byName, at: new Date().toISOString() }] };
    save(); return { ok: true, status: rec.status };
  }
  // Called by doEdit: locked weeks block edits unless the ADMIN passes an owner override (with reason).
  function lockGuard(s, changes, byRole) {
    if (!isLockedShift(s)) return null;
    if (byRole !== 'admin') return { error: 'This week is billing-locked. Ask the office to change it.' };
    if (!changes.override) return { error: 'This farm-week is Billing locked. Tick “Owner override” to change it (it will be recorded in the audit log).' };
    return { override: true };
  }
  function recordOverride(s, edits, byUserId) {
    edits.forEach((e) => (e.override = true));
    const k = tsKey(s.siteId, T().weekStart(dk(s))); db().tsStatus[k].history.push({ status: 'locked', byName: user(byUserId).name, at: new Date().toISOString(), note: 'OWNER OVERRIDE: edited ' + user(s.userId).name + ' ' + dk(s) + ' (' + edits.map((e) => e.field).join(', ') + ')' });
    const inv = invoiceFor(s.siteId, T().weekStart(dk(s))); if (inv) inv.changedAfterLock = true;
  }

  // ---------- Invoices + A/R ----------
  const invoiceFor = (siteId, ws) => db().invoices.find((i) => i.siteId === siteId && i.weekStart === ws);
  const paidOf = (i) => Math.round(i.payments.reduce((a, p) => a + p.amount, 0) * 100) / 100;
  function createInvoice(siteId, ws, byId) {
    if (!isLocked(siteId, ws)) return { error: 'Invoices can only be drafted once the timesheet is Billing locked.' };
    if (invoiceFor(siteId, ws)) return { error: 'An invoice already exists for this farm-week.', id: invoiceFor(siteId, ws).id };
    const st = site(siteId); const days = CJ.rules.groupDays(db().shifts.filter((s) => s.siteId === siteId && CJ.rules.inWeek(dk(s), ws)));
    const amt = F().invoiceAmounts(days.reduce((a, d) => a + d.billable, 0), st.rate, S().hstRate);
    const n = db().invoices.filter((i) => i.siteId === siteId).length + 1;
    const inv = { id: 'inv-' + siteId + '-' + ws, number: st.invoicePrefix + '-' + String(n).padStart(4, '0'), siteId, weekStart: ws, date: T().todayKey(), ...amt, status: 'draft', createdBy: byId, createdAt: new Date().toISOString(), payments: [] };
    db().invoices.push(inv); save(); return { ok: true, id: inv.id };
  }
  function invoiceRows() {
    const today = T().todayKey();
    return db().invoices.map((i) => {
      const paid = paidOf(i), balance = Math.round((i.total - paid) * 100) / 100; const base = i.issuedAt || i.date;
      const age = Math.max(0, Math.round((T().zoned(today, 12, 0) - T().zoned(base, 12, 0)) / 86400000));
      const status = i.status === 'draft' ? 'Draft' : balance <= 0.005 ? 'Paid' : paid > 0 ? 'Partially paid' : 'Issued';
      return { inv: i, site: site(i.siteId), paid, balance, age, ageFlag: balance > 0.005 && i.status !== 'draft' ? F().ageFlag(age) : 0, status, datePaid: i.payments.length ? i.payments[i.payments.length - 1].date : '' };
    }).sort((a, b) => b.inv.weekStart.localeCompare(a.inv.weekStart) || a.site.number - b.site.number);
  }
  function markIssued(id, byId) { const i = db().invoices.find((x) => x.id === id); if (!i) return { error: 'Not found' }; i.status = 'issued'; i.issuedAt = T().todayKey(); i.issuedBy = byId; save(); return { ok: true }; }
  function recordPayment(id, amount, date, note, byId) {
    const i = db().invoices.find((x) => x.id === id); const a = Math.round(Number(amount) * 100) / 100;
    if (!i) return { error: 'Not found' }; if (!(a > 0)) return { error: 'Enter an amount.' }; if (a > i.total - paidOf(i) + 0.005) return { error: 'More than the balance.' };
    i.payments.push({ amount: a, date: date || T().todayKey(), note: note || '', by: byId }); save(); return { ok: true };
  }
  function accountingCsv(invs) {
    const c = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const L = [['InvoiceNo', 'Customer', 'Date', 'Description', 'Qty', 'Rate', 'TaxCode', 'Total', 'Tax', 'InvoiceTotal'].map(c).join(',')];
    invs.forEach((i) => { const st = site(i.siteId); L.push([i.number, st.clientName, i.date, 'Cleaning services — Site ' + st.number + ', week of ' + i.weekStart + ' (billable hours per timesheet)', i.qty.toFixed(2), i.rate.toFixed(2), 'HST 15% (PE)', i.subtotal.toFixed(2), i.hst.toFixed(2), i.total.toFixed(2)].map(c).join(',')); });
    return L.join('\n');
  }
  function seasonSummary(year) {
    const from = year + '-07-01', to = year + '-11-30';
    const days = CJ.rules.groupDays(db().shifts.filter((s) => { const d = dk(s); return d >= from && d <= to; }));
    return db().sites.map((st) => {
      const mine = days.filter((d) => d.siteId === st.id); const bill = mine.reduce((a, d) => a + d.billable, 0); const worked = mine.reduce((a, d) => a + d.worked, 0);
      const invs = invoiceRows().filter((r) => r.inv.siteId === st.id && r.inv.weekStart >= from && r.inv.weekStart <= to);
      const months = {}; [7, 8, 9, 10, 11].forEach((m) => (months[m] = mine.filter((d) => +d.day.slice(5, 7) === m).reduce((x, d) => x + d.billable, 0)));
      return { site: st, months, worked, billable: bill, dollars: F().invoiceAmounts(bill, st.rate, 0).subtotal, invoiced: invs.reduce((a, r) => a + r.inv.total, 0), paid: invs.reduce((a, r) => a + r.paid, 0), balance: invs.reduce((a, r) => a + r.balance, 0) };
    }).filter((x) => x.worked > 0);
  }

  // ---------- Employee-facing (site numbers + worked hours only) ----------
  const empOps = {
    schedule(uid) {
      const today = T().todayKey();
      return db().schedules.filter((x) => x.userId === uid && x.day >= today).sort((a, b) => a.startIso.localeCompare(b.startIso)).slice(0, 14).map((x) => ({ day: x.day, start: x.start, end: x.end, startIso: x.startIso, endIso: x.endIso, siteNumber: site(x.siteId).number }));
    },
    notifications(uid) { refreshReminders(); return db().notifications.filter((n) => n.userId === uid && !n.read && db().shifts.some((s) => s.id === n.shiftId && !s.clockOut)).map((n) => ({ id: n.id, text: n.text, at: n.at })); },
    dismiss(uid, id) { const n = db().notifications.find((x) => x.id === id && x.userId === uid); if (n) { n.read = true; save(); } },
    locPreview(siteId, mode) { const l = simulateLocation(siteId, mode); return l && { status: l.status, distanceM: l.distanceM }; },
    isCrewLead(uid) { return !!(user(uid) || {}).crewLead; },
    crewDays(uid) {
      if (!empOps.isCrewLead(uid)) return [];
      const from = T().addDays(T().todayKey(), -13);
      const mine = [...new Set(userShifts(uid).filter((s) => dk(s) >= from).map((s) => s.siteId + '|' + dk(s)))];
      return mine.map((k) => {
        const [sid, day] = k.split('|'); const list = db().shifts.filter((s) => s.siteId === sid && dk(s) === day); const so = signoff(sid, day);
        const byUser = {}; list.forEach((s) => { const n = user(s.userId).name; byUser[n] = byUser[n] || { name: n, worked: 0, open: false }; byUser[n].worked += workedH(s); if (!s.clockOut) byUser[n].open = true; });
        return { key: k, siteNumber: site(sid).number, day, members: Object.values(byUser), signed: so ? { byName: user(so.byUserId).name, at: so.at } : null, locked: isLocked(sid, T().weekStart(day)), anyOpen: list.some((s) => !s.clockOut) };
      }).sort((a, b) => b.day.localeCompare(a.day));
    },
    signOff(uid, key) {
      if (!empOps.isCrewLead(uid)) return { error: 'Only crew leads can sign off.' };
      const [sid, day] = key.split('|'); if (!userShifts(uid).some((s) => s.siteId === sid && dk(s) === day)) return { error: 'You can only sign off days you worked.' };
      return doSignoff(sid, day, uid, 'crewlead');
    },
  };
  const adminOps = {
    alerts, addSchedule, schedStatus, schedules: () => db().schedules, schedFor, incidents: () => db().incidents, setWcb, INC_TYPES, WCB, incOpen,
    signoff, adminSignoff: (siteId, day, byId) => doSignoff(siteId, day, byId, 'admin'),
    reviewLocation(id, byId, note) { const s = db().shifts.find((x) => x.id === id); if (!s || !s.location) return { error: 'Not found' }; s.location.reviewed = { by: byId, at: new Date().toISOString(), note: note || '' }; save(); return { ok: true }; },
    locFlag, tsStatus, lockIssues, advance, isLocked, isLockedShift, invoiceFor, createInvoice, invoiceRows, markIssued, recordPayment, accountingCsv, seasonSummary, otList, fatigueList, weekHours,
    setRate(id, rate) { const s = site(id); const v = Math.round(Number(rate) * 100) / 100; if (!s || !(v > 0)) return { error: 'Invalid rate' }; s.rate = v; s.rateSample = false; save(); return { ok: true }; },
    setRadius(id, r) { const s = site(id); const v = Math.round(Number(r)); if (!s || !(v >= 25 && v <= 5000)) return { error: 'Radius 25–5000 m' }; s.radiusM = v; save(); return { ok: true }; },
  };
  CJ.ops = { simulateLocation, addIncident, lockGuard, recordOverride, isLockedShift, ...adminOps };
  Object.assign(CJ.api.emp, empOps);
  Object.assign(CJ.api.admin, adminOps);
})();
