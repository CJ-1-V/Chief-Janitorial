/* cancelfix1 (Oct 7 2026): farm cancellations / changes now reach the office.
   Root cause: the live DB guard on reg_crew_orders (reg_orders_guard) only lets a farm change data.status back to
   data.restore.status (withdraw). Single Cancel, Cancel all and Change all set status 'Changed - awaiting office', so the
   server rejected the update ("Only the office changes the order status."), the farm only saw it locally, the office never.
   Fix (no DB change): a farm keeps the order's saved status and only writes pending/restore/history (allowed by the guard).
   "Awaiting office" is now shown from o.pending. The office gets a clear red "Cancel requested" badge + a banner + a tab. */
(function(){
var sv=save;
var AW='Changed - awaiting office';
function cfFix(){if(!ME||ME.type==='admin'||typeof crewOrders!=='function')return;
  crewOrders().forEach(function(o){if(o&&!o.kind&&o.status===AW&&o.pending&&o.pending.kind!=='new'&&o.restore&&o.restore.status&&o.restore.status!==AW)o.status=o.restore.status;});}
window.cfFix=cfFix;
/* any farm form that touches crew orders: put back the saved status the handler changed to "awaiting office" */
function cfWrap(k){var f=FORMS[k];if(typeof f!=='function'||f.__cf)return;FORMS[k]=function(){var me=ME&&ME.type!=='admin',snap={};
  if(me)crewOrders().forEach(function(o){snap[o.id]=o.status;});var r=f.apply(this,arguments);
  if(me){var ch=0;crewOrders().forEach(function(o){if(snap[o.id]!==undefined&&snap[o.id]!==o.status&&o.status===AW&&o.pending&&o.pending.kind!=='new'){o.status=snap[o.id];ch++;}});if(ch)sv();}
  return r;};FORMS[k].__cf=1;}
['crewOrderCancel','crewOrderCancelAll','crewOrderChange'].concat(Object.keys(FORMS).filter(function(k){return /^crewOrder|^cobook$/.test(k);})).forEach(cfWrap);
var ol=ordLog;ordLog=function(){var r=ol.apply(this,arguments);try{cfFix();}catch(e){}return r;};
save=function(){try{cfFix();}catch(e){}return sv.apply(this,arguments);};
var os=ordStatus;ordStatus=function(o){if(o&&!o.kind&&o.pending&&o.pending.kind!=='new'&&o.status!=='Cancelled'&&o.status!=='Declined')return AW;return os(o);};
function cfCx(){return crewOrders().filter(function(o){return o&&!o.kind&&o.pending&&o.pending.kind==='cancel';});}
var oc=ordCardOffice;ordCardOffice=function(o){var x=oc.apply(this,arguments);if(!(o&&o.pending&&o.pending.kind==='cancel'))return x;
  var all=/Cancel all/.test(o.pending.reason||'');
  return x.replace('<div class="ordcard office"','<div class="ordcard office cf-cxcard"').replace('<div class="oc-head">','<div class="oc-head"><span class="pill cf-cxbadge">⛔ Cancel requested'+(all?' (Cancel all)':'')+'</span> ');};
var cf=coFilterList;coFilterList=function(st){if(st&&st.tab==='cxreq')return cf(Object.assign({},st,{tab:'all'})).filter(function(o){return o.pending&&o.pending.kind==='cancel';});return cf(st);};
var ov=VIEWS['admin:creworders'];VIEWS['admin:creworders']=function(){var x=ov.apply(this,arguments),l=cfCx(),n=l.length,st=PAGE_STATE.cof||{tab:'pending'};
  var tab='<button class="small '+(st.tab==='cxreq'?'':'sec')+' cf-tab" data-act="cofilter" data-t="cxreq">Cancel requests ('+n+')</button>';
  x=x.replace('<div class="row cotabs">','<div class="row cotabs">'+tab);
  if(n){var by={};l.forEach(function(o){by[o.firmName]=(by[o.firmName]||0)+1;});
    x=x.replace('<div class="row cotabs">','<div class="alert bad cf-banner" id="cfbanner"><b>'+n+' cancellation request'+(n===1?'':'s')+' waiting:</b> '+Object.keys(by).map(function(k){return esc(k)+' ('+by[k]+')';}).join(', ')+'. Confirm or decline each below.</div><div class="row cotabs">');}
  return x;};
})();
