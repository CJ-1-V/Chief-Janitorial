/* tilesall1 – owner Oct 14 2026 1:49 PM: "when I click on infographics, reveal all the data that is required on the office app side,
   just like we made for Clocked in right now".
   Front end only, no SQL. Office logins only (ME.type==='admin'). Every Overview tile opens a sheet listing EXACTLY the rows behind
   its number, using the same rule as the tile's own count in v2-officeinfo.js (keep the two in step). Data is re-read on every open,
   with the same scheduled-crew rows v2-synccheck adds to the Overview (scWithVirt), so the list always matches the tile.
   - "Clocked in right now" keeps its own sheet (v2-clockedin.js), unchanged.
   - Office Assistant: farms as "Farm <code>" only, never real names; no money. "Client invoices owing" is owner-only
     (invowner1 already removes that tile for everyone else; this file refuses to open it for non-owners too).
   - Rows link to the person (existing person card) and each sheet links to the full screen the tile used to open.
   Loaded right before v2-nohome.js (still last). Pairs with css/tilesall.css. Turn off: remove the 2 lines in index.html. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof modal!=='function')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function office(){return typeof ME!=='undefined'&&!!ME&&ME.type==='admin'&&!ME.__swReal;}
function helper(){return typeof window.ohIs==='function'&&window.ohIs();}
function owner(){return typeof window.ivOwner==='function'?window.ivOwner():!helper();}
function T(){return today();}
function virt(fn){return typeof window.scWithVirt==='function'?window.scWithVirt(fn,null,[],true):fn();}
function fmtH(x){x=Math.round(x*10)/10;return x%1===0?String(x):x.toFixed(1);}
function money(x){return '$'+(Math.round((+x||0)*100)/100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function weekStart(d){var x=parseD(d);return addDays(d,-((x.getDay()+6)%7));}
function code(f){var c=f&&typeof fhCode==='function'?fhCode(f):'';return c&&c!=='–'?c:'';}
/* farm label: assistant = code only; full office = name (+code) */
function farmTxt(f,site){if(!f)return site?(helper()?'Farm '+site:'Site '+site):'No farm / site recorded';var c=code(f);
  if(helper())return c?'Farm '+c:(site?'Farm '+site:'Farm');return (f.name||'Farm')+(c?' ('+c+')':'');}
function siteTxt(site){var f=site&&typeof firmOfSite==='function'?firmOfSite(site):null;return farmTxt(f,site);}
function pLink(u,fallback){if(!u)return E(fallback||'Unknown');return '<a href="#" data-act="person" data-id="'+E(u.id)+'">'+E(u.name||fallback||'Unknown')+'</a>';}
var TY={employee:'UnScramble employee',worker:'Subcontractor worker',sub:'Subcontractor',tester:'Tester'};
function typeTxt(u){if(!u)return '';var k=u.type==='worker'&&u.crewLead?'Crew lead':(TY[u.type]||u.type||'');var s=u.subId&&user(u.subId);return k+(s&&s.name?' · '+s.name:'');}

/* ---- same rules as v2-officeinfo.js ---- */
function counts(t){return !!(t&&!t.test&&t['in']&&t.out&&t.lateEntry!=='pending'&&t.lateEntry!=='rejected');}
function paidH(t){var w=hrs(t['in'],t.out);return Math.max(0,w-(typeof unpaidBreak==='function'?unpaidBreak(w,t):0));}
function realTime(from,to){var ty={};(DB.users||[]).forEach(function(u){ty[u.id]=u.type==='employee'?'emp':(u.type==='worker'||u.type==='sub')?'sub':null;});
  var R=[];(DB.time||[]).forEach(function(t){var g=ty[t.userId];if(g&&counts(t)&&t.date>=from&&t.date<=to)R.push({t:t,g:g,h:paidH(t),site:t.site,sched:!!t._scV});});return R;}
function firmsList(){if(typeof fhFirms==='function')return fhFirms();return (typeof companyFirms==='function'?companyFirms():users('firm')).filter(function(f){return f.active!==false&&!f.loginOf&&!f.mergedInto;});}
function crewCell(f,d){var v=typeof fhDay==='function'?fhDay(f.id,d):null;if(v)return {n:+v.n||0,jobs:(v.jobs||[]),st:v.ok?'ok':'pend'};
  var s=typeof fhSuggest==='function'?fhSuggest(f,d):{n:0,jobs:[]};return {n:+s.n||0,jobs:s.jobs||[],st:'sug'};}

