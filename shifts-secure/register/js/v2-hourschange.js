/* v2-hourschange.js – Oct 6 2026: a clearer "Ask to change hours" screen for farms and other clients (test copy + live).
   The rules are unchanged, only explained better:
   - a client can ask to change a shift's start / finish time (and say if the 30-minute break was taken) up to 7 days after the shift
     (for a late entry approved by the office: 7 days from that approval);
   - the office approves, changes or rejects; approved (or office-changed) hours are final;
   - until the office answers, the original hours stay on the bill;
   - billing (Oct 6 2026, minwaive1): a worker's shifts at the farm that day are added up; break off once if the day is over 5 h and
     it was taken; 5-hour daily minimum per worker per day unless the office waived it for that farm-day.
   Workers are only ever shown as Worker #n.
   What this file changes:
   - plain-English 3-step box on the shifts list; deadline on each shift; button hidden after the deadline ("Hours final");
   - request form: original vs requested side by side, break yes/no, live billable-hours preview, required short reason,
     plain confirmation after sending;
   - status labels the client sees: Waiting for office / Approved / Changed by office / Not approved (with office comment);
   - office review (Farm changes) keeps Approve / Adjust / Reject and now also shows and can set the break. */
'use strict';
var HC_DAYS=(typeof ICSA_CHANGE_DAYS==='number'?ICSA_CHANGE_DAYS:7);
var HC_TXT={
  btn:'Ask to change hours',
  boxTitle:'Hours wrong? Ask us to fix them',
  step1:'Tap <b>Ask to change hours</b> on the shift.',
  step2:'Enter the correct start and finish time (and if a break was taken). Add a short reason.',
  step3:'Our office checks it and replies. You will see <span class="pill s-ok">Approved</span> <span class="pill s-warn">Changed by office</span> or <span class="pill s-bad">Not approved</span> here.',
  rules:'You can ask up to '+HC_DAYS+' days after the shift. After that the hours are final. Until the office answers, the original hours stay on your bill.',
  late:'Late entry approved by the office: you can ask up to '+HC_DAYS+' days after the approval.',
  final:'Hours final',
  sent:'Sent. The office will review it.'
};
function hcDeadline(r){var d=addDays(r.date,HC_DAYS);if(r.lateApprovedAt){var l=addDays(r.lateApprovedAt,HC_DAYS);if(l>d)d=l;}return d;}
function hcOpen(r){return today()<=hcDeadline(r);}
function hcDay(d){return d===today()?'today ('+shortDay(d)+')':shortDay(d);}
function hcUntil(r){return 'You can ask until '+hcDay(hcDeadline(r));}
function hcBrk(v){return v==='none'?'No break':v==='taken'?'Break taken':'';}
function hcSpan(a,b,brk){return esc(a)+'–'+esc(b)+plus1(a,b)+(brk?' · '+hcBrk(brk):'');}
function hcState(r){var c=latestChange(r.key);if(c&&c.status==='Pending')return 'pending';if(c&&(c.status==='Approved'||c.status==='Adjusted'))return 'final';return hcOpen(r)?'open':'final';}
function hcMin(){return typeof CB==='function'?Number(CB().minHours)||0:0;}
/* minwaive1: billing is per worker-day at the farm, so the preview shows the WORKER-DAY billable hours (this shift + the same worker's
   other shifts at this farm that day), using the same rule as the bill (billDay in v2-clientbilling.js). */
function hcOthers(r){var o={h:0,missed:false,n:0,waived:!!r.waived};Object.keys(PAGE_STATE.frRows||{}).forEach(function(k){var x=PAGE_STATE.frRows[k];if(x!==r&&x.uid===r.uid&&x.date===r.date){o.h+=x.hours;o.n++;if(x.breakMissed)o.missed=true;}});return o;}
function hcBill(h,brk,others){var o=others||{h:0,missed:false,waived:false};return Math.round(billDay(o.h+h,o.missed||brk==='none',o.waived)*100)/100;}

