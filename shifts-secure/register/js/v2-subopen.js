/* subopen1 – subcontractor workers can work at every site, subcontractors can work shifts themselves, and a clearer
   subcontractor dashboard (owner Oct 7, 2026 6:00 PM: "make sure that contractors workers have access to all sites regardless and
   dont need subcontractor to assign shifts just like regular employees and the subcontractor can also work themself if they like so
   giv thier id acces to login if they want to work themself, give subcontractor page better graphics too").
   New file only; loaded just before v2-nohome.js (which stays last). Pairs with css/subopen.css. No new tables; flags live in the
   account's existing free-form data.
   1) Subcontractor workers: the Clock already lists every site (the same list as company employees) and never needed a crew
      assignment. What stopped them on the live app: a worker's browser cannot read the employer's documents or agreement
      acceptances (row-level security), so the employer always looked non-compliant. When the server sends the employer's
      compliance summary (empDocs / empTerms / company flags – migration 016p), the SAME company rules are applied to it.
      Wording on Clock / My shifts / Crew assignments now says plainly that no crew assignment is needed.
   2) "Work shifts myself": a subcontractor (or the office for them) turns it on; the subcontractor's own login then gets a work
      view (Clock, My shifts, Training & quizzes, Menu – the normal worker screens) next to the company dashboard. In the work view
      the account acts as a worker of its own company: the worker requirements apply (Schedule C + privacy, personal details,
      training, availability) plus the company's own compliance; hours are saved with subId = the company, so they count under
      it. Flag: account data "selfWork" {on, at, by}. On the live app the switch only appears once migration 016p is applied
      (it sets settings.subSelfWork = true and lets the database accept a subcontractor's own time entries and quizzes).
   3) Subcontractor dashboard: company banner with status, KPI cards (crew size, hours this week with day bars, active sites,
      company documents ring), crew readiness bar; My workers gets the same readiness summary. Office sub card shows the hours
      attributed to the company (crew + own) and the Work-shifts-myself switch.
   Turn off: remove the 2 lines in index.html. */
