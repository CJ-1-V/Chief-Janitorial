/* v2-orders.js – Crew orders from registered clients (farms first, every client type). TEST ONLY, local/mock mode, fake data.
   - A client orders a crew from its own page (Crew orders tab): site (own sites only), date or a date range with selected days,
     quarter-hour start, optional finish OR hours (overnight allowed: finish earlier than start = next day, max 16 h), number of
     workers, role (only roles with a signed rate – others say "ask the office"), "Safety gear (PPE) supplied by:" and a note.
   - Only approved clients with a signed agreement + current Rate Schedule can order; others see why and what to do.
   - Every new order, change and cancel goes to the office (Crew orders queue) to confirm, decline or adjust (comment). The
     confirmed version only changes when the office approves. Old → new is shown to both sides.
   - Changes / cancels less than the cut-off (office setting, default 24 h) before the start are allowed but flagged "Late change";
     the client sees that late changes may be charged per the agreement (no fee amount is set here).
   - A confirmed order becomes a normal shift (Project Assignment) through the existing "Create a shift" logic, so crews are
     assigned the usual way. The client never sees worker names – only counts and the filled status.
   - Each order keeps its own audit trail (who changed what, when). Alerts go to the simulated outbox only. */
'use strict';
var ORDER_MAX_DAYS=31,ORDER_MAX_WORKERS=200;
var ORDER_ST={Requested:'s-pend',Confirmed:'s-ok','Changed - awaiting office':'s-warn',Declined:'s-bad',Cancelled:'s-mut',Filled:'s-ok'};
var WEEKDAYS=[[1,'Mon'],[2,'Tue'],[3,'Wed'],[4,'Thu'],[5,'Fri'],[6,'Sat'],[0,'Sun']];
function orderCutoffH(){var v=DB&&DB.settings?DB.settings.orderCutoffHours:null;return (v===undefined||v===null||v==='')?24:+v;}
function nowMsApp(){var d=new Date();if(DB&&DB.settings&&DB.settings.simDate)return hmMsLocal(DB.settings.simDate,pad(d.getHours())+':'+pad(d.getMinutes()));return d.getTime();}
function qTimes(){var a=[];for(var h=0;h<24;h++)for(var m=0;m<60;m+=15)a.push(pad(h)+':'+pad(m));return a;}
function qSel(name,label,val,o){o=o||{};return '<div><label class="'+(o.req?'req':'')+'">'+esc(label)+'</label><select name="'+name+'"'+(o.req?' required':'')+'>'+(o.blank?'<option value="">'+esc(o.blank)+'</option>':'')+opt(qTimes(),val||'')+'</select>'+(o.hint?'<div class="hint">'+o.hint+'</div>':'')+'</div>';}
function addHM(hm,h){var m=((hmMin(hm)+Math.round(h*60))%1440+1440)%1440;return pad(Math.floor(m/60))+':'+pad(m%60);}
function ordEnd(f){return f.end||(f.hours?addHM(f.start,f.hours):'');}
function ordTime(f){var e=ordEnd(f);return esc(f.start)+(e?'–'+esc(e)+plus1(f.start,e):' (finish open)')+(f.hours&&!f.end?' · '+f.hours+' h':'');}
function ordStartMs(f){return hmMsLocal(f.date,f.start);}
function hoursBefore(f){return (ordStartMs(f)-nowMsApp())/3600000;}
function isLateChange(p){return !!(p&&p.late&&(p.kind!=='new'||p.lateEdit));}
function gearLabel(g,firm){if(!g)return 'Office to confirm';return g==='Client'?(isFarm(firm)?'The farm (us)':'The client (us)'):g;}

/* ---------- who can order ---------- */
function orderBlock(firm){
  if(!firm||firm.type!=='firm')return {why:'Only client accounts can order crews.',fix:''};
  if(firm.accountApproved===false)return {why:'The office is still checking your account.',fix:'The office will approve your account and set your rates. You can order crews after you sign the agreement and Rate Schedule.'};
  if(firm.active===false)return {why:'Your account is switched off.',fix:'Please contact the office.'};
  if(!farmRatesCur(firm))return {why:'The office has not set your labour rates yet, so there is no signed agreement.',fix:'Contact the office to set your rates. Then sign the agreement and your Rate Schedule on "Workers, hours & billing" and come back here.'};
  if(!firmSignedEver(firm)||!farmSigsOf(firm).some(function(s){return s.rateVersion;}))return {why:'You have not signed the agreement and your Rate Schedule yet.',fix:'Open "Workers, hours & billing", sign the agreement and Rate Schedule, then come back here to order.'};
  if(!farmRatesReady(firm))return {why:'The office changed your rates and you have not accepted the new Rate Schedule yet.',fix:'Open "Workers, hours & billing" and accept the new Rate Schedule, then come back here to order.'};
  if(!firmCodes(firm).length)return {why:'No work site is set up for your account yet.',fix:'Ask the office to add your site.'};
  return null;}
function orderRoleList(firm){var c=farmRatesCur(firm);var rates=(c&&farmRateAccepted(firm,c.version))?c:{rates:{}};
  var keep=RATE_INDUSTRY[clientTypeOf(firm)]||FARM_RATE_ROLES.map(function(r){return r[0];});
  var l=FARM_RATE_ROLES.filter(function(r){return keep.indexOf(r[0])>=0||rates.rates[r[0]]>0;}).map(function(r){return {key:r[0],label:r[1],ok:rates.rates[r[0]]>0};});
  if(rates.other&&rates.other.name&&rates.other.rate>0)l.push({key:'other',label:rates.other.name,ok:true});return l;}
function roleOk(firm,k){return orderRoleList(firm).some(function(r){return r.key===k&&r.ok;});}
function orderRoleName(firm,k){var r=orderRoleList(firm).filter(function(x){return x.key===k;})[0];if(r)return r.label;var f=FARM_RATE_ROLES.filter(function(x){return x[0]===k;})[0];return f?f[1]:k;}
function shiftRoleOf(k){return k==='driver'?'driver':k==='forklift'?'forklift':'general';}

