/* v2-invdelete.js – invdelete1 (owner Oct 17 2026, 5:08 / 5:09 PM). TEST COPY.
   "I still don't see a delete button where the invoices are for each farm, from the office perspective."
   "Can you add delete button and the option to upload timesheet or the invoice right in the farm in People, under the farm?
    And I don't want to see the logs of who logged in when every time I open a person. Let the log be separate."

   1. DELETE A FARM INVOICE (OWNER ONLY – not office admin, not the Office Assistant). A "Delete" button on every farm invoice row
      (Clients & money → Client invoices, the farm page's invoices, the invoice view). SOFT delete: the row is kept and marked
      deleted (who, when, reason), one audit line is written, and the invoice disappears from every office and farm list, total,
      owing, overdue and interest figure. Owner: "Deleted invoices" → Restore.
      Rules:
      - PAID invoice made in the app: blocked (money was received; use a credit note / extra invoice so the records stay right).
        A PAID uploaded past invoice (a reference copy that locks no hours): allowed only after typing its invoice number + a reason.
      - Revised invoices: a WAITING / QUESTIONED revision (-R2) → Delete = Withdraw (the original stays the invoice to pay).
        Deleting the CURRENT invoice of a family (the original, or the approved revision that replaced it) deletes the whole family
        (original + all revisions; a waiting one is withdrawn) – Restore brings the family back together.
        An original that was replaced, or a withdrawn revision, has no Delete of its own: delete the current invoice instead.
      - An invoice with a credit note / extra invoice (-CR / -X) attached: delete that first.
      - Locked hours: hours inside the deleted invoice's dates are no longer "on an issued invoice" (the office can change / remove
        them and bill them again); late entries that were billed on it ("On client invoice …") are freed too. Restore is refused if
        another invoice now covers the same dates (no double billing) and puts the late-entry marks back.
      - The PDF / picture file stays in storage.
      Live: the delete is a normal update of reg_client_invoices (owner write, 016v); migration 018a hides deleted rows from the farm
      and frees the server-side hour locks, and guards who may delete / restore. Turned on by store-config  invDelete: true  (AFTER 018a).
      Data: deleted rows are kept apart in DB.clientInvoicesDel (store-supabase.js saves both lists to reg_client_invoices).
   2. FARM PAGE (People → Open a farm, owner): right under the farm's details: its invoices with Delete, "+ Upload timesheet /
      invoice file" (the past invoices & timesheets section moves up there), "+ Add past invoice", and "Deleted invoices".
   3. SIGN-IN LOG MOVED OFF THE PERSON PAGE: the "Recent sign-ins" list no longer shows when you open a person (any kind). A
      "Sign-in log" button opens that person's log on its own screen (owner only); Login history has a "Person" filter. Data unchanged.
   Load after v2-invrevise.js and before v2-keepscroll.js. Undo: remove the script + css lines in index.html. */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof ACT==='undefined'||typeof FORMS==='undefined')return;
function LIVE(){return !!window.REG_LIVE;}
function CFG(k){return !LIVE()||!!(window.REG_STORE&&window.REG_STORE[k]);}
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function owner(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||helper())return false;return typeof window.ivOwner==='function'?!!window.ivOwner():true;}
function nowIso(){return new Date().toISOString();}
function act(){return (DB&&DB.clientInvoices)||[];}
function del(){return (DB.clientInvoicesDel=DB.clientInvoicesDel||[]);}
function isDel(i){return !!(i&&i.deleted===true);}
function byId(id){var L=act().concat(DB.clientInvoicesDel||[]);for(var k=0;k<L.length;k++)if(L[k].id===id)return L[k];return null;}
function firmName(i){var f=i&&user(i.firmId);return f?f.name:'';}
function money2(v){return typeof money==='function'?money(+v||0):'$'+(+v||0).toFixed(2);}
var MSG_SW='Deleting invoices is switched on after migration 018a.';