'use strict';
(function(){
if(typeof VIEWS==='undefined'||typeof DB==='undefined'||typeof ACT==='undefined')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function f2(h){return (Math.round((h||0)*100)/100).toFixed(2);}
function fs(h){return String(Math.round((h||0)*100)/100);}
function realOf(m){return m&&m.__swReal?m.__swReal:m;}
function coName(s){return s?((s.company&&s.company.legalName)||s.name||''):'';}

/* =============== 1) employer compliance from the server summary (live: worker cannot read the employer's rows) =============== */
function stubDocs(s){return s&&s.employerView&&Array.isArray(s.empDocs)?s.empDocs:null;}
if(typeof latestDoc==='function'){var _ld=latestDoc;latestDoc=function(id,kind){var s=null;try{s=typeof user==='function'?user(id):null;}catch(e){}var L=stubDocs(s);
  if(L){var d=null;L.forEach(function(x){if(x&&x.kind===kind&&(!d||String(x.uploadedAt||'')>String(d.uploadedAt||'')))d=x;});return d?Object.assign({id:'emp-'+kind,userId:id,meta:{}},d):null;}
  return _ld.apply(this,arguments);};}
if(typeof acceptedCurrent==='function'){var _ac=acceptedCurrent;acceptedCurrent=function(u,key){if(u&&u.employerView&&Array.isArray(u.empTerms)){var cur=termsCurrent(key);if(!cur)return true;
  return u.empTerms.some(function(a){return a&&a.key===key&&String(a.version)===String(cur.version);});}return _ac.apply(this,arguments);};}

/* =============== 2) work-shifts-myself: flag, availability, work view (proxy) =============== */
function swOn(s){s=realOf(s);return !!(s&&s.type==='sub'&&s.selfWork&&s.selfWork.on);}
function swAvail(){return !window.REG_LIVE||!!(DB&&DB.settings&&DB.settings.subSelfWork);}
function mkey(s){return 'us-selfwork-mode:'+s.id;}
function mode(s){try{return sessionStorage.getItem(mkey(s))||'company';}catch(e){return 'company';}}
function setMode(s,m){try{if(m==='work')sessionStorage.setItem(mkey(s),'work');else sessionStorage.removeItem(mkey(s));}catch(e){}}
var OVR=['type','subId','__swReal','selfWorker'];
function mkProxy(s){var ov={type:'worker',subId:s.id,selfWorker:true};
  return new Proxy(s,{
    get:function(t,k){if(k==='__swReal')return t;if(k==='toJSON')return function(){return typeof t.toJSON==='function'?t.toJSON():t;};if(Object.prototype.hasOwnProperty.call(ov,k))return ov[k];return t[k];},
    set:function(t,k,v){if(OVR.indexOf(k)>=0)return true;t[k]=v;return true;},
    has:function(t,k){return OVR.indexOf(k)>=0||k in t;}});}
var NAV_SW=[['#/myclock','My Clock (work shifts)'],['#/myshifts','My shifts'],['#/mytraining','My training']];
function navSync(on){if(!NAV.sub)return;NAV.sub=NAV.sub.filter(function(n){return !NAV_SW.some(function(x){return x[0]===n[0];});});
  if(on){var at=1;NAV.sub.splice.apply(NAV.sub,[at,0].concat(NAV_SW));}}
function syncMe(){try{if(typeof ME==='undefined'||!ME)return;var r=realOf(ME),fresh=(typeof user==='function'&&user(r.id))||r;
  if(fresh.type!=='sub'){if(ME.__swReal)ME=fresh;return;}
  var on=swOn(fresh)&&swAvail();navSync(on);
  if(on&&mode(fresh)==='work'){if(!ME.__swReal||ME.__swReal!==fresh)ME=mkProxy(fresh);}
  else if(ME.__swReal||ME!==fresh)ME=fresh;}catch(e){try{console.warn('[subopen] syncMe',e);}catch(x){}}}
window.subopenSync=syncMe;window.subopenProxy=mkProxy;
['click','submit','input','change'].forEach(function(ev){document.addEventListener(ev,syncMe,true);});
if(typeof render==='function'){var _r=render;render=function(){syncMe();return _r.apply(this,arguments);};}
if(ACT.logout){var _lo=ACT.logout;ACT.logout=function(){try{var r=realOf(ME);if(r&&r.type==='sub')setMode(r,'company');if(ME&&ME.__swReal)ME=r;}catch(e){}return _lo.apply(this,arguments);};}
function switchTo(m,to){var r=realOf(ME);if(!r||r.type!=='sub')return;if(m==='work'&&!(swOn(r)&&swAvail())){toast('Work shifts myself is not turned on.');return;}
  setMode(r,m);syncMe();if(typeof closeModal==='function')try{closeModal();}catch(e){}go(to||'#/home');}
ACT.swmode=function(el){switchTo(el.dataset.m==='work'?'work':'company',el.dataset.to||'#/home');};
/* company-mode menu entries that open the work view */
[['myclock','#/home'],['myshifts','#/shifts'],['mytraining','#/training']].forEach(function(p){VIEWS['sub:'+p[0]]=function(){var r=realOf(ME);
  if(!(swOn(r)&&swAvail()))return '<h1>Work shifts myself</h1><p class="muted">This is turned off. Turn it on from your Dashboard.</p>';
  PAGE_STATE.after=function(){switchTo('work',p[1]);};return '<p class="muted">Opening your work view…</p>';};});
/* self-worker = worker of their own company: employer confirmations do not apply to themselves */
if(typeof requirements==='function'){var _rq=requirements;requirements=function(u){var R=_rq.apply(this,arguments);if(u&&u.__swReal)R=R.filter(function(r){return ['confirmed','originals','sin_by_sub'].indexOf(r.key)<0;});return R;};}
if(typeof employerName==='function'){var _en=employerName;employerName=function(u){if(u&&u.type==='sub')return coName(u)||'(not linked)';return _en.apply(this,arguments);};}
if(typeof myPayRate==='function'){var _mp=myPayRate;myPayRate=function(u){if(u&&u.__swReal)return 'Your company invoices UnScramble for your hours ('+E(coName(u.__swReal))+')';return _mp.apply(this,arguments);};}
if(typeof clockLockHtml==='function'){var _cl=clockLockHtml;clockLockHtml=function(u){var h=_cl.apply(this,arguments);try{
  h=h.replace("Until they are, you can't be booked on crew shifts. There is nothing for you to fix – please ask your employer, or contact the office.","Until they are, you can't clock in. There is nothing for you to fix – please ask your employer, or contact the office.");
  if(u&&u.__swReal)h=h.replace("Your employer's papers are not finished yet.","Your company's papers are not finished yet.").replace('What your employer still needs to finish','What your company still needs to finish').replace(/Until they are, you can't clock in\. There is nothing for you to fix – please ask your employer, or contact the office\./,'Until they are, you can\'t clock in. Finish them on your <a href="#" data-act="swmode" data-m="company" data-to="#/home">company dashboard</a>.');}catch(e){}return h;};}
/* work-view Menu: company dashboard link + who you are */
function menuWrap(v){return function(){var x=v.apply(this,arguments);try{if(ME&&ME.__swReal){var r=ME.__swReal;
  x=x.replace(E(TYPES.worker),'Subcontractor · working shifts myself');
  var item='<a class="menu-item so-back" href="#" data-act="swmode" data-m="company" data-to="#/home" id="soBackCo"><span class="mi" aria-hidden="true">🏢</span><span class="mt"><b>Company dashboard</b><small>'+E(coName(r))+' – workers, documents, invoices</small></span><span class="chev" aria-hidden="true">›</span></a>';
  var i=x.indexOf('<div class="menu-list">');if(i>=0)x=x.slice(0,i+23)+item+x.slice(i+23);}}catch(e){}return x;};}
if(VIEWS['worker:menu'])VIEWS['worker:menu']=menuWrap(VIEWS['worker:menu']);
/* work-view banner on the Clock + My shifts so it is clear whose hours these are */
function workBanner(){if(!ME||!ME.__swReal)return '';return '<div class="so-wbar" id="soWorkBar"><span>Working as <b>'+E(coName(ME.__swReal))+'</b> – hours count under your company.</span><button type="button" class="linklike" data-act="swmode" data-m="company" data-to="#/home">Company dashboard</button></div>';}
/* any other work-view page (terms gate, checklist, profile…) still gets the way back to the company dashboard */
(function(){var ol=layout;layout=function(c){try{if(ME&&ME.__swReal&&String(c).indexOf('soWorkBar')<0)c=workBanner()+c;}catch(e){}return ol.apply(this,[c].concat([].slice.call(arguments,1)));};})();
['worker:home','worker:shifts','worker:training'].forEach(function(k){var v=VIEWS[k];if(typeof v!=='function')return;VIEWS[k]=function(){var x=v.apply(this,arguments);try{var b=workBanner();if(b){var i=x.indexOf('</h1>');x=i>=0?x.slice(0,i+5)+b+x.slice(i+5):b+x;}}catch(e){}return x;};});

/* =============== 1b) wording: workers clock in at any site, no crew assignment needed =============== */
if(typeof clockView==='function'){var _cv=clockView;clockView=function(){var x=_cv.apply(this,arguments);try{if(ME&&ME.type==='worker'){var n=(typeof clockSites==='function'?clockSites():[]).length,
  lab='<div class="label">Which site are you at? <span class="req-star">*</span></div>',i=x.indexOf(lab);
  if(i>=0&&n)x=x.slice(0,i+lab.length)+'<div class="so-open small" id="soAllSites"><span aria-hidden="true">✓</span> All '+n+' sites are open to you. No crew assignment is needed – pick the site you are at.</div>'+x.slice(i+lab.length);}}catch(e){}return x;};}
function wkFix(x){return String(x).replace('No crew assignments coming up.','No crew assignments coming up. You don\'t need one – clock in at any site from the Clock tab.')
  .replace(/Your employer \((.*?)\) can also place you on crews\./,'Optional: sign up for a crew shift, or your employer ($1) can place you on one. You can also just clock in at any site.');}
if(typeof efBody==='function'){var _eb=efBody;efBody=function(u){var x=_eb.apply(this,arguments);return u&&u.type==='worker'?wkFix(x):x;};}
if(typeof efOpenHtml==='function'){var _eo=efOpenHtml;efOpenHtml=function(u){var x=_eo.apply(this,arguments);if(!(u&&u.type==='worker'))return x;x=wkFix(x);
  var i=x.indexOf('<section class="ef-sec" id="efOpen">'),j=i>=0?x.indexOf('</h2>',i):-1;if(j>=0)x=x.slice(0,j+5)+'<div class="so-open small" id="soShiftNote"><span aria-hidden="true">✓</span> Optional. You can clock in at any site from the Clock without a crew shift.</div>'+x.slice(j+5);return x;};}
if(VIEWS['sub:crews']){var _vc=VIEWS['sub:crews'];VIEWS['sub:crews']=function(){var x=_vc.apply(this,arguments);try{x=x.replace('You do not record hours in the app.</p>','You do not record hours in the app.</p><div class="alert info small so-crewnote" id="soCrewNote"><b>Optional.</b> Your workers can clock in at any site without a crew assignment. Use this page only when a client asked for a crew on a set date.</div>');}catch(e){}return x;};}

/* =============== hours helpers (paid hours like My shifts) =============== */
function paidH(t){if(!t||!t.out||!t['in'])return 0;var w=hrs(t['in'],t.out);return Math.max(0,w-(typeof unpaidBreak==='function'?unpaidBreak(w,t):0));}
function counts(t){return !t.test&&!!t.out&&t.lateEntry!=='pending'&&t.lateEntry!=='rejected';}
function crewOf(s){return users('worker').filter(function(w){return w.subId===s.id;});}
function underSub(t,s,ids){return t.subId===s.id||ids[t.userId];}
function subHours(s,from,to,onlyUser){var ids={};crewOf(s).forEach(function(w){ids[w.id]=1;});ids[s.id]=1;var r={crew:0,own:0,by:{},sites:{},open:0,openOwn:false};
  (DB.time||[]).forEach(function(t){if(!underSub(t,s,ids)||t.test)return;if(onlyUser&&t.userId!==onlyUser)return;
    if(!t.out){if(t.clock){r.open++;if(t.userId===s.id)r.openOwn=true;if(t.site)r.sites[t.site]=Math.max(r.sites[t.site]||0,1);}return;}
    if(!counts(t)||t.date<from||t.date>to)return;var h=paidH(t);if(t.userId===s.id)r.own+=h;else r.crew+=h;r.by[t.userId]=(r.by[t.userId]||0)+h;if(t.site)r.sites[t.site]=(r.sites[t.site]||0)+h;});
  r.total=r.crew+r.own;return r;}
function weekBars(s,onlyUser){var T=today(),ws=weekStart(T),d=[];for(var i=0;i<7;i++)d.push({d:addDays(ws,i),h:0});var ids={};crewOf(s).forEach(function(w){ids[w.id]=1;});ids[s.id]=1;
  (DB.time||[]).forEach(function(t){if(!underSub(t,s,ids)||!counts(t))return;if(onlyUser&&t.userId!==onlyUser)return;var k=daysBetween(ws,t.date);if(k>=0&&k<7)d[k].h+=paidH(t);});
  var mx=Math.max(8,Math.max.apply(null,d.map(function(x){return x.h;})));
  return '<div class="so-bars" role="img" aria-label="'+E('Hours by day this week: '+d.map(function(x){return shortDay(x.d).slice(0,3)+' '+fs(x.h);}).join(', '))+'">'+d.map(function(x,i){var pc=x.h>0?Math.max(6,Math.round(x.h/mx*100)):0;
    return '<span class="so-bc'+(x.d===T?' so-today':'')+(x.d>T?' so-fut':'')+'"><i style="height:'+pc+'%;animation-delay:'+(i*35)+'ms"></i><em>'+shortDay(x.d).charAt(0)+'</em></span>';}).join('')+'</div>';}
function ring(done,total,big,small,aria,cls){var r=40,C=2*Math.PI*r,p=total?Math.max(0,Math.min(1,done/total)):0;
  return '<svg class="so-ring '+(cls||'')+'" viewBox="0 0 100 100" role="img" aria-label="'+E(aria)+'"><circle class="so-rbg" cx="50" cy="50" r="'+r+'"/><circle class="so-rfg" cx="50" cy="50" r="'+r+'" transform="rotate(-90 50 50)" stroke-dasharray="'+(C*p).toFixed(2)+' '+C.toFixed(2)+'"/><text x="50" y="49" text-anchor="middle" dominant-baseline="central" class="so-rbig">'+E(big)+'</text><text x="50" y="68" text-anchor="middle" class="so-rsm">'+E(small)+'</text></svg>';}

/* =============== crew readiness =============== */
function workerState(w){try{if(w.active===false||w.suspended)return 'off';var hard=typeof clockHardBlockers==='function'?clockHardBlockers(w):blockers(w,today());if(w.accountApproved===false)return 'wait';
  if(!w.confirmedBySub)return 'confirm';if(hard.length)return 'blocked';return 'ready';}catch(e){return 'blocked';}}
var WS_LAB={ready:'Can clock in',confirm:'Needs your confirmation',wait:'Waiting for office approval',blocked:'Blocked',off:'Switched off'};
function readiness(s){var ws=crewOf(s),c={ready:0,confirm:0,wait:0,blocked:0,off:0};ws.forEach(function(w){c[workerState(w)]++;});return {ws:ws,c:c,n:ws.length};}
function readyBar(s,withList){var R=readiness(s),c=R.c,n=R.n||1,seg=function(k){return c[k]?'<i class="so-s-'+k+'" style="flex:'+c[k]+' 1 0" title="'+E(WS_LAB[k]+': '+c[k])+'"></i>':'';};
  var x='<section class="card so-card so-ready" id="soReady" aria-label="Crew readiness"><div class="so-hd"><h2 class="so-h">Crew readiness</h2><span class="so-tag">'+R.n+' worker'+(R.n===1?'':'s')+'</span></div>'+
    (R.n?'<div class="so-stack" role="img" aria-label="'+E(['ready','confirm','wait','blocked','off'].filter(function(k){return c[k];}).map(function(k){return WS_LAB[k]+' '+c[k];}).join(', '))+'">'+seg('ready')+seg('confirm')+seg('wait')+seg('blocked')+seg('off')+'</div>'+
    '<ul class="so-leg">'+['ready','confirm','wait','blocked','off'].filter(function(k){return c[k]||k==='ready';}).map(function(k){return '<li><span class="so-k so-s-'+k+'"></span>'+E(WS_LAB[k])+' <b>'+c[k]+'</b></li>';}).join('')+'</ul>':'<p class="small muted">No workers yet. Add your first worker on My workers.</p>');
  if(withList&&R.n)x+='<div class="so-people">'+R.ws.map(function(w){var st=workerState(w),ini=String(w.name||'?').split(' ').map(function(p){return p.charAt(0);}).join('').slice(0,2).toUpperCase();
    return '<span class="so-pp so-p-'+st+'" title="'+E(w.name+' – '+WS_LAB[st])+'"><b>'+E(ini)+'</b><span>'+E(String(w.name||'').split(' ')[0])+'</span><small>'+E(WS_LAB[st])+'</small></span>';}).join('')+'</div>';
  x+=(R.n?'<p class="small muted so-note">Workers who can clock in may work at any site – no crew assignment needed.'+(c.confirm?' <a href="#/workers">Confirm new workers →</a>':'')+'</p>':'')+'</section>';return x;}

/* =============== 3) subcontractor dashboard graphics =============== */
function compStatus(s){var raw=companyBlockersRaw(s),pass=tempActive(s),cb=companyBlockers(s);
  if(!raw.length)return {c:'ok',t:'Compliant'};if(pass&&!cb.length)return {c:'temp',t:'On 14-day pass'};return {c:'bad',t:'Action needed'};}
function compRing(s){var R=requirements(s).filter(function(r){return r.st.s!=='Optional';}),done=R.filter(function(r){return r.ok;}).length;
  return {done:done,total:R.length,html:ring(done,R.length,done+'/'+R.length,'complete','Company checklist: '+done+' of '+R.length+' complete',done===R.length?'so-full':'')};}
function heroHtml(s){var st=compStatus(s),T=today(),ws=weekStart(T),wk=subHours(s,ws,addDays(ws,6)),p14=subHours(s,addDays(T,-13),T),R=readiness(s),cr=compRing(s),
    sites=Object.keys(p14.sites).sort(),due=typeof invoiceDue==='function'?invoiceDue(s):null;
  var x='<section class="so-hero" id="soHero" aria-label="Company overview"><div class="so-banner"><div class="so-bt"><span class="so-kicker">Subcontractor dashboard</span><h1>'+E(coName(s))+'</h1>'+
    (due?'<span class="so-sub">30-day period '+E(shortDay(due.periodStart).replace(/^\w+ /,''))+' – '+E(shortDay(due.periodEnd).replace(/^\w+ /,''))+'</span>':'')+'</div><span class="so-status so-st-'+st.c+'" id="soStatus">'+E(st.t)+'</span></div>'+
    '<div class="so-kpis">'+
      '<a class="so-kpi" href="#/workers" id="soKCrew"><span class="so-kl">Crew size</span><b>'+R.n+'</b><small>'+R.c.ready+' can clock in'+(R.c.confirm?' · '+R.c.confirm+' to confirm':'')+'</small></a>'+
      '<a class="so-kpi so-kh" href="#/workerhours" id="soKHours"><span class="so-kl">Hours this week</span><b>'+f2(wk.total)+'</b><small>'+(wk.own?'crew '+fs(wk.crew)+' · you '+fs(wk.own):'paid hours, approved')+'</small>'+weekBars(s)+'</a>'+
      '<a class="so-kpi" href="#/workerhours" id="soKSites"><span class="so-kl">Active sites</span><b>'+sites.length+'</b><small>'+(sites.length?E(sites.slice(0,3).join(' · '))+(sites.length>3?' +'+(sites.length-3):''):'last 14 days')+'</small>'+(wk.open?'<span class="so-live">● '+wk.open+' on shift now</span>':'')+'</a>'+
      '<a class="so-kpi so-kr" href="#/docs" id="soKDocs"><span class="so-kl">Company documents</span>'+cr.html+'<small>'+(cr.done===cr.total?'All items complete':(cr.total-cr.done)+' item'+(cr.total-cr.done===1?'':'s')+' open')+'</small></a>'+
    '</div>';
  var rec=(DB.records||[]).filter(function(r){return r.subId===s.id&&r.status==='Open';}).length;
  if(rec)x+='<a class="so-recs" href="#/records" id="soRecs">📄 '+rec+' open records request'+(rec===1?'':'s')+' from the office – upload within 5 business days ›</a>';
  return x+'</section>';}
function selfCard(s){if(!swAvail())return '';var on=swOn(s);
  if(!on)return '<section class="card so-card so-self" id="soSelf"><div class="so-hd"><h2 class="so-h">Work shifts myself</h2><span class="so-tag so-tag-off">Off</span></div>'+
    '<p class="small">Do you also work at the sites yourself? Turn this on to clock in and out with your own login, like your workers. Your hours count under <b>'+E(coName(s))+'</b>.</p>'+
    '<p class="small muted">Before your first shift you accept Schedule C (worker acknowledgement), add your personal details and emergency contact, and finish the training for your job role.</p>'+
    '<button type="button" class="gold" data-act="swset" data-on="1" id="soSelfOn">Turn on Work shifts myself</button></section>';
  var P=mkProxy(s),miss=[],ready=false,hardN=0;try{var hard=typeof clockHardBlockers==='function'?clockHardBlockers(P):blockers(P,today());hardN=hard.length;ready=s.accountApproved!==false&&!hard.length;
    miss=requirements(P).filter(function(r){return !r.ok&&r.st.s!=='Optional';});}catch(e){}
  var T=today(),ws=weekStart(T),own=subHours(s,ws,addDays(ws,6),s.id),op=(DB.time||[]).filter(function(t){return t.userId===s.id&&t.clock&&!t.out&&!t.test;})[0];
  return '<section class="card so-card so-self so-on" id="soSelf"><div class="so-hd"><h2 class="so-h">Work shifts myself</h2><span class="so-tag so-tag-on">On</span></div>'+
    '<div class="so-selfrow"><div class="so-selfst">'+(op?'<span class="so-pill so-p-ready">● On shift at '+E(op.site)+' since '+E(op['in'])+'</span>':ready?'<span class="so-pill so-p-ready">✓ Ready to clock in</span>':'<span class="so-pill so-p-blocked">'+(hardN?'Can\'t clock in yet':miss.length+' item'+(miss.length===1?'':'s')+' to finish')+'</span>')+
    (miss.length&&!op?'<div class="small muted">'+E(miss.slice(0,3).map(function(r){return r.label.replace(/^Accept: /,'Accept ');}).join(' · '))+(miss.length>3?' …':'')+'</div>':'')+'</div>'+
    '<div class="so-selfh"><span class="so-kl">Your hours this week</span><b id="soOwnWk">'+f2(own.own)+'</b>'+weekBars(s,s.id)+'</div></div>'+
    '<div class="row so-selfbtn"><button type="button" class="gold" data-act="swmode" data-m="work" data-to="#/home" id="soOpenClock">'+(op?'Open my Clock – clock out':'Open my Clock')+'</button><button type="button" class="sec" data-act="swmode" data-m="work" data-to="#/shifts">My shifts</button><button type="button" class="sec" data-act="swmode" data-m="work" data-to="#/training">My training</button><button type="button" class="linklike so-off" data-act="swset" data-on="0" id="soSelfOff">Turn off</button></div></section>';}
ACT.swset=function(el){var s=realOf(ME);if(!s||s.type!=='sub')return;var on=el.dataset.on==='1';
  if(!on&&(DB.time||[]).some(function(t){return t.userId===s.id&&t.clock&&!t.out&&!t.test;})){toast('Clock out first, then turn it off.');return;}
  if(on&&!swAvail()){toast('Not available yet.');return;}
  s.selfWork={on:on,at:new Date().toISOString(),by:s.name,via:'subcontractor'};audit((on?'Turned on':'Turned off')+' Work shifts myself',coName(s));
  notify('admin',coName(s)+' turned '+(on?'on':'off')+' "Work shifts myself"'+(on?' – they can now clock in at sites with their own login; hours count under the company.':'.'));save();toast(on?'Work shifts myself is on.':'Work shifts myself is off.');render();};
if(VIEWS['sub:home']){var _sh=VIEWS['sub:home'];VIEWS['sub:home']=function(){var x=_sh.apply(this,arguments);try{var s=realOf(ME);if(!s||s.type!=='sub')return x;
    var h1='<h1>'+E(coName(s))+'</h1>',i=x.indexOf(h1);if(i<0){var m=x.match(/<h1>[^<]*<\/h1>/);if(m){h1=m[0];i=x.indexOf(h1);}}
    if(i>=0)x=x.slice(0,i)+heroHtml(s)+x.slice(i+h1.length);
    var g=x.indexOf('<div class="grid"><div class="card"><div class="muted small">Workers</div>');if(g>=0){var e=x.indexOf('</div></div></div>',x.indexOf('Current 30-day period',g));if(e>=0)x=x.slice(0,g)+x.slice(e+18);}
    var add=selfCard(s)+readyBar(s,false),k=x.indexOf('<div class="ei-subgrid">');if(k<0)k=x.indexOf('<h2>Company checklist</h2>');x=k>=0?x.slice(0,k)+add+x.slice(k):x+add;}catch(e){try{console.warn('[subopen] dashboard',e);}catch(z){}}return x;};}
if(VIEWS['sub:workers']){var _sw=VIEWS['sub:workers'];VIEWS['sub:workers']=function(){var x=_sw.apply(this,arguments);try{var s=realOf(ME),i=x.indexOf('</p>');if(s&&i>=0)x=x.slice(0,i+4)+readyBar(s,true)+x.slice(i+4);}catch(e){}return x;};}
/* Workers' hours: include the subcontractor's own hours (Work shifts myself) */
if(typeof subRows==='function'){var _sr=subRows;subRows=function(sub,from,to){var rows=_sr.apply(this,arguments);try{(DB.time||[]).forEach(function(t){if(t.userId!==sub.id||t.test||!t.out||t.date<from||t.date>to)return;
    var r={key:t.key0||('t:'+t.id),date:t.date,site:t.site,start:t['in'],end:t.out,uid:t.userId,temp:!!t.temp,breakMissed:!!t.breakMissed};r.hours=hrs(r.start,r.end);r.paid=r.hours-unpaidBreak(r.hours,r);var c=typeof latestChange==='function'?latestChange(r.key):null;r.change=c;r.held=!!(c&&c.status==='Pending');rows.push(r);});
    rows.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.uid<b.uid?-1:1;});}catch(e){}return rows;};}

