/* v2-timesheets.js – invmonth1 farm side (owner Oct 20 2026, 10:31 / 10:32 / 10:33 / 10:34 PM). TEST COPY.
   1. TIME SHEETS tab for farms (#/timesheets): one week (Mon–Sun, this week first, ◀ ▶), each day lists its workers (Worker #n only,
      no names, no pay rates) with start, finish and hours (billable). NO break wording or choices for farms (owner 10:58 PM).
   2. Changes = the EXISTING farm "ask to change hours" requests (DB.changes → reg_time_proposals, status Pending). Nothing is
      overwritten: the office approves / changes / rejects in Farm changes, as before. Per day "All workers" (same start / finish
      for everyone that day) makes one request per worker; "Change" on a worker makes one request.
      Farms request start / finish only; the break stays as it is (only the office sets breaks).
      The old separate "Shifts at your sites – ask to change hours" list on the farm home is replaced by a link to Time sheets;
      old "Ask to change hours" buttons open Time sheets on that day. Pending requests show here and in the office as before.
   3. EDIT WINDOW (REG_STORE.farmEditWindow): until 'until' (Oct 31 2026) any day in the last 'days' (30) days; from the next day only
      the current week (Mon–Sun). Older days: "Locked: contact the office". The office can still edit any day.
   4. DAY APPROVAL: farm taps "Approve day" or "Approve week". Separate from the office's payroll approval (payroll still waits for
      the office). Shifts with a pending change request are left out of that approval and listed as "waiting for office".
      Invoices still include unapproved hours. Store: DB.farmTs [{id:'day|firm|date',kind:'day',…},{id:'set|firm',kind:'set',remind}]
      → reg_farm_timesheets (023a, NOT applied; flag REG_STORE.farmTimesheets). Without it, kept in this browser only.
   5. REMINDERS: farm setting Daily (default) or Weekly summary. When the app opens (farm or office), a bell message is queued once per
      day (or per finished week) that had crew hours and is not approved yet: "Your crew worked … Review and approve in Time sheets."
      Uses notify() (in-app bell + simulated outbox). A real daily send with nobody signed in needs a server job (see 023a notes).
   6. Farm "My invoices" grouped by work month (same rule as the office), newest month open. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined'||!NAV.firm)return;
function E(s){return esc(s==null?'':String(s));}
function S(){return PAGE_STATE.ts=PAGE_STATE.ts||{};}
function W(){var c=(window.REG_STORE&&window.REG_STORE.farmEditWindow)||{};return {until:c.until||'2026-10-31',days:+c.days||30,after:c.after||'week'};}
function wk(d){return weekStart(d);}
/* farm may change this day? */
function canChangeDay(d){var t=today(),w=W();if(d>t)return false;if(t<=w.until)return daysBetween(d,t)<=w.days;return wk(d)===wk(t);}
window.tsCanChangeDay=canChangeDay;
function windowNote(){var t=today(),w=W();return t<=w.until?'Until '+shortDay(w.until)+', '+w.until.slice(0,4)+' you can ask to change any day in the last '+w.days+' days. From '+shortDay(addDays(w.until,1))+' only days in the current week (Mon–Sun) can be changed, so payroll runs on time. Older days: contact the office.':'You can ask to change days in the current week (Mon–Sun) only, so payroll runs on time. Older days are locked: contact the office.';}
/* farm windows replace the old 7-day window for farm requests (office unchanged) */
if(typeof hcOpen==='function'){hcOpen=function(r){return canChangeDay(r.date);};}
if(typeof hcUntil==='function'){var ou=hcUntil;hcUntil=function(r){var t=today(),w=W();if(t<=w.until)return 'You can ask until '+shortDay(w.until);return 'You can ask until '+shortDay(addDays(wk(t),6));};}
function L(){return DB.farmTs=DB.farmTs||[];}
function get(id){return L().filter(function(x){return x.id===id;})[0]||null;}
function remindOf(f){var s=get('set|'+f.id);return (s&&s.remind)||'daily';}
function dayOk(f,d){return get('day|'+f.id+'|'+d);}
var BRK=[['','Normal rule'],['15','15 min'],['30','30 min'],['60','60 min']];
function brkTxt(r){if(HR.hasChoice(r)&&!r.brk)return (+r.brkMin?r.brkMin+' min'+(r.brkAt?' from '+r.brkAt:''):'No break');if(r.brk)return r.brk+' min';if(r.breakMissed)return 'No break';return 'Normal rule';}
function rowsWeek(f,ws){var R=firmReport(f,ws,addDays(ws,6)),by={};PAGE_STATE.frRows=PAGE_STATE.frRows||{};(R.shiftRows||[]).forEach(function(r){PAGE_STATE.frRows[r.key]=r;(by[r.date]=by[r.date]||[]).push(r);});return by;}
function pend(r){var c=latestChange(r.key);return c&&c.status==='Pending'?c:null;}
function stHtml(r){var c=latestChange(r.key);if(!c)return '';var sp=function(a,b){return E(a)+'–'+E(b)+plus1(a,b);};
  if(c.status==='Pending')return '<span class="pill s-pend">Waiting for office</span><div class="small">You asked for '+sp(c.propStart,c.propEnd)+'</div>';
  if(c.status==='Approved')return '<span class="pill s-ok">Approved</span>';if(c.status==='Adjusted')return '<span class="pill s-warn">Changed by office</span><div class="small">'+sp(c.decStart,c.decEnd)+'</div>'+(c.note?'<div class="small">'+E(c.note)+'</div>':'');
  if(c.status==='Rejected')return '<span class="pill s-bad">Not approved</span>'+(c.note?'<div class="small">'+E(c.note)+'</div>':'');return '';}
