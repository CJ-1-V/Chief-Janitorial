/* Break / pay / billing rules (owner decision, Oct 2026).
 * Applied per employee, per day, per farm, on TOTAL worked hours that day at that farm
 * (split punches combined, deducted once). Overnight shifts count on the day they started.
 * Days and weeks (Mon–Sun) are in Atlantic time (America/Halifax).
 *   PAID     : worked <= 5 h -> 0 ; 5 h < worked < 8 h -> −0.5 h ; worked >= 8 h -> −1.0 h
 *   BILLABLE : worked <= 5 h -> 0 ; worked > 5 h -> −0.5 h ; then a 5 h MINIMUM per employee/day/farm:
 *              billable = max(5, worked > 5 ? worked − 0.5 : worked). Worked 0 / no clock-out -> bill nothing (issue).
 *   Paid hours never get a minimum.
 * Comparisons are done in whole seconds to avoid floating-point surprises at the boundaries. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const H5 = 5 * 3600, H8 = 8 * 3600;
  const secs = (h) => Math.round(h * 3600);
  function payDeduction(workedH) { const s = secs(workedH); return s <= H5 ? 0 : s < H8 ? 0.5 : 1.0; }
  function billDeduction(workedH) { return secs(workedH) <= H5 ? 0 : 0.5; }
  const MIN_BILL = 5;
  function billable(workedH) { if (!(secs(workedH) > 0)) return 0; return Math.max(MIN_BILL, workedH - billDeduction(workedH)); }
  function apply(workedH) {
    const pd = payDeduction(workedH), bd = billDeduction(workedH), b = billable(workedH);
    // billAdj = billable − worked: −0.5 for the break, or a positive top-up when the 5 h minimum applies.
    return { worked: workedH, payDed: pd, paid: Math.max(0, workedH - pd), billDed: bd, billable: b, billAdj: b - workedH, minApplied: secs(workedH) > 0 && workedH - bd < MIN_BILL };
  }
  const workedH = (s) => (new Date(s.clockOut) - new Date(s.clockIn)) / 3600000;
  // Group completed shifts into employee/day/farm "days". Day = Atlantic date of clock-in.
  function groupDays(shifts) {
    const map = new Map();
    shifts.filter((s) => s.clockOut).forEach((s) => {
      const day = CJ.tz.dayKey(s.clockIn); const k = s.userId + '|' + s.siteId + '|' + day;
      if (!map.has(k)) map.set(k, { userId: s.userId, siteId: s.siteId, day, shifts: [], worked: 0 });
      const g = map.get(k); g.shifts.push(s); g.worked += workedH(s);
    });
    return [...map.values()].map((g) => { g.shifts.sort((a, b) => new Date(a.clockIn) - new Date(b.clockIn)); return Object.assign(g, apply(g.worked)); });
  }
  const inWeek = (day, ws) => day >= ws && day <= CJ.tz.addDays(ws, 6);
  function totals(days) { const t = { worked: 0, payDed: 0, paid: 0, billDed: 0, billAdj: 0, billable: 0 }; days.forEach((d) => Object.keys(t).forEach((k) => (t[k] += d[k]))); return t; }
  const LEGEND = {
    unit: 'Rules apply per employee, per day, per farm, on total hours worked that day at that farm (split punches combined, deducted once). Overnight shifts count on the day they started. Weeks run Mon–Sun, Atlantic time.',
    paid: 'Paid (employee pay): 5 h or less → no deduction · over 5 h and under 8 h → −0.5 h · 8 h or more → −1.0 h. No minimum.',
    bill: 'Billable (farm): 5 h or less → no deduction · over 5 h → −0.5 h · then a 5 h minimum: billable = max(5, worked − deduction).',
    combined: 'Confirmed by the owner: same worker + same farm + same day = one day — the 5 h billing minimum is applied once to the combined day (a 3 h + 3 h day = 6 h worked → bills 5.5 h, not 5 + 5). Shifts with no clock-out bill nothing and are listed as issues.',
  };
  CJ.rules = { payDeduction, billDeduction, billable, MIN_BILL, apply, groupDays, inWeek, totals, LEGEND };
})();