/* =============== office: hours attributed to the subcontractor + switch =============== */
function officeSubSection(s){var T=today(),ws=weekStart(T),wk=subHours(s,ws,addDays(ws,6)),m30=subHours(s,addDays(T,-29),T),ids={};
  var people=crewOf(s).map(function(w){return {u:w,role:'Worker'};});if(swOn(s)||m30.by[s.id]||wk.by[s.id]||(DB.time||[]).some(function(t){return t.userId===s.id;}))people.unshift({u:s,role:'Subcontractor (own hours)'});
  var rows=people.map(function(p){return '<tr data-uid="'+E(p.u.id)+'"><td><b>'+E(p.u.name)+'</b><div class="small muted">'+E(p.role)+'</div></td><td>'+f2(wk.by[p.u.id]||0)+'</td><td>'+f2(m30.by[p.u.id]||0)+'</td></tr>';}).join('');
  var x='<section class="so-office" id="soOffice"><h3>Hours under this subcontractor</h3><p class="small muted">Approved paid hours billed under <b>'+E(coName(s))+'</b> – its workers and, with Work shifts myself, the subcontractor\'s own shifts.</p>'+
    '<div class="so-otiles"><div><span class="so-kl">This week</span><b id="soOWk">'+f2(wk.total)+'</b><small>crew '+fs(wk.crew)+' · own '+fs(wk.own)+'</small></div><div><span class="so-kl">Last 30 days</span><b id="soO30">'+f2(m30.total)+'</b><small>crew '+fs(m30.crew)+' · own '+fs(m30.own)+'</small></div></div>'+
    '<div class="tw"><table class="so-otbl"><tr><th>Person</th><th>This week</th><th>Last 30 days</th></tr>'+rows+'<tr><th>Total</th><th>'+f2(wk.total)+'</th><th>'+f2(m30.total)+'</th></tr></table></div>'+
    '<h3>Work shifts myself</h3>'+(swAvail()?'<p class="small">'+(swOn(s)?'<span class="pill s-ok">On</span> This subcontractor can clock in at sites with their own login. The worker requirements (Schedule C, details, training) and the company\'s own compliance apply.':'<span class="pill s-mut">Off</span> The subcontractor works through their workers only.')+(s.selfWork&&s.selfWork.at?' <span class="muted">Last changed '+E(fmtStamp(s.selfWork.at))+' by '+E(s.selfWork.by||'')+'.</span>':'')+'</p>'+
      '<button type="button" class="small '+(swOn(s)?'sec':'')+'" data-act="swoffice" data-id="'+E(s.id)+'" id="soOfficeToggle">'+(swOn(s)?'Turn off Work shifts myself':'Turn on Work shifts myself')+'</button>':
      '<p class="small muted">Needs the one-time database update 016p before a subcontractor can clock in with their own login.</p>')+'</section>';
  return x;}
