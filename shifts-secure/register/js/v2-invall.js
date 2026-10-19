/* v2-invall.js – invall1 (owner Oct 19 2026, 12:17 AM): "make sure that the invoices that get made include all hours even the pending
   approval; if farms have any question they can reply back." TEST COPY, front end only, no SQL.
   - FARM BILLING (firmRows → firmReport → invoice preview, monthly invoice, revised / extra / credit, farm's own hours & invoices,
     Farm billing by day, "Hours changed since this invoice") now counts late entries WAITING FOR APPROVAL (missed shifts,
     subcontractor-added shifts, crew-lead group entries) exactly like approved hours. Turned-down (rejected) and removed hours stay out.
     Unassigned (nickname) shifts were already billed (Worker #n). To the farm a waiting entry is an ordinary "Worker #n" line –
     no "pending" / "late" / "unassigned" words (no note is added; the "Late entry, approved…" note stays for approved ones only).
   - PAYROLL UNCHANGED: Payroll / Wagepoint, subcontractor invoices and worker hours still wait for the office's approval
     (payrollRows / subRows / efSum are not touched).
   - Later rejected / removed / changed after it was invoiced: the existing "Hours changed since this invoice" check (synccheck,
     snapshot lines) flags the invoice → credit note / revised invoice. Approving it later changes nothing on the invoice.
   - No double billing: an approved late entry that is already a line on an issued invoice is NOT added again as a
     "late entry" line on the next month's invoice (lateLinesFor).
   - All hours: under "Counting hours shown", the same shifts as farm invoices count them (billable, 5-hour minimum, break once per
     worker per day), so the two numbers reconcile for the same farm and dates. Hours only, no money, no farm names.
   - Invoice visibility unchanged (owner + that farm only). Load after v2-edithours.js, before v2-keepscroll.js.
   Turn off: remove the 2 lines in index.html. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s);}
function R2(x){return Math.round((+x||0)*100)/100;}
function f2(x){return R2(x).toFixed(2);}

/* ---------- 1. farm billing counts waiting entries ---------- */
var DEPTH=0;
function withPending(fn,self,args){
  if(DEPTH>0||!DB||!Array.isArray(DB.time))return fn.apply(self,args);
  var held=[],sv=window.save,asked=false,i,t;
  for(i=0;i<DB.time.length;i++){t=DB.time[i];if(t&&t.lateEntry==='pending'&&!t.test&&!t.removed){held.push(t);delete t.lateEntry;t._iaPend=1;}}
  if(!held.length)return fn.apply(self,args);
  DEPTH++;window.save=function(){asked=true;return true;};
  try{return fn.apply(self,args);}
  finally{DEPTH--;window.save=sv;held.forEach(function(x){if(x._iaPend){delete x._iaPend;if(!x.lateEntry)x.lateEntry='pending';}});if(asked)sv();}}
window.iaWithPending=withPending;
(function(){var o=window.firmRows;if(typeof o!=='function')return;window.firmRows=function(){return withPending(o,this,arguments);};})();

/* ---------- 2. no double billing of an approved late entry already on an issued invoice ---------- */
function onIssued(id){var k='t:'+id;return (DB.clientInvoices||[]).some(function(v){if(!v||v.adjOf||v.deleted)return false;
  return [v.lines,v.lines0].some(function(L){return Array.isArray(L)&&L.some(function(l){return l&&l.k===k;});});});}
(function(){var o=window.lateLinesFor;if(typeof o!=='function')return;window.lateLinesFor=function(){var L=o.apply(this,arguments)||[];
  var keep=L.filter(function(l){return !onIssued(l.tid);});
  return keep;};})();

