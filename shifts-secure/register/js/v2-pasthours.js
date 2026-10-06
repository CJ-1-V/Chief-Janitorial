/* v2-pasthours.js – farm "Past hours": pick dates -> people worked per day per site (LIVE, Oct 6 2026).
   Farm main page still shows the current week. Past days come from (a) clocked shifts in the app and
   (b) office-imported past timesheets, read from the database with reg_client_past_hours() – the server returns
   only the signed-in farm's own sites and only date / site / people / hours / billable hours.
   Counts and hours only – never worker names, never worker/sub pay. */
'use strict';
var PH_CACHE={};                               /* 'from|to' -> {st:'loading'|'ok'|'err', rows:[]} */
function pastHoursFetch(from,to){var k=from+'|'+to;if(PH_CACHE[k])return PH_CACHE[k];
  var c=PH_CACHE[k]={st:'loading',rows:[]};
  if(!(window.REG_LIVE&&window.REG_SB)){c.st='ok';c.rows=(DB.pastHours||[]);return c;}
  window.REG_SB.rpc('reg_client_past_hours',{p_from:from,p_to:to}).then(function(res){
    if(res.error){c.st='err';c.msg=res.error.message||'';}
    else{c.st='ok';c.rows=(res.data||[]).map(function(p){return {date:String(p.date).slice(0,10),site:p.site,people:+p.people||0,hours:p.hours==null?null:+p.hours,bill:+p.bill||0,src:'past-import'};});}
    if(ME&&ME.type==='firm'&&document.getElementById('pasthours'))render();
  },function(e){c.st='err';c.msg=String(e&&e.message||e);if(document.getElementById('pasthours'))render();});
  return c;}
function pastHoursRows(firm,from,to){var map={},live=!!(window.REG_LIVE&&window.REG_SB),codes=firmCodes(firm),pf=pastHoursFetch(from,to);
  /* (a) app shifts (clocked or scheduled crew): people = distinct workers per site per day */
  firmRows(firm,from,to).forEach(function(r){var k=r.date+'|'+r.site;var m=map[k]||(map[k]={date:r.date,site:r.site,ids:{},people:0,hours:0,bill:0,src:'app'});m.ids[r.uid]=1;m.hours+=r.hours;m.bill+=r.bill;});
  Object.keys(map).forEach(function(k){map[k].people=Object.keys(map[k].ids).length;delete map[k].ids;});
  /* (b) office-imported past timesheets */
  var out=Object.keys(map).map(function(k){return map[k];});
  /* live: the server already limits rows to this farm's own sites */
  pf.rows.forEach(function(p){if(p.date<from||p.date>to||(!live&&codes.indexOf(p.site)<0))return;
    var dup=map[p.date+'|'+p.site];
    out.push({date:p.date,site:p.site,people:p.people,hours:p.hours,bill:p.bill,src:'past-import',dupApp:!!dup});});
  out.loading=pf.st==='loading';out.err=pf.st==='err';
  out.sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:a.site<b.site?-1:1;});
  return out;}