/* ---------- store ---------- */
function crewOrders(){return DB.crewOrders=DB.crewOrders||[];}
function ordersOf(firm){return crewOrders().filter(function(o){return o.firmId===firm.id;});}
function ordById(id){return crewOrders().filter(function(o){return o.id===id;})[0]||null;}
function ordView(o){return o.cur||(o.pending&&o.pending.fields)||o.req;}
function ordShift(o){return o.shiftId?DB.shifts.filter(function(s){return s.id===o.shiftId;})[0]||null:null;}
/* live: a farm only gets anonymous ids ('anon-1'…) in booked (reg_client_bookings), so count those too */
function ordAssigned(o){var s=ordShift(o);return s?(s.booked||[]).filter(function(id){var u=user(id);return u?u.type!=='tester':/^anon-/.test(String(id));}).length:0;}
function ordStatus(o){if(o.status==='Confirmed'&&o.cur){var s=ordShift(o);if(s&&ordAssigned(o)>=o.cur.workers)return 'Filled';}return o.status;}
function ordPill(o){var s=ordStatus(o);var lab=s==='Changed - awaiting office'&&o.pending&&o.pending.kind==='cancel'?'Changed - awaiting office (cancel requested)':s;return '<span class="pill '+ORDER_ST[s]+' ordst">'+esc(lab)+'</span>';}
function ordActor(){return ME?ME.name+' ('+(ME.type==='admin'?'office':(ME.username||ME.email))+')':'system';}
function ordLog(o,action,detail){(o.history=o.history||[]).push({at:new Date().toISOString(),simDate:today(),who:ordActor(),action:action,detail:detail||''});audit('Crew order: '+action,o.firmName,o.no+(detail?' – '+detail:''));}
function nextOrderNo(){DB.orderSeq=(DB.orderSeq||0)+1;return 'CO-'+String(DB.orderSeq).padStart(4,'0');}
var ORD_FIELDS=[['date','Date'],['time','Time'],['workers','Workers'],['role','Role'],['note','Note']];
function ordDiff(a,b,firm){var out=[];if(!a||!b)return out;
  if(a.date!==b.date)out.push(['Date',shortDay(a.date),shortDay(b.date)]);
  var ta=ordTime(a),tb=ordTime(b);if(ta!==tb)out.push(['Time',ta,tb]);
  if(+a.workers!==+b.workers)out.push(['Workers',a.workers,b.workers]);
  if(a.role!==b.role)out.push(['Role',esc(orderRoleName(firm,a.role)),esc(orderRoleName(firm,b.role))]);
  if((a.note||'')!==(b.note||''))out.push(['Note',esc(a.note||'–'),esc(b.note||'–')]);return out;}
function diffText(d){return d.map(function(x){return x[0]+': '+String(x[1]).replace(/<[^>]+>/g,'')+' → '+String(x[2]).replace(/<[^>]+>/g,'');}).join('; ');}
function diffHtml(d){return '<ul class="chglist">'+d.map(function(x){return '<li><b>'+x[0]+':</b> <s class="old">'+x[1]+'</s> → <span class="new">'+x[2]+'</span></li>';}).join('')+'</ul>';}

/* validate one set of fields (shared by client and office) */
function ordCheck(firm,f,o){o=o||{};
  if(!o.office&&firmCodes(firm).indexOf(f.site)<0)return 'Please pick a site.';
  if(!f.date)return 'Please pick a date.';
  if(!quarterOk(f.start))return 'Pick a start time on the quarter hour (:00, :15, :30, :45).';
  if(f.end&&!quarterOk(f.end))return 'Pick a finish time on the quarter hour.';
  if(f.end&&f.hours)return 'Please give a finish time or a number of hours – not both.';
  if(f.hours){var h=+f.hours;if(!(h>0)||h>MAX_SHIFT_H||Math.round(h*4)!==h*4)return 'Hours must be between 0.25 and '+MAX_SHIFT_H+', in quarter hours.';}
  if(f.end){var se=spanErr(f.start,f.end);if(se)return se;}
  var w=+f.workers;if(!(w>=1)||w!==Math.floor(w)||w>ORDER_MAX_WORKERS)return 'Please enter how many workers you need (a whole number from 1 to '+ORDER_MAX_WORKERS+').';
  if(!f.role)return 'Please choose the job.';if(!roleOk(firm,f.role))return 'That job has no agreed rate yet – ask the office to add it to your Rate Schedule.';
  if(f.ppe&&GEAR_OPTS.indexOf(f.ppe)<0)return 'Choose who supplies the safety gear (PPE).';
  if(!o.office&&ordStartMs(f)<=nowMsApp())return 'That start time has already passed. Please pick a later date or time.';
  return '';}
function ordFieldsFrom(d,base){base=base||{};var f={site:d.site||base.site,date:d.date||base.date,start:d.start||base.start,end:d.end||'',hours:d.hours?+d.hours:null,workers:d.workers?+d.workers:base.workers,role:d.role||base.role,ppe:d.ppe||base.ppe,note:d.note!==undefined?String(d.note||'').trim().slice(0,500):(base.note||'')};return f;}
function ordCanChange(o){var s=ordStatus(o);if(['Declined','Cancelled'].indexOf(s)>=0)return '';if(o.pending&&o.pending.kind==='cancel')return '';var f=o.cur||o.pending&&o.pending.fields;if(!f||ordStartMs(f)<=nowMsApp())return '';return 'ok';}

