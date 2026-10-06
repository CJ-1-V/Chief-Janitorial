/* v2-clientbilling.js – client (farm and other client) billing per the Independent Contractor Service Agreement, plus the driver's abstract age rule. TEST ONLY.
   - Billable hours (Oct 6 2026): per worker per farm per day – shifts added up, 30-minute break off once if the total is over 5 h
     (unless "break missed"), then a 5-hour DAILY MINIMUM per worker per day; the office can waive the minimum for one farm-day (v2-minwaive.js).
   - Monthly client invoices, net 30, 2% per month interest on overdue invoices (shown on the farm/client view and office billing).
   - Driver's abstract must be dated within the last 30 days when uploaded or typed in.
   All numbers editable in office Settings. */
'use strict';
function CB(){var d={minHours:5,breakMin:30,netDays:30,interestPct:2,abstractMaxDays:30};var s=(DB&&DB.settings&&DB.settings.clientBilling)||{};Object.keys(d).forEach(function(k){if(s[k]===undefined||s[k]===null||s[k]==='')s[k]=d[k];});return s;}
function syncBreak(){if(DB&&DB.settings){DB.settings.clientBilling=CB();BREAK_MIN=CB().breakMin;}}
(function(){var ol=load;load=function(){ol();syncBreak();};})();

/* Farm billing per worker-day (owner, Oct 3 + Oct 6 2026 #7). Applies to client (farm) billing ONLY – employee pay is unchanged.
   For each worker, add up that worker's shifts at the same farm on the same day. If the total is over 5 h, take the unpaid break
   (30 min) off ONCE – not when the worker reported a missed break on a shift that day. Then bill at least the daily minimum (5 h),
   unless the office waived the minimum for that farm on that day (then actual hours after the break rule, no floor).
   Waivers live in DB.settings.minWaivers {"<farm id>|<date>": {firmId,date,by,at,note}} (live: the existing reg_settings 'main' JSON row,
   office-write only – no schema change). Rows get: bill (allocated), brkDed, minTopUp, waived, dayHours, dayBill. */
var BILL_BREAK_OVER=5; /* hours: the break comes off only when the worker-day total is OVER this */
function minWaivers(){return (DB&&DB.settings&&DB.settings.minWaivers)||{};}
function minWaiver(firmId,date){return minWaivers()[firmId+'|'+date]||null;}
function billDay(hours,missed,waived){var c=CB(),min=Number(c.minHours)||0,b=hours;
  if(hours>BILL_BREAK_OVER+1e-9&&!missed)b=hours-(Number(c.breakMin)||0)/60;
  if(!waived&&min>0&&b<min)b=min;return Math.max(0,b);}
(function(){var ofr=firmRows;firmRows=function(firm,from,to){var rows=ofr(firm,from,to),c=CB(),brk=(Number(c.breakMin)||0)/60,g={};
  rows.forEach(function(r){var k=r.uid+'|'+r.date;(g[k]=g[k]||[]).push(r);});
  Object.keys(g).forEach(function(k){var l=g[k],sum=l.reduce(function(a,r){return a+r.hours;},0),missed=l.some(function(r){return r.breakMissed;}),w=!!minWaiver(firm.id,l[0].date),day=billDay(sum,missed,w);
    l.forEach(function(r){r.bill=r.hours;r.brkDed=0;r.minTopUp=0;r.waived=w;r.dayHours=sum;r.dayBill=day;r.dayShifts=l.length;});
    var ded=sum>BILL_BREAK_OVER+1e-9&&!missed?brk:0,left=ded; /* the break comes off the longest shift(s) */
    l.slice().sort(function(a,b){return b.hours-a.hours;}).forEach(function(r){if(left<=0)return;var t=Math.min(left,r.bill);r.brkDed=Math.round(t*10000)/10000;r.bill-=t;left-=t;});
    var top=day-(sum-ded);if(top>1e-9){var last=l[l.length-1];last.minTopUp=Math.round(top*10000)/10000;last.bill+=top;}});
  return rows;};})();
(function(){var op=firmPage;firmPage=function(firm){var c=CB();return op(firm).replace(/Billable hours = hours worked minus a 30-minute unpaid break on shifts of 5 hours or more\./,'Billable hours, per worker per day at this farm: all of that worker\'s shifts that day are added up; if the total is over '+BILL_BREAK_OVER+' hours, a '+c.breakMin+'-minute unpaid break is taken off once (not when the worker reported a missed break); then a minimum of '+c.minHours+' billable hours per worker per day applies (Independent Contractor Service Agreement, s. 3).')+clientInvoicesHtml(firm,false);};})();

