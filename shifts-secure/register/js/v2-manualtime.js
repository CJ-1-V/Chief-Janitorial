/* v2-manualtime.js – "Add hours manually" (owner request Oct 4 2026, 23:57). TEST ONLY. Additive wrappers; loaded last.
   - Office (Owner / Admin / Payroll administrator) adds a timesheet entry for any worker or employee: worker, site code, date,
     start, finish (finish earlier than start = next day, "+1 day"), unpaid break, quarter-hour times, reason (+ note).
     Bulk mode: several workers, same site/date/times (e.g. a crew from a paper timesheet).
   - Office entries count as approved: they feed hours, the Wagepoint payroll CSV and client billing, marked "Manual".
   - Office can edit or void an entry with a reason. Nothing is hard-deleted: a voided entry moves to DB.timeVoided with
     who/when/why; every change is in the audit log and in the entry's own history (old → new).
   - Crew leads send manual hours for their crew to the office: they go into the existing Late entries queue as PENDING and are
     not billed or paid until approved (same approve / adjust / reject flow).
   - Guardrails: no overlap with the worker's other entries (blocked), not in the future (blocked), over 12 h (warning),
     pay period already exported / client month already invoiced (warning + confirmation), driver / forklift licence rule
     (warning only – past dates).
   - Client logins see manual entries on their sites tagged "Manual" (no office notes, no names). Employees / workers / crew leads
     only ever see site codes. Office screens may add the client name next to the code. */
'use strict';
(function(){
/* Live safety switch: in the real (Supabase) app this stays OFF until migration 016i is applied and store-config.js sets
   manualTime:true (staged bundle). Then voids / payroll-export records have their own tables and clients never get office notes. */
if(window.REG_STORE&&window.REG_STORE.mode==='supabase'&&!window.REG_STORE.manualTime){window.MT_OFF=true;return;}
var MT_REASONS=[['forgot','Forgot to clock in/out'],['phone','Phone / app problem'],['paper','Paper timesheet'],['correction','Correction'],['other','Other (explain in the note)']];
var MT_ROLES=['owner','admin','payroll','billing']; /* test app: Owner / Payroll administrator; live staff roles: owner, admin, billing (= payroll) */
var MT_WARN_H=12;
function mtCan(u){u=u||ME;return !!u&&u.type==='admin'&&(MT_ROLES.indexOf(u.officeRole)>=0||(typeof officeRoleOf==='function'&&MT_ROLES.indexOf(officeRoleOf(u))>=0)||(u.officeRoles||[]).some(function(r){return MT_ROLES.indexOf(r)>=0;}));}
function mtReason(k){var r=MT_REASONS.filter(function(x){return x[0]===k;})[0];return r?r[1].replace(/ \(explain in the note\)/,''):(k||'');}
function mtEntry(id){return DB.time.filter(function(t){return t.id===id;})[0]||null;}
function mtTag(){return '<span class="pill s-manual">Manual</span>';}
/* office-only label: site code + client name (real name if the client record has one). Never used on worker screens. */
function mtClientName(code){var f=siteFirm(code);if(!f)return '';var real=f.realName||f.clientRealName||(f.firm&&(f.firm.realName||f.firm.clientRealName))||'';return real||f.name||'';}
function mtOfficeSite(code){var n=mtClientName(code);return code+(n?' – '+n:'');}
function mtSites(){return (typeof companySites==='function'?companySites({withFirm:true,skipPractice:true,activeOnly:true}):DB.sites.filter(function(s){return s.firmId&&s.code!=='TEST-PRACTICE'&&s.active!==false;}));}
function mtPeople(){return DB.users.filter(function(u){return (u.type==='employee'||u.type==='worker')&&u.accountApproved!==false;}).sort(function(a,b){return a.name<b.name?-1:1;});}
function mtWho(u){return u.type==='employee'?'UnScramble employee':employerName(u);}
/* 96 quarter-hour choices – the only times you can pick */
function mtTimeSel(name,label,val,o){o=o||{};var x='';for(var m=0;m<1440;m+=15){var v=pad(Math.floor(m/60))+':'+pad(m%60);x+='<option value="'+v+'"'+(v===val?' selected':'')+'>'+v+'</option>';}
  return '<div><label class="req">'+esc(label)+'</label><select name="'+name+'" class="mt-time" required'+(o.form?' form="'+o.form+'"':'')+'>'+x+'</select></div>';}
function mtBreakSel(val){return '<div><label class="req">Unpaid break</label><select name="brk" required><option value="taken"'+(val!=='none'?' selected':'')+'>Break taken ('+breakRuleText()+')</option><option value="none"'+(val==='none'?' selected':'')+'>No break taken (nothing deducted)</option></select></div>';}
function mtReasonSel(val,label){return '<div><label class="req">'+esc(label||'Reason')+'</label><select name="reason" required><option value="">– choose –</option>'+MT_REASONS.map(function(r){return '<option value="'+r[0]+'"'+(r[0]===val?' selected':'')+'>'+esc(r[1])+'</option>';}).join('')+'</select></div>';}
function mtSpan(a,b){return esc(a)+'–'+esc(b)+plus1H(a,b);}
function mtPaid(t){var w=hrs(t['in'],t.out);return w-unpaidBreak(w,t);}

/* ---------- checks shared by add / edit / crew lead ---------- */
function mtExported(date){return (DB.payExports||[]).filter(function(x){return x.start<=date&&date<=x.end;})[0]||null;}
function mtInvoiced(site,date){var f=firmOfSite(site);if(!f)return null;return (DB.clientInvoices||[]).filter(function(i){return i.firmId===f.id&&i.periodStart&&i.periodStart<=date&&date<=(i.periodEnd||i.periodStart);})[0]||null;}
function mtLicenceWarn(u,date){try{var jr=jobRoleOf(u),role=jr==='driver'?'driver':(jr==='forklift'||jr==='binpiler')?'forklift':'';if(!role)return [];
  return blockers(u,date,{role:role,date:date}).filter(function(b){return /^(Driver|Forklift)/.test(b.m);}).map(function(b){return 'Licence rule for '+u.name+' on '+date+': '+b.m.replace(/your /,'')+' (past date – allowed, but check it).';});}catch(e){return [];}}
function mtCheck(u,d,exceptId){var E=[],W=[];
  if(!u){E.push('Pick a worker.');return {E:E,W:W};}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))E.push('Pick the shift date.');
  else if(d.date>today())E.push('The date cannot be in the future.');
  if(!mtSites().some(function(s){return s.code===d.site;}))E.push('Pick a site.');
  if(!quarterOk(d['in'])||!quarterOk(d.out))E.push('Use quarter-hour times (:00, :15, :30, :45).');
  else if(spanErr(d['in'],d.out))E.push(spanErr(d['in'],d.out));
  if(E.length)return {E:E,W:W};
  if(hmMsLocal(d.date,d['in'])+hrs(d['in'],d.out)*3600000>Date.now())E.push('This shift would end in the future ('+d.date+' '+d['in']+'–'+d.out+plus1(d['in'],d.out)+'). Hours can only be added after they are worked.');
  if(overlapsAny(u.id,d.date,d['in'],d.out,exceptId))E.push(u.name+' already has hours that overlap '+d.date+' '+d['in']+'–'+d.out+plus1(d['in'],d.out)+'.');
  if(hrs(d['in'],d.out)>MT_WARN_H)W.push(u.name+': '+hrs(d['in'],d.out).toFixed(2)+' hours is more than '+MT_WARN_H+' hours.');
  var ex=u.type==='employee'&&mtExported(d.date);if(ex)W.push('The pay period '+ex.start+' to '+ex.end+' was already exported for Wagepoint ('+fmtStamp(ex.at)+' by '+ex.by+'). Payroll must be re-exported or corrected in Wagepoint.');
  var inv=mtInvoiced(d.site,d.date);if(inv)W.push('The client invoice '+inv.number+' for '+inv.periodStart+' to '+(inv.periodEnd||'')+' is already issued. These hours will go on the client\'s next invoice as a late entry.');
  mtLicenceWarn(u,d.date).forEach(function(w){W.push(w);});
  if(u.active===false)W.push(u.name+' is switched off (inactive).');
  return {E:E,W:W};}
