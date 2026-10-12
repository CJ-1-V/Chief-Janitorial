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
function body(){var L=rows().sort(function(a,b){return startMs(a)-startMs(b);});
  if(!L.length)return '<p class="ci-empty">Nobody is clocked in right now.</p>';
  return '<ul class="ci-list">'+L.map(function(t){var u=user(t.userId)||{},p=place(t),ms=startMs(t),lead=t.crewLeadId&&user(t.crewLeadId);
    return '<li class="ci-row" data-id="'+E(t.id)+'"><div class="ci-who"><b>'+E(u.name||'Unknown')+'</b><small>'+E(who(u))+'</small></div>'+
      '<div class="ci-where"><span>'+E(p.main)+'</span>'+(p.sub?'<small>'+E(p.sub)+'</small>':'')+'</div>'+
      '<div class="ci-when"><span>In at <b>'+E(t['in'])+'</b>'+(t.date!==today()?' (yesterday)':'')+'</span><small>On shift '+E(dur(ms))+'</small></div>'+
      (lead&&lead.id!==u.id?'<div class="ci-lead">Crew lead: '+E(lead.name)+'</div>':'')+'</li>';}).join('')+'</ul>';}
function open(){if(!office())return;var n=rows().length;
  modal('<div class="ci-sheet" id="ciSheet"><h2>Clocked in right now</h2><p class="ci-note">'+(n?n+(n===1?' person is':' people are')+' on shift (clocked in, not clocked out yet). Updated '+new Date().toTimeString().slice(0,5)+'.':'Updated '+new Date().toTimeString().slice(0,5)+'.')+'</p>'+body()+'</div>');}
window.clockedInList={rows:rows,open:open};
function hit(e){var x=e.target&&e.target.closest&&e.target.closest('#oiTNow');if(!x||!office())return false;e.preventDefault();open();return true;}
document.addEventListener('click',hit);
document.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')hit(e);});
function mark(){var x=document.getElementById('oiTNow');if(x&&!x.dataset.ci){x.dataset.ci='1';x.setAttribute('role','button');x.setAttribute('tabindex','0');x.classList.add('ci-tap');x.setAttribute('aria-label','Clocked in right now: see who is on shift');}}
new MutationObserver(mark).observe(document.documentElement,{childList:true,subtree:true});mark();
})();
