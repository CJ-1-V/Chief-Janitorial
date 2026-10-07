/* subaddshift1 – "Add shift" for subcontractors (owner Oct 7, 2026 7:20 PM: "there is no add shift option for subcontractor and
   give them option to add their employee shifts too").
   New file only; loaded just before v2-nohome.js (which stays last). Pairs with css/subaddshift.css.
   What "add shift" is for everyone else (unchanged): an employee adds a missed shift up to 14 days after it (v2-lateentry.js);
   a crew lead sends crew hours for the last 7 days, held for the office (v2-manualtime.js); the office adds manual hours.
   What this adds:
   - A subcontractor can add a shift for one of ITS OWN workers, or for itself when "Work shifts myself" is on (subopen1).
     Same limits as an employee's missed shift: up to 14 days after the shift date, not in the future (the shift must have ended),
     quarter-hour start / finish (finish earlier than start = next day), at most the normal shift length, no overlap with that
     person's other hours, the normal break rule, a site from the company list (codes + generic labels, never client names).
   - Stricter than employees on purpose: EVERY shift a subcontractor adds waits for the office ("Late entries" queue, the same
     approve / adjust / reject used for employees and crew leads). Until approved it is not billed and does not count in any hours.
     Once approved it counts under that subcontractor (dashboard, Workers' hours, office sub card).
   - Saved as a normal time entry: missed:true, lateEntry:'pending', subAdded:true, clockedBy = the subcontractor's id. The
     reason, note and company name go only into fields that clients never receive (note, enteredBy, clockedByName).
   - Live app: hidden until migration 016q is applied (it lets the database accept these entries and sets settings.subAddShift).
   Turn off: remove the 2 lines in index.html. */
