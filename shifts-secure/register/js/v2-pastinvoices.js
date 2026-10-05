/* v2-pastinvoices.js – O (Oct 4): the office uploads invoices for work already completed (made outside the app,
   e.g. a PDF). TEST ONLY, fake data, files stored in this browser like every other upload in the test app (readUpload).
   - Office (any office role) uploads from Clients & money: "Farms & other clients" (#pastinv card under Client invoices)
     and "Invoices" (#/invoicesadmin). Client picked by name + site codes, as the app shows them elsewhere.
   - Stored in DB.clientInvoices with uploaded:true, so it shows in the office list ("Uploaded (past work)" pill, view,
     download, edit, remove) and in that client's "My invoices" next to app-made invoices (view + download the file).
   - Duplicate invoice numbers for the same client are refused; total must equal amount + HST (warning, save only if confirmed).
   - Every upload, edit and removal goes to the audit log. No interest is calculated on uploaded invoices, the note stays office-only,
     and no notice is sent to the client. */
'use strict';
var PAST_OK_TYPE=/^(application\/pdf|image\/(png|jpe?g|webp))$/i;
var PAST_TAG='Uploaded (past work)';
function pastSites(f){return (DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;});}
function pastFirmLabel(f){var s=pastSites(f);return f.name+(s.length?' – site'+(s.length>1?'s ':' ')+s.join(', '):'');}
function pastNorm(n){return String(n||'').replace(/\s+/g,'').toUpperCase();}
function pastDup(firmId,number,exceptId){return (DB.clientInvoices||[]).filter(function(i){return i.firmId===firmId&&i.id!==exceptId&&pastNorm(i.number)===pastNorm(number);})[0]||null;}
function pastR2(n){return Math.round((Number(n)||0)*100)/100;}
function pastFileName(i){var f=user(i.firmId),ext=(String(i.file&&i.file.name||'').match(/\.([A-Za-z0-9]{2,5})$/)||[])[1]||(/pdf/.test(i.file&&i.file.type||'')?'pdf':'jpg');
  return 'Invoice-'+String(i.number).replace(/[^A-Za-z0-9-]+/g,'-')+'-'+String(f?f.name:'client').replace(/[^A-Za-z0-9]+/g,'-').replace(/-+$/,'')+'.'+ext.toLowerCase();}
/* live (Supabase) mode: invoice rows are readable by that client, so the office note is kept in the office audit log only;
   uploads need a money role (server rule: reg_client_invoices write = owner/admin/billing); files live in the private bucket. */
function pastLive(){return !!window.REG_LIVE;}
function pastCanUpload(){if(!ME||ME.type!=='admin')return false;if(!pastLive())return true;var r=ME.officeRoles||[];return !r.length||r.some(function(x){return ['owner','admin','billing'].indexOf(x)>=0;});}
function pastWithUrl(i,cb){var d=String(i.file&&i.file.data||'');if(d.indexOf('data:')===0){cb(dataToBlobUrl(d));return;}
  if(d&&typeof window.REG_FILE_BLOB==='function'){window.REG_FILE_BLOB(d).then(function(u){cb(u||'');},function(){cb('');});return;}cb('');}
