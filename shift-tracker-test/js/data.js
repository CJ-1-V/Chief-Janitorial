/* Chief Janitorial Shift Tracker — PROTOTYPE data layer.
 * Everything lives in localStorage. In production this would be a server DB;
 * the role-scoped projections in api.js stand in for server-side filtering. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  CJ.STORE_KEY = 'cj-shift-proto-v1';

  // Small deterministic PRNG so the sample data is the same on every reset.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Legacy codes from the current app. The short site number = the code's trailing digits,
  // so the office can map old records to new numbers 1:1. "UNKNOWN CODE" is retired.
  // Client names below are FICTIONAL sample data for the prototype.
  const SITES = [
    ['CJVTBP11', 'Bayview Potato Farms', 'Farm', 'Kensington'],
    ['CJVTCF12', 'Cavendish Ridge Farm', 'Farm', 'Cavendish'],
    ['CJVTDB13', 'Dunrobin Dairy Barn', 'Farm', 'Summerside'],
    ['CJVTSF14', 'Seaside Fields Ltd.', 'Farm', "O'Leary"],
    ['CJVTJF15', 'Johnston Family Farm', 'Farm', 'Alberton'],
    ['CJVTAF16', 'Abram Village Acres', 'Farm', 'Wellington'],
    ['CJCTCV17', 'Charlottetown Vet Clinic', 'Healthcare', 'Charlottetown'],
    ['CJVTWF18', 'Wheatley River Farms', 'Farm', 'Wheatley River'],
    ['CJVTHF19', 'Hillcrest Hog Farm', 'Farm', 'Hunter River'],
    ['CJVTGF20', 'Seabreeze Greenhouses', 'Farm', 'Cornwall'],
    ['CJVTSI21', 'Souris Island Seafoods', 'Warehouse', 'Souris'],
    ['CJVTGM22', 'Gallant Mills Farm', 'Farm', 'Tignish'],
    ['CJVTMB23', 'Murray Brook Blueberries', 'Farm', 'Murray River'],
    ['CJVTPF24', 'Pleasant View Poultry', 'Farm', 'Montague'],
    ['CJVTVF25', 'Valleyfield Organics', 'Farm', 'Valleyfield'],
    ['CJVTCP26', 'Crapaud Produce Co.', 'Farm', 'Crapaud'],
    ['CJVTDL27', 'Darnley Livestock', 'Farm', 'Darnley'],
    ['CJVTCG28', 'Cardigan Grain Elevators', 'Warehouse', 'Cardigan'],
    ['CJVTCT29', 'Coleman Tuber Farm', 'Farm', 'Coleman'],
    ['CJVTJC30', 'Judique Creek Dairy', 'Farm', 'Freetown'],
    ['CJVTDB31', 'Dundas Berry Farm', 'Farm', 'Dundas'],
    ['CJVTSP32', 'St. Peters Potato Storage', 'Warehouse', 'St. Peters'],
    ['CJCTCT33', 'Capital Towers Offices', 'Office', 'Charlottetown'],
    ['CJCTBA34', 'Brighton Animal Hospital', 'Healthcare', 'Charlottetown'],
    ['CJCTBB35', 'Belvedere Business Centre', 'Office', 'Charlottetown'],
    ['CJVTMF36', 'Mill River Farms', 'Farm', 'Woodstock'],
    ['CJVTKM37', 'Kildare Cattle Co.', 'Farm', 'Kildare Capes'],
    ['CJVTAC38', 'Augustine Cove Orchards', 'Farm', 'Augustine Cove'],
    ['CJVTFB39', 'Foxley Bend Farm', 'Farm', 'Foxley River'],
    ['CJVTSV40', 'Stanley Valley Farms', 'Farm', 'Stanley Bridge'],
    ['CJVTTSC41', 'Tyne Valley Seed Cleaning', 'Warehouse', 'Tyne Valley'],
  ];

  // Fictional sample people (no real employee data from the live app).
  const WORKERS = [
    ['u-harpreet', 'Harpreet Kaur', '9025550101', [12, 22, 16]],
    ['u-gurpreet', 'Gurpreet Singh', '9025550102', [15, 14, 11]],
    ['u-manpreet', 'Manpreet Kaur', '9025550103', [13, 25, 19]],
    ['u-arjun', 'Arjun Sharma', '9025550104', [33, 35, 17]],
    ['u-simran', 'Simran Gill', '9025550105', [18, 20, 24]],
    ['u-navdeep', 'Navdeep Sandhu', '9025550106', [37, 40, 36]],
    ['u-maria', 'Maria Santos', '9025550107', [34, 17, 33]],
    ['u-liam', 'Liam MacDonald', '9025550108', [21, 32, 28]],
    ['u-emily', 'Emily Gallant', '9025550109', [26, 27, 29]],
    ['u-rajveer', 'Rajveer Brar', '9025550110', [23, 30, 31]],
    ['u-priya', 'Priya Patel', '9025550111', [38, 39, 41]],
  ];

  // Atlantic (America/Halifax) wall-clock time, `dayOffset` days from the base day key.
  function at(baseKey, dayOffset, h, m) { return CJ.tz.zoned(CJ.tz.addDays(baseKey, dayOffset), h, m); }
  const iso = (d) => new Date(d).toISOString();

  CJ.seed = function () {
    const r = rng(20261003);
    const now = new Date();
    const today = CJ.tz.todayKey();
    const lastWk = CJ.tz.addDays(CJ.tz.weekStart(today), -7); // Monday of last completed week
    const isLastWk = (key) => key >= lastWk && key <= CJ.tz.addDays(lastWk, 6);
    const db = { version: 6, seededAt: iso(now), users: [], sites: [], shifts: [], settings: { empEditWindowDays: 14, maxShiftHours: 18 } };

    SITES.forEach(([code, name, type, town]) => {
      const number = parseInt(code.match(/(\d+)$/)[1], 10);
      db.sites.push({ id: 's' + number, number, clientName: name, type, location: town + ', PEI', legacyCode: code, active: true });
    });
    db.sites.sort((a, b) => a.number - b.number);

    db.users.push({ id: 'u-owner', name: 'Owner (Admin)', phone: '1111111111', password: 'demo', role: 'admin', staffRole: 'owner', companies: ['cj', 'us'], status: 'active', createdAt: iso(at(today, -400, 9, 0)) });
    WORKERS.forEach(([id, name, phone], i) => {
      db.users.push({ id, name, phone, password: 'demo', role: 'worker', status: 'active', createdAt: iso(at(today, -300 + i * 20, 10, 0)), decidedBy: 'u-owner', decidedAt: iso(at(today, -300 + i * 20, 15, 0)) });
    });
    // Pending sign-ups (the "AI" test account from the live-app tour is one of them).
    db.users.push({ id: 'u-ai', name: 'AI', phone: '9025550147', password: 'demo', role: 'worker', status: 'pending', createdAt: iso(at(today, 0, 8, 2)) });
    db.users.push({ id: 'u-kulwinder', name: 'Kulwinder Singh', phone: '9025550148', password: 'demo', role: 'worker', status: 'pending', createdAt: iso(at(today, -1, 19, 41)) });
    db.users.push({ id: 'u-sarah', name: 'Sarah Doiron', phone: '9025550149', password: 'demo', role: 'worker', status: 'pending', createdAt: iso(at(today, -2, 13, 5)) });
    // Already-processed sign-ups
    db.users.push({ id: 'u-jordan', name: 'Jordan Doucette', phone: '9025550150', password: 'demo', role: 'worker', status: 'rejected', createdAt: iso(at(today, -6, 11, 20)), decidedBy: 'u-owner', decidedAt: iso(at(today, -5, 9, 3)), decisionNote: 'Not a Chief Janitorial employee' });
    db.users.push({ id: 'u-amandeep', name: 'Amandeep Dhaliwal', phone: '9025550151', password: 'demo', role: 'worker', status: 'active', createdAt: iso(at(today, -4, 18, 0)), decidedBy: 'u-owner', decidedAt: iso(at(today, -4, 20, 12)) });

    let sid = 1;
    const mk = (userId, siteNumber, inD, outD, notes) => {
      const s = { id: 'sh' + sid++, userId, siteId: 's' + siteNumber, clockIn: iso(inD), clockOut: outD ? iso(outD) : null, notes: notes || '', recordedIn: iso(inD), recordedOut: outD ? iso(outD) : null, crewCount: null, recordedCrew: null, edits: [] };
      db.shifts.push(s); return s;
    };
    const notesPool = ['', '', '', 'Ride with Simran', 'Ride partner: Gurpreet', 'Barn 2 + wash bay', '', 'Started late, traffic', '', 'Office floors + washrooms', ''];

    // Generic history for the last 13 days + today.
    WORKERS.forEach(([id, , , sites], wi) => {
      const firstDay = -Math.round((CJ.tz.zoned(today, 12, 0) - CJ.tz.zoned(today.slice(0, 4) + '-07-01', 12, 0)) / 86400000); // season starts Jul 1
      for (let d = firstDay; d <= 0; d++) {
        const dayK = CJ.tz.addDays(today, d);
        if (id === 'u-harpreet' && d >= -13) continue; // Harpreet's recent shifts are scripted below
        if (id === 'u-rajveer' && d >= -6) continue;   // Rajveer's last 7 days are scripted (overtime + fatigue demo)
        if (d === 0 && id === 'u-gurpreet') { // always on shift today (for the on-shift demo)
          const start = new Date(Math.max(now.getTime() - 41 * 60000, at(today, 0, 0, 5).getTime()));
          mk(id, sites[0], start, null, 'Ride partner: Navdeep'); continue;
        }
        if (d === 0) {
          if (r() < 0.45) {
            const start = new Date(now.getTime() - (25 + Math.floor(r() * 140)) * 60000);
            if (CJ.tz.dayKey(start) === today) mk(id, sites[0], start, null, notesPool[Math.floor(r() * notesPool.length)]);
          }
          continue;
        }
        if ((id === 'u-liam' && isLastWk(dayK) && CJ.tz.weekday(dayK) % 6 === 0) || (id === 'u-simran' && dayK === CJ.tz.addDays(lastWk, 4))) continue; // keep rule-demo days clean
        if (CJ.tz.weekday(dayK) === 0 && r() < 0.7) continue; // most take Sunday off
        if (r() < 0.25) continue;
        let site = sites[r() < 0.6 ? 0 : r() < 0.6 ? 1 : 2];
        if (site === 12 && isLastWk(dayK)) site = sites[0] === 12 ? sites[1] : sites[0]; // Site 12 last week is reserved for the scripted rule demo
        const sh = 6 + Math.floor(r() * 3), sm = Math.floor(r() * 60);
        const len = 6 * 60 + Math.floor(r() * 4.5 * 60);
        if (id === 'u-harpreet' && isLastWk(dayK)) continue;
        const inD = at(today, d, sh, sm);
        const outD = new Date(inD.getTime() + len * 60000);
        if (id === 'u-navdeep' && d === -1) { mk(id, site, inD, null, 'Barn 2 + wash bay'); continue; } // missed clock-out
        mk(id, site, inD, outD, notesPool[Math.floor(r() * notesPool.length)]);
      }
    });

    // --- Scripted shifts for the Employee demo (Harpreet) ---
    const H = 'u-harpreet';
    const plan = [
      [-13, 12, 7, 30, 15, 45], [-12, 22, 7, 15, 16, 0], [-11, 12, 7, 40, 15, 30], [-10, 16, 8, 0, 14, 30],
      [-8, 12, 7, 25, 11, 30], [-8, 12, 12, 15, 16, 10], [-7, 22, 7, 30, 15, 50], [-6, 12, 7, 35, 16, 5], [-5, 16, 8, 5, 14, 45],
      [-4, 12, 7, 20, 15, 40],
    ];
    plan.forEach(([d, site, h1, m1, h2, m2]) => { if (!isLastWk(CJ.tz.addDays(today, d))) mk(H, site, at(today, d, h1, m1), at(today, d, h2, m2), ''); });

    // --- Rule demo: last completed week at Site 12 (Atlantic time). Every break/billing rule is visible here. ---
    const L = (dow, h, m) => at(lastWk, dow, h, m); // dow 0 = Monday
    mk(H, 12, L(0, 7, 30), L(0, 12, 0), 'Half day');                       // Mon 4.5 h  -> paid 4.5, bills 5.0 (minimum)
    const tue = mk(H, 12, L(1, 7, 58), L(1, 13, 40), '');                  // Tue 6 h (after M fix) -> paid 5.5, bills 5.5
    applyEdit(tue, 'clockIn', iso(L(1, 7, 40)), H, 'worker', iso(L(1, 16, 2)), 'Forgot to clock in — arrived 7:40.');
    mk(H, 12, L(2, 7, 0), L(2, 15, 0), '');                                // Wed 8 h    -> paid 7.0, bills 7.5
    mk(H, 12, L(3, 7, 0), L(3, 10, 0), 'Morning milking');                 // Thu split 3 h + 3 h = 6 h -> paid 5.5, bills 5.5 (not 5+5)
    mk(H, 12, L(3, 13, 0), L(3, 16, 0), 'Afternoon wash-down');
    mk(H, 12, L(4, 7, 0), L(4, 16, 0), '');                                // Fri 9 h    -> paid 8.0, bills 8.5
    mk('u-liam', 12, L(5, 22, 0), L(6, 6, 30), 'Overnight barn clean');    // Sat 22:00 -> Sun 06:30 = 8.5 h, counts Saturday -> paid 7.5, bills 8.0
    mk('u-liam', 12, L(6, 9, 0), L(6, 12, 0), 'Short call-in');            // Sun 3 h    -> paid 3.0, bills 5.0 (minimum)
    mk('u-simran', 12, L(4, 8, 0), L(4, 13, 15), '');                      // Fri 5.25 h -> paid 4.75, bills 5.0 (minimum, not 4.75)
    const mp = db.shifts.filter((x) => x.userId === 'u-manpreet' && x.clockOut && isLastWk(CJ.tz.dayKey(x.clockIn)))[0];
    if (mp) { mp.recordedOut = iso(new Date(new Date(mp.clockOut).getTime() + 3.5 * 3600000)); const real = mp.clockOut; mp.clockOut = mp.recordedOut; applyEdit(mp, 'clockOut', real, 'u-owner', 'admin', iso(new Date(new Date(real).getTime() + 16 * 3600000)), 'Missed clock-out; farm manager confirmed finish time.'); }

    // 3 days ago: forgot to clock out, closed it late at night -> office corrected the clock-out.
    const s3 = mk(H, 22, at(today, -3, 7, 28), at(today, -3, 23, 58), 'Ride with Simran');
    s3.id = 'sh-demo-office';
    s3.crewCount = s3.recordedCrew = 2; // reported 2 at the late clock-out
    applyEdit(s3, 'clockOut', iso(at(today, -3, 16, 30)), 'u-owner', 'admin', iso(at(today, -2, 9, 12)), 'Missed clock-out; confirmed 4:30 PM finish with Simran.');
    applyEdit(s3, 'crewCount', 1, 'u-owner', 'admin', iso(at(today, -2, 9, 13)), 'Only Harpreet worked the site; Simran just gave her a ride.');

    // 2 days ago: normal.
    mk(H, 16, at(today, -2, 8, 0), at(today, -2, 14, 35), '');

    // Yesterday: clocked in late (phone in car) -> she fixed her own clock-in.
    const s1 = mk(H, 12, at(today, -1, 7, 52), at(today, -1, 16, 5), 'Barn 1 + milk house');
    s1.id = 'sh-demo-self';
    s1.crewCount = s1.recordedCrew = 3; // MISMATCH demo: reported 3 on site, only 1 clocked in
    applyEdit(s1, 'clockIn', iso(at(today, -1, 7, 30)), H, 'worker', iso(at(today, -1, 18, 14)), 'Phone was in the car, started 7:30.');

    // Another worker self-edit + an admin edit so the admin table has a few M's.
    const g = db.shifts.filter((s) => s.userId === 'u-gurpreet' && s.clockOut).slice(-3)[0];
    if (g) { const nv = new Date(new Date(g.clockOut).getTime() + 45 * 60000); applyEdit(g, 'clockOut', iso(nv), 'u-gurpreet', 'worker', iso(new Date(new Date(g.clockOut).getTime() + 3 * 3600000)), 'Stayed late to finish wash bay, forgot to clock out on time.'); }
    const m = db.shifts.filter((s) => s.userId === 'u-maria' && s.clockOut).slice(-2)[0];
    if (m) { const nv = new Date(new Date(m.clockIn).getTime() - 20 * 60000); applyEdit(m, 'clockIn', iso(nv), 'u-owner', 'admin', iso(at(CJ.tz.dayKey(m.clockIn), 1, 9, 5)), 'Supervisor confirmed earlier start.'); }

    // MISMATCH demo in last week's Site 12 timesheet: Fri — Harpreet and Simran both report a crew of 4, only 2 clocked in.
    const friK = CJ.tz.addDays(lastWk, 4);
    db.shifts.filter((x) => x.siteId === 's12' && CJ.tz.dayKey(x.clockIn) === friK).forEach((x) => (x.crewCount = x.recordedCrew = 4));
    // Everyone else reported the true crew size (= distinct workers clocked in at that site that day).
    const crew = {};
    db.shifts.forEach((x) => { const k = x.siteId + '|' + CJ.tz.dayKey(x.clockIn); (crew[k] = crew[k] || new Set()).add(x.userId); });
    db.shifts.forEach((x) => { if (x.clockOut && x.crewCount == null) x.crewCount = x.recordedCrew = crew[x.siteId + '|' + CJ.tz.dayKey(x.clockIn)].size; });

    if (CJ.seedExtras) CJ.seedExtras(db, { today, lastWk, at, mk, applyEdit, now, rng: r });
    db.shifts.sort((a, b) => new Date(b.clockIn) - new Date(a.clockIn));
    return db;
  };

  function applyEdit(shift, field, to, byUserId, byRole, atIso, reason) {
    shift.edits.push({ id: 'e' + Math.random().toString(36).slice(2, 8), field, from: shift[field], to, byUserId, byRole, at: atIso, reason });
    shift[field] = to;
  }
  CJ.applyEdit = applyEdit;
})();