'use strict';
(function(){
if(typeof VIEWS==='undefined'||typeof DB==='undefined'||typeof ACT==='undefined'||typeof FORMS==='undefined')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
var SA_DAYS=typeof MISSED_DAYS_EMP==='number'?MISSED_DAYS_EMP:14;   /* the employee "Add a missed shift" window */
var SA_REASONS=[['forgot','Forgot to clock in/out'],['phone','Phone / app problem'],['paper','Paper timesheet'],['correction','Correction'],['other','Other (explain in the note)']];
function realOf(m){return m&&m.__swReal?m.__swReal:m;}
function saAvail(){return !window.REG_LIVE||!!(DB.settings&&DB.settings.subAddShift);}
function swAvail(){return !window.REG_LIVE||!!(DB.settings&&DB.settings.subSelfWork);}
function coName(s){return s?((s.company&&s.company.legalName)||s.name||''):'';}
function meSub(){if(typeof ME==='undefined'||!ME)return null;var r=realOf(ME);if(!r||r.type!=='sub')return null;return user(r.id)||r;}
function selfOn(s){return !!(s&&s.type==='sub'&&s.selfWork&&s.selfWork.on)&&swAvail();}
function myWorkers(s){return users('worker').filter(function(w){return w.subId===s.id&&w.active!==false&&!w.suspended&&w.accountApproved!==false;}).sort(function(a,b){return String(a.name)<String(b.name)?-1:1;});}
function canAddFor(s,uid0){if(!s||!uid0)return null;if(uid0===s.id)return selfOn(s)?s:null;var w=user(uid0);return w&&w.type==='worker'&&w.subId===s.id&&w.active!==false&&!w.suspended&&w.accountApproved!==false?w:null;}
function reasonLab(k){var r=SA_REASONS.filter(function(x){return x[0]===k;})[0];return r?r[1].replace(/ \(explain in the note\)/,''):'';}
function sites(){return typeof companySites==='function'?companySites({skipPractice:true}):DB.sites.filter(function(s){return s.code!=='TEST-PRACTICE';});}
function siteLab(s){var g=typeof efSiteLabel==='function'?efSiteLabel(s):'';return s.code+(g?' – '+g:'');}
function paid(a,b,none){var w=hrs(a,b);return w-(none?0:unpaidBreak(w,{}));}
function timeSel(name,label,val){var x='';for(var m=0;m<1440;m+=15){var v=pad(Math.floor(m/60))+':'+pad(m%60);x+='<option value="'+v+'"'+(v===val?' selected':'')+'>'+v+'</option>';}
  return '<div><label class="req" for="sa-'+name+'">'+E(label)+'</label><select id="sa-'+name+'" name="'+name+'" class="sa-time" required>'+x+'</select></div>';}
function mine(s){return (DB.time||[]).filter(function(t){return t.subAdded&&t.clockedBy===s.id&&!t.test;}).sort(function(a,b){return String(b.addedAt||'').localeCompare(String(a.addedAt||''));});}
function pendingOf(s){return mine(s).filter(function(t){return t.lateEntry==='pending';});}
function statusPill(t){if(t.lateEntry==='pending')return '<span class="pill s-pend">Waiting for office approval</span>';if(t.lateEntry==='rejected')return '<span class="pill s-bad">Not approved</span>';return '<span class="pill s-ok">Approved – counts in hours</span>';}
function whoName(t,s){if(t.userId===s.id)return 'You';var u=user(t.userId);return u?u.name:'Worker';}

/* ---------- checks: the employee missed-shift rules, for the person the shift is for ---------- */
function check(s,d){var E2=[];var who=canAddFor(s,d.who);
  if(!d.who)E2.push('Pick who worked the shift.');
  else if(!who)E2.push(d.who===s.id?'Turn on "Work shifts myself" on your Dashboard first.':'You can only add shifts for your own workers.');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))E2.push('Pick the shift date.');
  else if(d.date>today())E2.push('Pick a past shift date.');
  else if(daysBetween(d.date,today())>SA_DAYS)E2.push('Shifts can be added up to '+SA_DAYS+' days after the shift. For anything older, please contact the office.');
  if(!sites().some(function(x){return x.code===d.site;}))E2.push('Pick a site.');
  if(!quarterOk(d['in'])||!quarterOk(d.out))E2.push('Use quarter-hour times (:00, :15, :30, :45).');
  else if(spanErr(d['in'],d.out))E2.push(spanErr(d['in'],d.out));
  if(!d.reason)E2.push('Pick a reason.');else if(d.reason==='other'&&!d.note)E2.push('Write a note for "Other".');
  if(E2.length||!who)return {E:E2,who:who};
  if(hmMsLocal(d.date,d['in'])+hrs(d['in'],d.out)*3600000>Date.now())E2.push('This shift has not ended yet. A shift can only be added after it is worked.');
  if(overlapsAny(who.id,d.date,d['in'],d.out))E2.push((who.id===s.id?'You already have':who.name+' already has')+' hours that overlap this time.');
  return {E:E2,who:who};}