function h2(x){return (+x||0).toFixed(2);}
/* ---------- the page ---------- */
VIEWS['firm:timesheets']=function(){var f=ME,s=S(),t=today();var qd=/[?&]d=(\d{4}-\d{2}-\d{2})/.exec(location.hash);if(qd&&s.qd!==qd[1]){s.qd=qd[1];s.d=qd[1];s.ws=wk(qd[1]);PAGE_STATE.after=function(){var e=document.getElementById('tsd-'+qd[1]);if(e)e.scrollIntoView({block:'start'});};}if(!s.ws)s.ws=wk(s.d||t);var ws=s.ws,by=rowsWeek(f,ws),days=[];for(var i=0;i<7;i++)days.push(addDays(ws,i));
  var notOk=days.filter(function(d){return d<=t&&(by[d]||[]).length&&!dayOk(f,d);});
  var x='<h1>Time sheets</h1><p class="small muted">Your crew\'s hours for each day. Workers are shown as Worker #1, #2… (no names). Check them, ask for a change if something is wrong, and approve.</p>'+
   '<div class="alert small ts-win" id="tswin"><b>When you can change hours:</b> '+E(windowNote())+'</div>'+
   '<div class="row ts-bar"><button class="small sec" data-act="tswk" data-n="-1" aria-label="Previous week">◀ Prev week</button><b class="ts-wlabel">'+E(shortDay(ws))+' – '+E(shortDay(addDays(ws,6)))+'</b><button class="small sec" data-act="tswk" data-n="1" aria-label="Next week"'+(addDays(ws,7)>t?' disabled':'')+'>Next week ▶</button>'+(ws!==wk(t)?'<button class="small sec" data-act="tswk" data-n="0">This week</button>':'')+
   (notOk.length?'<button class="small ts-okwk" data-act="tsokweek" id="tsokweek">Approve week ('+notOk.length+(notOk.length===1?' day':' days')+')</button>':'')+'</div>'+
   '<div class="row small ts-remind"><label for="tsrem">Reminders:</label><select id="tsrem" data-act="tsrem" aria-label="Reminders"><option value="daily"'+(remindOf(f)==='daily'?' selected':'')+'>Every day that a crew worked</option><option value="weekly"'+(remindOf(f)==='weekly'?' selected':'')+'>Once a week (summary)</option></select></div>';
  x+=days.map(function(d){var R=by[d]||[],open=canChangeDay(d),ok=dayOk(f,d),hrs0=R.reduce(function(a,r){return a+(r.bill||0);},0),ppl={};R.forEach(function(r){ppl[r.uid]=1;});var np=Object.keys(ppl).length;
    var h='<section class="card ts-day'+(s.d===d?' ts-focus':'')+(ok?' ts-ok':'')+'" id="tsd-'+d+'" data-d="'+d+'"><div class="ts-dh"><h3>'+E(shortDay(d))+(d===t?' (today)':'')+'</h3><span class="small">'+(R.length?np+(np===1?' worker':' workers')+' · '+h2(hrs0)+' h':'No crew this day')+'</span>'+
      (ok?'<span class="pill s-ok ts-okp">Approved by you '+E(String(ok.at||'').slice(0,10))+(ok.excluded&&ok.excluded.length?' (except '+ok.excluded.length+' waiting for office)':'')+'</span>':'')+
      (R.length&&!open?'<span class="pill s-bad ts-lock">Locked: contact the office</span>':'')+'</div>';
    if(!R.length)return h+'</section>';
    h+='<div class="tw"><table class="no-stack ts-t"><tr><th>Worker</th><th>Site</th><th>Start</th><th>Finish</th><th style="text-align:right">Hours</th><th>Status</th><th></th></tr>'+R.map(function(r){var p=pend(r),fin=hcState(r)==='final';
      return '<tr data-key="'+E(r.key)+'"><td class="nw">Worker #'+E(r.no)+'</td><td>'+E(r.site)+'</td><td>'+E(r.start)+'</td><td>'+E(r.end)+plus1(r.start,r.end)+'</td><td style="text-align:right">'+h2(r.bill)+'</td><td class="small">'+stHtml(r)+'</td><td>'+(open&&!p&&!fin?'<button class="small sec" data-act="tsone" data-key="'+E(r.key)+'">Change</button>':(p?'':(!open?'<span class="small muted">Locked</span>':'<span class="small muted">Final</span>')))+'</td></tr>';}).join('')+'</table></div>';
    h+='<div class="row ts-acts">'+(open?'<button class="small sec" data-act="tsall" data-d="'+d+'">All workers: change hours</button>':'')+(d<=t&&!ok?'<button class="small" data-act="tsokday" data-d="'+d+'">Approve day</button>':'')+'</div>';
    return h+'</section>';}).join('');
  x+='<div class="small ts-note">Approving tells the office the hours look right. The office still approves pay (payroll) separately. Your invoice includes all hours, also those not approved yet.</div>';
  return x;};