/* ---------- client: create (one short screen; extras under "More options") ---------- */
FORMS.crewOrder=function(f,d){var firm=ME;var b=orderBlock(firm);if(b){toast(b.why+' '+b.fix);return;}
  var base=ordFieldsFrom(d);var dates=[base.date];
  if(d.until){var days=(d.days||[]).map(Number);if(d.until<d.date){toast('"Repeat until" must be on or after the first date.');return;}if(daysBetween(d.date,d.until)>ORDER_MAX_DAYS-1){toast('A repeat order can cover at most '+ORDER_MAX_DAYS+' days. Send another order for later dates.');return;}if(!days.length){toast('Pick the days of the week to repeat on.');return;}
    dates=[];for(var x=d.date;x<=d.until;x=addDays(x,1))if(days.indexOf(parseD(x).getDay())>=0)dates.push(x);if(!dates.length){toast('None of the picked days fall in that date range.');return;}}
  for(var i=0;i<dates.length;i++){var ff=JSON.parse(JSON.stringify(base));ff.date=dates[i];var e=ordCheck(firm,ff);if(e){toast(e+(dates.length>1?' ('+dates[i]+')':''));return;}}
  var series=dates.length>1?uid('ser'):null,made=[];
  dates.forEach(function(dt){var ff=JSON.parse(JSON.stringify(base));ff.date=dt;var hb=hoursBefore(ff),late=hb<orderCutoffH();
    var o={id:uid('co'),no:nextOrderNo(),firmId:firm.id,firmName:firm.name,seriesId:series,createdAt:new Date().toISOString(),createdBy:ordActor(),req:ff,cur:null,status:'Requested',pending:{kind:'new',fields:ff,late:late,hoursBefore:Math.round(hb*10)/10,at:new Date().toISOString(),by:ordActor()},decisions:[],history:[],shiftId:null};
    crewOrders().push(o);made.push(o);ordLog(o,'New order requested',ff.site+' '+ff.date+' '+ordTime(ff)+' · '+ff.workers+' × '+orderRoleName(firm,ff.role)+' · PPE: '+gearLabel(ff.ppe,firm)+(late?' · SHORT NOTICE (starts within '+orderCutoffH()+' h)':'')+(ff.note?' · note: '+ff.note:''));});
  notify('admin','New crew order'+(made.length>1?'s ('+made.length+' days)':'')+' from '+firm.name+': '+made.map(function(o){return o.no+' '+o.req.date;}).join(', ')+' – '+base.workers+' × '+orderRoleName(firm,base.role)+' at '+base.site+', start '+base.start+'. Confirm, decline or adjust in Crew orders.');
  notify(firm.id,'We got your crew order '+made.map(function(o){return o.no;}).join(', ')+'. The office will confirm it.');
  PAGE_STATE.coForm=false;save();render();
  modal(clientWord('<h2 id="orderdone">Order sent ✓</h2><p>Thank you. We got your order'+(made.length>1?'s for '+made.length+' days':'')+':</p><p><b>'+base.workers+' × '+esc(orderRoleName(firm,base.role))+'</b><br>'+made.map(function(o){return esc(shortDay(o.req.date));}).join(', ')+' · start '+esc(base.start)+'<br>'+esc(siteName(base.site))+'</p>'+ordReplyBox('ordreplydone',ordReplyWhen())+'<p>You can see it, change it or cancel it under "My crew orders".</p><p><button data-act="closeModal">OK</button></p>',firm));};
ACT.coopen=function(){PAGE_STATE.coForm=!PAGE_STATE.coForm;render();};

/* ---------- client: change ---------- */
var ORD_LOCKED='This order can\'t be changed here any more (it has started, is closed, or is being cancelled). Please contact the office.',ORD_LOCKED_CANCEL='This order can\'t be cancelled here any more (it has started, is closed, or is already being cancelled). Please contact the office.';
ACT.coedit=function(el){var o=ordById(el.dataset.id);if(!o||o.firmId!==ME.id){toast('Not allowed.');return;}if(!ordCanChange(o)){toast(ORD_LOCKED);return;}
  var f=(o.pending&&o.pending.kind==='change'&&o.pending.fields)||ordView(o),base=o.cur||f,late=hoursBefore(base)<orderCutoffH();
  modal(clientWord('<h2>Change order</h2><p class="small">'+esc(o.no)+' · '+esc(siteName(f.site))+'</p>'+(o.cur?'<p class="small">Confirmed now: <b>'+shortDay(o.cur.date)+' '+ordTime(o.cur)+' · '+o.cur.workers+' × '+esc(orderRoleName(ME,o.cur.role))+'</b>. This stays until the office says yes to your change.</p>':'')+
  (late?'<div class="alert warn small latewarn"><b>Late change:</b> this starts in less than '+orderCutoffH()+' hours. You can still change it, but late changes may be charged per your agreement.</div>':'')+
  '<form data-form="crewOrderEdit"><input type="hidden" name="id" value="'+o.id+'"><div class="grid2">'+inp('date','Date',f.date,{type:'date',req:true})+qSel('start','Start time',f.start,{req:true})+inp('workers','Number of workers',f.workers,{type:'number',req:true,extra:' min="1" max="'+ORDER_MAX_WORKERS+'" step="1" inputmode="numeric"'})+roleSelect(ME,f.role)+'</div>'+
  '<details class="more"><summary>More options</summary><div class="grid2">'+qSel('end','Finish time (optional)',f.end||'',{blank:'– not set –',hint:'Earlier than the start = next day.'})+inp('hours','…or hours (optional)',f.hours&&!f.end?f.hours:'',{type:'number',extra:' min="0.25" max="16" step="0.25"'})+'</div><label>Note (optional)</label><textarea name="note">'+esc(f.note||'')+'</textarea></details><p><button>Send change</button></p></form>',ME));};
FORMS.crewOrderEdit=function(f,d){var o=ordById(d.id),firm=ME;if(!o||o.firmId!==firm.id){toast('Not allowed.');audit('Blocked crew order change (not own order)',firm.name);save();return;}
  if(!ordCanChange(o)){toast(ORD_LOCKED);return;}
  var cur=(o.pending&&o.pending.kind!=='cancel'&&o.pending.fields)||o.cur;var nf=ordFieldsFrom(d,cur);nf.site=cur.site;nf.ppe=cur.ppe;
  var e=ordCheck(firm,nf);if(e){toast(e);return;}
  var base=o.cur||cur,diff=ordDiff(cur,nf,firm);if(!diff.length){toast('You did not change anything. Change a field, or close this box.');return;}
  var hb=hoursBefore(base),late=hb<orderCutoffH();
  if(!o.cur){o.pending.fields=nf;o.pending.late=o.pending.late||late;if(late)o.pending.lateEdit=true;o.pending.at=new Date().toISOString();ordLog(o,'Request changed before it was confirmed'+(late?' (LATE CHANGE)':''),diffText(diff));}
  else{var fromDiff=ordDiff(o.cur,nf,firm);if(!fromDiff.length){o.pending=null;o.status=o.restore?o.restore.status:'Confirmed';o.restore=null;ordLog(o,'Change request withdrawn (back to the confirmed version)','');save();closeModal();toast('Back to the confirmed order.');render();return;}
    if(!o.pending)o.restore={status:o.status,pending:null};o.pending={kind:'change',fields:nf,prev:o.cur,late:late||!!(o.pending&&o.pending.late),hoursBefore:Math.round(hb*10)/10,at:new Date().toISOString(),by:ordActor()};o.status='Changed - awaiting office';
    ordLog(o,'Change requested'+(late?' (LATE CHANGE – less than '+orderCutoffH()+' h before the start)':''),diffText(fromDiff));diff=fromDiff;}
  notify('admin',(late?'LATE CHANGE – ':'')+'Crew order change from '+firm.name+' ('+o.no+'): '+diffText(diff)+'. Confirm, decline or adjust in Crew orders.');
  save();closeModal();toast(late?'Change sent. The office will confirm it. This is a late change, so it may be charged per your agreement.':'Change sent. The office will confirm it.');render();};

