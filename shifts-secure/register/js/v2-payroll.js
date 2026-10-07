/* v2-payroll.js – office "Payroll hours" (TEST ONLY): UnScramble employees' paid hours per two-week pay period.
   Each shift counts in the pay period of the day it STARTED (overnight shifts are not split). Break deducted once, only if taken. */
'use strict';
var PAY_ANCHOR='2026-01-05'; /* a Monday; pay periods are 14 days from here */
function payPeriodOf(date){var n=Math.floor(daysBetween(PAY_ANCHOR,date)/14);var s=addDays(PAY_ANCHOR,n*14);return {start:s,end:addDays(s,13)};}
function payrollRows(from,to){var out=[];users('employee').forEach(function(u){var es=DB.time.filter(function(t){return t.userId===u.id&&!t.test&&t.out&&t.date>=from&&t.date<=to;});if(!es.length)return;var h=0,o=0;es.forEach(function(t){var w=hrs(t.in,t.out);h+=w-unpaidBreak(w,t);if(isOvernight(t.in,t.out))o++;});out.push({u:u,n:es.length,hours:Math.round(h*100)/100,overnight:o,entries:es});});return out;}
NAV.admin.splice(Math.min(6,NAV.admin.length),0,['#/payroll','Payroll hours']);
VIEWS['admin:payroll']=function(){var cur=payPeriodOf(PAGE_STATE.payDate||today());var R=payrollRows(cur.start,cur.end);
  return '<h1>Payroll hours</h1><p class="small muted">UnScramble employees only (subcontractor workers are paid by their subcontractor). Two-week pay periods. A shift counts in the pay period of the day it <b>started</b>: an overnight shift is one entry on its start date, never split. The unpaid break ('+breakRuleText()+') is deducted once, only if taken.</p>'+
  '<div class="row"><button class="small sec" data-act="payprev">◀ Previous period</button><b id="payperiod">'+esc(cur.start)+' to '+esc(cur.end)+'</b><button class="small sec" data-act="paynext">Next period ▶</button></div>'+
  '<div class="tw"><table id="paytable"><tr><th>Employee</th><th>Shifts</th><th>Paid hours</th><th>Shifts (start date · time)</th></tr>'+(R.map(function(r){return '<tr data-u="'+r.u.id+'"><td>'+esc(r.u.name)+'</td><td>'+r.n+(r.overnight?' <span class="small">('+r.overnight+' overnight)</span>':'')+'</td><td><b>'+r.hours.toFixed(2)+'</b></td><td class="small">'+r.entries.map(function(t){return esc(t.date+' '+t.in+'–'+t.out)+plus1H(t.in,t.out);}).join('<br>')+'</td></tr>';}).join('')||'<tr><td colspan="4" class="muted">No hours in this pay period.</td></tr>')+'</table></div>';};
ACT.payprev=function(){PAGE_STATE.payDate=addDays(payPeriodOf(PAGE_STATE.payDate||today()).start,-1);render();};
ACT.paynext=function(){PAGE_STATE.payDate=addDays(payPeriodOf(PAGE_STATE.payDate||today()).end,1);render();};
ADMIN_ONLY_ACT.push('payprev','paynext');