NAV.firm.splice(1,0,['#/timesheets','Time sheets']);
ACT.tswk=function(el){var s=S(),n=+el.dataset.n;s.ws=n?addDays(s.ws||wk(today()),7*n):wk(today());s.d=null;render();};
document.addEventListener('change',function(e){if(e.target&&e.target.id==='tsrem'&&ME&&ME.type==='firm'){var id='set|'+ME.id,x=get(id);if(!x){x={id:id,kind:'set',firmId:ME.id};L().push(x);}x.remind=e.target.value==='weekly'?'weekly':'daily';x.at=new Date().toISOString();audit('Farm reminder setting',ME.name,x.remind);save();toast(x.remind==='weekly'?'You will get one summary a week.':'You will get a reminder each day a crew worked.');}});
/* ---------- requests (the existing reg_time_proposals flow) ---------- */
function mkReq(r,st,en,bm,why){var f=ME;if(firmCodes(f).indexOf(r.site)<0)return 'own';if(!canChangeDay(r.date))return 'locked';if(pend(r))return 'pending';if(hcState(r)==='final')return 'final';
  st=st||r.start;en=en||r.end;if(spanErr(st,en))return spanErr(st,en);var ob=r.breakMissed?'none':'taken',curB=r.brk?String(r.brk):'';
  var nb=bm==null?curB:bm;if(st===r.start&&en===r.end&&nb===curB)return 'same';
  var c={id:uid('fc'),firmId:f.id,firmName:f.name,by:f.name+' ('+(f.username||f.email)+')',key:r.key,site:r.site,date:r.date,workerNo:r.no,uid:r.uid,origStart:r.start,origEnd:r.end,origBreak:ob,propStart:st,propEnd:en,propBreak:ob,
    comment:(nb!==curB?'[Break: '+(nb?nb+' min':'Normal rule')+'] ':'')+why,at:new Date().toISOString(),status:'Pending',via:'timesheets'};
  if(nb!==curB){c.propBrkMin=nb;c.origBrkMin=curB;}
  if(String(r.key).indexOf('c:')===0){var csh=DB.shifts.filter(function(x){return x.id===String(r.key).split(':')[1];})[0];if(csh)c.crewSize=(csh.booked||[]).length;}
  DB.changes.push(c);audit('Farm proposed shift time change',f.name,r.site+' '+r.date+' Worker #'+r.no+': '+r.start+'–'+r.end+' → '+st+'–'+en+(nb!==curB?' break '+(nb?nb+' min':'normal'):'')+' ("'+why+'") via Time sheets');return '';}