/* ---------- status labels ---------- */
changeStatusHtml=function(c){if(!c)return '';var hb=c.propBreak!=null;
  if(c.status==='Pending')return '<div class="hc-st"><span class="pill s-pend">Waiting for office</span><div class="small">You asked for: <b>'+hcSpan(c.propStart,c.propEnd,hb?c.propBreak:'')+'</b></div>'+(c.comment?'<div class="small muted">Your reason: “'+esc(c.comment)+'”</div>':'')+'</div>';
  if(c.status==='Approved')return '<div class="hc-st"><span class="pill s-ok">Approved</span><div class="small">New hours: <b>'+hcSpan(c.decStart||c.propStart,c.decEnd||c.propEnd,hb?(c.decBreak||c.propBreak):'')+'</b></div>'+(c.note?'<div class="small">Office comment: “'+esc(c.note)+'”</div>':'')+'</div>';
  if(c.status==='Adjusted')return '<div class="hc-st"><span class="pill s-warn">Changed by office</span><div class="small">Office changed it to: <b>'+hcSpan(c.decStart,c.decEnd,c.decBreak||'')+'</b></div><div class="small muted">You asked for: '+hcSpan(c.propStart,c.propEnd,hb?c.propBreak:'')+'</div>'+(c.note?'<div class="small">Office comment: “'+esc(c.note)+'”</div>':'')+'</div>';
  if(c.status==='Rejected')return '<div class="hc-st"><span class="pill s-bad">Not approved</span>'+(c.note?'<div class="small">Office reason: “'+esc(c.note)+'”</div>':'')+'<div class="small muted">The original hours stay.</div></div>';
  return '';};

/* ---------- shifts list (client view) ---------- */
function hcHelpBox(R){var late=(R.shiftRows||[]).some(function(r){return r.lateApprovedAt;});
  return '<div class="hc-help" id="hchelp" role="note"><div class="hc-help-t">'+HC_TXT.boxTitle+'</div><ol class="hc-steps">'+
    '<li><span class="hc-n">1</span><span>'+HC_TXT.step1+'</span></li><li><span class="hc-n">2</span><span>'+HC_TXT.step2+'</span></li><li><span class="hc-n">3</span><span>'+HC_TXT.step3+'</span></li></ol>'+
    '<div class="hc-rules"><b>'+HC_TXT.rules+'</b></div>'+(late?'<div class="hc-rules2">'+HC_TXT.late+'</div>':'')+'</div>';}
function hcAction(r,canEdit){var c=latestChange(r.key),st=hcState(r),x=changeStatusHtml(c);
  if(st==='open')x+=(canEdit?'<button class="small hc-btn" data-act="firmedit" data-key="'+esc(r.key)+'">'+HC_TXT.btn+'</button>':'')+'<div class="hc-dl">'+hcUntil(r)+'</div>';
  else if(st==='final')x+='<span class="hc-final" title="The '+HC_DAYS+'-day window has ended or the office has decided">'+HC_TXT.final+'</span>';
  return x;}
function hcWhen(r){return esc(r.start)+'–'+esc(r.end)+plus1H(r.start,r.end)+(r.orig?'<div class="small muted">was '+esc(r.orig.in)+'–'+esc(r.orig.out)+'</div>':'');}
function hcTags(r){return (r.manual?' <span class="pill s-manual">Manual</span>':'')+(r.temp?' <span class="badge-temp">TEMPORARY</span>':'');}
firmShiftTable=function(firm,R,canEdit){PAGE_STATE.frRows={};var rows=R.shiftRows||[];rows.forEach(function(r){PAGE_STATE.frRows[r.key]=r;});
  var x='<h2 class="hc-h2">Shifts at your sites</h2><div id="hcwrap">'+hcHelpBox(R)+'<div class="hc-anon">Workers are shown as Worker #1, #2… (no names).</div>';
  if(!rows.length)return x+'<p class="muted">No shifts in these dates. Change the dates at the top to see older shifts.</p></div>';
  x+='<div class="tw desk-only"><table class="no-stack hc-table" id="hctable"><tr><th>Date</th><th>Site</th><th>Worker</th><th>Start – finish</th><th>Break</th><th style="text-align:right">Worked</th><th style="text-align:right">Billable</th><th>Change hours</th></tr>'+
    rows.map(function(r){return '<tr data-key="'+esc(r.key)+'" class="hc-r hc-row-'+hcState(r)+'"><td class="nw">'+shortDay(r.date)+'</td><td>'+esc(r.site)+hcTags(r)+'</td><td class="nw">Worker #'+r.no+'</td><td>'+hcWhen(r)+(r.lateNote?'<div class="small muted">'+esc(r.lateNote)+'</div>':'')+'</td><td>'+(r.breakMissed?'No':'Yes')+'</td><td style="text-align:right">'+r.hours.toFixed(2)+'</td><td style="text-align:right">'+r.bill.toFixed(2)+'</td><td class="hc-act">'+hcAction(r,canEdit)+'</td></tr>';}).join('')+'</table></div>';
  x+='<div class="phone-only" id="hccards">'+rows.map(function(r){return '<div class="hc-card hc-row-'+hcState(r)+'" data-key="'+esc(r.key)+'"><div class="hc-ch"><b>'+shortDay(r.date)+'</b><span>'+esc(r.site)+' · Worker #'+r.no+hcTags(r)+'</span></div>'+
    '<div class="hc-cg"><div><span>Start – finish</span>'+hcWhen(r)+'</div><div><span>Break</span>'+(r.breakMissed?'No':'Yes')+'</div><div><span>Worked</span>'+r.hours.toFixed(2)+' h</div><div><span>Billable</span>'+r.bill.toFixed(2)+' h</div></div>'+
    (r.lateNote?'<div class="small muted">'+esc(r.lateNote)+'</div>':'')+'<div class="hc-act">'+hcAction(r,canEdit)+'</div></div>';}).join('')+'</div>';
  return x+'</div>';};

