/* v2-declutter.js – simpler screens (owner feedback Oct 4, 2026). Nothing is removed; things are tucked away:
   - One "Menu" dropdown (grouped) instead of a long row of tabs.
   - Long help paragraphs and info banners sit behind a small "ⓘ Details" toggle. The ⓘ button in the menu bar opens or
     closes all details at once (remembered in this browser).
   - Client home: the main action and the period total on top; everything else in collapsible sections.
   - Office home: "Needs attention" on top; the numbers are a dropdown; long lists are collapsible sections.
   - Office Settings: each settings card is a collapsible section. TEST ONLY. */
'use strict';
var DETAILS_KEY='us-test-details-open';
function detailsOpen(){try{return localStorage.getItem(DETAILS_KEY)==='1';}catch(e){return false;}}
var MENU_GROUPS=[['Daily work',['#/review','#/creworders','#/farmchanges','#/lateentries','#/shiftsadmin','#/alerts']],
  ['People & compliance',['#/people','#/compliance','#/missingdocs','#/documents','#/training','#/testers','#/termsadmin']],
  ['Clients & money',['#/firms','#/invoicesadmin','#/payroll','#/wagepoint','#/recordsadmin']],
  ['System',['#/feedbackadmin','#/analytics','#/auditlog','#/logins','#/privacy','#/settings']]];
function menuSelect(nav,h,unread){var used={},grp='';
  var optOf=function(n){used[n[0]]=1;var lab=n[1]+(n[0]==='#/alerts'&&unread?' ('+unread+' new)':'');return '<option value="'+esc(n[0])+'"'+(n[0]===h?' selected':'')+'>'+esc(lab)+'</option>';};
  if(nav.length>8&&ME&&ME.type==='admin'){MENU_GROUPS.forEach(function(g){var items=nav.filter(function(n){return g[1].indexOf(n[0])>=0;});if(items.length)grp+='<optgroup label="'+esc(g[0])+'">'+items.map(optOf).join('')+'</optgroup>';});
    var rest=nav.filter(function(n){return !used[n[0]];});if(rest.length)grp+='<optgroup label="More">'+rest.map(optOf).join('')+'</optgroup>';}
  else grp=nav.map(optOf).join('');
  if(!nav.some(function(n){return n[0]===h;}))grp='<option value="" selected>Menu…</option>'+grp;
  return '<nav class="tabs menubar" aria-label="Menu"><label class="menulab" for="navsel">Menu</label><select id="navsel" class="navsel" aria-label="Menu">'+grp+'</select>'+(unread&&h!=='#/alerts'?'<a class="mbadge" href="#/alerts" title="Alerts">🔔 '+unread+'</a>':'')+'<button type="button" class="small sec infobtn" data-act="togglehelp" aria-pressed="'+detailsOpen()+'" title="Show or hide all details">ⓘ</button></nav>';}

/* ---------- office: top menu bar with group headings (owner request 13:33) ---------- */
var ICON_BELL='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>';
var ICON_INFO='<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
var ICON_CARET='<svg class="ic caret" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
var OBAR_SHORT={'Daily work':'Daily','People & compliance':'People','Clients & money':'Clients','System':'System','More':'More'};
function officeBar(nav,h,unread){var used={'#/home':1},gi=0;
  var lab=function(n){return esc(n[1])+(n[0]==='#/alerts'&&unread?' <span class="cnt">'+unread+'</span>':'');};
  var grp=function(name,items){if(!items.length)return '';gi++;var cur=items.some(function(n){return n[0]===h;});items.forEach(function(n){used[n[0]]=1;});
    return '<div class="ogrp'+(cur?' cur':'')+'" data-g="'+gi+'"><button type="button" class="ogrp-btn" id="ogrp-'+gi+'" aria-haspopup="true" aria-expanded="false" aria-controls="ogrp-menu-'+gi+'" data-short="'+esc(OBAR_SHORT[name]||name)+'"><span class="lbl">'+esc(name)+'</span>'+ICON_CARET+'</button>'+
    '<div class="ogrp-menu" id="ogrp-menu-'+gi+'" role="menu" aria-labelledby="ogrp-'+gi+'">'+items.map(function(n){return '<a role="menuitem" href="'+esc(n[0])+'"'+(n[0]===h?' class="on" aria-current="page"':'')+'>'+lab(n)+'</a>';}).join('')+'</div></div>';};
  var x='<a class="ogrp-link'+(h==='#/home'||h==='#/'?' cur':'')+'" href="#/home"'+(h==='#/home'?' aria-current="page"':'')+'>Overview</a>';
  MENU_GROUPS.forEach(function(g){x+=grp(g[0],nav.filter(function(n){return g[1].indexOf(n[0])>=0;}));});
  var rest=nav.filter(function(n){return !used[n[0]];});x+=grp('More',rest);
  return '<nav class="tabs menubar obar" id="obar" aria-label="Office menu"><div class="obar-row">'+x+'</div><div class="obar-r">'+(unread&&h!=='#/alerts'?'<a class="mbadge" href="#/alerts" title="Alerts outbox" aria-label="'+unread+' new alerts">'+ICON_BELL+'<span>'+unread+'</span></a>':'')+'<button type="button" class="infobtn" data-act="togglehelp" aria-pressed="'+detailsOpen()+'" title="Show or hide all details" aria-label="Show or hide all details">'+ICON_INFO+'</button></div></nav>';}
