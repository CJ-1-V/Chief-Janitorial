/* v2-synccheck.js – synccheck1 (owner Oct 9 2026, 11:35 AM: "check that everything syncs perfectly when there are changes in hours").
   TEST COPY. New file only – loaded right after v2-voidsync.js and before v2-nohome.js (which stays LAST). Remove the 2 lines in
   index.html to undo everything. No existing file is edited.

   ONE rule for every screen (farm, subcontractor, worker / employee, crew lead, office overview, All hours, payroll, invoices):
   1. A shift counts when it is finished, not removed, and not a late / added shift that still waits for the office or was rejected.
      (Company employees: a late missed shift that waits for the office still counts for PAY, as before – "your pay is not affected".)
   2. Scheduled crew hours (a crew booking in the past where nobody clocked) count ONCE, on every screen, until somebody clocks /
      enters hours for that worker that day at that site, or the office removes them. Before this layer the farm and the subcontractor
      counted them but the worker, the subcontractor's dashboard card and the office overview did not.
   3. A clock / added entry that is NOT linked to the crew booking (no shiftId – e.g. a subcontractor-added shift, or old data like
      worker2 on Oct 6) but is the same worker, same day, same site, REPLACES the scheduled crew hours instead of adding to them
      (it was counted twice on the farm and subcontractor screens).
   4. Billable hours per worker-day (break once, 5-hour minimum, waivers) are worked out AFTER every row filter, so a removed /
      replaced row never leaves a wrong minimum top-up behind.
   Plus: invoice preview + confirm; issued-invoice snapshot with a two-way "hours changed since this invoice" check, farm note and an
   office credit note / extra invoice; office hours CSV + payroll CSV; neutral removal labels; "OK by office" / "Waiting for office"
   on shifts; no-work requests shown as waiting; one break text everywhere (rule unchanged: none up to 5 h, 30 min over 5 h,
   60 min at 8 h or more, none when the break was missed); the guided tour closes on a tap outside it; live re-read also on
   scrolled pages and on every return to the app. */
'use strict';
(function(){
if(typeof DB==='undefined'||typeof VIEWS==='undefined'||typeof ACT==='undefined'||typeof FORMS==='undefined')return;
var STORE_LIVE=!!(window.REG_STORE&&window.REG_STORE.mode==='supabase'),LIVE=STORE_LIVE||!!window.__SC_FRESH_TEST;
/* Remove vs "Ask office": "on an issued invoice" by the invoice LINES needs migration 016t on the server. Live keeps the 016s rule
   (the invoice's month) until 016t is applied and store-config sets invoiceLines: true – so the screen never offers a removal the
   server refuses. Test copy (mock): lines rule. */
var LINES=!STORE_LIVE||!!(window.REG_STORE&&window.REG_STORE.invoiceLines);
function lockInvs(t){var all=DB.clientInvoices||[];
  /* invowner1: non-owner office get no farm invoices – lock by the invoiced periods only (live reg_invoice_periods(): farm + dates, no number / $) */
  if(t&&typeof window.ivBlocked==='function'&&window.ivBlocked()&&!all.length&&typeof mtInvoiced==='function'){var p=mtInvoiced(siteOfT(t),t.date),f=firmOfSiteX(siteOfT(t));return p&&f?[{id:'',number:'',firmId:f.id,periodStart:p.periodStart,periodEnd:p.periodEnd,ivPeriod:true}]:[];}
  return LINES&&t?all.filter(function(v){return invHas(v,t);}):all;}
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s);}
/* Office Assistant (officehelper1, live since c7aa345): farm codes only, no $; invoices / credit notes stay with the full office */
function OH(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function fcode(f,site){var c=f&&f.firm&&f.firm.clientCode;if(!c&&f&&typeof firmCodes==='function')c=(firmCodes(f)||[])[0];return c||site||'?';}
function NOOH(){if(!OH())return false;try{toast('This needs the full office.');}catch(e){}return true;}
/* owner decision Oct 9 1:30 PM: farm invoices are visible ONLY to the owner (staff_roles 'owner') and to each farm's own login (DB side = 016v, test/invowner1).
   Live: officeRoles come from staff_roles; none = not the owner (fails closed). Mock: an office login with no role is the owner (old test logins). */
function OWNER(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||OH())return false;if(typeof window.ivOwner==='function')return !!window.ivOwner();  /* invowner1 loaded: one rule */
  var r=(ME.officeRoles&&ME.officeRoles.length)?ME.officeRoles:(ME.officeRole?[ME.officeRole]:[]);if(!r.length)return !STORE_LIVE;return r.indexOf('owner')>=0;}
function NOOWN(){if(OWNER())return false;try{toast(window.IV_MSG||'Farm invoices are visible to the owner only.');}catch(e){}return true;}
function R2(x){return Math.round((+x||0)*100)/100;}
function full(){return (window.vsAllTime?window.vsAllTime():DB.time)||[];}
function shOf(id){if(!id)return null;for(var i=0;i<(DB.shifts||[]).length;i++)if(DB.shifts[i].id===id)return DB.shifts[i];return null;}
function siteOfT(t){if(t.site)return t.site;var s=shOf(t.shiftId);return s?s.site:'';}
function isRm(t){return !!(t&&t.removed);}
function waiting(t){return t.lateEntry==='pending'||t.lateEntry==='rejected';}
function realUser(id){var u=user(id);return u&&u.type!=='tester'?u:null;}
function isCrew(s){return !!(s&&s.kind==='crew');}
/* a counted / open / removed entry that "takes the place" of a crew booking */
function replaces(t,sh,uid){if(!t||t.test||t._scV||t.userId!==uid)return false;if(!(isRm(t)||!waiting(t)))return false;
  if(t.shiftId===sh.id)return true;var ls=shOf(t.shiftId);if(t.shiftId&&ls&&isCrew(ls))return false;return t.date===sh.date&&siteOfT(t)===sh.site;}
function unlinkedFor(sh,uid,list){return list.filter(function(t){return t.userId===uid&&!t.test&&!t._scV&&t.shiftId!==sh.id&&(!t.shiftId||!isCrew(shOf(t.shiftId)))&&t.date===sh.date&&siteOfT(t)===sh.site;});}
function pastCrew(){var T=today();return (DB.shifts||[]).filter(function(s){return isCrew(s)&&!s.test&&s.date<=T;});}

/* ---------- 1. temporarily link unlinked entries to the crew booking (so the scheduled hours are not added on top) ---------- */
function linkUnlinked(){var L=full(),done=[];pastCrew().forEach(function(sh){(sh.booked||[]).forEach(function(uid){
    if(L.some(function(t){return t.userId===uid&&t.shiftId===sh.id&&!t.test&&!waiting(t);}))return;
    unlinkedFor(sh,uid,L).forEach(function(t){if(isRm(t)||waiting(t)||t._scLinked)return;t._scLinked={had:Object.prototype.hasOwnProperty.call(t,'shiftId'),v:t.shiftId};t.shiftId=sh.id;done.push(t);});});});
  return function(){done.forEach(function(t){var o=t._scLinked;if(o.had)t.shiftId=o.v;else delete t.shiftId;delete t._scLinked;});};}