/* section title on the client home (the section itself is built by v2-declutter.js) */
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{var s=root&&root.querySelector&&root.querySelector('#sect-shifts > summary');if(s&&ME&&ME.type==='firm'&&!s.dataset.hc){s.dataset.hc='1';var n=root.querySelectorAll('#hctable tr.hc-row-pending').length;s.innerHTML=esc(clientWord('Shifts at your sites – ask to change hours',ME))+(n?' <span class="pill s-pend">'+n+' waiting for office</span>':'');}}catch(e){logError(e);}};})();

/* ---------- request form ---------- */
function hcTimeSel(name,val,label){var x='',seen=false;for(var m=0;m<1440;m+=15){var v=pad(Math.floor(m/60))+':'+pad(m%60);if(!seen&&val&&val<v){x+='<option value="'+esc(val)+'" selected>'+esc(val)+'</option>';seen=true;}if(v===val)seen=true;x+='<option value="'+v+'"'+(v===val?' selected':'')+'>'+v+'</option>';}
  if(!seen&&val)x+='<option value="'+esc(val)+'" selected>'+esc(val)+'</option>';return '<select name="'+name+'" id="hc_'+name+'" aria-label="'+esc(label)+'" required>'+x+'</select>';}
ACT.firmedit=function(el){var r=(PAGE_STATE.frRows||{})[el.dataset.key];if(!r)return;
  if(hcState(r)!=='open'){toast(hcState(r)==='pending'?'This shift is waiting for the office.':'The hours for this shift are final.');return;}
  var ob=r.breakMissed?'none':'taken',others=hcOthers(r),ob2=hcBill(r.hours,ob,others);PAGE_STATE.hcEdit={key:r.key,others:others,start:r.start,end:r.end,brk:ob,bill:ob2};
  modal('<h2>'+HC_TXT.btn+'</h2><div class="hc-who"><b>'+esc(r.site)+' · '+shortDay(r.date)+' · Worker #'+r.no+'</b></div><div class="hc-dl">'+hcUntil(r)+'</div>'+
  '<form data-form="firmchg" id="hcform"><input type="hidden" name="key" value="'+esc(r.key)+'">'+
  '<div class="hc-cmp" role="group" aria-label="Hours now and correct hours">'+
    '<div class="hc-hd"></div><div class="hc-hd">Now</div><div class="hc-hd hc-new">Correct hours</div>'+
    '<div class="hc-l">Start</div><div class="hc-o">'+esc(r.start)+'</div><div>'+hcTimeSel('start',r.start,'Correct start time')+'</div>'+
    '<div class="hc-l">Finish</div><div class="hc-o">'+esc(r.end)+plus1(r.start,r.end)+'</div><div>'+hcTimeSel('end',r.end,'Correct finish time')+'</div>'+
    '<div class="hc-l">Break<br><span class="hc-sub">'+BREAK_MIN+' min</span></div><div class="hc-o">'+(ob==='none'?'No':'Yes')+'</div><div><select name="brk" id="hc_brk" aria-label="Was the break taken?"><option value="taken"'+(ob==='taken'?' selected':'')+'>Yes, taken</option><option value="none"'+(ob==='none'?' selected':'')+'>No break</option></select></div>'+
    '<div class="hc-l">Worked</div><div class="hc-o">'+r.hours.toFixed(2)+' h</div><div class="hc-v" id="hcnewh">'+r.hours.toFixed(2)+' h</div>'+
    '<div class="hc-l">Billable'+(others.n?'<br><span class="hc-sub">whole day, '+(others.n+1)+' shifts</span>':'')+'</div><div class="hc-o">'+ob2.toFixed(2)+' h</div><div class="hc-v" id="hcnewb">'+ob2.toFixed(2)+' h</div>'+
  '</div><div class="hc-diff" id="hcdiff" aria-live="polite">Change the time or the break above.</div>'+
  '<div class="hc-note">Billable = this worker\'s hours at your farm that day (all shifts added up), minus '+CB().breakMin+' min once if the day is over '+BILL_BREAK_OVER+' h and a break was taken.'+(hcMin()?(others.waived?' Minimum waived for this day.':' Minimum '+hcMin()+' billable hours per worker per day.'):'')+'</div>'+
  '<label class="req" for="hcreason">Reason (short)</label><textarea name="comment" id="hcreason" required minlength="3" maxlength="200" rows="2" placeholder="e.g. Worker went home at 2 pm because of rain"></textarea>'+
  '<div class="hc-note"><b>Until the office answers, the original hours stay on your bill.</b></div>'+
  '<div class="hc-btns"><button type="submit" id="hcsend">Send to office</button><button type="button" class="sec" data-act="closeModal">Cancel</button></div></form>');
  hcPreview();};