/* ---- sheet builders: each returns {title,note,count,total,html,more:[href,label]} ---- */
function hoursSheet(from,label,id){var R=realTime(from,T()).sort(function(a,b){return a.t.date<b.t.date?1:a.t.date>b.t.date?-1:String(a.t['in']).localeCompare(String(b.t['in']));});
  var tot=0,emp=0,sub=0;R.forEach(function(e){tot+=e.h;e.g==='emp'?emp+=e.h:sub+=e.h;});
  var rows=R.map(function(e){var t=e.t,u=user(t.userId);return '<li class="ta-row"><div class="ta-a">'+pLink(u)+'<small>'+E(typeTxt(u))+'</small></div><div class="ta-b"><span>'+E(shortDay(t.date))+' · '+E(t['in'])+'–'+E(t.out)+'</span><small>'+E(siteTxt(t.site))+(e.sched?' · scheduled crew shift':'')+'</small></div><div class="ta-c"><b class="ta-v" data-v="'+esc(e.h)+'">'+fmtH(e.h)+' h</b></div></li>';});
  return {title:label,count:R.length,total:fmtH(tot)+' h',sum:tot,note:'<b>'+fmtH(tot)+' h</b> paid (break taken off) from '+R.length+' shift'+(R.length===1?'':'s')+' since '+E(shortDay(from))+' · employees '+fmtH(emp)+' h · subcontractor workers '+fmtH(sub)+' h. Late entries still waiting are not counted.',
    rows:rows,empty:'No hours recorded yet in this period.',more:id==='oiTWeek'?['#/payroll','Payroll hours']:['#/allhours','All hours']};}
function peopleSheet(){var to=T(),from=addDays(to,-6),by={};realTime(from,to).forEach(function(e){var r=by[e.t.userId]=by[e.t.userId]||{n:0,h:0,f:{},last:''};r.n++;r.h+=e.h;r.f[siteTxt(e.t.site)]=1;if(e.t.date>r.last)r.last=e.t.date;});
  var ids=Object.keys(by).sort(function(a,b){return by[b].h-by[a].h;});
  var rows=ids.map(function(id){var u=user(id),r=by[id];return '<li class="ta-row"><div class="ta-a">'+pLink(u)+'<small>'+E(typeTxt(u))+'</small></div><div class="ta-b"><span>'+E(Object.keys(r.f).join(', '))+'</span><small>Last shift '+E(shortDay(r.last))+'</small></div><div class="ta-c"><b>'+fmtH(r.h)+' h</b><small>'+r.n+' shift'+(r.n===1?'':'s')+'</small></div></li>';});
  return {title:'People who worked – last 7 days',count:ids.length,note:'<b>'+ids.length+'</b> '+(ids.length===1?'person':'different people')+' with approved hours from '+E(shortDay(from))+' to today.',rows:rows,empty:'Nobody has approved hours in the last 7 days.',more:['#/people','People']};}
function jobsTxt(J,f){return (J||[]).filter(function(j){return +j.qty;}).map(function(j){var k=j.role==='custom'?(j.label||'Other'):j.role;var n=typeof FH_SHORT!=='undefined'&&FH_SHORT[k]?FH_SHORT[k][1]:(typeof fhJobName==='function'&&j.role!=='custom'?fhJobName(f,k,2,''):k);return (+j.qty)+' '+n;}).join(' · ');}
function crewSheet(){var tm=addDays(T(),1),L=[],tot=0;firmsList().forEach(function(f){var c=crewCell(f,tm);if(!c.n)return;tot+=c.n;L.push({f:f,c:c});});L.sort(function(a,b){return b.c.n-a.c.n;});
  var ST={ok:['Confirmed by office','ta-ok'],pend:['Pending','ta-pend'],sug:['Suggested (not set yet)','ta-sug']};
  var rows=L.map(function(r){var s=ST[r.c.st];return '<li class="ta-row"><div class="ta-a"><b>'+E(farmTxt(r.f))+'</b><small>'+E(jobsTxt(r.c.jobs,r.f)||'Job not given')+'</small></div><div class="ta-b"><span class="ta-chip '+s[1]+'">'+s[0]+'</span></div><div class="ta-c"><b class="ta-v" data-v="'+esc(r.c.n)+'">'+r.c.n+'</b><small>'+(r.c.n===1?'person':'people')+'</small></div></li>';});
  return {title:'Crew coming tomorrow – '+shortDay(tm),count:L.length,sum:tot,note:'<b>'+tot+'</b> people at '+L.length+' farm'+(L.length===1?'':'s')+'. The number set by the office (Confirmed or Pending), or the grey suggestion from crew orders and shifts where none is set.',rows:rows,empty:'No crew numbers, crew orders or shifts for tomorrow yet.',more:['#/crewcoming','Crew coming']};}
