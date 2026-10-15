/* v2-personpage.js – personpage1 (owner Oct 15 2026, 10:48 AM): every "Open" on a person or farm (People, Overview tile lists,
   Farms, Documents …) opens a full page: all details, ALL hours (date filter, week + overall totals, CSV) and a READ-ONLY
   "See their page" view that renders exactly what that login sees.
   Read-only view: drawn from a throw-away copy of the data with saving, audit, login log and alerts switched off; ME, the
   session and the real data are put back before anything else runs. The drawn page is inert (no clicks, no forms, no ids).
   Rules: farm invoices + the farm's own view = owner only. Office Assistant: farm codes only (names scrubbed), no invoices,
   no farm view. Employee rules apply to subcontractors and sub workers too. Load before v2-nohome.js. */
(function(){
'use strict';
function E(s){return esc(s==null?'':String(s));}
function owner(){return typeof ivOwner==='function'?ivOwner():(ME&&ME.type==='admin');}
function helper(){return typeof ohIs==='function'&&ohIs();}
function scrub(h){return typeof ohScrub==='function'?ohScrub(h):h;}
function st(){return PAGE_STATE.pp||null;}
var KIND={firm:'Farm / client',sub:'Subcontractor',worker:'Sub worker',employee:'Employee',admin:'Office',tester:'Tester'};
function statusTxt(u){if(u.active===false&&u.accountApproved===false)return ['Declined','s-bad'];if(u.active===false)return ['Switched off','s-mut'];
  if(u.suspended)return ['On hold','s-bad'];if(u.accountApproved===false)return ['Waiting for approval','s-pend'];return ['Active','s-ok'];}
function farmHoursOk(u){return !(u&&u.type==='firm')||(owner()&&!helper());}   /* personpage2 (owner Oct 15 11:08): farm hours + farm view = owner only */
function canViewAs(u){if(!u||u.type==='admin')return false;if(u.type==='firm')return owner()&&!helper();return true;}
function firmCodesOf(f){return (DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;});}
function siteOfT(t){if(t.site)return t.site;var sh=t.shiftId&&(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return sh&&sh.site||'';}
function siteCode(code){return code||'–';}

/* ---------- open ---------- */
ACT.person=function(el){var id=el.dataset.id;if(!user(id)){toast('Not found.');return;}closeModal();try{audit('Viewed person record',user(id).name);}catch(e){}
  PAGE_STATE.pp={id:id,tab:'details',back:location.hash||'#/people'};if((location.hash||'').split('?')[0]==='#/people')render();else go('#/people');};
ACT.ppback=function(){var s=st();PAGE_STATE.pp=null;var b=(s&&s.back)||'#/people';if(b.split('?')[0]==='#/people')render();else go(b);};
ACT.pptab=function(el){var s=st();if(!s)return;s.tab=el.dataset.tab;if(el.dataset.page)s.page=el.dataset.page;render();};
ACT.ppcsv=function(){var s=st();if(!s)return;var u=user(s.id);if(!farmHoursOk(u)){toast('Farm hours are visible to the owner only.');return;}var R=hourRows(u,s.from,s.to);
  var head=['Date','Person','Farm code','In','Out','Break (h)','Hours','Status','Source','Edits'];
  var lines=[head].concat(R.map(function(r){return [r.date,r.who,r.site,r['in'],r.out,r.brk.toFixed(2),r.h.toFixed(2),r.status,r.src,r.edits];}));
  var csv=lines.map(function(a){return a.map(function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',');}).join('\n');
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='hours-'+(u.type==='firm'&&helper()?(firmCodesOf(u)[0]||'farm'):String(u.name||'person').replace(/[^\w]+/g,'-'))+'-'+(s.from||'all')+'_'+(s.to||'all')+'.csv';
  document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},500);};
FORMS.ppdates=function(f,d){var s=st();if(!s)return;s.from=d.from||'';s.to=d.to||'';render();};

