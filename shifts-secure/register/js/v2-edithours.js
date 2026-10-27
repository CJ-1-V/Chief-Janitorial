/* v2-edithours.js – edithours1 (owner Oct 18 2026, 11:39 PM). TEST COPY.
   "can you give option to edit hours right near remove of farms"
   All hours (and the opened farm / day, which shows the same rows): an "Edit hours" button right next to every "Remove".
   - Start, finish and break (taken / none) – quarter hours, the normal break rule (30 min over 5 h, 60 min at 8 h or more),
     at most the normal shift length, no finish in the future, no overlap with the person's other hours. A reason is required.
   - Before / after paid hours and the farm's day total are shown live; after saving the totals, the farm boxes and new invoices
     use the new hours straight away. The first original times are kept (t.orig, the same field farm changes use), every change is
     in the entry's "Edit history" and the Audit log; the person (and their subcontractor) and the farm are told, like Remove.
   - Issued invoice for that date: it does NOT change (same as Remove) – warning + "make a revised invoice (Revise)" note, the
     entry remembers the invoice number. Wagepoint period already exported: warning, correct it in Wagepoint too.
   - Manual entries keep their own editor (Manual hours rules: Owner / Admin / Payroll-billing) – the button opens it.
   - Clocked / added-later / crew-lead / sub entries: Owner / Admin / Ops (office roles allowed to write hours; Billing may only remove).
     Office Assistant: as today – their change waits for the owner's OK, farm codes only.
   - Not editable (same as Remove or simpler): removed rows (Restore first), Shift Tracker records, shifts still open, late entries
     waiting for approval (use Approve / adjust).
   clockout1 (owner Oct 26 2026 8:09 PM, TEST COPY): "I need a button here to punch them out when they forget and change hours manually".
   "Clocked in right now" (per-farm list) gets a "Clock out" button on each open shift, for the SAME office roles as Edit hours
   (clockOk). It opens this same Edit hours window in clock-out mode: finish defaults to now (quarter hour, earlier allowed, never
   future), start can be corrected, break optional (shared "Break given" picker), reason required. Saved through FORMS.eheditok:
   t.orig keeps the first times, t.officeEdited + Edit history + Audit log ("Clocked out by office"), t.officeClockOut marks it,
   the person / sub / farm are told and the farm is asked to check (Ask to change hours, 7 days), like other office-entered hours.
   Load after v2-alertdismiss.js. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function roles(){var u=ME||{};var r=(u.officeRoles&&u.officeRoles.length?u.officeRoles:(u.officeRole?[u.officeRole]:[])).map(String);if(typeof officeRoleOf==='function'){var x=officeRoleOf(u);if(x&&r.indexOf(x)<0)r.push(String(x));}return r;}
function office(){return typeof ME!=='undefined'&&ME&&ME.type==='admin';}
function manualOk(){if(!office()||window.MT_OFF)return false;var r=roles();return ['owner','admin','payroll','billing'].some(function(x){return r.indexOf(x)>=0;});}
function clockOk(){if(!office())return false;var r=roles();if(!r.length)return true;return ['owner','admin','ops','helper'].some(function(x){return r.indexOf(x)>=0;});}
function all(){return typeof allTime==='function'?allTime():(DB.time||[]);}
function byId(id){return (DB.time||[]).filter(function(t){return t.id===id;})[0]||null;}
function siteOf(t){if(t.site)return t.site;var s=(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return s?s.site:'';}
function paidOf(a,b,none){if(!a||!b)return 0;var w=hrs(a,b);return Math.max(0,w-(none?0:unpaidBreak(w,{})));}
function paidT(t){return t.out?paidOf(t['in'],t.out,!!t.breakMissed):0;}
function span(a,b){return a+'–'+b+(typeof plus1==='function'?plus1(a,b):'');}
function farmOf(code){return typeof firmOfSite==='function'?firmOfSite(code):null;}
function siteLabel(code){var f=farmOf(code);return code+(f&&!helper()?' – '+(f.realName||f.name):'');}
function invFor(site,date){var f=farmOf(site);if(!f)return null;return (DB.clientInvoices||[]).filter(function(i){return i.firmId===f.id&&!i.deleted&&i.periodStart&&i.periodStart<=date&&date<=(i.periodEnd||i.periodStart);})[0]||null;}
function exported(date){return (DB.payExports||[]).filter(function(x){return x.start<=date&&date<=x.end;}).slice(-1)[0]||null;}
function dayTotal(site,date,swap){var tot=0;(DB.time||[]).forEach(function(t){if(t.test||t.removed||t.date!==date||siteOf(t)!==site||!t.out)return;if(t.lateEntry==='pending'||t.lateEntry==='rejected')return;
  tot+=swap&&swap.id===t.id?paidOf(swap['in'],swap.out,swap.none):paidT(t);});if(swap&&swap.add)tot+=paidOf(swap['in'],swap.out,swap.none);return tot;}
function sched(key){var m=/^c:([^:]+):(.+)$/.exec(key||'');if(!m)return null;var sh=(DB.shifts||[]).filter(function(s){return s.id===m[1];})[0];if(!sh)return null;
  return {id:'key:'+key,key:key,userId:m[2],shiftId:sh.id,site:sh.site,date:sh.date,'in':sh.start,out:sh.end,breakMissed:false,sched:true};}
/* which rows get the button */
function why(t,co){if(!t)return 'not found';if(t.removed)return 'removed';if(String(t.id).indexOf('st-')===0)return 'st';if(co){if(t.out)return 'closed';if(t.voided||t.test||!t['in']||t.sched)return 'no';return clockOk()?'':'role';}if(!t.out)return 'open';if(t.lateEntry==='pending'||t.lateEntry==='rejected')return 'late';
  if(t.manual||t.unassigned)return manualOk()?'':'role';return clockOk()?'':'role';}
