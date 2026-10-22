/* v2-payroll.js – office "Payroll hours" (TEST ONLY): UnScramble employees' paid hours per two-week pay period.
   Each shift counts in the pay period of the day it STARTED (overnight shifts are not split). Break deducted once, only if taken. */
'use strict';
/* payperiod1 (owner Oct 21 2026): ONE shared UnScramble pay schedule. Bi-weekly, Friday to Thursday. Anchor: Fri Oct 2 – Thu Oct 15 2026.
   Pay date = period end + 14 days (a Thursday). Hours cut-off (Us Aasa preps hours) = Thursday before payday (end + 7).
   Owner approval = Friday before payday (end + 8), date only (owner confirmed Oct 21 2026 10:10 PM). Wagepoint run date is information only. Wagepoint run = Monday before payday (pay - 3) unless listed in PAY_RUN_OVERRIDE.
   Before: anchor Mon 2026-01-05, Monday–Sunday periods, no pay date. Every page (payroll hours, payroll CSV / Wagepoint CSV, office
   home pay chart, removed-hours alert, employee hours tiles, farm home periods, Pay schedule) reads payPeriodOf / paySchedule below. */
var PAY_ANCHOR='2026-10-02'; /* a Friday; pay periods are 14 days from here (Fri–Thu) */
var PAY_RUN_OVERRIDE={'2026-11-12':'2026-11-06'}; /* pay date -> Wagepoint run date, when it is not the Monday before (owner list Oct 21 2026) */
function payPeriodOf(date){var n=Math.floor(daysBetween(PAY_ANCHOR,date)/14);var s=addDays(PAY_ANCHOR,n*14),e=addDays(s,13),pay=addDays(e,14);
  return {start:s,end:e,cutoff:addDays(e,7),approve:addDays(pay,-6),run:PAY_RUN_OVERRIDE[pay]||addDays(pay,-3),pay:pay};}
/* payperiod1b (owner Oct 21 2026 10 PM): the period being PROCESSED = the most recent ENDED period whose pay date has not passed yet
   (Oct 21 2026 -> Oct 2–15, pays Oct 29). Payroll hours, the payroll / Wagepoint CSV and its preview open on it; ◀ ▶ still move. */
function payProcessing(d){d=d||today();var cur=payPeriodOf(d),prev=payPeriodOf(addDays(cur.start,-1));return d<=prev.pay?prev:null;}
function payProcDate(){var p=payProcessing();return p?p.start:today();}
window.payProcessing=payProcessing;window.payProcDate=payProcDate;
function paySchedule(from,n){var L=[],p=payPeriodOf(from||today());for(var i=0;i<(n||6);i++){L.push(p);p=payPeriodOf(addDays(p.end,1));}return L;}
window.payPeriodOf=payPeriodOf;window.paySchedule=paySchedule;
function payrollRows(from,to){var out=[];users('employee').forEach(function(u){var es=DB.time.filter(function(t){return t.userId===u.id&&!t.test&&t.out&&t.date>=from&&t.date<=to;});if(!es.length)return;var h=0,o=0;es.forEach(function(t){var w=hrs(t.in,t.out);h+=w-unpaidBreak(w,t);if(isOvernight(t.in,t.out))o++;});out.push({u:u,n:es.length,hours:Math.round(h*100)/100,overnight:o,entries:es});});return out;}
NAV.admin.splice(Math.min(6,NAV.admin.length),0,['#/payroll','Payroll hours']);
VIEWS['admin:payroll']=function(){var cur=payPeriodOf(PAGE_STATE.payDate||payProcDate());var R=payrollRows(cur.start,cur.end);
  return '<h1>Payroll hours</h1><p class="small muted">UnScramble employees only (subcontractor workers are paid by their subcontractor). Two-week pay periods, Friday to Thursday, paid the Thursday two weeks after the period ends. A shift counts in the pay period of the day it <b>started</b>: an overnight shift is one entry on its start date, never split. The unpaid break ('+breakRuleText()+') is deducted once, only if taken.</p>'+
  '<div class="row"><button class="small sec" data-act="payprev">◀ Previous period</button><b id="payperiod">'+esc(cur.start)+' to '+esc(cur.end)+'</b>'+(function(){var pp=payProcessing();return pp&&pp.start===cur.start?'<span class="pill s-ok" id="payproc">Being paid '+esc(cur.pay)+'</span> ':'';})()+'<span class="small" id="paydates">Hours cut-off '+esc(cur.cutoff)+' · Wagepoint run '+esc(cur.run)+' · Approve by '+esc(cur.approve)+' · pay date <b>'+esc(cur.pay)+'</b></span><button class="small sec" data-act="paynext">Next period ▶</button></div>'+
  '<div class="tw"><table id="paytable"><tr><th>Employee</th><th>Shifts</th><th>Paid hours</th><th>Shifts (start date · time)</th></tr>'+(R.map(function(r){return '<tr data-u="'+r.u.id+'"><td>'+esc(r.u.name)+'</td><td>'+r.n+(r.overnight?' <span class="small">('+r.overnight+' overnight)</span>':'')+'</td><td><b>'+r.hours.toFixed(2)+'</b></td><td class="small">'+r.entries.map(function(t){return esc(t.date+' '+t.in+'–'+t.out)+plus1H(t.in,t.out);}).join('<br>')+'</td></tr>';}).join('')||'<tr><td colspan="4" class="muted">No hours in this pay period.</td></tr>')+'</table></div>';};
ACT.payprev=function(){PAGE_STATE.payDate=addDays(payPeriodOf(PAGE_STATE.payDate||payProcDate()).start,-1);render();};
ACT.paynext=function(){PAGE_STATE.payDate=addDays(payPeriodOf(PAGE_STATE.payDate||payProcDate()).end,1);render();};
ADMIN_ONLY_ACT.push('payprev','paynext');