/* removed unlinked entry: the crew booking stays removed too (same as a removed linked entry in voidsync) */
function rmUnlinkedKeys(){var L=full(),k={};pastCrew().forEach(function(sh){(sh.booked||[]).forEach(function(uid){if(unlinkedFor(sh,uid,L).some(isRm))k['c:'+sh.id+':'+uid]=1;});});return k;}
/* pending / rejected entries: hidden while the subcontractor rows are built, so the scheduled crew hours stand (same as the farm) */
function hideWaiting(){var h=[];(DB.time||[]).forEach(function(t){if(waiting(t)&&!t.test){t.test=true;t._scHide=1;h.push(t);}});return function(){h.forEach(function(t){t.test=false;delete t._scHide;});};}
/* billable allocation per worker-day, worked out on the FINAL rows (same maths as v2-clientbilling.js) */
function realloc(firm,rows){if(typeof billDay!=='function'||typeof CB!=='function')return rows;var c=CB(),g={};
  rows.forEach(function(r){var k=r.uid+'|'+r.date;(g[k]=g[k]||[]).push(r);});
  Object.keys(g).forEach(function(k){var l=g[k],sum=l.reduce(function(a,r){return a+r.hours;},0),missed=l.some(function(r){return r.breakMissed;}),w=typeof minWaiver==='function'&&!!minWaiver(firm.id,l[0].date),day=billDay(sum,missed,w);
    l.forEach(function(r){r.bill=r.hours;r.brkDed=0;r.minTopUp=0;r.waived=w;r.dayHours=sum;r.dayBill=day;r.dayShifts=l.length;});
    var ded=breakHoursFor(sum,missed,c.breakMin),left=ded;l.slice().sort(function(a,b){return b.hours-a.hours;}).forEach(function(r){if(left<=0)return;var t=Math.min(left,r.bill);r.brkDed=Math.round(t*10000)/10000;r.bill-=t;left-=t;});
    var top=day-(sum-ded);if(top>1e-9){var last=l[l.length-1];last.minTopUp=Math.round(top*10000)/10000;last.bill+=top;}});return rows;}
(function(){var o=window.firmRows;if(typeof o!=='function')return;window.firmRows=function(firm,from,to){var un=linkUnlinked(),rows;try{rows=o.apply(this,arguments);}finally{un();}
  var k=rmUnlinkedKeys();rows=rows.filter(function(r){return !k[r.key];});return realloc(firm,rows);};})();
(function(){var o=window.subRows;if(typeof o!=='function')return;window.subRows=function(sub,from,to){var un=linkUnlinked(),sh=hideWaiting(),rows;try{rows=o.apply(this,arguments);}finally{sh();un();}
  var k=rmUnlinkedKeys();return rows.filter(function(r){return !k[r.key];});};})();

/* ---------- 2. scheduled crew hours on the person / subcontractor dashboard / office screens (virtual rows, never saved) ---------- */
function virtualCrew(){var L=full(),V=[];pastCrew().forEach(function(sh){(sh.booked||[]).forEach(function(uid){var u=realUser(uid);if(!u)return;
    if(L.some(function(t){return replaces(t,sh,uid);}))return;
    V.push({id:'vc_'+sh.id+'_'+uid,userId:uid,site:sh.site,shiftId:sh.id,role:sh.role||'',date:sh.date,'in':sh.start,out:sh.end,clock:false,test:false,subId:u.subId||null,key0:'c:'+sh.id+':'+uid,note:'',_scV:true,schedCrew:true});});});return V;}
var INJ=0;
function withVirt(fn,self,args,siteFill){if(INJ>0||!Array.isArray(DB.time))return fn.apply(self,args);
  var V=virtualCrew(),filled=[],sv=window.save,asked=false;INJ++;
  if(siteFill)(DB.time||[]).forEach(function(t){if(!t.site&&t.shiftId){var s=shOf(t.shiftId);if(s){t.site=s.site;t._scSite=1;filled.push(t);}}});
  V.forEach(function(v){DB.time.push(v);});window.save=function(){asked=true;return true;};
  try{return fn.apply(self,args);}finally{INJ--;window.save=sv;var A=DB.time||[];for(var i=A.length-1;i>=0;i--)if(A[i]&&A[i]._scV)A.splice(i,1);filled.forEach(function(t){delete t.site;delete t._scSite;});if(asked)sv();}}
window.scWithVirt=withVirt;
(function(){var o=window.efItems;if(typeof o!=='function')return;window.efItems=function(u){var self=this,a=arguments;return withVirt(function(){return o.apply(self,a);},self,a);};})();
['worker:shifts','employee:shifts','worker:home','employee:home','sub:home','sub:workers','admin:home','admin:people'].forEach(function(k){var o=VIEWS[k];if(typeof o!=='function')return;VIEWS[k]=function(){return withVirt(o,this,arguments,k==='admin:home');};});
if(window.officeInfo&&typeof officeInfo.hoursBetween==='function'){var ohb=officeInfo.hoursBetween;officeInfo.hoursBetween=function(){return withVirt(ohb,this,arguments,true);};}
if(typeof window.eiStats==='function'){var oes=window.eiStats;window.eiStats=function(){return withVirt(oes,this,arguments);};}
/* My shifts total: a sub worker's shift that waits for the office is listed ("Waiting for office") but not counted yet – same as the
   farm and the subcontractor (company employees keep the existing rule: a late missed shift is paid while it waits) */
(function(){var o=window.efSum;if(typeof o!=='function')return;window.efSum=function(list){return o.call(this,(list||[]).filter(function(i){if(!(i&&i.k==='t'&&i.t&&i.t.lateEntry==='pending'))return true;var u=user(i.t.userId);return !!(u&&u.type==='employee');}));};})();
/* virtual rows: labelled, no remove button (the office removes scheduled crew hours on All hours) */
(function(){var o=window.efRow;if(typeof o!=='function')return;window.efRow=function(i){
  if(i&&i.k==='t'&&i.t&&i.t._scV){var x=o.apply(this,arguments);x=x.replace(/<button[^>]*data-act="vsself"[^>]*>[^<]*<\/button>/g,'');var at=x.lastIndexOf('</div><div class="ef-h">');
    x=x.replace('<small>hrs</small></div></div>','<small>paid hrs</small></div></div>');at=x.lastIndexOf('</div><div class="ef-h">');
    return at<0?x:x.slice(0,at)+'<div class="ef-l2"><span class="pill s-mut sc-sched">Crew shift – from the schedule (nobody clocked)</span></div>'+x.slice(at);}
  if(!(i&&i.k==='t'&&i.t))return o.apply(this,arguments);var t=i.t,keep=DB.clientInvoices,x2;
  /* issued invoice = only the invoices this shift is really on (not just the period) */
  DB.clientInvoices=lockInvs(t);try{x2=o.apply(this,arguments);}finally{DB.clientInvoices=keep;}
  x2=x2.replace('<small>hrs</small></div></div>','<small>paid hrs</small></div></div>');
  var lab=statusOf(t);if(!lab)return x2;var at2=x2.lastIndexOf('</div><div class="ef-h">');return at2<0?x2:x2.slice(0,at2)+'<div class="ef-l2 sc-st">'+lab+'</div>'+x2.slice(at2);};})();