/* ---------- hours ---------- */
function paidH(t){var w=hrs(t['in'],t.out);return t.out?Math.max(0,w-(typeof unpaidBreak==='function'?unpaidBreak(w,t):0)):0;}
function hourRows(u,from,to){var all=(typeof allTime==='function'?allTime():DB.time)||[],codes=u.type==='firm'?firmCodesOf(u):null,out=[];
  all.forEach(function(t){if(!t||t.test)return;if(codes?codes.indexOf(siteOfT(t))<0:t.userId!==u.id)return;if(from&&t.date<from||to&&t.date>to)return;
    var w=hrs(t['in'],t.out),h=paidH(t),wk=user(t.userId);
    var stx=t.removed?'Voided':!t.out?'Open (clocked in)':t.hoursStatus?String(t.hoursStatus):t.approved===false?'Not approved':t.approved?'Approved':'Recorded';
    var ed=(DB.changes||[]).filter(function(c){return c.entryId===t.id||c.timeId===t.id;}).length+((t.edits||[]).length||0)+(t.editedAt?1:0);
    out.push({date:t.date,who:codes?(wk?wk.name:'Worker'):u.name,site:siteCode(siteOfT(t)),'in':t['in']||'',out:t.out||'',brk:t.out?Math.max(0,w-h):0,h:t.removed?0:h,status:stx,src:t.manual||t.officeEntry?'Office entry':t.clock?'Clocked':'Recorded',edits:ed?ed+' change'+(ed===1?'':'s'):'',removed:!!t.removed});});
  (DB.timeVoided||[]).forEach(function(t){if(!t||(codes?codes.indexOf(t.site)<0:t.userId!==u.id))return;if(from&&t.date<from||to&&t.date>to)return;if(out.some(function(r){return r.removed&&r.date===t.date&&r['in']===t['in'];}))return;
    out.push({date:t.date,who:codes?((user(t.userId)||{}).name||'Worker'):u.name,site:siteCode(t.site),'in':t['in']||'',out:t.out||'',brk:0,h:0,status:'Voided',src:'Office entry (voided)',edits:t.voidReason?'Reason: '+t.voidReason:'',removed:true});});
  if(codes)(DB.pastHours||[]).forEach(function(p){if(codes.indexOf(p.site)<0)return;if(from&&p.date<from||to&&p.date>to)return;
    out.push({date:p.date,who:(p.people||0)+' people (past timesheet)',site:p.site,'in':'','out':'',brk:0,h:p.hours==null?0:+p.hours,status:'Past timesheet',src:'Imported',edits:'',removed:false});});
  return out.sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a['in']<b['in']?1:-1);});}
