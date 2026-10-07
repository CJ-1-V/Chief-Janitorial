/* v2-minwaive.js – Oct 6 2026 (owner decision #7, bundle minwaive1). Farm billing only; employee pay is not touched.
   - Every farm: 5-hour daily minimum per worker-day (rule itself: billDay / firmRows in v2-clientbilling.js).
   - Office only: "Farm billing by day" (#/farmbilling) – pick a farm and dates; each day has a "Waive 5-hour minimum" button.
     Waiving needs a confirm, is written to the audit log (who + when), and can be undone (also confirmed + logged).
     While waived, that farm-day bills actual hours (break rule still applies over 5 h) with no 5-hour floor.
   - Farms see no button; only a small "Minimum waived for this day" note on that day, and how many hours the minimum added.
     Workers, crew leads and subcontractors never see billing. Farms only ever see Worker #n.
   - Storage: DB.settings.minWaivers (live: inside the existing reg_settings 'main' JSON row – office-write only, no schema change). */
'use strict';
var MW_TXT={btn:'Waive 5-hour minimum',undo:'Undo waiver',on:'Minimum waived',farmNote:'Minimum waived for this day'};
function mwKey(firmId,date){return firmId+'|'+date;}
/* live: settings are saved by owner / admin / ops staff only (reg_office_write). Test copy: officeRoles is not set → allowed. */
function mwCanEdit(){if(!ME||ME.type!=='admin')return false;var r=ME.officeRoles;if(!r||!r.length)return true;return r.some(function(x){return x==='owner'||x==='admin'||x==='ops';});}
function mwFarms(){return users('firm').filter(function(f){return firmCodes(f).length;}).sort(function(a,b){return (isFarm(a)?0:1)-(isFarm(b)?0:1)||String(a.name).localeCompare(String(b.name));});}
function mwOneDay(D){return D&&D.from===D.to;}
function mwR2(n){return Math.round((Number(n)||0)*100)/100;}

/* ---------- per-day annotations on the farm report (all billing views use firmReport / firmRows) ---------- */
(function(){var orr=firmReport;firmReport=function(firm,from,to){var R=orr(firm,from,to),by={};
  (R.shiftRows||[]).forEach(function(x){var d=by[x.date]=by[x.date]||{top:0,ded:0,raw:0};d.top+=x.minTopUp||0;d.ded+=x.brkDed||0;});
  var tt=0,wd=[];R.rows.forEach(function(r){var d=by[r.date]||{top:0,ded:0};r.topUp=mwR2(d.top);r.brkDed=mwR2(d.ded);r.waived=!!(r.n&&minWaiver(firm.id,r.date));if(r.waived)wd.push(r.date);tt+=d.top;});
  R.tot.topUp=mwR2(tt);R.waivedDays=wd;return R;};})();

/* ---------- farm view (and the office preview of it): small note on waived days + minimum hours line ---------- */
(function(){var op=firmPage;firmPage=function(firm){var x=op(firm),D=PAGE_STATE.frData,R=D&&D.R;if(!R)return x;
  (R.waivedDays||[]).forEach(function(d){var n=' <span class="mw-note" data-mw="'+d+'">'+MW_TXT.farmNote+'</span>';
    x=x.split('<tr><td>'+shortDay(d)).join('<tr class="mw-waived"><td>'+shortDay(d)+n).split('<div class="dc-head"><b>'+shortDay(d)).join('<div class="dc-head mw-waived"><b>'+shortDay(d)+n);});
  if(R.waivedDays&&R.waivedDays.length)x=x.replace(/(<div class="trow"><span>Billable hours<\/span><b>[^<]*<\/b><\/div>)/,'$1<div class="mw-totnote small" id="mwtotnote"><span class="mw-note">'+(R.waivedDays.length===1&&mwOneDay(D)?MW_TXT.farmNote:'Minimum waived: '+R.waivedDays.map(shortDay).join(', '))+'</span></div>');
  if(R.tot.topUp>0)x=x.replace(/(<div class="trow"><span>Billable hours<\/span><b>[^<]*<\/b><\/div>)/,'$1<div class="trow mw-topup" id="mwtopup"><span class="small muted">includes '+R.tot.topUp.toFixed(2)+' h added for the '+CB().minHours+'-hour daily minimum</span><b></b></div>');
  return x;};})();

