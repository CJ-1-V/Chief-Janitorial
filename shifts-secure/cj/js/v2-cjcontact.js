/* v2-cjcontact.js – CJ twin (TEST): client "Contact the office" + office "Client messages & complaints". sitehours1, Oct 8 2026.
   Owner (Oct 8 12:04 PM): clients can log a complaint or reach out to the office through the app.
   - Client #/contact: "Report a problem (complaint)" – site, date, category (missed area, quality, damage, staff, other), description,
     optional photo (uses the app's existing photo upload, stored in the browser for the test) – or "Message the office" (free text).
     "My messages" lists the client's own items with status and the office replies.
   - Office #/clientmsgs: queue with status Open / In progress / Resolved and a reply the client sees. Overview flag for open items.
   - Data: DB.clientMsgs (mock only). Alerts go to the simulated outbox only. Clients only ever see their own items. */
'use strict';
(function () {
  if (typeof NAV === 'undefined' || typeof VIEWS === 'undefined') return;
  var CM_CATS = ['Missed area', 'Quality of cleaning', 'Damage', 'Staff', 'Other'];
  var CM_PILL = { Open: 's-pend', 'In progress': 's-warn', Resolved: 's-ok' };
  function cmList() { return DB.clientMsgs = DB.clientMsgs || []; }
  function cmById(id) { return cmList().filter(function (m) { return m.id === id; })[0] || null; }
  function cmNo() { DB.clientMsgSeq = (DB.clientMsgSeq || 0) + 1; return 'M-' + String(DB.clientMsgSeq).padStart(4, '0'); }
  function cmThread(m, forClient) {
    return (m.replies || []).map(function (r) { return '<div class="cmreply ' + (r.from === 'office' ? 'office' : 'client') + '"><div class="small muted">' + esc(r.from === 'office' ? 'Chief Janitorial office' : (forClient ? 'You' : m.firmName)) + ' · ' + fmtStamp(r.at) + '</div>' + esc(r.text) + '</div>'; }).join('');
  }
  function cmHead(m) { return '<div class="cr-head"><b>' + esc(m.no) + ' · ' + (m.kind === 'complaint' ? 'Problem: ' + esc(m.category) : 'Message') + '</b><span class="pill ' + (CM_PILL[m.status] || 's-mut') + '">' + esc(m.status) + '</span></div>'; }
  function cmBody(m) {
    return (m.kind === 'complaint' ? '<div class="cr-grid"><div><span>Site</span>' + esc(siteName(m.site)) + '</div><div><span>Date</span>' + esc(shortDay(m.date)) + '</div><div><span>Sent</span>' + fmtStamp(m.createdAt) + '</div></div>' : '<div class="small muted">Sent ' + fmtStamp(m.createdAt) + '</div>') +
      '<div class="cmtext">' + esc(m.text) + '</div>' + (m.photo ? '<button type="button" class="small sec" data-act="cmphoto" data-id="' + esc(m.id) + '">📷 See photo</button>' : '');
  }
  /* ---------- client ---------- */
  function cmForm(firm, kind) {
    var d = PAGE_STATE.cmDraft || {}, codes = firmCodes(firm);
    if (kind === 'complaint') return '<div class="card"><form data-form="cmsend" id="cmform"><input type="hidden" name="kind" value="complaint"><h2 style="margin-top:0">Report a problem</h2><div class="grid2">' +
      sel('site', 'Site', codes.map(function (c) { return [c, siteName(c)]; }), d.site || (codes.length === 1 ? codes[0] : ''), { req: true }) + inp('date', 'Date of the cleaning', d.date || addDays(today(), -1), { type: 'date', req: true, extra: ' max="' + today() + '"' }) +
      sel('category', 'What kind of problem?', CM_CATS, d.category || '', { req: true }) + '<div><label>Photo (optional)</label><input type="file" name="photo" accept="image/*" id="cmphoto"></div></div>' +
      '<div><label class="req">What happened?</label><textarea name="text" required maxlength="1500" placeholder="e.g. the washrooms on the 2nd floor were not cleaned on Tuesday night">' + esc(d.text || '') + '</textarea></div>' +
      '<div class="row"><button type="submit" id="cmsend">Send to the office</button><button type="button" class="sec" data-act="cmclose">Cancel</button></div></form></div>';
    return '<div class="card"><form data-form="cmsend" id="cmform"><input type="hidden" name="kind" value="message"><h2 style="margin-top:0">Message the office</h2>' +
      '<div><label class="req">Your message</label><textarea name="text" required maxlength="1500" placeholder="Questions, changes to your regular cleaning, keys or alarm codes, anything else">' + esc(d.text || '') + '</textarea></div>' +
      '<div class="row"><button type="submit" id="cmsend">Send</button><button type="button" class="sec" data-act="cmclose">Cancel</button></div></form></div>';
  }
  VIEWS['firm:contact'] = function () {
    var firm = ME, mine = cmList().filter(function (m) { return m.firmId === firm.id; }).sort(function (a, b) { return (a.updatedAt || a.createdAt) < (b.updatedAt || b.createdAt) ? 1 : -1; });
    var x = '<h1>Contact the office</h1><p class="muted">Report a problem with a cleaning, or send the Chief Janitorial office a message. You get the office reply here and by email.</p>';
    if (PAGE_STATE.cmSent) { var s = cmById(PAGE_STATE.cmSent); PAGE_STATE.cmSent = null; if (s) x += '<div class="alert ok" id="cmdone"><b>' + (s.kind === 'complaint' ? 'Problem report ' : 'Message ') + esc(s.no) + ' sent ✓</b> The office will reply here.</div>'; }
    x += PAGE_STATE.cmForm ? cmForm(firm, PAGE_STATE.cmForm) : '<div class="cmbtns"><button class="big" data-act="cmopen" data-k="complaint" id="cmcomplaint">⚠ Report a problem (complaint)</button><button class="big sec" data-act="cmopen" data-k="message" id="cmmessage">✉ Message the office</button></div>';
    x += '<h2 id="cmmine">My messages</h2>' + (mine.length ? '<div id="cmlist">' + mine.map(function (m) { return '<div class="crcard cmcard" data-id="' + esc(m.id) + '">' + cmHead(m) + cmBody(m) + cmThread(m, true) + '</div>'; }).join('') + '</div>' : '<p class="muted msg-empty" id="cmlist">No messages yet.</p>');
    return x;
  };
  ACT.cmopen = function (el) { PAGE_STATE.cmForm = el.dataset.k; PAGE_STATE.cmDraft = null; go('#/contact'); };
  ACT.cmclose = function () { PAGE_STATE.cmForm = null; PAGE_STATE.cmDraft = null; render(); };
  FORMS.cmsend = function (f, d) {
    if (!ME || ME.type !== 'firm') { toast('Only client accounts can send these.'); return; }
    PAGE_STATE.cmDraft = d; var text = String(d.text || '').trim();
    if (!text) { toast('Please write your message.'); return; }
    var kind = d.kind === 'complaint' ? 'complaint' : 'message';
    if (kind === 'complaint') {
      if (firmCodes(ME).indexOf(d.site) < 0) { toast('Please choose one of your sites.'); return; }
      if (!d.date || d.date > today()) { toast('Please choose the date of the cleaning.'); return; }
      if (CM_CATS.indexOf(d.category) < 0) { toast('Please choose the kind of problem.'); return; }
    }
    var fin = function (photo) {
      var m = { id: uid('cm'), no: cmNo(), kind: kind, firmId: ME.id, firmName: ME.name, site: kind === 'complaint' ? d.site : '', date: kind === 'complaint' ? d.date : '', category: kind === 'complaint' ? d.category : '', text: text.slice(0, 1500), photo: photo || null, status: 'Open', replies: [], createdAt: new Date().toISOString() };
      cmList().push(m); audit(kind === 'complaint' ? 'Client reported a problem' : 'Client message', m.firmName, m.no + (m.category ? ' – ' + m.category + ' at ' + m.site : ''));
      notify('admin', (kind === 'complaint' ? 'Problem report ' : 'Message ') + m.no + ' from ' + m.firmName + (kind === 'complaint' ? ' (' + m.category + ', ' + m.site + ', ' + m.date + ')' : '') + ': ' + text.slice(0, 160), 'cm-' + m.id);
      if (!save()) return; PAGE_STATE.cmForm = null; PAGE_STATE.cmDraft = null; PAGE_STATE.cmSent = m.id; toast(m.no + ' sent ✓'); render();
    };
    var file = f.querySelector('input[type=file]'); file = file && file.files && file.files[0];
    if (file && typeof readUpload === 'function') readUpload(file, function (r) { fin(r); }); else fin(null);
  };
  ACT.cmphoto = function (el) { var m = cmById(el.dataset.id); if (!m || !m.photo || !ME || (ME.type !== 'admin' && m.firmId !== ME.id)) return; showFile(m.photo.name, m.photo.type, m.photo.data, 'Photo – ' + m.no); };
  /* ---------- office ---------- */
  VIEWS['admin:clientmsgs'] = function () {
    var tab = PAGE_STATE.cmTab || 'open', all = cmList().slice().sort(function (a, b) { return (a.updatedAt || a.createdAt) < (b.updatedAt || b.createdAt) ? 1 : -1; });
    var cnt = function (s) { return all.filter(function (m) { return m.status === s; }).length; };
    var l = tab === 'open' ? all.filter(function (m) { return m.status !== 'Resolved'; }) : tab === 'resolved' ? all.filter(function (m) { return m.status === 'Resolved'; }) : all;
    return '<h1>Client messages &amp; complaints</h1><p class="muted">Problem reports and messages sent by clients from their app. Set the status and reply – the client sees your reply in “My messages”.</p>' +
      '<div class="row crtabs"><button class="small' + (tab === 'open' ? '' : ' sec') + '" data-act="cmtab" data-t="open">Open &amp; in progress (' + (cnt('Open') + cnt('In progress')) + ')</button><button class="small' + (tab === 'resolved' ? '' : ' sec') + '" data-act="cmtab" data-t="resolved">Resolved (' + cnt('Resolved') + ')</button><button class="small' + (tab === 'all' ? '' : ' sec') + '" data-act="cmtab" data-t="all">All (' + all.length + ')</button></div>' +
      (l.length ? '<div id="cmqueue">' + l.map(function (m) {
        return '<div class="crcard office cmcard" data-id="' + esc(m.id) + '">' + cmHead(m).replace('</b>', '</b> <span>' + esc(m.firmName) + '</span>') + cmBody(m) + cmThread(m, false) +
          '<div class="cmact"><textarea name="cmreply" placeholder="Reply to the client (they see this)"></textarea><div class="row"><select name="cmstatus" aria-label="Status">' + opt(['Open', 'In progress', 'Resolved'], m.status === 'Open' ? 'In progress' : m.status) + '</select><button type="button" class="small" data-act="cmsave" data-id="' + esc(m.id) + '">Save &amp; reply</button></div></div></div>';
      }).join('') + '</div>' : '<p class="muted msg-empty" id="cmqueue">Nothing here.</p>');
  };
  ACT.cmtab = function (el) { PAGE_STATE.cmTab = el.dataset.t; render(); };
  ACT.cmsave = function (el) {
    if (!ME || ME.type !== 'admin') { denied('cmsave'); return; }
    var m = cmById(el.dataset.id); if (!m) return; var box = el.closest('.cmact'), txt = String(box.querySelector('[name=cmreply]').value || '').trim(), st = box.querySelector('[name=cmstatus]').value;
    if (['Open', 'In progress', 'Resolved'].indexOf(st) < 0) return;
    if (!txt && st === m.status) { toast('Write a reply or change the status.'); return; }
    var old = m.status; m.status = st; m.updatedAt = new Date().toISOString();
    if (txt) (m.replies = m.replies || []).push({ at: m.updatedAt, from: 'office', by: ME.name, text: txt.slice(0, 1500) });
    audit('Client message updated', m.firmName, m.no + ': ' + old + ' → ' + st + (txt ? ' (replied)' : ''));
    notify(m.firmId, 'The Chief Janitorial office ' + (txt ? 'replied to' : 'updated') + ' your ' + (m.kind === 'complaint' ? 'problem report ' : 'message ') + m.no + ' (status: ' + st + ')' + (txt ? ': ' + txt.slice(0, 200) : '.'), 'cmr-' + m.id + '-' + (m.replies || []).length + st);
    save(); toast(m.no + ' saved ✓'); render();
  };
  if (typeof ADMIN_ONLY_ACT !== 'undefined') ADMIN_ONLY_ACT.push('cmsave', 'cmtab');
  if (typeof ROLE_ONLY !== 'undefined') ROLE_ONLY.cmsend = ['firm'];
  /* ---------- menus + flags ---------- */
  if (NAV.firm && !NAV.firm.some(function (n) { return n[0] === '#/contact'; })) { var pi = -1; NAV.firm.forEach(function (n, i) { if (n[0] === '#/profile') pi = i; }); NAV.firm.splice(pi >= 0 ? pi : NAV.firm.length, 0, ['#/contact', 'Contact the office']); }
  if (NAV.admin && !NAV.admin.some(function (n) { return n[0] === '#/clientmsgs'; })) { var ci = -1; NAV.admin.forEach(function (n, i) { if (n[0] === '#/cleanrequests') ci = i; }); NAV.admin.splice(ci >= 0 ? ci + 1 : NAV.admin.length, 0, ['#/clientmsgs', 'Client messages & complaints']); }
  if (typeof MENU_GROUPS !== 'undefined' && MENU_GROUPS && MENU_GROUPS[0][1].indexOf('#/clientmsgs') < 0) { var g = MENU_GROUPS[0][1], ri = g.indexOf('#/cleanrequests'); g.splice(ri >= 0 ? ri + 1 : 1, 0, '#/clientmsgs'); }
  if (typeof adminFlags === 'function') { var oaf = adminFlags; adminFlags = function () { var f = oaf(), o = cmList().filter(function (m) { return m.status === 'Open'; }), c = o.filter(function (m) { return m.kind === 'complaint'; }).length; if (o.length) f.unshift({ t: 'Client messages', c: c ? 's-bad' : 's-pend', h: o.length + ' open client message' + (o.length === 1 ? '' : 's') + (c ? ' (' + c + ' problem report' + (c === 1 ? '' : 's') + ')' : '') + '. <a href="#/clientmsgs">Open →</a>' }); return f; }; }
  if (typeof VIEWS['firm:home'] === 'function') {
    var ofh = VIEWS['firm:home'];
    VIEWS['firm:home'] = function (h) { var x = ofh(h); if (!ME || ME.type !== 'firm') return x; var n = cmList().filter(function (m) { return m.firmId === ME.id && m.status !== 'Resolved' && (m.replies || []).length; }).length;
      var card = '<div class="card cmhome" id="cmhome"><a class="btn sec" href="#/contact">Contact the office</a> <span class="small muted">Report a problem or send a message.' + (n ? ' <b>' + n + ' with a reply from the office.</b>' : '') + '</span></div>';
      var i = x.indexOf('<div class="card spupcoming"'); if (i < 0) return x + card; var j = x.indexOf('</table></div>', i); var k = x.indexOf('<div class="card', i + 10); return k > 0 ? x.slice(0, k) + card + x.slice(k) : x + card; };
  }
})();
