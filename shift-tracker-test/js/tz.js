/* Atlantic-time helpers. All business dates (shift day, week Mon–Sun) are in America/Halifax,
 * regardless of the device's own time zone. */
(function () {
  const CJ = (window.CJ = window.CJ || {});
  const TZ = 'America/Halifax';
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', weekday: 'short' });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  function parts(t) {
    const o = {}; fmt.formatToParts(new Date(t)).forEach((p) => (o[p.type] = p.value));
    return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, mi: +o.minute, s: +o.second, wd: WD[o.weekday] };
  }
  const p2 = (n) => String(n).padStart(2, '0');
  const keyOf = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
  function offsetMs(t) { const p = parts(t); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000; }
  // Atlantic wall-clock time -> Date
  function zoned(key, h, mi) {
    const [y, m, d] = key.split('-').map(Number);
    const guess = Date.UTC(y, m - 1, d, h || 0, mi || 0);
    let t = guess - offsetMs(guess); t = guess - offsetMs(t); return new Date(t);
  }
  const dayKey = (t) => { const p = parts(t); return keyOf(p.y, p.m, p.d); };
  function addDays(key, n) { const [y, m, d] = key.split('-').map(Number); const u = new Date(Date.UTC(y, m - 1, d + n)); return keyOf(u.getUTCFullYear(), u.getUTCMonth() + 1, u.getUTCDate()); }
  function weekday(key) { const [y, m, d] = key.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); }
  const weekStart = (key) => addDays(key, -((weekday(key) + 6) % 7)); // Monday
  const todayKey = () => dayKey(Date.now());
  const toInput = (iso) => { if (!iso) return ''; const p = parts(iso); return keyOf(p.y, p.m, p.d) + 'T' + p2(p.h) + ':' + p2(p.mi); };
  const fromInput = (v) => { if (!v) return ''; const [k, hm] = v.split('T'); const [h, mi] = hm.split(':').map(Number); return zoned(k, h, mi).toISOString(); };
  CJ.tz = { TZ, parts, zoned, dayKey, addDays, weekday, weekStart, todayKey, toInput, fromInput };
})();