function owingSheet(){var firms={};(typeof companyFirms==='function'?companyFirms():users('firm')).forEach(function(f){firms[f.id]=f;});var L=[],tot=0,over=0;
  (DB.clientInvoices||[]).forEach(function(i){if(i.test||!firms[i.firmId]||i.paidAt)return;var od=i.due?daysBetween(i.due,T()):0;L.push({i:i,f:firms[i.firmId],od:od});tot+=+i.total||0;if(od>0)over+=+i.total||0;});
  L.sort(function(a,b){return b.od-a.od;});
  var rows=L.map(function(r){var i=r.i;return '<li class="ta-row'+(r.od>0?' ta-bad':'')+'"><div class="ta-a"><b>'+E(i.number||'Invoice')+'</b><small>'+E(farmTxt(r.f))+'</small></div><div class="ta-b"><span>Issued '+E(i.issued?shortDay(i.issued):'–')+' · due '+E(i.due?shortDay(i.due):'–')+'</span><small>'+(r.od>0?r.od+' day'+(r.od===1?'':'s')+' overdue':'Not yet due')+'</small></div><div class="ta-c"><b class="ta-v" data-v="'+(+i.total||0)+'">'+money(i.total)+'</b><small>incl. HST</small></div></li>';});
  return {title:'Client invoices owing',count:L.length,sum:tot,note:'<b>'+money(tot)+'</b> still owing on '+L.length+' invoice'+(L.length===1?'':'s')+(over?' · <b class="ta-badtxt">'+money(over)+' overdue</b>':'')+'. Totals incl. HST; interest not included. Owner only.',rows:rows,empty:'No client invoice is owing.',more:['#/firms','Farms & other clients']};}
function waitSheet(){var G=[],n=0;function grp(label,href,items){n+=items.length;G.push({label:label,href:href,items:items});}
  grp('New accounts to approve','#/review',(DB.users||[]).filter(function(u){return u.accountApproved===false&&u.active!==false;}).map(function(u){return {a:pLink(u),b:typeTxt(u)};}));
  grp('Registrations to approve','#/review',(typeof pendingAccounts==='function'?pendingAccounts():[]).map(function(u){return {a:pLink(u),b:typeTxt(u)};}));
  grp('Uploads to review','#/review',(DB.docs||[]).filter(function(d){return d.status==='pending';}).map(function(d){var u=user(d.userId);return {a:pLink(u,d.name),b:(d.kind||'Document')+(d.uploadedAt||d.at?' · '+String(d.uploadedAt||d.at).slice(0,10):'')};}));
  grp('Late entries','#/lateentries',(DB.time||[]).filter(function(t){return t.lateEntry==='pending'&&!t.test;}).map(function(t){var u=user(t.userId);return {a:pLink(u),b:shortDay(t.date)+' · '+(t['in']||'')+'–'+(t.out||'')+' · '+siteTxt(t.site)+' · '+(t.subAdded?'added by subcontractor':t.manual?'crew lead / manual':'employee missed shift')};}));
  grp('Time changes from farms / clients','#/farmchanges',(DB.changes||[]).filter(function(c){return c.status==='Pending';}).map(function(c){var f=c.firmId&&user(c.firmId);return {a:E(f?farmTxt(f,c.site):siteTxt(c.site)),b:(c.date?shortDay(c.date):'')+' · '+(c.origStart||'')+'–'+(c.origEnd||'')+' → '+(c.propStart||'')+'–'+(c.propEnd||'')};}));
  grp('Crew orders waiting','#/creworders',(typeof coFilterList==='function'?coFilterList({tab:'pending'}):(DB.crewOrders||[]).filter(function(o){return o.pending;})).map(function(o){var v=(typeof ordView==='function'?ordView(o):(o.cur||o.req))||{},f=o.firmId&&user(o.firmId);return {a:'<b>'+E(o.no||'Order')+'</b> · '+E(f?farmTxt(f,v.site):siteTxt(v.site)),b:(v.date?shortDay(v.date):'')+(v.workers?' · '+v.workers+' workers':'')+' · '+(o.pending&&o.pending.kind==='change'?'change requested':'new order')};}));
  grp('Subcontractor invoices to approve','#/invoicesadmin',(DB.invoices||[]).filter(function(i){return !i.test&&i.status==='Submitted';}).map(function(i){var s=user(i.subId||i.userId);return {a:'<b>'+E(i.number||'Invoice')+'</b> · '+E(s?s.name:''),b:(helper()?'Submitted':money(i.total)+' · submitted')+(i.submittedAt?' '+String(i.submittedAt).slice(0,10):'')};}));
  grp('Missing documents to follow up','#/missingdocs',(typeof missingDocsPeople==='function'&&typeof missingDocsOpenCount==='function'?missingDocsPeople().filter(function(x){return x.status==='Open';}):[]).map(function(x){return {a:pLink(x.u,x.name),b:(x.now||[]).join(', ')};}));
  var rows=[];G.forEach(function(g){if(!g.items.length)return;rows.push('<li class="ta-grp"><span>'+E(g.label)+' <b>'+g.items.length+'</b></span><a href="'+E(g.href)+'" data-ta-go>Open →</a></li>');
    g.items.forEach(function(it){rows.push('<li class="ta-row ta-row2"><div class="ta-a">'+it.a+'</div><div class="ta-b"><small>'+E(it.b)+'</small></div></li>');});});
  return {title:'Waiting for you',count:n,note:n?'<b>'+n+'</b> item'+(n===1?'':'s')+' waiting, grouped as on the Overview chart. Tap a name to open the person, or “Open” for the screen.':'',rows:rows,empty:'All clear – nothing is waiting for your approval.',more:['#/review','Review & approve']};}
