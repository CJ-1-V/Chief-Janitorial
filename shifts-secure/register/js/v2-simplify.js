/* v2-simplify.js – simpler office screens (owner request Oct 25, 2026: "simplify the site more … keep the functionality the same").
   NOTHING IS REMOVED. Every office page keeps its route (#/review, #/lateentries, …), its code and its data; only the way you reach
   it changes:
   1. MENU: 13 entries instead of 31. Pages that belong together are one entry, shown as tabs at the top of the page:
        Daily work:      Approvals (Review & approve · Late entries · Farm & client time changes) · All hours · Schedule (Bookings · Shifts · Daily headcount)
        People:          People (People · Add person) · Compliance (Compliance · Missing documents · Documents · Training matrix)
        Clients & money: Clients (Clients & logins · Farms & other clients) · Invoices (Invoices · Farm billing by day) · Payroll (Payroll hours · Wagepoint)
        System:          Feedback & analytics · Activity log (Audit log · Login history) · Privacy (Privacy & marketing · Records requests)
                         · Settings (Settings · Terms · Testers) · Office Assistant
      Alerts outbox is the bell (always shown, count when there is something new). Old links (#/lateentries, Needs attention, "Go to"…) still work.
      Office Assistant: the same menu, built from the pages that login is allowed to see (v2-officehelper's list), so nothing opens up.
   2. HEADER: "unscramble.ca", "Download the app" and "Replay tour" sit behind the ⓘ button in the menu bar (with "Show details on every page").
      The top bar keeps: logo, who is signed in, Sign out. The "Saving…" chip moves to the bottom right so it never covers Sign out.
   3. LATE ENTRIES: the "Remove requests" box is only on All hours (it was on both pages).
   4. CLIENTS & LOGINS: one "Open" button per client (instead of Edit · Send invite · Invite code · Merge…). Inside the client:
      the same edit form + logins, then "Invite to log in" (Send invite / Invite code + this client's invites with Resend / Email instead /
      Mark STOP / Revoke) and "Duplicate record?" → "This is a duplicate of…" (the old Merge). The separate "Farm invites" and
      "Invite codes" boxes are gone – each client row shows its latest invite status instead.
   Front end only, no SQL. Loaded LAST in index.html. Turn off: remove the 2 lines (css/simplify.css + this file) in index.html. */
