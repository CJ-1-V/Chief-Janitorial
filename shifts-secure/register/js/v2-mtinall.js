/* v2-mtinall.js – mtinall2 (owner Oct 17 2026, 5:19 PM + 10:43 PM). TEST COPY.
   5:19 PM "Instead of Manual hours, add the Manual hours feature right into All hours … open a farm, give an option there to add manual
   entries, and let me see manual entries by farm. Remove the Manual hours button completely."
   10:43 PM "I want the manual hours option to appear after the boxes of the farms come up … after the selection of the farm. I also want
   another box to appear every day that will be to add any missing farms for that day … and when the farm is added another unknown box
   appears to add another farm."
   - The "Manual hours" menu item is gone for everyone; #/manualtime (old bookmarks) opens All hours.
   - All hours boxes: every day of the chosen From–To range is shown (newest first, not after today; a day with no sign-ins shows
     just the add box). After that day's farm boxes comes a dashed "+ Add farm" box: pick any active farm / site code not already
     shown that day (the day can be changed too) → it appears as a normal box for that day (0 people) and a fresh "+ Add farm" box
     follows. Added boxes stay for this session (page state); once a farm has an entry that day it shows from the data anyway.
     Ranges longer than 62 days show only days with sign-ins / added farms (the add box then lets you pick any day).
   - Tap a farm box (with sign-ins or added) → "+ Add manual entry" (site + day filled in) and "Manual entries – <farm>" (every manual
     entry of that farm, all dates, filters All / Approved / Waiting / Voided) with the same History / Change / Void buttons.
   - It IS today's Manual hours: the same form (one worker / several workers, subcontractor companies group), the same rules
     (quarter hours, no overlap, not in the future, 12 h warning, payroll-export / invoiced warnings), same storage (DB.time manual
     entries → payroll, billing, headcount), same audit and history, same roles (Owner / Admin / Billing (payroll) add and change;
     others only see the list, and get no "+ Add farm" box). Form and list come from v2-manualtime.js unchanged.
   Front end only, no SQL. Load after v2-hourboxes.js and v2-manualtime.js. Undo: remove the script + css lines in index.html. */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||window.MT_OFF)return;
var MTV=VIEWS['admin:manualtime'],AHV=VIEWS['admin:allhours'];if(!MTV||!AHV)return;
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function S(){return PAGE_STATE.mia=PAGE_STATE.mia||{};}
function farmOf(code){return typeof firmOfSite==='function'?firmOfSite(code):(typeof siteFirm==='function'?siteFirm(code):null);}
function farmLabel(f){if(!f)return 'No farm';var codes=(DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;});return helper()?codes.join(', '):(f.realName||f.name)+(codes.length?' ('+codes.join(', ')+')':'');}

/* ---------- 1. no more "Manual hours" menu item ---------- */
function unNav(){try{if(typeof NAV!=='undefined'&&NAV.admin)for(var i=NAV.admin.length-1;i>=0;i--)if(NAV.admin[i][0]==='#/manualtime')NAV.admin.splice(i,1);
  if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){var L=g[1];if(L&&L.indexOf)for(var j=L.length-1;j>=0;j--)if(L[j]==='#/manualtime')L.splice(j,1);});}catch(e){}}
unNav();
/* NAV.admin is a getter (v2-officehelper / v2-headcount return filtered copies) – filter the result every time it is read */
(function(){try{var d=Object.getOwnPropertyDescriptor(NAV,'admin');if(!d)return;var get=d.get?d.get:function(){return d.value;},set=d.set?d.set:function(v){d.value=v;};
  Object.defineProperty(NAV,'admin',{configurable:true,enumerable:true,get:function(){var L=get.call(NAV);return (L||[]).some(function(n){return n[0]==='#/manualtime';})?L.filter(function(n){return n[0]!=='#/manualtime';}):L;},set:function(v){set.call(NAV,v);}});}catch(e){}})();
