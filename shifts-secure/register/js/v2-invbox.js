/* v2-invbox.js – invbox1 (owner Oct 19 2026, 6:17 PM): "I want invoices for each to show up just like All hours by farm and then by month."
   + "get rid of industry per client, add that functionality some other place."  TEST COPY, front end only, no SQL.
   1. FARM INVOICES AS BOXES. The office farm-invoice table (#clientinvtable: "Farms & other clients" and now also the top of
      "Invoices") and the Office Assistant status table (#ohinv) first show ONE BOX PER FARM (codes + name; Assistant: code only,
      no money). Tap a farm → its months (newest first, count, amount / HST / total, paid vs unpaid). Tap a month → that farm's
      invoices for the month, using the SAME table rows, so View / PDF / Revise / Delete (paid block) / Mark paid stay as they are.
      Month = WORK month: the month with the most days of the work period (tie → earlier month); no period → invoice date.
      Which invoices show is unchanged: only rows the existing table already shows (deleted hidden, owner-only rule, uploads, revised).
   2. INDUSTRY. The "Industry per client" table is gone from Farms & other clients. Industry is now set on each farm's own page
      (People → Open a farm → Details), same form + same save (FORMS.clienttype). The Assistant sees it read-only.
   Load after v2-hourboxes.js / v2-personpage.js. Turn off: remove the 2 lines in index.html. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return typeof esc==='function'?esc(s==null?'':String(s)):String(s==null?'':s);}
function helper(){return typeof window.ohIs==='function'&&window.ohIs();}
function S(){return PAGE_STATE.ib2=PAGE_STATE.ib2||{};}
function M$(x){return typeof money==='function'?money(+x||0):'$'+(+x||0).toFixed(2);}
var MN=['January','February','March','April','May','June','July','August','September','October','November','December'];
/* WORK month (owner 6:39 PM): the month holding the most days of the work period (tie → the earlier month).
   Only one date → that date's month. No period at all → invoice date (issued). */
