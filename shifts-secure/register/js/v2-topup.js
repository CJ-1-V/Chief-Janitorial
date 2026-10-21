/* v2-topup.js – invmonth1 (owner Oct 20 2026, 10:51 / 10:53 PM). TEST COPY. Owner only (same rule as all farm invoices).
   A. SECOND INVOICE FOR A MONTH THAT ALREADY HAS ONE ("Create monthly invoice" or the month's "Create invoice").
      - Earlier invoice(s) for that month all PAID → a TOP-UP invoice: the full recalculated period (per-job rows as today), then
        "Less: previously invoiced and paid, Invoice <no> (<date>)" (before HST), Subtotal = the difference, HST on the difference,
        AMOUNT DUE NOW. Negative = a CREDIT (shown as "CREDIT DUE", flagged). Stored: amount/hst/total = due now (so totals, owing and
        Mark paid never double-bill); inv.topup = {fullAmount, fullHst, fullTotal, less:[…]}; inv.adjOf = the last paid one (so
        "Hours changed since this invoice" sees the period as billed).
      - An earlier invoice still UNPAID → no top-up (would double-bill). Choose: Revise it (existing revise flow) or Replace it
        (a new full invoice is made; the old one is soft-deleted as "Replaced by <no>", restorable like any deleted invoice).
   B. "Marked paid by mistake" on a paid invoice: confirm + optional reason → unpaid again (paid date + interest cleared); a note
      (who, when, reason) is kept in inv.payLog and shown on the invoice. A top-up that deducted it is flagged
      ("deducted invoice is no longer paid") – not changed silently; the owner revises / replaces it.
   Tags: "Top-up" / "Credit" pills on the office rows and the farm's cards. Schema: 023c (guards only; data is jsonb). */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof FORMS==='undefined'||typeof FORMS.clientinv!=='function')return;
function E(s){return esc(s==null?'':String(s));}
function R2(x){return Math.round((+x||0)*100)/100;}
function owner(){return typeof window.ivOwner==='function'?!!window.ivOwner():!!(ME&&ME.type==='admin');}
function mEnd(m){return addDays(isoLocal(new Date(+m.slice(0,4),+m.slice(5,7),1)),-1);}
function inPeriod(firm,from,to){return (DB.clientInvoices||[]).filter(function(i){return i.firmId===firm.id&&!i.deleted&&i.revStatus!=='withdrawn'&&!i.uploaded&&i.periodStart===from;});}  /* same calendar period only (the month invoice and its top-ups); other periods are not deducted */
function byId(id){return (DB.clientInvoices||[]).filter(function(x){return x.id===id;})[0]||null;}
function full(i){return {amount:i.topup?i.topup.fullAmount:i.amount,hst:i.topup?i.topup.fullHst:i.hst,total:i.topup?i.topup.fullTotal:i.total};}
/* what was already billed and paid for the period = the last paid invoice's FULL period value (a top-up already carries the earlier ones) */
function paidBase(prev){var p=prev.filter(function(i){return i.paidAt;}).sort(function(a,b){return String(a.issued||'').localeCompare(String(b.issued||''))||String(a.number).localeCompare(String(b.number));});
  var amt=0,hst=0,list=[];p.forEach(function(i){var a=+i.amount||0,h=+i.hst||0;amt+=a;hst+=h;list.push({id:i.id,number:i.number,issued:i.issued,paidAt:i.paidAt,amount:R2(a),hst:R2(h),total:R2(a+h)});});return {amt:R2(amt),hst:R2(hst),list:list,last:p[p.length-1]||null};}
function calc(firm,m){var from=m+'-01',to=mEnd(m),prev=inPeriod(firm,from,to),R=firmReport(firm,from,to),B=paidBase(prev),amount=R2(R.tot.amount-B.amt),hst=R2(R.tot.hst-B.hst);
  return {from:from,to:to,prev:prev,unpaid:prev.filter(function(i){return !i.paidAt;}),R:R,B:B,amount:amount,hst:hst,total:R2(amount+hst)};}
