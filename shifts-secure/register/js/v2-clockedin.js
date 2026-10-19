/* clockedin1 – owner Oct 12 2026 3:10 PM: "make sure I can see who is logged in when I click 'Clocked in right now / still on shift' on Overview".
   Front end only, no SQL. Office logins only (ME.type==='admin'); employees, subs, workers, farms never get it.
   Source = EXACTLY the tile's own count (v2-officeinfo.js clockedInNow): DB.time rows with a clock-in, no clock-out, not test,
   dated today or yesterday (overnight), user is not a tester. The Shift Tracker is NOT part of that count, so it is not listed either.
   Full office sees real farm names; Office Assistant (ohIs) sees farm codes only ("Farm NAF264"), never names or rates.
   Re-reads DB every time it opens. Loaded right before v2-nohome.js (still last). Pairs with css/clockedin.css.
   Turn off: remove the 2 lines in index.html. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof modal!=='function')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function office(){return typeof ME!=='undefined'&&!!ME&&ME.type==='admin'&&!ME.__swReal;}
function helper(){return typeof window.ohIs==='function'&&window.ohIs();}
/* SAME predicate as officeinfo clockedInNow() – keep these two in step */
function rows(){var y=addDays(today(),-1);return (DB.time||[]).filter(function(t){if(t.test||!t['in']||t.out||t.date<y||t.date>today())return false;var u=user(t.userId);return u&&u.type!=='tester';});}
function startMs(t){var p=String(t.date).split('-'),h=String(t['in']).split(':');return new Date(+p[0],+p[1]-1,+p[2],+h[0]||0,+h[1]||0).getTime();}
function dur(ms){var m=Math.max(0,Math.round((Date.now()-ms)/60000)),h=Math.floor(m/60);return (h?h+' h ':'')+(m%60)+' min';}
function code(f){var c=typeof fhCode==='function'?fhCode(f):'';return c&&c!=='–'?c:'';}
function place(t){var f=t.site&&typeof siteFirm==='function'?siteFirm(t.site):null;
  if(helper())return {main:f&&code(f)?'Farm '+code(f):(t.site?'Farm '+t.site:'No site recorded'),sub:t.site&&f&&code(f)!==t.site?'Site '+t.site:''};
  return {main:f&&f.name?f.name:(t.site?'Site '+t.site:'No site recorded'),sub:t.site?'Site '+t.site:''};}
function who(u){var k=u.type==='employee'?'UnScramble employee':u.type==='worker'?(u.crewLead?'Crew lead':'Subcontractor worker'):u.type==='sub'?'Subcontractor':'';
  var s=u.subId&&user(u.subId);if(s&&s.name)k+=' · '+s.name;return k;}
/* clockboxes1 (owner Oct 17 2026 2:18 PM): FIRST a grid of boxes, one per farm / site code with people on shift now
   (code big + count), sorted by count desc then code. Tap a box = that farm's people (name, in, time on shift, flags).
   "All farms" goes back. Office Assistant: codes only (no farm names). */
var SEL=null;
/* crew numbers: "How many workers are at <site> now?" at CLOCK-IN = time entry .crewIn (crewin1, owner 2:36 PM);
   "How many workers were at <site> this shift?" at CLOCK-OUT = .crew. Reports = both numbers on today's / yesterday's entries
   at that site (people still on shift and people who already left). Highest = the higher of all in and out numbers. */
function reportList(k){var y=addDays(today(),-1),R=[];(DB.time||[]).forEach(function(t){if(t.test||t.removed||t.site!==k||t.date<y||t.date>today())return;
  if(+t.crewIn>0)R.push({n:+t.crewIn,at:t['in'],date:t.date,w:'clock-in'});if(+t.crew>0&&t.out)R.push({n:+t.crew,at:t.out,date:t.date,w:'clock-out'});});
  return R.sort(function(a,b){return (a.date+a.at).localeCompare(b.date+b.at);});}