/* ---------- client: cancel ---------- */
ACT.cocancel=function(el){var o=ordById(el.dataset.id);if(!o||o.firmId!==ME.id){toast('Not allowed.');return;}if(!ordCanChange(o)){toast(ORD_LOCKED_CANCEL);return;}
  var base=o.cur||ordView(o),late=hoursBefore(base)<orderCutoffH();
  modal(clientWord('<h2>Cancel this order?</h2><p><b>'+shortDay(base.date)+' '+ordTime(base)+'</b><br>'+base.workers+' × '+esc(orderRoleName(ME,base.role))+' · '+esc(siteName(base.site))+'</p><p class="small">The office confirms the cancellation.</p>'+(late?'<div class="alert warn small latewarn"><b>Late change:</b> this starts in less than '+orderCutoffH()+' hours. You can still cancel, but late changes may be charged per your agreement.</div>':'')+'<form data-form="crewOrderCancel"><input type="hidden" name="id" value="'+o.id+'"><p><button class="danger">Yes, cancel this order</button> <button type="button" class="sec" data-act="closeModal">No, keep it</button></p></form>',ME));};
FORMS.crewOrderCancel=function(f,d){var o=ordById(d.id),firm=ME;if(!o||o.firmId!==firm.id){toast('Not allowed.');return;}if(!ordCanChange(o)){toast(ORD_LOCKED_CANCEL);return;}
  var base=o.cur||ordView(o),hb=hoursBefore(base),late=hb<orderCutoffH();
  o.restore={status:o.status,pending:o.pending?JSON.parse(JSON.stringify(o.pending)):null};
  o.pending={kind:'cancel',fields:base,prev:o.cur,late:late,hoursBefore:Math.round(hb*10)/10,reason:String(d.reason||'').slice(0,300),at:new Date().toISOString(),by:ordActor()};o.status='Changed - awaiting office';
  ordLog(o,'Cancellation requested'+(late?' (LATE CHANGE – less than '+orderCutoffH()+' h before the start)':''),d.reason?'Reason: '+d.reason:'');
  notify('admin',(late?'LATE CHANGE – ':'')+'Crew order cancellation from '+firm.name+' ('+o.no+', '+base.site+' '+base.date+' '+base.start+'). Confirm or decline in Crew orders.');
  save();closeModal();toast(late?'Cancellation sent. The office will confirm it. This is a late change, so it may be charged per your agreement.':'Cancellation sent. The office will confirm it.');render();};

function roleSelect(firm,cur){var l=orderRoleList(firm),ok=l.filter(function(r){return r.ok;});if(!cur&&ok.length===1)cur=ok[0].key;
  return '<div><label class="req">Job</label><select name="role" required>'+(ok.length===1&&cur?'':'<option value="">– choose –</option>')+l.map(function(r){return '<option value="'+esc(r.key)+'"'+(r.ok?'':' disabled')+(r.key===cur&&r.ok?' selected':'')+'>'+esc(r.label)+(r.ok?'':' – no agreed rate, ask the office')+'</option>';}).join('')+'</select>'+(l.some(function(r){return !r.ok;})?'<div class="hint norate">Jobs without an agreed rate can\'t be ordered – ask the office.</div>':'')+'</div>';}

/* ---------- client page ---------- */
function orderForm(firm){var sites=DB.sites.filter(function(s){return s.firmId===firm.id;});
  return '<div class="card hl" id="orderform"><form data-form="crewOrder">'+(sites.length===1?'<input type="hidden" name="site" value="'+esc(sites[0].code)+'"><p class="small muted">Site: <b>'+esc(siteName(sites[0].code))+'</b></p>':'')+'<div class="grid2">'+
  (sites.length>1?sel('site','Site',sites.map(function(s){return [s.code,s.code+' – '+s.name];}),'',{req:true,blank:true}):'')+
  inp('date','Date',addDays(today(),1),{type:'date',req:true,extra:' min="'+today()+'"'})+
  qSel('start','Start time','07:00',{req:true})+
  inp('workers','Number of workers','',{type:'number',req:true,extra:' min="1" max="'+ORDER_MAX_WORKERS+'" step="1" inputmode="numeric"'})+
  roleSelect(firm,'')+'</div>'+
  '<details class="more"><summary>More options</summary><div class="grid2">'+
  qSel('end','Finish time (optional)','',{blank:'– not set –',hint:'Earlier than the start = next day (overnight), max '+MAX_SHIFT_H+' h.'})+
  inp('hours','…or hours (optional)','',{type:'number',extra:' min="0.25" max="16" step="0.25"'})+
  '<div><label>Safety gear (PPE) supplied by:</label><select name="ppe"><option value="">Not sure – office will confirm</option>'+GEAR_OPTS.map(function(g){return '<option value="'+g+'">'+esc(gearLabel(g,firm))+'</option>';}).join('')+'</select></div>'+
  inp('until','Repeat until (optional)','',{type:'date',hint:'Up to '+ORDER_MAX_DAYS+' days. One order per picked day.'})+
  '<div><label>Repeat on</label><div class="daypick">'+WEEKDAYS.map(function(w){return '<label class="inline"><input type="checkbox" name="days[]" value="'+w[0]+'"'+(w[0]>=1&&w[0]<=5?' checked':'')+'> '+w[1]+'</label>';}).join('')+'</div></div></div>'+
  '<label>Note (optional)</label><textarea name="note" placeholder="e.g. meet at the packing shed"></textarea></details>'+
  ordReplyBox('ordreplyform')+'<p><button type="submit" class="big">Send order</button></p><p class="small muted">Changes less than '+orderCutoffH()+' hours before the start may be charged per your agreement.</p></form></div>';}