/* ---------- data: deleted rows live apart, so no total / owing / lock / list ever counts them ---------- */
function split(){try{if(typeof DB==='undefined'||!DB)return;var L=DB.clientInvoices||[];var d=L.filter(isDel);if(d.length){DB.clientInvoices=L.filter(function(i){return !isDel(i);});
    var ids={};d.forEach(function(x){ids[x.id]=1;});DB.clientInvoicesDel=(DB.clientInvoicesDel||[]).filter(function(x){return !ids[x.id];}).concat(d);}
  if(DB.clientInvoicesDel){var back=DB.clientInvoicesDel.filter(function(i){return !isDel(i);});if(back.length){DB.clientInvoicesDel=DB.clientInvoicesDel.filter(isDel);DB.clientInvoices=(DB.clientInvoices||[]).concat(back);}}}catch(e){try{console.warn('[invdelete split]',e);}catch(x){}}}
if(typeof load==='function'){var ol=load;load=function(){var r=ol.apply(this,arguments);split();return r;};}
split();

/* ---------- families (revisions) ---------- */
function kids(i,L){return L.filter(function(x){return x.revOf===i.id;});}
function rootOf(i,L){var r=i,n=0;while(r&&r.revOf&&n<20){var p=L.filter(function(x){return x.id===r.revOf;})[0];if(!p)break;r=p;n++;}return r;}
function family(i){var L=act(),root=rootOf(i,L),out=[];(function walk(x){if(!x||out.indexOf(x)>=0)return;out.push(x);kids(x,L).forEach(walk);})(root);return out;}
function waiting(i){return !!(i&&i.revOf&&(i.revStatus==='waiting'||i.revStatus==='questioned'));}
function replaced(i){return act().some(function(k){return k.revOf===i.id&&k.revStatus==='approved';});}
/* why this invoice can't be deleted ('' = it can); kind: 'withdraw' | 'family' | 'paidcopy' */
function check(i){if(!i)return {why:'Invoice not found.'};
  if(!owner())return {why:window.IV_MSG||'Farm invoices are visible to the owner only.'};
  if(LIVE()&&!CFG('invDelete'))return {why:MSG_SW};
  if(i.revOf&&i.revStatus==='withdrawn')return {why:'This revision was withdrawn – it is not an invoice the farm owes. Delete the current invoice of this period instead.'};
  if(waiting(i))return {kind:'withdraw',fam:[i]};
  if(replaced(i)){var k=act().filter(function(x){return x.revOf===i.id&&x.revStatus==='approved';})[0];return {why:'This invoice was replaced by '+(k?k.number:'a revised invoice')+'. Delete '+(k?k.number:'that invoice')+' – it removes the whole family.'};}
  var fam=family(i),paid=fam.filter(function(x){return x.paidAt&&x.revStatus!=='withdrawn';});
  var adj=act().filter(function(x){return x.adjOf&&fam.some(function(m){return m.id===x.adjOf;});});
  if(adj.length)return {why:'Invoice '+adj.map(function(x){return x.number;}).join(', ')+' (credit note / extra invoice) is attached to this invoice. Delete that first.'};
  if(paid.length){if(fam.length===1&&i.uploaded)return {kind:'paidcopy',fam:fam};
    return {why:'Invoice '+paid[0].number+' is marked paid ('+paid[0].paidAt+'). A paid invoice can\'t be deleted – the payment must stay on record. Use a credit note or an extra invoice instead.'};}
  return {kind:'family',fam:fam};}
window.idCheck=check;