function pastPill(){return ' <span class="pill s-mut uplpill">'+PAST_TAG+'</span>';}
function pastForm(i){i=i||{};var edit=!!i.id,firms=users('firm').slice().sort(function(a,b){return (isFarm(a)?0:1)-(isFarm(b)?0:1)||(a.name<b.name?-1:1);});
  var paid=!!i.paidAt;
  return '<form data-form="pastinv" class="pastinvform" id="'+(edit?'pastinvedit':'pastinvnew')+'" novalidate>'+(edit?'<input type="hidden" name="id" value="'+esc(i.id)+'">':'')+
  '<div><label class="req" for="pi-firm'+(edit?'-e':'')+'">Farm or client (name and site codes)</label><select name="firmId" id="pi-firm'+(edit?'-e':'')+'" required><option value="">Choose…</option>'+firms.map(function(f){return '<option value="'+f.id+'"'+(i.firmId===f.id?' selected':'')+'>'+esc(pastFirmLabel(f))+'</option>';}).join('')+'</select></div>'+
  '<div class="grid2">'+inp('number','Invoice number',i.number,{req:true,ph:'e.g. 2025-114'})+inp('issued','Invoice date',i.issued,{type:'date',req:true})+
  inp('periodStart','Work period from',i.periodStart,{type:'date',req:true})+inp('periodEnd','Work period to',i.periodEnd,{type:'date',req:true})+
  inp('amount','Amount before tax $',i.amount,{type:'number',req:true,extra:' step="0.01" min="0" data-calc="pastinv"'})+inp('hst','HST $',i.hst,{type:'number',req:true,extra:' step="0.01" min="0" data-calc="pastinv"'})+
  inp('total','Total $',i.total,{type:'number',req:true,extra:' step="0.01" min="0" data-calc="pastinv"'})+inp('due','Due date',i.due,{type:'date',req:true})+
  '<div><label class="req">Status</label><select name="status" data-calc="pastinvst"><option value="Unpaid"'+(paid?'':' selected')+'>Unpaid</option><option value="Paid"'+(paid?' selected':'')+'>Paid</option></select></div>'+
  '<div class="paidwrap"'+(paid?'':' hidden')+'>'+inp('paidAt','Paid date',i.paidAt,{type:'date'})+'</div></div>'+
  '<div class="small pastcheck" aria-live="polite">'+pastCheckText(i.amount,i.hst,i.total)+'</div>'+
  '<div><label>'+(pastLive()?'Note (office only – kept in the audit log, not on the invoice)':'Note (office only – not shown to the client)')+'</label><textarea name="note" rows="2">'+esc(pastLive()?'':(i.note||''))+'</textarea></div>'+
  '<div><label class="'+(edit?'':'req')+'">Invoice file (PDF or picture)</label><input type="file" name="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp"'+(edit?'':' required')+'>'+
  '<div class="hint">'+(edit?'Current file: <b>'+esc(i.file?i.file.name:'')+'</b>. Choose a new file only to replace it.':(pastLive()?'PDF, JPG, PNG or WEBP, up to 1.5 MB. Stored privately: only the office and this client can open it.':'PDF, JPG, PNG or WEBP, up to 1.5 MB. Test version: kept only in this browser, like other uploads.'))+'</div></div>'+
  '<div class="pastwarn" aria-live="assertive"></div>'+
  '<p class="row"><button type="submit">'+(edit?'Save changes':'Upload past invoice')+'</button>'+(edit?'<button type="button" class="sec" data-act="closeModal">Cancel</button>':'')+'</p></form>';}
function pastCheckText(a,h,t){if(a===''||a==null||t===''||t==null)return 'Total should equal amount before tax + HST.';a=pastR2(a);h=pastR2(h);t=pastR2(t);var s=pastR2(a+h);
  var hint=Math.abs(pastR2(a*0.15)-h)>0.01?' (15% HST on '+money(a)+' would be '+money(pastR2(a*0.15))+')':'';
  return Math.abs(s-t)<0.005?'<span class="ok">✓ '+money(a)+' + '+money(h)+' = '+money(t)+'</span>'+hint:'<span class="bad">⚠ Amount + HST = '+money(s)+', but total is '+money(t)+' (off by '+money(Math.abs(pastR2(t-s)))+').</span>'+hint;}