function monday(d){var x=new Date(d+'T12:00:00');var k=(x.getDay()+6)%7;x.setDate(x.getDate()-k);return x.toISOString().slice(0,10);}
function hoursHtml(u){var s=st(),R=hourRows(u,s.from,s.to),wk=monday(today()),tot=0,week=0,byW={};
  R.forEach(function(r){tot+=r.h;if(r.date>=wk)week+=r.h;var m=monday(r.date);byW[m]=(byW[m]||0)+r.h;});
  var x='<form data-form="ppdates" class="row pp-dates"><label class="small">From <input type="date" name="from" value="'+E(s.from||'')+'"></label><label class="small">To <input type="date" name="to" value="'+E(s.to||'')+'"></label><button class="small">Show</button>'+(s.from||s.to?'<button class="small sec" type="button" data-act="pptab" data-tab="hours" onclick="PAGE_STATE.pp.from=PAGE_STATE.pp.to=\'\'">All dates</button>':'')+'<button class="small sec" type="button" data-act="ppcsv">⬇ CSV</button></form>';
  x+='<div class="pp-tot"><div><b>'+week.toFixed(2)+' h</b><small>this week (from '+E(wk)+')</small></div><div><b>'+tot.toFixed(2)+' h</b><small>'+(s.from||s.to?'in the dates shown':'overall')+'</small></div><div><b>'+R.filter(function(r){return !r.removed;}).length+'</b><small>shifts</small></div></div>';
  var wks=Object.keys(byW).sort().reverse();if(wks.length)x+='<details class="pp-weeks"><summary>Totals by week ('+wks.length+')</summary><table><tr><th>Week of</th><th>Hours</th></tr>'+wks.map(function(w){return '<tr><td>'+E(w)+'</td><td>'+byW[w].toFixed(2)+'</td></tr>';}).join('')+'</table></details>';
  if(!R.length)return x+'<p class="muted">No hours'+(s.from||s.to?' in these dates':'')+'.</p>';
  return x+'<div class="tw"><table class="pp-hours"><tr><th>Date</th>'+(u.type==='firm'?'<th>Worker</th>':'')+'<th>Farm code</th><th>In</th><th>Out</th><th>Break</th><th>Hours</th><th>Status</th><th>Edits</th></tr>'+
    R.map(function(r){return '<tr'+(r.removed?' class="pp-void"':'')+'><td>'+E(r.date)+'</td>'+(u.type==='firm'?'<td>'+E(r.who)+'</td>':'')+'<td><b>'+E(r.site)+'</b></td><td>'+E(r['in'])+'</td><td>'+E(r.out)+'</td><td>'+(r.brk?r.brk.toFixed(2):'')+'</td><td><b>'+r.h.toFixed(2)+'</b></td><td>'+E(r.status)+'<div class="small muted">'+E(r.src)+'</div></td><td class="small">'+E(r.edits)+'</td></tr>';}).join('')+'</table></div>'+
    (u.type==='firm'?'':'<p class="small muted">Office-imported past timesheets are kept per farm (no names), so they show on the farm\'s page, not here.</p>');}

/* ---------- details ---------- */
function captured(id){var h='';var keepAudit=window.audit;try{window.audit=function(){};showPerson(id);var m=document.querySelector('#modal .modal');if(m){var c=m.cloneNode(true);var x=c.querySelector('button.x');if(x)x.remove();h=c.innerHTML;}}
  catch(e){h='<p class="muted">Some details could not be shown.</p>';try{logError(e);}catch(x){}}finally{window.audit=keepAudit;closeModal();}return h;}
function listFor(key,u,label,fmt){var L=(DB[key]||[]).filter(function(r){return r&&(r.userId===u.id||r.user===u.id||r.firmId===u.id);});
  return '<div><b>'+E(label)+'</b> <span class="muted small">('+L.length+')</span>'+(L.length?'<ul class="small">'+L.slice(-8).reverse().map(function(r){return '<li>'+fmt(r)+'</li>';}).join('')+'</ul>':'')+'</div>';}