/* ---------- CSV export: per worker-day lines (Worker #n only) ---------- */
(function(){var oc=ACT.fcsv;ACT.fcsv=function(){var D=PAGE_STATE.frData,dl=downloadText;if(!D||!D.R)return oc();
  downloadText=function(name,text,mime){var seen={},L=[['Billable hours per worker per day (shifts at this farm added up; break off once if over '+BILL_BREAK_OVER+' h; minimum '+CB().minHours+' h unless waived)'],['Date','Worker','Shifts','Hours worked','Break taken off','Daily minimum added','Billable hours','Minimum waived']];
    (D.R.shiftRows||[]).forEach(function(r){var k=r.uid+'|'+r.date;if(seen[k])return;seen[k]=1;var l=D.R.shiftRows.filter(function(y){return y.uid===r.uid&&y.date===r.date;});
      L.push([r.date,'Worker #'+r.no,l.length,r.dayHours.toFixed(2),l.reduce(function(a,y){return a+(y.brkDed||0);},0).toFixed(2),l.reduce(function(a,y){return a+(y.minTopUp||0);},0).toFixed(2),r.dayBill.toFixed(2),r.waived?'Yes':'']);});
    return dl(name,text+'\n\n'+L.map(csvRow).join('\n'),mime);};
  try{return oc();}finally{downloadText=dl;}};})();

/* ---------- client invoices: remember the minimum hours / waived days; show them on the invoice (screen, print, PDF) ---------- */
(function(){var of=FORMS.clientinv;FORMS.clientinv=function(f,d){var n=(DB.clientInvoices||[]).length;var r=of(f,d);var l=DB.clientInvoices||[];
  if(l.length>n){var inv=l[l.length-1],firm=user(inv.firmId);if(firm&&inv.periodStart&&inv.periodEnd){var R=firmReport(firm,inv.periodStart,inv.periodEnd);inv.minTopUpHours=R.tot.topUp;inv.minWaivedDays=R.waivedDays.slice();save();}}return r;};})();
(function(){var od=invDoc;invDoc=function(i){var L=od(i),ix=-1;L.forEach(function(l,k){if(ix<0&&l[0]==='r'&&/^Labour services/.test(l[1]))ix=k;});if(ix<0)return L;var add=[];
  if(i.minTopUpHours>0)add.push(['s','Billable hours include '+(+i.minTopUpHours).toFixed(2)+' h added for the '+CB().minHours+'-hour daily minimum per worker per day.']);
  if(i.minWaivedDays&&i.minWaivedDays.length)add.push(['s','Daily minimum waived by UnScramble on: '+i.minWaivedDays.join(', ')+'.']);
  L.splice.apply(L,[ix+1,0].concat(add));return L;};})();

/* ---------- office: Farm billing by day + the waive / undo control ---------- */
function mwState(){var st=PAGE_STATE.mwb=PAGE_STATE.mwb||{},fs=mwFarms();if(!st.firmId||!user(st.firmId))st.firmId=fs[0]?fs[0].id:'';if(!st.from){st.from=weekStart(today());st.to=addDays(st.from,6);}return st;}
function mwWho(w){return w?'by '+esc(w.by||'?')+' · '+esc(fmtStamp(w.at)):'';}
function mwCtl(firm,r){if(!r.n)return '<span class="muted">–</span>';var w=minWaiver(firm.id,r.date),can=mwCanEdit();
  if(w)return '<div class="mw-ctl on" data-mw="'+r.date+'"><span class="pill s-warn mw-pill">'+MW_TXT.on+'</span><div class="small">'+mwWho(w)+'</div>'+(can?'<button class="small sec mw-undo" data-act="mwundo" data-f="'+esc(firm.id)+'" data-d="'+r.date+'">'+MW_TXT.undo+'</button>':'')+'</div>';
  return '<div class="mw-ctl" data-mw="'+r.date+'">'+(can?'<button class="small sec mw-btn" data-act="mwwaive" data-f="'+esc(firm.id)+'" data-d="'+r.date+'" aria-label="'+MW_TXT.btn+' – '+esc(shortDay(r.date))+'">'+MW_TXT.btn+'</button>':'<span class="small muted">Owner / admin / ops can waive</span>')+(r.topUp>0?'':'<div class="small muted">No effect today (every worker over '+CB().minHours+' h)</div>')+'</div>';}