VIEWS['admin:manualtime']=function(){setTimeout(function(){if(/^#\/manualtime/.test(location.hash||''))location.replace('#/allhours');},0);
  return '<h1>Manual hours</h1><p class="muted" id="miamoved">Manual hours are now in <a href="#/allhours">All hours</a>: tap a farm box (or “+ Add farm”).</p>';};
if(typeof gateRoute==='function'){var ogr=gateRoute;gateRoute=function(h){if(ME&&ME.type==='admin'&&/^#\/manualtime(\?|$)/.test(h||'')){setTimeout(function(){if(/^#\/manualtime/.test(location.hash||''))location.replace('#/allhours');},0);return ogr.call(this,'#/allhours');}return ogr.apply(this,arguments);};}
/* links to the old page anywhere → All hours */
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('a[href="#/manualtime"]');if(a){e.preventDefault();go('#/allhours');}},true);

/* ---------- pieces of today's Manual hours page (same code, same rules) ---------- */
function parts(){var d=document.createElement('div');d.innerHTML=MTV();var h=d.querySelector('h1');if(h)h.remove();var p=d.querySelector('p.small.muted');if(p&&!p.closest('.card'))p.remove();
  var form=d.querySelector('#mtformcard');var fh=form?form.outerHTML:'';if(form)form.remove();
  var list=d.querySelector('#mtlist');var tw=list&&list.closest('.tw');var lh=tw?tw.outerHTML:'';if(tw)tw.remove();
  var flt=d.querySelector('.mt-filters');var fl=flt?flt.outerHTML:'';if(flt)flt.remove();
  return {form:fh,list:lh,filters:fl,notes:d.innerHTML,can:!!fh};}
function rowCode(tr){var c=tr.cells[1];return c?c.textContent.split(' – ')[0].trim():'';}
function filterList(listHtml,firmId,code){if(!listHtml)return {h:'',n:0};var d=document.createElement('div');d.innerHTML=listHtml;var n=0;
  [].forEach.call(d.querySelectorAll('#mtlist tr[data-id]'),function(tr){var c=rowCode(tr),f=farmOf(c);var keep=code?c===code:(!firmId||(f&&f.id===firmId)||(firmId==='-'&&!f));if(keep)n++;else tr.remove();});
  var t=d.querySelector('#mtlist');if(t&&!n){var r=t.insertRow(-1);r.innerHTML='<td colspan="10" class="muted">No manual entries here.</td>';}
  return {h:d.innerHTML,n:n};}
function count(){return (DB.time||[]).filter(function(t){return t.manual&&!t.test;}).length;}

/* ---------- add: the same form in a window, farm / day filled in ---------- */
function recent(code){var f=farmOf(code),codes=f?(DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;}):[code],from=addDays(today(),-30),seen={},L=[];
  (DB.time||[]).forEach(function(t){if(t.test||!t.userId||seen[t.userId]||codes.indexOf(t.site)<0||t.date<from)return;var u=user(t.userId);if(!u||['employee','worker','sub'].indexOf(u.type)<0)return;seen[t.userId]=1;L.push(u);});
  return L.sort(function(a,b){return a.name<b.name?-1:1;});}
function openAdd(pre){var P=parts();if(!P.can){toast('Only the Owner, an Admin or Payroll (billing) can add manual hours.');return;}S().pre=pre||{};
  var f=pre&&pre.site?farmOf(pre.site):null;
  modal('<div id="miamodal">'+(pre&&pre.site?'<p class="small mia-pre">For <b>'+E(pre.site)+(f&&!helper()?' – '+E(f.realName||f.name):'')+'</b>'+(pre.date?' on <b>'+E(pre.date)+'</b>':'')+' (you can change both).</p>':'')+P.form+'</div>');
  var m=document.getElementById('miamodal');if(!m)return;var fm=m.querySelector('form');if(!fm)return;
  if(pre&&pre.site&&fm.site){fm.site.value=pre.site;}
  if(pre&&pre.date&&fm.date&&pre.date<=today())fm.date.value=pre.date;
  var w=fm.querySelector('select[name=wid]');if(w&&pre&&pre.site){var R=recent(pre.site);if(R.length){var g=document.createElement('optgroup');g.label='Worked at '+(f&&!helper()?(f.realName||f.name):pre.site)+' (last 30 days)';
    R.forEach(function(u){var o=document.createElement('option');o.value=u.id;o.textContent=u.name;g.appendChild(o);});w.insertBefore(g,w.children[1]||null);}}
  try{fm.dispatchEvent(new Event('change',{bubbles:true}));}catch(e){}}
ACT.miaadd=function(el){openAdd(el&&el.dataset&&el.dataset.site?{site:el.dataset.site,date:el.dataset.date||''}:{});};
(function(){var om=ACT.mtmode;ACT.mtmode=function(el){if(document.getElementById('miamodal')){PAGE_STATE.mtMode=el.dataset.m==='bulk'?'bulk':'single';openAdd(S().pre);return;}return om.apply(this,arguments);};})();
(function(){var of=FORMS.manualtime;FORMS.manualtime=function(f,d){var n=count(),inModal=!!(f&&f.closest&&f.closest('#miamodal'));var r=of.apply(this,arguments);if(inModal&&count()>n)closeModal();return r;};})();
ADMIN_ONLY_ACT.push('miaadd');ADMIN_ONLY_FORM.push('miaaddfarm');

/* ---------- open farm box: add + that farm's manual entries ---------- */
var DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dayLabel(d){var p=String(d).split('-');if(p.length<3)return d;var x=new Date(+p[0],+p[1]-1,+p[2]);return DN[x.getDay()]+' '+MN[x.getMonth()]+' '+x.getDate()+(d===today()?' (today)':'');}
function siteName(code){var f=farmOf(code);return f&&!helper()?(f.realName||f.name||''):'';}
function stack(el){try{if(el&&typeof stackTables==='function')stackTables(el);}catch(e){}}
function boxSel(){var s=PAGE_STATE.hb&&PAGE_STATE.hb.sel;if(!s)return null;var p=String(s).split('|');return {date:p[0],site:p.slice(1).join('|')};}
function extras(site,date){var P=parts(),f=farmOf(site),F=filterList(P.list,f?f.id:'',f?'':site),lab=f?farmLabel(f):site;
  var bar='<div id="miabox" class="mia-box row">'+(P.can?'<button class="small" data-act="miaadd" data-site="'+E(site)+'" data-date="'+E(date)+'" id="miaaddbox">+ Add manual entry</button>':'')+'<a class="small" href="#miafarmlist">Manual entries – '+E(lab)+' ('+F.n+')</a></div>';
  var sec='<div class="card mia-farm" id="miafarmlist"><h3>Manual entries – '+E(lab)+' <span class="small muted">('+F.n+', all dates)</span></h3>'+
    (P.can?'<p><button class="small" data-act="miaadd" data-site="'+E(site)+'" data-date="'+E(date)+'">+ Add manual entry for '+E(site)+' on '+E(dayLabel(date))+'</button></p>':'<div class="alert info small" id="mtnoperm">Only the Owner, an Admin or Payroll (billing) can add, change or void manual hours. You can see the list.</div>')+
    P.notes+(P.filters||'')+F.h+'</div>';
  return {bar:bar,sec:sec};}
/* hourboxes' own open view (a farm with sign-ins that day) */
function boxExtras(){var w=document.getElementById('hbwrap');if(!w||document.getElementById('miabox'))return;var head=w.querySelector('.cb-head');var b=boxSel();if(!head||!b||!b.site)return;
  var X=extras(b.site,b.date);head.insertAdjacentHTML('afterend',X.bar);
  var tb=document.getElementById('vshtable'),tw=tb&&(tb.closest('.tw')||tb);if(!tw)return;tw.insertAdjacentHTML('afterend',X.sec);stack(document.getElementById('miafarmlist'));}

/* ---------- "+ Add farm" boxes on every day ---------- */
function canAdd(){var s=S();if(s.can==null||s.canAt!==(ME&&ME.id)){s.can=parts().can;s.canAt=ME&&ME.id;}return s.can;}
function range(){var v=PAGE_STATE.vsh||{},to=v.to||today(),from=v.from||addDays(to,-13);if(to>today())to=today();return {from:from,to:to};}
function allSites(){var L=typeof companySites==='function'?companySites({withFirm:true,skipPractice:true,activeOnly:true}):(DB.sites||[]).filter(function(s){return s.firmId&&s.code!=='TEST-PRACTICE'&&s.active!==false;});
  return L.slice().sort(function(a,b){return a.code<b.code?-1:1;});}
function addBox(d){return '<button type="button" class="cb-box mia-addbox" data-miaday="'+E(d)+'" aria-label="Add a farm for '+E(dayLabel(d))+'"><span class="cb-code">+ Add farm</span><span class="cb-l">missing farm for this day</span></button>';}
function addedBox(d,site){var nm=siteName(site);return '<button type="button" class="cb-box mia-added" data-miahb="'+E(d+'|'+site)+'" aria-label="'+E(site+', '+dayLabel(d)+': added, 0 people')+'"><span class="cb-code">'+E(site)+'</span><span class="cb-n">0</span><span class="cb-l">people</span><span class="cb-e">added – tap to add hours</span>'+(nm?'<span class="cb-f">'+E(nm)+'</span>':'')+'</button>';}
function decorate(){var w=document.getElementById('hbwrap');if(!w||w.dataset.mia)return;w.dataset.mia='1';
  if(w.querySelector('.cb-head'))return;                         /* hourboxes' open view – boxExtras() */
  var s=S();
  /* native boxes now on screen, by day */
  var nat={};[].forEach.call(w.querySelectorAll('[data-hb]'),function(b){var p=b.getAttribute('data-hb').split('|'),d=p[0];(nat[d]=nat[d]||{})[p.slice(1).join('|')]=b.closest('.hb-day');});
  s.added=(s.added||[]).filter(function(a){return !(nat[a.date]&&nat[a.date][a.site]);});   /* has data now → shows by itself */
  if(s.open){var o=s.open;if(nat[o.date]&&nat[o.date][o.site]){s.open=null;PAGE_STATE.hb=PAGE_STATE.hb||{};PAGE_STATE.hb.sel=o.date+'|'+o.site;setTimeout(function(){render();},0);return;}openView(w,o);return;}
  if(!canAdd()){return;}
  var R=range(),days={},n=0;for(var d=R.to;d>=R.from&&n<400;d=addDays(d,-1)){days[d]=1;n++;}
  var big=n>62;var want=Object.keys(big?{}:days);Object.keys(nat).forEach(function(d){if(want.indexOf(d)<0)want.push(d);});s.added.forEach(function(a){if(want.indexOf(a.date)<0)want.push(a.date);});
  want.sort().reverse();
  var none=[].filter.call(w.querySelectorAll('p.muted'),function(p){return /No hours in this range/.test(p.textContent);});none.forEach(function(p){p.remove();});
  var secBy={};[].forEach.call(w.querySelectorAll('.hb-day'),function(sec){var b=sec.querySelector('[data-hb]');if(b)secBy[b.getAttribute('data-hb').split('|')[0]]=sec;});
  want.forEach(function(d){var sec=secBy[d];
    if(!sec){sec=document.createElement('section');sec.className='hb-day mia-day';sec.innerHTML='<h3>'+E(dayLabel(d))+' <small>no sign-ins</small></h3><div class="cb-grid"></div>';}
    var g=sec.querySelector('.cb-grid');var h='';s.added.filter(function(a){return a.date===d;}).forEach(function(a){h+=addedBox(d,a.site);});g.insertAdjacentHTML('beforeend',h+addBox(d));
    w.appendChild(sec);});
  if(big)w.insertAdjacentHTML('beforeend','<p class="small muted mia-big">Long range: only days with sign-ins are shown. “+ Add farm” lets you choose any day.</p>');}
function openView(w,o){var nm=siteName(o.site),X=extras(o.site,o.date);
  w.innerHTML='<div class="cb-head mia-openhead"><button type="button" class="small sec" data-mia-back="1">← All farms</button><h3><span class="cb-code">'+E(o.site)+'</span> '+E(dayLabel(o.date))+' · 0 people · 0 entries'+(nm?' <small>'+E(nm)+'</small>':'')+'</h3></div>'+
    '<p class="small muted">Added farm – nobody signed in here this day. Add the hours manually.</p>'+X.bar+X.sec;stack(document.getElementById('miafarmlist'));}
function shownSites(d){var m={};[].forEach.call(document.querySelectorAll('#hbwrap [data-hb]'),function(b){var p=b.getAttribute('data-hb').split('|');if(p[0]===d)m[p.slice(1).join('|')]=1;});(S().added||[]).forEach(function(a){if(a.date===d)m[a.site]=1;});return m;}
function pickHtml(d,err){var sh=shownSites(d),L=allSites().filter(function(x){return !sh[x.code];});
  return '<div id="miapick"><h2>Add a farm for '+E(dayLabel(d))+'</h2><p class="small muted">Farms / sites already shown for this day are left out. The farm then gets its own box for the day – tap it to add the hours manually.</p>'+(err?'<div class="alert bad small">'+E(err)+'</div>':'')+
   '<form data-form="miaaddfarm" id="miapickform"><div><label class="req" for="miasite">Farm / site</label><select name="site" id="miasite" required><option value="">– choose –</option>'+L.map(function(x){var nm=siteName(x.code);return '<option value="'+E(x.code)+'">'+E(x.code+(nm?' – '+nm:''))+'</option>';}).join('')+'</select></div>'+
   '<div><label class="req" for="miadate">Day</label><input type="date" name="date" id="miadate" required max="'+today()+'" value="'+E(d)+'"></div>'+
   '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="miapickgo">Add farm box</button></div></form></div>';}
FORMS.miaaddfarm=function(f,d){if(!canAdd()){toast('Only the Owner, an Admin or Payroll (billing) can add manual hours.');return;}
  var day=String(d.date||''),site=String(d.site||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||day>today()){toast('Pick a day that is not in the future.');return;}
  if(!allSites().some(function(x){return x.code===site;})){toast('Pick a farm / site.');return;}
  if(shownSites(day)[site]){toast(site+' is already shown for '+dayLabel(day)+'.');return;}
  var s=S();(s.added=s.added||[]).push({date:day,site:site});closeModal();
  var R=range();if(day<R.from||day>R.to){var v=PAGE_STATE.vsh=PAGE_STATE.vsh||{};if(day<R.from)v.from=day;else v.to=day;}
  toast(site+' added for '+dayLabel(day)+' – tap its box to add hours.');render();
  setTimeout(function(){var b=document.querySelector('#hbwrap [data-miahb="'+day+'|'+site+'"]');if(b){var r=b.getBoundingClientRect();if(r.top<60||r.bottom>innerHeight)b.scrollIntoView({block:'center'});}},60);};
document.addEventListener('click',function(e){if(!e.target.closest)return;
  var a=e.target.closest('a[href="#miafarmlist"]');if(a){e.preventDefault();var s0=document.getElementById('miafarmlist');if(s0)s0.scrollIntoView({block:'start'});return;}
  var ad=e.target.closest('#hbwrap [data-miaday]');if(ad){modal(pickHtml(ad.getAttribute('data-miaday')));return;}
  var ob=e.target.closest('#hbwrap [data-miahb]');if(ob){var p=ob.getAttribute('data-miahb').split('|'),s=S();s.y0=window.scrollY;s.open={date:p[0],site:p.slice(1).join('|')};render();
    setTimeout(function(){var w=document.getElementById('hbwrap');if(w){var t=w.getBoundingClientRect().top;if(t<0||t>innerHeight*0.5)w.scrollIntoView({block:'start'});}},0);return;}
  if(e.target.closest('#hbwrap [data-mia-back]')){var s2=S(),y0=s2.y0;s2.open=null;render();if(y0!=null)setTimeout(function(){window.scrollTo(0,y0);},0);}});
/* leaving All hours or "← All farms" of hourboxes closes our open view too */
document.addEventListener('click',function(e){if(e.target.closest&&e.target.closest('#hbwrap [data-hb]'))S().open=null;},true);
window.addEventListener('hashchange',function(){if(!/^#\/allhours/.test(location.hash||''))S().open=null;});
new MutationObserver(function(){try{if(/^#\/allhours/.test(location.hash||'')){decorate();boxExtras();}}catch(e){try{console.warn('[mtinall]',e);}catch(z){}}}).observe(document.documentElement,{childList:true,subtree:true});
})();