function btn(attr){return '<button class="small sec eh-btn" data-act="ehedit" '+attr+'>Edit hours</button>';}
function addButtons(x){if(typeof x!=='string'||x.indexOf('data-act="vsrm"')<0||!office())return x;
  return x.replace(/<button class="small danger" data-act="vsrm" data-(id|key)="([^"]*)">Remove<\/button>/g,function(m,k,v){
    var t=k==='id'?byId(v.replace(/&amp;/g,'&')):sched(v.replace(/&amp;/g,'&'));if(!t||why(t))return m;return '<span class="eh-pair">'+btn('data-'+k+'="'+v+'"')+m+'</span>';});}
(function(){var o=VIEWS['admin:allhours'];if(typeof o!=='function')return;VIEWS['admin:allhours']=function(){return addButtons(o.apply(this,arguments));};})();
/* the edit window */
function qNow(){var d=new Date(),m=d.getHours()*60+d.getMinutes();m-=m%15;return pad(Math.floor(m/60))+':'+pad(m%60);}
function qNear(v){if(!/^\d{2}:\d{2}$/.test(v||''))return v;var m=+v.slice(0,2)*60+ +v.slice(3);m=Math.round(m/15)*15%1440;return pad(Math.floor(m/60))+':'+pad(m%60);}
window.ehCanClockOut=function(t){return office()&&!why(t,true);};
function tsel(name,label,val){var x='';for(var m=0;m<1440;m+=15){var v=pad(Math.floor(m/60))+':'+pad(m%60);x+='<option value="'+v+'"'+(v===val?' selected':'')+'>'+v+'</option>';}
  return '<div><label class="req" for="eh'+name+'">'+label+'</label><select name="'+name+'" id="eh'+name+'" required>'+x+'</select></div>';}