/* ---------- 3. All hours: what farm invoices make of the same shifts ---------- */
function farmsOf(rows){var m={};rows.forEach(function(r){var s=r.site;var f=s&&typeof firmOfSite==='function'?firmOfSite(s):null;if(f)m[f.id]=f;});return Object.keys(m).map(function(k){return m[k];});}
function recon(from,to,shown){/* shown: [{key,site,paid}] counting rows on screen */
  var want={},paidAll=0;shown.forEach(function(r){want[r.key]=r;if(r.alias)want[r.alias]=r;paidAll+=r.paid;});
  var got={},bill=0,top=0,paidIn=0;
  farmsOf(shown).forEach(function(f){var rows;try{rows=firmRows(f,from,to);}catch(e){rows=[];}
    rows.forEach(function(r){var w=want[r.key];if(!w||got[w.key])return;got[w.key]=1;bill+=+r.bill||0;top+=+r.minTopUp||0;paidIn+=w.paid;});});
  var out=paidAll-paidIn,brk=paidIn+top-bill;return {bill:bill,top:top,brk:brk,out:out,nOut:shown.filter(function(r){return !got[r.key];}).length};}
function siteOfT(t){if(t.site)return t.site;var sh=(DB.shifts||[]).filter(function(z){return z.id===t.shiftId;})[0];return sh?sh.site:'';}
function farmName(site){var f=site&&typeof firmOfSite==='function'?firmOfSite(site):null;return f?(f.realName||(f.firm&&f.firm.realName)||f.name||''):'';}
function whoTxt(u){return !u?'':u.type==='employee'?'UnScramble employee':(typeof employerName==='function'?employerName(u):'');}
/* counting rows for the dates + search on screen – same rule as farm billing (waiting entries count, scheduled crew once) */
function counted(from,to,q){var out=[];
  withPending(function(){var run=function(){(DB.time||[]).forEach(function(t){if(!t||t.test||!t.out||t.removed||t.lateEntry==='rejected'||t.date<from||t.date>to)return;
      var u=user(t.userId),site=siteOfT(t);if(!(u&&u.type!=='tester')&&!t.unassigned)return;
      if(q){var nm=u?u.name:(t.uaNick||'unassigned');if((nm+' '+site+' '+site+(farmName(site)?' – '+farmName(site):'')+' '+whoTxt(u)).toLowerCase().indexOf(q)<0)return;}
      var w=hrs(t['in'],t.out);out.push({key:t._scV?t.key0:'t:'+t.id,alias:!t._scV&&t.key0?t.key0:'',site:site,paid:w-unpaidBreak(w,t)});});};
    if(typeof window.scWithVirt==='function')window.scWithVirt(run,null,[],true);else run();});
  return out;}
(function(){var ov=VIEWS['admin:allhours'];if(typeof ov!=='function')return;VIEWS['admin:allhours']=function(){var x=ov.apply(this,arguments);
  try{var s=PAGE_STATE.vsh||{},to=s.to||today(),from=s.from||addDays(to,-13),q=String(s.q||'').toLowerCase();if(s.show==='removed')return x;
    var shown=counted(from,to,q),tot=shown.reduce(function(a,r){return a+r.paid;},0);
    x=x.replace(/(id="vshtot">)[^<]*/,'$1'+tot.toFixed(2));
    if(!shown.length)return x;
    var r=withPending(function(){return recon(from,to,shown);}),parts=[];
    if(Math.abs(r.top)>0.004)parts.push('+ '+f2(r.top)+' h 5-hour daily minimum');
    if(Math.abs(r.brk)>0.004)parts.push((r.brk>0?'− ':'+ ')+f2(Math.abs(r.brk))+' h break taken once per worker per day');
    if(r.nOut)parts.push('− '+f2(r.out)+' h not at a farm or client ('+r.nOut+' shift'+(r.nOut===1?'':'s')+')');
    var line='<div class="small ia-recon" id="iarecon">On farm invoices: <b id="iabill">'+f2(r.bill)+'</b> billable h'+(parts.length?' = the '+f2(tot)+' h shown '+parts.join(' ')+'.':' – the same as the hours shown.')+' Shifts waiting for approval and unassigned shifts are included (pay still waits for approval).</div>';
    var at=x.indexOf('</span></div>',x.indexOf('id="vshtot"'));if(at>=0){at+='</span></div>'.length;x=x.slice(0,at)+line+x.slice(at);}else x+=line;}catch(e){try{console.warn('[invall]',e);}catch(z){}}
  return x;};})();
})();
