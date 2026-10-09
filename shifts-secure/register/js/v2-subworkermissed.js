/* subworkermissed1 – owner Oct 9 2026 5:23 PM: subcontractor WORKERS ("Farm worker – a crew company hired you", linked to a sub)
   can add a missed shift like company employees: up to 14 days back. Unlike employees, EVERY sub-worker missed shift waits for the
   office (lateEntry 'pending' in Late entries) and is counted / billed only after the office (or the Office Assistant) approves it.
   The worker's subcontractor sees it under Workers' hours as "Waiting for office – not counted yet" (synccheck1 rules).
   Live: migration 016y adds a server check (pending, last 14 days, own subcontractor). Loaded right before v2-nohome.js. */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof FORMS==='undefined')return;
var DAYS=14;
function isSubWorker(u){u=u||(typeof ME!=='undefined'?ME:null);return !!(u&&u.type==='worker'&&u.subId);}
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s);}
function sitesFor(){var all=(typeof companySites==='function'?companySites({skipPractice:true}):(DB.sites||[]).filter(function(s){return s.code!=='TEST-PRACTICE';}));
  var mine={},lo=addDays(today(),-DAYS);(DB.time||[]).forEach(function(t){if(t.userId===ME.id&&t.date>=lo&&!t.test){var s=t.site||((DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0]||{}).site;if(s)mine[s]=1;}});
  (DB.shifts||[]).forEach(function(s){if(s.date>=lo&&((s.booked||[]).indexOf(ME.id)>=0||(s.workers||[]).indexOf(ME.id)>=0))mine[s.site]=1;});
  return all.slice().sort(function(a,b){return (mine[a.code]?0:1)-(mine[b.code]?0:1)||(a.code<b.code?-1:a.code>b.code?1:0);});}
function lab(s){return s.code+(typeof efSiteLabel==='function'?(efSiteLabel(s)?' – '+efSiteLabel(s):''):'');}  /* never the farm name */
function form(){var sites=sitesFor();
  return '<details class="card ef-missed" id="swmissed"'+(PAGE_STATE.swmOpen?' open':'')+'><summary data-act="swmtoggle"><b>Forgot to clock in? Add a missed shift</b></summary>'+
    '<p class="small">Add a shift you forgot to clock, up to '+DAYS+' days back. The office checks it first. Until then it shows as "Waiting for office" and is not counted. Your crew company sees it too.</p>'+
    '<form data-form="swmissed"><div class="grid2">'+inp('date','Shift date',addDays(today(),-1),{type:'date',req:true})+sel('site','Site',sites.map(function(s){return [s.code,lab(s)];}),'',{req:true})+
    inp('in','Start (quarter hour)','07:00',{type:'time',req:true})+inp('out','Finish (quarter hour)','15:00',{type:'time',req:true})+'</div>'+
    chk('breakTaken','I took my break (30 min over 5 h, 60 min at 8 h or more)',true)+inp('note','What happened (optional)','')+'<button>Send to the office</button></form></details>';}
function listHtml(){var mine=(DB.time||[]).filter(function(t){return t.userId===ME.id&&t.missed&&!t.test;}).slice(-10).reverse();if(!mine.length)return '';
  return '<div class="card" id="swmlist"><h3 style="margin-top:0">Missed shifts you added</h3><ul class="small">'+mine.map(function(t){var s=t.lateEntry==='pending'?'<span class="pill s-pend">Waiting for office</span>':t.lateEntry==='approved'?'<span class="pill s-ok">OK by office</span>':t.lateEntry==='rejected'?'<span class="pill s-bad">Not approved</span>'+(t.lateReason?' '+E(t.lateReason):''):'<span class="pill s-ok">Added</span>';
    return '<li>'+E(t.date+' '+t.site+' '+t['in']+'–'+t.out)+' '+s+'</li>';}).join('')+'</ul></div>';}
var ov=VIEWS['worker:shifts'];if(typeof ov==='function')VIEWS['worker:shifts']=function(){var x=ov.apply(this,arguments);return isSubWorker()?x+form()+listHtml():x;};
ACT.swmtoggle=function(el){var d=el.parentNode;PAGE_STATE.swmOpen=!d.open;d.open=!d.open;};
FORMS.swmissed=function(f,d){var u=ME;if(!isSubWorker(u)){toast('Not allowed.');return;}
  if(!d.date||d.date>today()){toast('Pick a past shift date.');return;}var age=daysBetween(d.date,today());
  if(age>DAYS){toast('Missed shifts can be added up to '+DAYS+' days back. Please ask your crew company or the office.');return;}
  var q=function(v){return /^\d{2}:\d{2}$/.test(v||'')&&(+v.slice(3))%15===0;};if(!q(d['in'])||!q(d.out)){toast('Use quarter-hour times (:00, :15, :30, :45).');return;}
  if(typeof spanErr==='function'&&spanErr(d['in'],d.out)){toast(spanErr(d['in'],d.out));return;}
  if(!sitesFor().some(function(s){return s.code===d.site;})){toast('Pick a site.');return;}
  if(typeof overlapsAny==='function'&&overlapsAny(u.id,d.date,d['in'],d.out)){toast('You already have hours that overlap this time.');return;}
  var t={id:uid('t'),userId:u.id,subId:u.subId,site:d.site,shiftId:null,role:typeof jobRoleOf==='function'?jobRoleOf(u):'labour',date:d.date,'in':d['in'],out:d.out,clock:true,missed:true,swMissed:true,
    addedAt:new Date().toISOString(),daysLate:age,breakMissed:!d.breakTaken,note:d.note||'',test:false,lateEntry:'pending'};
  DB.time.push(t);audit('Sub worker added missed shift (waiting for office)',u.name,d.site+' '+d.date+' '+d['in']+'–'+d.out+' ('+age+' days after)');
  notify('admin','Late entry to review: '+u.name+' ('+(typeof employerName==='function'?employerName(u):'crew company')+') added '+d.site+' '+d.date+' '+d['in']+'–'+d.out+'. Not counted until you approve it.');
  if(u.subId)notify(u.subId,u.name+' added a missed shift: '+d.site+' '+d.date+' '+d['in']+'–'+d.out+'. It waits for the office.');
  save();PAGE_STATE.swmOpen=false;toast('Sent – waiting for the office. It is not counted until the office approves it.');render();};
if(typeof ROLE_ONLY!=='undefined'){ROLE_ONLY.swmissed=['worker'];ROLE_ONLY.swmtoggle=['worker'];}
/* office Late entries: say where a sub worker's entry came from */
var ol=VIEWS['admin:lateentries'];if(typeof ol==='function')VIEWS['admin:lateentries']=function(){var x=ol.apply(this,arguments);
  (DB.time||[]).forEach(function(t){if(t.swMissed&&t.lateEntry==='pending')x=x.replace('<tr data-id="'+t.id+'">','<tr data-id="'+t.id+'" class="swm-row" title="Added by the worker (crew company worker) – always checked by the office">');});
  x=x.split('>Employee missed shift<').join('>Missed shift (employee or crew worker)<');
  return x.replace('<p class="small muted">Missed shifts added more than','<p class="small muted">Crew company workers\' missed shifts always come here (any age, up to 14 days back). Missed shifts added by employees more than');};
window.subWorkerMissed={version:'subworkermissed1',days:DAYS,isSubWorker:isSubWorker};
})();
