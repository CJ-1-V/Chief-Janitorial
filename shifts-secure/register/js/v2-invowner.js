/* v2-invowner.js – owner rule (Oct 9 2026): "don't show invoices of farms to anyone except me".
   Farm (client) invoices are shown ONLY to the owner, and each farm still sees its own (#/invoices for the farm login).
   Every other office login (admin, ops, billing, supervisor, Office Assistant) gets a calm "Farm invoices are visible to the owner only."
   The database enforces it (016v_invowner.sql): live non-owner office logins receive no farm invoices at all; this file only hides
   the menus, cards and pages that would otherwise look empty or broken. Subcontractor invoices (subs billing UnScramble) are unchanged.
   Live: owner = office login whose roles include 'owner'. Test copy (mock): the 'office' login has no roles → treated as the owner;
   test logins 'officeadmin' (admin) and 'billing' (billing) are added so the rule can be tried. Load after v2-officehelper.js, before v2-nohome.js. */
(function(){
var MSG='Farm invoices are visible to the owner only.';
function live(){return !!window.REG_LIVE;}
function roles(){return (ME&&ME.officeRoles)||(ME&&ME.officeRole?[ME.officeRole]:[]);}
function ivOwner(){if(typeof ME==='undefined'||!ME||ME.type!=='admin')return false;var r=roles();if(r.indexOf('owner')>=0)return true;return !live()&&!r.length;}
function ivBlocked(){return typeof ME!=='undefined'&&!!ME&&ME.type==='admin'&&!ivOwner();}
window.ivOwner=ivOwner;window.ivBlocked=ivBlocked;window.IV_MSG=MSG;
function calm(extra){return '<div class="card iv-calm" id="ivcalm"><p><b>'+MSG+'</b></p>'+(extra?'<p class="small muted">'+extra+'</p>':'')+'</div>';}
function deny(){toast(MSG);}

/* ---------- mock only: emulate the database (non-owner office receives no farm invoices); saving keeps the real list ---------- */
function mask(){if(live()||typeof DB==='undefined'||!DB)return;var real=DB.__ivReal;
  if(ivBlocked()){if(!real){Object.defineProperty(DB,'__ivReal',{value:DB.clientInvoices||[],writable:true,configurable:true,enumerable:false});DB.clientInvoices=[];}}
  else if(real){DB.clientInvoices=real;delete DB.__ivReal;}}
function seed(){if(live()||typeof DB==='undefined'||!DB||!DB.users)return;var off=DB.users.filter(function(u){return u.username==='office';})[0];if(!off)return;var add=0;
  [['u_ivadmin','officeadmin','Olive Admin','admin'],['u_ivbill','billing','Bill Ing','billing']].forEach(function(a){if(DB.users.some(function(u){return u.id===a[0]||u.username===a[1];}))return;
    DB.users.push({id:a[0],type:'admin',officeRole:a[3],officeRoles:[a[3]],name:a[2],username:a[1],email:a[1]+'@example.com',passHash:off.passHash,active:true,approved:true,accountApproved:true,
      createdAt:new Date().toISOString(),profile:{},roles:[],orientations:[]});add++;});
  if(add){var r=DB.__ivReal;if(r)DB.clientInvoices=r;save0();if(r)DB.clientInvoices=[];}}
var save0=save;
save=function(){if(live()||typeof DB==='undefined'||!DB||!DB.__ivReal)return save0.apply(this,arguments);var m=DB.clientInvoices,real=DB.__ivReal;
  /* anything a blocked login could add here is refused below, so the real list is saved untouched */
  DB.clientInvoices=real;try{return save0.apply(this,arguments);}finally{DB.clientInvoices=m;}};
/* ui.js binds hashchange to the original render, so hook the helpers render() calls by name on every draw */
var rn=render;render=function(){try{seed();mask();}catch(e){}return rn.apply(this,arguments);};
if(typeof gateRoute==='function'){var gr=gateRoute;gateRoute=function(){try{seed();mask();}catch(e){}return gr.apply(this,arguments);};}

/* ---------- data helpers ---------- */
if(typeof clientInvs==='function'){var ci=clientInvs;clientInvs=function(){return ivBlocked()?[]:ci.apply(this,arguments);};}
if(typeof clientInvoicesHtml==='function'){var ch=clientInvoicesHtml;clientInvoicesHtml=function(firm,office){return ivBlocked()?'<div class="card" id="clientinvs"><h2>Client invoices</h2><p>'+MSG+'</p></div>':ch.apply(this,arguments);};}
if(typeof pastCanUpload==='function'){var pc=pastCanUpload;pastCanUpload=function(){return ivBlocked()?false:pc.apply(this,arguments);};}
/* "already invoiced" warnings for non-owner office: live reads only the invoiced periods (no number, amount or file) */
var PER=null,PERAT=0;
function periods(){if(!live()||!window.REG_SB)return [];if(!PER||Date.now()-PERAT>120000){PERAT=Date.now();try{window.REG_SB.rpc('reg_invoice_periods').then(function(r){if(r&&!r.error&&Array.isArray(r.data))PER=r.data;}).catch(function(){});}catch(e){}}return PER||[];}
if(typeof mtInvoiced==='function'){var mi=mtInvoiced;mtInvoiced=function(site,date){if(!ivBlocked())return mi.apply(this,arguments);var f=typeof firmOfSite==='function'?firmOfSite(site):null;if(!f)return null;
  var src=!live()?(DB.__ivReal||[]):((DB.clientInvoices||[]).length?DB.clientInvoices:periods()); /* before 016v live still sends rows; after it, periods only */
  var p=src.filter(function(i){return i.firmId===f.id&&i.periodStart&&i.periodStart<=date&&date<=(i.periodEnd||i.periodStart);})[0];
  return p?{id:'',number:'(owner only)',periodStart:p.periodStart,periodEnd:p.periodEnd||p.periodStart,ivPeriod:true}:null;};}

/* ---------- actions and forms: refused for non-owner office ---------- */
['clientinvpaid','civview','civpdf','civprint','pastinvdel','pastinvdelok','pastinvedit','vsinvok','scinvgo','scinvadj','scadjgo','scinvok'].forEach(function(k){
  var o=ACT[k];if(typeof o!=='function')return;ACT[k]=function(){if(ivBlocked()){deny();return;}return o.apply(this,arguments);};});
['clientinv','pastinv'].forEach(function(k){var o=FORMS[k];if(typeof o!=='function')return;FORMS[k]=function(){if(ivBlocked()){deny();return;}return o.apply(this,arguments);};});

/* outbox + audit log: the database hides farm-invoice texts from non-owner office (016v reg_iv_text / reg_iv_action);
   the mock shows the same by filtering while those two pages are drawn (stored data untouched) */
var RX_T=/^\s*(new invoice|credit note|extra invoice)\s|client invoice|farm invoice|past invoice|uploaded invoice/i,
    RX_A=/client invoice|past invoice|uploaded invoice|invoice number adjusted|removed hours on invoice|credit note|extra invoice/i;
function during(key,keep,fn){if(live()||!ivBlocked()||!Array.isArray(DB[key]))return fn();var o=DB[key];DB[key]=o.filter(keep);try{return fn();}finally{DB[key]=o;}}
if(VIEWS['admin:alerts']){var oal=VIEWS['admin:alerts'];VIEWS['admin:alerts']=function(){var a=arguments,t=this;return during('notes',function(n){return n.to===ME.id||!RX_T.test(String(n.text||''));},function(){return oal.apply(t,a);});};}
if(VIEWS['admin:auditlog']){var oau=VIEWS['admin:auditlog'];VIEWS['admin:auditlog']=function(){var a=arguments,t=this;return during('audit',function(x){return !RX_A.test(String(x.action||''));},function(){return oau.apply(t,a);});};}

/* ---------- pages ---------- */
function strip(x,ids){try{var t=document.createElement('template');t.innerHTML=x;var n=0;ids.forEach(function(id){var e=t.content.getElementById?t.content.getElementById(id):t.content.querySelector('#'+id);if(e){e.parentNode.removeChild(e);n++;}});return n?t.innerHTML:x;}catch(e){return x;}}
if(VIEWS['admin:home']){var oh=VIEWS['admin:home'];VIEWS['admin:home']=function(){var x=oh.apply(this,arguments);return ivBlocked()?strip(x,['oiTOwing','oiCliInv']):x;};}
if(VIEWS['admin:invoicesadmin']){var oi=VIEWS['admin:invoicesadmin'];VIEWS['admin:invoicesadmin']=function(){if(!ivBlocked())return oi.apply(this,arguments);
  if(typeof ohIs==='function'&&ohIs())return '<h1>Invoices</h1>'+calm();
  var x=strip(oi.apply(this,arguments),['oiCliInv','clientpastinvh']);var c=calm('Subcontractor invoices (subs billing UnScramble) are below as before.');
  return x.indexOf('</h1>')>=0?x.replace('</h1>','</h1>'+c):c+x;};}
/* Office Assistant: no "Invoices (status)" menu item any more (the route stays allowed so a direct URL shows the calm message) */
function noLinks(){if(!(ivBlocked()&&typeof ohIs==='function'&&ohIs()))return;var app=document.getElementById('app');if(!app)return;
  Array.prototype.forEach.call(app.querySelectorAll('a[href="#/invoicesadmin"]'),function(a){var li=a.closest('li');(li&&li.querySelectorAll('a').length===1?li:a).remove();});}
if(typeof afterRender==='function'){var ar=afterRender;afterRender=function(){var r=ar.apply(this,arguments);try{noLinks();}catch(e){}return r;};}
})();
