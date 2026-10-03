/* Sample data for the Oct-2026 feature batch. All rates are SAMPLE values; all names fictional. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const TOWN = { Kensington: [46.433, -63.637], Cavendish: [46.49, -63.38], Summerside: [46.393, -63.79], "O'Leary": [46.706, -64.236], Alberton: [46.813, -64.065], Wellington: [46.452, -64.0], Charlottetown: [46.238, -63.131], 'Wheatley River': [46.33, -63.23], 'Hunter River': [46.354, -63.35], Cornwall: [46.226, -63.218], Souris: [46.355, -62.253], Tignish: [46.95, -64.03], 'Murray River': [46.01, -62.62], Montague: [46.166, -62.648], Valleyfield: [46.13, -62.72], Crapaud: [46.24, -63.5], Darnley: [46.53, -63.69], Cardigan: [46.23, -62.62], Coleman: [46.62, -64.13], Freetown: [46.36, -63.58], Dundas: [46.27, -62.6], 'St. Peters': [46.43, -62.58], Woodstock: [46.6, -64.1], 'Kildare Capes': [46.85, -64.0], 'Augustine Cove': [46.22, -63.54], 'Foxley River': [46.73, -64.03], 'Stanley Bridge': [46.46, -63.45], 'Tyne Valley': [46.6, -63.93] };
  const RATE = { Farm: 31.5, Office: 29, Healthcare: 34, Warehouse: 30.5, Staffing: 27.5 };
  // Unscramble (HR / harvest staffing) — FICTIONAL farms for the prototype. Site numbers 51+ so they never clash with CJ's.
  const US_SITES = [[51, 'Hillside Haskap Farm', 'Kensington'], [52, 'North Shore Potato Growers', 'Stanley Bridge'], [53, 'Red Sand Berry Co.', 'Montague'], [54, 'Bayfield Orchards', 'Cornwall']];
  const US_WORKERS = [['u-us-mateo', 'Mateo Reyes', '9025550201', [51, 52]], ['u-us-ana', 'Ana Lima', '9025550202', [52, 51]], ['u-us-joseph', 'Joseph Mensah', '9025550203', [53, 54]], ['u-us-chloe', 'Chloe Gaudet', '9025550204', [54, 53]]];
  const RATE_CHANGE_FROM = '2026-10-01', RATE_CHANGE = 0.3; // owner, Oct 3: every farm +$0.30/h from Oct 1, 2026

  CJ.seedExtras = function (db, ctx) {
    const { today, lastWk, at, applyEdit, rng } = ctx; const T = CJ.tz; const r = rng;
    const nowMs = Date.now(); const iso = (d) => new Date(d).toISOString();
    Object.assign(db.settings, { missedOpenHours: 14, schedGraceAfterEndH: 2, noShowMin: 15, otThresholdH: 44, otNearH: 40, maxConsecDays: 6, hstRate: 0.15, defaultRadiusM: 300 });
    db.schedules = []; db.incidents = []; db.notifications = []; db.signoffs = []; db.tsStatus = {}; db.invoices = [];

    // ---- Companies: tag CJ sites, add Unscramble sites ----
    db.sites.forEach((s) => (s.company = 'cj'));
    US_SITES.forEach(([n, name, town]) => db.sites.push({ id: 's' + n, number: n, company: 'us', clientName: name, type: 'Staffing', location: town + ', PEI', legacyCode: '', active: true }));
    // ---- Sites: geofence + SAMPLE rate history + invoice prefix (company-prefixed: CJ-… / US-…) ----
    const used = new Set(); const RS = null; db.rateLog = []; // real rates live only in the local-only js/seed-real-rates.js (see applyRealSeed)
    db.sites.forEach((s, i) => {
      const t = TOWN[s.location.replace(', PEI', '')] || [46.25, -63.13];
      s.lat = +(t[0] + ((i % 5) - 2) * 0.004).toFixed(5); s.lng = +(t[1] + ((i % 3) - 1) * 0.005).toFixed(5);
      s.radiusM = s.type === 'Office' || s.type === 'Healthcare' ? 150 : 300;
      s.radiusM = s.type === 'Staffing' ? 400 : s.radiusM;
      const seeded = RS && RS[s.number]; // from farm-rates.csv (tools/import-rates.js), when present
      const base = seeded ? seeded.old : +(RATE[s.type] + ((s.number % 4) - 1.5) * 0.5).toFixed(2);
      const next = seeded ? seeded.new : +(base + RATE_CHANGE).toFixed(2);
      const yr = RATE_CHANGE_FROM.slice(0, 4); const sample = !seeded;
      s.rates = [{ rate: base, from: yr + '-01-01', sample, by: 'Owner', at: iso(at(yr + '-01-01', 0, 9, 0)), note: sample ? 'SAMPLE starting rate' : 'Saved rate (farm-rates.csv)' },
        { rate: next, from: (seeded && seeded.from) || RATE_CHANGE_FROM, sample, by: 'Owner', at: iso(at('2026-09-25', 0, 10, 0)), note: '+$0.30/h from Oct 1, 2026 (owner decision)' }];
      db.rateLog.push({ id: 'rl' + s.number, siteId: s.id, company: s.company, action: 'add', rate: next, from: s.rates[1].from, prev: base, by: 'Owner', byId: 'u-owner', at: s.rates[1].at, note: s.rates[1].note });
      s.rate = CJ.F.rateOn(s, today); s.rateSample = sample;
      let p = s.clientName.replace(/&|Ltd\.|Co\./g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').slice(0, 3);
      let q = p, k = 2; while (used.has(s.company + q)) q = p + k++; used.add(s.company + q); s.invoicePrefix = CJ.F.COMPANIES[s.company].invPrefix + '-' + q;
    });
    const site = (id) => db.sites.find((s) => s.id === id);
    // ---- Billing type, rate status (ok | missing | flagged) and legacy-code match confidence ----
    db.sites.forEach((s) => { s.billingType = 'hourly'; s.rateStatus = 'ok'; if (s.legacyCode) s.match = 'confirmed'; });
    const REAL = !!(CJ.REAL_SEED && typeof localStorage !== 'undefined' && localStorage.getItem('cj-data-mode') === 'real');
    db.dataMode = REAL ? 'real' : 'sample';
    const noRate = (st, type) => { st.billingType = type; st.rates = []; st.rateStatus = 'missing'; st.rate = undefined; st.rateSample = false; };
    if (REAL) applyRealSeed(db, today, at);
    else { // SAMPLE equivalents of the real-data situations (public demo; all values made up)
      ['s17', 's33', 's35'].forEach((id) => noRate(site(id), 'monthly'));       // CJ commercial sites bill a monthly flat fee -> no hourly rate
      noRate(site('s21'), 'per-visit');                                           // CJ per-visit site
      noRate(site('s53'), 'hourly');                                              // Unscramble farm with no rate on file
      { const f = site('s54'); f.rates[0].rate = 16; f.rates[1].rate = 16.3; f.rate = CJ.F.rateOn(f, today); { const l = db.rateLog.find((x) => x.siteId === 's54'); if (l) { l.rate = 16.3; l.prev = 16; } } f.rateStatus = 'flagged'; f.flagNote = 'SAMPLE flag: $16/h is far below every other farm — may be a worker pay rate entered as the bill rate. Confirm before invoicing.'; }
      [['s15', 'probable', 'SAMPLE: initials + onboarding order'], ['s18', 'probable', 'SAMPLE: initials + partial activity match'], ['s16', 'possible', 'SAMPLE: initials only'], ['s23', 'possible', 'SAMPLE: initials only — two candidate farms']].forEach(([id, m, n]) => { site(id).match = m; site(id).matchNote = n; });
    }
    db.rateLog = db.rateLog.filter((l) => { const st = site(l.siteId); return st && st.rates.length > 1; });
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
    const hist = (ws, upto, co) => { const out = [{ status: 'draft', byName: 'System', at: iso(at(T.addDays(ws, 7), 0, 6, 0)), note: 'Generated' }]; if (upto >= 1) out.push({ status: 'reviewed', byName: CJ.F.COMPANIES[co || 'cj'].reviewer, at: iso(at(T.addDays(ws, 7), 0, 10, 15)) }); if (upto >= 2) out.push({ status: 'approved', byName: 'Owner', at: iso(at(T.addDays(ws, 8), 0, 9, 0)) }); if (upto >= 3) out.push({ status: 'locked', byName: 'Owner', at: iso(at(T.addDays(ws, 8), 0, 9, 5)) }); return out; };
    const weeksWith = {}; db.shifts.forEach((s) => { const ws = T.weekStart(dk(s)); (weeksWith[ws] = weeksWith[ws] || new Set()).add(s.siteId); });
    Object.entries(weeksWith).forEach(([ws, sites]) => sites.forEach((sid) => {
      const k = sid + '|' + ws; let lvl = -1;
      if (ws < lastWk) lvl = 3;
      else if (ws === lastWk) lvl = { s12: 2, s34: 3, s33: 1, s15: 2, s13: 1 }[sid] ?? 0;
      if (lvl >= 0) { const h = hist(ws, lvl, (site(sid) || {}).company); db.tsStatus[k] = { status: CJ.F.STATUSES[lvl], history: h }; }
    }));

    { const lk = db.shifts.filter((x) => x.siteId === 's34' && CJ.rules.inWeek(dk(x), lastWk) && x.clockOut).sort((p, q) => p.clockIn.localeCompare(q.clockIn))[0]; if (lk) lk.id = 'sh-demo-locked'; } // stable id for the lock/override demo
    // ---- 8/9. Invoices for every billing-locked farm-week ----
    const seq = {};
    Object.keys(db.tsStatus).filter((k) => db.tsStatus[k].status === 'locked').sort((a, b) => a.split('|')[1].localeCompare(b.split('|')[1])).forEach((k) => {
      const [sid, ws] = k.split('|'); const st = site(sid);
      if (CJ.F.invoiceBlock(st)) return; // MISSING rate / monthly / per-visit: no invoice (never invent a value)
      const days = CJ.rules.groupDays(db.shifts.filter((s) => s.siteId === sid && CJ.rules.inWeek(dk(s), ws)));
      const bill = days.reduce((a, d) => a + d.billable, 0); if (!bill) return;
      const amt = CJ.F.invoiceLines(days, st, db.settings.hstRate);
      seq[sid] = (seq[sid] || 0) + 1;
      const date = T.addDays(ws, 8); const inv = { id: 'inv-' + sid + '-' + ws, company: st.company, number: st.invoicePrefix + '-' + String(seq[sid]).padStart(4, '0'), siteId: sid, weekStart: ws, date, ...amt, status: 'draft', createdBy: 'u-owner', createdAt: iso(at(date, 0, 9, 10)), payments: [] };
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

    seedUnscramble(db, ctx, { site, sched, hist });
    // ---- Tag every record with its company (site's company; workers default to CJ) ----
    const coSite = (sid) => (site(sid) || {}).company || 'cj';
    db.users.forEach((u) => { if (u.role === 'worker' && !u.company) u.company = 'cj'; });
    if (REAL) db.users.filter((u) => u.role === 'worker' && !/^u-us-/.test(u.id)).forEach((u) => { const n = { cj: 0, us: 0 }; db.shifts.filter((x) => x.userId === u.id).forEach((x) => n[coSite(x.siteId)]++); if (n.us > n.cj) u.company = 'us'; }); // real codes CJVT* are Unscramble farms
    db.shifts.forEach((x) => (x.company = coSite(x.siteId)));
    db.schedules.forEach((x) => (x.company = coSite(x.siteId)));
    db.incidents.forEach((x) => (x.company = coSite(x.siteId)));
    db.invoices.forEach((x) => (x.company = coSite(x.siteId)));
    db.signoffs.forEach((x) => (x.company = coSite(x.siteId)));
    Object.entries(db.tsStatus).forEach(([k, v]) => (v.company = coSite(k.split('|')[0])));
    // ---- Staff logins: one per role per company (owner sees both) ----
    const staff = (id, name, phone, companies, staffRole, reviewer) => db.users.push({ id, name, phone, password: 'demo', role: 'admin', staffRole, companies, reviewer: !!reviewer, status: 'active', createdAt: iso(at(today, -200, 9, 0)) });
    staff('u-cj-ops', 'CJ Bal', '2222222201', ['cj'], 'ops', true);
    staff('u-cj-billing', 'CJ Sandra', '2222222202', ['cj'], 'billing', false);
    staff('u-us-ops', 'Us Aasa', '3333333301', ['us'], 'ops', false);
    staff('u-us-billing', 'Us Sandra', '3333333302', ['us'], 'billing', true);
  };

  // ---- LOCAL ONLY: real names / rates from js/seed-real-rates.js (never in the public build; only with ?data=real) ----
  function applyRealSeed(db, today, at) {
    const RS = CJ.REAL_SEED; const iso = (d) => new Date(d).toISOString(); const byNum = {};
    RS.sites.filter((r) => r.code).forEach((r) => (byNum[+r.code.match(/(\d+)$/)[1]] = r));
    const setReal = (s, r) => {
      Object.assign(s, { clientName: r.name, company: r.company, billingType: r.billingType, realNotes: r.notes, terms: r.terms, roles: r.roles, stale: r.stale, rateSample: false });
      if (r.code) { s.match = r.match; s.matchNote = r.matchNote; } else delete s.match;
      if (r.rateStatus === 'missing') { s.rates = []; s.rateStatus = 'missing'; s.rate = undefined; return; }
      s.rates = [{ rate: r.old, from: '2026-01-01', sample: false, by: 'Owner', at: iso(at('2026-01-01', 0, 9, 0)), note: 'Saved rate (farm-rates.csv, last seen ' + (r.lastSeen || '?') + ')' }, { rate: r.new, from: r.from, sample: false, by: 'Owner', at: iso(at('2026-10-03', 0, 9, 0)), note: '+$0.30/h from Oct 1, 2026 (owner decision)' }];
      s.rateStatus = r.rateStatus; s.flagNote = r.flagNote || ''; s.rate = CJ.F.rateOn(s, today);
    };
    db.sites.forEach((s) => { if (s.number >= 51) { s.clientName = 'SAMPLE — ' + s.clientName; return; } const r = byNum[s.number];
      if (r) setReal(s, r); else { s.clientName = 'Unmatched code ' + s.legacyCode; s.match = 'unmatched'; s.matchNote = 'No farm matched to this code'; s.company = /^CJCT/.test(s.legacyCode) ? 'cj' : 'us'; s.rates = []; s.rateStatus = 'missing'; s.rate = undefined; s.rateSample = false; } });
    let n = 60; RS.sites.filter((r) => !r.code).forEach((r) => { const s = { id: 's' + n, number: n, company: r.company, clientName: r.name, type: r.company === 'us' ? 'Staffing' : 'Commercial', location: 'PEI', legacyCode: '', active: true, lat: 46.2382, lng: -63.1311, radiusM: 300 }; n++; setReal(s, r); db.sites.push(s); });
    const used = new Set(); db.sites.forEach((s) => { let p = s.clientName.replace(/^SAMPLE — |^Unmatched code /, '').replace(/&|Ltd\.|Inc\.|Co\.|\(.*?\)/g, '').split(/\s+/).filter(Boolean).map((w) => w[0].toUpperCase()).join('').replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'X'; let q = p, k = 2; while (used.has(s.company + q)) q = p + k++; used.add(s.company + q); s.invoicePrefix = CJ.F.COMPANIES[s.company].invPrefix + '-' + q; });
    db.rateLog = db.sites.filter((s) => s.rates.length > 1).map((s) => ({ id: 'rl' + s.number, siteId: s.id, company: s.company, action: 'add', rate: s.rates[1].rate, from: s.rates[1].from, prev: s.rates[0].rate, by: 'Owner', byId: 'u-owner', at: s.rates[1].at, note: s.rates[1].note }));
    db.realHst = RS.hst || {};
  }

  // ---- Unscramble sample data: 4 workers, last week + this week (Unscramble is new to the tracker) ----
  function seedUnscramble(db, ctx, h) {
    const { today, lastWk, at } = ctx; const T = CJ.tz; const iso = (d) => new Date(d).toISOString(); const { site, sched, hist } = h;
    let seed = 51; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // own PRNG so CJ sample data is unchanged
    US_WORKERS.forEach(([id, name, phone], i) => db.users.push({ id, name, phone, password: 'demo', role: 'worker', company: 'us', crewLead: id === 'u-us-mateo', status: 'active', createdAt: iso(at(today, -40 + i, 10, 0)), decidedBy: 'u-us-ops', decidedAt: iso(at(today, -40 + i, 14, 0)) }));
    db.users.push({ id: 'u-us-daniela', name: 'Daniela Cruz', phone: '9025550205', password: 'demo', role: 'worker', company: 'us', status: 'pending', createdAt: iso(at(today, 0, 7, 12)) });
    const mk = (userId, n, inD, outD) => { const s = { id: 'sh-us' + db.shifts.length, userId, siteId: 's' + n, clockIn: iso(inD), clockOut: outD ? iso(outD) : null, notes: '', recordedIn: iso(inD), recordedOut: outD ? iso(outD) : null, crewCount: null, recordedCrew: null, edits: [] }; db.shifts.push(s); return s; };
    const nowMs = Date.now();
    US_WORKERS.forEach(([id, , , sites], wi) => {
      for (let d = lastWk; d <= today; d = T.addDays(d, 1)) {
        if (T.weekday(d) === 0) continue; // Sundays off
        if (d === today) { if (id === 'u-us-mateo') mk(id, sites[0], new Date(Math.max(nowMs - 2.2 * 3600000, at(today, 0, 0, 5).getTime())), null); continue; }
        if (d >= T.weekStart(today) && T.weekday(d) === 6) continue;
        if (r() < 0.12 && d >= T.weekStart(today)) continue;
        const n = d < T.weekStart(today) ? (wi < 2 ? 51 + (T.weekday(d) % 2 && wi === 1 ? 1 : 0) : sites[0]) : sites[r() < 0.7 ? 0 : 1];
        const inD = at(d, 0, 6 + (wi % 2), Math.floor(r() * 4) * 15); const outD = new Date(inD.getTime() + (7 + Math.floor(r() * 4) * 0.5) * 3600000);
        const s = mk(id, n, inD, outD); s.location = { lat: site(s.siteId).lat, lng: CJ.F.offsetEast(site(s.siteId), 40).lng, distanceM: 20 + Math.floor(r() * 150), status: 'ok', simulated: true };
        sched(id, n, d, T.parts(inD.getTime()).h, 0, (T.parts(inD.getTime()).h + 8) % 24, 0);
      }
    });
    { const open = db.shifts.find((x) => x.userId === 'u-us-mateo' && !x.clockOut); open.location = { lat: site('s51').lat, lng: site('s51').lng, distanceM: 35, status: 'ok', simulated: true }; }
    // Ana's self-edit (M) this week
    const ana = db.shifts.filter((x) => x.userId === 'u-us-ana' && x.clockOut).sort((a, b) => b.clockIn.localeCompare(a.clockIn))[1];
    if (ana) CJ.applyEdit(ana, 'clockIn', iso(new Date(new Date(ana.clockIn).getTime() - 15 * 60000)), 'u-us-ana', 'worker', iso(new Date(new Date(ana.clockOut).getTime() + 3600000)), 'Started 15 min earlier, phone battery died.');
    // upcoming week
    for (let d = 1; d <= 6; d++) { const day = T.addDays(today, d); if (T.weekday(day) === 0) continue; US_WORKERS.forEach(([id, , , sites], i) => sched(id, sites[(d + i) % 2], day, 6 + (i % 2), 0, 14 + (i % 2), 30)); }
    // crew counts, sign-offs (Mateo signs his days; others by Us Aasa)
    const us = db.shifts.filter((x) => /^s5\d$/.test(x.siteId)); const crew = {};
    us.forEach((x) => { const k = x.siteId + '|' + T.dayKey(x.clockIn); (crew[k] = crew[k] || new Set()).add(x.userId); });
    us.forEach((x) => { if (x.clockOut) x.crewCount = x.recordedCrew = crew[x.siteId + '|' + T.dayKey(x.clockIn)].size; });
    const days = {}; us.filter((x) => x.clockOut).forEach((x) => { const k = x.siteId + '|' + T.dayKey(x.clockIn); (days[k] = days[k] || []).push(x); });
    Object.entries(days).forEach(([k, list]) => { const [sid, day] = k.split('|'); if (day >= T.addDays(today, -1)) return; const lead = list.find((x) => x.userId === 'u-us-mateo');
      db.signoffs.push({ siteId: sid, day, byUserId: lead ? 'u-us-mateo' : 'u-us-ops', byRole: lead ? 'crewlead' : 'admin', at: iso(at(day, 0, 17, 15)), hours: list.reduce((a, x) => a + (new Date(x.clockOut) - new Date(x.clockIn)) / 3600000, 0) }); });
    // last week's timesheets: s51 billing locked (+ draft invoice US-HHF-0001), s52 reviewed by Us Sandra, s53 draft, s54 approved
    const lv = { s51: 3, s52: 1, s53: 0, s54: 2 };
    Object.entries(lv).forEach(([sid, l]) => { db.tsStatus[sid + '|' + lastWk] = { company: 'us', status: CJ.F.STATUSES[l], history: hist(lastWk, l, 'us').map((x) => (x.byName === 'Owner' ? x : x)) }; });
    const st = site('s51'); const g = CJ.rules.groupDays(db.shifts.filter((x) => x.siteId === 's51' && CJ.rules.inWeek(T.dayKey(x.clockIn), lastWk)));
    const date = T.addDays(lastWk, 8);
    db.invoices.push({ id: 'inv-s51-' + lastWk, company: 'us', number: st.invoicePrefix + '-0001', siteId: 's51', weekStart: lastWk, date, ...CJ.F.invoiceLines(g, st, db.settings.hstRate), status: 'draft', createdBy: 'u-us-billing', createdAt: iso(at(date, 0, 9, 20)), payments: [] });
    db.incidents.push({ id: 'in-us1', company: 'us', shiftId: us.find((x) => x.userId === 'u-us-joseph' && x.clockOut).id, userId: 'u-us-joseph', siteId: us.find((x) => x.userId === 'u-us-joseph' && x.clockOut).siteId, type: 'Near miss', text: 'Tractor reversed near the picking line without a spotter. Told the farm supervisor.', photo: null, at: us.find((x) => x.userId === 'u-us-joseph' && x.clockOut).clockOut, wcbStatus: 'WCB review needed', history: [{ status: 'WCB review needed', by: 'u-us-joseph', at: us.find((x) => x.userId === 'u-us-joseph' && x.clockOut).clockOut }] });
  }

  // Placeholder "photo" for seeded incidents (an SVG data URL — no real image data).
  CJ.samplePhoto = function (label) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200"><rect width="320" height="200" fill="#cbd5e1"/><rect x="18" y="22" width="284" height="156" rx="10" fill="#94a3b8"/><circle cx="90" cy="80" r="22" fill="#e2e8f0"/><path d="M30 170 L120 95 L190 150 L230 115 L300 170 Z" fill="#64748b"/><text x="160" y="196" font-family="sans-serif" font-size="13" text-anchor="middle" fill="#334155">sample photo · ${label}</text></svg>`;
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  };
})();