function mtCrewShift(uid0,site,date){return DB.shifts.filter(function(s){return s.kind==='crew'&&!s.test&&s.site===site&&s.date===date&&(s.booked||[]).indexOf(uid0)>=0&&!DB.time.some(function(t){return t.userId===uid0&&t.shiftId===s.id&&!t.test;});})[0]||null;}
function mtNew(u,d,src){var now=new Date().toISOString(),sh=mtCrewShift(u.id,d.site,d.date);
  var t={id:uid('t'),userId:u.id,site:d.site,shiftId:sh?sh.id:null,role:jobRoleOf(u),date:d.date,in:d['in'],out:d.out,clock:false,manual:true,manualSource:src,manualReason:d.reason,manualNote:d.note||'',manualBy:ME.id,manualByName:ME.name,manualAt:now,addedAt:now,daysLate:daysBetween(d.date,today()),breakMissed:d.brk==='none',test:false,note:'',lateEntry:'',manualHistory:[{at:now,by:ME.name,action:'added',reason:mtReason(d.reason)+(d.note?' – '+d.note:'')}]};
  if(u.subId)t.subId=u.subId;if(d.bulkId)t.bulkId=d.bulkId;return t;}
function mtShow(id,list,cls){var b=document.getElementById(id);if(b){b.innerHTML=list.length?'<div class="alert '+cls+' small"><ul>'+list.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul></div>':'';}}
/* returns true when it is OK to save (no errors, and warnings – if any – confirmed with the tick box) */
function mtGate(f,E,W,box){mtShow(box,E.length?E:W,E.length?'bad':'warn');var c=f.querySelector('.mt-confirm');
  if(E.length){toast(E[0]);if(c)c.hidden=true;return false;}
  if(W.length){if(c)c.hidden=false;var tick=f.querySelector('[name=confirmWarn]');if(!tick||!tick.checked){toast('Please read the warning'+(W.length>1?'s':'')+' and tick "I checked this – save anyway".');return false;}}
  return true;}
function mtConfirmBox(){return '<div class="mt-confirm" hidden><label class="inline"><input type="checkbox" name="confirmWarn" value="1"> <span><b>I checked this – save anyway</b></span></label></div>';}

/* ---------- office page ---------- */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/lateentries')return i+1;return NAV.admin.length;})(),0,['#/manualtime','Manual hours']);
if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){if(g[0]==='Daily work'&&g[1].indexOf('#/manualtime')<0)g[1].splice(Math.max(0,g[1].indexOf('#/lateentries')+1),0,'#/manualtime');});
function mtForm(){var bulk=PAGE_STATE.mtMode==='bulk',P=mtPeople(),last=PAGE_STATE.mtLast||{};
  var groups={};P.forEach(function(u){var g=u.type==='employee'?'UnScramble employees':'Subcontractor workers – '+employerName(u);(groups[g]=groups[g]||[]).push(u);});
  var gk=Object.keys(groups).sort();
  var who=bulk?'<div class="mt-wfield"><label class="req">Workers (tick everyone on the timesheet)</label><div class="mt-wlist" id="mtwlist">'+gk.map(function(g){return '<div class="mt-wgrp"><div class="small muted"><b>'+esc(g)+'</b></div>'+groups[g].map(function(u){return '<label class="inline mt-w"><input type="checkbox" name="wids[]" value="'+u.id+'"> <span>'+esc(u.name)+(u.active===false?' <span class="muted">(off)</span>':'')+'</span></label>';}).join('')+'</div>';}).join('')+'</div></div>'
    :'<div><label class="req">Worker</label><select name="wid" required><option value="">– choose –</option>'+gk.map(function(g){return '<optgroup label="'+esc(g)+'">'+groups[g].map(function(u){return '<option value="'+u.id+'">'+esc(u.name)+(u.active===false?' (switched off)':'')+'</option>';}).join('')+'</optgroup>';}).join('')+'</select></div>';
  return '<div class="card hl" id="mtformcard"><div class="row mt-head"><h3 style="margin:0">Add hours manually</h3><div class="mt-modes" role="tablist"><button type="button" class="small '+(bulk?'sec':'')+'" data-act="mtmode" data-m="single" aria-pressed="'+!bulk+'">One worker</button><button type="button" class="small '+(bulk?'':'sec')+'" data-act="mtmode" data-m="bulk" aria-pressed="'+bulk+'" id="mtbulkbtn">Several workers (same times)</button></div></div>'+
  '<p class="small muted">Added by the office = approved: counts for payroll (Wagepoint) and client billing right away, marked <b>Manual</b>. Times are quarter hours; a finish earlier than the start is the next day (+1 day). Clients see "Manual" but never your note.</p>'+
  '<form data-form="manualtime" id="mtform"><input type="hidden" name="mode" value="'+(bulk?'bulk':'single')+'"><div class="grid2">'+who+
  '<div><label class="req">Site</label><select name="site" required><option value="">– choose –</option>'+mtSites().map(function(s){return '<option value="'+esc(s.code)+'"'+(s.code===last.site?' selected':'')+'>'+esc(mtOfficeSite(s.code))+'</option>';}).join('')+'</select></div>'+
  '<div><label class="req">Shift date (the day it started)</label><input type="date" name="date" required max="'+today()+'" value="'+esc(last.date||addDays(today(),-1))+'"></div>'+
  mtTimeSel('in','Start',last['in']||'07:00')+mtTimeSel('out','Finish',last.out||'15:00')+mtBreakSel(last.brk)+mtReasonSel('')+
  '<div><label>Note (required for "Other"; office only – never shown to the worker or client)</label><input type="text" name="note" maxlength="300" placeholder="e.g. paper timesheet signed by crew lead"></div></div>'+
  '<div class="small" id="mthint" aria-live="polite"></div><div id="mtwarn" aria-live="polite"></div>'+mtConfirmBox()+'<button id="mtsave">'+(bulk?'Add hours for the ticked workers':'Add hours')+'</button></form></div>';}
