/* v2-cjinvowner.js – owner decision (Fri Oct 9 2026, 2:18 PM): CJ client invoices are visible ONLY to the owner and that client's own login
   (same rule as UnScramble's 016v / v2-invowner.js). Every other office login (CJ admin, ops, billing, supervisor) gets a calm
   "Client invoices are visible to the owner only." Creating, adjusting, marking paid, uploading or deleting invoices: owner only.
   The database enforces it (cj-invowner-005.sql): non-owner office logins receive no CJ invoices, no invoice outbox lines and no invoice
   audit lines at all; this file only hides the menus, cards, buttons and pages that would otherwise look empty or broken.
   Live: owner = office login whose roles include 'owner'. Test copy (mock): the 'office' login has no roles → treated as the owner;
   test logins 'officeadmin' (admin) and 'billing' (billing) are added (password as 'office') so the rule can be tried.
   Loaded LAST (after v2-cjmonthly.js) so it wraps the monthly invoice form and the Adjust button too. TEST COPY ONLY. */
(function(){
var MSG='Client invoices are visible to the owner only.';
function live(){return !!window.REG_LIVE;}
function roles(){return (ME&&ME.officeRoles)||(ME&&ME.officeRole?[ME.officeRole]:[]);}
function ivOwner(){if(typeof ME==='undefined'||!ME||ME.type!=='admin')return false;var r=roles();if(r.indexOf('owner')>=0)return true;return !live()&&!r.length;}
function ivBlocked(){return typeof ME!=='undefined'&&!!ME&&ME.type==='admin'&&!ivOwner();}
window.ivOwner=ivOwner;window.ivBlocked=ivBlocked;window.IV_MSG=MSG;
function calm(extra){return '<div class="card iv-calm" id="ivcalm"><p><b>'+MSG+'</b></p>'+(extra?'<p class="small muted">'+extra+'</p>':'')+'</div>';}
function deny(){toast(MSG);}

/* ---------- mock only: emulate the database (non-owner office receives no CJ invoices); saving keeps the real list ---------- */
/* billed special jobs: the database gives non-owner office only 'billed' (005 section 5); the mock keeps the numbers aside the same way */
function sjMask(){var m=DB.__sjReal;if(!m){m={};Object.defineProperty(DB,'__sjReal',{value:m,writable:true,configurable:true,enumerable:false});}
  (DB.cleanRequests||[]).forEach(function(r){if(r.special&&r.billedInv&&r.billedInv!=='billed'){m[r.id]=r.billedInv;r.billedInv='billed';}});}
function sjUnmask(){var m=DB.__sjReal;if(!m)return;(DB.cleanRequests||[]).forEach(function(r){if(r.billedInv==='billed'&&m[r.id])r.billedInv=m[r.id];});}
function mask(){if(live()||typeof DB==='undefined'||!DB)return;var real=DB.__ivReal;
  if(ivBlocked()){if(!real){Object.defineProperty(DB,'__ivReal',{value:DB.clientInvoices||[],writable:true,configurable:true,enumerable:false});real=DB.__ivReal;}
    /* extrainv: admin/ops may see extra-work invoices only; monthly invoices stay owner-only */
    DB.clientInvoices=(typeof cjxCan==='function'&&cjxCan())?real.filter(function(i){return i&&i.extraWork;}):[];sjMask();}
  else{if(real){DB.clientInvoices=real;delete DB.__ivReal;}if(DB.__sjReal){sjUnmask();delete DB.__sjReal;}}}
function seed(){if(live()||typeof DB==='undefined'||!DB||!DB.users)return;var off=DB.users.filter(function(u){return u.username==='office';})[0];if(!off)return;var add=0;
  [['u_ivadmin','officeadmin','Olive Admin','admin'],['u_ivbill','billing','Bill Ing','billing']].forEach(function(a){if(DB.users.some(function(u){return u.id===a[0]||u.username===a[1];}))return;
    DB.users.push({id:a[0],type:'admin',officeRole:a[3],officeRoles:[a[3]],name:a[2],username:a[1],email:a[1]+'@example.com',passHash:off.passHash,active:true,approved:true,accountApproved:true,
      createdAt:new Date().toISOString(),profile:{},roles:[],orientations:[]});add++;});
  if(add){var r=DB.__ivReal;if(r)DB.clientInvoices=r;save0();if(r)DB.clientInvoices=[];}}
var save0=save;
save=function(){if(live()||typeof DB==='undefined'||!DB||!DB.__ivReal)return save0.apply(this,arguments);var m=DB.clientInvoices,real=DB.__ivReal;
  DB.clientInvoices=real;sjUnmask();try{return save0.apply(this,arguments);}finally{DB.clientInvoices=m;sjMask();}};
var rn=render;render=function(){try{seed();mask();}catch(e){}return rn.apply(this,arguments);};
if(typeof gateRoute==='function'){var gr=gateRoute;gateRoute=function(){try{seed();mask();}catch(e){}return gr.apply(this,arguments);};}
try{seed();}catch(e){}

/* ---------- data helpers ---------- */
if(typeof clientInvs==='function'){var ci=clientInvs;clientInvs=function(){return ivBlocked()?[]:ci.apply(this,arguments);};}
if(typeof clientInvoicesHtml==='function'){var ch=clientInvoicesHtml;clientInvoicesHtml=function(firm,office){return ivBlocked()?'<div class="card" id="clientinvs"><h2>Client invoices</h2><p>'+MSG+'</p></div>':ch.apply(this,arguments);};}
if(typeof pastCanUpload==='function'){var pc=pastCanUpload;pastCanUpload=function(){return ivBlocked()?false:pc.apply(this,arguments);};}
/* "already invoiced" warnings for non-owner office: live reads only the invoiced periods (no number, amount or file) */
var PER=null,PERAT=0;
function periods(){if(!live()||!window.REG_SB)return [];if(!PER||Date.now()-PERAT>120000){PERAT=Date.now();try{window.REG_SB.rpc('reg_cj_invoice_periods').then(function(r){if(r&&!r.error&&Array.isArray(r.data))PER=r.data;}).catch(function(){});}catch(e){}}return PER||[];}
if(typeof mtInvoiced==='function'){var mi=mtInvoiced;mtInvoiced=function(site,date){if(!ivBlocked())return mi.apply(this,arguments);var f=typeof firmOfSite==='function'?firmOfSite(site):null;if(!f)return null;
  var src=!live()?(DB.__ivReal||[]):((DB.clientInvoices||[]).length?DB.clientInvoices:periods());
  var p=src.filter(function(i){return i.firmId===f.id&&i.periodStart&&i.periodStart<=date&&date<=(i.periodEnd||i.periodStart);})[0];
  return p?{id:'',number:'(owner only)',periodStart:p.periodStart,periodEnd:p.periodEnd||p.periodStart,ivPeriod:true}:null;};}

/* ---------- actions and forms: refused for non-owner office (incl. the CJ monthly invoice + Adjust) ---------- */
['clientinvpaid','civview','civpdf','civprint','pastinvdel','pastinvdelok','pastinvedit','vsinvok','scinvgo','scinvadj','scadjgo','scinvok','cjmadj'].forEach(function(k){
  var o=ACT[k];if(typeof o!=='function')return;ACT[k]=function(){if(ivBlocked()){
    if((k==='civview'||k==='civpdf'||k==='civprint')&&typeof cjxCan==='function'&&cjxCan()){var el=arguments[0],id=el&&el.dataset&&el.dataset.id,inv=id&&typeof invById==='function'?invById(id):null;if(inv&&inv.extraWork)return o.apply(this,arguments);}
    deny();return;}return o.apply(this,arguments);};});
['clientinv','pastinv','cjmadj'].forEach(function(k){var o=FORMS[k];if(typeof o!=='function')return;FORMS[k]=function(){if(ivBlocked()){deny();return;}return o.apply(this,arguments);};});

/* outbox + audit log: the database hides invoice texts from non-owner CJ office (005 reg_cjiv_outbox_ok / reg_cjiv_audit_ok,
   same matchers as 016v); the mock shows the same by filtering while those two pages are drawn (stored data untouched) */
var RX_T=/^\s*(new invoice|credit note|extra invoice)\s|client invoice|farm invoice|past invoice|uploaded invoice/i,
    RX_A=/client invoice|past invoice|uploaded invoice|invoice number adjusted|removed hours on invoice|credit note|extra invoice/i;
function during(key,keep,fn){if(live()||!ivBlocked()||!Array.isArray(DB[key]))return fn();var o=DB[key];DB[key]=o.filter(keep);try{return fn();}finally{DB[key]=o;}}
if(VIEWS['admin:alerts']){var oal=VIEWS['admin:alerts'];VIEWS['admin:alerts']=function(){var a=arguments,t=this;return during('notes',function(n){return n.to===ME.id||!RX_T.test(String(n.text||''));},function(){return oal.apply(t,a);});};}
if(VIEWS['admin:auditlog']){var oau=VIEWS['admin:auditlog'];VIEWS['admin:auditlog']=function(){var a=arguments,t=this;return during('audit',function(x){return !RX_A.test(String(x.action||''));},function(){return oau.apply(t,a);});};}

/* ---------- pages ---------- */
function strip(x,ids){try{var t=document.createElement('template');t.innerHTML=x;var n=0;ids.forEach(function(id){var e=t.content.getElementById?t.content.getElementById(id):t.content.querySelector('#'+id);if(e){e.parentNode.removeChild(e);n++;}});return n?t.innerHTML:x;}catch(e){return x;}}
if(VIEWS['admin:home']){var oh=VIEWS['admin:home'];VIEWS['admin:home']=function(){var x=oh.apply(this,arguments);return ivBlocked()?strip(x,['oiTOwing','oiCliInv']):x;};}
if(VIEWS['admin:invoicesadmin']){var oi=VIEWS['admin:invoicesadmin'];VIEWS['admin:invoicesadmin']=function(){if(!ivBlocked())return oi.apply(this,arguments);
  var x=strip(oi.apply(this,arguments),['oiCliInv','clientpastinvh','clientinvoices']);var c=calm('Subcontractor invoices are below as before. The monthly client invoice is made by the owner.');
  return x.indexOf('</h1>')>=0?x.replace('</h1>','</h1>'+c):c+x;};}
/* "Create monthly invoice" buttons / forms on other office pages (Clients & sites): hidden for non-owner office */
function noCreate(){if(!ivBlocked())return;var app=document.getElementById('app')||document.body;
  Array.prototype.forEach.call(app.querySelectorAll('form[data-form="clientinv"],form[data-form="pastinv"],[data-act="cjmadj"],[data-act="clientinvpaid"]'),function(e){e.remove();});}
if(typeof afterRender==='function'){var ar=afterRender;afterRender=function(){var r=ar.apply(this,arguments);try{noCreate();}catch(e){}return r;};}
})();