/* ---------- the subcontractor's Add shift page ---------- */
function formHtml(s){var ws=myWorkers(s),self=selfOn(s),pre=PAGE_STATE.saWho||'',last=PAGE_STATE.saLast||{};
  if(!ws.length&&!self)return '<div class="card sa-card" id="saEmpty"><p>You have no workers who can have shifts added yet.</p><p class="small muted">Add and confirm workers on <a href="#/workers">My workers</a>'+(swAvail()?', or turn on "Work shifts myself" on your <a href="#/home">Dashboard</a> to add your own shifts':'')+'.</p></div>';
  var opts=(self?'<optgroup label="Yourself"><option value="'+E(s.id)+'"'+(pre===s.id?' selected':'')+'>Me – '+E(coName(s))+'</option></optgroup>':'')+
    (ws.length?'<optgroup label="Your workers">'+ws.map(function(w){return '<option value="'+E(w.id)+'"'+(pre===w.id?' selected':'')+'>'+E(w.name)+'</option>';}).join('')+'</optgroup>':'');
  return '<section class="card sa-card" id="saFormCard"><h2 class="sa-h">Shift details</h2>'+
  '<form data-form="subaddshift" id="saForm" novalidate><div class="grid2">'+
  '<div><label class="req" for="sa-who">Who worked?</label><select id="sa-who" name="who" required><option value="">– choose –</option>'+opts+'</select></div>'+
  '<div><label class="req" for="sa-site">Site</label><select id="sa-site" name="site" required><option value="">– choose –</option>'+sites().map(function(x){return '<option value="'+E(x.code)+'"'+(x.code===last.site?' selected':'')+'>'+E(siteLab(x))+'</option>';}).join('')+'</select></div>'+
  '<div><label class="req" for="sa-date">Shift date (the day it started)</label><input id="sa-date" type="date" name="date" required min="'+addDays(today(),-SA_DAYS)+'" max="'+today()+'" value="'+E(last.date||addDays(today(),-1))+'"></div>'+
  timeSel('in','Start',last['in']||'07:00')+timeSel('out','Finish',last.out||'15:00')+
  '<div><label class="req" for="sa-brk">Unpaid break</label><select id="sa-brk" name="brk" required><option value="taken"'+(last.brk!=='none'?' selected':'')+'>Break taken ('+E(breakRuleText())+')</option><option value="none"'+(last.brk==='none'?' selected':'')+'>No break taken (nothing deducted)</option></select></div>'+
  '<div><label class="req" for="sa-reason">Why was it not clocked?</label><select id="sa-reason" name="reason" required><option value="">– choose –</option>'+SA_REASONS.map(function(r){return '<option value="'+r[0]+'">'+E(r[1])+'</option>';}).join('')+'</select></div>'+
  '<div><label for="sa-note">Note for the office</label><input id="sa-note" type="text" name="note" maxlength="300" placeholder="e.g. phone battery died at 9:00"></div></div>'+
  '<div class="small sa-hint" id="saHint" aria-live="polite"></div><div id="saWarn" aria-live="polite"></div>'+
  '<button class="gold sa-send" id="saSend">Send to the office for approval</button></form></section>';}
function listHtml(s){var L=mine(s).slice(0,25);
  return '<section class="card sa-card" id="saList"><div class="sa-hd"><h2 class="sa-h">Shifts you added</h2>'+(pendingOf(s).length?'<span class="sa-tag">'+pendingOf(s).length+' waiting</span>':'')+'</div>'+
  (L.length?'<ul class="sa-items">'+L.map(function(t){return '<li data-id="'+E(t.id)+'"><div class="sa-l1"><b>'+E(whoName(t,s))+'</b> · '+E(t.site)+' · '+E(shortDay(t.date))+'</div><div class="sa-l2">'+E(t['in'])+'–'+E(t.out)+plus1H(t['in'],t.out)+' · '+paid(t['in'],t.out,t.breakMissed).toFixed(2)+' h paid'+(t.breakMissed?' · no break':'')+'</div><div class="sa-l3">'+statusPill(t)+(t.lateEntry==='rejected'&&t.lateReason?' <span class="small">Office note: '+E(t.lateReason)+'</span>':'')+(t.lateEntry==='approved'&&t.lateApprovedAt?' <span class="small muted">approved '+E(shortDay(t.lateApprovedAt))+'</span>':'')+'</div></li>';}).join('')+'</ul>':'<p class="small muted">Nothing added yet.</p>')+'</section>';}
VIEWS['sub:addshift']=function(){var s=meSub();if(!s)return '<h1>Add shift</h1>';
  if(!saAvail())return '<h1>Add shift</h1><div class="sa-rules" id="saOff">Adding shifts is not available yet. Please contact the office to add a missed shift.</div>';
  return '<h1>Add shift</h1><div class="sa-rules" id="saRules"><b>Forgot to clock in?</b> Add a shift for one of your workers'+(selfOn(s)?' or for yourself':'')+' up to '+SA_DAYS+' days after it. <b>Every shift you add is checked by the office</b> – it counts in hours and billing only after it is approved.</div>'+
    formHtml(s)+listHtml(s);};
function hint(f){var h=document.getElementById('saHint'),a=f['in']&&f['in'].value,b=f.out&&f.out.value;if(!h||!a||!b)return;
  if(spanErr(a,b)){h.innerHTML='<span class="pill s-bad">'+E(spanErr(a,b))+'</span>';return;}var w=hrs(a,b),brk=f.brk&&f.brk.value==='none'?0:unpaidBreak(w,{});
  h.innerHTML='Worked <b>'+w.toFixed(2)+' h</b>'+(brk?' − break '+brk.toFixed(2)+' h':'')+' = <b>'+(w-brk).toFixed(2)+' h paid</b>'+(isOvernight(a,b)?' <span class="pill s-temp plus1">(+1 day) finishes the next day</span>':'');}