function crewSum(k,n){var R=reportList(k);if(!R.length)return {n:n,max:0,last:null,miss:0};var mx=Math.max.apply(null,R.map(function(r){return r.n;}));return {n:n,max:mx,last:R[R.length-1],miss:Math.max(0,mx-n)};}
function sumHtml(c){var hi=c.max?'<b>'+c.max+'</b>':'<b>–</b>',la=c.last?' <small>(latest: '+c.last.n+' at '+E(c.last.at)+(c.last.date!==today()?' yesterday':'')+', '+c.last.w+')</small>':'';
  var st=!c.max?'<div class="cs-st cs-none">No crew number reported yet today.</div>':c.miss>0?'<div class="cs-st cs-bad">Possibly missing: <b>'+c.miss+'</b></div>':'<div class="cs-st cs-ok">All accounted for</div>';
  return '<div class="cs-sum"><div>Clocked in in the app: <b>'+c.n+'</b></div><div>Highest crew reported: '+hi+la+'</div>'+st+'</div>';}

function siteKey(t){return t.site||'';}
function boxSub(k){if(!k||helper())return '';var f=typeof siteFirm==='function'?siteFirm(k):null;return f&&f.name?f.name:'';}
function flags(u,t){var f=[],oth=0;try{if(t&&t.docsMissing&&t.docsMissing.length)f.push('Clocked in with documents missing');if(u.type!=='sub'&&u.type!=='admin'&&!u.approved)f.push('Not approved');
  var b=u.type==='sub'?(typeof companyBlockers==='function'?companyBlockers(u,today()):[]).map(function(m){return {m:m};}):(typeof blockers==='function'?blockers(u,today()):[]);
  b.forEach(function(x){var m=String(x.m||'');if(/not (yet )?approved/i.test(m))m=/^employer/i.test(m)?'Employer not approved':'Not approved';else if(/document|upload|permit|licen|insurance|WCB|certificate|abstract|clearance/i.test(m))m='Missing / expired documents';else if(/training|quiz/i.test(m))m='Training not done';else if(/terms|agreement/i.test(m))m='Terms not accepted';else if(/employer|SIN/i.test(m))m='Employer checks pending';else if(/personal|availability|emergency|profile|missing|fill in/i.test(m))m='Registration not finished';else if(/switched off|suspended/i.test(m))m='Account off / suspended';else{oth++;return;}if(f.indexOf(m)<0)f.push(m);});if(oth)f.push(oth+' other item'+(oth===1?'':'s'));}catch(e){}return f;}
function groups(L){var g={};L.forEach(function(t){if(t.removed||t.voided)return;var k=siteKey(t);(g[k]=g[k]||[]).push(t);});
  return Object.keys(g).map(function(k){var ppl={};g[k].forEach(function(t){ppl[t.userId]=1;});return {k:k,L:g[k],n:Object.keys(ppl).length};})
    .sort(function(a,b){return b.n-a.n||(a.k||'~').localeCompare(b.k||'~');});}
function grid(G){return '<div class="cb-grid" role="list">'+G.map(function(x){var nm=boxSub(x.k);
  return '<button type="button" class="cb-box" role="listitem" data-cb="'+E(x.k)+'" aria-label="'+E((x.k||'No site')+': '+x.n+(x.n===1?' person':' people')+' on shift')+'">'+
    (function(){var c=crewSum(x.k,x.n);return c.miss>0?'<span class="cb-badge" title="Crew reported is higher than clocked in">+'+c.miss+'?</span>':'';})()+'<span class="cb-code">'+E(x.k||'No site')+'</span><span class="cb-n">'+x.n+'</span><span class="cb-l">'+(x.n===1?'person':'people')+'</span>'+(nm?'<span class="cb-name">'+E(nm)+'</span>':'')+'</button>';}).join('')+'</div>';}
function list(L){return '<ul class="ci-list">'+L.map(function(t){var u=user(t.userId)||{},p=place(t),ms=startMs(t),lead=t.crewLeadId&&user(t.crewLeadId),fl=flags(u,t);
    return '<li class="ci-row" data-id="'+E(t.id)+'"><div class="ci-who"><b>'+E(u.name||'Unknown')+'</b><small>'+E(u.type==='sub'?'Subcontractor company':who(u))+'</small></div>'+
      '<div class="ci-where"><span>'+E(p.main)+'</span>'+(p.sub?'<small>'+E(p.sub)+'</small>':'')+'</div>'+
      '<div class="ci-when"><span>In at <b>'+E(t['in'])+'</b>'+(t.date!==today()?' (yesterday)':'')+'</span><small>On shift '+E(dur(ms))+'</small></div>'+
      '<div class="ci-crew">Crew at clock-in: <b>'+(+t.crewIn>0?+t.crewIn:'–')+'</b> · at clock-out: <b>'+(+t.crew>0?+t.crew:'on shift')+'</b></div>'+
      (fl.length?'<div class="ci-flags">'+fl.map(function(m){return '<span class="pill s-warn">'+E(m)+'</span>';}).join(' ')+'</div>':'')+
      (lead&&lead.id!==u.id?'<div class="ci-lead">Crew lead: '+E(lead.name)+'</div>':'')+'</li>';}).join('')+'</ul>';}