function blockedSheet(){var bl=typeof blockedList==='function'?blockedList():[],ok={};(DB.users||[]).forEach(function(u){if((u.type==='employee'||u.type==='worker'||u.type==='sub')&&u.active!==false&&!u.suspended)ok[u.id]=1;});
  var L=bl.filter(function(x){return ok[x.u.id];}).sort(function(a,b){return String(a.u.name).localeCompare(String(b.u.name));});
  var rows=L.map(function(x){return '<li class="ta-row ta-row2"><div class="ta-a">'+pLink(x.u)+'<small>'+E(typeTxt(x.u))+'</small></div><div class="ta-b"><ul class="ta-why">'+x.b.map(function(b){return '<li>'+E(typeof docShort==='function'?docShort(b.m):b.m)+'</li>';}).join('')+'</ul></div></li>';});
  return {title:'Blocked right now',count:L.length,note:'<b>'+L.length+'</b> active '+(L.length===1?'person':'people')+' cannot work a shift right now, and why.',rows:rows,empty:'Nobody is blocked – everyone active is clear to work.',more:['#/compliance','Compliance']};}

var SHEETS={oiTWeek:function(){return hoursSheet(weekStart(T()),'Hours this week','oiTWeek');},oiTMonth:function(){return hoursSheet(T().slice(0,8)+'01','Hours this month','oiTMonth');},
  oiTPeople:peopleSheet,oiTCrew:crewSheet,oiTOwing:owingSheet,oiTWait:waitSheet,oiTBlocked:blockedSheet};
var LBL={oiTWeek:'see every shift',oiTMonth:'see every shift',oiTPeople:'see who',oiTCrew:'see each farm',oiTOwing:'see each invoice',oiTWait:'see each item',oiTBlocked:'see who and why'};
function allowed(id){if(!office()||!SHEETS[id])return false;if(id==='oiTOwing')return owner()&&!helper();return true;}
function build(id){return virt(function(){return SHEETS[id]();});}
function open(id){if(!allowed(id))return;var s=build(id),now=new Date().toTimeString().slice(0,5);
  modal('<div class="ta-sheet" id="taSheet" data-tile="'+E(id)+'" data-count="'+esc(s.count)+'"'+(s.sum!=null?' data-sum="'+esc(s.sum)+'"':'')+'><h2>'+E(s.title)+'</h2><p class="ta-note">'+(s.note?s.note+' ':'')+'Updated '+now+'.</p>'+
    (s.rows.length?'<ul class="ta-list">'+s.rows.join('')+'</ul>':'<p class="ta-empty">'+E(s.empty)+'</p>')+
    (s.more?'<p class="ta-more"><a href="'+E(s.more[0])+'" data-ta-go>Open '+E(s.more[1])+' →</a></p>':'')+'</div>');}
window.tilesAll={open:open,build:function(id){return allowed(id)?build(id):null;},ids:Object.keys(SHEETS)};
/* links inside the sheet close it first */
document.addEventListener('click',function(e){var a=e.target&&e.target.closest&&e.target.closest('#taSheet a[data-ta-go],#taSheet [data-act=person]');if(a&&a.hasAttribute('data-ta-go'))closeModal();},true);
function hit(e){var x=e.target&&e.target.closest&&e.target.closest('#oiTiles .oi-tile[id]');if(!x||x.id==='oiTNow'||!allowed(x.id))return;e.preventDefault();e.stopPropagation();open(x.id);}
document.addEventListener('click',hit,true);
document.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' ')hit(e);},true);
function mark(){var L=document.querySelectorAll('#oiTiles .oi-tile[id]');for(var i=0;i<L.length;i++){var x=L[i];if(x.id==='oiTNow'||x.dataset.ta||!allowed(x.id))continue;x.dataset.ta='1';x.setAttribute('role','button');x.setAttribute('tabindex','0');x.classList.add('ta-tap');
  var l=x.querySelector('.oi-tl');x.setAttribute('aria-label',(l?l.textContent:'Tile')+': '+(LBL[x.id]||'see the list'));}}
new MutationObserver(mark).observe(document.documentElement,{childList:true,subtree:true});mark();
})();
