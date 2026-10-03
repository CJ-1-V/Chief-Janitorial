/* Sample data for the Oct-2026 feature batch. All rates are SAMPLE values; all names fictional. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const TOWN = { Kensington: [46.433, -63.637], Cavendish: [46.49, -63.38], Summerside: [46.393, -63.79], "O'Leary": [46.706, -64.236], Alberton: [46.813, -64.065], Wellington: [46.452, -64.0], Charlottetown: [46.238, -63.131], 'Wheatley River': [46.33, -63.23], 'Hunter River': [46.354, -63.35], Cornwall: [46.226, -63.218], Souris: [46.355, -62.253], Tignish: [46.95, -64.03], 'Murray River': [46.01, -62.62], Montague: [46.166, -62.648], Valleyfield: [46.13, -62.72], Crapaud: [46.24, -63.5], Darnley: [46.53, -63.69], Cardigan: [46.23, -62.62], Coleman: [46.62, -64.13], Freetown: [46.36, -63.58], Dundas: [46.27, -62.6], 'St. Peters': [46.43, -62.58], Woodstock: [46.6, -64.1], 'Kildare Capes': [46.85, -64.0], 'Augustine Cove': [46.22, -63.54], 'Foxley River': [46.73, -64.03], 'Stanley Bridge': [46.46, -63.45], 'Tyne Valley': [46.6, -63.93] };
  const RATE = { Farm: 31.5, Office: 29, Healthcare: 34, Warehouse: 30.5 };

  CJ.seedExtras = function (db, ctx) {
    const { today, lastWk, at, applyEdit, rng } = ctx; const T = CJ.tz; const r = rng;
    const nowMs = Date.now(); const iso = (d) => new Date(d).toISOString();
    Object.assign(db.settings, { missedOpenHours: 14, schedGraceAfterEndH: 2, noShowMin: 15, otThresholdH: 44, otNearH: 40, maxConsecDays: 6, hstRate: 0.15, defaultRadiusM: 300 });
    db.schedules = []; db.incidents = []; db.notifications = []; db.signoffs = []; db.tsStatus = {}; db.invoices = [];

    // ---- Sites: geofence + SAMPLE rate + invoice prefix ----
    const used = new Set();
    db.sites.forEach((s, i) => {
      const t = TOWN[s.location.replace(', PEI', '')] || [46.25, -63.13];
      s.lat = +(t[0] + ((i % 5) - 2) * 0.004).toFixed(5); s.lng = +(t[1] + ((i % 3) - 1) * 0.005).toFixed(5);
      s.radiusM = s.type === 'Office' || s.type === 'Healthcare' ? 150 : 300;
      s.rate = +(RATE[s.type] + ((s.number % 4) - 1.5) * 0.5).toFixed(2); s.rateSample = true;
      let p = s.clientName.replace(/&|Ltd\.|Co\./g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 3);
      let q = p, k = 2; while (used.has(q)) q = p + k++; used.add(q); s.invoicePrefix = q;
    });
    const site = (id) => db.sites.find((s) => s.id === id);
    const mk = (userId, siteNum, inD, outD, notes) => { const s = { id: 'sh-x' + db.shifts.length + '-' + userId.slice(2, 5), userId, siteId: 's' + siteNum, clockIn: iso(inD), clockOut: outD ? iso(outD) : null, notes: notes || '', recordedIn: iso(inD), recordedOut: outD ? iso(outD) : null, crewCount: null, recordedCrew: null, edits: [] }; db.shifts.push(s); return s; };
    const dk = (s) => T.dayKey(s.clockIn);

    // ---- Crew leads (employee flag) ----
    db.users.forEach((u) => { if (u.id === 'u-harpreet' || u.id === 'u-gurpreet') u.crewLead = true; });

    // ---- 4. Overtime + fatigue demo: Rajveer, 7 consecutive days, ~49 h this week ----
    for (let d = -6; d <= -1; d++) mk('u-rajveer', d % 2 ? 23 : 30, at(today, d, 6, 30), at(today, d, 16, 15 + (d + 6) * 3), '');
    mk('u-rajveer', 23, new Date(Math.max(nowMs - 3.2 * 3600000, at(today, 0, 0, 10).getTime())), null, '');
    // Maria nearing the threshold: make her week ~41–43 h by lengthening this week's shifts
    db.shifts.filter((s) => s.userId === 'u-maria' && s.clockOut && dk(s) >= T.weekStart(today)).forEach((s) => { s.clockOut = s.recordedOut = iso(new Date(new Date(s.clockIn).getTime() + 10.4 * 3600000)); });

    // ---- 1/2. Today: clear random open shifts for the demo people, then script them ----
    db.shifts = db.shifts.filter((s) => !((s.userId === 'u-priya' || s.userId === 'u-emily' || s.userId === 'u-arjun') && dk(s) === today));
    const round5 = (ms) => Math.floor(ms / 300000) * 300000;
    const priyaStart = new Date(round5(Math.max(nowMs - 5 * 3600000, at(today, 0, 0, 5).getTime())));
    const priya = mk('u-priya', 38, priyaStart, null, 'Early wash-down');
    const sched = (userId, siteNum, day, sh, sm, eh, em) => { const startIso = iso(at(day, 0, sh, sm)); let endD = at(day, 0, eh, em); if (endD <= new Date(startIso)) endD = at(day, 1, eh, em); const x = { id: 'sc' + (db.schedules.length + 1), userId, siteId: 's' + siteNum, day, start: String(sh).padStart(2, '0') + ':' + String(sm).padStart(2, '0'), end: String(eh).padStart(2, '0') + ':' + String(em).padStart(2, '0'), startIso, endIso: iso(endD), createdBy: 'u-owner', createdAt: iso(at(T.weekStart(today), -3, 10, 0)) }; db.schedules.push(x); return x; };
    const hm = (ms) => { const p = T.parts(ms); return [p.h, p.mi]; };
    // Priya: scheduled to finish 2.5 h ago, still clocked in -> "past scheduled end + 2 h"
    { const [h1, m1] = hm(priyaStart.getTime()); const [h2, m2] = hm(round5(nowMs - 2.5 * 3600000)); sched('u-priya', 38, today, h1, m1, h2, m2); }
    // Emily: scheduled 2 h ago at Site 27, never clocked in -> no-show
    { const st = round5(Math.max(nowMs - 2 * 3600000, at(today, 0, 0, 30).getTime())); const [h1, m1] = hm(st); sched('u-emily', 27, today, h1, m1, (h1 + 8) % 24, m1); }
    // Arjun: scheduled later today (upcoming)
    sched('u-arjun', 33, today, 15, 0, 22, 0);
    // Navdeep: yesterday 7:30–15:30 at Site 36, never clocked out
    { const nv = db.shifts.find((x) => x.userId === 'u-navdeep' && !x.clockOut); if (nv) { const [h, m] = hm(new Date(nv.clockIn).getTime()); sched('u-navdeep', site(nv.siteId).number, dk(nv), h, m - (m % 15), (h + 8) % 24, m - (m % 15)); } }
    // Everyone's completed / open shifts this week get a matching schedule (realism)
    db.shifts.filter((s) => dk(s) >= T.weekStart(today) && !db.schedules.some((x) => x.userId === s.userId && x.day === dk(s))).forEach((s) => {
      const [h1, m1] = hm(Math.floor(new Date(s.clockIn).getTime() / 1800000) * 1800000); const endMs = s.clockOut ? Math.round(new Date(s.clockOut).getTime() / 1800000) * 1800000 : new Date(s.clockIn).getTime() + 8 * 3600000;
      const [h2, m2] = hm(endMs); sched(s.userId, site(s.siteId).number, dk(s), h1, m1, h2, m2);
    });
    // Upcoming week
    const up = { 'u-harpreet': [12, 16, 22], 'u-gurpreet': [15, 14], 'u-simran': [18, 20], 'u-liam': [21, 12], 'u-maria': [34, 17], 'u-manpreet': [13, 25], 'u-emily': [26, 27] };
    for (let d = 1; d <= 7; d++) { const day = T.addDays(today, d); if (T.weekday(day) === 0) continue; Object.entries(up).forEach(([u, sites], i) => { if ((d + i) % 5 === 4) return; sched(u, sites[(d + i) % sites.length], day, 7 + (i % 2), i % 2 ? 30 : 0, 15 + (i % 2), 30); }); }

    // ---- Crew-lead demo: Harpreet led a 3-person crew at Site 16 two days ago (not yet signed off) ----
    { const d2 = T.addDays(today, -2); const hs = db.shifts.find((x) => x.userId === 'u-harpreet' && dk(x) === d2 && x.siteId === 's16');
      if (hs) { ['u-simran', 'u-manpreet'].forEach((u, i) => { db.shifts = db.shifts.filter((x) => !(x.userId === u && dk(x) === d2)); db.schedules = db.schedules.filter((x) => !(x.userId === u && x.day === d2)); sched(u, 16, d2, 8, 0, 14, 30); const ci = at(d2, 0, 8, 5 + i * 7), co = at(d2, 0, 14, 20 + i * 5); const n = mk(u, 16, ci, co, 'Calf barn + hallway'); n.crewCount = n.recordedCrew = 3; });
        hs.crewCount = hs.recordedCrew = 3; } }

    // ---- 3. Location at clock-in (simulated): everyone on site, except a few flags ----
    db.shifts.forEach((s) => { const st = site(s.siteId); const d = 10 + Math.floor(r() * 120); s.location = { lat: st.lat, lng: CJ.F.offsetEast(st, d).lng, distanceM: d, status: 'ok', simulated: true }; });
    const simFri = db.shifts.find((s) => s.userId === 'u-simran' && s.siteId === 's12' && dk(s) === T.addDays(lastWk, 4));
    if (simFri) simFri.location = { ...CJ.F.offsetEast(site('s12'), 1200), lat: site('s12').lat, distanceM: 1200, status: 'off', simulated: true }; // blocks Site 12 lock
    const arj = db.shifts.filter((s) => s.userId === 'u-arjun' && s.clockOut && dk(s) >= T.weekStart(today)).slice(-1)[0];
    if (arj) arj.location = { lat: null, lng: null, distanceM: null, status: 'none', simulated: true }; // location off
    const old = db.shifts.find((s) => s.userId === 'u-liam' && dk(s) < T.addDays(lastWk, -7));
    if (old) old.location = { lat: site(old.siteId).lat, lng: CJ.F.offsetEast(site(old.siteId), 850).lng, distanceM: 850, status: 'off', simulated: true, reviewed: { by: 'u-owner', at: iso(at(dk(old), 2, 9, 0)), note: 'Parked at the far barn — fine.' } };

    // ---- crew counts for the shifts added here ----
    const crew = {}; db.shifts.forEach((x) => { const k = x.siteId + '|' + dk(x); (crew[k] = crew[k] || new Set()).add(x.userId); });
    db.shifts.forEach((x) => { if (x.clockOut && x.crewCount == null) x.crewCount = x.recordedCrew = crew[x.siteId + '|' + dk(x)].size; });

    // ---- Clock-out notes (optional, one-time, read-only; generic text — no farm names) ----
    const OUT_NOTES = ['Out of paper towels — need a restock.', 'Finished early, all areas done.', 'Gate was left open when I left, sorry.', 'Hot water not working in the wash room.', 'Mop head worn out, please replace.', 'Extra mess after the weekend — took longer.', 'Locked up and set the alarm.', 'Floor drain in barn 2 is slow.', 'Ran out of degreaser halfway.', 'Supervisor asked us to also do the office.'];
    db.shifts.filter((x) => x.clockOut).forEach((x) => { if (r() < 0.18) { x.outNote = OUT_NOTES[Math.floor(r() * OUT_NOTES.length)]; x.outNoteAt = x.recordedOut || x.clockOut; } });
    const setNote = (sh, txt) => { if (sh) { sh.outNote = txt; sh.outNoteAt = sh.recordedOut || sh.clockOut; } };
    setNote(db.shifts.find((x) => x.id === 'sh-demo-self'), 'Phone was in the car at start. Wash bay drain is slow again.');
    setNote(db.shifts.find((x) => x.id === 'sh-demo-office'), 'Simran drove me. Forgot to clock out at 4:30, sorry!');
    setNote(db.shifts.find((x) => x.userId === 'u-harpreet' && x.siteId === 's12' && dk(x) === T.addDays(lastWk, 4)), '4 of us today — 2 new helpers did not have the app yet.');
    setNote(db.shifts.find((x) => x.userId === 'u-liam' && x.siteId === 's12' && dk(x) === T.addDays(lastWk, 5)), 'Overnight wash-down done, hoses put away.');

    // ---- 5. Incidents ----
    const inc = (sh, type, text, wcb, photo) => sh && db.incidents.push({ id: 'in' + (db.incidents.length + 1), shiftId: sh.id, userId: sh.userId, siteId: sh.siteId, type, text, photo: photo ? CJ.samplePhoto(type) : null, at: sh.clockOut || sh.clockIn, wcbStatus: wcb, history: [{ status: wcb, by: 'u-owner', at: iso(new Date(new Date(sh.clockOut || sh.clockIn).getTime() + 18 * 3600000)) }] });
    const recent = (u) => db.shifts.filter((s) => s.userId === u && s.clockOut).sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn));
    inc(recent('u-harpreet')[1], 'Near miss', 'Wet floor by the milk-house door, nearly slipped. Put the yellow sign out.', 'No WCB needed — closed', false);
    inc(recent('u-liam')[2], 'Chemical', 'Splash of degreaser on forearm while refilling sprayer. Rinsed 15 min at eyewash station, mild redness.', 'WCB follow-up needed', true);
    inc(recent('u-maria')[6], 'Injury', 'Small cut on left hand from a broken bucket handle. First aid kit used.', 'Reported to WCB', true);

    // ---- 6. Daily sign-offs ----
    const leads = db.users.filter((u) => u.crewLead).map((u) => u.id);
    const siteDays = {}; db.shifts.filter((s) => s.clockOut).forEach((s) => { const k = s.siteId + '|' + dk(s); (siteDays[k] = siteDays[k] || []).push(s); });
    const unsigned = new Set(['s12|' + T.addDays(lastWk, 4), 's12|' + T.addDays(lastWk, 6), 's16|' + T.addDays(today, -2)]);
    Object.entries(siteDays).forEach(([k, list]) => {
      const [sid, day] = k.split('|'); if (unsigned.has(k) || day >= T.addDays(today, -1)) return;
      const lead = list.find((s) => leads.includes(s.userId));
      db.signoffs.push({ siteId: sid, day, byUserId: lead ? lead.userId : 'u-owner', byRole: lead ? 'crewlead' : 'admin', at: iso(at(day, 0, 17, 30)), hours: list.reduce((a, s) => a + (new Date(s.clockOut) - new Date(s.clockIn)) / 3600000, 0) });
    });

    // ---- 7. Timesheet statuses: older weeks locked; last week mixed ----
    const hist = (ws, upto) => { const out = [{ status: 'draft', byName: 'System', at: iso(at(T.addDays(ws, 7), 0, 6, 0)), note: 'Generated' }]; if (upto >= 1) out.push({ status: 'reviewed', byName: 'CJ Bal', at: iso(at(T.addDays(ws, 7), 0, 10, 15)) }); if (upto >= 2) out.push({ status: 'approved', byName: 'Owner', at: iso(at(T.addDays(ws, 8), 0, 9, 0)) }); if (upto >= 3) out.push({ status: 'locked', byName: 'Owner', at: iso(at(T.addDays(ws, 8), 0, 9, 5)) }); return out; };
    const weeksWith = {}; db.shifts.forEach((s) => { const ws = T.weekStart(dk(s)); (weeksWith[ws] = weeksWith[ws] || new Set()).add(s.siteId); });
    Object.entries(weeksWith).forEach(([ws, sites]) => sites.forEach((sid) => {
      const k = sid + '|' + ws; let lvl = -1;
      if (ws < lastWk) lvl = 3;
      else if (ws === lastWk) lvl = { s12: 2, s34: 3, s33: 1, s15: 2, s13: 1 }[sid] ?? 0;
      if (lvl >= 0) { const h = hist(ws, lvl); db.tsStatus[k] = { status: CJ.F.STATUSES[lvl], history: h }; }
    }));

    { const lk = db.shifts.filter((x) => x.siteId === 's34' && CJ.rules.inWeek(dk(x), lastWk) && x.clockOut).sort((p, q) => p.clockIn.localeCompare(q.clockIn))[0]; if (lk) lk.id = 'sh-demo-locked'; } // stable id for the lock/override demo
    // ---- 8/9. Invoices for every billing-locked farm-week ----
    const seq = {};
    Object.keys(db.tsStatus).filter((k) => db.tsStatus[k].status === 'locked').sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1])).forEach((k) => {
      const [sid, ws] = k.split('|'); const st = site(sid);
      const days = CJ.rules.groupDays(db.shifts.filter((s) => s.siteId === sid && CJ.rules.inWeek(dk(s), ws)));
      const bill = days.reduce((a, d) => a + d.billable, 0); if (!bill) return;
      const amt = CJ.F.invoiceAmounts(bill, st.rate, db.settings.hstRate);
      seq[sid] = (seq[sid] || 0) + 1;
      const date = T.addDays(ws, 8); const inv = { id: 'inv-' + sid + '-' + ws, number: st.invoicePrefix + '-' + String(seq[sid]).padStart(4, '0'), siteId: sid, weekStart: ws, date, ...amt, status: 'draft', createdBy: 'u-owner', createdAt: iso(at(date, 0, 9, 10)), payments: [] };
      if (ws < lastWk) {
        inv.status = 'issued'; inv.issuedAt = T.addDays(date, 1); // marked as sent by the owner (outside this app)
        const age = Math.round((T.zoned(today, 12, 0) - T.zoned(inv.issuedAt, 12, 0)) / 86400000); const x = r();
        const pay = (frac, lag) => { const p = Math.round(inv.total * frac * 100) / 100; inv.payments.push({ amount: p, date: T.addDays(inv.issuedAt, lag), note: 'e-transfer', by: 'u-owner' }); };
        if (age > 45) { if (x < 0.95 || seq[sid] < 3) pay(1, 14 + Math.floor(r() * 20)); }
        else if (age >= 30) { if (x < 0.75) pay(1, 14 + Math.floor(r() * 12)); else if (x < 0.85) pay(0.5, 21); }
        else if (age >= 15) { if (x < 0.55) pay(1, Math.min(age - 1, 12)); else if (x < 0.7) pay(0.4, 10); }
        else if (x < 0.15) pay(1, Math.max(1, age - 1));
      }
      db.invoices.push(inv);
    });
  };

  // Placeholder "photo" for seeded incidents (an SVG data URL — no real image data).
  CJ.samplePhoto = function (label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#cbd5e1"/><rect x="18" y="22" width="284" height="156" rx="10" fill="#94a3b8"/><circle cx="90" cy="80" r="22" fill="#e2e8f0"/><path d="M30 170 L120 95 L190 150 L230 115 L300 170 Z" fill="#64748b"/><text x="160" y="196" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#334155">sample photo · ${label}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };
})();