CALC.pastinv=function(el){var f=el.form;if(!f)return;var c=f.querySelector('.pastcheck');if(c)c.innerHTML=pastCheckText(f.amount.value,f.hst.value,f.total.value);var w=f.querySelector('.pastwarn');if(w)w.innerHTML='';};
CALC.pastinvst=function(el){var f=el.form;var w=f.querySelector('.paidwrap');if(w)w.hidden=el.value!=='Paid';};
document.addEventListener('change',function(e){if(e.target&&e.target.dataset&&e.target.dataset.calc==='pastinvst')CALC.pastinvst(e.target);});
function pastErr(f,msg){var w=f.querySelector('.pastwarn');if(w)w.innerHTML='<div class="alert bad">'+esc(msg)+'</div>';toast(msg);}
function pastList(){var l=(DB.clientInvoices||[]).filter(function(i){return i.uploaded;}).sort(function(a,b){return a.issued<b.issued?1:-1;});
  if(!l.length)return '<p class="small muted" id="pastlist">No uploaded invoices yet.</p>';
  return '<div class="tw"><table id="pastlist"><tr><th>Client</th><th>Invoice #</th><th>Invoice date</th><th>Work period</th><th>Total</th><th>Status</th><th>File</th><th></th></tr>'+l.map(function(i){var st=clientInvStatus(i);
    return '<tr data-past="'+esc(i.number)+'"><td>'+esc(user(i.firmId).name)+'</td><td>'+esc(i.number)+pastPill()+'</td><td>'+esc(i.issued)+'</td><td class="small">'+esc(i.periodStart)+' – '+esc(i.periodEnd)+'</td><td>'+money(i.total)+'</td><td><span class="pill '+st.c+'">'+esc(st.t)+'</span></td><td class="small">'+esc(i.file?i.file.name:'')+'</td><td>'+pastBtns(i,true)+'</td></tr>';}).join('')+'</table></div>';}
function pastBtns(i,office){return '<span class="pastbtns"><button class="small sec" data-act="civview" data-id="'+i.id+'">View</button><button class="small sec" data-act="civpdf" data-id="'+i.id+'">Download</button>'+
  (office?'<button class="small sec" data-act="pastinvedit" data-id="'+i.id+'">Edit</button><button class="small sec rmv" data-act="pastinvdel" data-id="'+i.id+'">Remove</button>':'')+'</span>';}
function pastCard(where){var open=PAGE_STATE.pastOpen||!!PAGE_STATE.pastWarnKeep;
  return '<div class="card" id="pastinv'+(where?'-'+where:'')+'"><h2 style="margin-top:0">Upload past invoice</h2><p class="small">For work already completed and invoiced outside the app (for example a PDF made before the app). '+
  'It shows in the client invoice list marked <b>'+PAST_TAG+'</b> and in that client\'s <b>My invoices</b>, with view and download. No interest is added and the client is not sent a notice.</p>'+
  '<details class="pastdetails"'+(open?' open':'')+'><summary class="btnlike">Upload past invoice</summary>'+pastForm()+'</details>'+
  (where?'<h3>Uploaded invoices</h3>'+pastList():'')+'</div>';}