function mtStatus(t,voided){if(voided)return '<span class="pill s-bad">Voided</span>';if(t.lateEntry==='pending')return '<span class="pill s-pend">Waiting for office approval</span>';if(t.lateEntry==='rejected')return '<span class="pill s-bad">Rejected</span>';if(t.manualSource==='crewlead')return '<span class="pill s-ok">Approved'+(t.lateApprovedBy?' by '+esc(t.lateApprovedBy):'')+'</span>';return '<span class="pill s-ok">Approved (office entry)</span>';}
function mtRow(t,voided){var u=user(t.userId),can=mtCan()&&!voided;
  return '<tr data-id="'+t.id+'"><td><b>'+esc(u?u.name:'?')+'</b><div class="small muted">'+esc(u?mtWho(u):'')+'</div></td><td>'+esc(mtOfficeSite(t.site))+'</td><td>'+esc(t.date)+'</td><td>'+mtSpan(t['in'],t.out)+'</td><td>'+(t.breakMissed?'none':BREAK_MIN+' min')+'</td><td><b>'+mtPaid(t).toFixed(2)+'</b></td><td class="small">'+esc(mtReason(t.manualReason))+(t.manualNote?'<div class="muted">'+esc(t.manualNote)+'</div>':'')+(t.bulkId?'<div class="muted">bulk entry</div>':'')+'</td><td>'+mtTag()+' '+mtStatus(t,voided)+(t.afterExport?'<div class="small"><span class="pill s-warn">after payroll export</span></div>':'')+(voided?'<div class="small">'+esc(fmtStamp(t.voidedAt)+' by '+t.voidedBy+': '+t.voidReason)+'</div>':'')+(t.manualHistory&&t.manualHistory.length>1?'<div class="small muted">changed '+(t.manualHistory.length-1)+'×</div>':'')+'</td><td class="small">'+esc(t.manualByName||'')+(t.manualSource==='crewlead'?' (crew lead)':'')+'<br>'+esc(fmtStamp(t.manualAt))+'</td><td>'+(can?'<button class="small sec" data-act="mtedit" data-id="'+t.id+'">Edit</button> <button class="small danger" data-act="mtvoid" data-id="'+t.id+'">Void</button>':'<button class="small sec" data-act="mthist" data-id="'+t.id+'"'+(voided?' data-v="1"':'')+'>History</button>')+'</td></tr>';}