/* Owner, Oct 6 2026: reply promise for crew orders (farm/client views only) */
var ORDER_REPLY_URGENT='If it\'s urgent, call or text <a href="tel:+19022004888" class="nw">902-200-4888</a> and someone will get back to you.';
var ORDER_REPLY_HTML='Someone from our office will confirm your order by 9 PM the same day. '+ORDER_REPLY_URGENT;
/* when: omitted = "the same day" (form, waiting orders); "today" / "tomorrow" on the order-sent confirmation (farm's own clock: before 9 PM = today) */
function ordReplyBox(id,when){var h=when?'Someone from our office will confirm your order by 9 PM '+when+'. '+ORDER_REPLY_URGENT:ORDER_REPLY_HTML;return '<div class="ordreply"'+(id?' id="'+id+'"':'')+'><span aria-hidden="true">🕑</span> <span>'+h+'</span></div>';}
function ordReplyWhen(d){d=d||new Date();return d.getHours()<21?'today':'tomorrow';}
var ORDER_PLAIN={Requested:'Waiting for the office',Confirmed:'Confirmed','Changed - awaiting office':'Change waiting for the office',Declined:'Not accepted',Cancelled:'Cancelled',Filled:'Confirmed – all filled'};
/* what the office decided, in plain words for the client */
function ordDecisionText(d){var k=d.kind;if(d.dec==='Declined')return k==='new'?'The office could not accept this order.':k==='change'?'The office did not accept your change – the order stays as it was.':'The office did not accept your cancellation – the order is still on.';
  if(d.dec==='Adjusted')return k==='new'?'The office changed this order:':'The office changed your request:';return k==='cancel'?'The office confirmed your cancellation.':k==='change'?'The office confirmed your change.':'The office confirmed this order.';}
function ordCardClient(o,firm){var f=ordView(o),st=ordStatus(o),p=o.pending,sh=ordShift(o),last=o.decisions[o.decisions.length-1];
  var asg=o.cur&&sh?ordAssigned(o):0,part=st==='Confirmed'&&sh&&asg>0&&asg<o.cur.workers;
  var lab=p&&p.kind==='cancel'?'Cancellation waiting for the office':part?'Confirmed – partly filled':ORDER_PLAIN[st];
  var x='<div class="ordcard" data-id="'+o.id+'"><div class="oc-head"><b>'+shortDay(f.date)+' · '+ordTime(f)+'</b><span class="pill '+(part?'s-warn':ORDER_ST[st])+' ordst">'+esc(lab)+'</span>'+(isLateChange(p)?'<span class="pill s-bad latetag">Late change</span>':'')+'</div>'+
  '<div class="oc-line"><b>'+f.workers+' × '+esc(orderRoleName(firm,f.role))+'</b> · '+esc(siteName(f.site))+(o.cur&&sh?' · <span class="assigned">'+asg+' of '+o.cur.workers+' workers assigned'+(asg<o.cur.workers?' so far':'')+'</span>':'')+'</div>'+
  (f.note?'<div class="small muted">Note: '+esc(f.note)+'</div>':'')+(st==='Requested'&&!(p&&p.kind==='cancel')?ordReplyBox():'');
  if(p&&p.kind==='change')x+='<div class="pendbox"><b>Your change (waiting for the office):</b>'+diffHtml(ordDiff(o.cur,p.fields,firm))+'</div>';
  if(isLateChange(p))x+='<div class="small latenote">Late change: late changes may be charged per your agreement.</div>';
  if(last&&(last.comment||last.dec!=='Confirmed'||(last.adjDiff&&last.adjDiff.length)))x+='<div class="small decision">'+esc(ordDecisionText(last))+(last.adjDiff&&last.adjDiff.length?diffHtml(last.adjDiff):'')+(last.comment?' <span class="offnote">Note from the office: “'+esc(last.comment)+'”</span>':'')+'</div>';
  if(ordCanChange(o))x+='<div class="row ocbtns"><button class="sec" data-act="coedit" data-id="'+o.id+'">Change</button><button class="danger" data-act="cocancel" data-id="'+o.id+'">Cancel</button></div>';
  x+='<details class="small hist"><summary>History</summary><ul>'+o.history.slice().reverse().map(function(h){return '<li>'+fmtStamp(h.at)+' – '+esc(clientSafe(h.who))+': '+esc(h.action)+(h.detail?' – '+esc(h.detail):'')+'</li>';}).join('')+'</ul></details>';
  return x+'</div>';}
function clientSafe(who){return /\(office\)$/.test(who)?'UnScramble office':who;}
VIEWS['firm:orders']=function(){var firm=ME,b=orderBlock(firm);
  var mine=ordersOf(firm).slice().sort(function(a,b){var x=ordView(a),y=ordView(b);return x.date<y.date?-1:x.date>y.date?1:x.start<y.start?-1:1;});
  var open=mine.filter(function(o){var s=ordStatus(o);return ['Declined','Cancelled'].indexOf(s)<0&&ordView(o).date>=today();}),closed=mine.filter(function(o){return open.indexOf(o)<0;}).reverse();
  var x='<h1>Crew orders</h1>';
  if(b)x+='<div class="alert bad" id="orderblocked"><b>You can\'t order crews yet.</b> '+esc(b.why)+'<div><b>What to do:</b> '+esc(b.fix)+'</div></div>';
  else x+='<button class="big" id="orderbtn" data-act="coopen">'+(PAGE_STATE.coForm?'Close':'＋ Order a crew')+'</button>'+(PAGE_STATE.coForm?orderForm(firm):'');
  x+='<h2 id="myorders">My crew orders</h2>'+(open.length?'<div id="orderlist">'+open.map(function(o){return ordCardClient(o,firm);}).join('')+'</div>':'<p class="muted msg-empty" id="orderlist">No upcoming crew orders.'+(b?'':' Tap “＋ Order a crew” to send one.')+'</p>');
  if(closed.length)x+='<details class="pastorders"><summary>Past and cancelled orders ('+closed.length+')</summary>'+closed.map(function(o){return ordCardClient(o,firm);}).join('')+'</details>';
  x+='<p class="small muted">Worker names are never shown – only how many are assigned.</p>';
  return clientWord(x,firm);};
NAV.firm.splice(1,0,['#/orders','Crew orders']);
/* short card on the client home page */
(function(){var oh=VIEWS['firm:home'];VIEWS['firm:home']=function(){var b=orderBlock(ME),mine=ordersOf(ME),pend=mine.filter(function(o){return o.pending;}).length;
  var card='<div class="card" id="ordercard"><a class="btn big" href="#/orders">'+(b?'Crew orders (not available yet)':'＋ Order a crew')+'</a>'+(pend?' <span class="small">'+pend+' order'+(pend===1?'':'s')+' waiting for the office</span>':'')+'</div>';
  return clientWord(card,ME)+oh();};})();