function brkSel(){return '<select name="brk" aria-label="Break"><option value="keep">Break: keep as is</option>'+BRK.map(function(b){return '<option value="'+b[0]+'">'+b[1]+'</option>';}).join('')+'</select>';}
function form(title,sub,keys,d){return '<h2>'+E(title)+'</h2><p class="small">'+sub+'</p><form data-form="tsreq" id="tsform"><input type="hidden" name="keys" value="'+E(keys.join(','))+'"><input type="hidden" name="d" value="'+E(d)+'">'+
  '<div class="row"><label>Start <input type="time" name="start"></label><label>Finish <input type="time" name="end"></label></div><p class="small muted">Leave start / finish empty to keep each worker\'s own time.</p>'+
  '<textarea name="comment" placeholder="Short reason (required)" required style="min-height:50px"></textarea><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button id="tsgo">Send to office</button></div></form>'+
  '<p class="small muted">The office checks it. Until they answer, the original hours stay on your bill.</p>';}
ACT.tsall=function(el){var d=el.dataset.d;if(!canChangeDay(d)){toast('Locked: contact the office.');return;}var R=(rowsWeek(ME,wk(d))[d]||[]).filter(function(r){return !pend(r)&&hcState(r)!=='final';});if(!R.length){toast('Every worker that day is already waiting for the office.');return;}
  modal(form('All workers · '+shortDay(d),'Sets the same start and / or finish time for <b>'+R.length+(R.length===1?' worker':' workers')+'</b> this day. Each becomes a change request for the office.',R.map(function(r){return r.key;}),d));};
ACT.tsone=function(el){var r=(PAGE_STATE.frRows||{})[el.dataset.key];if(!r)return;if(!canChangeDay(r.date)){toast('Locked: contact the office.');return;}
  modal(form('Worker #'+r.no+' · '+shortDay(r.date),E(r.site)+' · now '+E(r.start)+'–'+E(r.end),[r.key],r.date));var f=document.getElementById('tsform');if(f){f.start.value=r.start;f.end.value=r.end;}};
ACT.firmedit=function(el){var r=(PAGE_STATE.frRows||{})[el.dataset.key],s=S();if(r){s.d=r.date;s.ws=wk(r.date);}location.hash='#/timesheets';};  /* old button → Time sheets */
FORMS.tsreq=function(f,d){if(!ME||ME.type!=='firm')return;var why=String(d.comment||'').trim();if(why.length<3){toast('Please write a short reason.');return;}
  var bm=null,n=0,errs={};String(d.keys||'').split(',').forEach(function(k){var r=(PAGE_STATE.frRows||{})[k];if(!r)return;var e=mkReq(r,d.start,d.end,bm,why);if(!e)n++;else errs[e]=(errs[e]||0)+1;});
  if(!n){toast(errs.same?'You did not change anything.':errs.locked?'Locked: contact the office.':Object.keys(errs)[0]||'Nothing sent.');return;}
  notify('admin','Farm change to review: '+ME.name+' sent '+n+' change request'+(n===1?'':'s')+' for '+d.d+' (Time sheets).');save();closeModal();S().d=d.d;render();
  modal('<div class="hc-sent" id="tssent" role="status"><div class="hc-tick" aria-hidden="true">✓</div><h2>Sent.</h2><p class="hc-big">'+n+' change request'+(n===1?'':'s')+' sent. Status: <span class="pill s-pend">Waiting for office</span></p><p>Until the office answers, the original hours stay on your bill.</p><div class="hc-btns"><button data-act="closeModal">OK</button></div></div>');};