VIEWS['admin:farmbilling']=function(){var st=mwState(),firm=user(st.firmId),fs=mwFarms(),c=CB();
  var x='<h1>Farm billing by day</h1><p class="small muted">Billable hours per worker per day at each farm: that worker\'s shifts there are added up; if the total is over '+BILL_BREAK_OVER+' h, the break ('+breakRuleText(c.breakMin)+') comes off once (not if a missed break was reported); then a minimum of '+c.minHours+' billable hours applies. You can <b>waive the minimum for one farm on one day</b> – that day then bills actual hours (break rule still applies). Every waive and undo is written to the audit log. The farm sees only a small “'+MW_TXT.farmNote+'” note. Employee pay is not affected.</p>'+
  '<form data-form="mwbrange" class="row card" id="mwrange"><div><label for="mwfarm">Farm / client</label><select name="firmId" id="mwfarm">'+fs.map(function(f){return '<option value="'+esc(f.id)+'"'+(f.id===st.firmId?' selected':'')+'>'+esc(f.name)+'</option>';}).join('')+'</select></div><div><label>From</label><input type="date" name="from" value="'+st.from+'"></div><div><label>To</label><input type="date" name="to" value="'+st.to+'"></div><div style="align-self:flex-end"><button class="small">Show</button> <button class="small sec" type="button" data-act="mwweek">This week</button></div></form>';
  if(!firm)return x+'<p class="muted">No farms with sites yet.</p>';
  var R=firmReport(firm,st.from,st.to);PAGE_STATE.mwR=R;
  x+='<div class="tw desk-only"><table class="no-stack mw-table" id="mwtable"><tr><th>Day</th><th style="text-align:right">Workers</th><th style="text-align:right">Hours worked</th><th style="text-align:right">Minimum added</th><th style="text-align:right">Billable</th><th style="text-align:right">Amount</th><th>'+c.minHours+'-hour minimum</th></tr>'+
    R.rows.map(function(r){return '<tr data-date="'+r.date+'" class="'+(r.waived?'mw-waived':'')+(r.n?'':' mw-empty')+'"><td class="nw">'+shortDay(r.date)+'</td><td style="text-align:right">'+r.n+'</td><td style="text-align:right">'+r.hours.toFixed(2)+'</td><td style="text-align:right">'+(r.topUp>0?r.topUp.toFixed(2):'–')+'</td><td style="text-align:right"><b>'+r.bill.toFixed(2)+'</b></td><td style="text-align:right">'+money(r.amount)+'</td><td>'+mwCtl(firm,r)+'</td></tr>';}).join('')+
    '<tr><th>Period total</th><th style="text-align:right">'+R.tot.n+'</th><th style="text-align:right">'+R.tot.hours.toFixed(2)+'</th><th style="text-align:right">'+R.tot.topUp.toFixed(2)+'</th><th style="text-align:right">'+R.tot.bill.toFixed(2)+'</th><th style="text-align:right">'+money(R.tot.amount)+'</th><th></th></tr></table></div>';
  x+='<div class="phone-only" id="mwcards">'+R.rows.filter(function(r){return r.n;}).map(function(r){return '<div class="daycard mw-card'+(r.waived?' mw-waived':'')+'" data-date="'+r.date+'"><div class="dc-head"><b>'+shortDay(r.date)+'</b><b>'+money(r.amount)+'</b></div><div class="dc-grid"><div><span>Workers</span>'+r.n+'</div><div><span>Hours worked</span>'+r.hours.toFixed(2)+'</div><div><span>Minimum added</span>'+(r.topUp>0?r.topUp.toFixed(2):'–')+'</div><div><span>Billable</span>'+r.bill.toFixed(2)+'</div></div>'+mwCtl(firm,r)+'</div>';}).join('')+(R.rows.some(function(r){return r.n;})?'':'<p class="muted">No hours in these dates.</p>')+'</div>';
  x+='<div class="card totals" id="mwtotals"><h2 style="margin-top:0">Period total <span class="small muted">'+esc(firm.name)+' · '+shortDay(st.from)+' – '+shortDay(st.to)+'</span></h2>'+
    '<div class="trow"><span>Hours worked</span><b>'+R.tot.hours.toFixed(2)+'</b></div><div class="trow"><span>Billable hours'+(R.tot.topUp>0.004?' <span class="small muted">(incl. '+R.tot.topUp.toFixed(2)+' h daily minimum)</span>':'')+'</span><b id="mwbill">'+R.tot.bill.toFixed(2)+'</b></div>'+
    '<div class="trow"><span>Amount</span><b id="mwamt">'+money(R.tot.amount)+'</b></div><div class="trow"><span>'+(R.hstOn===false?'HST (not charged for this farm)':'HST 15%')+'</span><b id="mwhst">'+money(R.tot.hst)+'</b></div><div class="trow grand"><span>Total</span><b id="mwtot">'+money(R.tot.total)+'</b></div>'+
    (R.waivedDays.length?'<div class="small">Minimum waived on: '+R.waivedDays.map(shortDay).join(', ')+'</div>':'')+'</div>';
  return x;};