/* ---------- delete ---------- */
function freeLate(m){var ids=[];(DB.time||[]).forEach(function(t){if(m.number&&t.lateBilledInv===m.number){ids.push(t.id);delete t.lateBilledInv;}});if(ids.length)m.delUnbilled=ids;else delete m.delUnbilled;return ids.length;}
function moveOut(rows){var ids={};rows.forEach(function(r){ids[r.id]=1;});DB.clientInvoices=act().filter(function(x){return !ids[x.id];});var D=del();rows.forEach(function(r){if(D.indexOf(r)<0)D.push(r);});}
function markDel(m,grp,why,at){m.deleted=true;m.deletedAt=at;m.deletedBy=ME.name;m.deletedById=ME.id;m.deleteReason=why||'';m.delGroup=grp;}
function doDelete(i,why){var c=check(i);if(c.why){toast(c.why);return false;}var at=nowIso(),grp=uid('dg'),freed=0,firm=firmName(i);
  if(c.kind==='withdraw'){var p=byId(i.revOf);i.revStatus='withdrawn';i.withdrawnAt=at;i.withdrawnBy=ME.name;if(p){if(p.lines0){p.lines=p.lines0;delete p.lines0;}delete p.revisedBy;}
    markDel(i,grp,why,at);moveOut([i]);audit('Deleted revised client invoice (withdrawn)',firm,i.number+' · '+money2(i.total)+(why?' · reason: '+why:''));}
  else{c.fam.forEach(function(m){if(waiting(m)){m.revStatus='withdrawn';m.withdrawnAt=at;m.withdrawnBy=ME.name;}freed+=freeLate(m);markDel(m,grp,why,at);});moveOut(c.fam);
    audit('Deleted client invoice',firm,c.fam.map(function(m){return m.number;}).join(' + ')+' · '+(i.periodStart||'')+(i.periodEnd?' – '+i.periodEnd:'')+' · '+money2(i.total)+(i.paidAt?' · was marked paid '+i.paidAt:'')+(freed?' · '+freed+' late entr'+(freed===1?'y':'ies')+' freed':'')+(why?' · reason: '+why:''));}
  save();return true;}

/* ---------- restore ---------- */
function overlap(a,b){return a.periodStart&&b.periodStart&&a.periodStart<=(b.periodEnd||b.periodStart)&&b.periodStart<=(a.periodEnd||a.periodStart);}
function restoreCheck(grp){var rows=del().filter(function(x){return x.delGroup===grp;});if(!rows.length)return {why:'Not found.'};
  if(!owner())return {why:window.IV_MSG||'Owner only.'};if(LIVE()&&!CFG('invDelete'))return {why:MSG_SW};
  var A=act();for(var k=0;k<rows.length;k++){var r=rows[k];
    var dup=A.filter(function(x){return x.firmId===r.firmId&&String(x.number||'').trim().toLowerCase()===String(r.number||'').trim().toLowerCase();})[0];
    if(dup)return {why:'Invoice number '+r.number+' is in use again for this farm. Delete or rename that one first.'};
    if(!r.uploaded&&r.revStatus!=='withdrawn'){var o=A.filter(function(x){return x.firmId===r.firmId&&!x.uploaded&&!x.adjOf&&!(x.revOf&&x.revStatus==='withdrawn')&&overlap(x,r);})[0];
      if(o)return {why:'Invoice '+o.number+' now covers '+o.periodStart+' – '+(o.periodEnd||o.periodStart)+'. Restoring '+r.number+' would bill those hours twice. Delete '+o.number+' first.'};}}
  return {rows:rows};}
function doRestore(grp){var c=restoreCheck(grp);if(c.why){toast(c.why);return false;}var at=nowIso(),back=0;
  c.rows.forEach(function(m){m.deleted=false;m.restoredAt=at;m.restoredBy=ME.name;m.restoredById=ME.id;
    (m.delUnbilled||[]).forEach(function(id){var t=(DB.time||[]).filter(function(x){return x.id===id;})[0];if(t&&!t.lateBilledInv){t.lateBilledInv=m.number;back++;}});delete m.delUnbilled;});
  DB.clientInvoicesDel=del().filter(function(x){return c.rows.indexOf(x)<0;});DB.clientInvoices=act().concat(c.rows);
  audit('Restored deleted client invoice',firmName(c.rows[0]),c.rows.map(function(m){return m.number;}).join(' + ')+(back?' · '+back+' late entr'+(back===1?'y':'ies')+' marked billed again':''));save();return true;}