if(typeof showPerson==='function'){var _sp=showPerson;showPerson=function(id){var r=_sp.apply(this,arguments);try{var u=user(id),m=document.querySelector('#modal .modal');if(!u||u.type!=='sub'||!m||!ME||ME.type!=='admin')return r;
  var old=m.querySelector('#soOffice');if(old)old.remove();var h3=[].filter.call(m.querySelectorAll('h3'),function(h){return /^Actions$/.test(h.textContent.trim());})[0],d=document.createElement('div');d.innerHTML=officeSubSection(u);
  if(h3)h3.parentNode.insertBefore(d.firstChild,h3);else m.appendChild(d.firstChild);if(typeof stackTables==='function')try{stackTables(m);}catch(e){}}catch(e){try{console.warn('[subopen] office card',e);}catch(z){}}return r;};}
ACT.swoffice=function(el){var s=user(el.dataset.id);if(!s||s.type!=='sub'||!ME||ME.type!=='admin')return;var on=!swOn(s);
  if(!on&&(DB.time||[]).some(function(t){return t.userId===s.id&&t.clock&&!t.out&&!t.test;})){toast('They are on shift now – they need to clock out first.');return;}
  s.selfWork={on:on,at:new Date().toISOString(),by:ME.name,via:'office'};audit('Office turned '+(on?'on':'off')+' Work shifts myself',coName(s));
  notify(s.id,'The UnScramble office turned '+(on?'on':'off')+' "Work shifts myself" for '+coName(s)+'.'+(on?' You can now clock in at sites with your own login – open your Dashboard.':''));save();toast(on?'Turned on.':'Turned off.');showPerson(s.id);};
if(typeof ADMIN_ONLY_ACT!=='undefined'&&ADMIN_ONLY_ACT.indexOf('swoffice')<0)ADMIN_ONLY_ACT.push('swoffice');
if(typeof ROLE_ONLY!=='undefined')ROLE_ONLY.swset=['sub'];

syncMe();
})();