/* ---------- monthly client invoices: net 30, 2% per month on overdue ---------- */
function clientInvs(firm){return (DB.clientInvoices||[]).filter(function(i){return !firm||i.firmId===firm.id;});}
function clientInvInterest(i,on){on=on||today();var end=i.paidAt||on;var over=daysBetween(i.due,end);if(over<=0)return {months:0,amount:0,over:0};var m=Math.ceil(over/30),pct=i.interestPct!=null?i.interestPct:CB().interestPct;return {months:m,over:over,amount:Math.round(i.total*pct/100*m*100)/100};}
function clientInvStatus(i){if(i.paidAt)return {t:'Paid '+i.paidAt,c:'s-ok'};var o=daysBetween(i.due,today());return o>0?{t:'Overdue '+o+' days',c:'s-bad'}:{t:'Due '+i.due,c:'s-pend'};}
function clientInvoicesHtml(firm,office){var l=clientInvs(firm).slice().reverse(),c=CB();
  return '<div class="card" id="clientinvoices"><h2 style="margin-top:0">'+(office?'Client invoices':'Your invoices')+'</h2><p class="small">Invoiced monthly, payable within '+c.netDays+' days. Interest of '+c.interestPct+'% per month is charged on invoices not paid by the due date (Independent Contractor Service Agreement, s. 3).</p>'+
  (l.length?'<div class="tw"><table id="'+(office?'clientinvtable':'myclientinv')+'"><tr>'+(office?'<th>Client</th>':'')+'<th>Invoice #</th><th>Period</th><th>Amount</th><th>HST</th><th>Total</th><th>Issued</th><th>Due</th><th>Status</th><th>Interest</th><th>Now owing</th>'+(office?'<th></th>':'')+'</tr>'+l.map(function(i){var it=clientInvInterest(i),st=clientInvStatus(i);
    return '<tr data-inv="'+esc(i.number)+'">'+(office?'<td>'+esc(user(i.firmId).name)+'</td>':'')+'<td>'+esc(i.number)+'</td><td class="small">'+esc(i.periodStart)+' – '+esc(i.periodEnd)+'</td><td>'+money(i.amount)+'</td><td>'+money(i.hst)+'</td><td>'+money(i.total)+'</td><td>'+esc(i.issued)+'</td><td>'+esc(i.due)+'</td><td><span class="pill '+st.c+'">'+esc(st.t)+'</span></td><td class="interest">'+(it.amount?money(it.amount)+' <span class="small">('+it.months+' mo × '+(i.interestPct!=null?i.interestPct:c.interestPct)+'%)</span>':'–')+'</td><td class="owing"><b>'+money(i.paidAt?0:i.total+it.amount)+'</b></td>'+(office?'<td>'+(i.paidAt?'':'<button class="small sec" data-act="clientinvpaid" data-id="'+i.id+'">Mark paid</button>')+'</td>':'')+'</tr>';}).join('')+'</table></div>':'<p class="small muted">No invoices yet.</p>')+
  (office?'<form data-form="clientinv" class="row"><select name="firmId" aria-label="Client">'+users('firm').slice().sort(function(a,b){return (isFarm(a)?0:1)-(isFarm(b)?0:1);}).map(function(f){return '<option value="'+f.id+'">'+esc(f.name)+'</option>';}).join('')+'</select><input type="month" name="month" value="'+today().slice(0,7)+'" aria-label="Month"><button class="small">Create monthly invoice</button></form>':'')+'</div>';}
FORMS.clientinv=function(f,d){var firm=user(d.firmId);if(!firm||firm.type!=='firm'||!/^\d{4}-\d{2}$/.test(d.month||'')){toast('Pick a client and a month.');return;}
  var from=d.month+'-01',to=addDays(isoLocal(new Date(+d.month.slice(0,4),+d.month.slice(5,7),1)),-1);if(clientInvs(firm).some(function(i){return i.periodStart===from;})){toast('That month is already invoiced for this client.');return;}
  var R=firmReport(firm,from,to);if(!(R.tot.amount>0)){toast('No billable hours for that client in that month.');return;}var c=CB();
  var n=(DB.clientInvoices||[]).length+1;var inv={id:uid('ci'),firmId:firm.id,number:'UC-'+today().slice(0,4)+'-'+String(n).padStart(3,'0'),periodStart:from,periodEnd:to,billHours:R.tot.bill,amount:R.tot.amount,hst:R.tot.hst,total:R.tot.total,issued:today(),due:addDays(today(),c.netDays),interestPct:c.interestPct,paidAt:''};
  (DB.clientInvoices=DB.clientInvoices||[]).push(inv);audit('Created client invoice',firm.name,inv.number+' '+money(inv.total));notify(firm.id,'New invoice '+inv.number+' for '+from+' – '+to+': '+money(inv.total)+', due '+inv.due+'.');save();toast('Invoice '+inv.number+' created.');render();};