/* ---------- confirm ---------- */
function statusTxt(i){if(i.revOf&&waiting(i))return 'waiting for farm approval';if(i.paidAt)return 'paid '+i.paidAt;return i.due?'unpaid, due '+i.due:'unpaid';}
ACT.iddel=function(el){var i=byId(el.dataset.id);var c=check(i);
  if(c.why){modal('<div class="id-modal" id="idwhy"><h2>Can\'t delete '+E(i?i.number:'this invoice')+'</h2><p>'+E(c.why)+'</p><div class="row-end"><button class="sec" data-act="closeModal">OK</button></div></div>');return;}
  var others=c.fam.filter(function(m){return m!==i;});
  var h='<div class="id-modal" id="iddelmodal"><h2>'+(c.kind==='withdraw'?'Delete (withdraw) revised invoice ':'Delete invoice ')+E(i.number)+'?</h2>'+
    '<div class="kv id-facts"><div>Farm</div><div><b>'+E(firmName(i))+'</b></div><div>Invoice #</div><div><b>'+E(i.number)+'</b>'+(i.uploaded?' <span class="small muted">(uploaded past invoice)</span>':'')+'</div>'+
    '<div>Amount</div><div><b>'+money2(i.total)+'</b> <span class="small muted">('+money2(i.amount)+' + HST '+money2(i.hst)+')</span></div>'+
    '<div>Period</div><div>'+E(i.periodStart||'–')+' – '+E(i.periodEnd||'–')+'</div><div>Status</div><div>'+E(statusTxt(i))+'</div></div>'+
    (others.length?'<div class="alert warn small" id="idfam"><b>Also removed (same invoice family):</b> '+others.map(function(m){return E(m.number)+' ('+E(m.revStatus||'original')+', '+money2(m.total)+')';}).join(', ')+'</div>':'')+
    (c.kind==='withdraw'?'<p class="small">The farm will no longer be asked to approve it. The original invoice stays the one to pay.</p>':
     '<ul class="small id-eff"><li>It disappears from the office and farm invoice lists, totals, owing and overdue.</li><li>Hours in '+E(i.periodStart||'')+' – '+E(i.periodEnd||'')+' are no longer locked by it and can be billed again.</li><li>The invoice file stays stored. You can restore it from <b>Deleted invoices</b>.</li></ul>')+
    (c.kind==='paidcopy'?'<div class="alert bad small" id="idpaidwarn"><b>This uploaded invoice is marked paid ('+E(i.paidAt)+').</b> Deleting it removes that payment from the records. Type the invoice number and a reason to go ahead.</div>':'')+
    '<form data-form="iddelok" id="iddelform"><input type="hidden" name="id" value="'+E(i.id)+'">'+
    (c.kind==='paidcopy'?'<label for="idtype">Type the invoice number</label><input type="text" name="typed" id="idtype" autocomplete="off" required>':'')+
    '<label for="idwhy2">Reason'+(c.kind==='paidcopy'?'':' (optional)')+'</label><input type="text" name="why" id="idwhy2" maxlength="200" placeholder="e.g. uploaded twice"'+(c.kind==='paidcopy'?' required':'')+'>'+
    '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button class="danger" id="iddelgo">'+(c.kind==='withdraw'?'Withdraw and delete':'Delete invoice')+'</button></div></form></div>';
  modal(h);};
FORMS.iddelok=function(f,d){var i=byId(d.id);var c=check(i);if(c.why){toast(c.why);return;}var why=String(d.why||'').trim().slice(0,200);
  if(c.kind==='paidcopy'){if(String(d.typed||'').trim().toLowerCase()!==String(i.number||'').trim().toLowerCase()){toast('The invoice number does not match.');return;}if(why.length<3){toast('Please give a reason.');return;}}
  var n=i.number;if(!doDelete(i,why))return;closeModal();toast('Invoice '+n+' deleted. Restore it from Deleted invoices if needed.');render();};

/* ---------- deleted invoices + restore ---------- */
function groups(firmId){var g={},order=[];del().forEach(function(x){if(firmId&&x.firmId!==firmId)return;var k=x.delGroup||x.id;if(!g[k]){g[k]=[];order.push(k);}g[k].push(x);});
  return order.map(function(k){return {k:k,rows:g[k]};}).sort(function(a,b){return (a.rows[0].deletedAt||'')<(b.rows[0].deletedAt||'')?1:-1;});}