function pastHoursRange(){var st=PAGE_STATE.ph||{};var ws=weekStart(today());return {from:st.from||addDays(ws,-28),to:st.to||addDays(ws,-1)};}
function pastHoursCard(firm){var r=pastHoursRange(),rows=pastHoursRows(firm,r.from,r.to),days={};
  var tot={people:0,hours:0,hoursKnown:true,bill:0};rows.forEach(function(x){tot.people+=x.people;if(x.hours==null)tot.hoursKnown=false;else tot.hours+=x.hours;tot.bill+=x.bill;days[x.date]=1;});
  var srcLab=function(x){return x.src==='app'?'<span class="pill s-ok">App</span>':'<span class="pill s-pend" title="From the office past-timesheet import">Past sheet</span>'+(x.dupApp?' <span class="small bad">also in app</span>':'');};
  var hrs=function(v){return v==null?'<span class="muted" title="Past sheets recorded billed hours only">–</span>':v.toFixed(2);};
  PAGE_STATE.phData={firm:firm,rows:rows,from:r.from,to:r.to,tot:tot};
  var x='<div id="pasthours" class="card"><h2 style="margin-top:0">Past hours – people worked per day</h2>'+
  '<p class="small muted">Pick any dates. Shows how many people worked at each of your sites per day and the hours. Counts only – no names.</p>'+
  '<form data-form="pasthrs" class="row"><div><label>From</label><input type="date" name="from" value="'+r.from+'" max="'+today()+'"></div><div><label>To</label><input type="date" name="to" value="'+r.to+'" max="'+today()+'"></div>'+
  '<div style="align-self:flex-end"><button class="small">Show past hours</button> <button class="small sec" data-act="phlast4">Last 4 weeks</button></div></form>';
  if(rows.err)x+='<p class="small bad">Could not load the past timesheets just now. Please refresh the page and try again.</p>';
  if(!rows.length&&rows.loading)return x+'<p class="muted">Loading past hours…</p></div>';
  if(!rows.length)return x+'<p class="muted">No hours recorded at your sites from '+shortDay(r.from)+' to '+shortDay(r.to)+'.</p></div>';
  x+='<div class="tw desk-only"><table class="no-stack" id="pasthours-table"><tr><th>Date</th><th>Site</th><th style="text-align:right">People worked</th><th style="text-align:right">Hours worked</th><th style="text-align:right">Billable hours</th><th>Source</th></tr>'+
  rows.map(function(x){return '<tr><td>'+shortDay(x.date)+' <span class="small muted">'+x.date.slice(0,4)+'</span></td><td>'+esc(siteName(x.site))+'</td><td style="text-align:right">'+x.people+'</td><td style="text-align:right">'+hrs(x.hours)+'</td><td style="text-align:right">'+x.bill.toFixed(2)+'</td><td>'+srcLab(x)+'</td></tr>';}).join('')+
  '<tr><th>Total ('+Object.keys(days).length+' days worked)</th><th></th><th style="text-align:right">'+tot.people+' <span class="small">people-days</span></th><th style="text-align:right">'+(tot.hoursKnown?tot.hours.toFixed(2):(rows.some(function(x){return x.hours!=null;})?tot.hours.toFixed(2)+'*':'<span class="muted">–</span>'))+'</th><th style="text-align:right">'+tot.bill.toFixed(2)+'</th><th></th></tr></table></div>'+
  '<div class="phone-only" id="pasthours-cards">'+rows.map(function(x){return '<div class="daycard"><div class="dc-head"><b>'+shortDay(x.date)+' '+x.date.slice(0,4)+'</b>'+srcLab(x)+'</div><div class="small muted">'+esc(siteName(x.site))+'</div><div class="dc-grid"><div><span>People worked</span>'+x.people+'</div><div><span>Hours worked</span>'+hrs(x.hours)+'</div><div><span>Billable hours</span>'+x.bill.toFixed(2)+'</div></div></div>';}).join('')+'</div>'+
  '<div class="card totals"><h2 style="margin-top:0">Totals <span class="small muted">'+shortDay(r.from)+' '+r.from.slice(0,4)+' – '+shortDay(r.to)+' '+r.to.slice(0,4)+'</span></h2>'+
  '<div class="trow"><span>Days with work</span><b>'+Object.keys(days).length+'</b></div><div class="trow"><span>People worked (people-days)</span><b>'+tot.people+'</b></div>'+
  '<div class="trow"><span>Billable hours</span><b>'+tot.bill.toFixed(2)+'</b></div></div>'+
  (tot.hoursKnown?'':'<p class="small muted">* Past sheets recorded billed hours only, so "hours worked" is shown as – for those days and the total covers app shifts only.</p>')+
  '<button class="small sec" data-act="phcsv">Download past hours (CSV)</button></div>';
  return x;}
(function(){var oh=VIEWS['firm:home'];VIEWS['firm:home']=function(){return oh()+pastHoursCard(ME);};})();
FORMS.pasthrs=function(f,d){if(!d.from||!d.to){toast('Pick both dates.');return;}if(d.from>d.to){toast('"From" must be before "To".');return;}if(d.to>today()){toast('Past hours only – "To" cannot be after today.');return;}if((new Date(d.to)-new Date(d.from))/864e5>800){toast('Pick up to 800 days at a time.');return;}
  PAGE_STATE.ph={from:d.from,to:d.to};if(typeof SECT_OPEN==='object')SECT_OPEN['sect-past']=true;render();};
ACT.phlast4=function(){PAGE_STATE.ph={};if(typeof SECT_OPEN==='object')SECT_OPEN['sect-past']=true;render();};
ACT.phcsv=function(){var D=PAGE_STATE.phData;if(!D)return;var rows=[['Date','Site','People worked','Hours worked','Billable hours','Source']];
  D.rows.forEach(function(x){rows.push([x.date,siteName(x.site),x.people,x.hours==null?'':x.hours.toFixed(2),x.bill.toFixed(2),x.src==='app'?'App':'Past sheet']);});
  rows.push(['Total','',D.tot.people,'',D.tot.bill.toFixed(2),'']);downloadText(D.firm.name.replace(/\W+/g,'-')+'-past-hours-'+D.from+'-to-'+D.to+'.csv',rows.map(csvRow).join('\n'),'text/csv');};
