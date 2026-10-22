/* revfilter1 (owner Oct 22 2026): box renamed "Revenue collected", moved to the very top of the page; one searchable picker of farms and clients instead of a row per farm; switched-off / suspended farms in red with a label.
   v2-revenue.js – revenue1 (owner Oct 21 2026): Farms & clients → per farm / client "Revenue this year" and "Total revenue" buttons,
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
function stOf(f){return !f?'':f.active===false?'off':f.suspended?'susp':'';}
function stLbl(f){var k=stOf(f);return k==='off'?'Off':k==='susp'?'Suspended':'';}
window.revFirmState=stOf;
function figs(f){var ty=sum(list(f.id,true)),all=sum(list(f.id,false)),k=stOf(f);
  return '<div class="rev-pickout'+(k?' rf-'+k:'')+'" data-revf="'+E(f.id)+'"><b class="rev-fname">'+E(f.name)+'</b>'+(k?' <span class="pill rf-pill">'+stLbl(f)+'</span>':'')+(codes(f)?' <span class="small muted">Sites: '+E(codes(f))+'</span>':'')+
  '<div class="rev-tot"><div><span class="small muted">Revenue this year</span><br><b class="revf-year">'+M$(ty.tot)+'</b> <span class="small">incl. HST · '+M$(ty.amt)+' before HST · '+ty.n+' invoices</span><br><button type="button" class="small sec" data-act="revshow" data-f="'+E(f.id)+'" data-y="1">See invoices</button></div>'+
  '<div><span class="small muted">Total revenue (all years)</span><br><b class="revf-all">'+M$(all.tot)+'</b> <span class="small">incl. HST · '+M$(all.amt)+' before HST · '+all.n+' invoices</span><br><button type="button" class="small sec" data-act="revshow" data-f="'+E(f.id)+'" data-y="0">See invoices</button></div></div></div>';}
function opts(sel){return firms().slice().sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''));}).map(function(f){var k=stOf(f);return '<option value="'+E(f.id)+'"'+(k?' class="rf-'+k+'"':'')+(f.id===sel?' selected':'')+'>'+E(f.name)+(k?' ('+stLbl(f)+')':'')+'</option>';}).join('');}
function card(){var Y=today().slice(0,4),ty=sum(list(null,true)),all=sum(list(null,false)),sel=(window.PAGE_STATE&&PAGE_STATE.revf)||'',f=sel&&user(sel);if(f&&f.type!=='firm')f=null;
  return '<div class="card" id="revcard"><h2 style="margin-top:0">Revenue collected</h2>'+
    '<div class="rev-tot"><div><span class="small muted">All farms and clients · this year ('+Y+', to today)</span><br><b id="revyear">'+M$(ty.tot)+'</b> <span class="small">incl. HST · '+M$(ty.amt)+' before HST · '+ty.n+' invoices</span></div>'+
    '<div><span class="small muted">All farms and clients · total (all years)</span><br><b id="revall">'+M$(all.tot)+'</b> <span class="small">incl. HST · '+M$(all.amt)+' before HST · '+all.n+' invoices</span></div></div>'+
    '<div class="rev-pick"><label for="revq" class="small"><b>Pick a farm or client</b></label><div class="row"><input type="search" id="revq" placeholder="Type to search…" autocomplete="off" style="max-width:220px"><select id="revpick" aria-label="Farm or client"><option value="">Choose a farm or client…</option>'+opts(f?f.id:'')+'</select></div></div>'+
    '<div id="revout">'+(f?figs(f):'<p class="small muted">Choose a farm or client to see its revenue this year and total revenue.</p>')+'</div>'+
    '<p class="small muted">Only invoices marked paid. Unpaid, deleted, replaced and draft invoices are left out; uploaded past invoices count. The year is taken from the date the invoice was marked paid. Farms and clients in red are switched off or suspended.</p></div>';}
window.revCard=function(){return can()?card():'';};
document.addEventListener('input',function(e){var t=e.target;if(!t||t.id!=='revq')return;try{var q=t.value.trim().toLowerCase(),s=document.getElementById('revpick');if(!s)return;var first=null;[].forEach.call(s.options,function(o){if(!o.value)return;var m=!q||o.text.toLowerCase().indexOf(q)>=0;o.hidden=!m;o.disabled=!m;if(m&&!first)first=o;});if(q&&first&&(s.selectedIndex<1||s.options[s.selectedIndex].hidden)){s.value=first.value;pick(first.value);}}catch(x){try{console.warn('[revenue]',x);}catch(z){}}});
function pick(id){if(!can())return;if(window.PAGE_STATE)PAGE_STATE.revf=id||'';var o=document.getElementById('revout'),f=id&&user(id);if(!o)return;o.innerHTML=f&&f.type==='firm'?figs(f):'<p class="small muted">Choose a farm or client to see its revenue this year and total revenue.</p>';}
document.addEventListener('change',function(e){if(e.target&&e.target.id==='revpick'){try{pick(e.target.value);}catch(x){try{console.warn('[revenue]',x);}catch(z){}}}});
ACT.revshow=function(el){if(!can()||!el||!el.dataset)return;var f=user(el.dataset.f);if(!f)return;var y=el.dataset.y==='1',L=list(f&&f.id,y).sort(function(a,b){return dateOf(b).d.localeCompare(dateOf(a).d);}),s=sum(L),fb=L.some(function(i){return !i.paidAt;});
  modal('<h2>'+E(f?f.name:'')+' · Revenue collected · '+(y?'This year ('+today().slice(0,4)+', to today)':'Total (all years)')+'</h2><p id="revmsum"><b>'+M$(s.tot)+'</b> incl. HST · '+M$(s.amt)+' before HST · '+s.n+' paid invoice'+(s.n===1?'':'s')+'</p>'+
    (L.length?'<div class="tw"><table class="no-stack"><tr><th>Invoice</th><th>Date used</th><th style="text-align:right">Before HST</th><th style="text-align:right">Total</th></tr>'+L.map(function(i){var d=dateOf(i);return '<tr><td>'+E(i.number)+(i.uploaded?' <span class="pill">Uploaded</span>':'')+(i.credit?' <span class="pill">Credit</span>':'')+'</td><td>'+E(d.d)+' <span class="small muted">('+d.by+')</span></td><td style="text-align:right">'+M$(i.amount)+'</td><td style="text-align:right">'+M$(i.total)+'</td></tr>';}).join('')+'</table></div>':'<p class="muted">No paid invoices'+(y?' this year':'')+'.</p>')+
    '<p class="small muted">Date used: the paid date'+(fb?' (invoice date where no paid date was stored, marked above)':'')+'. Unpaid, deleted, replaced and draft invoices are left out.</p><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Close</button></div>');};
var of=VIEWS['admin:firms'];VIEWS['admin:firms']=function(){var x=of.apply(this,arguments);try{if(!can())return x;return card()+x;}catch(e){try{console.warn('[revenue]',e);}catch(z){}return x;}};
/* revfilter1: other cards are moved above the heading after render, so keep Revenue collected first on the page */
window.revToTop=function(){try{var c=document.getElementById('revcard');if(c&&c.parentNode&&c.parentNode.firstElementChild!==c)c.parentNode.insertBefore(c,c.parentNode.firstElementChild);}catch(e){}};
if(!document.getElementById('revstyle')){var st=document.createElement('style');st.id='revstyle';st.textContent='.rev-tot{display:flex;gap:24px;flex-wrap:wrap;margin:4px 0 8px}.rev-tot b{font-size:20px}.rev-btns{white-space:nowrap}.rev-pick{margin:10px 0 6px}.rev-pick select{max-width:320px}.rev-pickout{border:1px solid #e3e3e8;border-radius:8px;padding:8px 10px;margin:6px 0}.rev-pickout.rf-off,.rev-pickout.rf-susp{border-color:#d93025;background:#fdecea}.rev-pickout.rf-off .rev-fname,.rev-pickout.rf-susp .rev-fname{color:#b3261e}#revpick option.rf-off,#revpick option.rf-susp{color:#b3261e}';document.head.appendChild(st);}
})();