function deletedHtml(firmId){var G=groups(firmId);
  return '<div class="id-modal" id="iddeleted"><h2>Deleted invoices'+(firmId?' – '+E((user(firmId)||{}).name||''):'')+'</h2><p class="small muted">Owner only. Kept on record; hidden from every list, total and owing. Restore puts an invoice back exactly as it was.</p>'+
   (G.length?'<div class="id-dlist">'+G.map(function(g){var m=g.rows[0];
     return '<div class="id-ditem" data-delinv="'+E(m.number)+'"><div class="id-dmain"><b>'+g.rows.map(function(x){return E(x.number);}).join(' + ')+'</b>'+(m.uploaded?' <span class="small muted">uploaded</span>':'')+(firmId?'':' · '+E(firmName(m)))+
       '<div class="small">'+E(m.periodStart||'–')+' – '+E(m.periodEnd||'–')+' · <b>'+money2(m.total)+'</b></div>'+
       '<div class="small muted">Deleted '+E(typeof fmtStamp==='function'?fmtStamp(m.deletedAt):m.deletedAt)+' by '+E(m.deletedBy||'')+(m.deleteReason?' – <i>'+E(m.deleteReason)+'</i>':'')+'</div></div>'+
       '<button class="small sec" data-act="idrestore" data-g="'+E(g.k)+'">Restore</button></div>';}).join('')+'</div>':'<p class="muted">No deleted invoices.</p>')+
   '<div class="row-end"><button class="sec" data-act="closeModal">Close</button></div></div>';}
ACT.iddeleted=function(el){if(!owner()){toast(window.IV_MSG||'Owner only.');return;}PAGE_STATE.idDelFirm=el.dataset.firm||'';modal(deletedHtml(PAGE_STATE.idDelFirm));};
ACT.idrestore=function(el){var g=el.dataset.g;var c=restoreCheck(g);if(c.why){toast(c.why);return;}
  if(!confirmBox('idr'+g,'Restore invoice '+c.rows.map(function(x){return x.number;}).join(' + ')+'?'))return;
  if(doRestore(g)){closeModal();toast('Restored.');render();}};
ADMIN_ONLY_ACT.push('iddel','iddeleted','idrestore','idpastadd','idfilesup','pplog');ADMIN_ONLY_FORM.push('iddelok');

/* ---------- buttons on every office invoice row + in the invoice view ---------- */
function numMap(){var m={};act().forEach(function(i){if(i.number&&!m[i.number])m[i.number]=i;});return m;}
function decorate(){if(!owner()||!CFG('invDelete'))return;var app=document.getElementById('app');if(!app)return;var M=null;
  [].forEach.call(app.querySelectorAll('[data-act=pastinvdel]'),function(b){var i=byId(b.dataset.id);if(!i)return;b.setAttribute('data-act','iddel');b.textContent='🗑 Delete';b.className='small danger-ghost id-delbtn';});
  [].forEach.call(app.querySelectorAll('table tr[data-inv]:not([data-idd])'),function(tr){var tb=tr.closest('table');if(tb&&tb.id==='myclientinv')return;tr.setAttribute('data-idd','1');if(tr.querySelector('.id-delbtn'))return;
    var i=tr.getAttribute('data-invid')?byId(tr.getAttribute('data-invid')):null;if(!i){M=M||numMap();i=M[tr.getAttribute('data-inv')];}if(!i||isDel(i))return;var td=tr.cells[tr.cells.length-1];if(!td)return;
    var lab=waiting(i)?'Delete (withdraw)':'Delete';
    td.insertAdjacentHTML('beforeend',' <button class="small danger-ghost id-delbtn" data-act="iddel" data-id="'+E(i.id)+'" aria-label="Delete invoice '+E(i.number)+'">🗑 '+lab+'</button>');});
  [].forEach.call(app.querySelectorAll('#clientinvoices:not([data-idd])'),function(c){c.setAttribute('data-idd','1');var fid=c.getAttribute('data-hub')?(PAGE_STATE.pp&&PAGE_STATE.pp.id)||'':'';var n=groups(fid).length;
    var h=c.querySelector('h2');if(h)h.insertAdjacentHTML('afterend','<p class="small id-dellink"><button class="small sec" data-act="iddeleted" data-firm="'+E(fid)+'">Deleted invoices ('+n+')</button></p>');});}