FORMS.pastinv=function(f,d){if(!pastCanUpload()){denied('pastinv');return;}
  var old=d.id?invById(d.id):null;if(d.id&&(!old||!old.uploaded)){toast('Only uploaded invoices can be edited here.');return;}
  var firm=user(d.firmId);if(!firm||firm.type!=='firm')return pastErr(f,'Choose the farm or client.');
  var number=String(d.number||'').trim();if(!number)return pastErr(f,'Enter the invoice number.');
  var dup=pastDup(firm.id,number,old&&old.id);if(dup)return pastErr(f,'Invoice number '+number+' already exists for '+firm.name+' ('+(dup.uploaded?'uploaded':'made in the app')+', '+dup.issued+'). Each invoice number can be used only once per client.');
  var iso=/^\d{4}-\d{2}-\d{2}$/;if(!iso.test(d.issued||''))return pastErr(f,'Enter the invoice date.');
  if(!iso.test(d.periodStart||'')||!iso.test(d.periodEnd||''))return pastErr(f,'Enter the work period (from and to).');
  if(d.periodEnd<d.periodStart)return pastErr(f,'Work period "to" is before "from".');
  if(d.periodEnd>today())return pastErr(f,'Past invoices are for work already completed – the work period cannot end after today.');
  if(!iso.test(d.due||''))return pastErr(f,'Enter the due date.');if(d.due<d.issued)return pastErr(f,'The due date is before the invoice date.');
  if(d.amount===''||d.hst===''||d.total==='')return pastErr(f,'Enter the amount before tax, the HST and the total.');
  var amt=pastR2(d.amount),hst=pastR2(d.hst),tot=pastR2(d.total);if(!(amt>0)||hst<0||!(tot>0))return pastErr(f,'Amounts must be numbers: amount and total above $0, HST $0 or more.');
  var paid=d.status==='Paid';if(paid&&!iso.test(d.paidAt||''))return pastErr(f,'Status is Paid – enter the paid date.');
  var off=pastR2(tot-(amt+hst));
  if(Math.abs(off)>=0.005&&!d.totalok){var w=f.querySelector('.pastwarn');w.innerHTML='<div class="alert warn" id="pasttotwarn"><b>Check the total.</b> Amount '+money(amt)+' + HST '+money(hst)+' = '+money(pastR2(amt+hst))+', but the total entered is '+money(tot)+' (off by '+money(Math.abs(off))+'). Fix the numbers, or tick the box if the invoice really shows this total.<label class="chk"><input type="checkbox" name="totalok" value="1"> The total is correct as on the invoice – save anyway</label></div>';toast('Total is not amount + HST – please check.');return;}
  var fileIn=f.file&&f.file.files&&f.file.files[0];
  if(!old&&!fileIn)return pastErr(f,'Choose the invoice file (PDF or picture).');
  if(fileIn&&!(PAST_OK_TYPE.test(fileIn.type||'')||/\.(pdf|png|jpe?g|webp)$/i.test(fileIn.name||'')))return pastErr(f,'The invoice file must be a PDF or a picture (JPG, PNG, WEBP).');
  var rec={firmId:firm.id,number:number,issued:d.issued,periodStart:d.periodStart,periodEnd:d.periodEnd,amount:amt,hst:hst,total:tot,due:d.due,paidAt:paid?d.paidAt:'',note:pastLive()?'':String(d.note||'').trim()};var liveNote=pastLive()?String(d.note||'').trim():'';
  var finish=function(file){
    if(old){var labels={firmId:'client',number:'invoice #',issued:'invoice date',periodStart:'period from',periodEnd:'period to',amount:'amount',hst:'HST',total:'total',due:'due date',paidAt:'paid date',note:'note'},ch=[];
      Object.keys(labels).forEach(function(k){var a=old[k]==null?'':old[k],b=rec[k];if(String(a)!==String(b)){var fmt=function(v){return k==='firmId'?(user(v)||{name:v}).name:/amount|hst|total/.test(k)?money(v):(v===''?'(none)':v);};ch.push(labels[k]+': '+fmt(a)+' → '+fmt(b));}});
      if(file)ch.push('file: '+(old.file?old.file.name:'')+' → '+file.name);
      Object.keys(rec).forEach(function(k){old[k]=rec[k];});if(file)old.file=file;old.editedAt=new Date().toISOString();old.editedBy=ME.name;
      audit('Edited uploaded past invoice',firm.name,number+' · '+(ch.length?ch.join('; '):'no changes')+(liveNote?' · office note: '+liveNote:'')+(Math.abs(off)>=0.005?' · total differs from amount + HST by '+money(Math.abs(off))+' (confirmed)':''));save();closeModal();toast('Invoice '+number+' updated.');render();return;}
    var inv=Object.assign({id:uid('ci'),billHours:0,interestPct:0,uploaded:true,file:file,uploadedBy:ME.name,uploadedAt:new Date().toISOString()},rec);
    (DB.clientInvoices=DB.clientInvoices||[]).push(inv);
    audit('Uploaded past invoice',firm.name,number+' · '+d.periodStart+' to '+d.periodEnd+' · '+money(amt)+' + HST '+money(hst)+' = '+money(tot)+' · '+(paid?'Paid '+d.paidAt:'Unpaid, due '+d.due)+' · file '+file.name+(liveNote?' · office note: '+liveNote:'')+(Math.abs(off)>=0.005?' · total differs from amount + HST by '+money(Math.abs(off))+' (confirmed)':''));
    save();PAGE_STATE.pastOpen=false;toast('Past invoice '+number+' uploaded for '+firm.name+'.');render();};
  if(fileIn)readUpload(fileIn,function(file){if(!file)return;finish(file);});else finish(null);};
