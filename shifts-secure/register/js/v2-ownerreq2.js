/* v2-ownerreq2.js – owner requests Oct 26 2026 (TEST COPY ONLY – not deployed). Loaded after v2-ownerreq1.js.
   1) Live: Unknown farm codes go to the server (reg_unknown_codes via reg_unknown_code_report – sql/ownerreq2_apply.sql);
      the office admin's list loads from there (store-supabase.js). Flag REG_STORE.unknownCodes.
   2) Owner's billing + payroll: unknown farms are FILTERED OUT of the data the screens and exports use (not only hidden by the display pass):
      farm lists (users('firm')), farm reports / invoices (firmRows), site -> farm (siteFirm) and payroll rows (payrollRows).
      Nothing is deleted; hours at unknown farms are listed as "held for the office admin to match". Office admin / assistant views unchanged.
   3) Live sign-up: the farm-code box checks the code with the server (reg_farm_code_check, rate-limited, no names);
      auto-match + Unknown list + invite auto-approve happen in the sign-up trigger (server side, cannot be faked).
   4) An invited farm that was approved by the trigger goes straight to Home instead of "waiting for approval".
   Rollback: remove this file's tag (and set REG_STORE.unknownCodes = false). */
'use strict';
(function(){
function live(){return !!window.REG_LIVE;}
function srv(){return live()&&!!(window.REG_STORE&&window.REG_STORE.unknownCodes)&&!!window.REG_SB;}
function owner(){return typeof window.orIsOwner==='function'&&window.orIsOwner();}
function unkFarm(f){return typeof window.orIsUnknownFarm==='function'&&window.orIsUnknownFarm(f);}
function unkSite(c){return !!c&&typeof window.orIsUnknownSite==='function'&&window.orIsUnknownSite(c);}
function normC(c){return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,10);}

/* ---------- 1) server Unknown list (live) ---------- */
window.or2Report=async function(code,where){if(!srv())return null;try{var r=await window.REG_SB.rpc('reg_unknown_code_report',{p_code:normC(code),p_where:where==='sign-up'?'sign-up':'clock-in'});
  if(r.error){if(typeof toast==='function')toast(/Too many/.test(r.error.message||'')?'Too many tries. Please wait a few minutes.':'Could not send it. Please tell the office.');return null;}return r.data;}catch(e){return null;}};

/* ---------- 2) owner: real filters on billing / payroll data ---------- */
var _users=window.users;
if(typeof _users==='function')window.users=function(type){var l=_users.apply(this,arguments);if(type==='firm'&&owner())l=l.filter(function(f){return !unkFarm(f);});return l;};
var _firmRows=window.firmRows;
if(typeof _firmRows==='function')window.firmRows=function(firm){if(owner()&&unkFarm(firm))return [];var l=_firmRows.apply(this,arguments);
  return owner()&&Array.isArray(l)?l.filter(function(r){var s=r&&(r.site||(r.t&&r.t.site));return !unkSite(s);}):l;};
var _siteFirm=window.siteFirm;
if(typeof _siteFirm==='function')window.siteFirm=function(code){var f=_siteFirm.apply(this,arguments);return owner()&&(unkFarm(f)||unkSite(code))?null:f;};
var _firmOfSite=window.firmOfSite;
if(typeof _firmOfSite==='function')window.firmOfSite=function(code){var f=_firmOfSite.apply(this,arguments);return owner()&&(unkFarm(f)||unkSite(code))?null:f;};
var HELDS={};window.or2Held=function(from,to){if(!from){var c=payPeriodOf(PAGE_STATE.payDate||payProcDate());from=c.start;to=c.end;}return HELDS[from+'|'+to]||{n:0,hours:0,people:0};};
function entHours(t){var w=hrs(t.in,t.out);return w-unpaidBreak(w,t);}
var _pr=window.payrollRows;
if(typeof _pr==='function')window.payrollRows=function(from,to){var R=_pr.apply(this,arguments),HELD={n:0,hours:0,people:0};HELDS[from+'|'+to]=HELD;if(!owner()||!Array.isArray(R))return R;
  var out=[];R.forEach(function(r){var es=r.entries||[],keep=es.filter(function(t){return !unkSite(t.site);}),held=es.length-keep.length;
    if(!held){out.push(r);return;}
    var hh=0;es.forEach(function(t){if(unkSite(t.site))hh+=entHours(t);});HELD.n+=held;HELD.hours+=hh;HELD.people++;
    if(!keep.length)return;var h=0,o=0;keep.forEach(function(t){h+=entHours(t);if(isOvernight(t.in,t.out))o++;});
    out.push(Object.assign({},r,{n:keep.length,hours:Math.round(h*100)/100,overnight:o,entries:keep}));});
  HELD.hours=Math.round(HELD.hours*100)/100;return out;};
function heldNote(){var HELD=window.or2Held();if(!owner()||!HELD.n)return '';return '<div class="alert warn small" id="or2held" data-or-raw>'+HELD.n+' shift'+(HELD.n===1?'':'s')+' ('+HELD.hours.toFixed(2)+' h, '+HELD.people+' '+(HELD.people===1?'person':'people')+') are at unknown farms. They are left out of these totals and the export until the office admin matches the farm. Nothing was deleted.</div>';}
if(VIEWS['admin:payroll']){var _pv=VIEWS['admin:payroll'];VIEWS['admin:payroll']=function(){var x=_pv.apply(this,arguments),n=heldNote();if(!n||x.indexOf('id="or2held"')>=0)return x;return x.indexOf('</h1>')>=0?x.replace('</h1>','</h1>'+n):n+x;};}

/* ---------- 3) live farm-code box: ask the server (signed out, the farm list is not loaded) ---------- */
var tmr=null,seq=0;
document.addEventListener('input',function(e){if(!e.target||e.target.id!=='orfarmcode'||!srv())return;var v=normC(e.target.value),my=++seq;clearTimeout(tmr);if(v.length<6)return;
  tmr=setTimeout(async function(){var h=document.getElementById('orfarmhint');if(!h)return;try{var r=await window.REG_SB.rpc('reg_farm_code_check',{p_code:v});if(my!==seq)return;
    var st=r.error?'':r.data;h.textContent=st==='ok'?'Matched: '+v:st?'Code not found – you can still sign up; the office will match you.':'';h.className='hint'+(st==='ok'?' ok':'');}catch(x){}},400);});

/* ---------- 4) invited farm approved by the server: go to Home, not "waiting" ---------- */
function chkPending(){if(!live()||location.hash!=='#/pending'||typeof ME==='undefined'||!ME)return;if(ME.type==='firm'&&ME.accountApproved===true&&ME.loginOf){if(typeof toast==='function')toast('Welcome! Your invite was accepted – your account is ready.');go('#/home');}}
window.or2ChkPending=chkPending;window.addEventListener('hashchange',function(){setTimeout(chkPending,50);});
})();