/* ---------- office: queue ---------- */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/farmchanges')return i+1;return NAV.admin.length;})(),0,['#/creworders','Crew orders']);
function coFilterList(st){var l=crewOrders().slice();
  if(st.tab==='new')l=l.filter(function(o){return o.pending&&o.pending.kind==='new';});
  else if(st.tab==='changes')l=l.filter(function(o){return o.pending&&o.pending.kind!=='new';});
  else if(st.tab==='late')l=l.filter(function(o){return o.pending&&o.pending.late;});
  else if(st.tab==='pending')l=l.filter(function(o){return !!o.pending;});
  else if(st.tab==='confirmed')l=l.filter(function(o){return !o.pending&&o.status==='Confirmed';});
  if(st.from)l=l.filter(function(o){return ordView(o).date>=st.from;});if(st.to)l=l.filter(function(o){return ordView(o).date<=st.to;});
  return l.sort(function(a,b){var x=ordView(a),y=ordView(b);return (a.pending?0:1)-(b.pending?0:1)||(x.date<y.date?-1:x.date>y.date?1:x.start<y.start?-1:1);});}
function ordCardOffice(o){var firm=user(o.firmId),f=ordView(o),p=o.pending,sh=ordShift(o),st=ordStatus(o);
  var x='<div class="ordcard office" data-id="'+o.id+'"><div class="oc-head"><b>'+esc(o.no)+'</b> <span>'+esc(o.firmName)+'</span>'+ordPill(o)+(p?'<span class="pill s-pend">'+(p.kind==='new'?'New order':p.kind==='change'?'Change request':'Cancel request')+'</span>':'')+(p&&p.late?'<span class="pill s-bad latetag">'+(isLateChange(p)?'Late change':'Short notice')+' ('+p.hoursBefore+' h before start)</span>':'')+'</div>'+
  '<div class="oc-grid"><div><span>Site</span>'+esc(siteName(f.site))+'</div><div><span>'+(o.cur?'Confirmed date':'Date')+'</span>'+shortDay(f.date)+'</div><div><span>Time</span>'+ordTime(f)+'</div><div><span>Workers</span>'+f.workers+'</div><div><span>Role</span>'+esc(orderRoleName(firm,f.role))+'</div><div><span>PPE supplied by</span>'+esc(f.ppe||'Office to confirm')+'</div></div>'+(f.note?'<div class="small">Client note: '+esc(f.note)+'</div>':'')+(o.seriesId?'<div class="small muted">Part of a repeat order ('+crewOrders().filter(function(x){return x.seriesId===o.seriesId;}).length+' days).</div>':'');
  if(p&&p.kind==='change')x+='<div class="pendbox"><b>Requested change</b> <span class="small muted">'+esc(p.by)+' · '+fmtStamp(p.at)+'</span>'+diffHtml(ordDiff(o.cur,p.fields,firm))+'</div>';
  if(p&&p.kind==='cancel')x+='<div class="pendbox"><b>Cancellation requested</b> <span class="small muted">'+esc(p.by)+' · '+fmtStamp(p.at)+'</span>'+(p.reason?'<div class="small">Reason: '+esc(p.reason)+'</div>':'')+'</div>';
  if(p){var t=p.kind==='cancel'?f:p.fields;
    x+='<form data-form="codecnone" class="codec" data-id="'+o.id+'">'+(p.kind!=='cancel'?'<details class="adjbox"><summary>Adjust (change date, time, workers or job)</summary><div class="grid2 adj">'+inp('date','Date',t.date,{type:'date'})+qSel('start','Start',t.start,{})+qSel('end','Finish',ordEnd(t),{blank:'– not set –'})+inp('workers','Workers',t.workers,{type:'number',extra:' min="1" step="1"'})+roleSelect(firm,t.role)+'</div></details>':'')+
    '<textarea name="comment" placeholder="Comment to the client (required to decline or adjust)"></textarea><div class="row"><button class="small" data-act="codec" data-d="Confirmed" data-id="'+o.id+'">'+(p.kind==='cancel'?'Confirm cancellation':'Confirm')+'</button>'+(p.kind!=='cancel'?'<button class="small sec" data-act="codec" data-d="Adjusted" data-id="'+o.id+'">Adjust</button>':'')+'<button class="small danger" data-act="codec" data-d="Declined" data-id="'+o.id+'">Decline</button></div></form>';}
  if(o.cur&&!p&&o.status==='Confirmed'){if(sh)x+='<div class="small bookline"><b>Booking:</b> shift '+esc(sh.title)+' · '+esc(sh.date)+' '+esc(sh.start)+'–'+esc(sh.end)+plus1(sh.start,sh.end)+' · '+(sh.kind==='crew'?'Subcontractor crew':'Employees')+' · assigned '+ordAssigned(o)+'/'+sh.needed+((sh.booked||[]).length?' ('+(sh.booked||[]).map(function(id){var u=user(id);return esc(u?u.name:'?');}).join(', ')+')':'')+' <a href="#/shiftsadmin">Shifts →</a></div>';
    else x+='<form data-form="cobook" class="row cobook"><input type="hidden" name="id" value="'+o.id+'"><select name="kind" aria-label="Who works it"><option value="crew">Subcontractor crew</option><option value="employee">Employee assignment</option></select>'+qSel('end','Finish',ordEnd(o.cur),{blank:'– finish –'})+'<div><label>PPE supplied by</label><select name="ppe"><option value="">Choose…</option>'+GEAR_OPTS.map(function(g){return '<option'+(g===o.cur.ppe?' selected':'')+'>'+g+'</option>';}).join('')+'</select></div><button class="small">Turn into a booking (shift)</button></form>';}
  var last=o.decisions[o.decisions.length-1];if(last)x+='<div class="small decision">Last decision: '+esc(last.dec)+' ('+esc(last.kind)+') by '+esc(last.by)+' · '+fmtStamp(last.at)+(last.comment?' · “'+esc(last.comment)+'”':'')+'</div>';
  x+='<details class="small"><summary>Audit trail ('+o.history.length+')</summary><ul>'+o.history.slice().reverse().map(function(h){return '<li>'+fmtStamp(h.at)+' – '+esc(h.who)+': '+esc(h.action)+(h.detail?' – '+esc(h.detail):'')+'</li>';}).join('')+'</ul></details>';
  return x+'</div>';}
