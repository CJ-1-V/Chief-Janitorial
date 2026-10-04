/* v2-clientinvoices.js – "My invoices" for every client (farms first). TEST ONLY, fake data, local only.
   - Newest first: invoice number, period, total, status (Paid / Unpaid / Overdue). Tap to view; Download PDF (made in the browser,
     nothing is sent) or Print. A client only ever sees its own invoices. Client-safe content only: no worker names, no internal notes. */
'use strict';
function invPlain(i){if(i.paidAt)return {t:'Paid',c:'s-ok',d:'Paid '+i.paidAt};var o=daysBetween(i.due,today());return o>0?{t:'Overdue',c:'s-bad',d:'Overdue '+o+' days (due '+i.due+')'}:{t:'Unpaid',c:'s-pend',d:'Due '+i.due};}
function invById(id){return (DB.clientInvoices||[]).filter(function(x){return x.id===id;})[0]||null;}
function invAllowed(i){return !!(i&&ME&&(ME.type==='admin'||(ME.type==='firm'&&i.firmId===ME.id)));}
function invDenied(i){toast('Not allowed – you can only see your own invoices.');if(ME){audit('Blocked invoice access (not own invoice)',ME.name,i?i.number:'');save();}}
function myInvoices(firm){return clientInvs(firm).slice().sort(function(a,b){return a.issued<b.issued?1:a.issued>b.issued?-1:a.number<b.number?1:-1;});}
/* client-safe invoice content (shared by the screen view, print view and PDF) */
function invDoc(i){var f=user(i.firmId),st=invPlain(i),it=clientInvInterest(i),c=CB();var L=[];
  L.push(['h','UnScramble – The HR Company Inc.']);L.push(['s','TEST VERSION – sample invoice made by the test app, not a real invoice']);L.push(['g']);
  L.push(['b','Invoice '+i.number]);L.push(['t','Bill to: '+(f?f.name:'')]);L.push(['t','Period: '+i.periodStart+' to '+i.periodEnd]);L.push(['t','Issued: '+i.issued+'    Due: '+i.due]);L.push(['t','Status: '+st.d]);L.push(['g']);
  L.push(['r','Labour services – billable hours: '+(+i.billHours||0).toFixed(2)+' h',money(i.amount-(i.lateLines||[]).reduce(function(a,l){return a+l.amount;},0))]);
  (i.lateLines||[]).forEach(function(l){L.push(['r','  '+l.date+' '+l.site+' – '+l.bill.toFixed(2)+' h ('+l.note+')',money(l.amount)]);});
  L.push(['r','Subtotal',money(i.amount)]);L.push(['r',i.hst?'HST 15%':'HST (not charged)',money(i.hst)]);L.push(['rb','Invoice total',money(i.total)]);
  if(it.amount&&!i.paidAt)L.push(['r','Interest on overdue amount ('+it.months+' month(s) × '+(i.interestPct!=null?i.interestPct:c.interestPct)+'%)',money(it.amount)]);
  if(i.paidAt&&i.interestCharged)L.push(['r','Interest charged when paid',money(i.interestCharged)]);
  L.push(['rb','Now owing',money(i.paidAt?0:i.total+it.amount)]);L.push(['g']);
  L.push(['s','Payable within '+c.netDays+' days. Interest of '+c.interestPct+'% per month on invoices not paid by the due date (Independent Contractor Service Agreement, s. 3).']);
  L.push(['s','Worker names are not shown on client invoices.']);return L;}
