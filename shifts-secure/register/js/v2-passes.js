/* v2-passes.js – 14-day document pass (merged with the old temporary mode) for subcontractors AND their workers;
   extendable repeatedly, each extension logged (who, when, reason). Document statuses Complete / Pending / On 14-day pass. TEST ONLY. */
'use strict';
function passHolder(u){return u.type==='sub'?(u.company=u.company||{}):u;}
tempInfo=function(s){if(!s)return null;var h=s.type==='sub'?(s.company||{}):s,t=h.temp;if(!t||!t.on)return null;var left=daysBetween(today(),t.end);return {t:t,left:left,active:left>=0};};
tempBadge=function(s){var i=tempInfo(s);if(!i||!i.active)return '';return '<span class="badge-temp">14-DAY PASS · ends '+esc(i.t.end)+' ('+(i.left===0?'last day':i.left+' day'+(i.left===1?'':'s')+' left')+')</span>';};
var WORKER_PASS_KEYS=['driver_abstract','forklift','forklift_years','originals'];
function workerDocIssues(w){return requirements(w).filter(function(r){return WORKER_PASS_KEYS.indexOf(r.key)>=0&&!r.ok;});}
function workerDocsComplete(w){return workerDocIssues(w).length===0;}
function passIssues(u){return u.type==='sub'?companyBlockersRaw(u).filter(function(m){return TEMP_EXEMPT.test(m);}):workerDocIssues(u).map(function(r){return r.label;});}
/* worker pass: missing licences/originals don't block general work; role-specific licence checks on driver/forklift/food plant shifts stay (safety) */
(function(){var ob=blockers;blockers=function(u,date,shift){var b=ob(u,date,shift);if(u.type==='worker'&&tempActive(u,date||today())){var labels=requirements(u).filter(function(r){return WORKER_PASS_KEYS.indexOf(r.key)>=0;}).map(function(r){return r.label;});b=b.filter(function(x){return !labels.some(function(l){return x.m.indexOf(l)===0;});});}return b;};})();
(function(){var orq=requirements;requirements=function(u){var R=orq(u);var i=tempInfo(u);if(i&&i.active){R.forEach(function(r){var docish=u.type==='sub'?['wcb_clearance','cgl','auto','agency_licence','approved'].indexOf(r.key)>=0:WORKER_PASS_KEYS.indexOf(r.key)>=0;if(docish&&!r.ok){r.st={s:'On 14-day pass',c:'s-temp',ex:i.t.end};r.msg='Covered by a 14-day pass until '+i.t.end+' ('+i.left+' days left). Complete it before then. '+(r.msg||'');}});}return R;};})();
processTemp=function(){var changed=false;
  users('sub').concat(users('worker')).forEach(function(s){var i=tempInfo(s);if(!i)return;var h=passHolder(s),nm=s.type==='sub'?(s.company.legalName||s.name):s.name;
    if(i.left<0){var t=h.temp;t.on=false;t.expiredAt=today();(h.tempHistory=h.tempHistory||[]).push({what:'Expired automatically',at:new Date().toISOString(),end:t.end,reason:t.reason,by:'system'});
      var ok=s.type==='sub'?companyCompliant(s):workerDocsComplete(s);notify(['admin',s.id].concat(s.subId?[s.subId]:[]),'14-day document pass for '+nm+' ended on '+t.end+'. '+(ok?'Documents are complete – normal rules apply.':'Documents are still NOT complete, so '+(s.type==='sub'?'they and all their workers are':'this worker is')+' blocked again until fixed.'),'tmpx|'+s.id+'|'+t.end);
      audit('14-day pass expired',nm,ok?'complete':'blocked again');changed=true;return;}
    var m=currentMark(i.left,[7,3,1]);if(m!==null)notify(['admin',s.id],'14-day document pass for '+nm+' ends on '+i.t.end+' ('+i.left+' day'+(i.left===1?'':'s')+' left). Still missing: '+(passIssues(s).join(', ')||'nothing – complete now')+'.','tmpa|'+s.id+'|'+i.t.end+'|'+m);});
  return changed;};