FORMS.mwbrange=function(f,d){if(d.from>d.to){toast('"From" must be before "To".');return;}PAGE_STATE.mwb={firmId:d.firmId,from:d.from,to:d.to};render();};
ACT.mwweek=function(){var st=mwState();st.from=weekStart(today());st.to=addDays(st.from,6);render();};
ACT.farmbilling=function(el){PAGE_STATE.mwb={firmId:el.dataset.id};closeModal();go('#/farmbilling');};
/* effect of a waiver on one farm-day (office only – names are fine here) */
function mwEffect(firm,date,waive){var S=DB.settings,k=mwKey(firm.id,date),orig=S.minWaivers,a,b;
  var set=function(on){var m=Object.assign({},orig||{});if(on)m[k]=m[k]||{firmId:firm.id,date:date};else delete m[k];S.minWaivers=m;};
  var calc=function(){var R=firmReport(firm,date,date),ws={};R.shiftRows.forEach(function(r){if(!ws[r.uid])ws[r.uid]={no:r.no,uid:r.uid,hours:r.dayHours,bill:r.dayBill};});return {R:R,ws:ws};};
  try{set(!waive);a=calc();set(waive);b=calc();}finally{if(orig===undefined)delete S.minWaivers;else S.minWaivers=orig;}
  var rows=Object.keys(a.ws).map(function(k){var u=user(k);return {name:u&&!u.anonymous?u.name:'',no:a.ws[k].no,hours:a.ws[k].hours,before:a.ws[k].bill,after:(b.ws[k]||{}).bill};}).sort(function(x,y){return x.no-y.no;});
  var inv=(typeof clientInvs==='function'?clientInvs(firm):[]).filter(function(i){return !i.uploaded&&i.periodStart<=date&&i.periodEnd>=date;})[0]||null;
  return {before:a.R.tot,after:b.R.tot,rows:rows,inv:inv};}