function obarClose(except){[].forEach.call(document.querySelectorAll('#obar .ogrp.open'),function(g){if(g===except)return;g.classList.remove('open');var b=g.querySelector('.ogrp-btn');if(b)b.setAttribute('aria-expanded','false');});}
function obarPlace(g){var b=g.querySelector('.ogrp-btn'),m=g.querySelector('.ogrp-menu'),bar=document.getElementById('obar');if(!b||!m||!bar)return;var r=b.getBoundingClientRect(),br=bar.getBoundingClientRect(),vw=document.documentElement.clientWidth;
  m.style.top=Math.round(br.bottom)+'px';if(vw<=640){m.style.left='8px';m.style.right='8px';m.style.width='auto';}else{m.style.right='auto';m.style.width='';var w=Math.max(m.offsetWidth,220);m.style.left=Math.round(Math.max(8,Math.min(r.left,vw-w-8)))+'px';}}
document.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;var b=t.closest('#obar .ogrp-btn');
  if(b){e.preventDefault();var g=b.parentNode,open=!g.classList.contains('open');obarClose(g);g.classList.toggle('open',open);b.setAttribute('aria-expanded',String(open));if(open){try{b.scrollIntoView({block:'nearest',inline:'nearest'});}catch(_){}obarPlace(g);var f=g.querySelector('.ogrp-menu a');if(f&&e.detail===0)f.focus();}return;}
  if(t.closest('#obar .ogrp-menu a')){obarClose();return;}
  if(!t.closest('#obar .ogrp-menu'))obarClose();},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'||e.key==='Esc'){var g=document.querySelector('#obar .ogrp.open');if(g){obarClose();var b=g.querySelector('.ogrp-btn');if(b)b.focus();}}
  if((e.key==='ArrowDown'||e.key==='ArrowUp')&&e.target.closest&&e.target.closest('#obar .ogrp-menu')){var as=[].slice.call(e.target.closest('.ogrp-menu').querySelectorAll('a')),i=as.indexOf(e.target);if(i>=0){e.preventDefault();as[(i+(e.key==='ArrowDown'?1:-1)+as.length)%as.length].focus();}}});
window.addEventListener('resize',function(){var g=document.querySelector('#obar .ogrp.open');if(g)obarPlace(g);});
document.addEventListener('scroll',function(e){if(e.target&&e.target.classList&&e.target.classList.contains('obar-row')){var g=document.querySelector('#obar .ogrp.open');if(g)obarPlace(g);}},true);
window.addEventListener('scroll',function(){var g=document.querySelector('#obar .ogrp.open');if(g)obarPlace(g);});
(function(){var ol=layout;layout=function(content){var x=ol(content);var u=ME;if(!u)return x;var m=x.match(/<nav class="tabs">[\s\S]*?<\/nav>/);if(!m)return x;
  var nav=gateNav(u)||NAV[u.type]||[],h=location.hash.split('?')[0]||'#/home';var unread=DB.notes.filter(function(n){return (n.to===u.id||(u.type==='admin'&&n.to==='admin'))&&!n.read;}).length;
  return x.replace(m[0],u.type==='admin'?officeBar(nav,h,unread):menuSelect(nav,h,unread));};})();
document.addEventListener('change',function(e){var t=e.target;if(t&&t.id==='navsel'&&t.value){location.hash=t.value;}
  if(t&&t.classList&&t.classList.contains('chipsel')){var o=t.options[t.selectedIndex];var ds=JSON.parse(o.getAttribute('data-ds')||'{}');var a=ds.act;if(ACT[a]){if(!actionAllowed(a,'act')){denied(a);return;}ACT[a]({dataset:ds});}}});