function invHtml(i){return '<div class="invdoc">'+invDoc(i).map(function(l){var k=l[0];if(k==='h')return '<h2 style="margin:0">'+esc(l[1])+'</h2>';if(k==='s')return '<div class="small muted">'+esc(l[1])+'</div>';if(k==='g')return '<hr>';if(k==='b')return '<h3 style="margin:4px 0">'+esc(l[1])+'</h3>';if(k==='t')return '<div>'+esc(l[1])+'</div>';return '<div class="invrow'+(k==='rb'?' tot':'')+'"><span>'+esc(l[1])+'</span><b>'+esc(l[2])+'</b></div>';}).join('')+'</div>';}
/* tiny local PDF writer (text only, Helvetica) – no libraries, nothing leaves the browser */
function pdfTxt(s){return String(s).replace(/[–—]/g,'-').replace(/×/g,'x').replace(/[^\x20-\x7E]/g,'').replace(/([\\()])/g,'\\$1');}
function invPdf(i){var ops=[],pages=[],y=790;var flush=function(){pages.push(ops.join('\n'));ops=[];y=790;};
  var text=function(x,yy,size,bold,s){ops.push('BT /'+(bold?'F2':'F1')+' '+size+' Tf '+x+' '+yy+' Td ('+pdfTxt(s)+') Tj ET');};
  var wrap=function(s,n){var out=[],line='';String(s).split(' ').forEach(function(w){if((line+' '+w).trim().length>n){out.push(line.trim());line=w;}else line+=' '+w;});if(line.trim())out.push(line.trim());return out;};
  invDoc(i).forEach(function(l){var k=l[0];if(y<70)flush();
    if(k==='h'){text(50,y,16,true,l[1]);y-=22;}else if(k==='b'){text(50,y,13,true,l[1]);y-=18;}else if(k==='g'){ops.push('0.8 G 50 '+(y+6)+' m 545 '+(y+6)+' l S 0 G');y-=12;}
    else if(k==='s'||k==='t'){wrap(l[1],k==='s'?100:85).forEach(function(w){if(y<70)flush();text(50,y,k==='s'?8.5:10.5,false,w);y-=k==='s'?12:15;});}
    else{wrap(l[1],70).forEach(function(w,ix){if(y<70)flush();text(50,y,10.5,k==='rb',w);if(ix===0)text(470,y,10.5,k==='rb',l[2]);y-=15;});}});
  flush();var objs=[],n=pages.length;
  objs[1]='<< /Type /Catalog /Pages 2 0 R >>';objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>';objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>';
  var kids=[];pages.forEach(function(c,ix){var po=5+ix*2,co=po+1;kids.push(po+' 0 R');objs[po]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents '+co+' 0 R >>';objs[co]='<< /Length '+c.length+' >>\nstream\n'+c+'\nendstream';});
  objs[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+n+' >>';
  var out='%PDF-1.4\n',off=[];for(var k=1;k<objs.length;k++){off[k]=out.length;out+=k+' 0 obj\n'+objs[k]+'\nendobj\n';}
  var xref=out.length;out+='xref\n0 '+objs.length+'\n0000000000 65535 f \n';for(k=1;k<objs.length;k++)out+=String(off[k]).padStart(10,'0')+' 00000 n \n';
  out+='trailer\n<< /Size '+objs.length+' /Root 1 0 R /Info << /Title ('+pdfTxt('Invoice '+i.number)+') /Producer (UnScramble test app) >> >>\nstartxref\n'+xref+'\n%%EOF';return out;}
function invFileName(i){var f=user(i.firmId);return 'Invoice-'+i.number+'-'+String(f?f.name:'client').replace(/[^A-Za-z0-9]+/g,'-').replace(/-+$/,'')+'-TEST.pdf';}

VIEWS['firm:invoices']=function(){var l=myInvoices(ME);
  var x='<h1>My invoices</h1><p class="small muted">All your invoices, newest first. Tap one to see it or download a PDF.</p>'+
  (l.length?'<div id="myinvlist">'+l.map(function(i){var st=invPlain(i);return '<div class="invcard" data-inv="'+esc(i.number)+'"><button class="invopen" data-act="civview" data-id="'+i.id+'"><span class="ih"><b>'+esc(i.number)+'</b><span class="pill '+st.c+'">'+st.t+'</span></span><span class="small">'+esc(i.periodStart)+' – '+esc(i.periodEnd)+'</span><span class="it">'+money(i.total)+'</span></button><button class="small sec" data-act="civpdf" data-id="'+i.id+'">Download PDF</button></div>';}).join('')+'</div>':'<p class="muted" id="myinvlist">No invoices yet.</p>');
  return clientWord(x,ME);};
NAV.firm.splice(NAV.firm.length-1,0,['#/invoices','My invoices']);
ACT.civview=function(el){var i=invById(el.dataset.id);if(!invAllowed(i)){invDenied(i);return;}audit('Viewed client invoice',user(i.firmId).name,i.number);save();
  modal(invHtml(i)+'<p class="row"><button data-act="civpdf" data-id="'+i.id+'">Download PDF</button><button class="sec" data-act="civprint" data-id="'+i.id+'">Print</button></p>');};
ACT.civpdf=function(el){var i=invById(el.dataset.id);if(!invAllowed(i)){invDenied(i);return;}var pdf=invPdf(i),name=invFileName(i);
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([pdf],{type:'application/pdf'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},100);
  PAGE_STATE.lastDownload={name:name,size:pdf.length,pdf:pdf};audit('Downloaded client invoice PDF',user(i.firmId).name,i.number);save();toast('PDF downloaded: '+name);};
ACT.civprint=function(el){var i=invById(el.dataset.id);if(!invAllowed(i)){invDenied(i);return;}var w=window.open('','_blank');if(!w){toast('Pop-up blocked – use Download PDF instead.');return;}
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invoice '+esc(i.number)+'</title><style>body{font:14px/1.5 Arial,sans-serif;max-width:720px;margin:24px auto;color:#111}.invrow{display:flex;justify-content:space-between;border-bottom:1px solid #eee;padding:4px 0}.tot{font-weight:bold}.small{font-size:12px;color:#555}</style></head><body>'+invHtml(i)+'</body></html>');w.document.close();w.focus();setTimeout(function(){try{w.print();}catch(e){}},300);};

/* seed: a few more fake past invoices (firmA + Sample Orchard Farm) */
function seedMoreInvoices(db){db.clientInvoices=db.clientInvoices||[];if(db.clientInvoices.some(function(i){return i.number==='UC-SAMPLE-003';}))return;var by=function(n){return db.users.filter(function(u){return u.username===n;})[0];};var A=by('firmA'),O=by('clientFarm');
  var mk=function(f,no,s,e,h,amt,iss,due,paid){var hst=Math.round(amt*15)/100;db.clientInvoices.push({id:uid('ci'),firmId:f.id,number:no,periodStart:addDays(today(),s),periodEnd:addDays(today(),e),billHours:h,amount:amt,hst:hst,total:Math.round((amt+hst)*100)/100,issued:addDays(today(),iss),due:addDays(today(),due),interestPct:2,paidAt:paid==null?'':addDays(today(),paid),sample:true});};
  if(A)mk(A,'UC-SAMPLE-003',-135,-106,120,2940,-105,-75,-80);
  if(O){mk(O,'UC-SAMPLE-101',-75,-46,96,2304,-45,-15,-20);mk(O,'UC-SAMPLE-102',-45,-16,64,1536,-15,15,null);}}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedMoreInvoices(db);};})();
(function(){var ol=load;load=function(){ol();if(DB&&!(DB.clientInvoices||[]).some(function(i){return i.number==='UC-SAMPLE-003';})){seedMoreInvoices(DB);save();}};})();