function statusOf(t){if(isRm(t)||!t.out)return '';if(t.lateEntry==='pending')return '<span class="pill s-pend">Waiting for office</span>';if(t.lateEntry==='rejected')return '';
  if(t.manual||t.officeEntry||t.lateEntry==='approved'||t.orig||t.lateBilledInv||onInvoice(t)||(t.userId&&user(t.userId)&&user(t.userId).type==='employee'&&exported(t.date)))return '<span class="pill s-ok">OK by office</span>';
  return '<span class="small muted">Not checked by the office yet</span>';}
function exported(d){return (DB.payExports||[]).some(function(x){return x.start<=d&&d<=x.end;});}

/* ---------- 3. issued invoices: snapshot of the counted rows, two-way change check, farm note, credit note / extra invoice ---------- */
function firmOfSiteX(site){return typeof firmOfSite==='function'?firmOfSite(site):null;}
/* snapshot keys never carry a person id (farms can read their invoices): clocked rows 't:<entry id>', scheduled crew 'c:<shift id>' */
function nk(key){key=String(key||'');if(key.indexOf('c:')===0)return 'c:'+key.split(':')[1];return key;}
function snapRows(firm,from,to){var R=firmReport(firm,from,to),m={};(R.shiftRows||firmRows(firm,from,to)).forEach(function(r){var k=nk(r.key),x=m[k]=m[k]||{k:k,d:r.date,s:r.site,n:0,h:0,bl:0};x.n++;x.h=R2(x.h+r.hours);x.bl=R2(x.bl+r.bill);});return Object.keys(m).sort().map(function(k){return m[k];});}
function invHas(inv,t){if(!inv||!t||inv.adjOf)return false;  /* credit notes / extra invoices never lock a shift (same as 016t) */var f=firmOfSiteX(siteOfT(t));if(!f||f.id!==inv.firmId)return false;if(!(inv.periodStart&&inv.periodStart<=t.date&&t.date<=(inv.periodEnd||inv.periodStart)))return false;
  if(inv.lines&&inv.lines.length!==undefined){var k1='t:'+t.id,k2=t.key0?nk(t.key0):'';return inv.lines.some(function(l){return l.k===k1||(k2&&l.k===k2);});}
  /* older invoice (no snapshot): only entries that existed AND counted when it was issued */
  if(t.subAdded&&t.lateEntry!=='approved')return false;if(t.lateEntry==='pending'||t.lateEntry==='rejected')return false;
  if(t.lateApprovedAt&&inv.issued&&t.lateApprovedAt>inv.issued)return false;var made=String(t.addedAt||t.realIn||t.manualAt||'').slice(0,10);if(made&&inv.issued&&made>inv.issued)return false;return true;}
function onInvoice(t){return (DB.clientInvoices||[]).some(function(v){return !v.adjOf&&invHas(v,t);});}
window.scInvHas=invHas;
function adjOf(inv){return (DB.clientInvoices||[]).filter(function(x){return x.adjOf===inv.id;});}
function invDiff(inv){if(!inv||inv.adjOf||inv.sample||!inv.periodStart||!inv.periodEnd)return null;var firm=user(inv.firmId);if(!firm)return null;
  var R=firmReport(firm,inv.periodStart,inv.periodEnd),billed=R2((inv.amount||0)+adjOf(inv).reduce(function(a,x){return a+(x.amount||0);},0)),now=R2(R.tot.amount);
  var lines=[];if(inv.lines){var cur={};snapRows(firm,inv.periodStart,inv.periodEnd).forEach(function(r){cur[r.k]=r;});var old={};inv.lines.forEach(function(l){old[l.k]=l;});
    Object.keys(old).forEach(function(k){var a=old[k],b=cur[k];if(!b)lines.push({k:k,d:a.d,s:a.s,what:'removed',was:a.bl,now:0});else if(Math.abs(a.bl-b.bl)>0.004||a.n!==b.n)lines.push({k:k,d:a.d,s:a.s,what:'changed',was:a.bl,now:b.bl});});
    Object.keys(cur).forEach(function(k){if(!old[k])lines.push({k:k,d:cur[k].d,s:cur[k].s,what:'added',was:0,now:cur[k].bl});});}
  else{/* old invoice without snapshot: removed rows that really were on it */
    full().forEach(function(t){if(isRm(t)&&invHas(inv,t))lines.push({k:'t:'+t.id,d:t.date,s:siteOfT(t),what:'removed',was:null,now:0});});
    if(!lines.length)return null;}
  var sig=JSON.stringify([now,lines.map(function(l){return l.k+l.what+l.now;}).sort()]);
  if(!lines.length)return null;  /* the invoice matches the counted hours again (e.g. after a restore, a credit note or an extra invoice) */
  if(inv.scReviewed===sig)return null;return {inv:inv,firm:firm,billed:billed,now:now,diff:R2(now-billed),lines:lines,sig:sig};}
function invFlagsX(){return (DB.clientInvoices||[]).map(invDiff).filter(Boolean);}
window.scInvFlags=invFlagsX;
(function(){var of=FORMS.clientinv;if(typeof of!=='function')return;FORMS.clientinv=function(f,d){d=d||{};var firm=user(d.firmId);
  if(NOOWN())return;
  if(firm&&/^\d{4}-\d{2}$/.test(d.month||'')&&!d.confirmed){var from=d.month+'-01',to=addDays(isoLocal(new Date(+d.month.slice(0,4),+d.month.slice(5,7),1)),-1);var R=firmReport(firm,from,to);
    if(!(R.tot.amount>0)||clientInvs(firm).some(function(i){return i.periodStart===from&&!i.adjOf;}))return of(f,d);
    var days=R.rows.filter(function(r){return r.n;});
    modal('<h2>Check this invoice before you create it</h2><p><b>'+E(firm.name)+'</b> · '+E(from)+' to '+E(to)+'</p><div class="tw"><table class="no-stack" id="scinvprev"><tr><th>Day</th><th style="text-align:right">Workers</th><th style="text-align:right">Hours worked</th><th style="text-align:right">Billable hours</th><th style="text-align:right">Amount</th></tr>'+
      days.map(function(r){return '<tr><td>'+E(shortDay(r.date))+'</td><td style="text-align:right">'+r.n+'</td><td style="text-align:right">'+r.hours.toFixed(2)+'</td><td style="text-align:right">'+r.bill.toFixed(2)+'</td><td style="text-align:right">'+money(r.amount)+'</td></tr>';}).join('')+
      '<tr><th>Total</th><th></th><th style="text-align:right">'+R.tot.hours.toFixed(2)+'</th><th style="text-align:right">'+R.tot.bill.toFixed(2)+'</th><th style="text-align:right">'+money(R.tot.amount)+'</th></tr></table></div>'+
      '<p>HST: <b>'+money(R.tot.hst)+'</b> · Total: <b id="scinvtot">'+money(R.tot.total)+'</b></p><p class="small muted">Once created, the invoice does not change. If hours change later, you will see “Hours changed since this invoice” and can make a credit note or an extra invoice.</p>'+
      '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button type="button" id="scinvgo" data-act="scinvgo" data-f="'+E(firm.id)+'" data-m="'+E(d.month)+'">Create invoice</button></div>');return;}
  var n=(DB.clientInvoices||[]).length,r=of(f,d),l=DB.clientInvoices||[];
  if(l.length>n){var inv=l[l.length-1];var fm=user(inv.firmId);if(fm&&inv.periodStart&&inv.periodEnd&&!inv.adjOf){inv.lines=snapRows(fm,inv.periodStart,inv.periodEnd);save();}}return r;};})();
