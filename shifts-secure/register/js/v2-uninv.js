/* v2-uninv.js – uninv1 (owner Oct 21 2026): on the office Invoices screen (month → farm) every farm / other client shows a $ amount
   for hours NOT invoiced yet: farms with "No invoice yet" and hours worked beyond the existing invoices (same top-up math:
   firmReport now − what the invoices for that period already billed). Same rates + calc as invoice creation (firmReport), waiting
   entries counted (invall). Total per month. Who sees it: owner / admin / billing office roles only, AND only where farm invoices
   are already shown (owner rule, ivBlocked). Never the Office Assistant (helper) or the farm side. Front end only, no SQL.
   Load after v2-invbox.js and v2-topup.js. */
(function(){
'use strict';
if(typeof DB==='undefined')return;
var ROLES=['owner','admin','billing'];
function helper(){return typeof window.ohIs==='function'&&window.ohIs();}
function can(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||helper())return false;if(typeof window.ivBlocked==='function'&&window.ivBlocked())return false;
  var r=ME.officeRoles||(ME.officeRole?[ME.officeRole]:[]);if(!r.length)return typeof window.ivOwner==='function'?!!window.ivOwner():false;return r.some(function(x){return ROLES.indexOf(String(x))>=0;});}
window.uninvCan=can;
function R2(x){return Math.round((+x||0)*100)/100;}
function M$(x){return typeof money==='function'?money(+x||0):'$'+(+x||0).toFixed(2);}
function mEnd(m){var d=new Date(+m.slice(0,4),+m.slice(5,7),0);return m+'-'+String(d.getDate()).padStart(2,'0');}
function nextDay(d){return addDays(d,1);}
function invs(f){return (DB.clientInvoices||[]).filter(function(i){return i&&i.firmId===f.id&&!i.deleted&&!i.deletedAt&&i.revStatus!=='withdrawn'&&!i.uploaded&&!i.credit;});}
function credits(f){return (DB.clientInvoices||[]).filter(function(i){return i&&i.firmId===f.id&&!i.deleted&&!i.deletedAt&&i.credit;});}
function rep(f,a,b){try{var R=firmReport(f,a,b);return {amt:+R.tot.amount||0,hst:+R.tot.hst||0,h:+R.tot.hours||0};}catch(e){return {amt:0,hst:0,h:0};}}
/* one farm, one WORK month:
   (a) days of the month no invoice period covers → everything worked there is not invoiced (firmReport over those days);
   (b) each invoice period whose WORK month is this month → firmReport(period) now − all invoices for that same period
       (the month invoice + its top-ups, paid or not, less credits) = the top-up math. */
function calc(f,m){var a=m+'-01',b=mEnd(m),L=invs(f),out={amt:0,hst:0,h:0,parts:[]};
  var per={};L.forEach(function(i){var s=String(i.periodStart||''),e=String(i.periodEnd||s);if(!s)return;if(e<s){var t=s;s=e;e=t;}if(s>b||e<a)return;(per[s+'|'+e]=per[s+'|'+e]||[]).push(i);});
  var cov=Object.keys(per).map(function(k){return k.split('|');});
  var d=a,run=null;function flush(end){if(!run)return;var r=rep(f,run,end);if(r.amt||r.h){out.amt+=r.amt;out.hst+=r.hst;out.h+=r.h;out.parts.push({kind:'none',from:run,to:end,amt:r.amt});}run=null;}
  for(var n=0;d<=b&&n<40;n++){var c=cov.some(function(p){return d>=p[0]&&d<=p[1];});if(!c){if(!run)run=d;}else flush(addDays(d,-1));d=nextDay(d);}flush(b);
  Object.keys(per).forEach(function(k){var g=per[k],p=k.split('|');var wm=typeof window.ibMonthOf==='function'?window.ibMonthOf(g[0]):p[0].slice(0,7);if(wm!==m)return;
    var r=rep(f,p[0],p[1]),billed=0,bh=0;g.forEach(function(i){billed+=+i.amount||0;bh+=+i.hst||0;});
    credits(f).forEach(function(c){if(String(c.periodStart||'')===p[0]){billed+=+c.amount||0;bh+=+c.hst||0;}});  /* credit amounts are negative */
    var da=R2(r.amt-billed),dh=R2(r.hst-bh);if(Math.abs(da)>=0.005){out.amt+=da;out.hst+=dh;out.parts.push({kind:'beyond',from:p[0],to:p[1],amt:da});}});
  out.amt=R2(out.amt);out.hst=R2(out.hst);out.tot=R2(out.amt+out.hst);return out;}
window.uninvCalc=calc;
function firmsIn(m){var seen={};(DB.time||[]).forEach(function(t){if(!t||t.removed||t.voided||t.deleted||!t.date||String(t.date).slice(0,7)!==m)return;
    var site=t.site||(function(){var s=(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return s?s.site:'';})(),f=site&&typeof siteFirm==='function'&&siteFirm(site);if(f&&f.type==='firm'&&f.firm)seen[f.id]=f;});
  (DB.clientInvoices||[]).forEach(function(i){if(!i)return;var f=user(i.firmId);if(f&&typeof window.ibMonthOf==='function'&&window.ibMonthOf(i)===m)seen[f.id]=f;});
  return Object.keys(seen).map(function(k){return seen[k];});}
function monthTot(m){var t={amt:0,hst:0,tot:0,n:0};firmsIn(m).forEach(function(f){var c=calc(f,m);if(c.amt<0){t.over=R2((t.over||0)+c.tot);}if(c.amt>=0.005){t.amt+=c.amt;t.hst+=c.hst;t.tot+=c.tot;t.n++;}});t.amt=R2(t.amt);t.hst=R2(t.hst);t.tot=R2(t.tot);return t;}
window.uninvMonth=monthTot;
var cache={};function key(){return (DB.time||[]).length+'|'+(DB.clientInvoices||[]).length+'|'+(DB.changes||[]).length+'|'+(typeof DB_VER!=='undefined'?DB_VER:'');}
function mt(m){var k=key();if(cache.k!==k)cache={k:k};return cache['m'+m]=cache['m'+m]||monthTot(m);}
function fc(f,m){var k=key();if(cache.k!==k)cache={k:k};return cache['f'+f.id+m]=cache['f'+f.id+m]||calc(f,m);}
function line(c,cls){var neg=c.amt<0;return '<span class="uninv '+cls+(neg?' uninv-neg':'')+'" title="Hours worked that no invoice covers yet, at this farm\'s rates (same calculation as Create invoice; waiting entries counted)">'+(neg?'Invoiced more than the hours now: '+M$(Math.abs(c.tot))+' incl. HST (not in the total; check the hours)</span>':'Not invoiced yet <b>'+M$(c.amt)+'</b> + HST '+M$(c.hst)+' = '+M$(c.tot)+'</span>');}
function paint(){if(!can())return;var w=document.querySelector('.ib-wrap');if(!w||w.closest('#ohinv'))return;var s=PAGE_STATE.ib2||{};if(!w.querySelector('[data-uninv],#uninvall,#uninvtot'))cache={};
  [].forEach.call(w.querySelectorAll('[data-ib-month]:not([data-uninv])'),function(b){b.setAttribute('data-uninv','1');var c=mt(b.getAttribute('data-ib-month'));b.insertAdjacentHTML('beforeend',c.amt>=0.005?line(c,'uninv-month'):'<span class="uninv uninv-month uninv-zero">Everything invoiced</span>');if(c.over)b.insertAdjacentHTML('beforeend','<span class="uninv uninv-neg">Invoiced more than the hours now: '+M$(Math.abs(c.over))+' (check)</span>');});
  if(s.m){[].forEach.call(w.querySelectorAll('[data-ib-missfarm]:not([data-uninv]),[data-ib-farm]:not([data-uninv])'),function(b){b.setAttribute('data-uninv','1');var f=user(b.getAttribute('data-ib-missfarm')||b.getAttribute('data-ib-farm'));if(!f)return;var c=fc(f,s.m);
      var n=b.querySelector('.ib-mkinv');var h=Math.abs(c.amt)>=0.005?line(c,'uninv-farm'):'<span class="uninv uninv-farm uninv-zero">All hours invoiced</span>';if(n)n.insertAdjacentHTML('beforebegin',h);else b.insertAdjacentHTML('beforeend',h);});
    var fl=w.querySelector('.ib-farms');if(fl&&!w.querySelector('#uninvtot')){var t=mt(s.m);fl.insertAdjacentHTML('beforebegin','<p class="uninv-total" id="uninvtot">'+(t.amt>=0.005?'Not invoiced yet this month: <b>'+M$(t.amt)+'</b> + HST '+M$(t.hst)+' = <b>'+M$(t.tot)+'</b> ('+t.n+(t.n===1?' client':' clients')+')':'Everything worked this month is invoiced.')+'</p>');}}
  var top=w.querySelector('.ib-months');if(top&&!w.querySelector('#uninvall')){var M=[].map.call(w.querySelectorAll('[data-ib-month]'),function(b){return b.getAttribute('data-ib-month');}),T=0;M.forEach(function(m){T+=mt(m).tot;});
    top.insertAdjacentHTML('beforebegin','<p class="uninv-total" id="uninvall">Not invoiced yet, all months shown: <b>'+M$(R2(T))+'</b> incl. HST. Each month and farm shows its own amount.</p>');}}
var busy=false;new MutationObserver(function(){if(busy)return;busy=true;setTimeout(function(){try{paint();}catch(e){try{console.warn('[uninv]',e);}catch(z){}}busy=false;},40);}).observe(document.documentElement,{childList:true,subtree:true});
if(!document.getElementById('uninvstyle')){var st=document.createElement('style');st.id='uninvstyle';st.textContent='.uninv{display:block;font-size:12.5px;margin-top:4px;color:#8a4b00}.uninv b{color:#6b3a00}.uninv-zero{color:#5b7d5b}.uninv-neg{color:#6a5acd}.uninv-total{margin:6px 0 10px;padding:8px 10px;border-radius:10px;background:#fff7e8;border:1px solid #f0d9a8}';document.head.appendChild(st);}
})();