function hcPreview(){var E=PAGE_STATE.hcEdit,f=document.getElementById('hcform');if(!E||!f)return;var st=f.start.value,en=f.end.value,brk=f.brk.value,out=document.getElementById('hcdiff');
  var err=spanErr(st,en);if(err){out.className='hc-diff bad';out.textContent=err;document.getElementById('hcnewh').textContent='–';document.getElementById('hcnewb').textContent='–';return;}
  var h=hrs(st,en),b=hcBill(h,brk,E.others),d=Math.round((b-E.bill)*100)/100;
  document.getElementById('hcnewh').textContent=h.toFixed(2)+' h';document.getElementById('hcnewb').textContent=b.toFixed(2)+' h';
  if(st===E.start&&en===E.end&&brk===E.brk){out.className='hc-diff';out.textContent='Change the time or the break above.';return;}
  out.className='hc-diff '+(d<0?'less':d>0?'more':'same');
  out.innerHTML='Billable hours: <b>'+E.bill.toFixed(2)+' → '+b.toFixed(2)+'</b> '+(d===0?'(no change)':'('+Math.abs(d).toFixed(2)+' h '+(d<0?'less':'more')+')');}
['input','change'].forEach(function(ev){document.addEventListener(ev,function(e){if(e.target&&e.target.closest&&e.target.closest('#hcform'))hcPreview();});});