ACT.scinvgo=function(el){if(NOOWN())return;closeModal();FORMS.clientinv(null,{firmId:el.dataset.f,month:el.dataset.m,confirmed:'1'});};
ACT.scinvadj=function(el){if(NOOWN())return;var x=invFlagsX().filter(function(z){return z.inv.id===el.dataset.id;})[0];if(!x)return;var cr=x.diff<0;
  modal('<h2>'+(cr?'Make a credit note':'Make an extra invoice')+'</h2><p>Invoice <b>'+E(x.inv.number)+'</b> ('+E(x.inv.periodStart)+' to '+E(x.inv.periodEnd)+') was for <b>'+money(x.billed)+'</b>. The hours for that period now come to <b>'+money(x.now)+'</b>.</p>'+
    '<p>'+(cr?'Credit':'Extra')+': <b>'+money(Math.abs(x.diff))+'</b> + HST.</p><ul class="small">'+x.lines.map(function(l){return '<li>'+E(l.s+' '+l.d)+': '+(l.what==='removed'?'hours removed':l.what==='added'?'hours added':'hours changed')+(l.was!=null?' ('+(+l.was).toFixed(2)+' → '+(+l.now).toFixed(2)+' billable h)':'')+'</li>';}).join('')+'</ul>'+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button type="button" id="scadjgo" data-act="scadjgo" data-id="'+E(x.inv.id)+'">'+(cr?'Create credit note':'Create extra invoice')+'</button></div>');};
ACT.scadjgo=function(el){if(NOOWN())return;var x=invFlagsX().filter(function(z){return z.inv.id===el.dataset.id;})[0];if(!x)return;var cr=x.diff<0,c=CB(),k=adjOf(x.inv).length+1,amt=R2(x.diff),hst=x.inv.hst?R2(Math.round(amt*15)/100):0;
  var a={id:uid('ci'),firmId:x.inv.firmId,number:x.inv.number+(cr?'-CR':'-X')+k,periodStart:x.inv.periodStart,periodEnd:x.inv.periodEnd,billHours:0,amount:amt,hst:hst,total:R2(amt+hst),issued:today(),due:addDays(today(),c.netDays),interestPct:cr?0:c.interestPct,paidAt:cr?today():'',adjOf:x.inv.id,kind:cr?'credit':'extra',adjLines:x.lines};
  (DB.clientInvoices=DB.clientInvoices||[]).push(a);x.inv.lines=snapRows(x.firm,x.inv.periodStart,x.inv.periodEnd);x.inv.linesAdjustedAt=new Date().toISOString();
  audit(cr?'Created credit note':'Created extra invoice',x.firm.name,a.number+' '+money(a.total)+' for '+x.inv.number);notify(x.inv.firmId,(cr?'Credit note ':'Extra invoice ')+a.number+' for invoice '+x.inv.number+': '+money(a.total)+'.');save();closeModal();toast((cr?'Credit note ':'Extra invoice ')+a.number+' created.');render();};
ACT.scinvok=function(el){if(NOOWN())return;var x=invFlagsX().filter(function(z){return z.inv.id===el.dataset.id;})[0];if(!x)return;x.inv.scReviewed=x.sig;x.inv.scReviewedBy=ME.name;x.inv.scReviewedAt=new Date().toISOString();audit('Checked changed hours on invoice – no new invoice',x.inv.number,money(x.diff));save();toast('Saved.');render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('scinvadj','scadjgo','scinvok','scinvgo');
function flagHtml(){if(!OWNER())return '';var F=invFlagsX();if(!F.length)return '';return '<div class="alert warn small" id="scinvflags"><b>Hours changed since these invoices were issued – please check:</b><ul>'+F.map(function(x){
  return '<li class="sc-invflag" data-inv="'+E(x.inv.number)+'">'+E(x.inv.number)+' ('+E(x.inv.periodStart+' to '+x.inv.periodEnd)+'): invoiced '+money(x.billed)+', hours now '+money(x.now)+' ('+(x.diff<0?'−':'+')+money(Math.abs(x.diff))+'). '+
    '<button class="small" data-act="scinvadj" data-id="'+E(x.inv.id)+'">'+(x.diff<0?'Make credit note':x.diff>0?'Make extra invoice':'Details')+'</button> <button class="small sec" data-act="scinvok" data-id="'+E(x.inv.id)+'">No new invoice needed</button></li>';}).join('')+'</ul></div>';}
(function(){var o=window.clientInvoicesHtml;if(typeof o!=='function')return;window.clientInvoicesHtml=function(firm,office){var x=o.apply(this,arguments);try{
  x=x.replace(/<tr class="vs-invflag">[\s\S]*?<\/tr>/g,'');var F={};invFlagsX().forEach(function(z){F[z.inv.number]=z;});
  (DB.clientInvoices||[]).forEach(function(i){var z=F[i.number],tag='';if(i.adjOf){var p=(DB.clientInvoices||[]).filter(function(y){return y.id===i.adjOf;})[0];tag=' <span class="small muted">'+(i.kind==='credit'?'Credit note':'Extra invoice')+' for '+E(p?p.number:'')+'</span>';}
    if(z&&!(office&&!OWNER()))tag+=office?' <span class="pill s-warn sc-invflag">Hours changed – check</span>':' <div class="small sc-farmnote">Hours changed after this invoice. The office will send a corrected invoice or a credit.</div>';
    if(tag){var k=x.indexOf('>'+E(i.number)+'<');if(k>=0){var e=x.indexOf('</td>',k);if(e>=0)x=x.slice(0,e)+tag+x.slice(e);}}});
  if(office)x=x.replace('<div class="card" id="clientinvoices">','<div class="card" id="clientinvoices">'+flagHtml());}catch(e){}return x;};})();
(function(){var o=window.adminFlags;if(typeof o!=='function')return;window.adminFlags=function(){var f=o.apply(this,arguments);try{f=f.filter(function(x){return !/includes removed hours/.test(x.h||'')&&!/includes removed hours/.test(x.c||'');});
  if(OWNER())invFlagsX().forEach(function(x){f.unshift({t:'Invoice to check',c:'s-warn',h:'Hours changed since invoice '+E(x.inv.number)+' ('+(x.diff<0?'−':'+')+money(Math.abs(x.diff))+'). <a href="#/firms">Open →</a>'});});}catch(e){}return f;};})();

/* ---------- 4. office All hours: one total, labels, flags ---------- */
function remover(t){if(!isRm(t))return '';if(t.removedSrc==='office'||t.removedSrc==='request'&&false)return 'office';if(t.removedSrc==='request')return 'request';
  var by=t.removedById?user(t.removedById):null;if(by&&by.type==='sub'&&by.id!==t.userId)return 'sub';if(by&&by.type==='admin')return 'office';return 'person';}
(function(){var o=VIEWS['admin:allhours'];if(typeof o!=='function')return;VIEWS['admin:allhours']=function(){var x=o.apply(this,arguments);try{
  var s=PAGE_STATE.vsh||{},to=s.to||today(),from=s.from||addDays(to,-13);
  /* the counting total follows the one rule (scheduled crew once; unlinked entry replaces it; worker / sub entries waiting for the office not counted) */
  var tot=0,V=virtualCrew();full().concat(V).forEach(function(t){if(t.test||!t.out||isRm(t)||t.date<from||t.date>to)return;var u=realUser(t.userId);if(!u)return;
    if(t.lateEntry==='rejected')return;if(t.lateEntry==='pending'&&u.type!=='employee')return;var w=hrs(t['in'],t.out);tot+=w-unpaidBreak(w,t);});
  x=x.replace(/(id="vshtot">)[^<]*/,'$1'+tot.toFixed(2));
  x=x.replace(/<div class="alert warn small" id="vsinvflags">[\s\S]*?<\/ul><\/div>/,'');var fh=flagHtml();if(fh)x=x.replace('<h1>All hours</h1>','<h1>All hours</h1>'+fh);
  /* removed-by labels per row */
  full().forEach(function(t){if(!isRm(t))return;var r=remover(t);var lab=r==='sub'?' (by subcontractor)':r==='person'?' (by worker)':r==='request'?' (request approved)':'';
    var i=x.indexOf('data-id="'+E(t.id)+'"');if(i<0)return;var a=x.lastIndexOf('<tr',i),b=x.indexOf('</tr>',i);if(a<0||b<0)return;var seg=x.slice(a,b);
    var seg2=seg.replace(' (by the person)',lab);x=x.slice(0,a)+seg2+x.slice(b);});
  /* scheduled crew rows whose only entry waits for the office: they still count (once) – show them */
  }catch(e){}return x;};})();

/* ---------- 5. neutral removal labels (farm, worker, subcontractor) and worked / paid labels ---------- */
(function(){var o=window.firmShiftTable;if(typeof o!=='function')return;window.firmShiftTable=function(){var x=o.apply(this,arguments),k=x.indexOf('<div class="vs-farmrm"');if(k<0)return x;
  var y=x.slice(k).replace('Removed by the office <span class="small muted">– not counted in the totals above, never billed</span>','Removed hours <span class="small muted">– not counted in the totals above, not billed</span>')
    .split('>Removed – entered by mistake<').join('>Removed – not counted<').split('>Removed by office<').join('>Removed – not counted<').replace('<th>Hours</th><th>Status</th>','<th>Hours worked</th><th>Status</th>');return x.slice(0,k)+y;};})();
function relabelRemoved(x,forSub){return x.replace(/<div class="ef-row vs-rmrow" data-id="([^"]+)">([\s\S]*?)<\/div><\/div><div class="ef-h">/g,function(m,id,body){var t=full().filter(function(z){return z.id===id;})[0];if(!t)return m;var r=remover(t);
    if(r==='sub'&&!forSub)body=body.replace('You removed this shift','Removed by your crew company');return '<div class="ef-row vs-rmrow" data-id="'+id+'">'+body+'</div></div><div class="ef-h">';}).replace(/(id="vsRemoved"[\s\S]*?)<small>hrs<\/small>/g,function(m){return m;});}