ACT.pastinvedit=function(el){if(!pastCanUpload())return;var i=invById(el.dataset.id);if(!i||!i.uploaded)return;modal('<h2>Edit uploaded invoice '+esc(i.number)+'</h2>'+pastForm(i));};
ACT.pastinvdel=function(el){if(!pastCanUpload())return;var i=invById(el.dataset.id);if(!i||!i.uploaded)return;
  modal('<h2>Remove uploaded invoice?</h2><p>Invoice <b>'+esc(i.number)+'</b> for '+esc(user(i.firmId).name)+' ('+money(i.total)+', file '+esc(i.file?i.file.name:'')+') will be removed from the office list and from the client\'s My invoices. This is written to the audit log.</p><p class="row"><button class="danger" data-act="pastinvdelok" data-id="'+i.id+'">Remove invoice</button><button class="sec" data-act="closeModal">Keep it</button></p>');};
ACT.pastinvdelok=function(el){if(!pastCanUpload())return;var i=invById(el.dataset.id);if(!i||!i.uploaded)return;
  DB.clientInvoices=DB.clientInvoices.filter(function(x){return x.id!==i.id;});audit('Removed uploaded past invoice',user(i.firmId).name,i.number+' · '+i.issued+' · '+money(i.total)+' · file '+(i.file?i.file.name:''));save();closeModal();toast('Invoice '+i.number+' removed.');render();};
ACT.pastopen=function(){PAGE_STATE.pastOpen=true;render();};
ADMIN_ONLY_FORM.push('pastinv');ADMIN_ONLY_ACT.push('pastinvedit','pastinvdel','pastinvdelok','pastopen');

/* view + download: uploaded invoices show/download the stored file (same permission check as other invoices) */
(function(){var ov=ACT.civview,op=ACT.civpdf;
  ACT.civview=function(el){var i=invById(el.dataset.id);if(!i||!i.uploaded)return ov(el);if(!invAllowed(i)){invDenied(i);return;}
    audit('Viewed uploaded invoice',user(i.firmId).name,i.number);save();pastWithUrl(i,function(url){var st=invPlain(i),img=i.file&&/^image\//.test(i.file.type);
    modal('<div class="pastview"><h2 style="margin:0">Invoice '+esc(i.number)+pastPill()+'</h2><div class="small muted">'+esc(user(i.firmId).name)+'</div>'+
      '<div class="invrow"><span>Invoice date</span><b>'+esc(i.issued)+'</b></div><div class="invrow"><span>Work period</span><b>'+esc(i.periodStart)+' – '+esc(i.periodEnd)+'</b></div>'+
      '<div class="invrow"><span>Amount before tax</span><b>'+money(i.amount)+'</b></div><div class="invrow"><span>HST</span><b>'+money(i.hst)+'</b></div><div class="invrow tot"><span>Total</span><b>'+money(i.total)+'</b></div>'+
      '<div class="invrow"><span>Status</span><b><span class="pill '+st.c+'">'+esc(st.t)+'</span> '+esc(st.d)+'</b></div>'+
      (ME.type==='admin'&&i.note?'<div class="pastnote"><b>Office note</b> (not shown to the client): '+esc(i.note)+'</div>':'')+
      (url?(img?'<img class="pastprev" src="'+url+'" alt="Invoice '+esc(i.number)+'">':'<iframe class="pastprev" src="'+url+'" title="Invoice '+esc(i.number)+'"></iframe>'):'<p class="muted">'+(i.file?'Could not open the file – you may not have access, or it is no longer available.':'No file.')+'</p>')+
      '<p class="row"><button data-act="civpdf" data-id="'+i.id+'">Download '+(img?'picture':'PDF')+'</button>'+(pastCanUpload()?'<button class="sec" data-act="pastinvedit" data-id="'+i.id+'">Edit</button>':'')+'</p></div>');});};
  ACT.civpdf=function(el){var i=invById(el.dataset.id);if(!i||!i.uploaded)return op(el);if(!invAllowed(i)){invDenied(i);return;}if(!i.file){toast('No file stored for this invoice.');return;}
    var name=pastFileName(i);pastWithUrl(i,function(url){if(!url){toast('Could not open the file – you may not have access, or it is no longer available.');return;}var a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},100);
    PAGE_STATE.lastDownload={name:name,size:i.file.data.length,type:i.file.type,uploaded:true};audit('Downloaded uploaded invoice file',user(i.firmId).name,i.number+' · '+name);save();toast('Downloaded: '+name);});};})();