/* office approval applies the chosen break (jobpos1 store) */
(function(){var od=ACT.fcdec;if(!od)return;ACT.fcdec=function(el){var c=DB.changes.filter(function(x){return x.id===el.dataset.id;})[0];var r=od.apply(this,arguments);
  try{if(c&&c.propBrkMin!=null&&c.status==='Approved'){var l=DB.shiftJobs=DB.shiftJobs||[],j=l.filter(function(x){return x.key===c.key;})[0];if(!j){j={id:c.key,key:c.key,site:c.site,date:c.date,pos:'labour'};l.push(j);}j.brk=c.propBrkMin;j.by=ME.name;j.at=new Date().toISOString();save();render();}}catch(e){}return r;};})();
/* ---------- approve day / week ---------- */
function approve(d){var f=ME,R=(rowsWeek(f,wk(d))[d]||[]);if(!R.length||dayOk(f,d))return 0;var ex=R.filter(pend).map(function(r){return r.key;}),okR=R.filter(function(r){return ex.indexOf(r.key)<0;}),ppl={};okR.forEach(function(r){ppl[r.uid]=1;});
  L().push({id:'day|'+f.id+'|'+d,kind:'day',firmId:f.id,date:d,workers:Object.keys(ppl).length,hours:Math.round(okR.reduce(function(a,r){return a+(r.bill||0);},0)*100)/100,keys:okR.map(function(r){return r.key;}),excluded:ex,by:f.username||f.name,at:new Date().toISOString()});return 1;}
ACT.tsokday=function(el){var d=el.dataset.d;if(approve(d)){audit('Farm approved day',ME.name,d);save();toast('Day approved. Thank you.');}S().d=d;render();};
ACT.tsokweek=function(){var ws=S().ws||wk(today()),n=0;for(var i=0;i<7;i++){var d=addDays(ws,i);if(d<=today())n+=approve(d);}if(n){audit('Farm approved week',ME.name,ws+' ('+n+' days)');save();}toast(n?n+(n===1?' day':' days')+' approved.':'Nothing left to approve this week.');render();};
/* ---------- reminders (queued when the app opens; deduped by key) ---------- */
function crewDays(f,from,to){var by={};(firmReport(f,from,to).shiftRows||[]).forEach(function(r){var x=by[r.date]=by[r.date]||{n:{},h:0};x.n[r.uid]=1;x.h+=r.bill||0;});return by;}
function remind(){if(!ME||!(ME.type==='firm'||ME.type==='admin'))return;var t=today();if(PAGE_STATE.tsRemDone===t+'|'+ME.id)return;PAGE_STATE.tsRemDone=t+'|'+ME.id;
  var firms=ME.type==='firm'?[ME]:users('firm').filter(function(f){return f.firm&&firmCodes(f).length;}),from=addDays(t,-14),q=0;
  firms.forEach(function(f){var by=crewDays(f,from,t),mode=remindOf(f);
    if(mode==='daily')Object.keys(by).sort().forEach(function(d){if(dayOk(f,d))return;var x=by[d],n=Object.keys(x.n).length;var before=DB.notes.length;notify(f.id,'Your crew worked '+shortDay(d)+' ('+n+(n===1?' worker':' workers')+', '+h2(x.h)+' h). Review and approve in Time sheets.','tsday|'+f.id+'|'+d);if(DB.notes.length>before)q++;});
    else{var lw=addDays(wk(t),-7),days=Object.keys(by).filter(function(d){return d>=lw&&d<wk(t)&&!dayOk(f,d);});if(days.length){var n2={},h=0;days.forEach(function(d){Object.keys(by[d].n).forEach(function(u){n2[u]=1;});h+=by[d].h;});var b4=DB.notes.length;
      notify(f.id,'Week of '+shortDay(lw)+': your crew worked '+days.length+(days.length===1?' day':' days')+' ('+Object.keys(n2).length+' workers, '+h2(h)+' h). Review and approve in Time sheets.','tswk|'+f.id+'|'+lw);if(DB.notes.length>b4)q++;}}});
  if(q)save();}