(function(){var o=window.efBody;if(typeof o!=='function')return;window.efBody=function(){var x=o.apply(this,arguments);try{x=relabelRemoved(x,false).replace(/(<section class="ef-sec vs-sec" id="vsRemoved">[\s\S]*?)<\/section>/,function(m){return m.split('<small>hrs</small>').join('<small>paid hrs</small>');});}catch(e){}return x;};})();
(function(){var o=VIEWS['sub:workerhours'];if(typeof o!=='function')return;VIEWS['sub:workerhours']=function(){var x=o.apply(this,arguments);try{
  x=x.replace('<th>Day</th><th>Site</th><th>Worker</th><th>Start – finish</th><th>Hours</th><th>Status</th>','<th>Day</th><th>Site</th><th>Worker</th><th>Start – finish</th><th>Hours worked</th><th>Status</th>');
  x=x.replace('<th>Worker</th><th>Site</th><th>Day</th><th>Time</th><th>Hours</th><th></th>','<th>Worker</th><th>Site</th><th>Day</th><th>Time</th><th>Paid hours</th><th></th>').replace('<th>Worker</th><th>Site</th><th>Day</th><th>Time</th><th>Hours</th><th>Status</th>','<th>Worker</th><th>Site</th><th>Day</th><th>Time</th><th>Paid hours</th><th>Status</th>');
  /* shifts the subcontractor added that still wait for the office: listed, not counted */
  var st=PAGE_STATE.wh||{},to=st.to||today(),from=st.from||addDays(to,-29),W=full().filter(function(t){if(t.test||isRm(t)||t.lateEntry!=='pending'||t.date<from||t.date>to)return false;var w=user(t.userId);return w&&(w.id===ME.id||w.subId===ME.id);});
  if(W.length){var h='<h2>Waiting for office <span class="small muted">– not counted yet</span></h2><div class="tw"><table id="scwait"><tr><th>Day</th><th>Site</th><th>Worker</th><th>Start – finish</th><th>Hours worked</th><th>Status</th></tr>'+W.map(function(t){var w=user(t.userId);return '<tr><td>'+E(shortDay(t.date))+'</td><td>'+E(siteOfT(t))+'</td><td>'+E(w?w.name:'')+'</td><td>'+E(t['in']+' – '+t.out)+'</td><td>'+hrs(t['in'],t.out).toFixed(2)+'</td><td><span class="pill s-pend">Waiting for office</span></td></tr>';}).join('')+'</table></div>';
    var k=x.indexOf('<div class="card vs-sec" id="vsSubRemoved">');if(k<0)k=x.indexOf('<div class="card" id="vssubcard">');x=k<0?x+h:x.slice(0,k)+h+x.slice(k);}
  }catch(e){}return x;};})();