VIEWS['admin:manualtime']=function(){var flt=PAGE_STATE.mtFilter||'all';
  var act=DB.time.filter(function(t){return t.manual&&!t.test;}),vd=(DB.timeVoided||[]).filter(function(t){return t.manual;});
  var list=flt==='voided'?vd:act.filter(function(t){return flt==='all'||(flt==='pending'?t.lateEntry==='pending':t.lateEntry!=='pending'&&t.lateEntry!=='rejected');});
  list=list.slice().sort(function(a,b){return (b.date+b['in']).localeCompare(a.date+a['in']);});
  var pend=act.filter(function(t){return t.lateEntry==='pending';}).length;
  return '<h1>Manual hours</h1><p class="small muted">Hours typed in afterwards (forgot to clock, phone problem, paper timesheet, corrections). Every add, change and void is kept with who, when and why – nothing is deleted.</p>'+
  (mtCan()?mtForm():'<div class="alert info small" id="mtnoperm">Only the Owner, an Admin or Payroll (billing) can add, change or void manual hours. You can see the list.</div>')+
  (pend?'<div class="alert warn small" id="mtpend"><b>'+pend+' manual '+(pend===1?'entry':'entries')+' from crew leads waiting for approval</b> – not billed or paid until approved. <a href="#/lateentries">Open the approval queue →</a></div>':'')+
  '<div class="row mt-filters"><b>Show:</b>'+[['all','All'],['approved','Approved'],['pending','Waiting'],['voided','Voided']].map(function(o){return '<button class="small '+(flt===o[0]?'':'sec')+'" data-act="mtfilter" data-f="'+o[0]+'">'+o[1]+'</button>';}).join('')+'</div>'+
  '<div class="tw"><table id="mtlist"><tr><th>Worker</th><th>Site</th><th>Date</th><th>Time</th><th>Break</th><th>Paid hrs</th><th>Reason</th><th>Status</th><th>Entered</th><th></th></tr>'+(list.map(function(t){return mtRow(t,flt==='voided');}).join('')||'<tr><td colspan="10" class="muted">No manual hours here yet.</td></tr>')+'</table></div>';};
ACT.mtmode=function(el){PAGE_STATE.mtMode=el.dataset.m==='bulk'?'bulk':'single';render();};
ACT.mtfilter=function(el){PAGE_STATE.mtFilter=el.dataset.f;render();};
function mtHint(f){var h=f.querySelector('#mthint')||document.getElementById('mthint'),a=f['in']&&f['in'].value,b=f.out&&f.out.value;if(!h||!a||!b)return;
  if(spanErr(a,b)){h.innerHTML='<span class="pill s-bad">'+esc(spanErr(a,b))+'</span>';return;}var w=hrs(a,b),brk=f.brk&&f.brk.value==='none'?0:unpaidBreak(w,{});
  h.innerHTML='Worked <b>'+w.toFixed(2)+' h</b>'+(brk?' − break '+brk.toFixed(2)+' h':'')+' = <b>'+(w-brk).toFixed(2)+' h paid</b>'+(isOvernight(a,b)?' <span class="pill s-temp plus1">(+1 day) finishes the next day</span>':'')+(w>MT_WARN_H?' <span class="pill s-warn">over '+MT_WARN_H+' h</span>':'');}
document.addEventListener('change',function(e){var f=e.target&&e.target.form;if(f&&/^(manualtime|mtedit|mtlead)$/.test(f.dataset.form||''))mtHint(f);});
FORMS.manualtime=function(f,d){if(!mtCan()){toast('Only the Owner, an Admin or Payroll (billing) can add manual hours.');audit('Blocked: add manual hours (office role)',ME.name);save();return;}
  if(!d.reason){toast('Pick a reason.');mtShow('mtwarn',['Pick a reason.'],'bad');return;}if(d.reason==='other'&&!d.note){toast('Write a note for "Other".');mtShow('mtwarn',['Write a note for "Other".'],'bad');return;}
  var ids=d.mode==='bulk'?(d.wids||[]):(d.wid?[d.wid]:[]);if(!ids.length){toast(d.mode==='bulk'?'Tick at least one worker.':'Pick a worker.');mtShow('mtwarn',[d.mode==='bulk'?'Tick at least one worker.':'Pick a worker.'],'bad');return;}
  var E=[],W=[],people=ids.map(user).filter(Boolean);people.forEach(function(u){if(u.type!=='employee'&&u.type!=='worker'){E.push('Not a worker.');return;}var c=mtCheck(u,d);E=E.concat(c.E);c.W.forEach(function(w){if(W.indexOf(w)<0)W.push(w);});});
  if(!mtGate(f,E,W,'mtwarn'))return;
  var bulkId=people.length>1?uid('bk'):'',inv=mtInvoiced(d.site,d.date),made=[];
  people.forEach(function(u){var t=mtNew(u,{site:d.site,date:d.date,'in':d['in'],out:d.out,brk:d.brk,reason:d.reason,note:d.note,bulkId:bulkId},'office');
    if(W.length)t.manualWarnings=W.slice();if(u.type==='employee'&&mtExported(d.date))t.afterExport=mtExported(d.date).start;
    if(inv){t.lateEntry='approved';t.lateApprovedAt=today();t.lateApprovedBy=ME.name;t.lateReason='Manual entry added after the client invoice '+inv.number;t.officeEntry=true;t.enteredBy=ME.name;}
    DB.time.push(t);made.push(t);
    audit('Added manual hours'+(bulkId?' (bulk)':''),u.name,d.site+' '+d.date+' '+d['in']+'–'+d.out+plus1(d['in'],d.out)+(d.brk==='none'?' · no break':' · break taken')+' · reason: '+mtReason(d.reason)+(d.note?' ('+d.note+')':'')+(W.length?' · warnings confirmed: '+W.join(' | '):''));
    notify(u.id,'The office added hours for you: '+d.site+' on '+d.date+', '+d['in']+'–'+d.out+plus1(d['in'],d.out)+'. Questions? Contact the office.');});
  PAGE_STATE.mtLast={site:d.site,date:d.date,'in':d['in'],out:d.out,brk:d.brk};save();toast(made.length===1?'Manual hours added ✓':'Manual hours added for '+made.length+' workers ✓');render();};