(function(){
'use strict';
if(typeof layout!=='function'||typeof NAV==='undefined'||typeof VIEWS==='undefined'||typeof ACT==='undefined')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function office(){return !!(typeof ME!=='undefined'&&ME&&ME.type==='admin');}
function route(){return (location.hash||'#/home').split('?')[0]||'#/home';}
function navNow(){var u=ME,n=(typeof gateNav==='function'&&gateNav(u))||NAV[u.type]||[];return n.filter(function(x){return x&&x[0]&&x[1];});}

/* ---------- 1. the simpler menu ---------- */
var SIMPLE=[
  ['Daily work',[['Approvals',['#/review','#/lateentries','#/farmchanges']],['All hours',['#/allhours']],['Schedule',['#/creworders','#/shiftsadmin','#/headcount']]]],
  ['People',[['People',['#/people','#/addperson']],['Compliance',['#/compliance','#/missingdocs','#/documents','#/training']]]],
  ['Clients & money',[['Clients',['#/clients','#/firms']],['Invoices',['#/invoicesadmin','#/farmbilling']],['Payroll',['#/payroll','#/wagepoint']]]],
  ['System',[['Feedback & analytics',['#/feedbackadmin','#/analytics']],['Activity log',['#/auditlog','#/logins']],['Privacy',['#/privacy','#/recordsadmin']],['Settings',['#/settings','#/termsadmin','#/testers']],['Office Assistant',['#/assistants']]]]];
var SHORT={'Daily work':'Daily','People':'People','Clients & money':'Clients','System':'System','More':'More'};
var TAB_LABEL={'#/settings':'Settings','#/addperson':'+ Add person'};
var ITEMS=[];SIMPLE.forEach(function(g){g[1].forEach(function(it){ITEMS.push(it);});});
function itemOf(h){for(var i=0;i<ITEMS.length;i++)if(ITEMS[i][1].indexOf(h)>=0)return ITEMS[i];return null;}
var IC_BELL=typeof ICON_BELL==='string'?ICON_BELL:'🔔',IC_CARET=typeof ICON_CARET==='string'?ICON_CARET:'',IC_INFO=typeof ICON_INFO==='string'?ICON_INFO:'ⓘ';
function detailsOn(){try{return typeof detailsOpen==='function'&&detailsOpen();}catch(e){return false;}}
function infoMenu(){var inst=false;try{inst=!!(window.matchMedia&&(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches))||navigator.standalone===true;}catch(e){}
  var items='<a role="menuitemcheckbox" href="#" data-act="togglehelp" class="sx-mi" aria-checked="'+(detailsOn()?'true':'false')+'"><span class="sx-chk" aria-hidden="true">'+(detailsOn()?'✓':'')+'</span>Show details on every page</a>';
  if(ACT.dlapp)items+='<a role="menuitem" href="#" data-act="dlapp" class="sx-mi" id="dlapphdr"'+(inst?' aria-disabled="true"':'')+'><span class="sx-ic" aria-hidden="true">📲</span>'+(inst?'App installed':'Download the app')+'</a>';
  if(ACT.dltour)items+='<a role="menuitem" href="#" data-act="dltour" class="sx-mi" id="dltourhdr"><span class="sx-ic" aria-hidden="true">🧭</span>Replay tour</a>';
  items+='<a role="menuitem" href="https://www.unscramble.ca/" class="sx-mi" title="Go to unscramble.ca (you stay signed in)"><span class="sx-ic" aria-hidden="true">🏠</span>unscramble.ca</a>';
  return '<div class="ogrp sx-info"><button type="button" class="ogrp-btn infobtn sx-infobtn'+(detailsOn()?' sx-on':'')+'" id="ogrp-info" aria-haspopup="true" aria-expanded="false" aria-controls="ogrp-menu-info" data-short="" title="Details, app and help" aria-label="Details, app and help">'+IC_INFO+'</button><div class="ogrp-menu sx-infomenu" id="ogrp-menu-info" role="menu" aria-labelledby="ogrp-info">'+items+'</div></div>';}
function simpleBar(nav,h,unread){var byR={};nav.forEach(function(n){byR[n[0]]=n;});var used={'#/home':1,'#/alerts':1},gi=0,x='';
  var grp=function(name,items){if(!items.length)return '';gi++;var cur=items.some(function(i){return i.cur;});
    return '<div class="ogrp'+(cur?' cur':'')+'" data-g="'+gi+'"><button type="button" class="ogrp-btn" id="ogrp-'+gi+'" aria-haspopup="true" aria-expanded="false" aria-controls="ogrp-menu-'+gi+'" data-short="'+E(SHORT[name]||name)+'"><span class="lbl">'+E(name)+'</span>'+IC_CARET+'</button>'+
      '<div class="ogrp-menu" id="ogrp-menu-'+gi+'" role="menu" aria-labelledby="ogrp-'+gi+'">'+items.map(function(i){return '<a role="menuitem" href="'+E(i.href)+'"'+(i.cur?' class="on" aria-current="page"':'')+'>'+E(i.label)+'</a>';}).join('')+'</div></div>';};
  x+='<a class="ogrp-link'+(h==='#/home'||h==='#/'?' cur':'')+'" href="#/home"'+(h==='#/home'?' aria-current="page"':'')+'>Overview</a>';
  SIMPLE.forEach(function(g){var items=[];g[1].forEach(function(it){var rs=it[1].filter(function(r){return !!byR[r];});if(!rs.length)return;rs.forEach(function(r){used[r]=1;});items.push({label:rs.length===1?byR[rs[0]][1]:it[0],href:rs[0],cur:rs.indexOf(h)>=0});});x+=grp(g[0],items);});
  x+=grp('More',nav.filter(function(n){return !used[n[0]];}).map(function(n){return {label:n[1],href:n[0],cur:n[0]===h};}));
  var bell=byR['#/alerts']?'<a class="mbadge sx-bell'+(h==='#/alerts'?' cur':'')+'" href="#/alerts" title="Alerts outbox" aria-label="Alerts outbox'+(unread?', '+unread+' new':'')+'"'+(h==='#/alerts'?' aria-current="page"':'')+'>'+IC_BELL+(unread?'<span>'+unread+'</span>':'')+'</a>':'';
  return '<nav class="tabs menubar obar" id="obar" aria-label="Office menu"><div class="obar-row">'+x+'</div><div class="obar-r">'+bell+infoMenu()+'</div></nav>';}
function tabStrip(nav,h){var it=itemOf(h);if(!it)return '';var byR={};nav.forEach(function(n){byR[n[0]]=n;});var tabs=it[1].filter(function(r){return !!byR[r];});if(tabs.length<2)return '';
  return '<nav class="sx-tabs" aria-label="'+E(it[0])+'">'+tabs.map(function(r){return '<a href="'+E(r)+'"'+(r===h?' class="on" aria-current="page"':'')+'>'+E(TAB_LABEL[r]||byR[r][1])+'</a>';}).join('')+'</nav>';}
var ol=layout;
layout=function(content){var x=ol.apply(this,arguments);
  try{if(!office())return x;var nav=navNow(),h=route(),unread=0;
    try{unread=(DB.notes||[]).filter(function(n){return (n.to===ME.id||n.to==='admin')&&!n.read;}).length;}catch(e){}
    var m=x.match(/<nav class="tabs menubar obar" id="obar"[\s\S]*?<\/nav>/),bar=m?simpleBar(nav,h,unread):'';if(m)x=x.replace(m[0],function(){return bar;});
    x=x.replace(/<a class="ush ush-hdr"[\s\S]*?<\/a>/,'').replace(/<button type="button" class="small sec dl-hbtn"[\s\S]*?<\/button>/g,'');
    var strip=tabStrip(nav,h);if(strip)x=x.replace('<main id="main">',function(){return '<main id="main">'+strip;});
  }catch(e){try{console.warn('[simplify]',e);}catch(z){}}
  return x;};
/* the "Saving…" chip and the ⓘ menu are styled per role */
var oar=afterRender;afterRender=function(root){oar.apply(this,arguments);try{if(root&&root.id==='app')document.body.classList.toggle('us-office',office());}catch(e){}};
document.addEventListener('keydown',function(e){if((e.key===' '||e.key==='Spacebar')&&e.target&&e.target.closest&&e.target.closest('#obar .sx-infomenu a')){e.preventDefault();e.target.click();}});
/* guided tour: the "App & tour" step now points at the ⓘ menu (opened for that step, closed again when the tour ends) */
function infoOpen(on){try{var g=document.querySelector('#obar .sx-info'),b=g&&g.querySelector('.ogrp-btn');if(!g||!b||g.classList.contains('open')===!!on)return;g.classList.toggle('open',!!on);b.setAttribute('aria-expanded',on?'true':'false');if(on&&typeof obarPlace==='function')obarPlace(g);}catch(e){}}
(function(){if(!window.MutationObserver)return;var mo=new MutationObserver(function(){try{if(!office())return;var c=document.querySelector('#dltour .dlt-card');if(!c)return;var hd=c.querySelector('#dlt-h'),p=c.querySelector('p');if(!hd||!p||hd.textContent!=='App & tour'||p.dataset.sx)return;p.dataset.sx='1';
    p.textContent='Download the app, Replay tour and unscramble.ca are under the ⓘ button at the right end of the menu bar.';infoOpen(true);
    setTimeout(function(){try{window.dispatchEvent(new Event('resize'));}catch(e){}},30);}catch(e){}});
  mo.observe(document.documentElement,{childList:true,subtree:true});
  if(typeof window.dlTourClose==='function'){var odc=window.dlTourClose;window.dlTourClose=function(){var r=odc.apply(this,arguments);if(office())infoOpen(false);return r;};}})();

/* ---------- 2. Late entries: "Remove requests" lives on All hours only ---------- */
function dropById(html,id){try{var t=document.createElement('template');t.innerHTML=html;var el=t.content.getElementById?t.content.getElementById(id):t.content.querySelector('#'+id);if(!el)return html;el.parentNode.removeChild(el);return t.innerHTML;}catch(e){return html;}}
(function(){var ov=VIEWS['admin:lateentries'];if(!ov)return;VIEWS['admin:lateentries']=function(){var x=ov.apply(this,arguments);return office()?dropById(x,'vsreqs'):x;};})();

/* ---------- 3. Clients & logins: one Open button per client; invite + duplicate inside the client ---------- */
function clientById(id){return typeof user==='function'?user(id):null;}
function inviteList(f){if(typeof clInvites!=='function'||!f)return [];return clInvites().filter(function(i){var c=typeof clResolve==='function'?clResolve(i.clientId):clientById(i.clientId);return !!(c&&c.id===f.id);}).reverse();}
function inviteStatus(i){var sent=!!(i.sends||i.sendTo)&&!i.byFarm;if(sent&&typeof fiStatus==='function'){var s=fiStatus(i);return {k:s.k,t:s.t,c:s.c,sent:true};}
  var st=typeof clInviteState==='function'?clInviteState(i):{t:'',c:'s-mut'};var k=i.usedBy?'linked':i.revokedAt?'revoked':(i.expires<today()?'expired':'active');return {k:k,t:st.t,c:st.c,sent:false};}
function latestInviteHtml(f){var L=inviteList(f);if(!L.length)return '';var s=inviteStatus(L[0]);if(s.k==='linked')return '';return '<div class="small sx-invst">Invite: <span class="pill '+E(s.c)+'">'+E(s.t)+'</span></div>';}
function inviteTable(f){var L=inviteList(f);if(!L.length)return '<p class="small muted" id="sxnoinv">No invite yet. Send one by text or email, or make a code to pass on yourself.</p>';
  var live=typeof fiLive==='function'&&fiLive();
  return '<div class="tw"><table class="sx-invtable"><tr><th>Code</th><th>Sent to</th><th>Status</th><th>Expires</th><th></th></tr>'+L.map(function(i){var s=inviteStatus(i),t=i.sendTo||{},acts='';
    var to=[t.name?E(t.name):'',t.phone?E(typeof fiMaskPhone==='function'?fiMaskPhone(t.phone):t.phone)+(typeof fiOptedOut==='function'&&fiOptedOut(t.phone)?' <span class="pill s-bad">STOP</span>':''):'',t.email?E(typeof fiMaskEmail==='function'?fiMaskEmail(t.email):t.email):''].filter(Boolean).join('<br>')||'<span class="muted">–</span>';
    var last=(i.sends||[]).filter(function(x){return x.status==='sent';}).pop(),open=!i.usedBy&&!i.revokedAt&&!(i.expires<today());
    if(s.sent){if(!(s.k==='linked'||s.k==='revoked'||s.k==='registered')&&ACT.firesend){acts+='<button class="small sec" data-act="firesend" data-id="'+E(i.id)+'">Resend</button>'+(t.email&&t.phone?'<button class="small sec" data-act="firesend" data-via="email" data-id="'+E(i.id)+'">Email instead</button>':'')+(t.phone&&typeof fiOptedOut==='function'&&!fiOptedOut(t.phone)&&!live&&ACT.fioptout?'<button class="small sec" data-act="fioptout" data-id="'+E(i.id)+'" title="They replied STOP">Mark STOP</button>':'');}}
    if(open&&s.k!=='registered'&&ACT.clinvrevoke)acts+='<button class="small danger" data-act="clinvrevoke" data-id="'+E(i.id)+'">Revoke</button>';
    return '<tr data-fi="'+E(i.id)+'"><td><code>••••-'+E(i.last4||'')+'</code>'+(i.resendCount?'<div class="small muted">resend '+E(i.resendCount)+'</div>':'')+'<div class="small muted">'+(typeof fmtStamp==='function'?fmtStamp(i.createdAt):E(i.createdAt||''))+'</div></td><td class="small">'+to+'</td><td><span class="pill '+E(s.c)+'">'+E(s.t)+'</span>'+(last?'<div class="small muted">'+(last.channel==='sms'?'text':'email')+' '+(typeof fmtStamp==='function'?fmtStamp(last.at):E(last.at||''))+'</div>':'')+'</td><td class="small">'+E(i.expires||'')+'</td><td><div class="row clbtns">'+acts+'</div></td></tr>';}).join('')+'</table></div>';}
function clientExtras(f){var live=typeof fiLive==='function'&&fiLive();
  var invBtns='<div class="row clbtns sx-invbtns">'+(ACT.fisend?'<button type="button" class="small" data-act="fisend" data-id="'+E(f.id)+'">Send invite</button>':'')+(ACT.clinvite?'<button type="button" class="small sec" data-act="clinvite" data-id="'+E(f.id)+'">Invite code</button>':'')+(!live&&ACT.fioutbox?'<button type="button" class="small sec" data-act="fioutbox">Test outbox</button>':'')+'</div>';
  return '<div class="sx-sect" id="sxinvite"><h3>Invite to log in</h3><p class="small muted">The client gets a single-use code or link; after their sign-up is approved, the login is attached to this client.</p>'+invBtns+inviteTable(f)+'</div>'+
    (ACT.clmergepick?'<div class="sx-sect" id="sxdup"><h3>Duplicate record?</h3><p class="small muted">If this client is already in the list under another number, fold this record into that one. Sites, invoices, orders and logins move; nothing is deleted.</p><button type="button" class="small sec" data-act="clmergepick" data-id="'+E(f.id)+'">This is a duplicate of…</button></div>':'');}
(function(){var oe=ACT.cledit;if(!oe)return;ACT.cledit=function(el){var r=oe.apply(this,arguments);
  try{var f=clientById(el&&el.dataset&&el.dataset.id);var m=document.querySelector('#modal .modal');if(!office()||!f||!m||m.querySelector('#sxinvite'))return r;
    m.insertAdjacentHTML('beforeend',clientExtras(f));if(typeof stackTables==='function')stackTables(m);}catch(e){try{console.warn('[simplify clients]',e);}catch(z){}}
  return r;};})();
/* buttons in the panel open another pop-up: never throw away unsaved client edits silently */
document.addEventListener('click',function(e){var t=e.target&&e.target.closest&&e.target.closest('#modal .sx-sect [data-act]');if(!t)return;var m=document.getElementById('modal');
  if(m&&m._dirty){e.preventDefault();e.stopPropagation();if(typeof toast==='function')toast('Save your client changes first (Save client), or close and reopen the client.');}},true);
/* Mark STOP only re-draws the page behind the panel: refresh the panel's invite list too */
(function(){var oo=ACT.fioptout;if(!oo)return;ACT.fioptout=function(el){var r=oo.apply(this,arguments);try{var sect=document.querySelector('#modal #sxinvite');if(sect){var i=(DB.clientInvites||[]).filter(function(x){return x.id===el.dataset.id;})[0],f=i&&(typeof clResolve==='function'?clResolve(i.clientId):clientById(i.clientId));
    if(f){var d=document.createElement('div');d.innerHTML=clientExtras(f);var fresh=d.querySelector('#sxinvite');if(fresh){sect.parentNode.replaceChild(fresh,sect);if(typeof stackTables==='function')stackTables(fresh);}}}}catch(e){}return r;};})();
/* the "invite sent" pop-up pointed at the old Farm invites box */
(function(){var om=modal;if(typeof om!=='function')return;modal=function(h){var a=[].slice.call(arguments);if(office()&&typeof h==='string')a[0]=h.replace('Track it under <b>Farm invites</b> on this page.','Its status shows on the client\'s row and inside the client (Open → Invite to log in).');return om.apply(this,a);};})();
(function(){var ov=VIEWS['admin:clients'];if(!ov)return;VIEWS['admin:clients']=function(){var x=ov.apply(this,arguments);if(!office())return x;
  try{var t=document.createElement('template');t.innerHTML=x;var c=t.content;
    [].forEach.call(c.querySelectorAll('#clienttable tr[data-client]'),function(tr){var b=tr.querySelector('.clbtns');if(!b)return;var first=b.querySelector('button[data-act="cledit"]')||b.querySelector('button[data-id]');var id=first&&first.dataset.id;if(!id)return;
      b.innerHTML='<button class="small" data-act="cledit" data-id="'+E(id)+'">Open</button>';var f=clientById(id);var tds=tr.querySelectorAll('td');if(f&&tds.length>=5)tds[4].insertAdjacentHTML('beforeend',latestInviteHtml(f));});
    ['ficard','clinvcard'].forEach(function(id){var el=c.getElementById?c.getElementById(id):c.querySelector('#'+id);if(el)el.parentNode.removeChild(el);});
    x=t.innerHTML;
    x=x.replace('Open Edit and enter one of its farm codes','Open the client and enter one of its farm codes').replace('open a client\'s Edit to add them','open a client and tick them under Site codes')
       .replace('tick its other sites under Edit – or use <b>Merge…</b> to fold','tick its other sites – or use <b>This is a duplicate of…</b> to fold').replace('change <b>Client no.</b> under Edit','change <b>Client no.</b> inside the client')
       .replace('its main one – change it under Edit)','its main one – change it inside the client)');
  }catch(e){try{console.warn('[simplify clients]',e);}catch(z){}}
  return x;};})();
})();