/* subcontractor / worker removal: the same "issued invoice = really on it" check as everywhere */
['vsself'].forEach(function(k){var o=ACT[k];if(typeof o!=='function')return;ACT[k]=function(el){var t=full().filter(function(z){return z.id===(el&&el.dataset&&el.dataset.id);})[0],keep=DB.clientInvoices;if(t)DB.clientInvoices=lockInvs(t);try{return o.apply(this,arguments);}finally{DB.clientInvoices=keep;}};});
(function(){var o=FORMS.vsremove;if(typeof o!=='function')return;FORMS.vsremove=function(f,d){var t=full().filter(function(z){return z.id===(d&&d.id);})[0],keep=DB.clientInvoices;if(t&&d.mode!=='office')DB.clientInvoices=lockInvs(t);try{return o.apply(this,arguments);}finally{DB.clientInvoices=keep;}};})();
(function(){var o=VIEWS['sub:workerhours'];if(typeof o!=='function'||!LINES)return;VIEWS['sub:workerhours']=function(){var keep=DB.clientInvoices,self=this,a=arguments;
  /* rows in the "Remove a shift" card: the invoice check per row happens inside lockReasons → filter by lines for the whole card */
  var ids={};full().forEach(function(t){if((keep||[]).some(function(v){return invHas(v,t);}))ids[t.id]=1;});var x;
  DB.clientInvoices=[];
  try{x=o.apply(self,a);}finally{DB.clientInvoices=keep;}
  /* rows really on an issued invoice still need the office (same rule as My shifts) */
  x=x.replace(/<tr data-id="([^"]+)">([\s\S]*?)<\/tr>/g,function(m,id,body){if(!ids[id])return m;return '<tr data-id="'+id+'">'+body.replace(/class="small danger" data-act="vsself" data-id="([^"]+)">Remove</,'class="small sec" data-act="vsself" data-id="$1">Ask office to remove<')+'</tr>';});return x;};})();

/* ---------- 6. farm: a "no work this day" request makes that day's rows wait ---------- */
function nwPending(site,date){return (DB.changes||[]).filter(function(c){return c.kind==='nowork'&&c.status==='Pending'&&c.site===site&&c.date===date;})[0]||null;}
if(typeof window.hcState==='function'){var ohs=window.hcState;window.hcState=function(r){if(r&&nwPending(r.site,r.date))return 'pending';return ohs.apply(this,arguments);};}
if(typeof window.latestChange==='function'){var olc=window.latestChange;window.latestChange=function(key){var c=olc.apply(this,arguments);if(c&&c.status==='Pending')return c;var r=(PAGE_STATE.frRows||{})[key];var n=r&&nwPending(r.site,r.date);return n||c;};}
if(typeof window.changeStatusHtml==='function'){var ocs=window.changeStatusHtml;window.changeStatusHtml=function(c){if(c&&c.kind==='nowork'&&c.status==='Pending')return '<div class="hc-st"><span class="pill s-pend">Waiting for office</span><div class="small">You asked: no work this day</div></div>';return ocs.apply(this,arguments);};}
(function(){var o=ACT.vsnowork;if(typeof o!=='function')return;ACT.vsnowork=function(el){var r=o.apply(this,arguments);try{var site=el.dataset.site,date=el.dataset.date,rows=Object.keys(PAGE_STATE.frRows||{}).map(function(k){return PAGE_STATE.frRows[k];}).filter(function(x){return x.site===site&&x.date===date;}),
  b=rows.reduce(function(a,x){return a+(x.bill||0);},0),p=document.querySelector('#modal p');
  if(p)p.innerHTML='You are asking the office to <b>cancel '+(rows.length===1?'the 1 shift':'all '+rows.length+' shifts')+'</b> at this site that day ('+b.toFixed(2)+' billable hours on your bill now).';}catch(e){}return r;};})();

/* ---------- 7. office exports: hours CSV (All hours) + payroll CSV ---------- */
function csvR(a){return typeof csvRow==='function'?csvRow(a):a.map(function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',');}
function hoursRows(from,to,farmId,personId){var V=virtualCrew(),out=[];full().concat(V).forEach(function(t){if(t.test||t.date<from||t.date>to)return;var u=realUser(t.userId);if(!u)return;if(personId&&u.id!==personId)return;var site=siteOfT(t),f=firmOfSiteX(site);if(farmId&&(!f||f.id!==farmId))return;
    var w=t.out?hrs(t['in'],t.out):0,br=t.out?unpaidBreak(w,t):0,st=isRm(t)?'Removed':t.lateEntry==='rejected'?'Not approved':t.lateEntry==='pending'?'Waiting for office':!t.out?'On shift':'Counts';
    out.push([t.date,u.name,u.type==='employee'?'UnScramble employee':(typeof employerName==='function'?employerName(u):''),site,f?(OH()?'Farm '+fcode(f,site):f.name):'',t['in']||'',t.out||'',w.toFixed(2),br.toFixed(2),(w-br).toFixed(2),st,t._scV?'Scheduled crew (nobody clocked)':t.manual?'Manual':t.subAdded?'Added by subcontractor':t.missed?'Added later':t.crewClock?'Crew lead':'Clocked']);});
  return out.sort(function(a,b){return a[0]<b[0]?-1:a[0]>b[0]?1:a[1]<b[1]?-1:1;});}
window.scHoursRows=hoursRows;
ACT.schourscsv=function(){var s=PAGE_STATE.vsh||{},to=s.to||today(),from=s.from||addDays(to,-13),c=PAGE_STATE.scx||{};var rows=hoursRows(from,to,c.farm||'',c.person||'').filter(function(r){return c.removed||r[10]!=='Removed';});
  downloadText('hours-'+from+'-to-'+to+'.csv',[['Date','Person','Employer','Site','Farm / client','Start','Finish','Hours worked','Break','Paid hours','Status','Type']].concat(rows).map(csvR).join('\n'),'text/csv');audit('Downloaded hours CSV','',from+' to '+to+' ('+rows.length+' rows)');save();};
FORMS.scxf=function(f,d){PAGE_STATE.scx={farm:d.farm||'',person:d.person||'',removed:!!d.removed};render();};
ACT.scpaycsv=function(){var cur=payPeriodOf(PAGE_STATE.payDate||today()),R=payrollRows(cur.start,cur.end),L=[[OH()?'Period start':'Pay period start',OH()?'Period end':'Pay period end','Employee','Shifts','Paid hours']]  /* the assistant's masked download blanks any column whose name has "pay" in it */;R.forEach(function(r){L.push([cur.start,cur.end,r.u.name,r.n,r.hours.toFixed(2)]);});
  L.push([]);L.push(['Date','Employee','Site','Start','Finish','Hours worked','Break','Paid hours','Status']);R.forEach(function(r){r.entries.forEach(function(t){var w=hrs(t['in'],t.out),br=unpaidBreak(w,t);L.push([t.date,r.u.name,siteOfT(t),t['in'],t.out,w.toFixed(2),br.toFixed(2),(w-br).toFixed(2),t.lateEntry==='pending'?'Late entry – waiting for office (paid)':'Counts']);});});
  downloadText('payroll-hours-'+cur.start+'-to-'+cur.end+'.csv',L.map(csvR).join('\n'),'text/csv');if(PAGE_STATE.mtPreview||OH())return;
  (DB.payExports=DB.payExports||[]).push({start:cur.start,end:cur.end,at:new Date().toISOString(),by:ME.name});(window.vsAllTime?vsAllTime():DB.time).forEach(function(t){if(t.afterExport===cur.start)delete t.afterExport;});audit('Downloaded payroll hours CSV','',cur.start+' to '+cur.end);save();render();};