FORMS.firmchg=function(f,d){var firm=ME;var r=(PAGE_STATE.frRows||{})[d.key];
  if(!r||firmCodes(firm).indexOf(r.site)<0){toast('Not allowed.');audit('Blocked firm change (not own site)',firm.name);save();return;}
  var st=hcState(r);if(st==='pending'){toast('This shift is already waiting for the office.');return;}
  if(st!=='open'){toast('The hours for this shift are final (more than '+HC_DAYS+' days ago).');closeModal();render();return;}
  if(spanErr(d.start,d.end)){toast(spanErr(d.start,d.end));return;}
  var ob=r.breakMissed?'none':'taken',brk=d.brk==='none'?'none':'taken';
  if(d.start===r.start&&d.end===r.end&&brk===ob){toast('You did not change anything.');return;}
  if(!d.comment||d.comment.length<3){toast('Please write a short reason.');return;}
  var c={id:uid('fc'),firmId:firm.id,firmName:firm.name,by:firm.name+' ('+(firm.username||firm.email)+')',key:d.key,site:r.site,date:r.date,workerNo:r.no,uid:r.uid,origStart:r.start,origEnd:r.end,origBreak:ob,propStart:d.start,propEnd:d.end,propBreak:brk,comment:d.comment,at:new Date().toISOString(),status:'Pending'};
  if(String(d.key).indexOf('c:')===0){var csh=DB.shifts.filter(function(x){return x.id===String(d.key).split(':')[1];})[0];if(csh)c.crewSize=(csh.booked||[]).length;} /* count only, for the office check */
  DB.changes.push(c);
  audit('Farm proposed shift time change',firm.name,r.site+' '+r.date+' Worker #'+r.no+': '+r.start+'–'+r.end+plus1(r.start,r.end)+' ('+hcBrk(ob)+') → '+d.start+'–'+d.end+plus1(d.start,d.end)+' ('+hcBrk(brk)+') ("'+d.comment+'")');
  notify('admin','Farm change to review: '+firm.name+' asks for '+d.start+'–'+d.end+plus1(d.start,d.end)+', '+hcBrk(brk).toLowerCase()+' (was '+r.start+'–'+r.end+plus1(r.start,r.end)+', '+hcBrk(ob).toLowerCase()+') for '+r.site+' on '+r.date+'. Reason: '+d.comment);
  save();var y=window.scrollY;PAGE_STATE.after=function(){window.scrollTo(0,y);};render();
  modal('<div class="hc-sent" id="hcsent" role="status"><div class="hc-tick" aria-hidden="true">✓</div><h2>Sent.</h2><p class="hc-big">The office will review it.</p><p class="hc-big">Status: <span class="pill s-pend">Waiting for office</span></p>'+
    '<div class="hc-sum"><div><b>'+esc(r.site)+' · '+shortDay(r.date)+' · Worker #'+r.no+'</b></div><div>You asked for: <b>'+hcSpan(d.start,d.end,brk)+'</b></div><div class="muted">Now on your bill: '+hcSpan(r.start,r.end,ob)+'</div></div>'+
    '<p class="hc-big2">We will show the answer on this shift. Until then, the original hours stay on your bill.</p><div class="hc-btns"><button data-act="closeModal" id="hcok">OK</button></div></div>');};

/* ---------- office: Farm changes review (same Approve / Adjust / Reject, plus the break) ---------- */
/* live: the farm only has an anonymous id (anon-1…), so the office finds the person through the time entry */
/* Fix, Oct 6 2026: on a scheduled crew row (no clock-in yet) the farm's key is 'c:<shift id>:anon-N'. The server numbers each
   shift's real crew list for the farm (reg_client_bookings: anon-1 = 1st person on the list, anon-2 = 2nd, …), so the office,
   which has the real list, can turn anon-N back into the real worker. Before this fix the approval saved the hours under 'anon-N'.
   If the crew list changed after the farm asked (crewSize differs), or the person can't be found, nothing is saved and the office
   is told to check. Farms still only ever see Worker #n; no worker id or name is written to the request the farm can read. */
function hcCrewReal(c){var p=String(c&&c.key||'').split(':');if(p[0]!=='c'||p.length<3)return null;var m=/^anon-(\d+)$/.exec(p[2]);if(!m)return null;
  var FIX=' Please check with the farm, then enter the hours by hand in Hours, or reject this request.',sh=DB.shifts.filter(function(x){return x.id===p[1];})[0];
  if(!sh)return {err:'This shift is no longer in the schedule, so the app can\'t tell which worker this is.'+FIX};
  var b=sh.booked||[],n=+m[1];
  if(c.crewSize!=null&&+c.crewSize!==b.length)return {err:'The crew list for this shift changed after the farm sent this request, so the app can\'t be sure which worker it is.'+FIX};
  var u=user(b[n-1]);if(!u||u.anonymous)return {err:'The app can\'t find this worker on the shift\'s crew list.'+FIX};
  return {uid:u.id,user:u,sh:sh};}
