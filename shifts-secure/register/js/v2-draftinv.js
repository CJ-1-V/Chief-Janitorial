/* v2-draftinv.js – draftinv1 (owner Oct 23 2026, 12:47 AM). TEST COPY. Front end only, no SQL. Load after v2-uninv.js, before v2-nohome.js.
   Office Invoices → month → tap a farm card that has no invoice yet (the card itself, or "Open draft") → LIVE DRAFT invoice for that
   farm + month. The numbers are firmReport() for the month – the SAME function Create invoice uses (approved changes, manual entries,
   removed / voided rows, break rules, daily minimum + waivers, job rates, HST), so the draft and the saved invoice always match.
   The timesheet below uses the app's existing Time sheets layout (v2-timesheets.js: one card per day, a row per worker with
   Start / Finish / Hours), plus the office columns Break, Billable, Job and (owner / billing only) Rate and Amount, and a per-worker summary.
   Every edit uses the EXISTING office tools, so permissions, reasons and the audit trail are unchanged and the real time entries change:
     Edit hours (ehedit, v2-edithours) · Remove (vsrm, v2-voidsync) · Job / Break pickers (jp-pos / jp-brk, v2-jobpos) ·
     Waive / undo daily minimum (mwwaive / mwundo, v2-minwaive) · + Add missing shift (miaadd, v2-mtinall manual entry).
   After each edit the page re-renders and the draft recalculates. "Create invoice" calls FORMS.clientinv (unchanged) and then checks that
   the saved total equals the draft. Office Assistant (helper): hours only – no rates, amounts or HST, and no Create button.
   Once the month has an invoice, the existing "Hours changed since this invoice" flag stays; this file makes it a prominent red banner. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function owner(){return typeof ME!=='undefined'&&ME&&ME.type==='admin'&&!helper()&&(typeof isOwner==='function'?isOwner():true);}
function office(){return typeof ME!=='undefined'&&ME&&ME.type==='admin';}
function roles(){var u=ME||{};return u.officeRoles||(u.officeRole?[u.officeRole]:[]);}
function money$(){if(!office()||helper())return false;if(typeof window.uninvCan==='function')return !!window.uninvCan();return true;}
function canMake(){return money$()&&!(typeof window.ivBlocked==='function'&&window.ivBlocked());}
function S(){return PAGE_STATE.di=PAGE_STATE.di||{};}
function mEnd(m){var d=new Date(+m.slice(0,4),+m.slice(5,7),0);return m+'-'+String(d.getDate()).padStart(2,'0');}
function h2(x){return (+x||0).toFixed(2);}
function M(x){return money(+x||0);}
function mLabel(m){return ['January','February','March','April','May','June','July','August','September','October','November','December'][+m.slice(5,7)-1]+' '+m.slice(0,4);}
function existing(f,m){return (DB.clientInvoices||[]).filter(function(i){return i&&i.firmId===f.id&&!i.deleted&&!i.deletedAt&&!i.test&&i.revStatus!=='withdrawn'&&(typeof window.ibMonthOf==='function'?window.ibMonthOf(i)===m:String(i.periodStart||'').slice(0,7)===m);});}
function tid(r){return r.key&&r.key.indexOf('t:')===0?r.key.slice(2):'';}
function entry(r){var id=tid(r);return id?(DB.time||[]).filter(function(t){return t.id===id;})[0]:null;}
function who(r){var u=user(r.uid);return u?u.name:'Worker #'+r.no;}
function brkMin(r){return Math.round((+r.brkDed||0)*60);}
function report(f,m){return firmReport(f,m+'-01',mEnd(m));}
window.draftReport=report;
function rowBtns(r){var id=tid(r),a=id?'data-id="'+E(id)+'"':'data-key="'+E(r.key)+'"';
  return '<span class="di-acts"><button class="small sec" data-act="ehedit" '+a+'>Edit hours</button> <button class="small danger" data-act="vsrm" '+a+'>Remove</button></span>';}
function pick(r,f){var p=r.pos||'labour',dis=helper()?' disabled':'';
  var opts=(typeof window.jpPositions==='function'?window.jpPositions(f):['labour']).map(function(x){return '<option value="'+E(x)+'"'+(x===p?' selected':'')+'>'+E(typeof posLabel==='function'?posLabel(x,f):x)+'</option>';}).join('');
  var b=r.brk?String(r.brk):'',bo=[['','Normal rule'],['15','15 min'],['30','30 min'],['60','60 min']].map(function(x){return '<option value="'+x[0]+'"'+(x[0]===b?' selected':'')+'>'+x[1]+'</option>';}).join('');
  return {job:'<select class="jp-pos di-sel" data-jpkey="'+E(r.key)+'" aria-label="Job"'+dis+'>'+opts+'</select>',brk:'<select class="jp-brk di-sel" data-jpkey="'+E(r.key)+'" aria-label="Break"'+dis+'>'+bo+'</select>'};}
function unlocked(fid,m){return typeof window.__diUnlocked==='function'&&window.__diUnlocked(fid,m);}
function fsHead(f,m,fin,R){return window.__diFsHead?window.__diFsHead(f,m,fin,R):'';}
function internal(){if(!money$())return false;var r=roles();if(!r.length)return !window.REG_LIVE;return r.indexOf('owner')>=0||r.indexOf('billing')>=0;}
/* owner Oct 23 1:13 AM: drivers / Balance only when workers on DIFFERENT pay rates worked at this farm this month
   (distinct pay rates set in the app >1). Everyone on one rate, or no pay rates at all → hidden. Owner / billing only. */