/* tag each row with its invoice id (numbers can repeat across farms for uploaded past invoices) */
if(typeof clientInvoicesHtml==='function'){var och=clientInvoicesHtml;clientInvoicesHtml=function(firm,office){var x=och.apply(this,arguments);try{if(!office||!firm)return x;
  act().filter(function(i){return i.firmId===firm.id;}).forEach(function(i){x=x.split('<tr data-inv="'+i.number+'">').join('<tr data-inv="'+i.number+'" data-invid="'+i.id+'">');});}catch(e){}return x;};}
new MutationObserver(function(){try{decorate();}catch(e){}}).observe(document.documentElement,{childList:true,subtree:true});
(function(){var ov=ACT.civview;if(!ov)return;ACT.civview=function(el){var r=ov.apply(this,arguments);try{var i=byId(el.dataset.id),m=document.querySelector('#modal .modal');
  if(i&&m&&owner()&&!isDel(i)&&!m.querySelector('.id-delbtn')){var d=document.createElement('div');d.className='row-end id-viewdel no-print';d.innerHTML='<button class="small danger-ghost id-delbtn" data-act="iddel" data-id="'+E(i.id)+'">🗑 Delete this invoice</button>';m.appendChild(d);}}catch(e){}return r;};})();

/* ---------- 2. farm page: invoices + upload right under the farm's details ---------- */
function st(){return PAGE_STATE.pp||null;}
function ppFirm(){var s=st();if(!s||(s.tab&&s.tab!=='details'))return null;var u=user(s.id);return u&&u.type==='firm'?u:null;}
function topCard(f){var L=act().filter(function(i){return i.firmId===f.id;}).slice().sort(function(a,b){return (a.issued||'')<(b.issued||'')?1:-1;});var nd=groups(f.id).length;
  return '<div class="card id-top" id="idtop"><div class="id-tophead"><h3>Invoices &amp; timesheets <span class="small muted">owner only</span></h3>'+
   '<div class="row id-topbtns">'+(!LIVE()||CFG('clientFiles')?'<button class="small" data-act="idfilesup">':'<button class="small" hidden data-act="idfilesup">')+'+ Upload timesheet / invoice file</button>'+(typeof pastForm==='function'?'<button class="small sec" data-act="idpastadd" data-firm="'+E(f.id)+'">+ Add past invoice</button>':'')+
   (CFG('invDelete')?'<button class="small sec" data-act="iddeleted" data-firm="'+E(f.id)+'">Deleted invoices ('+nd+')</button>':'')+'</div></div>'+
   (L.length?'<div class="tw"><table class="id-ttab" id="idtoptable"><tr><th>Invoice #</th><th>Period</th><th class="r">Total</th><th>Status</th><th></th></tr>'+L.map(function(i){var s=typeof clientInvStatus==='function'?clientInvStatus(i):{t:statusTxt(i),c:''};
     var pay=typeof window.irPayable==='function'?window.irPayable(i):true;if(i.revOf&&waiting(i))s={t:'Waiting for farm',c:'s-pend'};else if(i.revOf&&i.revStatus==='withdrawn')s={t:'Withdrawn',c:'s-mut'};else if(!pay)s={t:'Replaced',c:'s-mut'};
     return '<tr data-inv="'+E(i.number)+'" data-invid="'+E(i.id)+'"><td><b>'+E(i.number)+'</b>'+(i.uploaded?' <span class="small muted">uploaded</span>':'')+'</td><td class="small">'+E(i.periodStart||'–')+' – '+E(i.periodEnd||'–')+'</td><td class="r">'+money2(i.total)+'</td><td><span class="pill '+s.c+'">'+E(s.t)+'</span></td>'+
       '<td class="id-acts"><button class="small sec" data-act="civview" data-id="'+E(i.id)+'">View</button></td></tr>';}).join('')+'</table></div>':'<p class="small muted">No invoices for this farm yet.</p>')+'</div>';}