tempBox=function(s){var i=tempInfo(s);if(!i||!i.active)return '';var miss=passIssues(s);return '<div class="alert warn temp-box">'+tempBadge(s)+'<div style="margin-top:6px"><b>14-day document pass</b> given by the UnScramble office on '+esc(i.t.start)+': <i>'+esc(i.t.reason)+'</i>.</div><div>'+(s.type==='sub'?'Your crews can keep working':'You can keep working')+' until <b>'+esc(i.t.end)+'</b> (<b>'+(i.left===0?'last day':i.left+' day'+(i.left===1?'':'s')+' left')+'</b>). Pay is <b>held</b> during the pass and released when the documents are complete.</div>'+(miss.length?'<div style="margin-top:6px"><b>Complete before '+esc(i.t.end)+':</b><ul style="margin:4px 0 0 16px;padding:0">'+miss.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul></div>':'<div><b>Documents complete.</b> Held pay is released.</div>')+'</div>';};
tempSection=function(u){var h=passHolder(u),i=tempInfo(u),raw=passIssues(u),hist=h.tempHistory||[],nm=u.type==='sub'?(u.company.legalName||u.name):u.name;
  var x='<div class="card temp-card" id="temp-'+u.id+'"><div class="row"><b>'+esc(nm)+'</b> <span class="small muted">'+esc(TYPES[u.type])+(u.subId?' · '+esc(employerName(u)):'')+'</span>'+(i&&i.active?tempBadge(u):'<span class="pill '+(raw.length?'s-bad':'s-ok')+'">'+(raw.length?'Documents incomplete':'Complete')+'</span>')+'</div>';
  if(raw.length)x+='<div class="small" style="margin:4px 0">Incomplete: '+esc(raw.join(' · '))+'</div>';
  if(i&&i.active){x+='<div class="small">Pass since '+esc(i.t.start)+' by '+esc(i.t.by)+' · Reason: <i>'+esc(i.t.reason)+'</i>'+(i.t.extensions?' · '+i.t.extensions+' extension(s)':'')+(u.type==='sub'?' · Pay on hold: <b>'+money(heldAmount(u))+'</b>':'')+'</div><form data-form="tempext" style="margin-top:6px"><input type="hidden" name="id" value="'+u.id+'"><div class="grid2">'+inp('end','Extend to (default +14 days)',addDays(i.t.end,14),{type:'date',req:true})+inp('reason','Reason for the extension (required, logged)','',{req:true})+'</div><button class="small">Extend pass</button> <button class="small danger" type="button" data-act="tempoff" data-id="'+u.id+'">End pass now</button></form>';}
  else x+='<form data-form="tempon" style="margin-top:6px"><input type="hidden" name="id" value="'+u.id+'"><div class="grid2">'+inp('end','Pass end date (default 14 days – can be extended, no maximum)',addDays(today(),14),{type:'date',req:true,extra:' min="'+today()+'"'})+inp('reason','Reason (required)','',{req:true,ph:'e.g. insurance renewal in progress'})+'</div><div class="hint">While on, missing/expired documents do not block work. Pay is held until the documents are complete. Ends automatically – if still incomplete they are blocked again. '+(u.type==='worker'?'Driver and forklift shifts still check the driver\'s abstract and forklift certificate (safety).':'')+'</div><button class="small">Give 14-day pass</button></form>';
  if(hist.length)x+='<details class="small" open><summary>Pass history (who, when, reason)</summary><ul class="passhist">'+hist.slice().reverse().map(function(e){return '<li>'+fmtStamp(e.at)+' – <b>'+esc(e.what)+'</b>'+(e.from?' from '+esc(e.from):'')+(e.end?' → ends '+esc(e.end):'')+(e.reason?' – '+esc(e.reason):'')+' – '+esc(e.by)+'</li>';}).join('')+'</ul></details>';
  return x+'</div>';};
FORMS.tempon=function(f,d){var u=user(d.id),h=passHolder(u),nm=u.type==='sub'?h.legalName:u.name;if(!d.reason){toast('A reason is required.');return;}if(!d.end||d.end<today()){toast('Choose an end date from today on.');return;}
  h.temp={on:true,start:today(),end:d.end,reason:d.reason,by:ME.name,at:new Date().toISOString(),extensions:0};(h.tempHistory=h.tempHistory||[]).push({what:'Pass given',at:h.temp.at,end:d.end,reason:d.reason,by:ME.name});
  if(u.type==='sub')DB.invoices.forEach(function(i){if(i.subId===u.id&&!i.test&&i.status!=='Paid')i.heldTemp=true;});
  if(u.type==='worker')DB.invoices.forEach(function(i){if(i.subId===u.subId&&!i.test&&i.status!=='Paid'){i.heldTemp=true;i.heldWorkers=(i.heldWorkers||[]).concat(i.heldWorkers&&i.heldWorkers.indexOf(u.id)>=0?[]:[u.id]);}});
  notify([u.id].concat(u.subId?[u.subId]:[]),'UnScramble gave '+nm+' a 14-day document pass until '+d.end+' ('+d.reason+'). Work can continue; pay is held until documents are complete.');
  audit('Gave 14-day document pass',nm,'until '+d.end+': '+d.reason);save();toast('14-day pass on until '+d.end+'.');render();};
FORMS.tempext=function(f,d){var u=user(d.id),h=passHolder(u),t=h.temp,nm=u.type==='sub'?h.legalName:u.name;if(!t||!t.on){toast('No active pass.');return;}if(!d.reason){toast('A reason is required for every extension.');return;}if(!d.end||d.end<=t.end){toast('Choose a date after the current end ('+t.end+').');return;}
  var from=t.end;t.end=d.end;t.extensions=(t.extensions||0)+1;h.tempHistory.push({what:'Extended',from:from,at:new Date().toISOString(),end:d.end,reason:d.reason,by:ME.name});
  audit('Extended 14-day pass',nm,from+' → '+d.end+': '+d.reason);notify([u.id].concat(u.subId?[u.subId]:[]),'Your 14-day document pass was extended to '+d.end+' ('+d.reason+').');save();toast('Pass extended to '+d.end+'.');render();};
ACT.tempoff=function(el){var u=user(el.dataset.id),h=passHolder(u),t=h.temp;t.on=false;h.tempHistory.push({what:'Ended early by office',at:new Date().toISOString(),end:t.end,by:ME.name});audit('Ended 14-day pass',u.name);notify(u.id,'Your 14-day document pass was ended by the office.');sweepBookings();save();closeModal();render();};
ACT.passmodal=function(el){var u=user(el.dataset.id);modal('<h2>14-day document pass</h2>'+tempSection(u));};
/* re-render the open pass modal after a pass form is saved */
['tempon','tempext'].forEach(function(k){var of=FORMS[k];FORMS[k]=function(f,d){var inModal=!!f.closest('#modal');of(f,d);if(inModal){var u=user(d.id);modal('<h2>14-day document pass</h2>'+tempSection(u));}};});

/* paymentHold wording for the merged pass */
(function(){var op=paymentHold;paymentHold=function(s){return op(s).map(function(m){return m.replace(/Practice \/ temporary mode is on until/,'14-day document pass is on until').replace('from the temporary period','from the 14-day pass period');});};})();

/* statuses */
var PILL_LABEL={'Valid':'Complete','Done':'Complete','Expiring soon':'Complete – expiring soon','Pending review':'Pending'};
pill=function(st){return '<span class="pill '+st.c+'">'+esc(PILL_LABEL[st.s]||st.s)+(st.s==='On 14-day pass'&&st.ex?' · ends '+esc(st.ex):'')+'</span>';};
function docState(u,k){var d=latestDoc(u.id,k),st=docStatus(d);if(k==='wcb_clearance'&&u.type==='sub'&&!wcbRequired(u))return {d:d,st:{s:'Not required yet',c:'s-ok'}};
  var i=tempInfo(u);if(i&&i.active&&['Missing','Expired','Pending review'].indexOf(st.s)>=0)return {d:d,st:{s:'On 14-day pass',c:'s-temp',ex:i.t.end},passLeft:i.left,raw:st};
  return {d:d,st:st};}