(function(){var orig=applyFarmChange;
  applyFarmChange=function(c,st,en){var r=hcCrewReal(c);if(!r)return orig(c,st,en);if(r.err)return;
    var t=DB.time.filter(function(x){return x.key0===c.key;})[0]||DB.time.filter(function(x){return x.userId===r.uid&&x.shiftId===r.sh.id&&!x.test;})[0];
    if(!t){t={id:uid('t'),userId:r.uid,site:r.sh.site,shiftId:r.sh.id,role:r.sh.role||(typeof jobRoleOf==='function'?jobRoleOf(r.user):''),date:c.date||r.sh.date,in:r.sh.start,out:r.sh.end,test:false,subId:r.user.subId,key0:c.key,fromSchedule:true};DB.time.push(t);}
    else if(/^anon-/.test(String(t.userId))){t.userId=r.uid;t.site=t.site||r.sh.site;t.subId=r.user.subId;} /* repairs an entry an earlier approval saved under the farm's id */
    if(!t.orig)t.orig={in:t.in,out:t.out};t.in=st;t.out=en;t.changeId=c.id;};})();
function hcWorker(c){var u=user(c.uid);if(u&&!u.anonymous)return u;var cr=hcCrewReal(c);if(cr)return cr.user||null;var k=String(c.key||''),t=k.indexOf('t:')===0?DB.time.filter(function(x){return x.id===k.slice(2);})[0]:DB.time.filter(function(x){return x.key0===k;})[0];return t?user(t.userId):(k.indexOf('c:')===0?user(k.split(':')[2]):null);}
function hcOfficeList(){var f=PAGE_STATE.fcf||'Pending';var list=DB.changes.filter(function(c){return f==='All'||c.status===f;}).slice().reverse();
  var brkSel=function(v){return '<select name="brk" aria-label="Break" style="max-width:150px"><option value="taken"'+(v!=='none'?' selected':'')+'>Break taken</option><option value="none"'+(v==='none'?' selected':'')+'>No break</option></select>';};
  return '<h1>Farm changes</h1><p class="small muted">Shift time changes asked for by farms and other clients (start, finish and whether the '+BREAK_MIN+'-minute break was taken). Only approved (or adjusted) changes affect hours, pay and billing. Every decision is written to the audit log and the farm sees the outcome and your note.</p>'+
  '<div class="hc-legend small"><b>What the farm sees:</b> Pending = <span class="pill s-pend">Waiting for office</span> · Approved = <span class="pill s-ok">Approved</span> · Adjusted = <span class="pill s-warn">Changed by office</span> · Rejected = <span class="pill s-bad">Not approved</span>. A note is required to adjust or reject.</div>'+
  '<div class="row">'+['Pending','Approved','Adjusted','Rejected','All'].map(function(s){return '<button class="small '+(s===f?'':'sec')+'" data-act="fcfilter" data-s="'+s+'">'+s+' ('+(s==='All'?DB.changes.length:DB.changes.filter(function(c){return c.status===s;}).length)+')</button>';}).join('')+'</div>'+
  (list.length?'<div class="tw" style="margin-top:8px"><table id="fctable"><tr><th>Farm / who / when</th><th>Site · date</th><th>Worker (office only)</th><th>Original</th><th>Farm asks for</th><th>Farm reason</th><th>Decision</th></tr>'+list.map(function(c){var u=hcWorker(c);var hb=c.propBreak!=null;
    return '<tr data-id="'+c.id+'"><td><b>'+esc(c.firmName)+'</b><div class="small">'+esc(c.by)+'<br>'+fmtStamp(c.at)+'</div></td><td>'+esc(c.site)+'<br>'+esc(c.date)+'</td><td class="small">'+esc(u?u.name:'?')+'<br>(farm sees Worker #'+c.workerNo+')</td>'+
    '<td>'+esc(c.origStart)+'–'+esc(c.origEnd)+plus1(c.origStart,c.origEnd)+'<div class="small">'+hrs(c.origStart,c.origEnd).toFixed(2)+' h'+(hb?' · '+hcBrk(c.origBreak):'')+'</div></td>'+
    '<td><b>'+esc(c.propStart)+'–'+esc(c.propEnd)+plus1(c.propStart,c.propEnd)+'</b><div class="small">'+hrs(c.propStart,c.propEnd).toFixed(2)+' h'+(hb?' · <b>'+hcBrk(c.propBreak)+'</b>':'')+'</div></td><td class="small">'+esc(c.comment||'–')+'</td>'+
    '<td>'+(c.status==='Pending'?'<form data-form="fcnone" class="fcform" data-id="'+c.id+'"><div class="row"><input type="time" name="start" value="'+esc(c.propStart)+'" style="max-width:120px" aria-label="Start"><input type="time" name="end" value="'+esc(c.propEnd)+'" style="max-width:120px" aria-label="Finish">'+brkSel(hb?c.propBreak:(c.origBreak||'taken'))+'</div><textarea name="note" placeholder="Reply note to the farm (required to reject or adjust)" style="min-height:50px"></textarea><div class="row"><button class="small" data-act="fcdec" data-d="Approved" data-id="'+c.id+'">Approve</button><button class="small sec" data-act="fcdec" data-d="Adjusted" data-id="'+c.id+'">Adjust (use times above)</button><button class="small danger" data-act="fcdec" data-d="Rejected" data-id="'+c.id+'">Reject</button></div></form>':changeStatusHtml(c).replace(/You asked for/g,'Farm asked for').replace(/Your reason/g,'Farm reason')+'<div class="small muted">'+esc(c.decidedBy||'')+' · '+fmtStamp(c.decidedAt)+'</div>')+'</td></tr>';}).join('')+'</table></div>':'<p class="muted" style="margin-top:8px">Nothing here.</p>');}