VIEWS['admin:creworders']=function(){var st=PAGE_STATE.cof||{tab:'pending'};var all=crewOrders();
  var cnt=function(t){return coFilterList({tab:t}).length;};
  var tabs=[['pending','Awaiting office'],['new','New'],['changes','Changes & cancels'],['late','Late'],['confirmed','Confirmed'],['all','All']];
  return '<h1>Crew orders</h1><p class="small muted">Orders from approved clients with a signed agreement. Every new order, change and cancellation waits here for you to confirm, decline or adjust (with a comment). The client\'s confirmed version only changes when you approve. Changes or cancels less than <b>'+orderCutoffH()+' h</b> before the start are flagged "Late change" (cut-off in <a href="#/settings">Settings</a>). A confirmed order can be turned into a normal shift so crews are assigned the usual way. Clients never see worker names.</p>'+
  '<div class="row cotabs">'+tabs.map(function(t){return '<button class="small '+(st.tab===t[0]?'':'sec')+'" data-act="cofilter" data-t="'+t[0]+'">'+t[1]+' ('+cnt(t[0])+')</button>';}).join('')+'</div>'+
  '<details class="codatebox"'+(st.from||st.to?' open':'')+'><summary class="small">Filter by date</summary><form data-form="codates" class="row card" style="margin-top:8px"><div><label>Order date from</label><input type="date" name="from" value="'+esc(st.from||'')+'"></div><div><label>to</label><input type="date" name="to" value="'+esc(st.to||'')+'"></div><div style="align-self:flex-end"><button class="small">Filter by date</button> <button class="small sec" data-act="coclear">Clear</button></div></form></details>'+
  (function(){var l=coFilterList(st);return l.length?'<div id="coqueue">'+l.map(ordCardOffice).join('')+'</div>':'<p class="muted" id="coqueue">No crew orders match this filter.</p>';})()+'<p class="small muted">'+all.length+' order(s) in total.</p>';};
ACT.cofilter=function(el){var st=PAGE_STATE.cof||{};st.tab=el.dataset.t;PAGE_STATE.cof=st;render();};
FORMS.codates=function(f,d){if(d.from&&d.to&&d.from>d.to){toast('"From" must be before "to".');return;}var st=PAGE_STATE.cof||{tab:'pending'};st.from=d.from;st.to=d.to;PAGE_STATE.cof=st;render();};
ACT.coclear=function(){var st=PAGE_STATE.cof||{tab:'pending'};st.from='';st.to='';PAGE_STATE.cof=st;render();};
FORMS.codecnone=function(){};
ACT.codec=function(el){var o=ordById(el.dataset.id);if(!o||!o.pending)return;var form=el.closest('form'),dec=el.dataset.d,comment=(form.comment.value||'').trim(),p=o.pending,firm=user(o.firmId);
  if((dec==='Declined'||dec==='Adjusted')&&!comment){toast('Please write a comment for the client.');return;}
  var applied=null,diff=[],before=o.cur;
  if(dec==='Adjusted'){var t=p.fields;var nf={site:t.site,date:form.date.value,start:form.start.value,end:form.end.value,hours:form.end.value?null:t.hours,workers:+form.workers.value,role:form.role.value,ppe:t.ppe,note:t.note};var e=ordCheck(firm,nf,{office:true});if(e){toast(e);return;}if(!ordDiff(p.fields,nf,firm).length){toast('Values are the same as requested – use Confirm, or change them.');return;}applied=nf;}
  else if(dec==='Confirmed'&&p.kind!=='cancel')applied=p.fields;
  var rec={kind:p.kind,dec:dec,comment:comment,by:ME.name,at:new Date().toISOString(),late:isLateChange(p),hoursBefore:p.hoursBefore,requested:p.fields,prev:before||null};
  if(applied){diff=ordDiff(before||p.fields,applied,firm);if(dec==='Adjusted')rec.adjDiff=ordDiff(p.fields,applied,firm);o.cur=JSON.parse(JSON.stringify(applied));o.status='Confirmed';rec.applied=o.cur;rec.diff=before?diff:(rec.adjDiff||[]);if(o.shiftId)syncOrderShift(o);}
  else if(dec==='Confirmed'&&p.kind==='cancel'){o.status='Cancelled';cancelOrderShift(o);}
  else if(dec==='Declined'){if(p.kind==='new')o.status='Declined';else{o.status=o.restore&&o.restore.status?o.restore.status:(o.cur?'Confirmed':'Requested');if(o.restore&&o.restore.pending){o.pending=o.restore.pending;}}}
  if(!(dec==='Declined'&&p.kind!=='new'&&o.restore&&o.restore.pending))o.pending=null;o.restore=null;
  o.decisions.push(rec);
  var what=p.kind==='new'?'new order':p.kind==='change'?'change':'cancellation';
  ordLog(o,'Office '+dec.toLowerCase()+' '+what+(isLateChange(p)?' (late change)':''),(rec.adjDiff&&rec.adjDiff.length?'Adjusted: '+diffText(rec.adjDiff)+'. ':'')+(before&&applied&&diff.length?'Confirmed version: '+diffText(diff)+'. ':'')+(comment?'Comment: '+comment:''));
  notify(o.firmId,'Crew order '+o.no+': the office '+(({Confirmed:'confirmed',Adjusted:'changed',Declined:'could not accept'})[dec]||dec.toLowerCase())+' your '+what+(rec.adjDiff&&rec.adjDiff.length?' ('+diffText(rec.adjDiff)+')':'')+'.'+(comment?' Note from the office: '+comment:'')+(isLateChange(p)?' Recorded as a late change – late changes may be charged per your agreement.':''));
  save();toast('Decision saved.');render();};
function syncOrderShift(o){var s=ordShift(o);if(!s)return;var c=o.cur,old=s.date+' '+s.start+'–'+s.end+' ×'+s.needed;s.date=c.date;s.start=c.start;var e=ordEnd(c);if(e)s.end=e;s.needed=c.workers;s.role=shiftRoleOf(c.role);s.orderRole=c.role;
  var now=s.date+' '+s.start+'–'+s.end+' ×'+s.needed;if(old===now)return;ordLog(o,'Booking updated from the confirmed order',old+' → '+now);
  (s.booked||[]).forEach(function(id){notify(id,'Shift changed: '+s.title+' is now '+s.date+' '+s.start+'–'+s.end+plus1(s.start,s.end)+' at '+s.site+'.');});
  if((s.booked||[]).length>s.needed)notify('admin','Crew order '+o.no+': '+(s.booked||[]).length+' people are booked but only '+s.needed+' are needed now – remove '+((s.booked||[]).length-s.needed)+' in Shifts.');}
function cancelOrderShift(o){var s=ordShift(o);if(!s)return;var worked=DB.time.some(function(t){return t.shiftId===s.id;});
  if(worked){ordLog(o,'Booking kept – hours already recorded on it','Shift '+s.id);notify('admin','Crew order '+o.no+' was cancelled but hours are already recorded on its shift – check it in Shifts.');return;}
  (s.booked||[]).forEach(function(id){notify(id,'Shift cancelled: '+s.title+' on '+s.date+' at '+s.site+' (the client cancelled the order).');});
  DB.shifts=DB.shifts.filter(function(x){return x.id!==s.id;});ordLog(o,'Booking removed (order cancelled)','Shift '+s.title+' '+s.date);o.shiftId=null;}