document.addEventListener('change',function(e){var f=e.target&&e.target.form;if(f&&f.dataset&&f.dataset.form==='subaddshift')hint(f);});
function warn(list){var b=document.getElementById('saWarn');if(b)b.innerHTML=list.length?'<div class="alert bad small"><ul>'+list.map(function(m){return '<li>'+E(m)+'</li>';}).join('')+'</ul></div>':'';}
FORMS.subaddshift=function(f,d){var s=meSub();
  if(!s||!ME||ME.type!=='sub'){toast('Only a subcontractor can add shifts here.');return;}
  if(!saAvail()){toast('Adding shifts is not available yet.');return;}
  var c=check(s,d);
  if(d.who&&!c.who&&d.who!==s.id){audit('Blocked: subcontractor tried to add a shift for someone who is not their worker',coName(s),String(d.who));save();}
  if(c.E.length){warn(c.E);toast(c.E[0]);return;}
  var u=c.who,self=u.id===s.id,age=daysBetween(d.date,today()),now=new Date().toISOString(),rl=reasonLab(d.reason);
  var t={id:uid('t'),userId:u.id,site:d.site,shiftId:null,role:jobRoleOf(self&&typeof window.subopenProxy==='function'?window.subopenProxy(s):u),date:d.date,'in':d['in'],out:d.out,
    clock:true,missed:true,subAdded:true,subSelf:self,subReason:d.reason,addedAt:now,daysLate:age,breakMissed:d.brk==='none',
    note:rl+(d.note?' – '+d.note:''),clockedBy:s.id,clockedByName:coName(s),enteredBy:'subcontractor '+coName(s),subId:s.id,test:false,lateEntry:'pending'};
  DB.time.push(t);
  var desc=d.site+' '+d.date+' '+d['in']+'–'+d.out+plus1(d['in'],d.out)+(t.breakMissed?' · no break':' · break taken');
  audit('Subcontractor added a shift (waiting for office approval)',self?coName(s)+' (own hours)':u.name,desc+' · reason: '+rl+(d.note?' ('+d.note+')':'')+' · '+age+' days after');
  notify('admin','Shift to approve: '+coName(s)+' added '+(self?'their own shift':'a shift for '+u.name)+' – '+desc+'. Not billed or counted until you approve it (Late entries).');
  if(!self)notify(u.id,'Your employer added a shift for you: '+d.site+' on '+d.date+', '+d['in']+'–'+d.out+plus1(d['in'],d.out)+'. The office checks it before it counts.');
  PAGE_STATE.saLast={site:d.site,date:d.date,'in':d['in'],out:d.out,brk:d.brk};PAGE_STATE.saWho='';
  save();toast('Sent to the office for approval ✓');render();};
if(typeof ROLE_ONLY!=='undefined')ROLE_ONLY.subaddshift=['sub'];

/* menu entry (company view) */
if(NAV.sub&&!NAV.sub.some(function(n){return n[0]==='#/addshift';})){var at=0;for(var i=0;i<NAV.sub.length;i++)if(NAV.sub[i][0]==='#/workerhours'){at=i+1;break;}if(!at)at=NAV.sub.length;NAV.sub.splice(at,0,['#/addshift','Add shift']);}
(function(){var ol=layout;layout=function(c){if(!saAvail()&&typeof ME!=='undefined'&&ME&&ME.type==='sub'){var keep=NAV.sub;NAV.sub=NAV.sub.filter(function(n){return n[0]!=='#/addshift';});try{return ol.apply(this,arguments);}finally{NAV.sub=keep;}}return ol.apply(this,arguments);};})();
ACT.saopen=function(el){PAGE_STATE.saWho=el.dataset.who||'';go('#/addshift');};