function payRateOf(uid){var u=user(uid);return u&&u.type==='employee'?+((u.profile||{}).payRate)||0:0;}
function mixedRates(rows){var r={};(rows||[]).forEach(function(x){var p=payRateOf(x.uid);if(p>0)r[p.toFixed(2)]=1;});return Object.keys(r).length>1;}
function drvCost(r){var u=user(r.uid);var pr=u&&u.type==='employee'?+((u.profile||{}).payRate)||0:0;return pr>0?(r.hours||0)*pr:null;}
ACT.ditog=function(el){var o=S().open=S().open||{},d=el.dataset.d;o[d]=!o[d];render();};
function chgFor(f,d,L){var keys={};(L||[]).forEach(function(r){keys[r.key]=1;});return (DB.changes||[]).filter(function(c){return c&&(keys[c.key]||(c.firmId===f.id&&c.date===d&&c.kind==='nowork'));});}
function lastBy(C){var o={};C.forEach(function(c){o[c.key||c.id]=c;});return Object.keys(o).map(function(k){return o[k];});}
function farmOk(f,d){return (DB.farmTs||[]).filter(function(x){return x.id==='day|'+f.id+'|'+d;})[0]||null;}
function span2(a,b){return (a||'?')+'–'+(b||'?');}
function chgTags(f,d,L){var C=lastBy(chgFor(f,d,L)),ap=C.filter(function(c){return c.status==='Approved'||c.status==='Adjusted';}),pe=C.filter(function(c){return c.status==='Pending';}),h='';
  if(ap.length)h+=' <span class="pill s-ok di-fchg" title="'+E(ap.map(function(c){return 'Worker #'+(c.workerNo||'?')+': was '+span2(c.origStart,c.origEnd)+' → now '+span2(c.decStart||c.propStart,c.decEnd||c.propEnd)+' ('+c.status+')';}).join('\n'))+'">Farm-approved change</span>';
  if(pe.length)h+=' <span class="pill s-warn di-fpend" title="'+E(pe.map(function(c){return 'Worker #'+(c.workerNo||'?')+': asked '+span2(c.propStart,c.propEnd)+' (now '+span2(c.origStart,c.origEnd)+') – counted at the current hours';}).join('\n'))+'">Waiting for approval</span>';
  var ok=farmOk(f,d);if(ok)h+=' <span class="pill s-ok di-fok" title="Approved by the farm'+(ok.by?' ('+E(ok.by)+')':'')+(ok.at?' on '+E(String(ok.at).slice(0,10)):'')+'">✓ Farm approved</span>';return h;}