function warnList(t){var W=[],u=user(t.userId),inv=invFor(siteOf(t),t.date),ex=u&&u.type==='employee'?exported(t.date):null;
  if(inv)W.push('Client invoice '+inv.number+' is already issued for this date. It will NOT change – make a revised invoice (Revise on the invoice) if the farm should be billed the new hours.');
  if(t.lateBilledInv&&(!inv||inv.number!==t.lateBilledInv))W.push('Already billed on client invoice '+t.lateBilledInv+' – that invoice does not change.');
  if(ex)W.push('This pay period ('+ex.start+' to '+ex.end+') was already exported for Wagepoint – correct it in Wagepoint too.');
  var c=typeof latestChange==='function'?latestChange(t.key0||('t:'+t.id)):null;if(c&&c.status==='Pending')W.push('The farm asked to change these hours (waiting in Farm changes). Answer that request too.');
  if(t.removeReq&&t.removeReq.status==='pending')W.push('There is a remove request waiting for this shift.');
  return W;}
function histHtml(t){var H=(t.editHistory||[]);if(!H.length&&!t.orig)return '';
  return '<details class="eh-hist"><summary>Edit history ('+H.length+')</summary><ul class="small">'+(t.orig?'<li>First recorded: '+E(span(t.orig['in'],t.orig.out))+'</li>':'')+H.map(function(h){return '<li>'+E(typeof fmtStamp==='function'?fmtStamp(h.at):h.at)+' · '+E(h.by)+': '+E(h.old)+' → '+E(h['new'])+(h.reason?' – “'+E(h.reason)+'”':'')+'</li>';}).join('')+'</ul></details>';}