/* rows of filter chips → one dropdown */
var CHIP_ACTS=['cofilter','fcfilter','lfilter','cotab'];
function chipsToSelect(root){[].slice.call(root.querySelectorAll('.row')).forEach(function(r){var b=[].slice.call(r.children).filter(function(x){return x.tagName==='BUTTON'&&CHIP_ACTS.indexOf(x.dataset.act)>=0;});if(b.length<3||b.length!==r.children.length)return;
  var sel=document.createElement('select');sel.className='chipsel';sel.setAttribute('aria-label','Show');sel.innerHTML=b.map(function(x){var ds={};Object.keys(x.dataset).forEach(function(k){ds[k]=x.dataset[k];});return '<option data-ds="'+esc(JSON.stringify(ds))+'"'+(x.classList.contains('sec')?'':' selected')+'>'+esc(x.textContent)+'</option>';}).join('');
  var lab=document.createElement('label');lab.className='chiplab';lab.textContent='Show ';r.innerHTML='';r.classList.add('chiprow');lab.appendChild(sel);r.appendChild(lab);});}
ACT.togglehelp=function(){try{localStorage.setItem(DETAILS_KEY,detailsOpen()?'0':'1');}catch(e){}render();};

/* ---------- help text behind "ⓘ Details" ---------- */
function wrapHelp(root){var main=root.id==='app'?root.querySelector('main'):root;if(!main)return;var open=detailsOpen();
  [].slice.call(main.querySelectorAll('p.small, p.muted, div.alert.info')).forEach(function(el){
    if(el.closest('details,table,.ordcard,.invcard,.login-wrap,.totals,summary,.oc-grid'))return;if(el.querySelector('input,select,button,textarea'))return;
    var t=(el.textContent||'').trim();if(t.length<70)return;
    var d=document.createElement('details');d.className='help';if(open)d.open=true;d.innerHTML='<summary title="Details">ⓘ Details</summary>';el.parentNode.insertBefore(d,el);d.appendChild(el);});
  if(open)[].forEach.call(main.querySelectorAll('details.sect'),function(d){d.open=true;});}