function stamp(s){return s?(typeof fmtStamp==='function'?fmtStamp(s):E(s)):'–';}
function detailsHtml(u){var S=statusTxt(u),x='<div class="card pp-facts"><div class="kv">'+
  '<div>Kind</div><div>'+E(KIND[u.type]||u.type)+'</div><div>Status</div><div><span class="pill '+S[1]+'">'+S[0]+'</span>'+(u.approved?' <span class="small muted">compliance approved</span>':'')+'</div>'+
  '<div>Login</div><div>'+E(u.username||'–')+' · '+E(u.email||'–')+' · '+E(u.phone||'–')+'</div>'+
  '<div>Created / last login</div><div>'+stamp(u.createdAt)+' / '+(u.lastLogin?stamp(u.lastLogin):'never')+'</div>';
  if(u.type==='worker'){var sb=subOf(u);x+='<div>Subcontractor</div><div>'+(sb?'<a href="#" data-act="person" data-id="'+E(sb.id)+'">'+E(sb.name)+'</a>':'–')+'</div>';}
  if(u.type==='sub'){var W=(DB.users||[]).filter(function(w){return w.subId===u.id;});x+='<div>Join code</div><div><b>'+E(u.joinCode||'–')+'</b></div><div>Sub workers ('+W.length+')</div><div>'+(W.length?W.map(function(w){var s=statusTxt(w);return '<a href="#" data-act="person" data-id="'+E(w.id)+'">'+E(w.name)+'</a> <span class="pill '+s[1]+'">'+s[0]+'</span>';}).join('<br>'):'none')+'</div>';}
  if(u.type==='firm'){var C=firmCodesOf(u);x+='<div>Farm code(s)</div><div><b>'+E(C.join(', ')||'–')+'</b></div>';if(u.loginOf){var k=user(u.loginOf);x+='<div>Login of</div><div>'+(k?'<a href="#" data-act="person" data-id="'+E(k.id)+'">'+E(k.name)+'</a>':E(u.loginOf))+'</div>';}}
  x+='</div></div>';
  if(u.type!=='firm')x+='<div class="card pp-lists">'+
    listFor('docs',u,'Documents',function(r){return E(r.kind||r.type||r.name||'Document')+' · '+E(r.status||'')+(r.expiry?' · expires '+E(r.expiry):'');})+
    listFor('consents',u,'Consents',function(r){return E(r.kind||r.type||'Consent')+' · '+stamp(r.at||r.date);})+
    listFor('acceptances',u,'Terms accepted',function(r){return E(r.doc||r.terms||r.kind||'Terms')+' '+E(r.version||'')+' · '+stamp(r.at);})+
    listFor('trainConfirms',u,'Training confirmations',function(r){return E(r.topic||r.kind||'Training')+' · '+stamp(r.at||r.date);})+
    listFor('quizAttempts',u,'Quiz attempts',function(r){return E(r.bank||'Quiz')+' · '+E(r.score!=null?r.score:'')+(r.passed?' ✓ passed':'')+' · '+stamp(r.at);})+
    '<div><b>Orientations</b> <span class="muted small">('+((u.orientations||[]).length)+')</span>'+((u.orientations||[]).length?'<ul class="small">'+u.orientations.map(function(o){return '<li>'+E(o.site||o.code||'')+' '+E(o.date||o.at||'')+'</li>';}).join('')+'</ul>':'')+'</div></div>';
  if(u.type==='firm'){if(owner()&&!helper()){var I=(DB.clientInvoices||[]).filter(function(i){return i.firmId===u.id;});x+='<div class="card"><h3>Invoices ('+I.length+') <span class="small muted">owner only</span></h3>'+(I.length?'<ul class="small">'+I.map(function(i){return '<li>'+E(i.number||'Invoice')+' · '+E(i.issued||'')+' · '+E(i.status||'')+(i.total!=null?' · '+money(i.total):'')+'</li>';}).join('')+'</ul>':'<p class="muted">None.</p>')+'</div>';}
    else x+='<div class="card iv-calm"><p><b>Farm invoices are visible to the owner only.</b></p></div>';}
  return x+'<h3>Full record</h3><div class="card pp-record">'+captured(u.id)+'</div>';}

