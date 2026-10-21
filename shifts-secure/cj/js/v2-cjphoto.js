/* calendar1 – PHOTO PROOF (owner, Oct 21 2026). TEST copy: photos live in mock storage (DB.taskPhotos, data: URLs).
   Who sets "Photo needed" on a site task (Daily or Weekly): the client's MAIN account and team MANAGERS (not Supervisors),
   from the "This week's tasks" card (📷 Photo proof); the office (owner/admin/ops) on the Site tasks page. Flag is by task text
   (DB.sites[].photoTasks = ['Clean washrooms…']). Crew: a photo-needed task shows 📷 and can't be Done until 1–3 photos are
   added (phone camera: <input type=file accept=image/* capture=environment>), compressed in the browser to ≤1600 px / ~300 KB,
   with the time taken saved. Client + office see thumbnails on the visit's task results (tap = full size). Photos are only
   readable through the visit (site-isolation rule): the client for their own sites, crew on that visit, the office. */
(function () {
  if (typeof ACT === 'undefined') return;
  var MAXPX = 1600, MAXB = 300 * 1024, MAXN = 3, KEEP_DAYS = 50;   // owner Oct 21: photos kept 50 days
  window.CJ_PHOTO_KEEP_DAYS = KEEP_DAYS;
  function expired(d) { return daysBetween(d, today()) > KEEP_DAYS; }
  /* mock cleanup (stands in for the scheduled job): drop image data older than 50 days, keep a marker; ticks are untouched */
  window.cjPhotoPurge = function () { var n = 0; Object.keys(DB.taskPhotos || {}).forEach(function (key) { var d = key.split('|')[1], r = DB.taskPhotos[key]; if (!expired(d)) return; Object.keys(r).forEach(function (k) { r[k] = (r[k] || []).map(function (x) { if (x.removed) return x; n++; return { id: x.id, removed: true, removedAt: new Date().toISOString(), takenAt: x.takenAt }; }); }); }); if (n) { audit('Task photos removed (50-day retention)', '', n + ' photo(s)'); save(); } return n; };
  function site(c) { return (DB.sites || []).filter(function (s) { return s.code === c; })[0] || null; }
  function roles() { return (ME && ME.officeRoles) || (ME && ME.officeRole ? [ME.officeRole] : []); }
  function canManage() { if (!ME || ME.type !== 'admin') return false; var r = roles(); return !r.length || r.some(function (x) { return ['owner', 'admin', 'ops'].indexOf(x) >= 0; }); }
  function login() { return typeof clLoginOf === 'function' ? clLoginOf(ME) : ME; }
  function clientRole() { if (!ME || ME.type !== 'firm') return ''; var L = login(); return L && L !== ME && L.team ? L.loginRole || 'Team' : 'Main'; }
  function mySiteCodes() { return typeof calMySites === 'function' ? calMySites() : []; }
  function P() { return DB.taskPhotos = DB.taskPhotos || {}; }
  window.cjPhotoNeeded = function (code, text) { var s = site(code); return !!(s && (s.photoTasks || []).indexOf(text) >= 0); };
  window.cjPhotoCanSet = function (code) { if (canManage()) return true; var r = clientRole(); return (r === 'Main' || r === 'Manager') && mySiteCodes().indexOf(code) >= 0; };
  window.cjPhotoSet = function (code, text, on) {
    if (!cjPhotoCanSet(code)) return { ok: false, msg: 'Only the main account, a Manager or the office can set photo proof.' };
    var s = site(code); if (!s) return { ok: false, msg: 'Site not found.' };
    var l = (s.photoTasks || []).filter(function (t) { return t !== text; }); if (on) l.push(text); s.photoTasks = l;
    audit('Photo proof ' + (on ? 'required' : 'no longer required'), code, text + ' – set by ' + (login() || ME).name + (ME.type === 'firm' ? ' (' + clientRole() + ')' : ' (office)'));
    save(); return { ok: true };
  };
  function canSee(code, d) {
    if (!ME) return false; if (ME.type === 'admin') return true;
    if (ME.type === 'firm') return mySiteCodes().indexOf(code) >= 0;
    return typeof calCanVisit === 'function' && calCanVisit({ site: code, date: d });
  }
  window.cjTaskPhotos = function (code, d, k) { if (!canSee(code, d)) return []; var r = P()[code + '|' + d]; return ((r && r[k]) || []).filter(function (x) { return !x.removed && !expired(d); }); };
  window.cjTaskPhotosRemoved = function (code, d, k) { if (!canSee(code, d)) return 0; var r = P()[code + '|' + d]; return ((r && r[k]) || []).filter(function (x) { return x.removed || expired(d); }).length; };
  window.cjTaskPhotoAdd = function (code, d, k, ph) {
    if (!(typeof cjTaskCanEdit === 'function' && cjTaskCanEdit(code, d)) || ME.type === 'firm') return { ok: false, msg: 'Only the crew on this visit (on the visit day) or the office can add photos.' };
    var key = code + '|' + d, r = P()[key] = P()[key] || {}, l = r[k] = r[k] || [];
    if (expired(d)) return { ok: false, msg: 'Photos are kept for ' + KEEP_DAYS + ' days – this visit is too old.' };
    if (l.length >= MAXN) return { ok: false, msg: 'Up to ' + MAXN + ' photos per task.' };
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(ph.data || '')) return { ok: false, msg: 'Not an image.' };
    l.push({ id: 'ph' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), data: ph.data, w: ph.w, h: ph.h, bytes: ph.bytes, takenAt: ph.takenAt || new Date().toISOString(), at: new Date().toISOString(), by: ME.id, byName: ME.name });
    audit('Task photo added', code, d + ' · ' + k + ' · ' + Math.round(ph.bytes / 1024) + ' KB'); save(); return { ok: true, n: l.length };
  };
  window.cjTaskPhotoRemove = function (code, d, k, id) { if (!(typeof cjTaskCanEdit === 'function' && cjTaskCanEdit(code, d)) || ME.type === 'firm') return { ok: false }; var r = P()[code + '|' + d]; if (!r || !r[k]) return { ok: false }; r[k] = r[k].filter(function (x) { return x.id !== id; }); audit('Task photo removed', code, d + ' · ' + k); save(); return { ok: true }; };
  /* compress in the browser: longest side ≤1600 px, JPEG quality stepped down until ≤ ~300 KB */
  window.cjCompressPhoto = function (file) {
    return new Promise(function (res, rej) {
      var fr = new FileReader(); fr.onerror = rej; fr.onload = function () {
        var img = new Image(); img.onerror = function () { rej(new Error('Not an image')); }; img.onload = function () {
          var sc = Math.min(1, MAXPX / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * sc)), h = Math.max(1, Math.round(img.height * sc));
          var c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h);
          var q = 0.85, data = c.toDataURL('image/jpeg', q); while (data.length * 0.75 > MAXB && q > 0.35) { q -= 0.1; data = c.toDataURL('image/jpeg', q); }
          res({ data: data, w: w, h: h, bytes: Math.round(data.length * 0.75), takenAt: file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString() });
        }; img.src = fr.result;
      }; fr.readAsDataURL(file);
    });
  };
  /* block Done without a photo */
  if (typeof window.cjTaskSave === 'function') { var ots = window.cjTaskSave; window.cjTaskSave = function (code, d, ticks) {
    var items = cjTaskItems(code, d), miss = items.filter(function (it) { var x = (ticks || {})[it.k]; return x && x.st === 'done' && cjPhotoNeeded(code, it.t) && !cjTaskPhotos(code, d, it.k).length; });
    if (miss.length) return { ok: false, photo: true, msg: '📷 Photo needed before “' + miss[0].t + '” can be marked Done.' };
    return ots.apply(this, arguments);
  }; }
  function thumbs(code, d, k, del) { var l = cjTaskPhotos(code, d, k); if (!l.length) return cjTaskPhotosRemoved(code, d, k) ? '<div class="phgone small muted">📷 Photo removed after ' + KEEP_DAYS + ' days</div>' : ''; return '<div class="phthumbs">' + l.map(function (x) { return '<span class="phwrap"><img class="phthumb" src="' + x.data + '" alt="Task photo" data-act="phview" data-site="' + esc(code) + '" data-date="' + d + '" data-k="' + k + '" data-id="' + x.id + '">' + (del ? '<button type="button" class="phdel" data-act="phdel" data-site="' + esc(code) + '" data-date="' + d + '" data-k="' + k + '" data-id="' + x.id + '" aria-label="Remove photo">×</button>' : '') + '</span>'; }).join('') + '</div>'; }
  function reopen(code, d) { var b = document.createElement('button'); b.dataset.act = 'calvisit'; b.dataset.id = code + '|' + d; b.dataset.date = d; ACT.calvisit(b); }
  var ocv = ACT.calvisit; ACT.calvisit = function (el) {
    ocv.apply(this, arguments);
    var id = String(el.dataset.id || ''); if (id.indexOf('WAX:') === 0) return; var code = id.split('|')[0], d = el.dataset.date;
    var box = document.getElementById('caltasks'); if (!box || typeof cjTaskItems !== 'function') return;
    var items = cjTaskItems(code, d);
    [].forEach.call(box.querySelectorAll('.tdlist li'), function (li, i) { var it = items[i]; if (!it) return; if (cjPhotoNeeded(code, it.t)) li.insertAdjacentHTML('afterbegin', '<span class="phicon" title="Photo needed">📷</span>'); li.insertAdjacentHTML('beforeend', thumbs(code, d, it.k, false)); });
    if (ME.type === 'firm' && items.some(function (it) { return cjPhotoNeeded(code, it.t) || cjTaskPhotos(code, d, it.k).length || cjTaskPhotosRemoved(code, d, it.k); }) && !box.querySelector('.phkeep')) box.insertAdjacentHTML('beforeend', '<p class="phkeep small muted">📷 Photos are kept for ' + KEEP_DAYS + ' days.</p>');
    [].forEach.call(box.querySelectorAll('#tdform .tdrow'), function (row) {
      var it = items.filter(function (x) { return x.k === row.dataset.k; })[0]; if (!it || !cjPhotoNeeded(code, it.t)) return;
      var n = cjTaskPhotos(code, d, it.k).length; row.classList.add('phneed');
      row.querySelector('.tdt').insertAdjacentHTML('afterbegin', '<span class="phicon" title="Photo needed">📷</span>');
      row.insertAdjacentHTML('beforeend', '<div class="phbox">' + thumbs(code, d, it.k, true) + (n < MAXN ? '<label class="btn small sec phadd">📷 ' + (n ? 'Add another photo' : 'Take photo') + '<input type="file" accept="image/*" capture="environment" class="phinput" data-site="' + esc(code) + '" data-date="' + d + '" data-k="' + it.k + '" hidden></label>' : '') + '<span class="small muted">' + (n ? n + ' of ' + MAXN + ' photos' : 'Photo needed before Done') + '</span></div>');
      if (!n) { var dn = row.querySelector('input[value=done]'); if (dn) { dn.disabled = true; dn.parentElement.title = 'Take a photo first'; dn.parentElement.classList.add('phblocked'); } }
    });
  };
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.classList || !t.classList.contains('phinput')) return;
    var files = [].slice.call(t.files || []).slice(0, MAXN), code = t.dataset.site, d = t.dataset.date, k = t.dataset.k;
    Promise.all(files.map(cjCompressPhoto)).then(function (l) { var last; l.forEach(function (ph) { last = cjTaskPhotoAdd(code, d, k, ph); }); if (last && !last.ok) toast(last.msg); else toast('Photo added ✓'); reopen(code, d); }).catch(function () { toast('That file is not a photo.'); });
  });
  ACT.phdel = function (el) { cjTaskPhotoRemove(el.dataset.site, el.dataset.date, el.dataset.k, el.dataset.id); reopen(el.dataset.site, el.dataset.date); };
  ACT.phview = function (el) {
    var x = cjTaskPhotos(el.dataset.site, el.dataset.date, el.dataset.k).filter(function (p) { return p.id === el.dataset.id; })[0]; if (!x) return;
    modal('<div class="calsheet" id="phfull"><h2>Task photo</h2><img class="phbig" src="' + x.data + '" alt="Task photo full size"><p class="small muted">Taken ' + fmtStamp(x.takenAt) + (ME.type === 'firm' ? '' : ' · ' + esc(x.byName)) + ' · ' + x.w + '×' + x.h + '</p><div class="row"><button type="button" data-act="phback" data-site="' + esc(el.dataset.site) + '" data-date="' + el.dataset.date + '">Back to the visit</button><button type="button" class="sec" data-act="closeModal">Close</button></div></div>');
  };
  ACT.phback = function (el) { reopen(el.dataset.site, el.dataset.date); };

  /* ---------- setting the flag: client card / task list, office Site tasks page ---------- */
  function flagList(codes) {
    return codes.map(function (c) { var s = site(c); if (!s || typeof cjTasksDaily !== 'function') return ''; var all = cjTasksDaily(s).map(function (t) { return [typeof t === 'string' ? t : t.t || t.label, 'Daily']; }).concat(cjTasksWeekly(s).map(function (w) { return [w.t, 'Weekly']; }));
      return '<div class="phflags" data-site="' + esc(c) + '"><h3>' + esc(c + ' · ' + s.name) + '</h3>' + all.map(function (a) { return '<label class="phflag"><input type="checkbox" data-phflag="1" data-site="' + esc(c) + '" data-t="' + esc(a[0]) + '"' + (cjPhotoNeeded(c, a[0]) ? ' checked' : '') + (cjPhotoCanSet(c) ? '' : ' disabled') + '> 📷 <span>' + esc(a[0]) + '</span> <span class="pill s-mut">' + a[1] + '</span></label>'; }).join('') + '</div>';
    }).join('');
  }
  ACT.cjphotoset = function () {
    var codes = mySiteCodes(); var can = codes.some(cjPhotoCanSet);
    modal('<div class="calsheet" id="phsetsheet"><h2>Photo proof</h2><p class="small">Tick a task to ask the cleaners for a photo each time they do it. Photos are kept for ' + KEEP_DAYS + ' days. ' + (can ? '' : '<b>Only the main account or a Manager can change this.</b>') + ' The photos show on the visit’s task results.</p>' + flagList(codes) + '<div class="row"><button type="button" class="sec" data-act="closeModal">Done</button></div></div>');
  };
  document.addEventListener('change', function (e) { var t = e.target; if (!t || !t.dataset || !t.dataset.phflag) return; var r = cjPhotoSet(t.dataset.site, t.dataset.t, t.checked); if (!r.ok) { t.checked = !t.checked; toast(r.msg); } else toast(t.checked ? 'Photo needed ✓' : 'Photo no longer needed'); });
  if (typeof afterRender === 'function') { var oar = afterRender; afterRender = function () { oar.apply(this, arguments); try {
    if (window.REG_STORE && window.REG_STORE.mode === 'mock' && DB && DB.__phPurgeDay !== today()) { DB.__phPurgeDay = today(); cjPhotoPurge(); }
    var wt = document.getElementById('calweektasks'); if (wt && ME && ME.type === 'firm' && !document.getElementById('phsetlink')) { var a = wt.querySelector('[data-act=cwtall]'); var h = '<a class="small" href="#/calendar" id="phsetlink" data-act="cjphotoset">📷 Photo proof' + (mySiteCodes().some(cjPhotoCanSet) ? ' – choose tasks ›' : ' ›') + '</a>'; if (a) a.insertAdjacentHTML('afterend', ' · ' + h); else wt.insertAdjacentHTML('beforeend', h); }
    [].forEach.call(document.querySelectorAll('.cjtaskedit'), function (c) { if (c.querySelector('.phflags')) return; c.insertAdjacentHTML('beforeend', '<div class="small muted" style="margin-top:8px"><b>Photo proof</b> – the client’s main account / Managers can also set this.</div>' + flagList([c.dataset.site])); });
  } catch (e) {} }; }
})();