function withHidden(firm,from,to,fn){var o=clientInvs;clientInvs=function(f){return o(f).filter(function(i){return !(f&&f.id===firm.id&&i.periodStart===from);});};try{return fn();}finally{clientInvs=o;}}
function makeBase(firm,m){var n=(DB.clientInvoices||[]).length,C=calc(firm,m);withHidden(firm,C.from,C.to,function(){FORMS.clientinv(null,{firmId:firm.id,month:m,confirmed:'1',tuGo:'1'});});var L=DB.clientInvoices||[];return L.length>n?L[L.length-1]:null;}
var oci=FORMS.clientinv;
FORMS.clientinv=function(f,d){d=d||{};if(d.tuGo)return oci.apply(this,arguments);var firm=user(d.firmId);
  if(!firm||!/^\d{4}-\d{2}$/.test(d.month||''))return oci.apply(this,arguments);var C=calc(firm,d.month);if(!C.prev.length)return oci.apply(this,arguments);
  if(!owner()){toast(window.IV_MSG||'Farm invoices are visible to the owner only.');return;}
  var head='<h2>'+E(firm.name)+' · '+E(C.from)+' to '+E(C.to)+' already has '+(C.prev.length===1?'an invoice':C.prev.length+' invoices')+'</h2><div class="tw"><table class="no-stack" id="tuprev"><tr><th>Invoice</th><th>Issued</th><th style="text-align:right">Total</th><th>Status</th></tr>'+
    C.prev.map(function(i){return '<tr><td>'+E(i.number)+(i.topup?' <span class="pill s-temp">Top-up</span>':'')+'</td><td>'+E(i.issued)+'</td><td style="text-align:right">'+money(i.total)+'</td><td>'+(i.paidAt?'<span class="pill s-ok">Paid '+E(i.paidAt)+'</span>':'<span class="pill s-pend">Not paid</span>')+'</td></tr>';}).join('')+'</table></div>';
  if(C.unpaid.length){var u=C.unpaid[C.unpaid.length-1];
    modal(head+'<p id="tuunpaidmsg"><b>Invoice '+E(u.number)+' is not paid yet.</b> A second invoice now would bill the same hours twice. Choose one:</p>'+
      '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button>'+(ACT.irrev?'<button type="button" class="sec" data-act="tureviseit" data-id="'+E(u.id)+'">Revise '+E(u.number)+'</button>':'')+
      '<button type="button" data-act="tureplace" data-id="'+E(u.id)+'" data-f="'+E(firm.id)+'" data-m="'+E(d.month)+'" id="tureplace">Replace '+E(u.number)+' with a new invoice</button></div>'+
      '<p class="small">Replace: a new invoice for the whole month is made from the hours now, and '+E(u.number)+' is deleted as "Replaced by …" (it stays in Deleted invoices and can be restored).</p>');return;}
  var cr=C.total<0,zero=Math.abs(C.total)<0.005;
  modal(head+'<h3>Top-up invoice</h3><div class="tw"><table class="no-stack" id="tucalc">'+
    '<tr><td>Recalculated for the month (all hours now, incl. waiting approval and unassigned)</td><td style="text-align:right">'+money(C.R.tot.amount)+'</td><td style="text-align:right" class="small">HST '+money(C.R.tot.hst)+'</td></tr>'+
    C.B.list.map(function(l){return '<tr><td>Less: previously invoiced and paid, Invoice '+E(l.number)+' ('+E(l.issued)+')</td><td style="text-align:right">−'+money(l.amount)+'</td><td style="text-align:right" class="small">HST −'+money(l.hst)+'</td></tr>';}).join('')+
    '<tr><th>Difference</th><th style="text-align:right">'+money(C.amount)+'</th><th style="text-align:right" class="small">HST '+money(C.hst)+'</th></tr>'+
    '<tr><th>'+(cr?'Credit due to the farm':'Amount due now')+'</th><th style="text-align:right" id="tudue">'+money(C.total)+'</th><th></th></tr></table></div>'+
    (cr?'<p class="alert warn" id="tucredit"><b>This is a credit.</b> The hours went down since '+E(C.B.last.number)+' was paid. The farm will see a credit invoice.</p>':'')+
    (zero?'<p id="tuzero"><b>Nothing to bill:</b> the hours for this month still match what was invoiced and paid.</p>':'')+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button>'+(zero?'':'<button type="button" data-act="tugo" data-f="'+E(firm.id)+'" data-m="'+E(d.month)+'" id="tugo">'+(cr?'Create credit invoice':'Create top-up invoice')+'</button>')+'</div>');};
ACT.tureviseit=function(el){closeModal();ACT.irrev({dataset:{id:el.dataset.id}});};
ACT.tugo=function(el){if(!owner())return;var firm=user(el.dataset.f),m=el.dataset.m;if(!firm)return;var C=calc(firm,m);if(C.unpaid.length||Math.abs(C.total)<0.005){closeModal();toast('Nothing to create.');return;}
  closeModal();var inv=makeBase(firm,m);if(!inv){toast('The invoice was not created.');return;}
  inv.topup={fullAmount:inv.amount,fullHst:inv.hst,fullTotal:inv.total,less:C.B.list,at:new Date().toISOString(),by:ME.name};
  inv.amount=R2(inv.amount-C.B.amt);inv.hst=R2(inv.hst-C.B.hst);inv.total=R2(inv.amount+inv.hst);inv.credit=inv.total<0;if(inv.credit)inv.interestPct=0;inv.adjOf=C.B.last.id;inv.billHours=inv.billHours;
  try{if(window.scInvFlags)scInvFlags().forEach(function(x){if(C.prev.some(function(p){return p.id===x.inv.id;}))x.inv.scReviewed=x.sig;});}catch(e){}  /* the top-up settles the "hours changed" flag of the earlier invoice */
  audit(inv.credit?'Created credit invoice':'Created top-up invoice',firm.name,inv.number+' '+money(inv.total)+' (period '+money(inv.topup.fullTotal)+' less paid '+C.B.list.map(function(l){return l.number;}).join(', ')+')');
  try{var nt=DB.notes&&DB.notes[0];if(nt&&nt.to===firm.id&&/^New invoice/.test(nt.text))nt.text=(inv.credit?'Credit invoice ':'Top-up invoice ')+inv.number+' for '+C.from+' – '+C.to+': '+(inv.credit?'credit ':'due now ')+money(Math.abs(inv.total))+' (after '+C.B.list.map(function(l){return l.number;}).join(', ')+', already paid).';}catch(e){}
  save();toast((inv.credit?'Credit':'Top-up')+' invoice '+inv.number+' created.');render();};
ACT.tureplace=function(el){if(!owner())return;var old=byId(el.dataset.id),firm=user(el.dataset.f),m=el.dataset.m;if(!old||!firm||old.paidAt){toast('Can\'t replace this invoice.');return;}
  if(typeof window.idCheck==='function'){var c=window.idCheck(old);if(c&&c.why){toast(c.why);return;}}
  closeModal();var inv=makeBase(firm,m);if(!inv){toast('The new invoice was not created.');return;}
  var at=new Date().toISOString();old.deleted=true;old.deletedAt=at;old.deletedBy=ME.name;old.deletedById=ME.id;old.deleteReason='Replaced by '+inv.number;old.delGroup=uid('dg');old.supersededBy=inv.number;inv.replaces=old.number;
  DB.clientInvoices=(DB.clientInvoices||[]).filter(function(x){return x.id!==old.id;});(DB.clientInvoicesDel=DB.clientInvoicesDel||[]).push(old);
  audit('Replaced farm invoice',firm.name,old.number+' → '+inv.number+' '+money(inv.total));notify(firm.id,'Invoice '+old.number+' was replaced by '+inv.number+' ('+money(inv.total)+'). Please use '+inv.number+'.');save();toast(old.number+' replaced by '+inv.number+'.');render();};
/* ---------- B. marked paid by mistake ---------- */
function topupsUsing(i){return (DB.clientInvoices||[]).filter(function(t){return t.topup&&(t.topup.less||[]).some(function(l){return l.id===i.id;});});}
ACT.tuunpay=function(el){if(!owner()){toast('Owner only.');return;}var i=byId(el.dataset.id);if(!i||!i.paidAt)return;var T=topupsUsing(i);
  modal('<h2>Marked paid by mistake?</h2><p>Invoice <b>'+E(i.number)+'</b> is marked paid on '+E(i.paidAt)+'. This sets it back to <b>not paid</b> and clears the paid date'+(i.interestCharged?' and the interest charged ('+money(i.interestCharged)+')':'')+'. A note is kept on the invoice.</p>'+
    (T.length?'<p class="alert warn" id="tuunpaywarn"><b>Careful:</b> top-up invoice '+T.map(function(t){return E(t.number);}).join(', ')+' deducted '+E(i.number)+' as "previously paid". It will be flagged so you can revise or replace it – the farm must not be billed twice.</p>':'')+
    '<form data-form="tuunpay" id="tuunpayf"><input type="hidden" name="id" value="'+E(i.id)+'"><input name="why" placeholder="Reason (optional)" aria-label="Reason (optional)"><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button id="tuunpaygo">Set back to not paid</button></div></form>');};
FORMS.tuunpay=function(f,d){if(!owner())return;var i=byId(d.id);if(!i||!i.paidAt)return;var at=new Date().toISOString(),why=String(d.why||'').trim();
  (i.payLog=i.payLog||[]).push({what:'Marked paid by mistake – set back to not paid',at:at,by:ME.name,byId:ME.id,reason:why,wasPaidAt:i.paidAt,wasInterest:i.interestCharged||0});
  i.paidAt='';delete i.interestCharged;delete i.paidAmount;
  var T=topupsUsing(i);T.forEach(function(t){t.topup.stale={at:at,number:i.number,id:i.id};});
  audit('Invoice set back to not paid (marked paid by mistake)',(user(i.firmId)||{}).name||'',i.number+(why?' · '+why:'')+(T.length?' · flagged top-up '+T.map(function(t){return t.number;}).join(', '):''));
  save();closeModal();toast(i.number+' is not paid again.'+(T.length?' Top-up '+T.map(function(t){return t.number;}).join(', ')+' is flagged.':''));render();};
/* ---------- invoice document: deduction rows, HST on the difference, credit, history ---------- */
if(typeof window.invtData==='function'){var otd=window.invtData;window.invtData=invtData=function(i){if(!i||!i.topup)return otd.apply(this,arguments);
  var c=Object.assign({},i,{amount:i.topup.fullAmount,hst:i.topup.fullHst,total:i.topup.fullTotal}),D=otd.call(this,c);
  (i.topup.less||[]).forEach(function(l){D.lines.push({d:'Less: previously invoiced and paid, Invoice '+l.number+' ('+invtDate(l.issued)+')',s:'Paid '+invtDate(l.paidAt)+' · before HST (HST on it: '+invtMoney(l.hst)+')',a:-l.amount,less:1});});
  D.lines.unshift({d:'Recalculated total for the period (before HST): '+invtMoney(i.topup.fullAmount),s:'All hours now, per job below. This top-up bills only the difference.',a:null,note:1});
  D.subtotal=+i.amount||0;D.hst=+i.hst||0;D.total=+i.total||0;D.hstLabel=D.hstLabel.replace(/^GST\/HST/,'GST/HST on the difference');D.topup=1;D.credit=D.total<0;return D;};}
if(typeof window.invtHtml==='function'){var oth=window.invtHtml;window.invtHtml=invtHtml=function(i){var x=oth.apply(this,arguments);if(!i)return x;
  if(i.topup){x=x.replace(/<td class="a">([^<]*)<\/td><\/tr>/g,function(a,v){return a;}).replace(/(<span class="l">)TOTAL(<\/span>)/,'$1'+(i.total<0?'CREDIT DUE TO YOU':'AMOUNT DUE NOW')+'$2');
    x=x.replace('<div class="ui-band"></div>','<div class="ui-band"></div><div class="tu-tag'+(i.total<0?' tu-cr':'')+'">'+(i.total<0?'CREDIT INVOICE':'TOP-UP INVOICE')+' · '+E(i.periodStart)+' – '+E(i.periodEnd)+'</div>');
    if(i.topup.stale&&ME&&ME.type==='admin')x='<div class="alert warn tu-stale" id="tustale"><b>Check this top-up:</b> it deducted '+E(i.topup.stale.number)+' as paid, but '+E(i.topup.stale.number)+' was set back to not paid on '+E(String(i.topup.stale.at).slice(0,10))+'. Revise or replace it so the farm is not billed twice.</div>'+x;}
  if(i.supersededBy)x='<div class="alert warn">Replaced by '+E(i.supersededBy)+'.</div>'+x;
  if(i.payLog&&i.payLog.length)x+='<div class="tu-hist" id="tuhist"><b>Invoice history</b>'+i.payLog.map(function(h){return '<div class="small">'+E(String(h.at).slice(0,16).replace('T',' '))+' · '+E(h.what)+(ME&&ME.type==='admin'?' · by '+E(h.by):'')+(h.reason?' · “'+E(h.reason)+'”':'')+' (was paid '+E(h.wasPaidAt)+')</div>';}).join('')+'</div>';
  return x;};if(typeof invHtml!=='undefined')invHtml=window.invtHtml;}
/* blank amount cell on the "recalculated total" note row */
var st=document.createElement('style');st.textContent='.usinv .tu-tag{margin:8px 0 0;display:inline-block;background:#fff4e0;color:#8a5a00;border:1px solid #ecd29e;border-radius:8px;padding:3px 10px;font-weight:bold;font-size:12px}.usinv .tu-cr{background:#e9f7ef;color:#1e7a46;border-color:#b5e0c6}.tu-hist{margin:12px auto 0;max-width:660px;padding:8px 12px;border:1px solid #e0ddef;border-radius:8px;background:#faf9fe}.tu-pill{margin-left:4px}';document.head.appendChild(st);
var oim=window.invtMoney;if(typeof oim==='function')window.invtMoney=invtMoney=function(a){return a==null?'':oim.apply(this,arguments);};
/* ---------- tags + the "by mistake" button on the office rows; tags on the farm cards ---------- */
function tagRows(){if(!ME)return;var own=ME.type==='admin'&&owner();
  [].slice.call(document.querySelectorAll('#clientinvtable tr[data-inv]:not([data-tu]),#myinvlist .invcard:not([data-tu])')).forEach(function(r){r.setAttribute('data-tu','1');var no=r.getAttribute('data-inv'),i=(DB.clientInvoices||[]).filter(function(x){return String(x.number)===no&&(ME.type!=='firm'||x.firmId===ME.id);})[0];if(!i)return;
    var tag=i.topup?'<span class="pill '+(i.total<0?'s-ok':'s-temp')+' tu-pill">'+(i.total<0?'Credit':'Top-up')+'</span>'+(i.topup.stale&&own?'<span class="pill s-bad tu-pill">Check: deducted invoice not paid</span>':''):'';
    var cell=r.tagName==='TR'?(r.querySelector('td[data-label="Invoice #"]')||r.cells[1]):r.querySelector('.ih b');if(tag&&cell)cell.insertAdjacentHTML(r.tagName==='TR'?'beforeend':'afterend',tag);
    if(own&&r.tagName==='TR'&&i.paidAt){var last=r.cells[r.cells.length-1];if(last&&!last.querySelector('[data-act=tuunpay]'))last.insertAdjacentHTML('beforeend',' <button class="small sec tu-unpay" data-act="tuunpay" data-id="'+E(i.id)+'">Marked paid by mistake</button>');}});}
new MutationObserver(function(){try{tagRows();}catch(e){}}).observe(document.documentElement,{childList:true,subtree:true});
})();