window.tsRemind=remind;
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{remind();}catch(e){}};})();
/* farm home: the old shift list + ask-to-change becomes a pointer to Time sheets */
(function(){var ot=firmShiftTable;firmShiftTable=function(firm,R,canEdit){if(!ME||ME.type!=='firm')return ot.apply(this,arguments);var t=today(),by=crewDays(firm,addDays(t,-14),t),w=Object.keys(by).filter(function(d){return !dayOk(firm,d);}).length,p=DB.changes.filter(function(c){return c.firmId===firm.id&&c.status==='Pending';}).length;
  return '<div class="card ts-home" id="tshome"><h2 class="hc-h2" style="margin-top:0">Time sheets</h2><p>Check each day\'s hours, ask for changes and approve days in <b>Time sheets</b>.</p>'+(w?'<p><span class="pill s-pend">'+w+(w===1?' day':' days')+' to approve</span></p>':'')+(p?'<p><span class="pill s-pend">'+p+' waiting for office</span></p>':'')+'<p><a class="btn" href="#/timesheets" id="tsgohome">Open Time sheets</a></p></div>';};})();
/* ---------- office: approval state ---------- */
function okCard(){var t=today(),from=addDays(t,-13),rows=[];users('firm').filter(function(f){return f.firm&&firmCodes(f).length;}).forEach(function(f){var by=crewDays(f,from,t);Object.keys(by).forEach(function(d){rows.push({f:f,d:d,x:by[d],ok:dayOk(f,d)});});});
  rows.sort(function(a,b){return b.d.localeCompare(a.d)||String(a.f.name).localeCompare(b.f.name);});var oh=typeof window.ohIs==='function'&&window.ohIs();
  return '<div class="card" id="tsoffice"><h2 style="margin-top:0">Farm day approvals (last 14 days)</h2><div class="small ts-note">Farms approve their crew\'s days in Time sheets. This is separate from payroll: pay still waits for the office\'s own approval. Invoices include all hours either way.</div>'+
   (rows.length?'<div class="tw"><table class="no-stack"><tr><th>Day</th><th>Farm</th><th style="text-align:right">Workers</th><th style="text-align:right">Hours</th><th>Farm approval</th></tr>'+rows.map(function(r){var n=Object.keys(r.x.n).length;
     return '<tr><td>'+E(shortDay(r.d))+'</td><td>'+E(oh?(firmCodes(r.f)[0]||''):r.f.name)+'</td><td style="text-align:right">'+n+'</td><td style="text-align:right">'+h2(r.x.h)+'</td><td>'+(r.ok?'<span class="pill s-ok">Approved by farm</span>'+(r.ok.excluded&&r.ok.excluded.length?' <span class="small">('+r.ok.excluded.length+' left out: change waiting)</span>':''):'<span class="pill s-pend">Not yet</span>')+'</td></tr>';}).join('')+'</table></div>':'<p class="small muted">No crew hours in the last 14 days.</p>')+'</div>';}
(function(){var ov=VIEWS['admin:farmchanges'];if(!ov)return;VIEWS['admin:farmchanges']=function(){var x=ov.apply(this,arguments);try{return x+okCard();}catch(e){return x;}};})();
/* ---------- farm My invoices: by work month ---------- */
function groupInv(){var l=document.getElementById('myinvlist');if(!l||l.dataset.ts||typeof window.ibMonthOf!=='function')return;l.dataset.ts='1';var G={};
  [].slice.call(l.querySelectorAll(':scope > .invcard')).forEach(function(c){var i=(DB.clientInvoices||[]).filter(function(x){return String(x.number)===c.getAttribute('data-inv')&&x.firmId===ME.id;})[0]||(DB.clientInvoices||[]).filter(function(x){return String(x.number)===c.getAttribute('data-inv');})[0];var m=i?window.ibMonthOf(i):'';(G[m]=G[m]||{c:[],t:0}).c.push(c);G[m].t+=i?(+i.total||0):0;});
  var MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
  Object.keys(G).sort().reverse().forEach(function(m,ix){var d=document.createElement('details');d.className='ts-invm';if(ix===0)d.open=true;d.setAttribute('data-m',m);
    d.innerHTML='<summary><b>'+(m?MN[+m.slice(5,7)-1]+' '+m.slice(0,4)+' work':'No date')+'</b> <span class="small">· '+G[m].c.length+(G[m].c.length===1?' invoice':' invoices')+' · Total '+money(G[m].t)+'</span></summary>';G[m].c.forEach(function(c){d.appendChild(c);});l.appendChild(d);});}
new MutationObserver(function(){try{if(ME&&ME.type==='firm')groupInv();}catch(e){}}).observe(document.documentElement,{childList:true,subtree:true});
})();