function rowChg(r){var c=typeof latestChange==='function'?latestChange(r.key):null;if(!c)return '';if(c.status==='Pending')return '<div class="small di-fpendtxt">Waiting for approval: farm asked '+E(span2(c.propStart,c.propEnd))+' – counted at the current hours</div>';if(c.status==='Approved'||c.status==='Adjusted')return '<div class="small muted">Farm-approved change · original '+E(span2(c.origStart,c.origEnd))+'</div>';return '';}
function draftHtml(f,m,opt){opt=opt||{};var R=report(f,m),$=money$(),FIN=opt.final&&!unlocked(f.id,m),rows=(R.shiftRows||[]).slice(),by={},ex=existing(f,m),codes=firmCodes(f);
  rows.forEach(function(r){(by[r.date]=by[r.date]||[]).push(r);});
  var x=opt.embed?'<div class="di-wrap di-embed" id="difts">'+fsHead(f,m,opt.final,R):'<div class="di-wrap" id="draftinv"><p><button class="small sec" data-act="diback">◀ Back to '+E(mLabel(m))+'</button></p>'+
(opt.embed?'':'<h1>Draft invoice – '+E(f.name)+' <span class="small muted">('+E(codes.join(', '))+')</span></h1>'+
    '<p class="small"><span class="pill s-pend">LIVE DRAFT – not saved</span> Work month <b>'+E(mLabel(m))+'</b> ('+E(m+'-01')+' to '+E(mEnd(m))+'). Built from the final hours: approved changes, manual entries, removed hours, breaks, the daily minimum and waivers – the same calculation as Create invoice. Edit anything below; the totals update right away and the real time entries change (with the audit log).</p>');
  if(ex.length&&!opt.embed)x+='<div class="alert bad di-has" id="dihas"><b>This month already has invoice '+ex.map(function(i){return E(i.number);}).join(', ')+'.</b> Creating again makes a top-up / replacement (existing rules). If hours changed, use Revise or Top-up on the invoice.</div>';
  var un=rows.some(function(r){return r.rateUnsigned;});
  if($&&un)x+='<div class="alert warn small" id="diunsigned">Some rates are not signed by the farm for this date (or start later). They are billed at the rates entered by the office. Check them before you send the invoice.</div>';
  /* totals */
  x+='<div class="card di-tot" id="ditot"><h2 style="margin-top:0">Totals</h2><p><b id="dihours">'+h2(R.tot.bill)+'</b> billable h · '+h2(R.tot.hours)+' h worked · '+(R.tot.unique||0)+' workers · '+rows.length+' shifts</p>';
  if($){x+=(R.posLines&&R.posLines.length?'<div class="tw"><table class="no-stack"><tr><th>Line</th><th style="text-align:right">Hours</th><th style="text-align:right">Rate</th><th style="text-align:right">Amount</th></tr>'+R.posLines.map(function(l){return '<tr'+(l.missing?' class="jp-miss"':'')+'><td>'+E(l.label)+(l.missing?' (no rate – General Labour)':'')+'</td><td style="text-align:right">'+h2(l.hours)+'</td><td style="text-align:right">'+M(l.rate)+'</td><td style="text-align:right">'+M(l.amount)+'</td></tr>';}).join('')+'</table></div>':'')+
     '<p>Subtotal <b id="diamt">'+M(R.tot.amount)+'</b> · HST <b id="dihst">'+M(R.tot.hst)+'</b> · Total <b id="ditotal">'+M(R.tot.total)+'</b></p>'+
     (canMake()&&rows.length&&!opt.final?'<p><button data-act="dicreate" id="dicreate">Create invoice ('+M(R.tot.total)+')</button></p>':'');}
  else x+='<p class="small muted">Rates and amounts are shown to the owner and billing only.</p>';
  x+='</div>';
  /* timesheet – the owner's monthly sheet format (Havenlee Green Farms, Oct 2024): one row per calendar day, red = no work,
     working days alternate light blue / white; tap a day for the per-worker in/out detail (editing happens there, before the invoice). */
  var days=[],d=m+'-01',end=mEnd(m),t=today();while(d<=end){days.push(d);d=addDays(d,1);}
  var INT=internal()&&mixedRates(rows),op=(S().open=S().open||{}),hstR=R.tot.amount>0?R.tot.hst/R.tot.amount:0.15,MT={e:0,h:0,b:0,a:0,dr:0,drMiss:0},alt=0;
  function dayDetail(d){var L=by[d],ppl={};L.forEach(function(r){ppl[r.uid]=1;});var np=Object.keys(ppl).length,hb=L.reduce(function(a,r){return a+(r.bill||0);},0),amt=L.reduce(function(a,r){return a+(r.amount||0);},0),w=typeof minWaiver==='function'?minWaiver(f.id,d):null;
    var h='<section class="card ts-day di-day" id="did-'+d+'"><div class="ts-dh"><h3>'+E(shortDay(d))+'</h3><span class="small">'+np+(np===1?' worker':' workers')+' · '+h2(hb)+' h'+($?' · '+M(amt):'')+'</span>'+
      (FIN?(w?'<span class="pill s-warn">Minimum waived</span>':''):w?'<span class="pill s-warn">Minimum waived</span> <button class="small sec" data-act="mwundo" data-f="'+E(f.id)+'" data-d="'+d+'">Undo waiver</button>':'<button class="small sec" data-act="mwwaive" data-f="'+E(f.id)+'" data-d="'+d+'">Waive minimum</button>')+'</div>';
    h+='<div class="tw"><table class="ts-t di-t"><tr><th>Worker</th><th>Site</th><th>Start</th><th>Finish</th><th>Break</th><th style="text-align:right">Worked</th><th style="text-align:right">Hours</th><th>Job</th>'+($?'<th style="text-align:right">Rate</th><th style="text-align:right">Amount</th>':'')+'<th></th></tr>'+
      L.map(function(r){var P=pick(r,f),t=entry(r),tag=(t&&t.manual?' <span class="pill">Manual</span>':'')+(r.crew?' <span class="pill">Crew (scheduled)</span>':'')+(r.changed?' <span class="pill s-warn">Changed</span>':'');
        return '<tr data-key="'+E(r.key)+'"><td data-label="Worker" class="nw">'+E(who(r))+tag+'</td><td data-label="Site">'+E(r.site)+'</td><td data-label="Start">'+E(r.start)+'</td><td data-label="Finish">'+E(r.end)+plus1(r.start,r.end)+'</td>'+
          '<td data-label="Break">'+(brkMin(r)?brkMin(r)+' min':'none')+(FIN?'':'<div>'+P.brk+'</div>')+'</td><td data-label="Worked" style="text-align:right">'+h2(r.hours)+'</td><td data-label="Hours" style="text-align:right"><b>'+h2(r.bill)+'</b>'+(r.minTopUp?'<div class="small muted">incl. '+h2(r.minTopUp)+' h minimum</div>':'')+'</td>'+
          '<td data-label="Job">'+(FIN?E(r.posLabel||r.pos||'General Labour'):P.job)+'</td>'+($?'<td data-label="Rate" style="text-align:right">'+M(r.rate)+(r.rateMissing?'<div class="jp-flag">no rate</div>':'')+'</td><td data-label="Amount" style="text-align:right">'+M(r.amount)+'</td>':'')+'<td data-label="">'+(FIN?'':rowBtns(r))+'</td></tr>';}).join('')+'</table></div>';
    if(!FIN)h+='<div class="row ts-acts"><button class="small sec" data-act="miaadd" data-site="'+E(L[0].site)+'" data-date="'+d+'">+ Add missing shift</button></div>';
    return h+'</section>';}
  var nc=4+($?1:0)+(INT?2:0);
  x+='<h2>Timesheet'+(FIN?' <span class="pill s-ok di-final">Final, invoiced as '+E(opt.final)+'</span>':'')+'</h2>'+(FIN?'<p class="small di-finnote"><b>Read-only.</b> This month is invoiced. Changes only through Revise (R2) or Top-up on the invoice; farm “ask to change hours” requests still come to the office, and an approved one is flagged “Hours changed” for Revise / Top-up.'+(owner()?' <button class="small sec" data-act="diunlock" data-f="'+E(f.id)+'" data-m="'+E(m)+'">Correct hours for a Revise / Top-up…</button>':'')+'</p>':'<p class="small muted">Tap a day to see each worker’s in / out'+(FIN?'':' and to edit')+'. Red = no work that day.</p>');
  var wd=days.filter(function(d){return (by[d]||[]).length;}),okd=wd.filter(function(d){return farmOk(f,d);}).length,pend=0;wd.forEach(function(d){pend+=lastBy(chgFor(f,d,by[d])).filter(function(c){return c.status==='Pending';}).length;});
  x+='<p class="small di-rule">Final approved hours: every farm change the office approved or adjusted is already in these hours (hover “Farm-approved change” for the original time); rejected requests are ignored. <b>'+(pend?pend+' farm request'+(pend===1?'':'s')+' still waiting for approval – ':'')+'Pending requests are counted at the current hours</b> (same rule as Create invoice) until the office decides. Farm sign-off: <b>'+okd+' of '+wd.length+'</b> working day'+(wd.length===1?'':'s')+' approved by the farm'+(wd.length&&okd===wd.length?' (whole month approved)':'')+'.</p>';
  x+='<div class="tw"><table class="no-stack di-sheet"><tr class="di-sh-title"><th colspan="'+nc+'">'+E(f.name)+'</th></tr><tr><th>Date</th><th>Number of employees</th><th>Number of Hrs.</th><th>Total hours</th>'+($?'<th>Amount Due/ Day</th>':'')+(INT?'<th class="di-int">Amount Due drivers</th><th class="di-int">Balance</th>':'')+'</tr>';
  days.forEach(function(d){var L=by[d]||[],ppl={};L.forEach(function(r){ppl[r.uid]=1;});var np=Object.keys(ppl).length,hb=L.reduce(function(a,r){return a+(r.bill||0);},0),amt=L.reduce(function(a,r){return a+(r.amount||0);},0),dr=0,miss=0;
    L.forEach(function(r){var c=drvCost(r);if(c==null)miss++;else dr+=c;});
    MT.e+=np;MT.h+=np?hb/np:0;MT.b+=hb;MT.a+=amt;MT.dr+=dr;MT.drMiss+=miss;
    var cls=L.length?((alt++%2)?'di-w':'di-b'):'di-no',lab=(+d.slice(8))+' '+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][+d.slice(5,7)-1]+' '+d.slice(0,4);
    x+='<tr class="di-day-row '+cls+'"'+(L.length?' data-act="ditog" data-d="'+d+'" tabindex="0" role="button" aria-expanded="'+(op[d]?'true':'false')+'"':'')+'><td>'+(L.length?(op[d]?'▾ ':'▸ '):'')+E(lab)+(L.length?chgTags(f,d,L):'')+'</td><td>'+np+'</td><td>'+(np?+(hb/np).toFixed(2):0)+'</td><td>'+(+hb.toFixed(2))+'</td>'+($?'<td>'+M(amt)+'</td>':'')+(INT?'<td class="di-int">'+(miss?'<span title="'+miss+' shift(s) with no driver / pay rate">'+M(dr)+'*</span>':M(dr))+'</td><td class="di-int">'+(L.length?M(amt-dr):'')+'</td>':'')+'</tr>';
    if(L.length&&op[d])x+='<tr class="di-det"><td colspan="'+nc+'">'+dayDetail(d)+'</td></tr>';});
  x+='<tr class="di-mtd"><th>MTD</th><th>'+MT.e+'</th><th>'+(+MT.h.toFixed(2))+'</th><th>'+(+MT.b.toFixed(2))+'</th>'+($?'<th id="dimtd">'+M(MT.a)+'</th>':'')+(INT?'<th class="di-int">'+M(MT.dr)+(MT.drMiss?'*':'')+'</th><th class="di-int di-bal">'+M(MT.a-MT.dr)+'</th>':'')+'</tr>';
  if($)x+='<tr class="di-foot"><td></td><td></td><td><b>HST/GST</b></td><td></td><td><b>'+M(R.tot.hst)+'</b></td>'+(INT?'<td class="di-int"><b>'+M(MT.dr*hstR)+'</b></td><td></td>':'')+'</tr><tr class="di-foot"><td></td><td></td><td><b>Subtotal</b></td><td></td><td><b>'+M(R.tot.amount+R.tot.hst)+'</b></td>'+(INT?'<td class="di-int"><b>'+M(MT.dr*(1+hstR))+'</b></td><td></td>':'')+'</tr><tr class="di-foot"><td></td><td></td><td><b>Total Due</b></td><td></td><td><b>'+M(R.tot.total)+'</b></td>'+(INT?'<td></td><td></td>':'')+'</tr>';
  x+='</table></div>';
  if(INT)x+='<p class="small muted di-int">Amount Due drivers and Balance are internal (owner and billing only). Drivers = billable hours × the worker’s pay rate in the app (employee pay rate set by the office). '+(MT.drMiss?'* '+MT.drMiss+' shift(s) have no pay rate in the app (subcontractor crews are paid on their own invoices, with no hourly rate stored) – not counted.':'')+'</p>';
  if(!FIN)x+='<div class="card di-add"><b>Missing a whole day?</b> <form class="row" data-form="diaddday"><input type="date" name="date" min="'+m+'-01" max="'+(end<t?end:t)+'" required aria-label="Day"><select name="site" aria-label="Site">'+codes.map(function(c){return '<option>'+E(c)+'</option>';}).join('')+'</select><button class="small">+ Add shift</button></form></div>';
  /* per-worker summary (worker × days) */
  var W={};rows.forEach(function(r){var k=r.uid,o=W[k]=W[k]||{n:who(r),d:{},h:0,b:0,a:0};o.d[r.date]=1;o.h+=r.hours;o.b+=r.bill;o.a+=r.amount||0;});
  x+='<div class="card"><h2 style="margin-top:0">By worker</h2><div class="tw"><table class="no-stack di-w"><tr><th>Worker</th><th style="text-align:right">Days</th><th style="text-align:right">Worked</th><th style="text-align:right">Hours</th>'+($?'<th style="text-align:right">Amount</th>':'')+'</tr>'+
    Object.keys(W).sort(function(a,b){return W[a].n.localeCompare(W[b].n);}).map(function(k){var o=W[k];return '<tr><td>'+E(o.n)+'</td><td style="text-align:right">'+Object.keys(o.d).length+'</td><td style="text-align:right">'+h2(o.h)+'</td><td style="text-align:right">'+h2(o.b)+'</td>'+($?'<td style="text-align:right">'+M(o.a)+'</td>':'')+'</tr>';}).join('')+
    '<tr class="di-sum"><td><b>Total</b></td><td></td><td style="text-align:right"><b>'+h2(R.tot.hours)+'</b></td><td style="text-align:right"><b>'+h2(R.tot.bill)+'</b></td>'+($?'<td style="text-align:right"><b>'+M(R.tot.amount)+'</b></td>':'')+'</tr></table></div></div>';
  return x+'</div>';}