if(VIEWS['admin:people']){var opp=VIEWS['admin:people'];VIEWS['admin:people']=function(){var s=st();
  if(s&&s.tab==='log'){var u=user(s.id);if(u)return logPage(u);}
  var x=opp.apply(this,arguments);try{var f=ppFirm();if(!f||!owner())return x;
    x=x.replace(/<div class="card"><h3>Invoices \(\d+\) <span class="small muted">owner only<\/span><\/h3>[\s\S]*?<\/div>/,'');
    var at=x.indexOf('<div class="card pp-facts">');if(at<0)return x;var end=divEnd(x,at);if(end<0)return x;
    x=x.slice(0,end)+topCard(f)+x.slice(end);}catch(e){try{console.warn('[invdelete top]',e);}catch(z){}}return x;};}
function divEnd(x,at){var re=/<div\b|<\/div>/g,d=0,m;re.lastIndex=at;while((m=re.exec(x))){d+=m[0]==='</div>'?-1:1;if(d===0)return m.index+6;}return -1;}
/* the existing "Past invoices & timesheets" card (017b) moves up, right under the invoices card */
function logTop(){var s=st();if(!s||s.tab==='log'||!logOk()||document.getElementById('pplogtop'))return;var tabs=document.querySelectorAll('#main [data-act=pptab]');if(!tabs.length)return;var last=tabs[tabs.length-1];
  var bt=document.createElement('button');bt.type='button';bt.id='pplogtop';bt.className=last.className.replace(/\bcur\b|\bactive\b/g,'')+' sec';bt.setAttribute('data-act','pplog');bt.setAttribute('data-id',s.id);bt.textContent='🕘 Sign-in log';last.parentNode.insertBefore(bt,last.nextSibling);}
function moveFiles(){try{logTop();}catch(e){}var t=document.getElementById('idtop');if(!t)return;var h=document.getElementById('hdcfarmday');
  var c=document.getElementById('cfcard');if(c&&t.nextElementSibling!==c)t.parentNode.insertBefore(c,t.nextSibling);
  /* farm details → invoices & timesheets → files → "People who worked here" (so the invoices are on screen without scrolling, also on a phone) */
  var last=c&&c.parentNode===t.parentNode?c:t;if(h&&h.parentNode===t.parentNode&&last.nextElementSibling!==h&&(h.compareDocumentPosition(t)&Node.DOCUMENT_POSITION_FOLLOWING))t.parentNode.insertBefore(h,last.nextSibling);}
new MutationObserver(function(){try{moveFiles();}catch(e){}}).observe(document.documentElement,{childList:true,subtree:true});
ACT.idfilesup=function(){if(!owner())return;PAGE_STATE.cfOpen=true;render();setTimeout(function(){var e=document.getElementById('cfadd'),c=document.getElementById('cfcard');if(e)e.open=true;var tg=e||c;if(tg)tg.scrollIntoView({block:'start'});var f=e&&e.querySelector('input,select,textarea');if(f)try{f.focus({preventScroll:true});}catch(x){}},80);};
ACT.idpastadd=function(el){if(!owner()||typeof pastForm!=='function')return;var f=user(el.dataset.firm);modal('<h2>Add a past invoice'+(f?' – '+E(f.name):'')+'</h2><p class="small muted">An invoice made outside the app. It counts like any farm invoice (owing, overdue).</p>'+pastForm({firmId:el.dataset.firm}));};

