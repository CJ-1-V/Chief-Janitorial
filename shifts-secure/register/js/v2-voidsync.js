/* v2-voidsync.js – voidsync1 (owner Oct 9 2026, 10:44 AM): "make sure hours voided or removed by office reflect in employee and farm
   side as well and also give office or employee [the ability] to remove any existing shift". TEST COPY. Load right before v2-nohome.js.

   ONE way to remove hours: the time entry is KEPT and marked removed (data.removed = true, who / when / why, history). Nothing is
   hard-deleted, so every screen can show the same thing:
   - totals, CSVs, payroll, client billing / invoice previews, worker-hours and late-entry lists never count removed hours
     (while any screen or action runs, removed entries are taken out of DB.time; they are put back right after, in the same order);
   - the person (employee / worker / crew lead), their subcontractor and the farm see the shift struck through:
     "Removed by office" (+ the office's reason for the worker and the subcontractor – client names are scrubbed out of it;
     farms never see the reason or any name);
   - a removed crew-lead / office entry that belonged to a crew booking no longer falls back to the SCHEDULED crew hours
     (that fallback made removed hours come back on the farm and subcontractor screens);
   - "Not approved" (rejected) late entries are also left out of payroll, My shifts totals and workers' hours (farm billing already did).
   Office (Owner / Admin / Payroll):   Daily work > "All hours": remove ANY shift (clocked, missed, manual, crew-lead, subcontractor-added,
     or scheduled crew hours with nobody clocked), required reason, Restore (undo), every step in the audit log; Remove requests queue
     (also on Late entries); the old "Void" on Manual hours now does the same soft removal.
   Employee / worker / crew lead (own shifts only) and subcontractor (own workers + own work): "Remove" on the shift.
     Directly when the shift is not office-approved / office-entered, not in an exported pay period and not in an issued client
     invoice; otherwise it becomes a "Remove request" for the office (approve / decline). A short reason is always asked.
   Farm: cannot remove; removed hours drop out of its totals at once and show struck through; "Ask to change hours" stays.
   Issued invoices are never changed: the office sees "this invoice includes removed hours – review" (Mark reviewed).
   Payroll: a removal in a pay period that was already exported for Wagepoint is flagged on Payroll hours.
   Live (Supabase) mode: data.removed is a normal update of reg_time_entries (office may update every row). Until migration 016s is
   applied AND store-config sets voidSync:true, the reason and names are NOT written on the row (only the audit log and the
   notification carry them, because the farms' reg_client_time() would otherwise pass them through) and self-service removal /
   requests stay off (only 016s lets the server check them). Also live: the app re-reads the data when it is opened again /
   every few minutes, so removals made by the office reach phones that were left open. */