ACT.clientinvpaid=function(el){var i=(DB.clientInvoices||[]).filter(function(x){return x.id===el.dataset.id;})[0];if(!i)return;var it=clientInvInterest(i);i.paidAt=today();i.interestCharged=it.amount;audit('Client invoice marked paid',user(i.firmId).name,i.number+(it.amount?' (interest '+money(it.amount)+')':''));save();toast('Marked paid.');render();};
(function(){var of=VIEWS['admin:firms'];VIEWS['admin:firms']=function(){return of().replace('<div class="card hl" id="farmrates">',clientInvoicesHtml(null,true)+'<div class="card hl" id="farmrates">');};})();
(function(){var of=adminFlags;adminFlags=function(){var f=of();var o=clientInvs().filter(function(i){return !i.paidAt&&daysBetween(i.due,today())>0;});if(o.length)f.push({t:'Overdue client invoices',c:o.length+' overdue (interest '+CB().interestPct+'%/month)',h:'#/firms'});return f;};})();

/* ---------- driver's abstract dated within the last N days ---------- */
function abstractAgeError(d){if(d.kind!=='driver_abstract')return '';var max=CB().abstractMaxDays,dt=d.abstractDate;if(!dt)return 'Enter the date of the driver\'s abstract.';if(dt>today())return 'The abstract date can\'t be in the future.';var age=daysBetween(dt,today());return age>max?'The driver\'s abstract must be dated within the last '+max+' days (this one is '+age+' days old). Please get a new one.':'';}
['upload','manualdoc'].forEach(function(k){var o=FORMS[k];FORMS[k]=function(f,d){var e=abstractAgeError(d);if(e){toast(e);return;}return o(f,d);};});

/* ---------- Settings ---------- */
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var c=CB();var card='<div class="card" id="clientbill"><h3 style="margin-top:0">Client billing and document rules</h3><form data-form="clientbill"><div class="grid2">'+
  inp('minHours','Daily minimum billable hours per worker',c.minHours,{type:'number'})+inp('breakMin','Unpaid break deducted on shifts of 5 h or more (minutes)',c.breakMin,{type:'number'})+inp('netDays','Client invoice payment terms (days)',c.netDays,{type:'number'})+inp('interestPct','Interest on overdue client invoices (% per month)',c.interestPct,{type:'number'})+inp('abstractMaxDays','Driver\'s abstract must be dated within (days)',c.abstractMaxDays,{type:'number'})+'</div><button class="small">Save</button></form></div>';
  return x0(os(),card);};function x0(x,card){return x.replace('<div class="card" id="clienttypeset">',card+'<div class="card" id="clienttypeset">');}})();
FORMS.clientbill=function(f,d){var n={};var bad=['minHours','breakMin','netDays','interestPct','abstractMaxDays'].some(function(k){var v=Number(d[k]);if(!(v>=0)||d[k]==='')return true;n[k]=v;return false;});if(bad){toast('Enter numbers of 0 or more.');return;}
  DB.settings.clientBilling=n;BREAK_MIN=n.breakMin;audit('Changed client billing / document rules','',JSON.stringify(n));save();toast('Saved.');render();};

/* ---------- seed ---------- */
function seedClientInvoices(db){if(db.clientInvoices)return;db.clientInvoices=[];var fA=db.users.filter(function(u){return u.username==='firmA';})[0];if(!fA)return;
  db.clientInvoices.push({id:uid('ci'),firmId:fA.id,number:'UC-SAMPLE-001',periodStart:addDays(today(),-105),periodEnd:addDays(today(),-76),billHours:180,amount:4410,hst:661.5,total:5071.5,issued:addDays(today(),-75),due:addDays(today(),-45),interestPct:2,paidAt:'',sample:true});
  db.clientInvoices.push({id:uid('ci'),firmId:fA.id,number:'UC-SAMPLE-002',periodStart:addDays(today(),-75),periodEnd:addDays(today(),-46),billHours:150,amount:3675,hst:551.25,total:4226.25,issued:addDays(today(),-45),due:addDays(today(),-15),interestPct:2,paidAt:addDays(today(),-17),sample:true});}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedClientInvoices(db);db.settings.clientBilling=db.settings.clientBilling||{minHours:5,breakMin:30,netDays:30,interestPct:2,abstractMaxDays:30};};})();
(function(){var ol=load;load=function(){ol();if(DB&&!DB.clientInvoices){seedClientInvoices(DB);save();}};})();
ADMIN_ONLY_FORM.push('clientinv','clientbill');ADMIN_ONLY_ACT.push('clientinvpaid');