/* dashboard card */
function dashCard(s){var p=pendingOf(s),ok=mine(s).filter(function(t){return t.lateEntry==='approved'&&t.date>=addDays(today(),-13);}).length;
  return '<section class="card so-card sa-dash" id="saDash"><div class="so-hd"><h2 class="so-h">Add shift</h2>'+(p.length?'<span class="sa-tag">'+p.length+' waiting for the office</span>':'')+'</div>'+
  '<div class="sa-txt">Someone forgot to clock in? Add the shift for one of your workers'+(selfOn(s)?' or yourself':'')+', up to '+SA_DAYS+' days after it. The office approves it before it counts.</div>'+
  (ok?'<p class="small muted">'+ok+' added shift'+(ok===1?'':'s')+' approved in the last 14 days.</p>':'')+
  '<div class="row sa-dbtn"><button type="button" class="gold" data-act="saopen" id="saDashBtn">+ Add shift</button>'+(selfOn(s)?'<button type="button" class="sec" data-act="saopen" data-who="'+E(s.id)+'" id="saDashSelf">Add my own shift</button>':'')+'</div></section>';}
if(VIEWS['sub:home']){var _sh=VIEWS['sub:home'];VIEWS['sub:home']=function(){var x=_sh.apply(this,arguments);try{var s=meSub();if(!s||!saAvail())return x;var c=dashCard(s);
  var k=x.indexOf('<section class="card so-card so-ready"');if(k<0)k=x.indexOf('<section class="card so-card so-self"');if(k<0)k=x.indexOf('<h2>Company checklist</h2>');x=k>=0?x.slice(0,k)+c+x.slice(k):x+c;}catch(e){try{console.warn('[subaddshift] dashboard',e);}catch(z){}}return x;};}

/* work view (subcontractor working shifts themselves): a way to add a missed own shift from My shifts */
if(VIEWS['worker:shifts']){var _ws=VIEWS['worker:shifts'];VIEWS['worker:shifts']=function(){var x=_ws.apply(this,arguments);try{if(ME&&ME.__swReal&&saAvail()){var s=realOf(ME);
  x+='<div class="card sa-card" id="saSelfCard"><h3 style="margin-top:0">Forgot to clock in?</h3><div class="sa-txt">Add your missed shift up to '+SA_DAYS+' days after it. The office checks it before it counts under '+E(coName(s))+'.</div><button type="button" class="gold" data-act="saself" id="saSelfBtn">Add a missed shift</button></div>';}}catch(e){}return x;};}
ACT.saself=function(){var s=meSub();if(!s)return;PAGE_STATE.saWho=s.id;if(ACT.swmode)ACT.swmode({dataset:{m:'company',to:'#/addshift'}});else go('#/addshift');};

/* Workers' hours: a shift added by the subcontractor is listed only once the office approved it */
if(typeof subRows==='function'){var _sr=subRows;subRows=function(sub,from,to){var rows=_sr.apply(this,arguments);try{var hide={};(DB.time||[]).forEach(function(t){if(t.subAdded&&(t.lateEntry==='pending'||t.lateEntry==='rejected'))hide['t:'+t.id]=1;});
  rows=rows.filter(function(r){return !hide[r.key];});}catch(e){}return rows;};}

/* ---------- office ---------- */
function officeTag(t){var s=user(t.clockedBy),u=user(t.userId);return '<div class="sa-otagbox"><span class="pill sa-otag">Added by subcontractor</span> <span class="small">'+E(s?coName(s):(t.clockedByName||''))+(t.subSelf?' – their own hours':'')+(t.note?' · '+E(t.note):'')+'</span></div>';}
if(VIEWS['admin:lateentries']){var _le=VIEWS['admin:lateentries'];VIEWS['admin:lateentries']=function(){var x=_le.apply(this,arguments);try{var n=0;
  (DB.time||[]).forEach(function(t){if(!t.subAdded||t.test)return;if(t.lateEntry==='pending')n++;var a='<tr data-id="'+t.id+'"><td>';var i=x.indexOf(a);if(i<0){a='<tr data-id="'+t.id+'" class="mt-q"><td>';i=x.indexOf(a);}if(i>=0){var j=x.indexOf('</td>',i+a.length);if(j>=0)x=x.slice(0,i)+'<tr data-id="'+t.id+'" class="sa-q"><td><div class="sa-pcell">'+officeTag(t)+'<div class="sa-pwho">'+x.slice(i+a.length,j)+'</div></div>'+x.slice(j);}});
  if(n){var h=x.indexOf('</h1>');var b='<div class="alert warn small" id="saOfficePend"><b>'+n+' shift'+(n===1?'':'s')+' added by subcontractors '+(n===1?'waits':'wait')+' for your approval.</b> They are not billed and do not count in any hours until you approve them. Approve, adjust or reject them below.</div>';x=h>=0?x.slice(0,h+5)+b+x.slice(h+5):b+x;}}catch(e){try{console.warn('[subaddshift] queue',e);}catch(z){}}return x;};}