function ymd(d){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(d||''));return m?new Date(+m[1],+m[2]-1,+m[3]):null;}
function monthOf(i){var a=ymd(i.periodStart),b=ymd(i.periodEnd);if(a&&b&&b<a){var t=a;a=b;b=t;}a=a||b;b=b||a;
  if(!a){var d=String(i.issued||'');return /^\d{4}-\d{2}/.test(d)?d.slice(0,7):'';}
  var cnt={},best='',bn=0,x=new Date(a.getTime()),k;for(var n=0;x<=b&&n<400;n++){k=x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');cnt[k]=(cnt[k]||0)+1;if(cnt[k]>bn){bn=cnt[k];best=k;}x.setDate(x.getDate()+1);}
  return best;}
window.ibMonthOf=function(i){return monthOf(i);};
function monthLabel(m){if(!m)return 'No date';return MN[+m.slice(5,7)-1]+' '+m.slice(0,4)+' work';}
function codesOf(f){return (DB.sites||[]).filter(function(s){return f&&s.firmId===f.id;}).map(function(s){return s.code;});}
function codeLabel(f){if(helper())return 'Farm '+(typeof ohCodeOf==='function'?ohCodeOf(f):(codesOf(f)[0]||'?'));var c=codesOf(f);return c.length?c.join(', '):(f&&f.firm&&f.firm.clientCode)||'–';}
function nameOf(f){return helper()||!f?'':(f.name||'');}
function invByRow(r,oh){var L=DB.clientInvoices||[];
  if(oh){var num=(r.cells[0]&&r.cells[0].textContent||'').trim(),code=(r.cells[1]&&r.cells[1].textContent||'').trim();
    var c=L.filter(function(i){return String(i.number||'')===num;});if(c.length>1)c=c.filter(function(i){return codeLabel(user(i.firmId))===code;})||c;return c[0]||null;}
  var n=r.getAttribute('data-inv'),cl=r.querySelector('td[data-label=Client]')||r.cells[0],nm=(cl&&cl.textContent||'').trim();
  var c2=L.filter(function(i){return String(i.number||'')===n;});if(c2.length>1){var k=c2.filter(function(i){var f=user(i.firmId);return f&&f.name===nm;});if(k.length)c2=k;}return c2[0]||null;}
/* invmonth1 (owner Oct 20 2026, 10:27 PM): "invoices by month first and then by farm, also show me farms that had the workers
   punched in but no invoices made for a particular month". Month boxes (newest first, same WORK-month rule) → farms in that month
   → that farm's invoices for the month (same table rows, same buttons). Inside a month, farms with shifts that month (clocked,
   manual, unassigned, waiting approval; removed/voided not counted – same hours the invoice uses, firmReport) but NO invoice
   whose period touches that month show as a red "No invoice yet" box with hours + workers (no money). Owner gets a
   "Create invoice" shortcut (same preview + create as the form). Office Assistant: codes only, no money, no shortcut.
   The farm's own "Your invoices" list (#myclientinv) is unchanged. */
function canMake(oh){return !oh&&!helper()&&typeof FORMS!=='undefined'&&typeof FORMS.clientinv==='function'&&!(typeof window.ivBlocked==='function'&&window.ivBlocked());}
function mEnd(m){var d=new Date(+m.slice(0,4),+m.slice(5,7),0);return m+'-'+String(d.getDate()).padStart(2,'0');}
function touches(i,m){var a=String(i.periodStart||''),b=String(i.periodEnd||a);if(!a)return monthOf(i)===m;if(b<a){var t=a;a=b;b=t;}return a<=mEnd(m)&&b>=m+'-01';}
function missing(M){var out={},seen={},inv=DB.clientInvoices||[];if(typeof firmReport!=='function'||typeof siteFirm!=='function')return out;
  (DB.time||[]).forEach(function(t){if(!t||t.removed||t.voided||t.deleted||!t.date)return;var site=t.site||shSite(t.shiftId),f=site&&siteFirm(site);if(!f||f.type!=='firm'||!f.firm)return;seen[f.id+'|'+String(t.date).slice(0,7)]=f;});
  Object.keys(seen).forEach(function(k){var f=seen[k],m=k.slice(k.indexOf('|')+1);
    if(inv.some(function(i){return i.firmId===f.id&&!i.deleted&&!i.deletedAt&&touches(i,m);}))return;
    var R;try{R=firmReport(f,m+'-01',mEnd(m));}catch(e){return;}if(!R||!(R.tot.hours>0))return;
    (out[m]=out[m]||[]).push({fid:f.id,f:f,hours:R.tot.hours,workers:R.tot.unique||0});});
  return out;}
function shSite(id){var s=(DB.shifts||[]).filter(function(x){return x.id===id;})[0];return s?s.site:'';}
function build(tb,oh){var rows=[].slice.call(tb.querySelectorAll('tr')),Mo={},last=null,all=[];
  function mo(m){return Mo[m]=Mo[m]||{m:m,n:0,amt:0,hst:0,tot:0,paid:0,unp:0,np:0,nu:0,late:0,farms:{},miss:[]};}
  rows.forEach(function(r){if(r.querySelector('th'))return;var main=oh?r.cells.length>1:r.hasAttribute('data-inv');
    if(!main){if(last){last.rows.push(r);all.push(r);}return;}
    var i=invByRow(r,oh);if(!i){last=null;return;}var fid=i.firmId||'?',o=mo(monthOf(i));
    var g=o.farms[fid]=o.farms[fid]||{fid:fid,f:user(fid),n:0,tot:0,amt:0,hst:0,paid:0,unp:0,due:0,late:0,items:[]};
    var it={i:i,rows:[r]};g.items.push(it);last=it;all.push(r);
    var paid=!!i.paidAt,t=+i.total||0,late=!paid&&i.due&&typeof today==='function'&&i.due<today();
    g.n++;g.tot+=t;g.amt+=+i.amount||0;g.hst+=+i.hst||0;if(paid)g.paid+=t;else{g.unp+=t;g.due++;if(late)g.late++;}
    o.n++;o.amt+=+i.amount||0;o.hst+=+i.hst||0;o.tot+=t;if(paid){o.paid+=t;o.np++;}else{o.unp+=t;o.nu++;if(late)o.late++;}});
  var X=missing();Object.keys(X).forEach(function(m){mo(m).miss=X[m];});
  return {Mo:Mo,all:all};}
function h2(x){return (Math.round((+x||0)*100)/100).toFixed(2);}
function curMonth(){return typeof today==='function'?today().slice(0,7):'';}
function monthList(M,oh){var L=Object.keys(M.Mo).sort().reverse();if(!L.length)return '<p class="muted">No invoices yet.</p>';
  return '<div class="ib-months">'+L.map(function(k){var m=M.Mo[k],nf=Object.keys(m.farms).length,nm=m.miss.length;
    return '<button type="button" class="ib-month'+(nm?' ib-month-miss':'')+'" data-ib-month="'+E(k)+'" aria-label="'+E(monthLabel(k)+': '+m.n+' invoices, '+nf+' farms'+(nm?', '+nm+' farms with no invoice yet':''))+'"><span class="ib-mname">'+E(monthLabel(k))+(k===curMonth()?' <small>(month not over)</small>':'')+'</span>'+
      '<span class="ib-mn">'+m.n+(m.n===1?' invoice':' invoices')+' · '+nf+(nf===1?' farm':' farms')+'</span>'+
      (oh?'':'<span class="ib-mm">Amount '+M$(m.amt)+' · HST '+M$(m.hst)+' · <b>Total '+M$(m.tot)+'</b></span>')+
      '<span class="ib-mp">'+(m.np?'<span class="pill s-ok">Paid'+(oh?' '+m.np:' '+M$(m.paid))+'</span> ':'')+(m.nu?'<span class="pill s-pend">Not paid'+(oh?' '+m.nu:' '+M$(m.unp))+'</span>':'')+'</span>'+
      (nm?'<span class="ib-missn">'+nm+(nm===1?' farm':' farms')+' with no invoice yet</span>':'')+'</button>';}).join('')+'</div>';}
function farmBoxes(o,oh,q){var L=Object.keys(o.farms).map(function(k){return o.farms[k];}).sort(function(a,b){return codeLabel(a.f).localeCompare(codeLabel(b.f));}),X=o.miss.slice().sort(function(a,b){return codeLabel(a.f).localeCompare(codeLabel(b.f));});
  function hit(f){return !q||(codeLabel(f)+' '+nameOf(f)).toLowerCase().indexOf(q)>=0;}
  L=L.filter(function(g){return hit(g.f);});X=X.filter(function(g){return hit(g.f);});
  if(!L.length&&!X.length)return '<p class="muted">No farm matches.</p>';var mk=canMake(oh);
  return '<div class="cb-grid ib-grid">'+X.map(function(g){var nm=nameOf(g.f);
    return '<div class="cb-box ib-box ib-miss" data-ib-missfarm="'+E(g.fid)+'" role="group" aria-label="'+E(codeLabel(g.f)+(nm?' '+nm:'')+': no invoice yet, '+h2(g.hours)+' hours, '+g.workers+' workers')+'"><span class="ib-badge ib-badge-miss">No invoice yet</span>'+
      '<span class="cb-code">'+E(codeLabel(g.f))+'</span>'+(nm?'<span class="ib-name">'+E(nm)+'</span>':'')+
      '<span class="ib-n"><b>'+h2(g.hours)+'</b> h · <b>'+g.workers+'</b> '+(g.workers===1?'worker':'workers')+'</span>'+
      (mk&&o.m?'<button type="button" class="small ib-mkinv" data-ib-mk="'+E(g.fid)+'" data-ib-mkm="'+E(o.m)+'">Create invoice</button>':'')+'</div>';}).join('')+
    L.map(function(g){var nm=nameOf(g.f);
    return '<button type="button" class="cb-box ib-box'+(g.late?' ib-late':'')+'" data-ib-farm="'+E(g.fid)+'" aria-label="'+E(codeLabel(g.f)+(nm?' '+nm:'')+': '+g.n+' invoices'+(g.due?', '+g.due+' not paid':''))+'">'+
      (g.due?'<span class="ib-badge'+(g.late?' ib-badge-late':'')+'">'+(oh?g.due+' not paid':M$(g.unp)+' not paid')+'</span>':'<span class="ib-badge ib-badge-ok">All paid</span>')+
      '<span class="cb-code">'+E(codeLabel(g.f))+'</span>'+(nm?'<span class="ib-name">'+E(nm)+'</span>':'')+
      '<span class="ib-n"><b>'+g.n+'</b> '+(g.n===1?'invoice':'invoices')+'</span>'+(oh?'':'<span class="ib-tot">Total '+M$(g.tot)+'</span>')+'</button>';}).join('')+'</div>';}
function enhance(){['clientinvtable','ohinv'].forEach(function(id){var tb=document.getElementById(id);if(!tb||tb.dataset.ib)return;tb.dataset.ib='1';draw(tb,id==='ohinv');});}
function draw(tb,oh){var tw=tb.closest('.tw')||tb,M=build(tb,oh),s=S(),old=tw.parentNode.querySelector('.ib-wrap');if(old)old.remove();
  if(s.m!=null&&!M.Mo[s.m])s.m=s.f=null;if(s.m!=null&&s.f&&!M.Mo[s.m].farms[s.f])s.f=null;
  var w=document.createElement('div');w.className='ib-wrap';tw.parentNode.insertBefore(w,tw);
  if(!Object.keys(M.Mo).length){w.remove();return;}
  M.all.forEach(function(r){r.style.display='';});
  if(s.m==null){w.innerHTML='<p class="small muted ib-hint">Months are the month the work was done. Tap a month to see its farms.</p>'+monthList(M,oh);tw.style.display='none';return;}
  var o=M.Mo[s.m],nf=Object.keys(o.farms).length;
  if(!s.f){w.innerHTML='<div class="cb-head ib-head"><button type="button" class="small sec" data-ib-back="month">← All months</button><h3>'+E(monthLabel(s.m))+' · '+o.n+(o.n===1?' invoice':' invoices')+' · '+nf+(nf===1?' farm':' farms')+'</h3></div>'+
      (oh?'':'<p class="small ib-sum">Amount '+M$(o.amt)+' · HST '+M$(o.hst)+' · <b>Total '+M$(o.tot)+'</b> · Paid '+M$(o.paid)+' · Not paid '+M$(o.unp)+'</p>')+
      (o.miss.length?'<p class="small ib-misshint"><b>'+o.miss.length+(o.miss.length===1?' farm':' farms')+'</b> had workers this month but no invoice yet (red boxes).'+(s.m===curMonth()?' This month is not over yet.':'')+'</p>':'')+
      '<div class="row ib-search"><input type="search" class="ib-q" placeholder="Find farm (code or name)" aria-label="Find farm" value="'+E(s.q||'')+'"></div><div class="ib-farms">'+farmBoxes(o,oh,String(s.q||'').toLowerCase())+'</div>';
    tw.style.display='none';w._o=o;w._oh=oh;return;}
  var g=o.farms[s.f],nm=nameOf(g.f),head='<span class="cb-code">'+E(codeLabel(g.f))+'</span>'+(nm?' <small>'+E(nm)+'</small>':''),keep=[];g.items.forEach(function(it){keep=keep.concat(it.rows);});
  M.all.forEach(function(r){if(keep.indexOf(r)<0)r.style.display='none';});tw.style.display='';
  w.innerHTML='<div class="cb-head ib-head"><button type="button" class="small sec" data-ib-back="farm">← Farms in '+E(monthLabel(s.m).replace(/ work$/,''))+'</button><button type="button" class="small sec" data-ib-back="month">← All months</button><h3>'+head+' · '+E(monthLabel(s.m))+' · '+g.n+(g.n===1?' invoice':' invoices')+'</h3></div>'+
    (oh?'':'<p class="small ib-sum">Amount '+M$(g.amt)+' · HST '+M$(g.hst)+' · <b>Total '+M$(g.tot)+'</b> · Paid '+M$(g.paid)+' · Not paid '+M$(g.unp)+'</p>');}
function redraw(){['clientinvtable','ohinv'].forEach(function(id){var tb=document.getElementById(id);if(tb)draw(tb,id==='ohinv');});}
function top(){var w=document.querySelector('.ib-wrap');if(w){var t=w.getBoundingClientRect().top;if(t<0||t>innerHeight*0.5)w.scrollIntoView({block:'start'});}}
document.addEventListener('click',function(e){if(!e.target.closest)return;var b=e.target.closest('.ib-wrap [data-ib-mk]'),s=S();
  if(b){if(!canMake(false))return;FORMS.clientinv(null,{firmId:b.getAttribute('data-ib-mk'),month:b.getAttribute('data-ib-mkm')});return;}
  b=e.target.closest('.ib-wrap [data-ib-month]');if(b){s.m=b.getAttribute('data-ib-month');s.f=null;s.q='';redraw();top();return;}
  b=e.target.closest('.ib-wrap [data-ib-farm]');if(b){s.f=b.getAttribute('data-ib-farm');redraw();top();return;}
  b=e.target.closest('.ib-wrap [data-ib-back]');if(b){if(b.getAttribute('data-ib-back')==='month')s.m=null;s.f=null;redraw();top();}});
document.addEventListener('input',function(e){var q=e.target.closest&&e.target.closest('.ib-wrap .ib-q');if(!q)return;var w=q.closest('.ib-wrap');S().q=q.value;
  var box=w.querySelector('.ib-farms');if(box&&w._o)box.innerHTML=farmBoxes(w._o,w._oh,q.value.toLowerCase());});
new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});