'use strict';
(function(){
if(typeof DB==='undefined'&&typeof load!=='function')return;
var LIVE=!!(window.REG_STORE&&window.REG_STORE.mode==='supabase');
var FULL=!LIVE||!!(window.REG_STORE&&window.REG_STORE.voidSync);   /* 016s applied: reasons on the row + self-service */
var OFFICE_ROLES=['owner','admin','ops','payroll','billing'];
function isRm(t){return !!(t&&t.removed);}
function isRej(t){return !!(t&&t.lateEntry==='rejected');}

/* ---------- 1. removed entries never count: hide them while anything runs ---------- */
var DEPTH=0,FULLLIST=null;
function allTime(){return DEPTH>0&&FULLLIST?FULLLIST:(DB&&DB.time)||[];}
window.vsAllTime=allTime;
function active(fn,self,args){
  if(DEPTH>0||typeof DB==='undefined'||!DB||!Array.isArray(DB.time))return fn.apply(self,args);
  var full=DB.time,i,hasRm=false;for(i=0;i<full.length;i++)if(isRm(full[i])){hasRm=true;break;}
  if(!hasRm)return fn.apply(self,args);
  var db0=DB,act=full.filter(function(t){return !isRm(t);}),sv=window.save,asked=false;
  DB.time=act;FULLLIST=full;DEPTH++;window.save=function(){asked=true;return true;};
  try{return fn.apply(self,args);}
  finally{DEPTH--;FULLLIST=null;window.save=sv;
    if(DB===db0){var now=DB.time||[],seen=new Set(now),inFull=new Set(full);   /* (a reset / reload replaced DB: leave the new one alone) */
      var merged=full.filter(function(t){return !t._vsDrop&&(isRm(t)||seen.has(t));});now.forEach(function(t){if(!inFull.has(t)&&!t._vsDrop)merged.push(t);});
      DB.time=merged;}else db0.time=full;
    if(asked)sv();}}
function wrapG(name){var f=window[name];if(typeof f!=='function'||f.__vs)return;var w=function(){return active(f,this,arguments);};w.__vs=1;window[name]=w;}
function wrapObj(o){if(!o)return;Object.keys(o).forEach(function(k){var f=o[k];if(typeof f!=='function'||f.__vs||f.__vsRaw)return;var w=function(){return active(f,this,arguments);};w.__vs=1;o[k]=w;});}
['render','firmRows','subRows','payrollRows','efItems','efBody','myShiftsView','clockView','overlapsAny','lateLinesFor','firmReport','adminFlags','firmShiftTable','clientInvoicesHtml'].forEach(wrapG);
/* live: the saver must never see the shortened list (it would delete removed rows) – a flush asked for while a screen / action
   runs (e.g. Sign out) starts right after it instead */
(function(){var of=window.REG_FLUSH;if(typeof of!=='function')return;window.REG_FLUSH=function(){if(DEPTH>0)return new Promise(function(res,rej){setTimeout(function(){Promise.resolve(of()).then(res,rej);},0);});return of();};})();
function wrapAll(){wrapObj(window.ACT);wrapObj(window.FORMS);wrapObj(window.VIEWS);wrapG('render');wrapG('layout');}

/* removed entry that belonged to a crew booking: do not fall back to the scheduled crew hours */
function rmPairs(){var p={};allTime().forEach(function(t){if(isRm(t)&&t.shiftId)p['c:'+t.shiftId+':'+t.userId]=1;});return p;}
(function(){var o=window.firmRows;if(typeof o!=='function')return;window.firmRows=function(){var rows=o.apply(this,arguments),p=rmPairs();return rows.filter(function(r){return !p[r.key];});};})();
(function(){var o=window.subRows;if(typeof o!=='function')return;window.subRows=function(){var rows=o.apply(this,arguments),p=rmPairs(),rej={};allTime().forEach(function(t){if(isRej(t))rej['t:'+t.id]=1;});
  return rows.filter(function(r){return !p[r.key]&&!rej[r.key];});};})();
(function(){var o=window.payrollRows;if(typeof o!=='function')return;window.payrollRows=function(from,to){var hid=[];(DB.time||[]).forEach(function(t){if(isRej(t)&&!t.test){t.test=true;t._vsRej=1;hid.push(t);}});
  try{return o.apply(this,arguments);}finally{hid.forEach(function(t){t.test=false;delete t._vsRej;});}};})();
(function(){var o=window.efItems;if(typeof o!=='function')return;window.efItems=function(u){var it=o.apply(this,arguments),gone={};allTime().forEach(function(t){if(isRm(t)&&t.shiftId&&u&&t.userId===u.id)gone[t.shiftId]=1;});
  return it.filter(function(i){return !(i.k==='a'&&i.s&&gone[i.s.id]);});};})();
(function(){var o=window.efSum;if(typeof o!=='function')return;window.efSum=function(list){return o((list||[]).filter(function(i){return !(i.k==='t'&&isRej(i.t));}));};})();

/* ---------- helpers ---------- */
function isOffice(){if(!ME||ME.type!=='admin')return false;var r=ME.officeRoles||(ME.officeRole?[ME.officeRole]:null);if(!r||!r.length)return true;return r.some(function(x){return OFFICE_ROLES.indexOf(String(x))>=0;});}
function paid(t){var w=hrs(t['in'],t.out);return t.out?w-unpaidBreak(w,t):0;}
function siteOf(t){if(t.site)return t.site;var s=(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return s?s.site:'';}
function span(t){return t['in']+'–'+(t.out||'…')+(t.out?plus1(t['in'],t.out):'');}
function desc(t){return siteOf(t)+' '+t.date+' '+span(t);}
function byId(id){return allTime().filter(function(t){return t.id===id;})[0]||null;}
function exportedOn(date){return (DB.payExports||[]).filter(function(x){return x.start<=date&&date<=x.end;}).slice(-1)[0]||null;}
function invFor(site,date){var f=typeof firmOfSite==='function'?firmOfSite(site):null;if(!f)return null;
  return (DB.clientInvoices||[]).filter(function(i){return i.firmId===f.id&&i.periodStart&&i.periodStart<=date&&date<=(i.periodEnd||i.periodStart);})[0]||null;}
function firmNames(){var n=[];(DB.users||[]).forEach(function(f){if(f.type!=='firm')return;[f.name,f.realName,f.clientRealName,f.firm&&f.firm.realName,f.firm&&f.firm.clientRealName,f.company&&f.company.legalName].forEach(function(x){x=String(x||'').trim();if(x.length>=4&&n.indexOf(x)<0)n.push(x);});});
  (DB.sites||[]).forEach(function(s){var x=String(s.name||'').trim();if(x.length>=4&&n.indexOf(x)<0&&x!==s.code)n.push(x);});return n.sort(function(a,b){return b.length-a.length;});}
function scrub(s,site){s=String(s||'');firmNames().forEach(function(n){var re=new RegExp(n.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi');s=s.replace(re,site||'the client');});return s;}
function pill(c,t){return '<span class="pill '+c+'">'+t+'</span>';}
function hist(t,action,reason){(t.removeHistory=t.removeHistory||[]).push({at:new Date().toISOString(),by:FULL?(ME?ME.name:''):(ME&&ME.type==='admin'?'office':(ME?ME.name:'')),action:action,reason:FULL?(reason||''):''});}
function lockReasons(t){var W=[],u=user(t.userId),site=siteOf(t);
  if(String(t.id||'').indexOf('st-')===0)W.push('st');
  if(t.manual||t.officeEntry)W.push('Entered by the office');
  if(t.lateEntry==='approved')W.push('Already approved by the office');
  if(t.lateBilledInv)W.push('On client invoice '+t.lateBilledInv);
  var inv=invFor(site,t.date);if(inv)W.push('In an issued client invoice');
  if(u&&u.type==='employee'&&exportedOn(t.date))W.push('Pay period already sent to payroll');
  if(t.orig)W.push('Hours already changed by the office');
  if(t.clockedBy&&ME&&t.clockedBy!==ME.id&&ME.type!=='sub'&&!t.subAdded)W.push('Clocked by your crew lead');
  return W;}
/* who may ask: the person themself (employee / worker / crew lead), or the subcontractor for its own workers and own work */
function mayAsk(t){if(!ME||!t||t.test)return false;if(t.userId===ME.id&&(ME.type==='employee'||ME.type==='worker'||ME.type==='sub'))return true;
  if(ME.type==='sub'){var u=user(t.userId);return !!(u&&u.subId===ME.id);}return false;}
function selfOn(){return FULL;}

/* ---------- 2. the actions (office, person, subcontractor) ---------- */
function doRemove(t,src,reason,opt){opt=opt||{};var at=new Date().toISOString(),u=user(t.userId),site=siteOf(t),clean=scrub(reason,site);
  t.removed=true;t.removedAt=at;t.removedSrc=src;
  if(FULL){t.removedBy=ME.name;t.removedById=ME.id;t.removedReason=clean;}else{t.removedBy=ME.type==='admin'?'office':ME.name;}
  hist(t,src==='request'?'removed (request approved)':src==='self'?'removed by '+(ME.type==='sub'?'subcontractor':'the person'):'removed by office',clean);
  var ex=u&&u.type==='employee'?exportedOn(t.date):null;if(ex&&ME.type==='admin')t.rmAfterExport=ex.start;
  var inv=invFor(site,t.date)||null;if(inv&&ME.type==='admin')t.rmOnInvoice=inv.number;
  audit(src==='office'?'Removed hours (office)':src==='request'?'Approved remove request':'Removed own hours',u?u.name:'',desc(t)+' · reason: '+reason+(ex?' · pay period already exported':'')+(inv?' · in issued invoice '+inv.number:''));
  var msg=(src==='self'?'Shift removed: ':'The office removed your shift: ')+site+' on '+t.date+', '+span(t)+'.'+(src!=='self'&&clean?' Reason: '+clean.replace(/[.!?]?$/,'.'):'')+' It no longer counts for your hours.';
  if(u&&u.id!==ME.id)notify(u.id,msg);if(u&&u.subId&&u.subId!==ME.id)notify(u.subId,'Hours removed for '+u.name+': '+site+' on '+t.date+', '+span(t)+'.'+(clean?' Reason: '+clean:''));
  if(opt.via)t.removedVia=opt.via;if(opt.changeId)t.removedChange=opt.changeId;
  if(src!=='office')notify('admin',(src==='request'?'':'Removed by '+(ME.type==='sub'?'subcontractor ':'')+ME.name+': ')+(u?u.name:'')+' · '+desc(t)+(src==='self'?' (reason: '+reason+')':''));
  var f=typeof firmOfSite==='function'?firmOfSite(site):null;if(f&&!opt.noFirm&&t.out&&t.date<=today())notify(f.id,'Hours at '+site+' on '+t.date+' ('+span(t)+') were removed'+(src==='self'?' (entered by mistake)':' by the office')+'. Your totals are updated.');}
function doRestore(t,note){var u=user(t.userId);
  if(t.crewPlaceholder){t._vsDrop=true;DB.time=DB.time.filter(function(x){return x!==t;});}
  else{['removed','removedAt','removedSrc','removedBy','removedById','removedReason','rmAfterExport','rmOnInvoice'].forEach(function(k){delete t[k];});if(t.removeReq)delete t.removeReq;t.restoredAt=new Date().toISOString();t.restoredBy=FULL?ME.name:'office';hist(t,'restored by office',note);}
  audit('Restored removed hours',u?u.name:'',desc(t)+(note?' · note: '+note:''));if(u)notify(u.id,'The office put back your shift: '+desc(t)+'. It counts again.');if(u&&u.subId)notify(u.subId,'Hours put back for '+u.name+': '+desc(t)+'.');}

function modalRemove(t,mode){var u=user(t.userId),W=[];var ex=u&&u.type==='employee'?exportedOn(t.date):null,inv=invFor(siteOf(t),t.date);
  if(mode==='office'){if(ex)W.push('This pay period was already exported for Wagepoint – correct it in Wagepoint too.');if(inv)W.push('Client invoice '+inv.number+' is already issued for this date. It will NOT change; it gets a "review" flag.');if(t.lateBilledInv)W.push('Already billed on client invoice '+t.lateBilledInv+'.');
    var c=typeof latestChange==='function'?latestChange(t.key0||('t:'+t.id)):null;if(c&&c.status==='Pending')W.push('The farm asked to change these hours (waiting). Removing them answers that too.');if(!t.out)W.push('This shift is still open (on shift now).');}
  var title=mode==='office'?'Remove hours':mode==='request'?'Ask the office to remove this shift':'Remove this shift';
  var who=ME.type==='admin'?'<b>'+esc(u?u.name:'')+'</b> · ':(ME.type==='sub'&&u&&u.id!==ME.id?'<b>'+esc(u.name)+'</b> · ':'');
  modal('<h2>'+title+'</h2><p>'+who+esc(siteOf(t))+' · '+esc(typeof shortDay==='function'?shortDay(t.date):t.date)+' · '+esc(span(t))+(t.out?' · '+paid(t).toFixed(2)+' h':'')+'</p>'+
    (mode==='office'?'<p class="small">The hours stop counting everywhere (pay, worker hours, farm totals, invoices not yet made). The person, their subcontractor and the farm see the shift crossed out as <b>Removed by office</b>. You can put it back later (Restore).</p>':
     mode==='request'?'<p class="small">This shift is already approved, paid or billed, so the office has to check it. You will see the answer here.</p>':'<p class="small">The shift stops counting. The office is told and can see it.</p>')+
    (W.length?'<div class="alert warn small"><ul>'+W.map(function(w){return '<li>'+esc(w)+'</li>';}).join('')+'</ul></div>':'')+
    '<form data-form="vsremove" id="vsremoveform"><input type="hidden" name="id" value="'+esc(t.id)+'"><input type="hidden" name="mode" value="'+mode+'">'+
    '<label class="req" for="vswhy">'+(mode==='office'?'Why? (the worker sees this – do not write the farm\'s name)':'Why? (short)')+'</label><input type="text" id="vswhy" name="why" required maxlength="200" placeholder="'+(mode==='office'?'e.g. entered twice':'e.g. I clocked in by mistake')+'">'+
    (mode==='office'?'<label class="inline"><input type="checkbox" name="sure" value="1" required> <span>Yes, remove these hours</span></label>':'')+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button class="danger" id="vsgo">'+(mode==='request'?'Send request':'Remove')+'</button></div></form>');}

function placeholderFor(key){var m=/^c:([^:]+):(.+)$/.exec(key||'');if(!m)return null;var sh=(DB.shifts||[]).filter(function(s){return s.id===m[1];})[0],u=user(m[2]);if(!sh||!u)return null;
  var ex=allTime().filter(function(t){return t.shiftId===sh.id&&t.userId===u.id;})[0];if(ex)return ex;
  var t={id:uid('t'),userId:u.id,site:sh.site,shiftId:sh.id,role:typeof jobRoleOf==='function'?jobRoleOf(u):'',date:sh.date,'in':sh.start,out:sh.end,clock:false,crewPlaceholder:true,test:false,addedAt:new Date().toISOString(),note:'scheduled crew hours (nobody clocked)'};if(u.subId)t.subId=u.subId;DB.time.push(t);return t;}

function raw(f){f.__vsRaw=1;return f;}
ACT.vsrm=raw(function(el){if(!isOffice()){toast('Only the office can do that.');return;}var t=el.dataset.key?null:byId(el.dataset.id);
  if(el.dataset.key){PAGE_STATE.vsKey=el.dataset.key;var m=/^c:([^:]+):(.+)$/.exec(el.dataset.key),sh=m&&(DB.shifts||[]).filter(function(s){return s.id===m[1];})[0];if(!sh)return;
    t={id:'key:'+el.dataset.key,userId:m[2],site:sh.site,shiftId:sh.id,date:sh.date,'in':sh.start,out:sh.end};}
  if(!t||isRm(t))return;if(String(t.id).indexOf('st-')===0){toast('This is a Shift Tracker record – remove it in Shift Tracker.');return;}modalRemove(t,'office');});
ACT.vsself=raw(function(el){var t=byId(el.dataset.id);if(!t||isRm(t)||!mayAsk(t)||!selfOn())return;if(t.removeReq&&t.removeReq.status==='pending'){toast('Your request is already with the office.');return;}
  var L=lockReasons(t);if(L.indexOf('st')>=0){toast('This shift came from the old Shift Tracker – please ask the office.');return;}modalRemove(t,L.length?'request':'self');});
FORMS.vsremove=raw(function(f,d){var why=String(d.why||'').trim();if(why.length<3){toast('Please write a short reason.');var w=document.getElementById('vswhy');if(w)w.focus();return;}
  var t;if(String(d.id).indexOf('key:')===0){if(!isOffice())return;if(!d.sure){toast('Tick "Yes, remove these hours".');return;}t=placeholderFor(String(d.id).slice(4));if(!t){toast('That shift was not found.');return;}}
  else t=byId(d.id);if(!t||isRm(t)){closeModal();return;}
  if(d.mode==='office'){if(!isOffice()){toast('Only the office can do that.');return;}if(!d.sure){toast('Tick "Yes, remove these hours".');return;}if(t.removeReq&&t.removeReq.status==='pending'){t.removeReq.status='approved';t.removeReq.decidedAt=new Date().toISOString();t.removeReq.decidedBy=FULL?ME.name:'office';}doRemove(t,'office',why);save();closeModal();toast('Removed – it shows crossed out for the person and the farm. You can Restore it.');render();return;}
  if(!mayAsk(t)||!selfOn()){toast('Not allowed.');return;}var L=lockReasons(t);
  if(d.mode==='self'&&!L.length){doRemove(t,'self',why);save();closeModal();toast('Shift removed ✓');render();return;}
  t.removeReq={status:'pending',at:new Date().toISOString(),by:ME.name,byId:ME.id,byType:ME.type,reason:scrub(why,siteOf(t)),why:L.filter(function(x){return x!=='st';})};hist(t,'remove requested',why);
  var u=user(t.userId);audit('Asked the office to remove a shift',u?u.name:'',desc(t)+' · reason: '+why);notify('admin','Remove request: '+(ME.type==='sub'&&u&&u.id!==ME.id?'subcontractor '+ME.name+' for '+u.name:(u?u.name:''))+' · '+desc(t)+' · reason: '+why+'. Open Late entries or All hours.');
  save();closeModal();toast('Sent to the office ✓');render();});
ACT.vscancelreq=raw(function(el){var t=byId(el.dataset.id);if(!t||!t.removeReq||t.removeReq.status!=='pending'||!mayAsk(t))return;delete t.removeReq;hist(t,'remove request cancelled','');audit('Cancelled remove request',ME.name,desc(t));save();toast('Request cancelled.');render();});
ACT.vsreq=raw(function(el){if(!isOffice())return;var t=byId(el.dataset.id);if(!t||!t.removeReq||t.removeReq.status!=='pending')return;var u=user(t.userId),r=t.removeReq;
  modal('<h2>Remove request</h2><p><b>'+esc(u?u.name:'')+'</b> · '+esc(desc(t))+(t.out?' · '+paid(t).toFixed(2)+' h':'')+'</p><p class="small">Asked by '+esc(r.by||'')+' on '+esc(fmtStamp(r.at))+(r.reason?': “'+esc(r.reason)+'”':'')+(r.why&&r.why.length?'<br>Needs the office because: '+esc(r.why.join(', ')):'')+'</p>'+
    '<form data-form="vsreqdo"><input type="hidden" name="id" value="'+esc(t.id)+'"><label for="vsnote">Note (required to decline; the person sees it)</label><input type="text" id="vsnote" name="note" maxlength="200">'+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button class="sec" name="act" value="decline" id="vsdecline">Decline</button><button class="danger" name="act" value="approve" id="vsapprove">Approve – remove</button></div></form>');});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-form=vsreqdo] button[name=act]');if(b)b.form._act=b.value;},true);
FORMS.vsreqdo=raw(function(f,d){if(!isOffice())return;var t=byId(d.id);if(!t||!t.removeReq||t.removeReq.status!=='pending')return;var a=d.act||f._act||'approve',u=user(t.userId),r=t.removeReq,note=String(d.note||'').trim();
  r.decidedAt=new Date().toISOString();r.decidedBy=FULL?ME.name:'office';
  if(a==='decline'){if(!note){toast('Write a short note to decline.');return;}r.status='declined';r.note=scrub(note,siteOf(t));hist(t,'remove request declined',note);audit('Declined remove request',u?u.name:'',desc(t)+' · note: '+note);
    notify(r.byId||t.userId,'The office kept your shift '+desc(t)+': '+r.note);save();closeModal();toast('Declined – the shift stays.');render();return;}
  r.status='approved';doRemove(t,'request',r.reason+(note?' – '+note:''));save();closeModal();toast('Approved – the shift is removed everywhere.');render();});
ACT.vsrestore=raw(function(el){if(!isOffice())return;var t=byId(el.dataset.id);if(!t||!isRm(t))return;var u=user(t.userId);
  modal('<h2>Put these hours back?</h2><p><b>'+esc(u?u.name:'')+'</b> · '+esc(desc(t))+'</p><p class="small">Removed '+esc(fmtStamp(t.removedAt))+(t.removedBy?' by '+esc(t.removedBy):'')+(t.removedReason?': “'+esc(t.removedReason)+'”':'')+'. Restoring makes them count again everywhere (an invoice already issued is not changed).</p>'+
    '<form data-form="vsrestore"><input type="hidden" name="id" value="'+esc(t.id)+'"><label for="vsrnote">Note (optional)</label><input type="text" id="vsrnote" name="note" maxlength="200"><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button id="vsrestorego">Restore</button></div></form>');});
FORMS.vsrestore=raw(function(f,d){if(!isOffice())return;var t=byId(d.id);if(!t||!isRm(t))return;doRestore(t,String(d.note||'').trim());save();closeModal();toast('Restored – the hours count again.');render();});
ACT.vsinvok=raw(function(el){if(!isOffice())return;var i=(DB.clientInvoices||[]).filter(function(x){return x.id===el.dataset.id;})[0];if(!i)return;var ids=rmOnInv(i).map(function(t){return t.id;});
  i.rmReviewed=(i.rmReviewed||[]).concat(ids.filter(function(x){return (i.rmReviewed||[]).indexOf(x)<0;}));i.rmReviewedAt=new Date().toISOString();i.rmReviewedBy=ME.name;audit('Reviewed removed hours on invoice',i.number,ids.length+' removed shift(s)');save();toast('Marked reviewed.');render();});
ACT.vshfilter=raw(function(el){var s=PAGE_STATE.vsh=PAGE_STATE.vsh||{};s.show=el.dataset.f;render();});
FORMS.vshrange=raw(function(f,d){var s=PAGE_STATE.vsh=PAGE_STATE.vsh||{};if(d.from&&d.to&&d.from>d.to){toast('"From" must be before "To".');return;}s.from=d.from;s.to=d.to;s.q=String(d.q||'').trim();render();});
ADMIN_ONLY_ACT.push('vsrm','vsreq','vsrestore','vsinvok','vshfilter');ADMIN_ONLY_FORM.push('vsreqdo','vsrestore','vshrange');
ROLE_ONLY.vsself=['employee','worker','sub'];ROLE_ONLY.vscancelreq=['employee','worker','sub'];

/* invoices already issued that include hours removed later */
function rmOnInv(i){if(!i.periodStart)return [];var codes=(DB.sites||[]).filter(function(s){return s.firmId===i.firmId;}).map(function(s){return s.code;});
  return allTime().filter(function(t){if(!isRm(t)||t.test||t.crewPlaceholder&&!t.out)return false;if(t.lateBilledInv===i.number)return true;var s=siteOf(t);if(codes.indexOf(s)<0||t.date<i.periodStart||t.date>(i.periodEnd||i.periodStart))return false;
    return !i.issued||String(t.removedAt||'').slice(0,10)>=String(i.issued).slice(0,10);});}
function invFlags(){return (DB.clientInvoices||[]).map(function(i){var L=rmOnInv(i).filter(function(t){return (i.rmReviewed||[]).indexOf(t.id)<0;});return L.length?{i:i,L:L}:null;}).filter(Boolean);}

/* ---------- 3. office screens ---------- */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/lateentries')return i+1;return NAV.admin.length;})(),0,['#/allhours','All hours (remove / restore)']);
if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){if(g[0]==='Daily work'&&g[1].indexOf('#/allhours')<0)g[1].splice(Math.max(0,g[1].indexOf('#/lateentries')+1),0,'#/allhours');});
function who(u){return !u?'?':u.type==='employee'?'UnScramble employee':(typeof employerName==='function'?employerName(u):'');}
function officeSite(c){var f=typeof firmOfSite==='function'?firmOfSite(c):null;var n=f?(f.realName||(f.firm&&f.firm.realName)||f.name||''):'';return c+(n?' – '+n:'');}
function reqHtml(){var L=allTime().filter(function(t){return t.removeReq&&t.removeReq.status==='pending'&&!isRm(t)&&!t.test;});
  return '<div class="card vs-reqs" id="vsreqs"><h3 style="margin-top:0">Remove requests '+(L.length?pill('s-pend',L.length+' waiting'):pill('s-ok','none waiting'))+'</h3>'+(L.length?'<div class="tw"><table id="vsreqtable"><tr><th>Person</th><th>Shift</th><th>Hours</th><th>Asked</th><th>Reason</th><th></th></tr>'+L.map(function(t){var u=user(t.userId),r=t.removeReq;
    return '<tr data-id="'+esc(t.id)+'"><td><b>'+esc(u?u.name:'?')+'</b><div class="small muted">'+esc(who(u))+'</div></td><td>'+esc(officeSite(siteOf(t)))+'<br>'+esc(t.date+' '+span(t))+'</td><td>'+(t.out?paid(t).toFixed(2):'–')+'</td><td class="small">'+esc(r.by||'')+(r.byType==='sub'&&u&&r.byId!==u.id?' (subcontractor)':'')+'<br>'+esc(fmtStamp(r.at))+'</td><td class="small">'+esc(r.reason||'')+(r.why&&r.why.length?'<div class="muted">'+esc(r.why.join(', '))+'</div>':'')+'</td><td><button class="small" data-act="vsreq" data-id="'+esc(t.id)+'">Approve / decline</button></td></tr>';}).join('')+'</table></div>':'<p class="small muted" style="margin:0">When a worker, employee or subcontractor asks to remove a shift that is already approved, paid or billed, it shows here.</p>')+'</div>';}
function invFlagHtml(){var F=invFlags();if(!F.length)return '';return '<div class="alert warn small" id="vsinvflags"><b>Issued invoices that include removed hours – review:</b><ul>'+F.map(function(x){return '<li>'+esc(x.i.number)+' ('+esc(x.i.periodStart+' to '+(x.i.periodEnd||''))+'): '+x.L.length+' removed shift'+(x.L.length===1?'':'s')+', '+x.L.reduce(function(a,t){return a+paid(t);},0).toFixed(2)+' h. The invoice was not changed – issue a credit if needed. <button class="small sec" data-act="vsinvok" data-id="'+esc(x.i.id)+'">Mark reviewed</button></li>';}).join('')+'</ul></div>';}
VIEWS['admin:allhours']=function(){var s=PAGE_STATE.vsh=PAGE_STATE.vsh||{},to=s.to||today(),from=s.from||addDays(to,-13),show=s.show||'all',q=String(s.q||'').toLowerCase();
  var rows=[];allTime().forEach(function(t){if(t.test||t.date<from||t.date>to)return;var u=user(t.userId);if(!u||u.type==='tester')return;rows.push({t:t,u:u,key:'t:'+t.id});});
  (DB.shifts||[]).forEach(function(sh){if(sh.test||sh.kind!=='crew'||sh.date>today()||sh.date<from||sh.date>to)return;(sh.booked||[]).forEach(function(id){var u=user(id);if(!u||u.type==='tester')return;if(allTime().some(function(t){return t.userId===id&&t.shiftId===sh.id&&!t.test;}))return;
    rows.push({sched:true,u:u,key:'c:'+sh.id+':'+id,t:{id:'',userId:id,site:sh.site,shiftId:sh.id,date:sh.date,'in':sh.start,out:sh.end}});});});
  if(q)rows=rows.filter(function(r){return (r.u.name+' '+siteOf(r.t)+' '+officeSite(siteOf(r.t))+' '+who(r.u)).toLowerCase().indexOf(q)>=0;});
  var cnt={all:rows.length,active:rows.filter(function(r){return !isRm(r.t);}).length,removed:rows.filter(function(r){return isRm(r.t);}).length};
  if(show==='active')rows=rows.filter(function(r){return !isRm(r.t);});else if(show==='removed')rows=rows.filter(function(r){return isRm(r.t);});
  rows.sort(function(a,b){return (b.t.date+(b.t['in']||'')).localeCompare(a.t.date+(a.t['in']||''))||(a.u.name<b.u.name?-1:1);});
  var tot=rows.filter(function(r){return !isRm(r.t)&&!isRej(r.t);}).reduce(function(a,r){return a+paid(r.t);},0);
  return '<h1>All hours</h1><p class="small muted">Every shift with hours: clocked, added later, manual, crew-lead and subcontractor entries, and scheduled crew hours where nobody clocked. <b>Remove</b> takes the hours out of pay, worker hours, farm totals and new invoices; the person, their subcontractor and the farm see it crossed out as “Removed by office”. Nothing is deleted – <b>Restore</b> puts it back. Every step is in the Audit log.</p>'+
  invFlagHtml()+reqHtml()+
  '<form data-form="vshrange" class="row card"><div><label>From</label><input type="date" name="from" value="'+esc(from)+'"></div><div><label>To</label><input type="date" name="to" value="'+esc(to)+'"></div><div><label>Person or site</label><input type="text" name="q" value="'+esc(s.q||'')+'" placeholder="name or site code"></div><div style="align-self:flex-end"><button class="small">Show</button></div></form>'+
  '<div class="row mt-filters"><b>Show:</b>'+[['all','All ('+cnt.all+')'],['active','Counting ('+cnt.active+')'],['removed','Removed ('+cnt.removed+')']].map(function(o){return '<button class="small '+(show===o[0]?'':'sec')+'" data-act="vshfilter" data-f="'+o[0]+'">'+o[1]+'</button>';}).join('')+' <span class="small">Counting hours shown: <b id="vshtot">'+tot.toFixed(2)+'</b></span></div>'+
  '<div class="tw"><table id="vshtable"><tr><th>Person</th><th>Site</th><th>Date</th><th>Time</th><th>Paid h</th><th>Type</th><th>Status</th><th></th></tr>'+(rows.map(function(r){var t=r.t,rm=isRm(t),typ=r.sched?'Scheduled crew (nobody clocked)':t.crewPlaceholder?'Scheduled crew':t.manual?'Manual':t.subAdded?'Added by subcontractor':t.missed?'Added later':t.crewClock?'Crew lead':String(t.id).indexOf('st-')===0?'Shift Tracker':'Clocked';
    var st=rm?pill('s-bad','Removed')+'<div class="small">'+esc(fmtStamp(t.removedAt))+(t.removedBy?' · '+esc(t.removedBy):'')+(t.removedSrc==='self'?' (by the person)':t.removedSrc==='request'?' (request approved)':'')+(t.removedReason?'<br>“'+esc(t.removedReason)+'”':'')+'</div>':
      isRej(t)?pill('s-bad','Late entry not approved'):t.lateEntry==='pending'?pill('s-pend','Waiting for approval'):t.removeReq&&t.removeReq.status==='pending'?pill('s-pend','Remove requested'):!t.out?pill('s-ok','On shift now'):pill('s-ok','Counts');
    var btn=rm?'<button class="small sec" data-act="vsrestore" data-id="'+esc(t.id)+'">Restore</button>':String(t.id).indexOf('st-')===0?'<span class="small muted">remove in Shift Tracker</span>':r.sched?'<button class="small danger" data-act="vsrm" data-key="'+esc(r.key)+'">Remove</button>':'<button class="small danger" data-act="vsrm" data-id="'+esc(t.id)+'">Remove</button>';
    return '<tr class="'+(rm?'vs-rmrow':'')+'" data-key="'+esc(r.key)+'"><td><b>'+esc(r.u.name)+'</b><div class="small muted">'+esc(who(r.u))+'</div></td><td>'+esc(officeSite(siteOf(t)))+'</td><td>'+esc(t.date)+'</td><td class="vs-t"><s>'+esc(span(t))+'</s></td><td class="vs-t"><s>'+(t.out?paid(t).toFixed(2):'–')+'</s></td><td class="small">'+esc(typ)+'</td><td>'+st+'</td><td>'+btn+'</td></tr>';}).join('')||'<tr><td colspan="8" class="muted">No hours in this range.</td></tr>')+'</table></div>';};
/* Late entries: the remove-request queue on top */
(function(){var ov=VIEWS['admin:lateentries'];if(!ov)return;VIEWS['admin:lateentries']=function(){var x=ov.apply(this,arguments);return x.replace('</h1>','</h1>'+reqHtml());};})();
/* Overview flags */
(function(){var of=window.adminFlags;if(typeof of!=='function')return;window.adminFlags=function(){var f=of.apply(this,arguments);try{var n=allTime().filter(function(t){return t.removeReq&&t.removeReq.status==='pending'&&!isRm(t)&&!t.test;}).length;
  if(n)f.unshift({t:'Remove requests',c:'s-pend',h:n+' shift remove request'+(n===1?'':'s')+' waiting. <a href="#/allhours">Review →</a>'});
  invFlags().forEach(function(x){f.unshift({t:'Invoice to review',c:'s-warn',h:'Invoice '+esc(x.i.number)+' includes removed hours ('+x.L.length+' shift'+(x.L.length===1?'':'s')+') – review. <a href="#/allhours">Open →</a>'});});}catch(e){}return f;};})();
/* Invoices (office): flag on the invoice row */
(function(){var oh=window.clientInvoicesHtml;if(typeof oh!=='function')return;window.clientInvoicesHtml=function(firm,office){var x=oh.apply(this,arguments);if(!office||!ME||ME.type!=='admin')return x;try{invFlags().forEach(function(F){var i=F.i;if(firm&&i.firmId!==firm.id)return;
  x=x.replace(new RegExp('(<tr data-inv="'+String(i.number).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'">[\\s\\S]*?</tr>)'),'$1<tr class="vs-invflag"><td colspan="12" class="small"><span class="pill s-warn">This invoice includes removed hours – review</span> '+F.L.map(function(t){return esc(siteOf(t)+' '+t.date+' '+span(t));}).join('; ')+' <button class="small sec" data-act="vsinvok" data-id="'+esc(i.id)+'">Mark reviewed</button></td></tr>');});}catch(e){}return x;};})();
(function(){var ov=VIEWS['admin:invoicesadmin'];if(!ov)return;VIEWS['admin:invoicesadmin']=function(){var x=ov.apply(this,arguments);return x.replace('</h1>','</h1>'+invFlagHtml());};})();
/* Payroll: removed shifts in this period */
(function(){var ov=VIEWS['admin:payroll'];if(!ov)return;VIEWS['admin:payroll']=function(){var x=ov.apply(this,arguments);try{var cur=payPeriodOf(PAGE_STATE.payDate||today()),L=allTime().filter(function(t){var u=user(t.userId);return isRm(t)&&!t.test&&u&&u.type==='employee'&&t.date>=cur.start&&t.date<=cur.end;}),late=L.filter(function(t){return t.rmAfterExport===cur.start;});
  if(!L.length)return x;return x.replace('<div class="tw"><table id="paytable">','<div class="alert '+(late.length?'warn':'info')+' small" id="vspay">'+L.length+' shift'+(L.length===1?' was':'s were')+' removed in this pay period and '+(L.length===1?'is':'are')+' not counted: '+L.map(function(t){var u=user(t.userId);return esc((u?u.name:'')+' '+t.date+' '+span(t));}).join('; ')+'.'+(late.length?' <b>'+late.length+' removed after the Wagepoint export</b> – correct Wagepoint.':'')+'</div><div class="tw"><table id="paytable">');}catch(e){return x;}};})();
/* Manual hours: "Void" now removes the same way (kept, crossed out everywhere, can be restored) */
ACT.mtvoid=raw(function(el){ACT.vsrm(el);});
(function(){var ov=VIEWS['admin:manualtime'];if(!ov)return;VIEWS['admin:manualtime']=function(){if((PAGE_STATE.mtFilter||'all')!=='voided')return ov.apply(this,arguments);
  var keep=DB.timeVoided,extra=allTime().filter(function(t){return isRm(t)&&t.manual;}).map(function(t){return Object.assign({},t,{voidedAt:t.removedAt,voidedBy:t.removedBy||'office',voidReason:(t.removedReason||'')+' (Restore on All hours)'});});
  DB.timeVoided=(keep||[]).concat(extra);try{return ov.apply(this,arguments);}finally{DB.timeVoided=keep;}};})();
(function(){var oh=ACT.mthist;if(!oh)return;ACT.mthist=raw(function(el){if(el.dataset.v&&!(DB.timeVoided||[]).some(function(x){return x.id===el.dataset.id;})){var t=byId(el.dataset.id);if(t){var u=user(t.userId);modal('<h2>Manual hours – '+esc(u?u.name:'')+'</h2><p>'+esc(desc(t))+'</p><ul class="small">'+(t.removeHistory||[]).map(function(h){return '<li>'+esc(fmtStamp(h.at)+' · '+h.by+' · '+h.action+(h.reason?' · '+h.reason:''))+'</li>';}).join('')+'</ul>');}return;}return oh(el);});})();

/* ---------- 4. person (employee / worker / crew lead): My shifts ---------- */
function rmLine(t,forSub){var by=t.removedSrc==='self'?(forSub&&t.removedById!==ME.id?'Removed by '+esc(t.removedBy||'the worker'):'You removed this shift'):'Removed by office';
  return pill('s-bad vs-rmpill',by)+(t.removedReason&&t.removedSrc!=='self'?' <span class="small vs-why">'+esc(scrub(t.removedReason,siteOf(t)))+'</span>':'');}
function reqLine(t){var r=t.removeReq;if(!r)return '';if(r.status==='pending')return pill('s-pend','Remove request sent – waiting for office')+' <button type="button" class="linklike small" data-act="vscancelreq" data-id="'+esc(t.id)+'">Cancel request</button>';
  if(r.status==='declined')return pill('s-warn','Office kept this shift')+(r.note?' <span class="small">'+esc(r.note)+'</span>':'');return '';}
(function(){var o=window.efRow;if(typeof o!=='function')return;window.efRow=function(i){var x=o.apply(this,arguments);if(!i||i.k!=='t'||!i.t)return x;var t=i.t,add='';
  if(isRej(t))add=pill('s-bad','Not approved by office – not counted');
  else if(t.removeReq&&t.removeReq.status!=='approved')add=reqLine(t);
  if(selfOn()&&mayAsk(t)&&!(t.removeReq&&t.removeReq.status==='pending')&&!isRej(t)&&String(t.id).indexOf('st-')!==0){var L=lockReasons(t);add+=(add?' ':'')+'<button type="button" class="linklike small vs-rmbtn" data-act="vsself" data-id="'+esc(t.id)+'">'+(L.length?'Ask office to remove':'Remove')+'</button>';}
  if(!add)return x;var at=x.lastIndexOf('</div><div class="ef-h">');if(at<0)return x;return x.slice(0,at)+'<div class="ef-l2 vs-l">'+add+'</div>'+x.slice(at);};})();
function myRemovedHtml(u,forSub){var lo=addDays(today(),-60),L=allTime().filter(function(t){return isRm(t)&&!t.test&&t.date>=lo&&(forSub?(function(w){return w&&(w.subId===u.id||w.id===u.id);})(user(t.userId)):t.userId===u.id)&&!(t.crewPlaceholder&&!forSub&&false);}).sort(function(a,b){return a.date<b.date?1:-1;});
  if(!L.length)return '';
  return '<section class="ef-sec vs-sec" id="vsRemoved"><h2 class="ef-h2">Removed shifts <span class="ef-cnt">not counted</span></h2><div class="ef-list">'+L.map(function(t){var d=(typeof shortDay==='function'?shortDay(t.date):t.date).split(' '),w=user(t.userId);
    return '<div class="ef-row vs-rmrow" data-id="'+esc(t.id)+'"><div class="ef-d"><b>'+esc(d[0])+'</b><span>'+esc((d[1]||'')+' '+(d[2]||''))+'</span></div><div class="ef-m"><div class="ef-l1"><b>'+esc(siteOf(t))+'</b> · <s>'+esc(span(t))+'</s>'+(forSub&&w?' · '+esc(w.name):'')+'</div><div class="ef-l2">'+rmLine(t,forSub)+'</div></div><div class="ef-h"><s><b>'+(t.out?paid(t).toFixed(2):'–')+'</b></s><small>hrs</small></div></div>';}).join('')+'</div></section>';}
(function(){var o=window.efBody;if(typeof o!=='function')return;window.efBody=function(u){var x=o.apply(this,arguments);try{if(u&&(u.type==='employee'||u.type==='worker'))x+=myRemovedHtml(u,false);}catch(e){}return x;};})();

/* ---------- 5. subcontractor: workers' hours ---------- */
function subList(){var lo=addDays(today(),-30);return allTime().filter(function(t){if(t.test||t.date<lo||isRm(t))return false;var w=user(t.userId);return w&&(w.id===ME.id||w.subId===ME.id);}).sort(function(a,b){return (b.date+b['in']).localeCompare(a.date+a['in']);});}
function subCard(){if(!selfOn())return '';var L=subList();
  return '<div class="card" id="vssubcard"><h3 style="margin-top:0">Remove a shift</h3><p class="small">Hours entered by mistake? Remove them here (last 30 days). If the shift is already approved, paid or billed, the office gets a request instead. Scheduled crew hours (nobody clocked): ask the office.</p>'+
  (L.length?'<div class="tw"><table id="vssubtable"><tr><th>Worker</th><th>Site</th><th>Day</th><th>Time</th><th>Hours</th><th></th></tr>'+L.map(function(t){var w=user(t.userId),Lk=lockReasons(t),st=String(t.id).indexOf('st-')===0;
    var act=isRej(t)?pill('s-bad','Not approved'):t.removeReq&&t.removeReq.status!=='approved'?reqLine(t)+(t.removeReq.status==='declined'&&!st?' <button class="small sec" data-act="vsself" data-id="'+esc(t.id)+'">Ask again</button>':''):st?'<span class="small muted">ask the office</span>':'<button class="small '+(Lk.length?'sec':'danger')+'" data-act="vsself" data-id="'+esc(t.id)+'">'+(Lk.length?'Ask office to remove':'Remove')+'</button>';
    return '<tr data-id="'+esc(t.id)+'"><td><b>'+esc(w?w.name:'')+(w&&w.id===ME.id?' (you)':'')+'</b></td><td>'+esc(siteOf(t))+'</td><td>'+esc(typeof shortDay==='function'?shortDay(t.date):t.date)+'</td><td>'+esc(span(t))+'</td><td>'+(t.out?paid(t).toFixed(2):'–')+'</td><td>'+act+'</td></tr>';}).join('')+'</table></div>':'<p class="small muted">No hours in the last 30 days.</p>')+'</div>';}
function subRemovedHtml(){var lo=addDays(today(),-60),L=allTime().filter(function(t){if(!isRm(t)||t.test||t.date<lo)return false;var w=user(t.userId);return w&&(w.id===ME.id||w.subId===ME.id);}).sort(function(a,b){return a.date<b.date?1:-1;});if(!L.length)return '';
  return '<div class="card vs-sec" id="vsSubRemoved"><h3 style="margin-top:0">Removed hours <span class="small muted">not counted above</span></h3><div class="tw"><table id="vssubrm"><tr><th>Worker</th><th>Site</th><th>Day</th><th>Time</th><th>Hours</th><th>Status</th></tr>'+L.map(function(t){var w=user(t.userId);
    return '<tr class="vs-rmrow"><td>'+esc(w?w.name:'')+'</td><td>'+esc(siteOf(t))+'</td><td>'+esc(typeof shortDay==='function'?shortDay(t.date):t.date)+'</td><td class="vs-t"><s>'+esc(span(t))+'</s></td><td class="vs-t"><s>'+(t.out?paid(t).toFixed(2):'–')+'</s></td><td>'+rmLine(t,true)+'</td></tr>';}).join('')+'</table></div></div>';}
(function(){var ov=VIEWS['sub:workerhours'];if(!ov)return;VIEWS['sub:workerhours']=function(){var x=ov.apply(this,arguments);try{x+=subRemovedHtml()+subCard();}catch(e){}return x;};})();

/* ---------- 6. farm (and the office's view of a farm): removed rows crossed out under "Shifts at your sites" ---------- */
(function(){var ot=window.firmShiftTable;if(typeof ot!=='function')return;window.firmShiftTable=function(firm,R,canEdit){var x=ot.apply(this,arguments);try{
  var days=(R&&R.rows||[]).map(function(r){return r.date;}).sort(),from=days[0],to=days[days.length-1];if(!from)return x;var codes=typeof firmCodes==='function'?firmCodes(firm):[];
  var L=allTime().filter(function(t){if(!isRm(t)||t.test||t.date<from||t.date>to)return false;var u=user(t.userId);if(u&&u.type==='tester')return false;return codes.indexOf(siteOf(t))>=0;}).sort(function(a,b){return (a.date+a['in']).localeCompare(b.date+b['in']);});
  if(!L.length)return x;
  return x+'<div class="vs-farmrm" id="vsfarmrm"><h3>Removed by the office <span class="small muted">– not counted in the totals above, never billed</span></h3><div class="tw"><table><tr><th>Site</th><th>Date</th><th>Start</th><th>End</th><th>Hours</th><th>Status</th></tr>'+L.map(function(t){var h=hrs(t['in'],t.out);
    return '<tr class="vs-rmrow"><td>'+esc(siteOf(t))+'</td><td>'+(typeof shortDay==='function'?shortDay(t.date):esc(t.date))+'</td><td class="vs-t"><s>'+esc(t['in'])+'</s></td><td class="vs-t"><s>'+esc(t.out||'')+(t.out?plus1H(t['in'],t.out):'')+'</s></td><td class="vs-t"><s>'+(t.out?h.toFixed(2):'–')+'</s></td><td>'+pill('s-bad',t.removedSrc==='self'?'Removed – entered by mistake':'Removed by office')+'</td></tr>';}).join('')+'</table></div></div>';}catch(e){return x;}};})();

/* ---------- 7. live: re-read the data when the app is opened again / every few minutes (no unsaved work is lost: save first) ---------- */
if(LIVE){var last=Date.now(),busy=false;
  function calm(){var a=document.activeElement;return !document.getElementById('modal')&&!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))&&document.visibilityState==='visible';}
  async function reread(force){if(busy||typeof ME==='undefined'||!ME||!window.REG_REFRESH||!calm())return;if(!force&&Date.now()-last<180000)return;if((window.scrollY||0)>60&&!force)return;busy=true;last=Date.now();
    try{if(window.REG_FLUSH)await window.REG_FLUSH();await window.REG_REFRESH();}catch(e){}finally{busy=false;}}
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible'&&Date.now()-last>30000)reread(true);});
  window.addEventListener('focus',function(){if(Date.now()-last>60000)reread(true);});
  setInterval(function(){reread(false);},60000);}

/* ---------- 8. farm: "There was no work on this day" (owner Oct 9 2026, 10:51 AM) ----------
   In the farm's "Ask to change hours" window: a second choice that asks the office to cancel ALL of that day's shifts at that site.
   It is a normal farm change request (DB.changes / reg_time_proposals, kind 'nowork', status Pending) – the farm may already insert
   Pending proposals, so no SQL is needed for it. Nothing changes until the office approves; then every shift that day at that site
   (clocked, added later, manual, crew-lead, subcontractor-added and scheduled crew hours) is removed the normal way (Removed by office
   everywhere, totals / CSV / invoice flag). The farm sees Waiting for office / Approved / Not approved. */
function nwRows(site,date){var out=[];allTime().forEach(function(t){if(t.test||isRm(t)||t.date!==date||siteOf(t)!==site)return;var u=user(t.userId);if(u&&u.type==='tester')return;out.push({t:t});});
  (DB.shifts||[]).forEach(function(sh){if(sh.test||sh.kind!=='crew'||sh.site!==site||sh.date!==date)return;(sh.booked||[]).forEach(function(id){var u=user(id);if(!u||u.type==='tester')return;if(allTime().some(function(t){return t.userId===id&&t.shiftId===sh.id&&!t.test;}))return;out.push({key:'c:'+sh.id+':'+id,t:{userId:id,site:sh.site,date:sh.date,'in':sh.start,out:sh.end}});});});return out;}
function nwOf(firmId){return (DB.changes||[]).filter(function(c){return c.kind==='nowork'&&(!firmId||c.firmId===firmId);});}
(function(){var oe=ACT.firmedit;if(!oe)return;ACT.firmedit=function(el){var r=(PAGE_STATE.frRows||{})[el.dataset.key];var x=oe.apply(this,arguments);try{var f=document.getElementById('hcform');if(r&&f&&!document.getElementById('vsnwbox')){
  var d=document.createElement('div');d.className='vs-nwbox';d.id='vsnwbox';d.innerHTML='<div class="vs-or">or</div><p><b>Nobody worked at '+esc(r.site)+' on '+esc(shortDay(r.date))+'?</b><br><span class="small">Ask the office to cancel <b>all</b> shifts at this site that day. Nothing changes until the office approves.</span></p><button type="button" class="sec" id="vsnwbtn" data-act="vsnowork" data-site="'+esc(r.site)+'" data-date="'+esc(r.date)+'">There was no work on this day</button>';
  f.parentNode.insertBefore(d,f.nextSibling);}}catch(e){}return x;};})();
ACT.vsnowork=raw(function(el){if(!ME||ME.type!=='firm')return;var site=el.dataset.site,date=el.dataset.date;if((typeof firmCodes==='function'?firmCodes(ME):[]).indexOf(site)<0){toast('Not allowed.');return;}
  if(nwOf(ME.id).some(function(c){return c.site===site&&c.date===date&&c.status==='Pending';})){toast('You already asked about this day – waiting for the office.');return;}
  var rows=(PAGE_STATE.frRows?Object.keys(PAGE_STATE.frRows).map(function(k){return PAGE_STATE.frRows[k];}):[]).filter(function(r){return r.site===site&&r.date===date;}),h=rows.reduce(function(a,r){return a+(r.hours||0);},0);
  modal('<h2>There was no work on this day</h2><div class="hc-who"><b>'+esc(site)+' · '+esc(shortDay(date))+'</b></div><p>You are asking the office to <b>cancel all '+rows.length+' shift'+(rows.length===1?'':'s')+'</b> at this site that day ('+h.toFixed(2)+' hours worked now on your bill).</p>'+
    '<form data-form="vsnowork" id="vsnwform"><input type="hidden" name="site" value="'+esc(site)+'"><input type="hidden" name="date" value="'+esc(date)+'"><label class="req" for="vsnwwhy">Reason (short)</label><textarea id="vsnwwhy" name="why" required minlength="3" maxlength="200" rows="2" placeholder="e.g. Rain – we sent everyone home before they started"></textarea>'+
    '<div class="hc-note"><b>Until the office answers, the hours stay on your bill.</b> You will see the answer on this page.</div><div class="hc-btns"><button type="button" class="sec" data-act="closeModal">Cancel</button><button type="submit" id="vsnwsend">Send to office</button></div></form>');});
FORMS.vsnowork=raw(function(f,d){if(!ME||ME.type!=='firm')return;var why=String(d.why||'').trim(),site=d.site,date=d.date;if(why.length<3){toast('Please write a short reason.');return;}if((typeof firmCodes==='function'?firmCodes(ME):[]).indexOf(site)<0){toast('Not allowed.');return;}
  if(nwOf(ME.id).some(function(c){return c.site===site&&c.date===date&&c.status==='Pending';})){closeModal();return;}
  var rows=(PAGE_STATE.frRows?Object.keys(PAGE_STATE.frRows).map(function(k){return PAGE_STATE.frRows[k];}):[]).filter(function(r){return r.site===site&&r.date===date;});
  var c={id:uid('fc'),kind:'nowork',firmId:ME.id,firmName:ME.name,by:ME.name+' ('+(ME.username||ME.email||'')+')',key:'day:'+site+':'+date,site:site,date:date,workerNo:0,shiftsNow:rows.length,hoursNow:Math.round(rows.reduce(function(a,r){return a+(r.hours||0);},0)*100)/100,
    origStart:'',origEnd:'',propStart:'',propEnd:'',comment:why,at:new Date().toISOString(),status:'Pending'};
  DB.changes.push(c);audit('Farm asked: no work on this day',ME.name,site+' '+date+' ('+c.shiftsNow+' shifts) · reason: '+why);
  notify('admin','Farm change to review: '+ME.name+' says there was NO WORK at '+site+' on '+date+' and asks to cancel all '+c.shiftsNow+' shift(s) that day. Reason: '+why);
  save();closeModal();render();modal('<div class="hc-sent" id="vsnwsent" role="status"><div class="hc-tick" aria-hidden="true">✓</div><h2>Sent.</h2><p class="hc-big">The office will review it.</p><p class="hc-big">Status: <span class="pill s-pend">Waiting for office</span></p><div class="hc-sum"><b>'+esc(site)+' · '+esc(shortDay(date))+'</b> – no work this day (cancel all shifts)</div><p class="hc-big2">Until then, the hours stay on your bill.</p><div class="hc-btns"><button data-act="closeModal">OK</button></div></div>');});
ROLE_ONLY.vsnowork=['firm'];
function nwStatus(c){if(c.status==='Pending')return pill('s-pend','Waiting for office');if(c.status==='Approved')return pill('s-ok','Approved')+' <span class="small">All shifts that day were removed'+(c.removedCount!=null?' ('+c.removedCount+' shift'+(c.removedCount===1?'':'s')+', '+Number(c.removedHours||0).toFixed(2)+' h)':'')+' – not billed.</span>';
  return pill('s-bad','Not approved')+(c.note?' <span class="small">Office reason: “'+esc(c.note)+'”</span>':'')+' <span class="small muted">The hours stay.</span>';}
/* farm: status of its "no work" requests above the shifts table */
(function(){var ot=window.firmShiftTable;if(typeof ot!=='function')return;window.firmShiftTable=function(firm,R,canEdit){var x=ot.apply(this,arguments);try{var days=(R&&R.rows||[]).map(function(r){return r.date;}).sort(),from=days[0],to=days[days.length-1];
  var L=nwOf(firm.id).filter(function(c){return !from||(c.date>=from&&c.date<=to)||c.status==='Pending';}).sort(function(a,b){return a.date<b.date?1:-1;});if(!L.length)return x;
  var box='<div class="vs-nwlist" id="vsnwlist"><h3>“No work on this day” requests</h3><ul>'+L.map(function(c){return '<li data-id="'+esc(c.id)+'"><b>'+esc(c.site)+' · '+esc(shortDay(c.date))+'</b> '+nwStatus(c)+(c.comment?'<div class="small muted">Your reason: “'+esc(c.comment)+'”</div>':'')+'</li>';}).join('')+'</ul></div>';
  var i=x.indexOf('<div class="tw');return i>=0?x.slice(0,i)+box+x.slice(i):x+box;}catch(e){return x;}};})();
/* office: Farm changes – a "no work" request has its own row and decision */
function nwOfficeRow(c){var R=nwRows(c.site,c.date),h=R.reduce(function(a,r){return a+paid(r.t);},0);
  var ppl=R.map(function(r){var u=user(r.t.userId);return esc((u?u.name:'?')+' '+r.t['in']+'–'+(r.t.out||'…'))+(r.key?' <span class="muted">(scheduled)</span>':'');}).join('<br>');
  return '<tr data-id="'+esc(c.id)+'" class="vs-nwrow"><td><b>'+esc(c.firmName)+'</b><div class="small">'+esc(c.by||'')+'<br>'+fmtStamp(c.at)+'</div></td><td>'+esc(c.site)+'<br>'+esc(c.date)+'</td><td class="small">'+(c.status==='Pending'?(ppl||'<span class="muted">no shifts now</span>'):'–')+'</td>'+
  '<td>'+(c.status==='Pending'?R.length+' shift'+(R.length===1?'':'s')+'<div class="small">'+h.toFixed(2)+' paid h</div>':(c.shiftsNow!=null?c.shiftsNow+' shift(s) when asked':''))+'</td><td><b>No work this day</b><div class="small">cancel ALL shifts at this site that day</div></td><td class="small">'+esc(c.comment||'–')+'</td>'+
  '<td>'+(c.status==='Pending'?'<form data-form="vsnwdec" class="fcform"><input type="hidden" name="id" value="'+esc(c.id)+'"><textarea name="note" placeholder="Reply note to the farm (required to reject)" style="min-height:50px"></textarea><div class="row"><button class="small danger" name="act" value="approve" id="vsnwapprove">Approve – remove all '+R.length+'</button><button class="small sec" name="act" value="reject" id="vsnwreject">Reject</button></div></form>':
    nwStatus(c)+'<div class="small muted">'+esc(c.decidedBy||'')+' · '+fmtStamp(c.decidedAt)+'</div>')+'</td></tr>';}
(function(){var ov=VIEWS['admin:farmchanges'];if(!ov)return;VIEWS['admin:farmchanges']=function(){var x=ov.apply(this,arguments);try{nwOf().forEach(function(c){var re=new RegExp('<tr data-id="'+c.id.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'">[\\s\\S]*?</tr>');x=x.replace(re,function(){return nwOfficeRow(c);});});}catch(e){}return x;};})();
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-form=vsnwdec] button[name=act]');if(b)b.form._act=b.value;},true);
FORMS.vsnwdec=raw(function(f,d){if(!isOffice())return;var c=nwOf().filter(function(x){return x.id===d.id;})[0];if(!c||c.status!=='Pending')return;var a=d.act||f._act||'approve',note=String(d.note||'').trim();
  if(a==='reject'){if(!note){toast('Please write a reply note for the farm.');return;}c.status='Rejected';c.note=note;c.decidedBy=ME.name;c.decidedAt=new Date().toISOString();audit('Farm change rejected (no work on this day)',c.firmName,c.site+' '+c.date+' · note: '+note);
    notify(c.firmId,'Your request "no work on '+c.date+' at '+c.site+'" was not approved. Office reason: '+note+' The hours stay.');save();toast('Rejected – the hours stay.');render();return;}
  var R=nwRows(c.site,c.date),n=0,h=0,why='Farm: no work on this day'+(c.comment?' – '+c.comment:'')+(note?' (office: '+note+')':'');
  R.forEach(function(r){var t=r.key?placeholderFor(r.key):r.t;if(!t||isRm(t))return;h+=paid(t);n++;doRemove(t,'office',why,{noFirm:true,via:'nowork',changeId:c.id});});
  (DB.changes||[]).forEach(function(o){if(o!==c&&o.kind!=='nowork'&&o.status==='Pending'&&o.site===c.site&&o.date===c.date){o.status='Rejected';o.note='Replaced by the approved "no work on this day" request – all hours that day were removed.';o.decidedBy=ME.name;o.decidedAt=new Date().toISOString();}});
  c.status='Approved';c.note=note;c.decidedBy=ME.name;c.decidedAt=new Date().toISOString();c.removedCount=n;c.removedHours=Math.round(h*100)/100;
  audit('Farm change approved (no work on this day)',c.firmName,c.site+' '+c.date+': removed '+n+' shift(s), '+h.toFixed(2)+' h'+(note?' · note: '+note:''));
  notify(c.firmId,'Your request "no work on '+c.date+' at '+c.site+'" was approved: all '+n+' shift(s) that day were removed and will not be billed.'+(note?' Office comment: '+note:''));
  save();toast('Approved – '+n+' shift'+(n===1?'':'s')+' removed.');render();});
ADMIN_ONLY_FORM.push('vsnwdec');

wrapAll();document.addEventListener('DOMContentLoaded',wrapAll);
window.voidSync={isRemoved:isRm,all:allTime,full:FULL,version:'voidsync1'};
})();