/* the old "Download payroll hours" action never existed in this build (v2-manualtime.js wraps an empty ACT.paycsv) – it is this one now */
ACT.paycsv=function(){return ACT.scpaycsv.apply(this,arguments);};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('schourscsv','scpaycsv');if(typeof ADMIN_ONLY_FORM!=='undefined')ADMIN_ONLY_FORM.push('scxf');
(function(){var o=VIEWS['admin:allhours'];if(typeof o!=='function')return;VIEWS['admin:allhours']=function(){var x=o.apply(this,arguments),c=PAGE_STATE.scx||{};try{
  var farms=users('firm').filter(function(f){return firmCodes(f).length;}),people=(DB.users||[]).filter(function(u){return u.type==='employee'||u.type==='worker'||u.type==='sub';}).sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
  var box='<form data-form="scxf" class="row card" id="scexport"><b>Download hours (CSV)</b><div><label>Farm / client</label><select name="farm"><option value="">All</option>'+farms.map(function(f){return '<option value="'+E(f.id)+'"'+(c.farm===f.id?' selected':'')+'>'+E(OH()?'Farm '+fcode(f):f.name)+'</option>';}).join('')+'</select></div>'+
    '<div><label>Person</label><select name="person"><option value="">All</option>'+people.map(function(u){return '<option value="'+E(u.id)+'"'+(c.person===u.id?' selected':'')+'>'+E(u.name)+'</option>';}).join('')+'</select></div><label class="inline"><input type="checkbox" name="removed" value="1"'+(c.removed?' checked':'')+'> <span>Include removed rows</span></label>'+
    '<div style="align-self:flex-end"><button class="small sec">Use these filters</button> <button type="button" class="small" data-act="schourscsv" id="schourscsv">Download CSV</button></div><p class="small muted" style="flex-basis:100%;margin:0">Uses the From / To dates above. Every row has its status (Counts, Waiting for office, Not approved, Removed).</p></form>';
  var k=x.indexOf('<div class="row mt-filters">');x=k<0?x+box:x.slice(0,k)+box+x.slice(k);}catch(e){}return x;};})();
(function(){var o=VIEWS['admin:payroll'];if(typeof o!=='function')return;VIEWS['admin:payroll']=function(){var x=o.apply(this,arguments);if(x.indexOf('scpaycsv')>=0)return x;
  var b='<div class="row" id="scpaybox"><button class="small" data-act="scpaycsv" id="scpaycsv">Download payroll hours (CSV)</button><span class="small muted">'+(OH()?'One line per employee + every shift (hours only). The full office sends payroll.':'One line per employee + every shift. Use it to enter the hours in Wagepoint. Downloading marks this pay period as sent to payroll.')+'</span></div>';
  var k=x.indexOf('<div class="tw"><table id="paytable">');return k<0?x+b:x.slice(0,k)+b+x.slice(k);};})();