/* ---------- read-only "see their page" ---------- */
var NOOPS=['save','audit','logLogin','track','notify','touch','runAlerts','toast'];
function viewAs(u,page){var keep={ME:ME,DB:DB},fns={},html='',nav=[],gated='';
  NOOPS.forEach(function(n){if(typeof window[n]==='function'){fns[n]=window[n];window[n]=function(){return true;};}});
  var keepTimer=window.setTimeout,keepInt=window.setInterval;
  try{window.setTimeout=function(){return 0;};window.setInterval=function(){return 0;};
    DB=JSON.parse(JSON.stringify(keep.DB));ME=user(u.id);if(!ME)throw new Error('Not found');
    nav=(NAV[ME.type]||[]).slice();var h='#/'+(page||'home');var g=typeof gateRoute==='function'?gateRoute(h):h;if(g!==h){gated=g;h=g;}
    var v=VIEWS[ME.type+':'+h.slice(2)]||VIEWS[h.slice(2)]||VIEWS[ME.type+':home'];html=v(h);}
  catch(e){html='<div class="alert warn">This screen could not be drawn in the read-only view.</div>';try{console.warn('[viewas]',e);}catch(x){}}
  finally{window.setTimeout=keepTimer;window.setInterval=keepInt;ME=keep.ME;DB=keep.DB;Object.keys(fns).forEach(function(n){window[n]=fns[n];});}
  html=String(html).replace(/\s(id|for)="/g,' data-pp$1="').replace(/\sdata-(form|act|autofocus|calc)\b/g,' data-ppx-$1').replace(/<script[\s\S]*?<\/script>/gi,'');
  return {html:scrub(html),nav:nav,gated:gated};}
function viewHtml(u){var s=st(),pg=s.page||'home',r=viewAs(u,pg);
  var tabs=r.nav.map(function(n){var p=n[0].slice(2);return '<button class="small '+(p===pg?'':'sec')+'" data-act="pptab" data-tab="view" data-page="'+E(p)+'">'+E(n[1])+'</button>';}).join(' ');
  return '<div class="pp-banner" role="status">👁 Viewing as <b>'+E(u.name)+'</b> – read only <button class="small" data-act="pptab" data-tab="details">Back</button></div>'+
    '<div class="pp-tabs row">'+tabs+'</div>'+(r.gated?'<div class="alert info small">When they sign in they are sent to <b>'+E(r.gated)+'</b> first.</div>':'')+
    '<div class="pp-view" inert aria-disabled="true">'+r.html+'</div>';}

/* ---------- page ---------- */
function page(){var s=st(),u=s&&user(s.id);if(!u){PAGE_STATE.pp=null;return null;}var tab=s.tab||'details';var S=statusTxt(u);
  var name=u.type==='firm'&&helper()?'Farm '+(firmCodesOf(u)[0]||'?'):u.name;
  var x='<div class="pp-head"><button class="small sec" data-act="ppback">← Back</button><h1>'+E(name)+'</h1><span class="pill '+S[1]+'">'+S[0]+'</span> <span class="small muted">'+E(KIND[u.type]||u.type)+'</span></div>';
  x+='<div class="pp-tabs row"><button class="small '+(tab==='details'?'':'sec')+'" data-act="pptab" data-tab="details">Details</button>'+(farmHoursOk(u)?'<button class="small '+(tab==='hours'?'':'sec')+'" data-act="pptab" data-tab="hours">Hours (all)</button>':'')+
    (canViewAs(u)?'<button class="small '+(tab==='view'?'':'sec')+'" data-act="pptab" data-tab="view">👁 See their page</button>':(u.type==='firm'?'<span class="small muted">Farm hours and the farm\'s own view are for the owner only.</span>':''))+'</div>';
  if(tab==='view'&&canViewAs(u))x+=viewHtml(u);else if(tab==='hours'&&farmHoursOk(u))x+=hoursHtml(u);else x+=detailsHtml(u);
  return scrub(x);}
var ov=VIEWS['admin:people'];VIEWS['admin:people']=function(){if(st()){var p=page();if(p!=null)return p;}return ov.apply(this,arguments);};
/* leaving People through the menu closes the person page */
window.addEventListener('hashchange',function(){if((location.hash||'').split('?')[0]!=='#/people')PAGE_STATE.pp=null;});
/* belt and braces: nothing inside the read-only view reacts */
['click','submit','change','input','keydown'].forEach(function(ev){document.addEventListener(ev,function(e){if(e.target&&e.target.closest&&e.target.closest('.pp-view')){e.preventDefault();e.stopImmediatePropagation();}},true);});
})();
