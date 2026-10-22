/* subinv1 (Oct 21 2026) – a subcontractor's invoice submit must really save.
   Since migration 016 the server (trigger a1_guard -> reg_guard('money', ...)) lets ONLY the office set the money fields of
   reg_sub_invoices. The old submit always sent holdback / holdbackPct / setoff (and heldTemp / heldWorkers during a pass),
   so the server refused every real sub invoice while the screen said "Invoice submitted.".
   Now:
   - the sub sends none of the office-only fields; the holdback shown to the sub is an ESTIMATE (holdbackEst / holdbackPctEst),
     and a pass at submit time is noted as passAtSubmit (both are plain, unguarded notes);
   - the office sets the real holdback and set-off when it reviews (Holdback / set-off, or Approve fills them from the estimate);
   - "Invoice submitted." shows only after the server accepted the row; otherwise a clear "NOT submitted" box. */
(function(){
var MONEY=['paidDate','paidRef','officeHold','holdback','holdbackPct','holdbackReleased','setoff','heldTemp','heldWorkers','reviewed','disputed'];
var LIVE=function(){return typeof window.REG_SAVE_ROW==='function';};
var r2=function(n){return Math.round(n*100)/100;};
function hasReal(i){return i.holdback!=null||i.holdbackPct!=null;}
function estOf(i){return {pct:i.holdbackPctEst||0,amt:i.holdbackEst||0};}
window.SUBINV_MONEY=MONEY;

/* ---- the sub's review screen and invoice view: estimated holdback until the office sets it ---- */
var oDetail=invoiceDetail;
invoiceDetail=function(i){
  var pend=i===PAGE_STATE.pendingInv&&!i.test&&i.holdback!=null;   // the sub's review screen before submit
  if(!pend&&(hasReal(i)||!i.holdbackEst))return oDetail(i);
  var e=pend?{pct:i.holdbackPct||0,amt:i.holdback||0}:estOf(i),c=Object.assign({},i,{holdback:e.amt,holdbackPct:e.pct});
  var x=oDetail(c);
  x=x.replace(/<tr><td>Holdback([^<]*)<\/td>/,'<tr><td>Estimated holdback$1 <span class="pill s-warn" id="hbest">estimate</span></td>').replace('<tr><th>Net payment</th>','<tr><th>Estimated net payment</th>');
  return x+'<p class="small muted" id="hbestnote">Holdback shown is an estimate ('+e.pct+'% of the amount). The office sets the final holdback and any set-off when it reviews your invoice.</p>';};

/* holdback card + pay holds read the estimate / pass note until the office sets the real fields */
holdbackSummary=(function(o){return function(s){var h=o(s);var est=h.invoices.filter(function(i){return !hasReal(i)&&i.holdbackEst;}).reduce(function(a,i){return a+i.holdbackEst;},0);if(est){h.held=r2(h.held+est);h.estimated=r2(est);}return h;};})(holdbackSummary);
function passHeld(i){return i.heldTemp||(i.heldTemp==null&&i.passAtSubmit&&!i.test);}
var oHeld=invoiceHeld;invoiceHeld=function(i){if(i.heldTemp==null&&i.passAtSubmit&&!i.test&&i.status!=='Paid'&&!i.officeHold){var s=user(i.subId);if(!s)return false;if(!companyCompliant(s))return true;return (i.passAtSubmit.workers||[]).some(function(id){var w=user(id);return w&&!workerDocsComplete(w);});}return oHeld(i);};
heldInvoices=function(s){return DB.invoices.filter(function(i){return i.subId===s.id&&!i.test&&(passHeld(i)||i.officeHold)&&i.status!=='Paid';});};

/* ---- the sub's submit ---- */
var SENDING=false;
ACT.invsubmit=async function(){var inv=PAGE_STATE.pendingInv;if(!inv||SENDING)return;SENDING=true;try{
  var test=!!inv.test;
  // the estimate the sub saw stays as a note; the office-only money fields are never sent by the sub
  if(!test&&inv.holdback!=null){inv.holdbackEst=inv.holdback;inv.holdbackPctEst=inv.holdbackPct;}
  if(!test){var pw=users('worker').filter(function(w){return w.subId===ME.id&&tempActive(w);}).map(function(w){return w.id;});if(tempActive(ME)||pw.length)inv.passAtSubmit={sub:!!tempActive(ME),workers:pw,at:new Date().toISOString()};}
  MONEY.forEach(function(k){delete inv[k];});
  inv.submittedAt=today();inv.due=test?'':(DB.settings.paymentTerms==='net30_submit'||SA().paymentTerms==='net30_receipt'?addDays(today(),30):'');
  inv.history=(inv.history||[]).concat([{at:new Date().toISOString(),what:'Submitted',by:ME.name}]);
  DB.invoices.push(inv);
  if(LIVE()){
    var b=document.querySelector('[data-act=invsubmit]');if(b){b.disabled=true;b.textContent='Submitting…';}
    (window.REG_QUIET_FAIL=window.REG_QUIET_FAIL||{})['invoices|'+inv.id]=1;
    var st=await window.REG_SAVE_ROW('invoices',inv.id);
    if(st!=='saved'){
      DB.invoices=DB.invoices.filter(function(x){return x!==inv;});
      var why=(st&&st.error)?(window.REG_FRIENDLY?window.REG_FRIENDLY(st.error):(st.error.message||'refused')):'not saved';
      try{console.error('[subinv1] invoice submit refused',st);}catch(e){}
      modal('<h2>Invoice NOT submitted</h2><div class="alert danger" id="invsubfail"><p><b>The server did not accept invoice '+esc(inv.number)+'. Nothing was sent to the office.</b></p><p>'+esc(why)+'</p><p class="small">Please try again. If it happens again, tell the office the message above.</p></div><div class="row-end"><button type="button" data-act="closeModal">OK</button></div>');
      PAGE_STATE.pendingInv=null;render();return;}
  }
  DB.events.push({u:ME.id,role:ME.type,test:test,type:'invoice_submit',ms:Date.now()-(PAGE_STATE.invStart||Date.now()),screen:'#/invoices',at:new Date().toISOString(),d:today()});
  audit('Submitted '+(test?'TEST ':'')+'invoice',ME.name,inv.number+' '+money(inv.total));
  if(!test)notify('admin','Invoice '+inv.number+' submitted by '+inv.legalName+': '+money(inv.total)+(inv.detailsChanged?' (business details changed – review)':'')+' – set the holdback when you review it.');
  PAGE_STATE.pendingInv=null;save();closeModal();toast('Invoice submitted.');render();}finally{SENDING=false;}};

/* ---- office review: the real holdback / set-off ---- */
function officeFill(i,why){if(i.test||hasReal(i))return;var a=SA(),pct=(i.holdbackPctEst!=null?i.holdbackPctEst:a.holdbackPct)||0;
  i.holdbackPct=pct;i.holdback=r2(i.subtotal*pct/100);if(i.setoff==null)i.setoff=0;
  if(i.passAtSubmit&&i.heldTemp==null){i.heldTemp=true;i.heldWorkers=(i.passAtSubmit.workers||[]).slice();}
  i.history.push({at:new Date().toISOString(),what:'Holdback set by office '+money(i.holdback)+' ('+pct+'%)'+(why?' – '+why:''),by:ME.name});}
var oAct=ACT.invact;ACT.invact=function(el){var i=DB.invoices.filter(function(x){return x.id===el.dataset.id;})[0];
  if(!i||i.test||hasReal(i))return oAct(el);
  if(el.dataset.a==='approve'){officeFill(i,'on approval');return oAct(el);}
  if(el.dataset.a==='hold'){var e=estOf(i);i.holdback=e.amt;i.setoff=0;try{oAct(el);}finally{delete i.holdback;delete i.setoff;}
    var m=document.querySelector('#modal form[data-form=invact]');if(m)m.insertAdjacentHTML('afterbegin','<p class="small" id="hbofficeest">The subcontractor saw an <b>estimated</b> holdback of '+money(e.amt)+' ('+e.pct+'%). Enter the real holdback and set-off.</p>');return;}
  if(el.dataset.a==='paid'){officeFill(i,'before payment');}
  return oAct(el);};
var oForm=FORMS.invact;FORMS.invact=function(f,d){var i=DB.invoices.filter(function(x){return x.id===d.id;})[0];
  if(i&&d.a==='hold'){if(i.passAtSubmit&&i.heldTemp==null){i.heldTemp=true;i.heldWorkers=(i.passAtSubmit.workers||[]).slice();}i.holdbackPct=i.subtotal?r2((Number(d.holdback)||0)/i.subtotal*100):0;}
  return oForm(f,d);};
/* office list: show the estimate until the real holdback is set */
var oList=VIEWS['admin:invoicesadmin'];VIEWS['admin:invoicesadmin']=function(){var x=oList();
  DB.invoices.forEach(function(i){if(i.test||hasReal(i)||!i.holdbackEst)return;var a='data-act="showinv" data-id="'+esc(i.id)+'">'+esc(i.number)+'</a>';x=x.replace(a,a+' <span class="pill s-warn">holdback to set (est. '+money(i.holdbackEst)+')</span>');});
  return x;};
})();