/* Invoices page (full office, owner rule): the farm invoice boxes on top, same card as Farms & other clients (no 2nd upload card) */
(function(){var oi=VIEWS['admin:invoicesadmin'];if(!oi||typeof clientInvoicesHtml!=='function')return;VIEWS['admin:invoicesadmin']=function(){var x=oi.apply(this,arguments);
  try{if(helper()||(typeof window.ivBlocked==='function'&&window.ivBlocked()))return x;var c=window.clientInvoicesHtml(null,true),p=c.indexOf('<div class="card" id="pastinv"');if(p>=0)c=c.slice(0,p);
    c=c.replace(/<div class="alert warn small" id="scinvflags">[\s\S]*?<\/div>/,'');
    c=c.replace('<h2 style="margin-top:0">Client invoices</h2>','<h2 style="margin-top:0">Farm invoices</h2>');
    var at=x.indexOf('<h1>Subcontractor invoices</h1>');return at>=0?x.slice(0,at)+'<h1 id="ibh1">Invoices</h1>'+c+x.slice(at):c+x;}catch(e){try{console.warn('[invbox]',e);}catch(z){}return x;}};})();

/* ---------- 2. Industry: off Farms & other clients, onto the farm's own page ---------- */
(function(){var of=VIEWS['admin:firms'];if(!of)return;VIEWS['admin:firms']=function(){var x=of.apply(this,arguments),i=x.indexOf('<div class="card" id="clienttypes">');
  if(i<0)return x;var end=x.indexOf('</table></div></div>',i);if(end<0)return x;end+='</table></div></div>'.length;
  return x.slice(0,i)+'<p class="small muted" id="ibindnote">Industry (Farm, Construction, Cleaning…) is now on each farm\'s own page: People → Open the farm → Details.</p>'+x.slice(end);};})();
(function(){var ov=VIEWS['admin:people'];if(!ov)return;VIEWS['admin:people']=function(){var x=ov.apply(this,arguments);
  try{var s=PAGE_STATE.pp,u=s&&user(s.id);if(!u||u.type!=='firm'||(s.tab&&s.tab!=='details')||typeof clientTypeOf!=='function')return x;var cur=clientTypeOf(u);
    var card='<div class="card" id="ppindustry"><h3 style="margin-top:0">Industry</h3>'+(helper()?'<p><b>'+E(cur)+'</b></p>':
      '<p class="small muted">Farm is the default. Change it if this client is a different kind of business. (The list is in Settings.)</p><form data-form="clienttype" class="row"><input type="hidden" name="id" value="'+E(u.id)+'">'+clientSel('clientType',cur)+'<button class="small">Save</button></form>')+'</div>';
    var at=x.indexOf('<div class="card pp-facts">');if(at<0)return x+card;var e2=x.indexOf('</div></div>',at);return e2<0?x+card:x.slice(0,e2+12)+card+x.slice(e2+12);}catch(e){return x;}};})();
})();
