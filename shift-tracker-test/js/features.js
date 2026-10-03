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
  // ---- Rate history (owner, Oct 3): each site keeps [{rate, from:'YYYY-MM-DD', role?, ...}]; billing uses the rate in effect on the shift's (Atlantic) day.
  // ---- Roles (Grok Bot, Oct 3): a site can have a rate per role (e.g. Labourer vs Truck driver), each with its own effective dates.
  //      An entry without `role` belongs to the site's default role. The shift's role picks the rate.
  const roleKey = (site, role) => role || site.defaultRole || '';
  const rKey = (site, r) => r.role || site.defaultRole || '';
  function siteRoles(site) { const out = []; const add = (x) => { if (x && !out.includes(x)) out.push(x); }; add(site.defaultRole); (site.rates || []).forEach((r) => add(rKey(site, r))); (site.roleNames || []).forEach(add); return out; }
  // role of one worker-day at a site: per-shift override > the worker's role at this site > site default
  function roleOf(site, g) { const s = (g.shifts || []).find((x) => x.jobRole); return (g.role || (s && s.jobRole) || (site.workerRoles || {})[g.userId] || site.defaultRole || ''); }
  function rateOn(site, dayKey, role) {
    let k = roleKey(site, role); if (role && !siteRoles(site).includes(role)) k = roleKey(site, ''); // unknown role -> default role
    const mine = (site.rates || []).filter((r) => rKey(site, r) === k);
    const list = mine.filter((r) => r.from <= dayKey).sort((a, b) => a.from.localeCompare(b.from) || String(a.at || '').localeCompare(String(b.at || '')));
    if (list.length) return list[list.length - 1].rate;
    const first = mine.slice().sort((a, b) => a.from.localeCompare(b.from))[0];
    return first ? first.rate : site.rates ? undefined : site.rate; // before the first effective date: earliest known rate; no rates = MISSING (undefined, never invented)
  }
  const BILLING_TYPES = { hourly: 'Hourly', monthly: 'Monthly flat fee', 'per-visit': 'Per visit' };
  // Why a farm-week can't be invoiced yet (null = OK). MISSING rate or non-hourly billing blocks; a FLAGGED rate only warns.
  // days (optional) = the worker-days being invoiced: any role in use without a rate also blocks.
  function invoiceBlock(site, days) {
    if ((site.billingType || 'hourly') !== 'hourly') return BILLING_TYPES[site.billingType] + ' billing — invoicing for monthly / per-visit sites is not built yet (still open with the owner).';
    if (site.rateStatus === 'missing' || rateOn(site, '9999-12-31') == null) return 'Rate missing — enter the rate on Sites → Rates first. Invoices are blocked until then.';
    const miss = [...new Set((days || []).filter((d) => d.billable > 0 && rateOn(site, d.day, roleOf(site, d)) == null).map((d) => roleOf(site, d)))];
    if (miss.length) return 'Rate missing for role: ' + miss.join(', ') + ' — enter it on the site page first. Invoices are blocked until then.';
    return null;
  }
  // days = [{day, billable, userId, shifts}] -> one invoice line per (role, rate) in effect (a week can cross an effective date)
  function invoiceLines(days, site, hstRate) {
    const by = {}; const order = []; const multi = siteRoles(site).length > 1;
    days.slice().sort((a, b) => a.day.localeCompare(b.day)).forEach((d) => { const role = multi ? roleOf(site, d) : ''; const r = rateOn(site, d.day, role) ?? 0; const k = role + '|' + r.toFixed(2); if (!by[k]) { by[k] = { role, rate: r, hours: 0, from: d.day, to: d.day }; order.push(k); } by[k].hours += d.billable; if (d.day < by[k].from) by[k].from = d.day; if (d.day > by[k].to) by[k].to = d.day; });
    if (multi) order.sort((a, b) => (siteRoles(site).indexOf(by[a].role) - siteRoles(site).indexOf(by[b].role)) || by[a].from.localeCompare(by[b].from));
    const lines = order.map((k) => { const x = by[k]; const qty = Math.round((x.hours + Number.EPSILON) * 100) / 100; return { qty, rate: x.rate, from: x.from, to: x.to, ...(multi ? { role: x.role } : {}), amount: cents(qty * x.rate) / 100 }; }).filter((l) => l.qty > 0);
    const sub = lines.reduce((a, l) => a + cents(l.amount), 0); const tax = Math.round(sub * hstRate);
    const qty = Math.round(lines.reduce((a, l) => a + l.qty, 0) * 100) / 100;
    return { lines, qty, rate: lines.length === 1 ? lines[0].rate : null, subtotal: sub / 100, hst: tax / 100, total: (sub + tax) / 100 };
  }
  const money = (n) => '$' + Number(n).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // ---- 9. Payment terms + aging (Grok Bot, Oct 3): both companies — "Payment due within one month of receipt" (not Net 15).
  // Due date = date the client received the invoice (defaults to the date it was marked issued) + 1 calendar month
  // (clamped to month end: Jan 31 -> Feb 28/29). Aging buckets count days PAST DUE.
  const TERMS = 'Payment due within one month of receipt';
  function addMonths(dayKey, n) {
    const [y, m, d] = dayKey.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1));
    const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
    return t.getUTCFullYear() + '-' + String(t.getUTCMonth() + 1).padStart(2, '0') + '-' + String(Math.min(d, last)).padStart(2, '0');
  }
  const dueDate = (inv) => (inv.status === 'draft' && !inv.issuedAt ? null : addMonths(inv.receivedAt || inv.issuedAt || inv.date, 1));
  const ageFlag = (daysPastDue) => (daysPastDue > 60 ? 61 : daysPastDue > 30 ? 31 : daysPastDue > 0 ? 1 : 0);
  const AGE_LABEL = { 0: 'Current (not yet due)', 1: '1–30 days past due', 31: '31–60 days past due', 61: '61+ days past due' };

  // ---- 7. Timesheet workflow ----
  const STATUSES = ['draft', 'reviewed', 'approved', 'locked'];
  const STATUS_LABEL = { draft: 'Draft', reviewed: 'Reviewed', approved: 'Approved (owner)', locked: 'Billing locked' };
  function canAdvance(cur, next, issues) {
    const i = STATUSES.indexOf(cur), j = STATUSES.indexOf(next);
    if (j !== i + 1) return { ok: false, why: 'Steps go Draft → Reviewed → Approved → Billing locked.' };
    if (next === 'locked' && issues.length) return { ok: false, why: issues.length + ' issue(s) block locking.' };
    return { ok: true };
  }

  // ---- Two companies (owner, Oct 3 9:36 AM) ----
  const COMPANIES = {
    cj: { id: 'cj', name: 'Chief Janitorial', short: 'CJ', invPrefix: 'CJ', reviewer: 'CJ Bal', billing: 'CJ Sandra', web: 'chiefjanitorial.com', hst: '000000000 RT0000 (SAMPLE placeholder — not a real HST number)', logo: 'assets/logo.png', terms: TERMS },
    us: { id: 'us', name: 'Unscramble', short: 'US', invPrefix: 'US', reviewer: 'Us Sandra', billing: 'Us Sandra', web: 'unscramble.ca', hst: '999999999 RT0000 (SAMPLE placeholder — not a real HST number)', logo: 'assets/unscramble-logo.svg', color: '#332E57', gold: '#C9A227', terms: TERMS },
  };
  const statusLabel = (st, company) => (st === 'reviewed' ? 'Reviewed (' + (COMPANIES[company] || COMPANIES.cj).reviewer + ')' : STATUS_LABEL[st]);
  const fmtDist = (m) => (m == null ? '' : m >= 1000 ? (m / 1000).toFixed(1) + ' km' : Math.round(m) + ' m');
  CJ.F = { COMPANIES, statusLabel, fmtDist, distanceM, locCheck, offsetEast, missedClockOut, noShow, schedStatus, otStatus, consecutiveDays, invoiceAmounts, rateOn, siteRoles, roleOf, invoiceLines, invoiceBlock, BILLING_TYPES, money, ageFlag, AGE_LABEL, TERMS, addMonths, dueDate, STATUSES, STATUS_LABEL, canAdvance };
})();
