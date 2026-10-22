/* v2-revenue.js – revenue1 (owner Oct 21 2026): Farms & clients → per farm / client "Revenue this year" and "Total revenue" buttons,
   plus combined totals for all farms and clients at the top. Revenue = invoices marked PAID (paidAt set). Unpaid, deleted/voided
   (deleted, replaced, withdrawn revisions) and drafts are left out. Uploaded past invoices count. Credit invoices that were paid
   reduce revenue. Year = the PAID date (paidAt, always stored when an invoice is marked paid); only if a paid invoice has no
   paid date the invoice date (issued) is used, and the list says so. This year = Jan 1 to today. Amounts before HST and incl. HST.
   Owner / admin / billing only (uninvCan): never the Office Assistant or a farm. Front end only. Load after v2-uninv.js. */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||!VIEWS['admin:firms'])return;
function can(){return typeof window.uninvCan==='function'&&window.uninvCan();}
function E(s){return typeof esc==='function'?esc(s==null?'':String(s)):String(s==null?'':s);}
function M$(x){return typeof money==='function'?money(+x||0):'$'+(+x||0).toFixed(2);}
function R2(x){return Math.round((+x||0)*100)/100;}
function counts(i){return !!i&&!!i.paidAt&&!i.deleted&&!i.deletedAt&&!i.draft&&i.revStatus!=='withdrawn'&&i.revStatus!=='replaced'&&!i.voided;}
function dateOf(i){return i.paidAt?{d:String(i.paidAt).slice(0,10),by:'paid date'}:{d:String(i.issued||'').slice(0,10),by:'invoice date'};}
function list(fid,year){var T=today();return (DB.clientInvoices||[]).filter(function(i){if(!counts(i)||(fid&&i.firmId!==fid))return false;var d=dateOf(i).d;if(!d||d>T)return false;return !year||d.slice(0,4)===T.slice(0,4);});}
function sum(L){var a=0,t=0;L.forEach(function(i){a+=+i.amount||0;t+=+i.total||0;});return {amt:R2(a),tot:R2(t),n:L.length};}
window.revSum=function(fid,year){return sum(list(fid,year));};
function firms(){return (typeof companyFirms==='function'?companyFirms():users('firm')).filter(function(f){return f&&f.type==='firm';});}
function codes(f){return (DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;}).join(', ');}
function card(){var Y=today().slice(0,4),ty=sum(list(null,true)),all=sum(list(null,false));
  return '<div class="card" id="revcard"><h2 style="margin-top:0">Revenue (paid invoices)</h2>'+
    '<div class="rev-tot"><div><span class="small muted">This year ('+Y+', to today)</span><br><b id="revyear">'+M$(ty.tot)+'</b> <span class="small">incl. HST · '+M$(ty.amt)+' before HST · '+ty.n+' invoices</span></div>'+
    '<div><span class="small muted">Total (all years)</span><br><b id="revall">'+M$(all.tot)+'</b> <span class="small">incl. HST · '+M$(all.amt)+' before HST · '+all.n+' invoices</span></div></div>'+
    '<p class="small muted">Only invoices marked paid. Unpaid, deleted, replaced and draft invoices are left out; uploaded past invoices count. The year is taken from the date the invoice was marked paid.</p>'+
    '<div class="tw"><table id="revtable"><tr><th>Farm / client</th><th>Sites</th><th></th></tr>'+firms().map(function(f){return '<tr data-rev="'+E(f.id)+'"><td>'+E(f.name)+'</td><td>'+E(codes(f))+'</td><td class="rev-btns"><button type="button" class="small sec" data-act="revshow" data-f="'+E(f.id)+'" data-y="1">Revenue this year</button> <button type="button" class="small sec" data-act="revshow" data-f="'+E(f.id)+'" data-y="0">Total revenue</button></td></tr>';}).join('')+'</table></div></div>';}
ACT.revshow=function(el){if(!can()||!el||!el.dataset)return;var f=user(el.dataset.f);if(!f)return;var y=el.dataset.y==='1',L=list(f&&f.id,y).sort(function(a,b){return dateOf(b).d.localeCompare(dateOf(a).d);}),s=sum(L),fb=L.some(function(i){return !i.paidAt;});
  modal('<h2>'+E(f?f.name:'')+' · '+(y?'Revenue this year ('+today().slice(0,4)+', to today)':'Total revenue (all years)')+'</h2><p id="revmsum"><b>'+M$(s.tot)+'</b> incl. HST · '+M$(s.amt)+' before HST · '+s.n+' paid invoice'+(s.n===1?'':'s')+'</p>'+
    (L.length?'<div class="tw"><table class="no-stack"><tr><th>Invoice</th><th>Date used</th><th style="text-align:right">Before HST</th><th style="text-align:right">Total</th></tr>'+L.map(function(i){var d=dateOf(i);return '<tr><td>'+E(i.number)+(i.uploaded?' <span class="pill">Uploaded</span>':'')+(i.credit?' <span class="pill">Credit</span>':'')+'</td><td>'+E(d.d)+' <span class="small muted">('+d.by+')</span></td><td style="text-align:right">'+M$(i.amount)+'</td><td style="text-align:right">'+M$(i.total)+'</td></tr>';}).join('')+'</table></div>':'<p class="muted">No paid invoices'+(y?' this year':'')+'.</p>')+
    '<p class="small muted">Date used: the paid date'+(fb?' (invoice date where no paid date was stored, marked above)':'')+'. Unpaid, deleted, replaced and draft invoices are left out.</p><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Close</button></div>');};
var of=VIEWS['admin:firms'];VIEWS['admin:firms']=function(){var x=of.apply(this,arguments);try{if(!can())return x;var c=card(),h=x.indexOf('</h1>');return h>=0?x.slice(0,h+5)+c+x.slice(h+5):c+x;}catch(e){try{console.warn('[revenue]',e);}catch(z){}return x;}};
if(!document.getElementById('revstyle')){var st=document.createElement('style');st.id='revstyle';st.textContent='.rev-tot{display:flex;gap:24px;flex-wrap:wrap;margin:4px 0 8px}.rev-tot b{font-size:20px}.rev-btns{white-space:nowrap}';document.head.appendChild(st);}
})();
