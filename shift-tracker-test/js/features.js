/* Pure logic for the Oct-2026 feature batch (no DOM, no storage) — unit-tested in tests/features.test.js.
 * Everything takes explicit inputs (incl. `now`) so it can be tested deterministically. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const H = 3600000;

  // ---- 3. Location check (clock-in only) ----
  function distanceM(a, b) {
    const R = 6371000, rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
  }
  function locCheck(site, loc) {
    if (!loc || loc.lat == null) return { status: 'none', onSite: false, distanceM: null }; // location off / denied
    const d = Math.round(distanceM(site, loc));
    return { status: d <= site.radiusM ? 'ok' : 'off', onSite: d <= site.radiusM, distanceM: d };
  }
  // Move a point `m` metres east (for the location simulator)
  const offsetEast = (p, m) => ({ lat: p.lat, lng: p.lng + m / (111320 * Math.cos((p.lat * Math.PI) / 180)) });

  // ---- 1. Missed clock-out ----
  // open shift is flagged if open longer than maxOpenH, or past scheduled end + graceH
  function missedClockOut(shift, sched, nowMs, s) {
    if (shift.clockOut) return null;
    const openH = (nowMs - new Date(shift.clockIn).getTime()) / H;
    if (openH > s.missedOpenHours) return { reason: 'Open ' + Math.floor(openH) + ' h (limit ' + s.missedOpenHours + ' h)', openH };
    if (sched && nowMs > new Date(sched.endIso).getTime() + s.schedGraceAfterEndH * H) return { reason: 'Past scheduled end + ' + s.schedGraceAfterEndH + ' h', openH };
    return null;
  }

  // ---- 2. No-show ----
  // flagged if no clock-in (same employee, same site) by start + graceMin; a clock-in from 2 h before start counts.
  function noShow(sched, userShifts, nowMs, s) {
    const start = new Date(sched.startIso).getTime();
    if (nowMs < start + s.noShowMin * 60000) return false;
    return !userShifts.some((x) => x.siteId === sched.siteId && new Date(x.clockIn).getTime() >= start - 2 * H && new Date(x.clockIn).getTime() <= new Date(sched.endIso).getTime());
  }
  function schedStatus(sched, userShifts, nowMs, s) {
    const start = new Date(sched.startIso).getTime();
    const sh = userShifts.find((x) => x.siteId === sched.siteId && new Date(x.clockIn).getTime() >= start - 2 * H && new Date(x.clockIn).getTime() <= new Date(sched.endIso).getTime());
    if (sh) { const late = (new Date(sh.clockIn).getTime() - start) / 60000; return { key: late > s.noShowMin ? 'late' : 'ok', label: late > s.noShowMin ? 'Late ' + Math.round(late) + ' min' : sh.clockOut ? 'Worked' : 'On shift', shiftId: sh.id }; }
    if (noShow(sched, userShifts, nowMs, s)) return { key: 'noshow', label: 'No-show' };
    return { key: 'upcoming', label: nowMs < start ? 'Upcoming' : 'Due' };
  }

  // ---- 4. Overtime / fatigue ----
  function otStatus(weekH, s) { return weekH > s.otThresholdH ? 'over' : weekH >= s.otNearH ? 'near' : null; }
  // consecutive Atlantic days worked, counting back from the most recent worked day (if it is today or yesterday)
  function consecutiveDays(dayKeys, todayKey, addDays) {
    const set = new Set(dayKeys); let d = set.has(todayKey) ? todayKey : addDays(todayKey, -1); let n = 0;
    while (set.has(d)) { n++; d = addDays(d, -1); }
    return n;
  }

  // ---- 8. Invoice math (integer cents; qty = billable hours rounded to 2 dp as on the timesheet) ----
  const cents = (x) => Math.round((x + Number.EPSILON) * 100);
  function invoiceAmounts(billableH, rate, hstRate) {
    const qty = Math.round((billableH + Number.EPSILON) * 100) / 100;
    const sub = cents(qty * rate); const tax = Math.round(sub * hstRate); const tot = sub + tax;
    return { qty, rate, subtotal: sub / 100, hst: tax / 100, total: tot / 100 };
  }
  const money = (n) => '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- 9. Aging ----
  const ageFlag = (days) => (days >= 45 ? 45 : days >= 30 ? 30 : days >= 15 ? 15 : 0);

  // ---- 7. Timesheet workflow ----
  const STATUSES = ['draft', 'reviewed', 'approved', 'locked'];
  const STATUS_LABEL = { draft: 'Draft', reviewed: 'Reviewed (Bal)', approved: 'Approved (owner)', locked: 'Billing locked' };
  function canAdvance(cur, next, issues) {
    const i = STATUSES.indexOf(cur), j = STATUSES.indexOf(next);
    if (j !== i + 1) return { ok: false, why: 'Steps go Draft → Reviewed → Approved → Billing locked.' };
    if (next === 'locked' && issues.length) return { ok: false, why: issues.length + ' issue(s) block locking.' };
    return { ok: true };
  }

  const fmtDist = (m) => (m == null ? '' : m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');
  CJ.F = { fmtDist, distanceM, locCheck, offsetEast, missedClockOut, noShow, schedStatus, otStatus, consecutiveDays, invoiceAmounts, money, ageFlag, STATUSES, STATUS_LABEL, canAdvance };
})();