window.draftInvHtml=draftHtml;
/* show the draft inside the office Invoices page (no new route, so menus / guards are unchanged) */
var oi=VIEWS['admin:invoicesadmin'];
if(typeof oi==='function')VIEWS['admin:invoicesadmin']=function(){var s=S(),f=s.f&&user(s.f);if(f&&s.m&&office())return draftHtml(f,s.m);return oi.apply(this,arguments);};
function open(fid,m){if(!office())return;var f=user(fid);if(!f||!/^\d{4}-\d{2}$/.test(m||''))return;var s=S();s.f=fid;s.m=m;audit('Opened draft invoice',f.name,m);render();window.scrollTo(0,0);}
window.draftInvOpen=open;
ACT.diback=function(){var s=S();s.f=null;render();};
function diCheck(P){var L=DB.clientInvoices||[];if(L.length<=P.n)return false;var inv=L[L.length-1],f=user(P.f),s=S();
  var ok=Math.abs((+inv.total||0)-P.total)<0.005||(inv.topup&&Math.abs((+inv.topup.fullTotal||0)-P.total)<0.005);
  if(!ok){audit('Draft vs saved invoice mismatch',f.name,inv.number+' draft '+P.total+' saved '+inv.total);toast('Saved '+inv.number+' – total differs from the draft ('+M(P.total)+' vs '+M(inv.total)+'). Please check.');}
  else toast('Invoice '+inv.number+' created: '+M(inv.total)+' (matches the draft).');
  s.f=null;s.last=inv.number;s.lastOk=ok;s.pend=null;save();render();return true;}
