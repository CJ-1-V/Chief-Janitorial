/* v2-payschedule.js – payperiod1 (owner Oct 21 2026): "Pay schedule" for every UnScramble employee and worker. Current period + next ones:
   period dates, hours cut-off, pay date. Plain English, mobile first, no rates, no money. Reads paySchedule() from v2-payroll.js. Front end only. */
(function(){'use strict';if(typeof VIEWS==='undefined'||typeof NAV==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function D(d){var x=parseD(d);return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][x.getDay()]+', '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]+' '+x.getDate()+(x.getFullYear()!==parseD(today()).getFullYear()?', '+x.getFullYear():'');}
function S(d){var x=parseD(d);return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][x.getMonth()]+' '+x.getDate();}
if(!document.getElementById('psstyle')){var st=document.createElement('style');st.id='psstyle';st.textContent=
 '.ps-list{display:grid;gap:10px;margin:12px 0}.ps-card{border:1px solid #e3e0ea;border-radius:12px;padding:12px 14px;background:#fff}'+
 '.ps-card.now{border:2px solid #2e7d32;background:#f3faf3}.ps-tag{display:inline-block;font-size:12px;font-weight:700;color:#fff;background:#2e7d32;border-radius:10px;padding:2px 8px;margin-bottom:6px}'+
 '.ps-per{font-size:17px;font-weight:700;margin-bottom:6px}.ps-row{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-top:1px dashed #eee;font-size:15px}'+
 '.ps-card.paying{border:2px solid #1565c0;background:#f2f7fd}.ps-paying{background:#1565c0}'+
 '.ps-row b{text-align:right}.ps-pay b{color:#1b5e20;font-size:16px}';document.head.appendChild(st);}
function view(){var t=today(),pp=payProcessing(t),L=paySchedule(pp?pp.start:t,pp?7:6),cs=payPeriodOf(t).start,sub=ME&&ME.type==='worker'&&ME.subId;
  return '<h1>Pay schedule</h1><p>You are paid every two weeks. Each pay period runs <b>Friday to Thursday</b>. Pay day is the <b>Thursday two weeks after</b> the period ends.</p>'+
  '<p class="small muted">Make sure your hours are right by the hours cut-off. Hours fixed later may move to the next pay.</p>'+
  (sub?'<div class="alert info small">Your employer (your subcontractor) pays you. Ask them if their pay days are different.</div>':'')+
  '<div class="ps-list" id="pslist">'+L.map(function(p,i){var now=p.start===cs,bp=pp&&p.start===pp.start;return '<div class="ps-card'+(now?' now':'')+(bp?' paying':'')+'">'+(now?'<span class="ps-tag">Now</span>':'')+(bp?'<span class="ps-tag ps-paying">Being paid '+E(S(p.pay))+'</span>':'')+
    '<div class="ps-per">'+E(S(p.start))+' – '+E(S(p.end))+'</div>'+
    '<div class="ps-row"><span>Hours cut-off</span><b>'+E(D(p.cutoff))+'</b></div>'+
    '<div class="ps-row ps-pay"><span>Pay day</span><b>'+E(D(p.pay))+'</b></div></div>';}).join('')+'</div>';}
VIEWS['employee:payschedule']=VIEWS['worker:payschedule']=view;
['employee','worker'].forEach(function(k){try{if(NAV[k]&&!NAV[k].some(function(n){return n[0]==='#/payschedule';}))NAV[k].push(['#/payschedule','Pay schedule']);}catch(e){}});
})();
/* payperiod1b (owner Oct 21 2026 10:06 PM): office-only payroll approval reminder. From 3 days before the Wagepoint run date until 12 PM
   that day: a banner on the office home and on Payroll hours. Front end only: no email, no cron, no SQL, and no bell item (the bell is
   reg_alerts_outbox on the server, which is an outbox – writing to it could send mail). Employees, workers, subs and farms see nothing. */
(function(){'use strict';if(typeof VIEWS==='undefined')return;
var WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function md(d){var x=parseD(d);return MN[x.getMonth()]+' '+x.getDate();}
function wmd(d){var x=parseD(d);return WD[x.getDay()]+' '+md(d);}
function span(a,b){var x=parseD(a),y=parseD(b);return x.getMonth()===y.getMonth()?md(a)+'-'+y.getDate():md(a)+' - '+md(b);}
function office(){if(typeof officeAnyTime==='function')return officeAnyTime();return !!(ME&&ME.type==='admin');}
function nowHM(){var simd=DB&&DB.settings&&DB.settings.simDate;if(simd&&DB.settings.simTime)return DB.settings.simTime;var n=new Date();return ('0'+n.getHours()).slice(-2)+':'+('0'+n.getMinutes()).slice(-2);}
function due(){if(typeof payProcessing!=='function'||!ME||!office())return null;var t=today(),p=payProcessing(t);if(!p)return null;
  if(t<addDays(p.approve,-3)||t>p.approve)return null;if(t===p.approve&&nowHM()>=p.approveAt)return null;return p;}
function banner(){var p=due();if(!p)return '';
  return '<div class="alert warn" id="payapprove" role="status"><b>Payroll '+esc(span(p.start,p.end))+': approve in Wagepoint by '+esc(wmd(p.approve))+', 12 PM. Pays '+esc(wmd(p.pay))+'.</b></div>';}
window.payApproveBanner=banner;
['admin:home','admin:payroll'].forEach(function(k){var o=VIEWS[k];if(typeof o!=='function')return;VIEWS[k]=function(){var x=o.apply(this,arguments),b=banner();if(!b||String(x).indexOf('id="payapprove"')>=0)return x;
  var i=String(x).indexOf('</h1>');return i>=0?x.slice(0,i+5)+b+x.slice(i+5):b+x;};});
})();