/* ---------- 3. sign-in log: off the person page, on its own screen ---------- */
function logOk(){return owner();}
(function(){if(typeof showPerson!=='function')return;var op=showPerson;showPerson=function(id){var r=op.apply(this,arguments);try{var m=document.querySelector('#modal .modal');if(!m)return r;
  [].forEach.call(m.querySelectorAll('h3'),function(h){if(!/^\s*Recent sign-ins\s*$/.test(h.textContent))return;var nx=h.nextElementSibling;if(nx&&(nx.classList.contains('tw')||nx.tagName==='P'||nx.tagName==='TABLE'))nx.remove();
    if(logOk()){var p=document.createElement('p');p.className='id-logbtn';p.innerHTML='<button class="small sec" data-act="pplog" data-id="'+E(id)+'">🕘 Sign-in log</button> <span class="small muted">who signed in and when – opens on its own screen</span>';h.parentNode.insertBefore(p,h);}
    h.remove();});}catch(e){try{console.warn('[invdelete log]',e);}catch(z){}}return r;};})();
ACT.pplog=function(el){if(!logOk()){toast('The sign-in log is for the owner.');return;}var id=el.dataset.id;try{closeModal();}catch(e){}
  var s=PAGE_STATE.pp;if(!s||s.id!==id){PAGE_STATE.pp={id:id,tab:'log',back:location.hash||'#/people'};}else{s.tab='log';}
  if((location.hash||'').split('?')[0]==='#/people')render();else go('#/people');};
function logPage(u){var s=st(),back='<button class="small sec" data-act="pptab" data-tab="details">← Back to '+E(u.name)+'</button>';
  if(!logOk())return '<div class="pp-head">'+back+'<h1>Sign-in log</h1></div><div class="card iv-calm"><p><b>The sign-in log is for the owner.</b></p></div>';
  var L=(DB.logins||[]).filter(function(l){return l.userId===u.id;});var n=s.logN||50,show=L.slice(0,n);
  return '<div class="pp-head">'+back+'<h1>Sign-in log – '+E(u.name)+'</h1></div><p class="small muted">Every sign-in to this account: time, result and device. Owner only. All sign-ins for everyone: <a href="#/logins">Login history</a>.</p>'+
   '<div class="card" id="pplogcard">'+(show.length?'<div class="tw"><table id="pplogtable"><tr><th>Time</th><th>Result</th><th>Typed login</th><th>Device</th></tr>'+show.map(function(l){return '<tr><td class="small">'+E(typeof fmtStamp==='function'?fmtStamp(l.at):l.at)+'</td><td>'+(l.ok?'<span class="pill s-ok">OK</span>':'<span class="pill s-bad">Failed</span>')+' <span class="small">'+E(l.reason||'')+'</span></td><td class="small">'+E(l.typed||'')+'</td><td class="small">'+E(l.device||'')+'</td></tr>';}).join('')+'</table></div>'+
     (L.length>n?'<p><button class="small sec" data-act="pplogmore">Show more ('+(L.length-n)+' older)</button></p>':''):'<p class="muted">No sign-ins recorded yet.</p>')+'</div>';}
ACT.pplogmore=function(){var s=st();if(!s)return;s.logN=(s.logN||50)+100;render();};
/* Login history: filter by person */
if(VIEWS['admin:logins']){var olg=VIEWS['admin:logins'];VIEWS['admin:logins']=function(){var who=PAGE_STATE.lwho||'',keep=DB.logins;
  if(who)DB.logins=(keep||[]).filter(function(l){return l.userId===who;});var x;try{x=olg.apply(this,arguments);}finally{DB.logins=keep;}
  var seen={},opts=(keep||[]).filter(function(l){if(!l.userId||seen[l.userId])return false;seen[l.userId]=1;return true;}).map(function(l){var u=user(l.userId);return {id:l.userId,n:u?u.name:(l.name||l.userId)};}).sort(function(a,b){return a.n<b.n?-1:1;});
  var sel='<div class="row id-lwho"><label for="lwho" class="small">Person</label><select id="lwho" aria-label="Person"><option value="">Everyone</option>'+opts.map(function(o){return '<option value="'+E(o.id)+'"'+(o.id===who?' selected':'')+'>'+E(o.n)+'</option>';}).join('')+'</select></div>';
  return x.replace('</h1>','</h1>'+sel);};}
document.addEventListener('change',function(e){if(e.target&&e.target.id==='lwho'){PAGE_STATE.lwho=e.target.value;render();}});
})();