(function(){var ov=VIEWS['admin:farmchanges'];VIEWS['admin:farmchanges']=function(){var x=ov(),i=x.indexOf('<h2>Crew-lead clock entries</h2>');return hcOfficeList()+(i>=0?x.slice(i):'');};})();
ACT.fcdec=function(el){var c=DB.changes.filter(function(x){return x.id===el.dataset.id;})[0];if(!c||c.status!=='Pending')return;var f=el.closest('form'),dec=el.dataset.d,note=f.note.value.trim(),st=f.start.value,en=f.end.value,brk=f.brk?f.brk.value:null,hb=c.propBreak!=null;
  if(!hb&&brk===(c.origBreak||'taken'))brk=null; /* older request without a break answer: only change the break if the office picks a different one */
  if((dec==='Rejected'||dec==='Adjusted')&&!note){toast('Please write a reply note for the farm.');return;}
  if(dec==='Adjusted'){if(spanErr(st,en)){toast(spanErr(st,en));return;}var sameBrk=hb?brk===c.propBreak:brk===null;if(st===c.propStart&&en===c.propEnd&&sameBrk){toast('Times are the same as proposed – use Approve, or change the times.');return;}}
  if(dec==='Approved'){st=c.propStart;en=c.propEnd;brk=hb?c.propBreak:null;}
  if(dec!=='Rejected'){var cr=hcCrewReal(c);if(cr&&cr.err){toast(cr.err);return;}}
  if(dec!=='Rejected'){applyFarmChange(c,st,en);if(brk){var t=DB.time.filter(function(x){return x.changeId===c.id;})[0];if(t){if(t.orig&&t.orig.breakMissed===undefined)t.orig.breakMissed=!!t.breakMissed;t.breakMissed=brk==='none';}}}
  c.status=dec;c.note=note;c.decStart=dec==='Rejected'?'':st;c.decEnd=dec==='Rejected'?'':en;c.decBreak=dec==='Rejected'?'':(brk||'');c.decidedBy=ME.name;c.decidedAt=new Date().toISOString();
  var applied=st+'–'+en+plus1(st,en)+(brk?', '+hcBrk(brk).toLowerCase():'');
  audit('Farm change '+dec.toLowerCase(),c.firmName,c.site+' '+c.date+' Worker #'+c.workerNo+': original '+c.origStart+'–'+c.origEnd+', proposed '+c.propStart+'–'+c.propEnd+(hb?' ('+hcBrk(c.propBreak).toLowerCase()+')':'')+(dec!=='Rejected'?', applied '+applied:'')+(note?' · note: '+note:''));
  var what='Your request to change hours for '+c.site+' on '+c.date+' (Worker #'+c.workerNo+')';
  notify(c.firmId,dec==='Approved'?what+' was approved. New hours: '+applied+'.'+(note?' Office comment: '+note:''):dec==='Adjusted'?what+' was changed by the office to '+applied+'. Office comment: '+note:what+' was not approved. Office reason: '+note);
  var u=hcWorker(c);if(u&&dec!=='Rejected')notify(u.id,'Your hours on '+c.date+' were updated to '+applied+' after a farm change approved by the office.');
  save();toast('Decision saved.');render();};