/* edit / void / history (office) */
function mtHistHtml(t){return '<h3>History</h3><ul class="small mt-hist">'+(t.manualHistory||[]).map(function(h){return '<li><b>'+esc(fmtStamp(h.at))+'</b> · '+esc(h.by)+' · '+esc(h.action)+(h.old?': '+esc(h.old)+' → '+esc(h['new']):'')+(h.reason?' · reason: '+esc(h.reason):'')+'</li>';}).join('')+'</ul>';}
function mtDesc(t){return t.site+' '+t.date+' '+t['in']+'–'+t.out+plus1(t['in'],t.out)+(t.breakMissed?' no break':' break taken');}
ACT.mthist=function(el){var t=el.dataset.v?(DB.timeVoided||[]).filter(function(x){return x.id===el.dataset.id;})[0]:mtEntry(el.dataset.id);if(!t)return;var u=user(t.userId);modal('<h2>Manual hours – '+esc(u?u.name:'')+'</h2><p>'+esc(mtDesc(t))+'</p>'+mtHistHtml(t));};
ACT.mtedit=function(el){var t=mtEntry(el.dataset.id);if(!t||!t.manual)return;if(!mtCan()){toast('Not allowed for your office role.');return;}var u=user(t.userId);
  modal('<h2>Change manual hours</h2><p><b>'+esc(u?u.name:'')+'</b> · now: '+esc(mtDesc(t))+'</p><form data-form="mtedit" id="mteditform"><input type="hidden" name="id" value="'+t.id+'"><div class="grid2">'+
    '<div><label class="req">Site</label><select name="site" required>'+mtSites().map(function(s){return '<option value="'+esc(s.code)+'"'+(s.code===t.site?' selected':'')+'>'+esc(mtOfficeSite(s.code))+'</option>';}).join('')+'</select></div>'+
    '<div><label class="req">Shift date</label><input type="date" name="date" required max="'+today()+'" value="'+esc(t.date)+'"></div>'+mtTimeSel('in','Start',t['in'])+mtTimeSel('out','Finish',t.out)+mtBreakSel(t.breakMissed?'none':'taken')+
    '<div><label class="req">Why are you changing it?</label><input type="text" name="why" required maxlength="300" placeholder="e.g. crew lead corrected the paper timesheet"></div></div><div class="small" id="mthint"></div><div id="mteditwarn"></div>'+mtConfirmBox()+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button>Save change</button></div></form>'+mtHistHtml(t));};
FORMS.mtedit=function(f,d){var t=mtEntry(d.id);if(!t||!t.manual)return;if(!mtCan()){toast('Not allowed for your office role.');audit('Blocked: change manual hours (office role)',ME.name);save();return;}
  if(!d.why){toast('Write why you are changing it.');mtShow('mteditwarn',['Write why you are changing it.'],'bad');return;}var u=user(t.userId);
  if(d.site===t.site&&d.date===t.date&&d['in']===t['in']&&d.out===t.out&&(d.brk==='none')===!!t.breakMissed){toast('Nothing changed.');return;}
  var c=mtCheck(u,d,t.id);if(!mtGate(f,c.E,c.W,'mteditwarn'))return;
  var old=mtDesc(t);if(u.type==='employee'&&(mtExported(t.date)||mtExported(d.date)))t.afterExport=(mtExported(d.date)||mtExported(t.date)).start;
  t.site=d.site;t.date=d.date;t['in']=d['in'];t.out=d.out;t.breakMissed=d.brk==='none';var sh=mtCrewShift(u.id,d.site,d.date);if(t.shiftId){var os=DB.shifts.filter(function(s){return s.id===t.shiftId;})[0];if(!os||os.site!==t.site||os.date!==t.date)t.shiftId=sh?sh.id:null;}else if(sh)t.shiftId=sh.id;
  var nw=mtDesc(t),at=new Date().toISOString();(t.manualHistory=t.manualHistory||[]).push({at:at,by:ME.name,action:'changed',old:old,'new':nw,reason:d.why+(c.W.length?' (warnings confirmed: '+c.W.join(' | ')+')':'')});t.manualEditedAt=at;t.manualEditedBy=ME.name;
  audit('Changed manual hours',u.name,old+' → '+nw+' · reason: '+d.why+(c.W.length?' · warnings confirmed: '+c.W.join(' | '):''));notify(u.id,'The office changed hours for you: '+nw.replace(/ (no break|break taken)$/,'')+'.');save();closeModal();toast('Change saved ✓');render();};
ACT.mtvoid=function(el){var t=mtEntry(el.dataset.id);if(!t||!t.manual)return;if(!mtCan()){toast('Not allowed for your office role.');return;}var u=user(t.userId),W=[];
  if(u&&u.type==='employee'&&mtExported(t.date))W.push('This pay period was already exported for Wagepoint – correct it in Wagepoint too.');if(t.lateBilledInv)W.push('Already on client invoice '+t.lateBilledInv+' – voiding does not change that invoice.');
  modal('<h2>Void manual hours</h2><p><b>'+esc(u?u.name:'')+'</b> · '+esc(mtDesc(t))+'</p><p class="small">Voided hours stop counting for payroll and billing. The entry is kept (marked Voided) with who, when and why – it is never deleted.</p><form data-form="mtvoid"><input type="hidden" name="id" value="'+t.id+'">'+(W.length?'<div class="alert warn small"><ul>'+W.map(function(w){return '<li>'+esc(w)+'</li>';}).join('')+'</ul></div>':'')+
    '<label class="req">Why are you voiding it?</label><input type="text" name="why" required maxlength="300" placeholder="e.g. entered twice"><label class="inline"><input type="checkbox" name="sure" value="1" required> <span>Yes, void these hours</span></label><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button class="danger">Void</button></div></form>');};
FORMS.mtvoid=function(f,d){var t=mtEntry(d.id);if(!t||!t.manual)return;if(!mtCan()){toast('Not allowed for your office role.');audit('Blocked: void manual hours (office role)',ME.name);save();return;}if(!d.why||!d.sure){toast('Write why, and tick "Yes, void these hours".');return;}
  var u=user(t.userId),at=new Date().toISOString();DB.time=DB.time.filter(function(x){return x.id!==t.id;});t.voided=true;t.voidedAt=at;t.voidedBy=ME.name;t.voidReason=d.why;(t.manualHistory=t.manualHistory||[]).push({at:at,by:ME.name,action:'voided',reason:d.why});
  (DB.timeVoided=DB.timeVoided||[]).push(t);audit('Voided manual hours',u?u.name:'',mtDesc(t)+' · reason: '+d.why);if(u)notify(u.id,'The office removed hours entered for you: '+t.site+' on '+t.date+', '+t['in']+'–'+t.out+plus1(t['in'],t.out)+'.');save();closeModal();toast('Voided – kept in the Voided list.');render();};
ADMIN_ONLY_FORM.push('manualtime','mtedit','mtvoid');ADMIN_ONLY_ACT.push('mtedit','mtvoid','mtmode','mtfilter','mthist','paycsvpreview');

/* ---------- crew lead: send manual hours for the crew (pending → office approval queue) ---------- */
function mtLeadCrew(){return users('worker').filter(function(w){return w.subId&&w.subId===ME.subId&&w.active!==false;}).sort(function(a,b){return a.id===ME.id?-1:b.id===ME.id?1:a.name<b.name?-1:1;});}
function mtLeadSites(){var recent=DB.shifts.filter(function(s){return s.kind==='crew'&&!s.test&&(s.booked||[]).indexOf(ME.id)>=0&&s.date>=addDays(today(),-30);}).map(function(s){return s.site;});var all=mtSites().map(function(s){return s.code;});var list=recent.filter(function(c,i){return recent.indexOf(c)===i&&all.indexOf(c)>=0;});return list.length?list:all;}
function mtLeadCard(){var mine=DB.time.filter(function(t){return t.manual&&t.manualSource==='crewlead'&&t.manualBy===ME.id;}).slice(-8).reverse();
  return '<div class="card" id="mtleadcard"><h3 style="margin-top:0">Add hours manually</h3><p class="small">For crew hours that were not clocked (forgot, phone problem, paper timesheet) in the last '+CREW_FIX_DAYS+' days. They go to the office for approval and are <b>not billed until approved</b>.</p>'+
  '<form data-form="mtlead"><div class="mt-wfield"><label class="req">Workers</label><div class="mt-wlist">'+mtLeadCrew().map(function(w){return '<label class="inline mt-w"><input type="checkbox" name="wids[]" value="'+w.id+'"> <span>'+esc(w.name)+(w.id===ME.id?' (you)':'')+'</span></label>';}).join('')+'</div></div><div class="grid2">'+
  '<div><label class="req">Site</label><select name="site" required>'+mtLeadSites().map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>';}).join('')+'</select></div>'+
  '<div><label class="req">Shift date</label><input type="date" name="date" required max="'+today()+'" min="'+addDays(today(),-CREW_FIX_DAYS)+'" value="'+addDays(today(),-1)+'"></div>'+mtTimeSel('in','Start','07:00')+mtTimeSel('out','Finish','15:00')+mtBreakSel('taken')+mtReasonSel('')+
  '<div><label>Note for the office</label><input type="text" name="note" maxlength="300"></div></div><div class="small" id="mthint"></div><div id="mtleadwarn"></div>'+mtConfirmBox()+'<button class="btn-indigo">Send to the office</button></form>'+
  (mine.length?'<h4>Hours you sent</h4><ul class="small" id="mtleadlist">'+mine.map(function(t){var w=user(t.userId);return '<li>'+esc((w?w.name:'')+' · '+t.site+' '+t.date+' '+t['in']+'–'+t.out+plus1(t['in'],t.out))+' '+mtTag()+' '+(t.lateEntry==='pending'?'<span class="pill s-pend">Waiting for office</span>':t.lateEntry==='rejected'?'<span class="pill s-bad">Not approved</span>':'<span class="pill s-ok">Approved</span>')+'</li>';}).join('')+'</ul>':'')+'</div>';}
(function(){var ov=VIEWS['worker:crew'];VIEWS['worker:crew']=function(){var x=ov();return ME&&ME.crewLead?x+mtLeadCard():x;};})();
FORMS.mtlead=function(f,d){if(!ME||ME.type!=='worker'||!ME.crewLead){toast('Only crew leads can send crew hours.');return;}
  var crew=mtLeadCrew().map(function(w){return w.id;}),ids=(d.wids||[]).filter(function(id){return crew.indexOf(id)>=0;});if(!ids.length||ids.length!==(d.wids||[]).length){toast('Tick at least one worker from your crew.');mtShow('mtleadwarn',['Tick at least one worker from your crew.'],'bad');return;}
  if(mtLeadSites().indexOf(d.site)<0){toast('Pick a site.');return;}if(!d.reason){toast('Pick a reason.');mtShow('mtleadwarn',['Pick a reason.'],'bad');return;}if(d.reason==='other'&&!d.note){toast('Write a note for "Other".');return;}
  if(d.date&&daysBetween(d.date,today())>CREW_FIX_DAYS){toast('Crew hours can only be sent within '+CREW_FIX_DAYS+' days of the shift. Please contact the office.');mtShow('mtleadwarn',['Crew hours can only be sent within '+CREW_FIX_DAYS+' days of the shift. Please contact the office.'],'bad');return;}
  var E=[],W=[],people=ids.map(user);people.forEach(function(u){var c=mtCheck(u,d);E=E.concat(c.E);c.W.filter(function(w){return !/invoice|Wagepoint|Licence rule|switched off/.test(w);}).forEach(function(w){if(W.indexOf(w)<0)W.push(w);});});
  if(!mtGate(f,E,W,'mtleadwarn'))return;var bulkId=people.length>1?uid('bk'):'';
  people.forEach(function(u){var t=mtNew(u,{site:d.site,date:d.date,'in':d['in'],out:d.out,brk:d.brk,reason:d.reason,note:d.note,bulkId:bulkId},'crewlead');t.lateEntry='pending';t.clockedByName=ME.name;t.enteredBy='crew lead '+ME.name;if(W.length)t.manualWarnings=W.slice();DB.time.push(t);
    audit('Crew lead sent manual hours (waiting for office approval)',u.name,d.site+' '+d.date+' '+d['in']+'–'+d.out+plus1(d['in'],d.out)+' · reason: '+mtReason(d.reason)+(d.note?' ('+d.note+')':'')+' · by '+ME.name);});
  notify('admin','Crew lead '+ME.name+' sent manual hours for '+people.length+' worker'+(people.length>1?'s':'')+': '+d.site+' '+d.date+' '+d['in']+'–'+d.out+plus1(d['in'],d.out)+'. Not billed until you approve them (Late entries).');
  save();toast('Sent to the office for approval ✓');render();};
ROLE_ONLY.mtlead=['worker'];

/* ---------- approval queue: show "Manual" + reason ---------- */
(function(){var ov=VIEWS['admin:lateentries'];VIEWS['admin:lateentries']=function(){var x=ov();DB.time.forEach(function(t){if(!t.manual||!t.lateEntry)return;x=x.replace('<tr data-id="'+t.id+'"><td>','<tr data-id="'+t.id+'" class="mt-q"><td>'+mtTag()+' <span class="small">'+esc(mtReason(t.manualReason))+(t.manualNote?' – '+esc(t.manualNote):'')+(t.manualSource==='crewlead'?' · sent by crew lead '+esc(t.manualByName):'')+'</span><br>');});return x;};})();
(function(){var oa=FORMS.lateact;FORMS.lateact=function(f,d){var t=mtEntry(d.id),before=t?t.lateEntry:'';oa(f,d);if(t&&t.manual&&t.lateEntry!==before){(t.manualHistory=t.manualHistory||[]).push({at:new Date().toISOString(),by:ME.name,action:t.lateEntry==='approved'?(t.lateOrig?'adjusted + approved':'approved'):'rejected',old:t.lateOrig?t.lateOrig['in']+'–'+t.lateOrig.out:'','new':t.lateOrig?t['in']+'–'+t.out:'',reason:d.reason||''});save();}};})();

/* ---------- client side: "Manual" tag on shift rows and in the CSV (no notes, no names) ---------- */
(function(){var ofr=firmRows;firmRows=function(firm,from,to){var rows=ofr(firm,from,to);rows.forEach(function(r){if(r.key&&r.key.indexOf('t:')===0){var t=mtEntry(r.key.slice(2));if(t&&t.manual)r.manual=true;}});return rows;};})();
(function(){var ot=firmShiftTable;firmShiftTable=function(firm,R,canEdit){var x=ot(firm,R,canEdit),rows=R.shiftRows||[],i=-1;if(!rows.some(function(r){return r.manual;}))return x;
  return x.replace(/<tr><td>/g,function(m){i++;var r=rows[i];return r&&r.manual?'<tr class="mt-row"><td><span class="pill s-manual">Manual</span> ':m;});};})();
(function(){var oc=ACT.fcsv;ACT.fcsv=function(){var D=PAGE_STATE.frData,dl=downloadText;if(!D||!D.R)return oc();downloadText=function(name,text,mime){var lines=[['Shift lines'],['Site','Date','Worker','Start','Finish','Overnight (+1 day)','Hours worked','Billable hours','Entry']];(D.R.shiftRows||[]).forEach(function(r){lines.push([r.site,r.date,'Worker #'+r.no,r.start,r.end,isOvernight(r.start,r.end)?'Yes':'',r.hours.toFixed(2),r.bill.toFixed(2),r.manual?'Manual':'']);});return dl(name,text+'\n\n'+lines.map(csvRow).join('\n'),mime);};try{return oc();}finally{downloadText=dl;}};})();

/* ---------- worker "My shifts": Manual tag (no office notes) ---------- */
(function(){var om=myShiftsView;myShiftsView=function(){var x=om(),u=ME;if(!u)return x;var mine=DB.time.filter(function(t){return t.userId===u.id&&!t.test;}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:a.in<b.in?1:-1;}),i=-1;if(!mine.some(function(t){return t.manual;}))return x;
  return x.replace(/<tr><td>/g,function(m){i++;var t=mine[i];return t&&t.manual?'<tr class="mt-row"><td>':m;}).replace(/(<tr class="mt-row"><td>[^<]*)/g,'$1 <span class="pill s-manual">Manual</span>');};})();

/* ---------- payroll: record exports, Manual tag, CSV column, preview ---------- */
(function(){var op=ACT.paycsv;ACT.paycsv=function(){var cur=payPeriodOf(PAGE_STATE.payDate||today()),a0=DB.audit[0];var r=op();if(!PAGE_STATE.mtPreview&&DB.audit[0]&&DB.audit[0]!==a0&&/Downloaded payroll hours CSV/.test(DB.audit[0].action)){(DB.payExports=DB.payExports||[]).push({start:cur.start,end:cur.end,at:new Date().toISOString(),by:ME.name});DB.time.forEach(function(t){if(t.afterExport===cur.start)delete t.afterExport;});save();render();}return r;};})();
function mtPayLines(){
  var cur=payPeriodOf(PAGE_STATE.payDate||today()),P=payrollRows(cur.start,cur.end)||[],out=[];
  /* payrollRows returns {u,n,hours,overnight,entries} – not {lines:[{t}]} (P0 crash Oct 6) */
  P.forEach(function(r){
    var lines=r.lines||(r.entries||[]).map(function(t){return {t:t};});
    lines.forEach(function(l){var tt=l&&(l.t||l);if(tt)out.push(tt);});
  });
  return {cur:cur,P:P,lines:out};
}
(function(){var od=ACT.paycsvdetail;ACT.paycsvdetail=function(){var L=mtPayLines(),dl=downloadText;downloadText=function(name,text,mime){var rows=text.split('\n');rows=rows.map(function(line,i){return line+','+(i===0?'Entry type':(L.lines[i-1]&&L.lines[i-1].manual?'Manual':'Clock'));});return dl(name,rows.join('\n'),mime);};try{return od();}finally{downloadText=dl;}};})();
/* The Wagepoint hours CSV (import file) is left exactly as it was – manual entries are marked in the shift-details CSV ("Entry type") and in the preview. */
(function(){var ov=VIEWS['admin:payroll'];VIEWS['admin:payroll']=function(){var x=ov(),L=mtPayLines();
  L.P.forEach(function(r){var lines=r.lines||(r.entries||[]).map(function(t){return {t:t};});lines.forEach(function(l){var tt=l&&(l.t||l);if(!tt||!tt.manual)return;var s=esc(tt.date+' '+tt['in']+'–'+tt.out);var start=x.indexOf('<tr data-u="'+r.u.id+'">');if(start<0)return;var at=x.indexOf(s,start);if(at<0)return;x=x.slice(0,at+s.length)+' <span class="pill s-manual">Manual</span>'+x.slice(at+s.length);});});
  var ex=(DB.payExports||[]).filter(function(e){return e.start===L.cur.start;}).slice(-1)[0],late=DB.time.filter(function(t){return t.afterExport===L.cur.start;}).length;
  var note=(ex?'<div class="alert '+(late?'warn':'info')+' small" id="payexported">This pay period was exported for Wagepoint on '+esc(fmtStamp(ex.at))+' by '+esc(ex.by)+'.'+(late?' <b>'+late+' manual '+(late===1?'entry was':'entries were')+' added or changed after that</b> – download again and correct Wagepoint.':'')+'</div>':'');
  return x.replace('<div class="row"><button class="small" data-act="paycsv"',note+'<div class="row"><button class="small sec" data-act="paycsvpreview" id="paypreviewbtn">Preview export</button><button class="small" data-act="paycsv"');};})();
ACT.paycsvpreview=function(){var got=[],dl=downloadText,oa=audit,os=save;PAGE_STATE.mtPreview=true;downloadText=function(name,text){got.push({name:name,text:text});};audit=function(){};save=function(){};
  try{ACT.paycsv();ACT.paycsvdetail();}finally{downloadText=dl;audit=oa;save=os;PAGE_STATE.mtPreview=false;}
  if(!got.length){toast('No hours in this pay period.');return;}
  var tbl=function(g){var rows=g.text.split('\n').map(function(l){var out=[],cur='',q=false;for(var i=0;i<l.length;i++){var c=l[i];if(q){if(c==='"'&&l[i+1]==='"'){cur+='"';i++;}else if(c==='"')q=false;else cur+=c;}else if(c==='"')q=true;else if(c===','){out.push(cur);cur='';}else cur+=c;}out.push(cur);return out;});
    return '<h3>'+esc(g.name)+'</h3><div class="tw"><table class="mt-prev">'+rows.map(function(r,i){return '<tr>'+r.map(function(c){return i===0?'<th>'+esc(c)+'</th>':'<td>'+(c==='Manual'?'<span class="pill s-manual">Manual</span>':esc(c))+'</td>';}).join('')+'</tr>';}).join('')+'</table></div>';};
  modal('<h2>Payroll export preview</h2><p class="small muted">What the Wagepoint files will contain. Nothing is downloaded or marked as exported. <span class="pill s-manual">Manual</span> = hours typed in afterwards.</p>'+got.slice().reverse().map(tbl).join(''));var mm=document.querySelector('#modal .modal');if(mm)mm.classList.add('mt-wide');};
})();