function who(t){if(t.unassigned)return 'Unassigned'+(t.uaNick?': '+t.uaNick:'');var u=user(t.userId);return u?u.name:'';}
ACT.ehedit=function(el){if(!office())return;if(el.dataset.co)return coOpen(el);var t=el.dataset.key?sched(el.dataset.key):byId(el.dataset.id);var w=why(t);
  if(w){toast(w==='role'?'Your office role cannot change these hours.':w==='open'?'This shift is still open – it can be changed after clock-out.':w==='late'?'Use Approve / adjust in Late entries for this one.':'These hours cannot be changed here.');return;}
  if(t.manual&&!t.unassigned&&typeof ACT.mtedit==='function'){ACT.mtedit({dataset:{id:t.id}});return;}   /* Manual hours' own editor (same rules, its history) */
  var W=warnList(t),site=siteOf(t),before=paidT(t),day=dayTotal(site,t.date);
  modal('<div id="ehbox"><h2>Edit hours</h2><p><b>'+E(who(t))+'</b> · '+E(siteLabel(site))+' · '+E(typeof shortDay==='function'?shortDay(t.date):t.date)+'</p>'+
    '<p class="small">Now: <b>'+E(span(t['in'],t.out))+'</b> · '+'break '+HR.label(t)+' · <b>'+before.toFixed(2)+' h</b> paid'+(t.sched?' (scheduled crew hours – nobody clocked)':'')+'</p>'+
    '<form data-form="eheditok" id="eheditform"><input type="hidden" name="id" value="'+E(t.id)+'"><div class="grid2">'+tsel('in','Start',t['in'])+tsel('out','Finish',t.out)+
    '<div><label class="req" for="ehbrk">Unpaid break</label><select name="brk" id="ehbrk"><option value="taken"'+(t.breakMissed?'':' selected')+'>Break taken (normal rule)</option><option value="none"'+(t.breakMissed?' selected':'')+'>No break taken</option></select></div>'+
    '<div><label class="req" for="ehwhy">Why? (the worker sees this – do not write the farm\'s name)</label><input type="text" name="why" id="ehwhy" required maxlength="200" placeholder="e.g. clocked out late by mistake"></div></div>'+
    '<div class="eh-calc" id="ehcalc" data-before="'+before+'" data-day="'+day+'"></div><div id="ehwarn">'+(W.length?'<div class="alert warn small"><ul>'+W.map(function(x){return '<li>'+E(x)+'</li>';}).join('')+'</ul></div>':'')+'</div>'+
    (W.length?'<label class="inline eh-sure"><input type="checkbox" name="sure" value="1"> <b>I read the warning – save anyway</b></label>':'')+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button id="ehgo">Save hours</button></div></form>'+(t.sched?'':histHtml(t))+'</div>');
  calc();};
/* clockout1: same window, clock-out mode (open shift, no finish yet) */
function coOpen(el){var t=byId(el.dataset.id),w=why(t,true);
  if(w){toast(w==='role'?'Your office role cannot change these hours.':w==='closed'?'This shift is already clocked out.':'This shift cannot be clocked out here.');return;}
  var site=siteOf(t),day=dayTotal(site,t.date),inQ=qNear(t['in']),W=warnList(t);
  window.__ehCoBack=el.dataset.back!=null?el.dataset.back:null;
  modal('<div id="ehbox" class="eh-co"><h2>Clock out (forgot to clock out)</h2><p><b>'+E(who(t))+'</b> · '+E(siteLabel(site))+' · '+E(typeof shortDay==='function'?shortDay(t.date):t.date)+'</p>'+
    '<p class="small">Clocked in at <b>'+E(t['in'])+'</b>'+(t.date!==today()?' (yesterday)':'')+' · still on shift. Pick when they really finished. If the clock-in time was wrong, change Start too.'+(inQ!==t['in']?' Start is rounded to the nearest quarter hour.':'')+'</p>'+
    '<form data-form="eheditok" id="eheditform"><input type="hidden" name="id" value="'+E(t.id)+'"><input type="hidden" name="co" value="1"><div class="grid2">'+tsel('in','Start (clock-in)',inQ)+tsel('out','Finish (clock-out)',qNow())+
    '<div><label for="ehbrk">Unpaid break (optional)</label><select name="brk" id="ehbrk"><option value="taken" selected>Break taken (normal rule)</option><option value="none">No break taken</option></select></div>'+
    '<div><label class="req" for="ehwhy">Why? (the worker sees this – do not write the farm\'s name)</label><input type="text" name="why" id="ehwhy" required maxlength="200" placeholder="e.g. forgot to clock out"></div></div>'+
    '<div class="eh-calc" id="ehcalc" data-before="0" data-day="'+day+'" data-co="1"></div><div id="ehwarn">'+(W.length?'<div class="alert warn small"><ul>'+W.map(function(x){return '<li>'+E(x)+'</li>';}).join('')+'</ul></div>':'')+'</div>'+
    '<p class="small muted eh-cofarm">The farm is told and can ask to change these hours (Ask to change hours, '+(typeof HC_DAYS==='number'?HC_DAYS:7)+' days).</p>'+
    (W.length?'<label class="inline eh-sure"><input type="checkbox" name="sure" value="1"> <b>I read the warning – save anyway</b></label>':'')+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button id="ehgo" class="danger">Clock out</button></div></form>'+histHtml(t)+'</div>');
  calc();}
function calc(){var f=document.getElementById('eheditform'),c=document.getElementById('ehcalc');if(!f||!c)return;var a=f['in'].value,b=f.out.value,none=f.brk.value==='none';
  var er=spanErr(a,b);if(er){c.innerHTML='<span class="pill s-bad">'+E(er)+'</span>';return;}var p=paidOf(a,b,none),bf=+c.dataset.before,d=+c.dataset.day,nd=d-bf+p,df=p-bf;
  if(c.dataset.co){c.innerHTML='Shift: <b>'+E(span(a,b))+'</b> = <b>'+p.toFixed(2)+' h paid</b><br><span class="small">Farm total that day: '+d.toFixed(2)+' h → <b>'+nd.toFixed(2)+' h</b></span>';return;}
  c.innerHTML='New: <b>'+E(span(a,b))+'</b> = <b>'+p.toFixed(2)+' h paid</b> <span class="small">('+(df>=0?'+':'')+df.toFixed(2)+' h)</span><br><span class="small">Farm total that day: '+d.toFixed(2)+' h → <b>'+nd.toFixed(2)+' h</b></span>';}
function onCh(e){if(e.target&&e.target.closest&&e.target.closest('#eheditform'))calc();}
window.addEventListener('change',onCh,true);window.addEventListener('input',onCh,true);
function check(t,d){var E1=[];if(d.co&&quarterOk(d['in'])&&quarterOk(d.out)&&!spanErr(d['in'],d.out)&&hmMsLocal(t.date,d['in'])+hrs(d['in'],d.out)*3600000>Date.now()+60000)return ['The clock-out time cannot be in the future. Pick now or an earlier time.'];if(!quarterOk(d['in'])||!quarterOk(d.out))E1.push('Use quarter-hour times (:00, :15, :30, :45).');else if(spanErr(d['in'],d.out))E1.push(spanErr(d['in'],d.out));
  else{if(!officeAnyTime()&&hmMsLocal(t.date,d['in'])+hrs(d['in'],d.out)*3600000>Date.now())E1.push('The new finish would be in the future. Hours can only be set after they are worked.');
    if(!t.unassigned&&typeof overlapsAny==='function'&&overlapsAny(t.userId,t.date,d['in'],d.out,t.sched?null:t.id))E1.push(who(t)+' already has other hours that overlap '+t.date+' '+span(d['in'],d.out)+'.');}
  return E1;}
function scrub(s,site){s=String(s||'');(DB.users||[]).forEach(function(f){if(f.type!=='firm')return;[f.name,f.realName].forEach(function(n){n=String(n||'').trim();if(n.length>=4)s=s.split(n).join(site||'the farm');});});return s;}
FORMS.eheditok=function(f,d){if(!office())return;var co=!!d.co;var t=String(d.id).indexOf('key:')===0?sched(String(d.id).slice(4)):byId(d.id);var w=why(t,co);if(w){toast(co&&w==='closed'?'This shift is already clocked out.':'These hours cannot be changed here.');return;}
  var reason=String(d.why||'').trim();if(reason.length<3){toast('Please write a short reason.');var r=f.querySelector('#ehwhy');if(r)r.focus();return;}
  var none=d.brk==='none';if(!co&&d['in']===t['in']&&d.out===t.out&&none===!!t.breakMissed){toast('Nothing changed.');return;}
  var er=check(t,d);if(er.length){f.querySelector('#ehwarn').innerHTML='<div class="alert bad small">'+E(er[0])+'</div>';toast(er[0]);return;}
  var W=warnList(t);if(W.length&&!d.sure){toast('Please read the warning and tick the box.');var s=f.querySelector('.eh-sure');if(s)s.classList.add('eh-flash');return;}
  var site=siteOf(t),beforeP=paidT(t),dayB=dayTotal(site,t.date),old=co?'in '+t['in']+', not clocked out':span(t['in'],t.out)+(t.breakMissed?' no break':''),at=new Date().toISOString(),u=user(t.userId);
  if(t.sched){var n={id:uid('t'),userId:t.userId,shiftId:t.shiftId,site:site,date:t.date,'in':t['in'],out:t.out,key0:t.key,fromSchedule:true,clock:false,test:false,addedAt:at,role:typeof jobRoleOf==='function'&&u?jobRoleOf(u):''};if(u&&u.subId)n.subId=u.subId;DB.time.push(n);t=n;}
  if(!t.orig)t.orig={'in':t['in'],out:t.out||''};if(!('breakMissed' in t.orig))t.orig.breakMissed=!!t.breakMissed;
  t['in']=d['in'];t.out=d.out;t.breakMissed=none;var nw=span(t['in'],t.out)+(none?' no break':''),clean=scrub(reason,site);
  var inv=invFor(site,t.date),ex=u&&u.type==='employee'?exported(t.date):null;if(inv)t.editOnInvoice=inv.number;if(ex)t.editAfterExport=ex.start;
  t.officeEdited={at:at,by:ME.name,byId:ME.id};if(co){t.officeClockOut={at:at,by:ME.name,byId:ME.id,reason:clean};t.realOut=at;}(t.editHistory=t.editHistory||[]).push({at:at,by:ME.name,old:old,'new':nw,reason:clean});
  if(t.manual){(t.manualHistory=t.manualHistory||[]).push({at:at,by:ME.name,action:'changed',old:old,'new':nw,reason:clean});t.manualEditedAt=at;t.manualEditedBy=ME.name;}
  var afterP=paidT(t),dayA=dayTotal(site,t.date);
  audit(co?'Clocked out by office':'Edited hours (office)',who(t),site+' '+t.date+': '+old+' → '+nw+' · paid '+beforeP.toFixed(2)+' → '+afterP.toFixed(2)+' h · farm day '+dayB.toFixed(2)+' → '+dayA.toFixed(2)+' h · reason: '+reason+(inv?' · issued invoice '+inv.number+' not changed (revise if needed)':'')+(ex?' · pay period already exported':''));
  if(co){if(u&&!t.unassigned){notify(u.id,'The office clocked you out: '+site+' on '+t.date+', '+span(t['in'],t.out)+(none?' (no break)':'')+'. Reason: '+clean.replace(/[.!?]?$/,'.'));if(u.subId)notify(u.subId,'The office clocked out '+u.name+': '+site+' on '+t.date+', '+span(t['in'],t.out)+'.');}
    var fc=farmOf(site);if(fc)notify(fc.id,'The office entered a clock-out at '+site+' on '+t.date+' ('+span(t['in'],t.out)+') for a worker who forgot. Please check it – if it is wrong, use Ask to change hours within '+(typeof HC_DAYS==='number'?HC_DAYS:7)+' days.');
    save();closeModal();toast('Clocked out: '+span(t['in'],t.out)+' = '+afterP.toFixed(2)+' h paid. Farm total that day '+dayB.toFixed(2)+' → '+dayA.toFixed(2)+' h. The farm is asked to check it.');render();
    var bk=window.__ehCoBack;window.__ehCoBack=null;if(bk!=null&&window.clockedInList&&window.clockedInList.openSite)setTimeout(function(){window.clockedInList.openSite(bk);},0);return;}
  if(u&&!t.unassigned){notify(u.id,'The office changed your hours: '+site+' on '+t.date+', now '+span(t['in'],t.out)+(none?' (no break)':'')+'. Reason: '+clean.replace(/[.!?]?$/,'.'));if(u.subId)notify(u.subId,'Hours changed for '+u.name+': '+site+' on '+t.date+', now '+span(t['in'],t.out)+'.');}
  var fm=farmOf(site);if(fm)notify(fm.id,'Hours at '+site+' on '+t.date+' were corrected by the office. Your totals are updated.');
  save();closeModal();toast('Saved: '+span(t['in'],t.out)+' = '+afterP.toFixed(2)+' h paid. Farm total that day '+dayB.toFixed(2)+' → '+dayA.toFixed(2)+' h.'+(inv?' Invoice '+inv.number+' did not change – revise it if needed.':''));render();};
ADMIN_ONLY_ACT.push('ehedit');ADMIN_ONLY_FORM.push('eheditok');
/* "Edited" mark on the row (All hours) */
function mark(){[].forEach.call(document.querySelectorAll('#vshtable tr[data-key^="t:"]:not([data-eh])'),function(tr){tr.setAttribute('data-eh','1');var t=byId(tr.getAttribute('data-key').slice(2));if(!t||!t.officeEdited||!t.orig)return;
  var c=tr.querySelector('td.vs-t');if(c)c.insertAdjacentHTML('beforeend','<div class="small eh-was">was '+E(span(t.orig['in'],t.orig.out))+' · edited by '+E(t.officeEdited.by)+'</div>');});}
new MutationObserver(function(){try{mark();}catch(e){}}).observe(document.documentElement,{childList:true,subtree:true});
})();