function mwModal(firm,date,waive){var E=mwEffect(firm,date,waive),w=minWaiver(firm.id,date);
  return '<h2>'+(waive?'Waive the '+CB().minHours+'-hour minimum?':'Undo the waiver?')+'</h2><p><b>'+esc(firm.name)+' · '+esc(shortDay(date))+' '+date.slice(0,4)+'</b></p>'+
  (waive?'<p class="small">This day will bill <b>actual hours</b> for every worker at this farm (the break still comes off once: '+breakRuleText(CB().breakMin)+'), with no '+CB().minHours+'-hour floor. The farm sees only “'+MW_TXT.farmNote+'”. Employee pay does not change.</p>':'<p class="small">Undoing puts the '+CB().minHours+'-hour minimum back for this farm-day.</p><div class="small mw-was">Waived '+mwWho(w)+'</div>')+
  '<div class="tw"><table class="no-stack mw-eff" id="mweff"><tr><th>Worker <span class="small">(names: office only)</span></th><th style="text-align:right">Hours</th><th style="text-align:right">Bills now</th><th style="text-align:right">After</th></tr>'+E.rows.map(function(r){return '<tr><td>Worker #'+r.no+(r.name?'<div class="small muted">'+esc(r.name)+'</div>':'')+'</td><td style="text-align:right">'+r.hours.toFixed(2)+'</td><td style="text-align:right">'+r.before.toFixed(2)+'</td><td style="text-align:right"><b>'+(r.after!=null?r.after.toFixed(2):'–')+'</b></td></tr>';}).join('')+
  '<tr><th>Day total</th><th></th><th style="text-align:right">'+E.before.bill.toFixed(2)+' h<div class="small">'+money(E.before.amount)+'</div></th><th style="text-align:right">'+E.after.bill.toFixed(2)+' h<div class="small">'+money(E.after.amount)+'</div></th></tr></table></div>'+
  (E.inv?'<div class="alert warn small" id="mwinvwarn">This day is already on invoice <b>'+esc(E.inv.number)+'</b>. The invoice is <b>not</b> changed automatically – issue a credit or adjustment if needed.</div>':'')+
  '<form data-form="mwnone" id="mwform"><label for="mwnote">'+(waive?'Reason (optional – saved in the audit log)':'Reason for undoing (optional – saved in the audit log)')+'</label><input type="text" name="note" id="mwnote" maxlength="200" placeholder="'+(waive?'e.g. rain day – owner agreed':'e.g. waived by mistake')+'">'+
  '<div class="hc-btns"><button type="button" class="'+(waive?'gold':'')+'" id="mwok" data-act="'+(waive?'mwwaiveok':'mwundook')+'" data-f="'+esc(firm.id)+'" data-d="'+date+'">'+(waive?'Yes, waive the minimum for this day':'Yes, undo the waiver')+'</button><button type="button" class="sec" data-act="closeModal">Cancel</button></div></form>';}