ACT.dicreate=function(){var s=S(),f=user(s.f);if(!f||!canMake())return;var R=report(f,s.m),P={f:f.id,m:s.m,total:R.tot.total,n:(DB.clientInvoices||[]).length};
  FORMS.clientinv(null,{firmId:f.id,month:s.m});if(!diCheck(P))s.pend=P;};   /* synccheck shows "Check this invoice" first → compared after its Create */
(function(){var og=ACT.scinvgo;if(typeof og!=='function')return;ACT.scinvgo=function(){var r=og.apply(this,arguments),P=S().pend;if(P)try{diCheck(P);}catch(e){}return r;};})();
FORMS.diaddday=function(f,d){if(typeof ACT.miaadd==='function')ACT.miaadd({dataset:{site:d.site,date:d.date}});};
/* tap a farm card (or its "Open draft" button) on the Invoices month view */
document.addEventListener('click',function(e){if(!e.target.closest||!office())return;var b=e.target.closest('.ib-wrap [data-ib-missfarm]');if(!b||e.target.closest('button,a,select,input'))return;
  var m=(PAGE_STATE.ib2||{}).m;if(m)open(b.getAttribute('data-ib-missfarm'),m);},true);
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-di-open]');if(!b)return;e.preventDefault();open(b.getAttribute('data-di-open'),b.getAttribute('data-di-m'));});
function paint(){var w=document.querySelector('.ib-wrap');if(!w||!office())return;var m=(PAGE_STATE.ib2||{}).m;if(!m)return;
  [].forEach.call(w.querySelectorAll('[data-ib-missfarm]:not([data-di])'),function(b){b.setAttribute('data-di','1');b.classList.add('di-tap');b.setAttribute('tabindex','0');b.setAttribute('title','Tap to open the live draft invoice with the timesheet');
    var mk=b.querySelector('.ib-mkinv'),h='<button type="button" class="small sec di-open" data-di-open="'+E(b.getAttribute('data-ib-missfarm'))+'" data-di-m="'+E(m)+'">Open draft</button>';if(mk)mk.insertAdjacentHTML('beforebegin',h);else b.insertAdjacentHTML('beforeend',h);});}