if(VIEWS['admin:manualtime']){var _mt=VIEWS['admin:manualtime'];VIEWS['admin:manualtime']=function(){var x=_mt.apply(this,arguments);try{var n=(DB.time||[]).filter(function(t){return t.subAdded&&!t.test&&t.lateEntry==='pending';}).length;
  if(n){var b='<div class="alert warn small" id="saMtPend"><b>'+n+' shift'+(n===1?'':'s')+' added by subcontractors '+(n===1?'waits':'wait')+' for approval.</b> <a href="#/lateentries">Open the approval queue →</a></div>';var i=x.indexOf('<div class="row mt-filters">');x=i>=0?x.slice(0,i)+b+x.slice(i):x+b;}}catch(e){}return x;};}
/* the subcontractor (and the worker) hear back when the office decides */
if(FORMS.lateact){var _la=FORMS.lateact;FORMS.lateact=function(f,d){var t=(DB.time||[]).filter(function(x){return x.id===d.id;})[0],before=t?t.lateEntry:'';var r=_la.apply(this,arguments);
  try{if(t&&t.subAdded&&t.lateEntry!==before&&t.clockedBy){var u=user(t.userId),who=t.userId===t.clockedBy?'your own shift':'the shift for '+(u?u.name:'your worker'),desc=t.site+' on '+t.date+', '+t['in']+'–'+t.out+plus1(t['in'],t.out);
    if(t.lateEntry==='approved'){notify(t.clockedBy,'The office approved '+who+': '+desc+'. It now counts in your hours.');if(u&&t.userId!==t.clockedBy)notify(u.id,'The office approved the shift your employer added for you: '+desc+'.');}
    else if(t.lateEntry==='rejected')notify(t.clockedBy,'The office did not approve '+who+' ('+desc+'): '+(t.lateReason||''));
    save();}}catch(e){}return r;};}
/* office sub card: shifts this subcontractor sent that still wait */
if(typeof showPerson==='function'){var _sp=showPerson;showPerson=function(id){var r=_sp.apply(this,arguments);try{var u=user(id),m=document.querySelector('#modal .modal');if(!u||u.type!=='sub'||!m||!ME||ME.type!=='admin')return r;
  var old=m.querySelector('#saOfficeSub');if(old)old.remove();var n=pendingOf(u).length,box=m.querySelector('#soOffice');if(!box||!n)return r;var p=document.createElement('div');
  p.innerHTML='<div class="alert warn small" id="saOfficeSub"><b>'+n+' shift'+(n===1?'':'s')+' added by this subcontractor '+(n===1?'waits':'wait')+' for approval</b> – not counted above until approved. <button type="button" class="small" data-act="saopenq">Open Late entries</button></div>';
  var h=box.querySelector('.so-otiles');if(h)box.insertBefore(p.firstChild,h);else box.appendChild(p.firstChild);}catch(e){try{console.warn('[subaddshift] office card',e);}catch(z){}}return r;};}
ACT.saopenq=function(){try{closeModal();}catch(e){}go('#/lateentries');};
if(typeof ADMIN_ONLY_ACT!=='undefined'&&ADMIN_ONLY_ACT.indexOf('saopenq')<0)ADMIN_ONLY_ACT.push('saopenq');
})();