/* dupshift1 (owner Oct 19 2026 6:07 PM): a farm punched in today whose punched shifts were ALL removed → faded box, 0 people, tap = All hours for that farm/day */
function gone(G){var have={},R={};G.forEach(function(x){have[x.k]=1;});(DB.time||[]).forEach(function(t){if(t.test||!t.removed||t.date!==today()||t.manual||t.crewPlaceholder||!t['in'])return;var k=siteKey(t);if(!k||have[k])return;R[k]=(R[k]||0)+1;});
  return Object.keys(R).sort().map(function(k){var nm=boxSub(k);return '<button type="button" class="cb-box cb-gone" role="listitem" data-act="cigone" data-site="'+E(k)+'" aria-label="'+E(k+': no workers now, shifts removed')+'"><span class="cb-code">'+E(k)+'</span><span class="cb-n">0</span><span class="cb-l">people</span><span class="cb-gonel">No workers now – shifts removed</span>'+(nm?'<span class="cb-name">'+E(nm)+'</span>':'')+'</button>';}).join('');}
ACT.cigone=function(el){if(typeof PAGE_STATE!=='undefined'){PAGE_STATE.hb=PAGE_STATE.hb||{};PAGE_STATE.hb.sel=today()+'|'+el.dataset.site;}try{if(typeof closeModal==='function')closeModal();}catch(e){}location.hash='#/allhours';if(typeof render==='function')setTimeout(render,0);};
function body(){var L=rows().sort(function(a,b){return startMs(a)-startMs(b);});
  var G=groups(L),gh=(typeof ME!=='undefined'&&ME&&ME.type==='admin')?gone(G):'';
  if(!L.length)return '<p class="ci-empty">Nobody is clocked in right now.</p>'+(gh?'<div class="cb-grid" role="list">'+gh+'</div>':'');
  var one=SEL!==null&&G.filter(function(x){return x.k===SEL;})[0];
  if(!one){SEL=null;return grid(G).replace(/<\/div>$/,gh+'</div>');}
  var nm=boxSub(one.k);
  return '<div class="cb-head"><button type="button" class="small sec cb-back" data-cb-back="1">← All farms</button><h3><span class="cb-code">'+E(one.k||'No site')+'</span> '+one.n+(one.n===1?' person':' people')+(nm?' <small>'+E(nm)+'</small>':'')+'</h3></div>'+sumHtml(crewSum(one.k,one.n))+list(one.L);}
function note(){var n=rows().length,t=new Date().toTimeString().slice(0,5);return (n?n+(n===1?' person is':' people are')+' on shift (clocked in, not clocked out yet). '+(SEL===null?'Tap a farm to see who. ':''):'')+'Updated '+t+'.';}
function redraw(){var s=document.getElementById('ciSheet');if(!s)return;s.querySelector('.ci-note').textContent=note();s.querySelector('.ci-body').innerHTML=body();}
document.addEventListener('click',function(e){var s=e.target.closest&&e.target.closest('#ciSheet');if(!s)return;var b=e.target.closest('[data-cb]');
  if(b){SEL=b.getAttribute('data-cb');redraw();return;}if(e.target.closest('[data-cb-back]')){SEL=null;redraw();}});
function open(){if(!office())return;SEL=null;
  modal('<div class="ci-sheet" id="ciSheet"><h2>Clocked in right now</h2><p class="ci-note">'+E(note())+'</p><div class="ci-body">'+body()+'</div></div>');}
window.clockedInList={rows:rows,open:open};
function hit(e){var x=e.target&&e.target.closest&&e.target.closest('#oiTNow');if(!x||!office())return false;e.preventDefault();open();return true;}
document.addEventListener('click',hit);
document.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')hit(e);});
function mark(){var x=document.getElementById('oiTNow');if(x&&!x.dataset.ci){x.dataset.ci='1';x.setAttribute('role','button');x.setAttribute('tabindex','0');x.classList.add('ci-tap');x.setAttribute('aria-label','Clocked in right now: see who is on shift');}}
new MutationObserver(mark).observe(document.documentElement,{childList:true,subtree:true});mark();
})();