/* ---------- 8. words: one break rule text everywhere + plain words (text only – the maths is unchanged) ---------- */
function brkTxt(){return typeof breakRuleText==='function'?breakRuleText():'30 min unpaid break over 5 h, 60 min at 8 h or more';}
var WORDS=[
  [/Billable hours = hours worked minus a 30-minute unpaid break on shifts of 5 hours or more[^.]*\./g,function(){return 'Billable hours = hours worked minus the unpaid break (none up to 5 h, 30 min over 5 h, 60 min at 8 h or more; none if the break was missed).';}],
  [/the 30-minute break is deducted only if it was taken/g,function(){return 'the unpaid break (30 min over 5 h, 60 min at 8 h or more) is taken off only if it was taken';}],
  [/Everyone took their 30-minute break/g,function(){return 'Everyone took their break';}],
  [/I took my 30-minute break/g,function(){return 'I took my break (30 min over 5 h, 60 min at 8 h or more)';}],
  [/whether the 30-minute break was taken/g,function(){return 'whether the break was taken ('+brkTxt()+')';}],
  [/unpaid break on shifts of 5 h or more/g,function(){return 'unpaid break ('+brkTxt()+')';}],
  [/Tick this if your break was missed or cut short\. You will be paid for it, and the office is told\./g,function(){return 'You will be paid for the break. The office is told.';}],
  [/Tick this if your break was missed or cut short\. The office is told\./g,function(){return 'You will be paid for the break. The office is told.';}],
  [/^I did not get my break(\. \(You will be paid for it\.\))?$/g,function(){return 'I did not get my full break';}],
  [/Paid hours \(worked minus the unpaid break\) from your clocked and office-approved shifts – the same hours as your shifts below\./g,function(){return 'My hours after the unpaid break. Same as the list below.';}],
  [/Paid hours \(worked minus the unpaid break\) from your workers' clocked and office-approved shifts\./g,function(){return 'Your workers\' hours after the unpaid break.';}],
  [/checked by the office before they are billed to the client \(your pay is not affected\)/g,function(){return 'checked by the office first (you are still paid)';}],
  [/^Started earlier\?$/g,function(){return 'I started before this time';}],[/^\(reason needed\)$/g,function(){return '(tell us why)';}],
  [/Break missed or interrupted/g,function(){return 'Break missed';}],[/No break taken \(nothing deducted\)/g,function(){return 'No break taken (no break taken off)';}],
  [/Contracted crew hours follow the scheduled shift times\./g,function(){return 'If nobody clocked a crew, the planned crew times are used.';}],
  [/^Scheduled crew \(nobody clocked\)$/g,function(){return 'Planned crew times (nobody clocked)';}],
  [/people-days/g,function(){return 'people × days';}],[/Worker-days/g,function(){return 'Worker × days';}],[/\(worker-days\)/g,function(){return '(worker × days)';}],
  [/^Mark reviewed$/g,function(){return 'Checked – OK';}],
  [/^No effect today \(every worker over/g,function(){return 'Nothing to waive (every worker over';}],
  [/Why\? \(the worker sees this – do not write the farm's name\)/g,function(){return 'Why? The worker sees this. Do not write the farm name.';}],
  [/^Approved hours$/g,function(){return 'Counted hours';}],[/^Approved$/g,null],
  [/^All hours$/g,function(){return 'All hours (remove / restore)';}]
];
function fixText(root){if(!root)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n,todo=[];while((n=w.nextNode()))todo.push(n);
  todo.forEach(function(n){var v=n.nodeValue,o=v;if(!v||v.length<3)return;var tr=v.trim();WORDS.forEach(function(p){if(!p[1])return;if(p[0].source.charAt(0)==='^'){if(p[0].test(tr)){p[0].lastIndex=0;v=v.replace(tr,tr.replace(p[0],p[1]));}p[0].lastIndex=0;}else{v=v.replace(p[0],p[1]);}});if(v!==o)n.nodeValue=v;});}
window.scFixText=fixText;
function brkFor(h){var m=Math.round(breakHoursFor(h,false)*60);return m?m+' min unpaid':'no break (5 h or less)';}
function fixBreakUi(root){if(!root)return;
  /* worker clock-out box: plain words, the break stays paid */
  root.querySelectorAll('.breakbox').forEach(function(bx){bx.dataset.hr='1';var b=bx.querySelector('b'),sm=bx.querySelector('small');if(b)b.textContent='I did not get my full break';if(sm)sm.textContent='You will be paid for the break. The office is told.';});
  /* farm "Ask to change hours": the break shown is the real one for that shift (was always "30 min") */
  var sel=root.querySelector('#hc_brk');if(sel){var sub=root.querySelector('.hc-sub'),h=null;root.querySelectorAll('.hc-l').forEach(function(l){if(/^Worked/.test(l.textContent)){var o=l.nextElementSibling;if(o)h=parseFloat(o.textContent);}});if(sub&&h!=null&&!isNaN(h))sub.textContent=brkFor(h);}}
window.scBrkFor=brkFor;
function post(){var app=document.getElementById('app')||document.body;fixBreakUi(app);
  /* farm: "My invoices" cards – neutral note when hours changed after the invoice */
  if(ME&&ME.type!=='admin'){var F={};invFlagsX().forEach(function(z){F[z.inv.number]=z;});app.querySelectorAll('.invcard[data-inv]').forEach(function(c){if(F[c.dataset.inv]&&!c.querySelector('.sc-farmnote')){var d=document.createElement('div');d.className='small sc-farmnote';d.textContent='Hours changed after this invoice. The office will send a corrected invoice or a credit.';c.appendChild(d);}});}
  /* office: the old "includes removed hours" boxes are replaced by the two-way check */
  if(ME&&ME.type==='admin'){app.querySelectorAll('#vsinvflags,tr.vs-invflag').forEach(function(n){n.remove();});
    if(/^#\/(invoicesadmin|allhours)/.test(location.hash)&&!app.querySelector('#scinvflags')){var h=app.querySelector('h1');var fh=flagHtml();if(h&&fh)h.insertAdjacentHTML('afterend',fh);}}
  /* subcontractor: no "Compliant" right next to a PAYMENT HOLD */
  if(ME&&ME.type==='sub'&&/PAYMENT HOLD/.test(app.textContent))app.querySelectorAll('.pill').forEach(function(p){if(p.textContent.trim()==='Compliant')p.textContent='Documents complete';});
  fixText(app);}
window.scPost=post;
(function(){var o=window.render;if(typeof o!=='function')return;var w=function(){var r=o.apply(this,arguments);try{post();}catch(e){}return r;};w.__vs=o.__vs;window.render=w;})();
/* the router keeps its own reference to render(): also tidy the screen whenever it changes (debounced, never re-triggered by itself) */
(function(){var app=null,mo=null,q=false;function run(){q=false;if(!app)return;mo.disconnect();try{post();}catch(e){}mo.observe(app,{childList:true,subtree:true});}
  function start(){app=document.getElementById('app');if(!app||mo)return;mo=new MutationObserver(function(){if(!q){q=true;(window.requestAnimationFrame||setTimeout)(run);}});mo.observe(app,{childList:true,subtree:true});run();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
  var mo2=null;function startM(){if(mo2)return;mo2=new MutationObserver(function(){var m=document.getElementById('modal');if(m&&!m.dataset.scfx){m.dataset.scfx='1';try{fixBreakUi(m);fixText(m);}catch(e){}}});mo2.observe(document.body,{childList:true});}
  if(document.body)startM();else document.addEventListener('DOMContentLoaded',startM);})();
(function(){var o=window.modal;if(typeof o!=='function')return;window.modal=function(){var r=o.apply(this,arguments);try{var m=document.getElementById('modal');fixBreakUi(m);fixText(m);}catch(e){}return r;};})();
(function(){var o=window.toast;if(typeof o!=='function')return;window.toast=function(m){if(typeof m==='string')m=m.replace('“Started earlier?”','“I started before this time”');return o.apply(this,[m].concat([].slice.call(arguments,1)));};})();
/* the efBody partial refresh (filters on My shifts) */
(function(){var o=window.efRefresh;if(typeof o!=='function')return;window.efRefresh=function(){var r=o.apply(this,arguments);try{fixText(document.getElementById('efBody'));}catch(e){}return r;};})();

/* ---------- 9. guided tour: a tap outside the card (or Esc) closes it ---------- */
document.addEventListener('click',function(e){var o=document.getElementById('dltour');if(!o||!e.target||!o.contains(e.target))return;if(e.target.closest&&e.target.closest('.dlt-card'))return;if(window.dlTourClose){e.preventDefault();e.stopPropagation();window.dlTourClose(false);}},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&document.getElementById('dltour')&&window.dlTourClose)window.dlTourClose(false);});

/* ---------- 10. live freshness: re-read on every return to the app (15 s apart) and every 3 min when idle – also on a scrolled
   page (the scroll position is kept); never while a dialog is open, a field has focus or a form has unsaved typing ---------- */
if(LIVE){var last=Date.now(),busy=false,dirty=false;
  document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('form'))dirty=true;},true);
  window.addEventListener('hashchange',function(){dirty=false;});document.addEventListener('submit',function(){dirty=false;},true);
  function calm(){var a=document.activeElement;return !document.getElementById('modal')&&!document.getElementById('dltour')&&!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))&&document.visibilityState==='visible'&&!dirty;}
  async function rr(force){if(busy||typeof ME==='undefined'||!ME||!window.REG_REFRESH||!calm())return;if(Date.now()-last<(force?(window.__SC_FRESH_MS||15000):(window.__SC_IDLE_MS||180000)))return;busy=true;last=Date.now();var y=window.scrollY||0;
    try{if(window.REG_FLUSH)await window.REG_FLUSH();await window.REG_REFRESH();if(y)window.scrollTo(0,y);}catch(e){}finally{busy=false;}}
  window.scRefreshNow=rr;window.scFreshState=function(){return {last:last,busy:busy,dirty:dirty};};
  document.addEventListener('visibilitychange',function(){if(document.visibilityState==='visible')rr(true);});window.addEventListener('focus',function(){rr(true);});
  setInterval(function(){rr(false);},window.__SC_TICK_MS||30000);}

/* ---------- 11. Office Assistant: invoices, credit notes and extra invoices are full office only ---------- */
var OH_NO=['clientbill'],OWN_ONLY=['scinvgo','scinvadj','scadjgo','scinvok','vsinvok','clientinvpaid','clientinv'];
if(typeof actionAllowed==='function'){var oaa2=actionAllowed;actionAllowed=function(name,kind){if(OH()&&OH_NO.indexOf(name)>=0)return false;if(ME&&ME.type==='admin'&&OWN_ONLY.indexOf(name)>=0&&!OWNER())return false;return oaa2.apply(this,arguments);};}

window.syncCheck={version:'synccheck1',isOwner:OWNER,invoiceLines:LINES,virtualCrew:virtualCrew,invFlags:invFlagsX,invHas:invHas,hoursRows:hoursRows};
})();