var busy=false;new MutationObserver(function(){if(busy)return;busy=true;setTimeout(function(){try{paint();}catch(e){try{console.warn('[draftinv]',e);}catch(z){}}busy=false;},30);}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('keydown',function(e){if(e.key!=='Enter'||!e.target.matches||!e.target.matches('.di-tap'))return;var m=(PAGE_STATE.ib2||{}).m;if(m)open(e.target.getAttribute('data-ib-missfarm'),m);});
/* rows carry the "unsigned rate" flag from jpRate (v2-jobpos.js) */
var orp=window.firmReport;if(typeof orp==='function')window.firmReport=firmReport=function(firm,from,to){var R=orp.apply(this,arguments);try{(R.shiftRows||[]).forEach(function(r){if(typeof window.jpRate==='function'){var q=window.jpRate(firm,r.date,r.pos||'labour');r.rateUnsigned=!!q.unsigned;}});}catch(e){}return R;};
var css=document.createElement('style');css.textContent='.di-tap{cursor:pointer}.di-tap:hover{box-shadow:0 0 0 3px #f5a3a0}.di-open{margin:4px 0}.di-t td{vertical-align:top}.di-sel{font-size:12.5px;padding:3px 4px;min-height:30px;max-width:150px}.di-acts{display:flex;gap:4px;flex-wrap:wrap}.di-tot{border:2px solid #2b2d5c}.di-sum td{border-top:2px solid #333}'+
 /* prominent "Hours changed since this invoice" (synccheck) */
 '#scinvflags{background:#fde2e1!important;border:2px solid #c0392b!important;color:#7a1010!important;font-size:15px!important;padding:12px 14px!important}#scinvflags b{font-size:16px}.sc-invflag{background:#c0392b!important;color:#fff!important;font-weight:700;font-size:13px;padding:3px 8px}';
document.head.appendChild(css);

/* ===== farm month page (Invoices → month → farm): that month's timesheet below the invoices (owner Oct 23 12:53 AM) =====
   No invoice yet → editable (same controls as the draft, writes the real entries, totals update).
   Invoice exists → FINAL: read-only, "Final, invoiced as <number>". Direct edits for that farm + month are blocked everywhere
   (edit hours, remove, break / job, waive, add shift). Corrections: Revise (R2) / Top-up. Farm requests still work (see fcdec). */
(function(){
function UL(){return PAGE_STATE.diUnlock=PAGE_STATE.diUnlock||{};}
window.__diUnlocked=function(fid,m){return !!UL()[fid+'|'+m];};
function finalNo(fid,m){var f=user(fid);if(!f)return '';var L=existing(f,m);return L.length?L.map(function(i){return i.number;}).join(', '):'';}
window.draftFinalNo=finalNo;
function fsHead(f,m,fin,R){return '<h2 class="di-fsh">'+E(mLabel(m))+' timesheets – '+E(f.name)+'</h2>'+(fin?'':'<p class="small"><span class="pill s-pend">Not invoiced yet – editable</span> Edits change the real time entries (with the audit log) and the totals below update right away.</p>');}
window.__diFsHead=fsHead;
function sect(){var w=document.querySelector('.ib-wrap'),s=PAGE_STATE.ib2||{};if(!w||!office()||!s.m||!s.f||!w.querySelector('[data-ib-back="farm"]'))return;
  var f=user(s.f);if(!f)return;var tw=w.nextElementSibling,fin=finalNo(f.id,s.m),k=f.id+'|'+s.m+'|'+fin+'|'+(UL()[f.id+'|'+s.m]?1:0);
  var old=document.getElementById('difts');if(old&&old.getAttribute('data-k')===k)return;if(old)old.remove();
  var d=document.createElement('div');d.innerHTML=draftHtml(f,s.m,{embed:true,final:fin});var n=d.firstChild;n.setAttribute('data-k',k);
  (tw&&tw.parentNode?tw:w).insertAdjacentElement('afterend',n);}
var b2=false;new MutationObserver(function(){if(b2)return;b2=true;setTimeout(function(){try{sect();}catch(e){try{console.warn('[draftinv fs]',e);}catch(z){}}b2=false;},40);}).observe(document.documentElement,{childList:true,subtree:true});
ACT.diunlock=function(el){if(!owner())return;var f=user(el.dataset.f),m=el.dataset.m;if(!f)return;
  if(!confirm('This month is final (invoiced as '+finalNo(f.id,m)+'). Correct hours now? The invoice does NOT change: afterwards it is flagged “Hours changed” and you make a Revise (R2) or Top-up. Logged in the audit log.'))return;
  UL()[f.id+'|'+m]=1;audit('Unlocked final month to correct hours',f.name,m+' (invoice '+finalNo(f.id,m)+')');save();toast('Unlocked for this session. Then use Revise / Top-up on the invoice.');render();};
/* where an action points: farm + date */
function fromEntry(t){if(!t)return null;var d=t.date||'',site=t.site||'';if(!site&&t.shiftId){var sh=(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];if(sh)site=sh.site;}var f=site?siteFirm(site):null;return f&&d?{f:f,d:d}:null;}
function fromKey(k){k=String(k||'');var m=/^t:(.+)$/.exec(k);if(m){var a=typeof allTime==='function'?allTime():(DB.time||[]);return fromEntry(a.filter(function(x){return x.id===m[1];})[0]);}
  m=/^c:([^:]+):/.exec(k);if(m){var sh=(DB.shifts||[]).filter(function(x){return x.id===m[1];})[0];if(sh){var f=siteFirm(sh.site);return f?{f:f,d:sh.date}:null;}}return null;}
function target(el){var ds=(el&&el.dataset)||{};if(ds.f&&ds.d)return {f:user(ds.f),d:ds.d};if(ds.site&&ds.date){var f=siteFirm(ds.site);return f?{f:f,d:ds.date}:null;}
  if(ds.id)return fromEntry((DB.time||[]).filter(function(x){return x.id===ds.id;})[0]);if(ds.key)return fromKey(ds.key);if(ds.jpkey)return fromKey(ds.jpkey);return null;}
function lockedBy(T){if(!T||!T.f||!T.d)return '';var m=T.d.slice(0,7);if(UL()[T.f.id+'|'+m])return '';return finalNo(T.f.id,m);}
window.draftLockedBy=function(el){return lockedBy(target(el));};
function msg(n){toast('Final – invoiced as '+n+'. Hours for that month are read-only: use Revise (R2) or Top-up on the invoice.');}
function wrapLocks(){['ehedit','vsrm','mwwaive','mwundo','miaadd','mtedit'].forEach(function(a){var o=ACT[a];if(typeof o!=='function'||o.__diLock)return;var w=function(el){var n=lockedBy(target(el));if(n){msg(n);return;}return o.apply(this,arguments);};w.__diLock=1;ACT[a]=w;});}
wrapLocks();setTimeout(wrapLocks,0);window.addEventListener('load',wrapLocks);
document.addEventListener('change',function(e){var s=e.target;if(!s||!s.matches||!s.matches('select.jp-pos,select.jp-brk'))return;var n=lockedBy(fromKey(s.getAttribute('data-jpkey')));if(n){e.stopImmediatePropagation();msg(n);render();}},true);
/* farm "ask to change hours" on a FINAL month: the office decision still works (it is the sanctioned route). An approved change
   updates the entry (original kept in t.orig, as today), is logged, and the invoice gets the existing "Hours changed" flag →
   Revise (unpaid) or Top-up / credit (paid). Final hours never change silently: the office is told right away. */
var od=ACT.fcdec;if(typeof od==='function')ACT.fcdec=function(el){var c=(DB.changes||[]).filter(function(x){return x.id===el.dataset.id;})[0],T=null,n='';
  if(c){T=c.key?fromKey(c.key):null;if(!T&&c.date&&(c.site||c.firmId))T={f:c.firmId?user(c.firmId):siteFirm(c.site),d:c.date};n=T?finalNo(T.f&&T.f.id,String(T.d).slice(0,7)):'';}
  var r=od.apply(this,arguments);
  try{if(c&&n&&c.status&&c.status!=='Pending'&&/approv|adjust/i.test(c.status)){c.finalInv=n;audit('Approved hour change on FINAL month',T.f.name,T.d+' – invoice '+n+' needs Revise / Top-up');save();toast('Approved. '+T.d.slice(0,7)+' was final (invoice '+n+'): it is now flagged “Hours changed” – make a Revise (R2) or Top-up.');}}catch(e){}
  return r;};
var cs=document.createElement('style');cs.textContent='.di-embed{margin-top:14px}.di-final{font-size:13px;vertical-align:middle}.di-sheet td,.di-sheet th{text-align:center;border:1px solid #ccc;padding:3px 8px}.di-sheet .di-sh-title th{font-weight:700}.di-no td{background:#ff1a1a;color:#600}.di-b td{background:#cfdcf5}.di-w td{background:#fff}.di-day-row[data-act]{cursor:pointer}.di-mtd th{border-top:3px solid #000}.di-bal{background:#ff1a1a;color:#fff}.di-det>td{background:#fafafa;text-align:left;padding:8px}.di-det .ts-day{margin:0}.di-sheet .pill{font-size:10.5px;padding:1px 5px}.di-fpend{background:#ffe680;color:#5a4500}.di-fpendtxt{color:#7a5d00;background:#fff4bf;padding:1px 4px}.di-wrap{max-width:100%;min-width:0}.di-wrap .tw{overflow-x:auto;max-width:100%}.di-wrap #scinvflags,.di-wrap #scinvflags *{white-space:normal;word-break:break-word}.di-sheet tr>*:first-child{white-space:nowrap;text-align:left}@media(max-width:600px){.di-sheet td,.di-sheet th{padding:2px 3px;font-size:11.5px}.di-sheet .pill{display:inline-block;margin-top:2px}}.di-finnote{background:#eef7ee;border-left:4px solid #2e7d32;padding:8px 10px}';document.head.appendChild(cs);
})();
})();