FORMS.cobook=function(f,d){var o=ordById(d.id);if(!o||!o.cur||o.pending||o.status!=='Confirmed'){toast('Only a confirmed order with no pending request can be booked.');return;}if(ordShift(o)){toast('Already booked.');return;}
  var end=d.end||ordEnd(o.cur);if(!end){toast('Pick a finish time for the shift.');return;}var ppe=d.ppe||o.cur.ppe;if(GEAR_OPTS.indexOf(ppe)<0){toast('Choose who supplies the safety gear (PPE).');return;}if(ppe!==o.cur.ppe){ordLog(o,'Office set PPE supplied by',gearLabel(o.cur.ppe,user(o.firmId))+' → '+ppe);o.cur.ppe=ppe;}if(spanErr(o.cur.start,end)){toast(spanErr(o.cur.start,end));return;}
  var firm=user(o.firmId),n=DB.shifts.length;
  FORMS.newshift(null,{date:o.cur.date,title:'Crew order '+o.no+' – '+orderRoleName(firm,o.cur.role),start:o.cur.start,end:end,site:o.cur.site,kind:d.kind==='employee'?'employee':'crew',role:shiftRoleOf(o.cur.role),needed:o.cur.workers,safetyGear:o.cur.ppe,orientation:''});
  if(DB.shifts.length===n)return;var s=DB.shifts[DB.shifts.length-1];s.orderId=o.id;s.orderRole=o.cur.role;o.shiftId=s.id;if(!o.cur.end&&!o.cur.hours){o.cur.end=end;}
  ordLog(o,'Turned into a booking (shift)',s.title+' · '+s.date+' '+s.start+'–'+s.end+plus1(s.start,s.end)+' · '+(s.kind==='crew'?'Subcontractor crew':'Employees')+' · '+s.needed+' needed · PPE: '+s.safetyGear);
  notify(o.firmId,'Crew order '+o.no+' is booked. You will see how many workers are assigned on your Crew orders page.');save();render();};

/* ---------- office setting: cut-off hours ---------- */
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var x=os();var card='<div class="card" id="ordercutoff"><h3 style="margin-top:0">Crew orders – late-change cut-off</h3><p class="small">Clients can change or cancel a crew order at any time before it starts, but changes less than this many hours before the start are flagged "Late change" to the office, and the client sees that late changes may be charged per the agreement. (No fee amount is set in the app.)</p><form data-form="ordercutoff" class="row"><input type="number" name="hours" min="1" max="168" step="1" value="'+orderCutoffH()+'" style="max-width:110px" aria-label="Cut-off hours"> <span>hours before the start</span> <button class="small">Save</button></form></div>';
  return x.indexOf('<div class="card hl" id="schedA">')>=0?x.replace('<div class="card hl" id="schedA">',card+'<div class="card hl" id="schedA">'):x+card;};})();
FORMS.ordercutoff=function(f,d){var h=+d.hours;if(!(h>=1&&h<=168)||h!==Math.floor(h)){toast('Enter whole hours from 1 to 168.');return;}var old=orderCutoffH();DB.settings.orderCutoffHours=h;audit('Changed crew order late-change cut-off','',old+' h → '+h+' h');save();toast('Cut-off saved: '+h+' hours.');render();};

/* office overview flag */
(function(){var of=adminFlags;adminFlags=function(){var f=of();var n=crewOrders().filter(function(o){return o.pending;}).length,l=crewOrders().filter(function(o){return o.pending&&o.pending.late;}).length;if(n)f.unshift({t:'Crew orders',c:l?'s-bad':'s-pend',h:n+' crew order request(s) waiting'+(l?' ('+l+' late)':'')+'. <a href="#/creworders">Review →</a>'});return f;};})();

/* ---------- permissions ---------- */
ROLE_ONLY.crewOrder=['firm'];ROLE_ONLY.crewOrderEdit=['firm'];ROLE_ONLY.crewOrderCancel=['firm'];ROLE_ONLY.coedit=['firm'];ROLE_ONLY.cocancel=['firm'];ROLE_ONLY.coopen=['firm'];
ADMIN_ONLY_ACT.push('codec','cofilter','coclear');ADMIN_ONLY_FORM.push('cobook','codates','codecnone','ordercutoff');

/* ---------- seed: a few fake sample orders so the office queue and the client list are not empty ---------- */
function seedOrders(db){db.crewOrders=db.crewOrders||[];if(db.crewOrders.length)return;var by=function(n){return db.users.filter(function(u){return u.username===n;})[0];};
  var A=by('firmA'),O=by('clientFarm');if(!A||!O)return;var t0=new Date().toISOString(),d=function(n){return addDays(today(),n);};var seq=0;
  var mk=function(firm,f,status,cur,pending){seq++;var o={id:'co_seed'+seq,no:'CO-'+String(seq).padStart(4,'0'),firmId:firm.id,firmName:firm.name,seriesId:null,createdAt:t0,createdBy:'Sample data',req:f,cur:cur,status:status,pending:pending,decisions:[],history:[{at:t0,simDate:today(),who:'Sample data',action:'New order requested',detail:f.site+' '+f.date+' '+f.start+' · '+f.workers+' workers'}],shiftId:null};db.crewOrders.push(o);return o;};
  var f1={site:'TFA-01',date:d(3),start:'07:00',end:'15:00',hours:null,workers:6,role:'labour',ppe:'Client',note:'Sample: potato grading crew'};
  mk(A,f1,'Requested',null,{kind:'new',fields:f1,late:false,hoursBefore:68,at:t0,by:'Sample data'});
  var f2={site:'TOF-01',date:d(5),start:'06:30',end:'',hours:8,workers:4,role:'packer',ppe:'UnScramble',note:''};
  var o2=mk(O,f2,'Confirmed',JSON.parse(JSON.stringify(f2)),null);o2.decisions.push({kind:'new',dec:'Confirmed',comment:'',by:'Sample office',at:t0,late:false});o2.history.push({at:t0,simDate:today(),who:'Sample office (office)',action:'Office confirmed new order',detail:''});
  db.orderSeq=seq;}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedOrders(db);};})();
(function(){var ol=load;load=function(){ol();if(DB&&!DB.crewOrders){seedOrders(DB);save();}};})();