FORMS.mwnone=function(){};
function mwGet(el){var firm=user(el.dataset.f),date=el.dataset.d;if(!ME||ME.type!=='admin'||!firm||firm.type!=='firm'||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')){toast('Not allowed.');return null;}
  if(!mwCanEdit()){toast('Only owner, admin or ops staff can change the daily minimum.');return null;}return {firm:firm,date:date};}
ACT.mwwaive=function(el){var g=mwGet(el);if(!g)return;if(minWaiver(g.firm.id,g.date)){toast('Already waived.');render();return;}modal(mwModal(g.firm,g.date,true));};
ACT.mwundo=function(el){var g=mwGet(el);if(!g)return;if(!minWaiver(g.firm.id,g.date)){toast('Not waived.');render();return;}modal(mwModal(g.firm,g.date,false));};
ACT.mwwaiveok=function(el){var g=mwGet(el);if(!g)return;var E=mwEffect(g.firm,g.date,true),n=document.getElementById('mwnote'),note=n?n.value.trim().slice(0,200):'';
  var S=DB.settings;S.minWaivers=Object.assign({},S.minWaivers||{});S.minWaivers[mwKey(g.firm.id,g.date)]={firmId:g.firm.id,date:g.date,by:ME.name,at:new Date().toISOString()}; /* the reason goes to the audit log only (the settings row is readable by every signed-in account in live) */
  audit('Waived 5-hour daily minimum',g.firm.name,g.date+' · billable '+E.before.bill.toFixed(2)+' h → '+E.after.bill.toFixed(2)+' h ('+money(E.before.amount)+' → '+money(E.after.amount)+')'+(note?' · reason: '+note:''));
  save();closeModal();toast('Minimum waived for '+g.firm.name+' on '+shortDay(g.date)+'.');render();};
ACT.mwundook=function(el){var g=mwGet(el);if(!g)return;var w=minWaiver(g.firm.id,g.date);if(!w){closeModal();render();return;}var E=mwEffect(g.firm,g.date,false),n=document.getElementById('mwnote'),note=n?n.value.trim().slice(0,200):'';
  var S=DB.settings;S.minWaivers=Object.assign({},S.minWaivers||{});delete S.minWaivers[mwKey(g.firm.id,g.date)];
  audit('Undid 5-hour minimum waiver',g.firm.name,g.date+' (waived by '+(w.by||'?')+' '+fmtStamp(w.at)+') · billable '+E.before.bill.toFixed(2)+' h → '+E.after.bill.toFixed(2)+' h ('+money(E.before.amount)+' → '+money(E.after.amount)+')'+(note?' · reason: '+note:''));
  save();closeModal();toast('Waiver undone – the '+CB().minHours+'-hour minimum applies again.');render();};
ADMIN_ONLY_ACT.push('mwwaive','mwundo','mwwaiveok','mwundook','farmbilling','mwweek');ADMIN_ONLY_FORM.push('mwbrange','mwnone');

/* Public hooks for other screens (e.g. the office gear/settings panel of a site or farm record):
   openMinWaive(siteCodeOrFarmId, date)  date 'YYYY-MM-DD' -> opens the confirm (waive, or undo if already waived) for that farm-day;
                                         no date -> opens "Farm billing by day" for that farm (this week). Returns false if not allowed/unknown.
   minWaiveStatus(siteCodeOrFarmId, date) -> {firmId, date, waived, by, at} or null. Waivers are per FARM per day (all its site codes). */
function mwFirmOf(x){x=String(x==null?'':x).trim();if(!x||!DB)return null;var f=user(x);if(f&&f.type==='firm')return f;
  var s=(DB.sites||[]).filter(function(t){return String(t.code||'').toUpperCase()===x.toUpperCase();})[0];f=s&&user(s.firmId);return f&&f.type==='firm'?f:null;}
window.openMinWaive=function(code,date){var f=mwFirmOf(code);if(!ME||ME.type!=='admin'){toast('Not allowed.');return false;}if(!f){toast('Unknown farm or site code.');return false;}
  if(!date){PAGE_STATE.mwb={firmId:f.id};closeModal();go('#/farmbilling');return true;}
  var el={dataset:{f:f.id,d:String(date)}};if(!mwGet(el))return false;(minWaiver(f.id,el.dataset.d)?ACT.mwundo:ACT.mwwaive)(el);return true;};
window.minWaiveStatus=function(code,date){var f=mwFirmOf(code);if(!f||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return null;var w=minWaiver(f.id,date);return {firmId:f.id,date:date,waived:!!w,by:w?w.by:null,at:w?w.at:null};};

/* menu + a button on each farm row (Farms page) */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/firms')return i+1;return NAV.admin.length;})(),0,['#/farmbilling','Farm billing by day']);
if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){if(g[1].indexOf('#/firms')>=0&&g[1].indexOf('#/farmbilling')<0)g[1].splice(g[1].indexOf('#/firms')+1,0,'#/farmbilling');});
(function(){var of=VIEWS['admin:firms'];VIEWS['admin:firms']=function(){return of().replace(/<button class="small sec" data-act="firmview" data-id="([^"]+)">/g,'<button class="small sec" data-act="farmbilling" data-id="$1">Billing by day</button><button class="small sec" data-act="firmview" data-id="$1">');};})();
