/* v2-officebookings.js – crewone2 (Oct 21 2026, owner 4:39 AM "also in the office side"). TEST COPY – not live. Loaded LAST.
   One office "Bookings" page = every farm's crew orders + Crew coming per farm and day + the office actions.
   - Top: "Waiting for the office" (new bookings, change and cancel requests) with Confirm / Adjust / Decline (existing codec).
   - Middle: Crew coming per farm and day (existing table: tap a day to set or confirm a day's crew; numbers follow the bookings,
     crewone1 sync; an office number set after the last booking change still wins).
   - Bottom: all other bookings (confirmed, cancelled, declined) with "Make the shift" (existing cobook).
   - Filter by farm and by date (from / to) for all three parts.
   - Routes: #/creworders (nav "Bookings") and the old #/crewcoming both open this page. Office Assistant keeps the same route
     whitelist and action blocks (no rates are shown on this page). No schema change, no SQL. */
(function(){'use strict';
if(typeof VIEWS==='undefined'||!VIEWS['admin:creworders']||!VIEWS['admin:crewcoming'])return;
var oldCC=VIEWS['admin:crewcoming'];
function S(){return PAGE_STATE.obk=PAGE_STATE.obk||{farm:'',from:'',to:''};}
function firmsList(){return (typeof fhFirms==='function'?fhFirms():DB.users.filter(function(u){return u.type==='firm';}));}
function inF(o,s){if(s.farm&&o.firmId!==s.farm)return false;var d=(ordView(o)||{}).date||'';if(s.from&&d<s.from)return false;if(s.to&&d>s.to)return false;return true;}
function view(){var s=S(),F=firmsList();
  var pend=coFilterList({tab:'pending'}).filter(function(o){return inF(o,s);});
  var rest=coFilterList({tab:'all'}).filter(function(o){return !o.pending&&inF(o,s);});
  var up=rest.filter(function(o){return ['Cancelled','Declined'].indexOf(ordStatus(o))<0&&ordView(o).date>=today();}),past=rest.filter(function(o){return up.indexOf(o)<0;});
  /* Crew coming table: same office table, started at the "from" date */
  var fhc=PAGE_STATE.fhc=PAGE_STATE.fhc||{start:addDays(today(),1),q:'',all:false};if(s.from&&s.from!==fhc._from){fhc.start=s.from;}else if(!s.from&&fhc._from){fhc.start=addDays(today(),1);}fhc._from=s.from;
  var cc=oldCC().replace(/<h1>[\s\S]*?<\/h1>\s*<p class="small muted">[\s\S]*?<\/p>/,'');
  var x='<h1 id="obkhd">Bookings</h1><p class="small muted">Every farm\'s bookings, Crew coming and your actions in one place. The farm sees the same status and numbers right away.</p>'+
  '<form class="card obk-bar" data-form="obkfilter" id="obkfilter"><div class="obk-f"><label>Farm<select name="farm"><option value="">All farms</option>'+F.map(function(f){return '<option value="'+esc(f.id)+'"'+(f.id===s.farm?' selected':'')+'>'+esc((typeof fhCode==='function'?fhCode(f)+' – ':'')+f.name)+'</option>';}).join('')+'</select></label>'+
    '<label>From<input type="date" name="from" value="'+esc(s.from||'')+'"></label><label>To<input type="date" name="to" value="'+esc(s.to||'')+'"></label></div>'+
    '<div class="row"><button class="small">Filter</button> <button type="button" class="small sec" data-act="obkclear">Clear</button><span class="small muted">'+pend.length+' waiting · '+up.length+' upcoming</span></div></form>'+
  '<section class="obk-sec" id="obkwait"><h2>Waiting for the office <span class="pill '+(pend.length?'s-pend':'s-ok')+'">'+pend.length+'</span></h2>'+(pend.length?'<div id="coqueue">'+pend.map(ordCardOffice).join('')+'</div>':'<p class="muted">Nothing waiting. ✓</p>')+'</section>'+
  '<section class="obk-sec" id="obkcoming"><h2>Crew coming – per farm and day</h2>'+cc+'</section>'+
  '<section class="obk-sec" id="obkall"><h2>Upcoming bookings <span class="pill s-ok">'+up.length+'</span></h2>'+(up.length?up.map(ordCardOffice).join(''):'<p class="muted">No upcoming bookings for this filter.</p>')+
  (past.length?'<details class="pastorders" id="obkpast"><summary>Past, cancelled and declined ('+past.length+')</summary>'+past.map(ordCardOffice).join('')+'</details>':'')+'</section>';
  return x;}
VIEWS['admin:creworders']=view;VIEWS['admin:crewcoming']=view;
FORMS.obkfilter=function(f,d){if(d.from&&d.to&&d.from>d.to){toast('"From" must be before "to".');return;}var s=S();s.farm=d.farm||'';s.from=d.from||'';s.to=d.to||'';render();};
ACT.obkclear=function(){PAGE_STATE.obk={farm:'',from:'',to:''};render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('obkclear');if(typeof ADMIN_ONLY_FORM!=='undefined')ADMIN_ONLY_FORM.push('obkfilter');
/* farm filter also applies to the Crew coming rows */
var oar=afterRender;afterRender=function(root){oar(root);try{var s=S(),t=document.querySelector('#obkcoming #fhctable');if(t&&s.farm)[].forEach.call(t.querySelectorAll('tr[data-firm]'),function(r){r.hidden=r.dataset.firm!==s.farm;});
  if(t&&s.farm&&!t.querySelector('tr[data-firm="'+s.farm+'"]')){var al=document.getElementById('fhcall');if(al&&!al.checked){(PAGE_STATE.fhc=PAGE_STATE.fhc||{}).all=true;setTimeout(render,0);}}}catch(e){console.warn('officebookings',e);}};
/* nav: one "Bookings" entry; #/crewcoming stays as a route */
function navFix(){try{var N=NAV.admin;N.forEach(function(n){if(n[0]==='#/creworders')n[1]='Bookings';});for(var i=N.length-1;i>=0;i--)if(N[i][0]==='#/crewcoming')N.splice(i,1);
  if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){var k=g[1].indexOf('#/crewcoming');if(k>=0)g[1].splice(k,1);});}catch(e){}}
(function(){try{var d=Object.getOwnPropertyDescriptor(NAV,'admin');if(!d)return;var get=d.get?d.get:function(){return d.value;},set=d.set?d.set:function(v){d.value=v;};
  Object.defineProperty(NAV,'admin',{configurable:true,enumerable:true,get:function(){return (get.call(NAV)||[]).filter(function(n){return n[0]!=='#/crewcoming';}).map(function(n){return n[0]==='#/creworders'?[n[0],'Bookings']:n;});},set:function(v){set.call(NAV,v);}});}catch(e){}})();
function oldRoute(){if(/^#\/crewcoming/.test(location.hash||'')){PAGE_STATE.obkScroll='obkcoming';location.replace('#/creworders');}}
window.addEventListener('hashchange',oldRoute);oldRoute();
navFix();var oar2=afterRender;afterRender=function(root){navFix();oar2(root);try{if(PAGE_STATE.obkScroll&&document.getElementById(PAGE_STATE.obkScroll)){var el=document.getElementById(PAGE_STATE.obkScroll);PAGE_STATE.obkScroll=null;setTimeout(function(){el.scrollIntoView({block:'start'});},50);}}catch(e){}try{if(ME&&ME.type==='admin')[].forEach.call(document.querySelectorAll('nav a[href="#/crewcoming"],#obar a[href="#/crewcoming"],.menu a[href="#/crewcoming"]'),function(a){(a.closest('li')||a).remove();});}catch(e){}};
})();
/* ---------- crewone3 (owner Oct 21 2026 11:53–11:54 AM): office Bookings laid out like All hours ----------
   - First: one box per farm running this month (bookings dated this month or hours worked this month), same .cb-box style as
     All hours, then a dashed "+ Add farm" box (pick any other active farm). Tap a box = that farm's bookings.
   - New requests from the farm (new booking, change, cancel) = green "N new" badge on the farm box, those farms sorted to the top,
     green total next to the title. Clears once the office opens that farm or handles the request (seen list kept per office user
     on this device).
   - Opened farm: Waiting (Confirm / Adjust / Decline – existing flow), Crew coming row, bookings with Change (date, time, crew size),
     Cancel booking and Assign people (to the booking's shift). All through the same order record → farm Bookings page in sync.
   - Office Assistant: farm codes only on boxes and picker, no rates anywhere. Front end only, no SQL. */
(function(){'use strict';
if(typeof VIEWS==='undefined'||!VIEWS['admin:creworders'])return;
var base=VIEWS['admin:creworders'];
function E(s){return esc(s);}
function S(){return PAGE_STATE.obk=PAGE_STATE.obk||{farm:'',from:'',to:''};}
function helper(){return typeof window.ohIs==='function'&&window.ohIs();}
function firms(){return typeof fhFirms==='function'?fhFirms():DB.users.filter(function(u){return u.type==='firm'&&u.active!==false;});}
function code(f){return (typeof fhCode==='function'?fhCode(f):'')||'';}
function lab(f){var c=code(f);return helper()?(c||'Farm'):((c?c+' – ':'')+(f.realName||f.name));}
function month(){return today().slice(0,7);}
function MN(){var p=month().split('-'),M=['January','February','March','April','May','June','July','August','September','October','November','December'];return M[+p[1]-1]+' '+p[0];}
function seenKey(){return 'obkSeen:'+(ME&&ME.id||'');}
function seen(){try{return JSON.parse(localStorage.getItem(seenKey())||'{}')||{};}catch(e){return {};}}
function setSeen(m){try{localStorage.setItem(seenKey(),JSON.stringify(m));}catch(e){}}
function isNew(o){return !!(o.pending&&seen()[o.id]!==String(o.pending.at||''));}
function markSeen(firmId){var m=seen(),ch=false;crewOrders().forEach(function(o){if(o.firmId===firmId&&o.pending){var a=String(o.pending.at||'');if(m[o.id]!==a){m[o.id]=a;ch=true;}}});if(ch)setSeen(m);}
window.obkIsNew=isNew;
function stats(){var M=month(),R={};function g(id){return R[id]=R[id]||{n:0,wait:0,nw:0,ppl:{},run:false};}
  crewOrders().forEach(function(o){if(!o.firmId)return;var d=(ordView(o)||{}).date||'',x=null;
    if(String(d).slice(0,7)===M){x=g(o.firmId);x.run=true;if(['Cancelled','Declined'].indexOf(o.status)<0)x.n++;}
    if(o.pending){x=g(o.firmId);x.wait++;if(isNew(o))x.nw++;}});
  (DB.time||[]).forEach(function(t){if(t.test||String(t.date||'').slice(0,7)!==M||t.removed||t.voided)return;var f=siteFirm(t.site||((DB.shifts||[]).filter(function(s){return s.id===t.shiftId;})[0]||{}).site);if(!f)return;var x=g(f.id);x.run=true;if(t.userId)x.ppl[t.userId]=1;});
  return R;}
function shown(){var R=stats(),s=S(),add=s.added||[];return firms().filter(function(f){var r=R[f.id];return (r&&(r.run||r.wait))||add.indexOf(f.id)>=0;}).map(function(f){var r=R[f.id]||{n:0,wait:0,nw:0,ppl:{}};return {f:f,n:r.n,wait:r.wait,nw:r.nw,p:Object.keys(r.ppl).length};})
  .sort(function(a,b){return b.nw-a.nw||b.wait-a.wait||(code(a.f)||a.f.name).localeCompare(code(b.f)||b.f.name);});}
function boxes(){var L=shown(),tn=L.reduce(function(a,x){return a+x.nw;},0);
  return '<h1 id="obkhd">Bookings'+(tn?' <span class="obk-newtot" id="obknewtot">'+tn+' new</span>':'')+'</h1><p class="small muted">Farms running in '+E(MN())+' (bookings or hours this month). Tap a farm to see its bookings, confirm, change or decline them and assign people. New requests from a farm show in green at the top.</p>'+
  '<div class="hb-wrap obk-wrap" id="obkboxes"><div class="cb-grid">'+L.map(function(x){var f=x.f,c=code(f);
    return '<button type="button" class="cb-box obk-box'+(x.nw?' obk-hasnew':'')+'" data-obkfarm="'+E(f.id)+'" aria-label="'+E(lab(f)+': '+x.n+' bookings this month'+(x.nw?', '+x.nw+' new':''))+'">'+(x.nw?'<span class="obk-badge">'+x.nw+' new</span>':'')+
      '<span class="cb-code">'+E(c||(helper()?'Farm':f.name))+'</span><span class="cb-n">'+x.n+'</span><span class="cb-l">'+(x.n===1?'booking':'bookings')+'</span><span class="cb-e">'+x.p+(x.p===1?' person':' people')+' this month'+(x.wait?' · '+x.wait+' waiting':'')+'</span>'+(!helper()&&c?'<span class="cb-f">'+E(f.realName||f.name)+'</span>':'')+'</button>';}).join('')+
  '<button type="button" class="cb-box mia-addbox obk-addbox" data-act="obkaddfarm" id="obkaddbox" aria-label="Add a farm"><span class="cb-code">+ Add farm</span><span class="cb-l">any other farm</span></button></div>'+(L.length?'':'<p class="muted">No farm has bookings or hours this month yet. Use “+ Add farm”.</p>')+'</div>';}
function opened(){var s=S(),f=user(s.open);if(!f){s.open='';return boxes();}s.farm=f.id;s.fresh=crewOrders().filter(function(o){return o.firmId===f.id&&isNew(o);}).map(function(o){return o.id;});markSeen(f.id);
  var x=base();x=x.replace(/<h1 id="obkhd">[\s\S]*?<\/h1>\s*<p class="small muted">[\s\S]*?<\/p>/,'');
  return '<div class="cb-head obk-head" id="obkhead"><button type="button" class="small sec" data-act="obkback">← All farms</button><h1 id="obkhd"><span class="cb-code">'+E(code(f)||'Farm')+'</span> '+(helper()?'':E(f.realName||f.name))+'</h1></div>'+
    '<p class="small muted">Everything for this farm in one place. Each change goes to the farm\'s Bookings page right away.</p>'+x;}
function view(){var s=S();if(!s.open){s.farm='';return boxes();}return opened();}
VIEWS['admin:creworders']=view;VIEWS['admin:crewcoming']=view;
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-obkfarm]');if(!b)return;var s=S();s.y0=window.scrollY;s.open=b.getAttribute('data-obkfarm');s.from='';s.to='';render();window.scrollTo(0,0);});
ACT.obkback=function(){var s=S(),y=s.y0;s.open='';s.farm='';render();if(y!=null)setTimeout(function(){window.scrollTo(0,y);},0);};
ACT.obkaddfarm=function(){var sh=shown().map(function(x){return x.f.id;}),L=firms().filter(function(f){return sh.indexOf(f.id)<0;});
  modal('<div id="obkpick"><h2>Add a farm</h2><p class="small muted">Farms already shown this month are left out. The farm opens so you can book or assign people.</p>'+
   (L.length?'<form data-form="obkaddfarmok" id="obkpickform"><label class="req" for="obkfarmsel">Farm</label><select name="farm" id="obkfarmsel" required><option value="">– choose –</option>'+L.map(function(f){return '<option value="'+E(f.id)+'">'+E(lab(f))+'</option>';}).join('')+'</select>'+
   '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="obkpickgo">Add farm</button></div></form>':'<p>All farms are already shown.</p><div class="row-end"><button type="button" class="sec" data-act="closeModal">Close</button></div>')+'</div>');};
FORMS.obkaddfarmok=function(f,d){var F=user(d.farm);if(!F||F.type!=='firm'){toast('Pick a farm.');return;}var s=S();s.added=(s.added||[]).filter(function(x){return x!==F.id;}).concat([F.id]);s.open=F.id;closeModal();render();window.scrollTo(0,0);};
/* ---- actions on each booking card while a farm is open ---- */
function canAct(o){return o&&o.cur&&!o.pending&&o.status==='Confirmed'&&ordView(o).date>=today();}
var oc=ordCardOffice;ordCardOffice=function(o){var x=oc.apply(this,arguments);if(!S().open)return x;try{
  if(o.pending&&(S().fresh||[]).indexOf(o.id)>=0)x=x.replace('<div class="oc-head">','<div class="oc-head"><span class="obk-badge inl">New</span>');
  if(canAct(o)){var sh=ordShift(o),A='<div class="row obk-acts"><button type="button" class="small sec" data-act="obkchange" data-id="'+E(o.id)+'">Change (date, time, crew)</button>'+
     (sh?'<button type="button" class="small" data-act="obkassign" data-id="'+E(o.id)+'">Assign people ('+ordAssigned(o)+'/'+sh.needed+')</button>':'')+
     '<button type="button" class="small danger" data-act="obkcancel" data-id="'+E(o.id)+'">Cancel booking</button></div>';
    var i=x.indexOf('<div class="small decision">');if(i<0)i=x.indexOf('<details class="small"><summary>Audit');x=i<0?x.replace(/<\/div>$/,A+'</div>'):x.slice(0,i)+A+x.slice(i);}
  }catch(e){console.warn('obk card',e);}return x;};
function recPush(o,dec,kind,comment,diff,prev){var at=new Date().toISOString();o.decisions=o.decisions||[];o.decisions.push({kind:kind,dec:dec,comment:comment,by:ME.name,at:at,requested:o.cur,prev:prev||null,applied:o.cur,diff:diff||[],office:true});}
ACT.obkchange=function(el){var o=ordById(el.dataset.id);if(!canAct(o)){toast('Only a confirmed upcoming booking with no open request can be changed here.');return;}var c=o.cur;
  modal('<div id="obkchgbox"><h2>Change booking '+E(o.no)+'</h2><form data-form="obkchangeok" id="obkchgform"><input type="hidden" name="id" value="'+E(o.id)+'"><div class="grid2">'+inp('date','Date',c.date,{type:'date',req:true})+qSel('start','Start',c.start,{})+qSel('end','Finish',ordEnd(c),{blank:'– not set –'})+inp('workers','Crew size',c.workers,{type:'number',extra:' min="1" step="1"'})+'</div>'+
   '<label class="req" for="obkchgc">Comment to the farm</label><textarea name="comment" id="obkchgc" required placeholder="Why it changes"></textarea><p class="small muted">The farm sees the new date, time and crew size on its Bookings page right away. A booked shift is updated too.</p>'+
   '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="obkchggo">Save change</button></div></form></div>');};
FORMS.obkchangeok=function(f,d){var o=ordById(d.id);if(!canAct(o))return;var firm=user(o.firmId),cm=String(d.comment||'').trim();if(!cm){toast('Please write a comment for the farm.');return;}
  var nf=JSON.parse(JSON.stringify(o.cur)),w=Math.floor(+d.workers||0);nf.date=d.date;nf.start=d.start;if(d.end){nf.end=d.end;nf.hours=null;}nf.workers=w;if(nf.sched&&nf.sched.from===o.cur.date&&nf.date!==o.cur.date){nf.sched.from=nf.date;if(nf.sched.until&&nf.sched.until<=nf.date)nf.sched.until='';}
  if(nf.crew&&nf.crew.length){var sum=nf.crew.reduce(function(a,c){return a+(+c.qty||0);},0);if(w!==o.cur.workers){if(nf.crew.length===1)nf.crew[0].qty=w;else if(w>sum)nf.open=w-sum;else{toast('This booking has several jobs – use a crew size of at least '+sum+', or ask the farm to change the jobs.');return;}}}
  var e=ordCheck(firm,nf,{office:true});if(e){toast(e);return;}var df=ordDiff(o.cur,nf,firm);if(!df.length){toast('Nothing changed.');return;}
  var prev=o.cur;o.cur=nf;o.status='Confirmed';if(o.shiftId)syncOrderShift(o);recPush(o,'Changed by office','change',cm,df,prev);
  ordLog(o,'Office changed the booking',diffText(df)+'. Comment: '+cm);notify(o.firmId,'Booking '+o.no+': the office changed it ('+diffText(df)+'). Note from the office: '+cm);
  var s=ordShift(o);if(s&&(s.booked||[]).length>s.needed)toast('Saved. '+(s.booked.length-s.needed)+' too many people assigned – remove some.');else toast('Booking changed. The farm sees it now.');save();closeModal();render();};
ACT.obkcancel=function(el){var o=ordById(el.dataset.id);if(!canAct(o))return;
  modal('<div id="obkcanbox"><h2>Cancel booking '+E(o.no)+'?</h2><p>'+E(shortDay(o.cur.date))+' · '+E(ordTime(o.cur))+' · '+o.cur.workers+' people</p><form data-form="obkcancelok"><input type="hidden" name="id" value="'+E(o.id)+'"><label class="req" for="obkcanc">Comment to the farm</label><textarea name="comment" id="obkcanc" required></textarea>'+
   '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Keep it</button><button class="danger" id="obkcango">Cancel booking</button></div></form></div>');};
FORMS.obkcancelok=function(f,d){var o=ordById(d.id);if(!canAct(o))return;var cm=String(d.comment||'').trim();if(!cm){toast('Please write a comment for the farm.');return;}
  o.status='Cancelled';cancelOrderShift(o);recPush(o,'Cancelled by office','cancel',cm,[],o.cur);ordLog(o,'Office cancelled the booking','Comment: '+cm);notify(o.firmId,'Booking '+o.no+' was cancelled by the office. Note: '+cm);save();closeModal();toast('Booking cancelled. The farm sees it now.');render();};
/* assign people (crewone4): every active, approved employee, subcontractor and sub worker. Groups: Our employees, Subcontractors, then each sub's workers under that sub. Worked at this farm in the last 30 days = sorted first + tagged. Names only, never rates. */
function obkOk(u){return !!u&&u.active!==false&&!u.suspended&&u.approved!==false&&u.accountApproved!==false&&!u.virtual&&!u.test&&!u.anonymous;}
function obkCan(u){if(!obkOk(u))return false;if(u.type==='employee'||u.type==='sub')return true;if(u.type!=='worker')return false;var sb=u.subId?user(u.subId):null;return !u.subId||obkOk(sb);}
function people(o){var f=user(o.firmId),codes=(DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;}),from=addDays(today(),-30),seenU={};
  var P=(DB.users||[]).filter(obkCan);
  (DB.time||[]).forEach(function(t){if(t.test||codes.indexOf(t.site)<0||t.date<from)return;seenU[t.userId]=1;});
  var groups=[],gi={},add=function(key,label,kind,u){if(!gi[key]){gi[key]={key:key,label:label,kind:kind,list:[]};groups.push(gi[key]);}gi[key].list.push(u);};
  var subs=P.filter(function(u){return u.type==='sub';}).sort(function(a,b){return a.name<b.name?-1:1;});
  P.filter(function(u){return u.type==='employee';}).forEach(function(u){add('emp','Our employees','emp',u);});
  subs.forEach(function(u){add('subs','Subcontractors','subs',u);});
  subs.forEach(function(sb){P.filter(function(u){return u.type==='worker'&&u.subId===sb.id;}).forEach(function(u){add('w-'+sb.id,'Workers – '+(sb.company&&sb.company.legalName||sb.name),'subw',u);});});
  P.filter(function(u){return u.type==='worker'&&!u.subId;}).forEach(function(u){add('w-none','Workers – no sub linked','subw',u);});
  groups.forEach(function(g){g.list.sort(function(a,b){var x=seenU[a.id]?0:1,y=seenU[b.id]?0:1;return x-y||(a.name<b.name?-1:1);});});
  return {seen:seenU,groups:groups,ids:P.map(function(u){return u.id;})};}
function busy(u,s){var a=function(t){var p=String(t||'').split(':');return +p[0]*60+(+p[1]||0);};var s0=a(s.start),s1=a(s.end);if(s1<=s0)s1+=1440;
  return (DB.shifts||[]).some(function(x){if(x.id===s.id||x.date!==s.date||(x.booked||[]).indexOf(u.id)<0)return false;var x0=a(x.start),x1=a(x.end);if(x1<=x0)x1+=1440;return x0<s1&&s0<x1;});}
ACT.obkassign=function(el){var o=ordById(el.dataset.id),s=o&&ordShift(o);if(!s){toast('Turn the booking into a shift first.');return;}var P=people(o),bk=s.booked||[];
  var row=function(u){var bl=[];try{bl=typeof blockers==='function'?blockers(u,s.date,s)||[]:[];}catch(e){bl=[];}var b=busy(u,s)||bl.length>0,on=bk.indexOf(u.id)>=0;return '<label class="inline obk-p'+(b?' muted':'')+'"><input type="checkbox" name="who" value="'+E(u.id)+'"'+(on?' checked':'')+(b&&!on?' disabled':'')+'> '+E(u.name)+(P.seen[u.id]?' <span class="obk-here">worked here</span>':'')+(b&&!on?(bl.length?' – can’t take this shift: '+E(bl[0].m):' – booked on another shift then'):'')+'</label>';};
  modal('<div id="obkassignbox"><h2>Assign people</h2><p>'+E(o.no)+' · '+E(shortDay(s.date))+' '+E(s.start)+'–'+E(s.end)+' · <b id="obkneed">'+s.needed+'</b> needed</p><form data-form="obkassignok" id="obkassignform"><input type="hidden" name="id" value="'+E(o.id)+'">'+
   P.groups.map(function(g){return '<details class="obk-grp obk-g-'+g.kind+'" data-grp="'+E(g.key)+'" open><summary>'+E(g.label)+' ('+g.list.length+')</summary>'+g.list.map(row).join('')+'</details>';}).join('')+(P.groups.length?'':'<p class="muted">No active, approved people yet.</p>')+
   '<p class="small muted">The farm sees how many are assigned (never the names). Each person gets the shift.</p><div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="obkassigngo">Save</button></div></form></div>');};
FORMS.obkassignok=function(f,d){var o=ordById(d.id),s=o&&ordShift(o);if(!s)return;var ids=[].concat(f.querySelectorAll?[].map.call(f.querySelectorAll('input[name=who]:checked'),function(i){return i.value;}):(d.who||[]));
  if(ids.length>s.needed){toast('Only '+s.needed+' needed – untick '+(ids.length-s.needed)+', or raise the crew size with Change.');return;}
  var keep=(s.booked||[]).filter(function(id){var u=user(id);return !u||(u.type!=='worker'&&u.type!=='employee'&&u.type!=='sub');}),old=s.booked||[];
  s.booked=keep.concat(ids);var add=ids.filter(function(i){return old.indexOf(i)<0;}),rem=old.filter(function(i){return s.booked.indexOf(i)<0;});
  add.forEach(function(id){notify(id,'You are booked: '+s.title+' on '+s.date+' '+s.start+'–'+s.end+' at '+s.site+'.');});rem.forEach(function(id){notify(id,'Shift removed: '+s.title+' on '+s.date+' at '+s.site+'.');});
  ordLog(o,'Office assigned people',ordAssigned(o)+'/'+s.needed+' assigned');audit('Crew updated',ME.name,s.date+' '+s.site+': '+ids.length+' worker(s)');save();closeModal();toast('Saved: '+ordAssigned(o)+' of '+s.needed+' assigned.');render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('obkback','obkaddfarm','obkchange','obkcancel','obkassign');if(typeof ADMIN_ONLY_FORM!=='undefined')ADMIN_ONLY_FORM.push('obkaddfarmok','obkchangeok','obkcancelok','obkassignok');
/* opened farm: the farm picker is replaced by the box */
var oar=afterRender;afterRender=function(root){oar(root);try{if(S().open){var sel=document.querySelector('#obkfilter select[name=farm]');if(sel){var l=sel.closest('label');if(l)l.hidden=true;}}}catch(e){}};
})();