function sect(title,inner,o){o=o||{};return '<details class="sect"'+(o.id?' id="'+o.id+'"':'')+((o.open||detailsOpen())?' open':'')+'><summary>'+title+'</summary><div class="sect-body">'+inner+'</div></details>';}
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{if(root&&ME){if(root.id==='app'&&ME.type==='firm'&&/^#\/(home)?$/.test((location.hash||'#/home').split('?')[0]))groupFirmHome(root);if(root.id==='app'&&ME.type==='admin'&&(location.hash||'').split('?')[0]==='#/settings')groupSettings(root);chipsToSelect(root);wrapHelp(root);}}catch(e){logError(e);}};})();

/* ---------- client home: main action + period total on top, the rest in sections ---------- */
function groupFirmHome(root){var main=root.querySelector('main');if(!main||main.dataset.grouped)return;main.dataset.grouped='1';
  var kids=[].slice.call(main.children),h1=main.querySelector('h1'),order=main.querySelector('#ordercard'),tot=main.querySelector('.card.totals'),agr=main.querySelector('#firmagr'),inv=main.querySelector('#clientinvoices'),blocked=main.querySelector('#farmblocked');
  if(!h1)return;var signed=agr&&!agr.classList.contains('hl');
  var g={hours:[],shifts:[],agr:[],inv:[],other:[]},cur='pre',shiftsH=[].filter.call(main.querySelectorAll('h2'),function(x){return /^Shifts at your/.test(x.textContent);})[0];
  kids.forEach(function(el){if(el===h1){cur='hours';return;}if(el===order||el===tot||el===blocked)return;
    if(el===agr){if(signed)g.agr.push(el);return;}if(el.id==='clienttypeline'){g.agr.push(el);return;}if(el===inv){g.inv.push(el);return;}
    if(el===shiftsH)cur='shifts';
    if(cur==='shifts')g.shifts.push(el);else if(cur==='hours')g.hours.push(el);else g.other.push(el);});
  var top=document.createElement('div');top.className='hometop';
  main.insertBefore(top,main.firstChild);top.appendChild(h1);if(blocked)top.appendChild(blocked);if(agr&&!signed)top.appendChild(agr);if(order)top.appendChild(order);if(tot)top.appendChild(tot);
  var mk=function(title,els,id){if(!els.length)return;var d=document.createElement('details');d.className='sect';if(id)d.id=id;if(detailsOpen())d.open=true;d.innerHTML='<summary>'+title+'</summary>';var b=document.createElement('div');b.className='sect-body';d.appendChild(b);els.forEach(function(e){b.appendChild(e);});main.appendChild(d);};
  mk(clientWord('Hours and billing by day',ME),g.hours,'sect-hours');mk(clientWord('Shifts at your sites (propose a time change)',ME),g.shifts,'sect-shifts');mk('Invoices and interest <a class="small" href="#/invoices">My invoices →</a>',g.inv,'sect-inv');mk('Agreement, rates and industry',g.agr,'sect-agr');g.other.forEach(function(e){main.appendChild(e);});}

/* ---------- office home: needs attention first, numbers as a dropdown, lists collapsible ---------- */
VIEWS['admin:home']=function(){var pendDocs=DB.docs.filter(function(d){return d.status==='pending';}).length,bl=blockedList(),ex=expiringList();
  var inv=DB.invoices.filter(function(i){return !i.test;}),flags=adminFlags().map(function(f){if(/^#\//.test(f.h||'')&&!/^s-/.test(f.c||''))return {t:f.t,c:'s-warn',h:esc(f.c||'')+' <a href="'+esc(f.h)+'">Open →</a>'};return f;}),co=(DB.crewOrders||[]).filter(function(o){return o.pending;}).length;
  var nums=[['Crew orders waiting',co,'#/creworders'],['Missing documents to follow up',(typeof missingDocsOpenCount==='function'?missingDocsOpenCount():0),'#/missingdocs'],['Uploads to review',pendDocs,'#/review'],['Accounts to approve',pendingAccounts().length,'#/review'],['Blocked right now',bl.length,'#/compliance'],['Expiring in 30 days',ex.filter(function(e){return e.left>0&&e.left<=30;}).length,'#/compliance'],['Expired',ex.filter(function(e){return e.left<=0;}).length,'#/compliance'],['Invoices to approve',inv.filter(function(i){return i.status==='Submitted';}).length,'#/invoicesadmin'],['Ready for Wagepoint',users('employee').filter(function(u){return u.approved&&registrationComplete(u)&&!(u.wagepoint&&u.wagepoint.added);}).length,'#/wagepoint'],['New feedback',DB.feedback.filter(function(f){return f.status==='New';}).length,'#/feedbackadmin']];
  var x='<h1>Office overview</h1>';
  x+='<div class="card" id="needsattention"><h2 style="margin-top:0">Needs attention'+(flags.length?' <span class="pill s-pend">'+flags.length+'</span>':'')+'</h2>'+(flags.length?'<ul class="check">'+flags.slice(0,5).map(function(f){return '<li><span class="pill '+f.c+'">'+esc(f.t)+'</span><div>'+f.h+'</div></li>';}).join('')+'</ul>'+(flags.length>5?sect('Show '+(flags.length-5)+' more','<ul class="check">'+flags.slice(5).map(function(f){return '<li><span class="pill '+f.c+'">'+esc(f.t)+'</span><div>'+f.h+'</div></li>';}).join('')+'</ul>'):''):'<p class="muted">Nothing right now.</p>')+'</div>';
  x+='<div class="row quickpick"><label for="numsel"><b>Go to</b></label><select id="numsel" class="navsel2" aria-label="Go to">'+'<option value="">Counts – choose…</option>'+nums.map(function(n){return '<option value="'+n[2]+'">'+esc(n[0])+': '+n[1]+'</option>';}).join('')+'</select></div>';
  x+=sect('Expiring in the next 30 days and expired ('+ex.filter(function(e){return e.left<=30;}).length+')',expTable(ex.filter(function(e){return e.left<=30;})),{id:'sect-exp'});
  x+=sect('Blocked list – who and why ('+bl.length+')',blockedTable(bl),{id:'sect-blocked'});
  return x;};
document.addEventListener('change',function(e){if(e.target&&e.target.id==='numsel'&&e.target.value)location.hash=e.target.value;});

/* ---------- office Settings: every card collapsible ---------- */
function groupSettings(root){var main=root.querySelector('main');if(!main||main.dataset.grouped)return;main.dataset.grouped='1';
  [].slice.call(main.querySelectorAll(':scope > .card, :scope > div > .card')).forEach(function(c){var h=c.querySelector(':scope > h2, :scope > h3');if(!h)return;var d=document.createElement('details');d.className='sect';if(detailsOpen())d.open=true;if(c.id){d.id='sect-'+c.id;}var s=document.createElement('summary');s.innerHTML=h.innerHTML;h.remove();c.parentNode.insertBefore(d,c);d.appendChild(s);d.appendChild(c);c.classList.add('sect-body');});}

/* ---------- client agreement DRAFT banner: one short line ---------- */
if(typeof icsaBanner==='function')icsaBanner=function(){return '<div class="alert warn draftline" id="icsadraft" role="note"><b>'+ICSA_DRAFT_BANNER+'.</b> Conversion fee 6(e): [to be set by owner].</div>';};