/* office + client tables: mark uploaded rows, add view/download (office: edit/remove too); office pages get the upload card */
(function(){var oh=clientInvoicesHtml;clientInvoicesHtml=function(firm,office){var x=oh(firm,office);
  clientInvs(firm).forEach(function(i){if(!i.uploaded)return;var f=user(i.firmId);
    var key='<tr data-inv="'+esc(i.number)+'">'+(office?'<td>'+esc(f?f.name:'')+'</td>':'')+'<td>'+esc(i.number)+'</td>';var at=x.indexOf(key);if(at<0)return;
    var end=x.indexOf('</tr>',at);var row=x.slice(at,end);
    var nrow=row.replace(key,'<tr data-inv="'+esc(i.number)+'" data-uploaded="1" class="uplrow">'+(office?'<td>'+esc(f?f.name:'')+'</td>':'')+'<td class="uplnum"><div class="uplwrap"><span class="uplno">'+esc(i.number)+'</span>'+pastPill()+pastBtns(i,!!office&&pastCanUpload())+'</div></td>');
    x=x.slice(0,at)+nrow+x.slice(end);});
  if(office&&pastCanUpload())x+=pastCard('');return x;};})();
(function(){var oi=VIEWS['admin:invoicesadmin'];VIEWS['admin:invoicesadmin']=function(){var x=oi();return pastCanUpload()?x+'<h2 id="clientpastinvh">Client invoices for past work</h2>'+pastCard('inv'):x;};})();
(function(){var om=VIEWS['firm:invoices'];VIEWS['firm:invoices']=function(){var x=om();
  myInvoices(ME).forEach(function(i){if(!i.uploaded)return;
    x=x.replace('data-act="civview" data-id="'+i.id+'"><span class="ih"><b>'+esc(i.number)+'</b>','data-act="civview" data-id="'+i.id+'"><span class="ih"><b>'+esc(i.number)+'</b>'+pastPill());
    x=x.replace('data-act="civpdf" data-id="'+i.id+'">Download PDF','data-act="civpdf" data-id="'+i.id+'">Download file');});
  return x.replace('Tap one to see it or download a PDF.','Tap one to see it or download it. Invoices marked “'+PAST_TAG+'” were made before this app – you get the original file.');};})();
/* app-made monthly invoices never reuse a number already on file for that client (e.g. an uploaded one) */
(function(){var oc=FORMS.clientinv;FORMS.clientinv=function(f,d){var n=(DB.clientInvoices||[]).length;oc(f,d);var L=DB.clientInvoices||[];if(L.length>n){var inv=L[L.length-1];
  if(pastDup(inv.firmId,inv.number,inv.id)){var base=inv.number,k=2;while(pastDup(inv.firmId,base+'-'+k,inv.id))k++;var nn=base+'-'+k;audit('Invoice number adjusted (already on file for client)',user(inv.firmId).name,base+' → '+nn);inv.number=nn;save();render();}}};})();
