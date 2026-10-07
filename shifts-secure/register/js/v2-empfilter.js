/* v2-empfilter.js – UnScramble empfilter1 (Oct 6 2026). Employee + subcontractor-worker screens stay short when there are many sites/shifts.
   Loaded right after v2-clock.js (so v2-crew / v2-docbypass / v2-lateentry wrap these versions as before).
   1. My shifts: Today + Upcoming by default; past shifts behind "Show past shifts" (10 at a time); filter by week and by site code.
   2. Clock-in site picker: "Your sites" (worked in the last 14 days or a shift today/upcoming), search all sites by code,
      everything else behind "Show all sites (N)". Time picker above is unchanged.
   3. Worker "Crew shifts you can sign up for": same filter, first 5 then "Show more".
   Employees only ever see site codes + a generic label ("Farm"/"Worksite") – never the client's name. Office screens unchanged. */
'use strict';
var EF_RECENT_DAYS=14,EF_PAGE=10,EF_OPEN_PAGE=5,EF_FIND_MAX=24,EF_COLLAPSE_OVER=12;
/* partial re-renders skip layout(), so run the same real-name scrub v2-clientlink applies to every page */
function efScrub(h){return typeof clScrub==='function'?clScrub(h):h;}
function efNorm(s){return String(s==null?'':s).toUpperCase().replace(/[^A-Z0-9]/g,'');}
/* generic label under a site code; falls back to Farm/Worksite if a site name ever repeats the client's own name */
function efSiteLabel(s){if(!s)return '';var n=String(s.name||'').trim();if(!n)return '';var f=s.firmId&&typeof user==='function'?user(s.firmId):null;
  var gen=(f&&f.firm&&f.firm.clientType&&!/^farm$/i.test(f.firm.clientType))?'Worksite':'Farm';
  if(f){var nl=n.toLowerCase(),names=[f.name,f.firm&&f.firm.legalName,f.firm&&f.firm.tradeName,f.firm&&f.firm.contact].filter(function(x){return x&&String(x).trim().length>2;}).map(function(x){return String(x).trim().toLowerCase();});
    if(names.some(function(x){return nl.indexOf(x)>=0||(x.indexOf(nl)>=0&&!/^(farm|worksite|work site|site)$/.test(nl));}))return gen;}
  return n;}
siteTile=function(s,note){return '<button type="button" class="site-tile" data-act="picksite" data-code="'+esc(s.code)+'">'+esc(s.code)+'<small class="tile-co">'+esc(note||efSiteLabel(s))+'</small></button>';};

/* ---------- clock-in site picker ---------- */
/* sites for "Your sites": shift today first, then worked in the last 14 days (newest first), then upcoming shifts; max 6 */
function efRecentSites(u,sites){var T=today(),have={},out=[],ok={};sites.forEach(function(s){ok[s.code]=s;});
  function add(c,note){if(c&&ok[c]&&!have[c]&&out.length<6){have[c]=1;out.push({s:ok[c],note:note});}}
  var sh=DB.shifts.filter(function(s){return !s.test&&s.date>=T&&(s.booked||[]).indexOf(u.id)>=0;}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(a.start<b.start?-1:1);});
  sh.filter(function(s){return s.date===T;}).forEach(function(s){add(s.site,'Shift today '+(s.start||''));});
  var lo=addDays(T,-EF_RECENT_DAYS);DB.time.filter(function(t){return t.userId===u.id&&t.site&&!t.test&&t.date>=lo&&t.date<=T;}).sort(function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.in<b.in?1:-1);}).forEach(function(t){add(t.site);});
  sh.filter(function(s){return s.date>T;}).forEach(function(s){add(s.site,'Shift '+shortDay(s.date).replace(/^\w+ /,''));});
  return out;}
function efPicker(u){var sites=clockSites().slice().sort(function(a,b){return a.code<b.code?-1:a.code>b.code?1:0;}),rec=efRecentSites(u,sites),coll=sites.length>EF_COLLAPSE_OVER;
  return '<div class="label">Which site are you at? <span class="req-star">*</span></div>'+
  (rec.length?'<div class="sub" id="efRecentHd">Your sites <span class="ef-why">(last '+EF_RECENT_DAYS+' days &amp; your shifts)</span></div><div class="tiles recent" id="efRecent">'+rec.map(function(r){return siteTile(r.s,r.note);}).join('')+'</div>':'')+
  '<input class="site-search" id="efSiteFind" type="text" enterkeyhint="search" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Search all sites by code" placeholder="'+(rec.length?'Other site? Type its code (e.g. HTP)':'Type the site code (e.g. HTP250)')+'">'+
  '<div class="tiles all ef-find" id="efFindRes" hidden aria-live="polite"></div><div class="muted small" id="efFindMsg" hidden></div>'+
  (coll?'<button type="button" class="ef-more" id="efAllBtn" data-act="efallsites" aria-expanded="false" aria-controls="efAll">Show all sites ('+sites.length+')</button>':'')+
  '<div class="tiles all" id="efAll"'+(coll?' hidden':'')+'>'+sites.map(function(s){return siteTile(s);}).join('')+'</div>'+
  '<div class="muted small">Site not listed? Ask your driver or contact the office.</div>';}
ACT.efallsites=function(el){var a=document.getElementById('efAll');if(!a)return;var show=a.hidden;a.hidden=!show;el.setAttribute('aria-expanded',String(show));el.textContent=(show?'Hide all sites':'Show all sites ('+a.querySelectorAll('.site-tile').length+')');efMarkSel();};
function efMarkSel(){[].forEach.call(document.querySelectorAll('.site-tile'),function(x){x.classList.toggle('sel',x.dataset.code===PAGE_STATE.site);});}
function efFind(v){var r=document.getElementById('efFindRes'),m=document.getElementById('efFindMsg'),a=document.getElementById('efAll'),b=document.getElementById('efAllBtn');if(!r)return;v=efNorm(v);
  if(!v){r.hidden=true;r.innerHTML='';m.hidden=true;if(b){b.hidden=false;a.hidden=b.getAttribute('aria-expanded')!=='true';}else a.hidden=false;return;}
  var sites=clockSites().filter(function(s){return efNorm(s.code).indexOf(v)>=0;}).sort(function(x,y){var px=efNorm(x.code).indexOf(v)===0?0:1,py=efNorm(y.code).indexOf(v)===0?0:1;return px-py||(x.code<y.code?-1:1);});
  a.hidden=true;if(b)b.hidden=true;r.hidden=!sites.length;r.innerHTML=efScrub(sites.slice(0,EF_FIND_MAX).map(function(s){return siteTile(s);}).join(''));
  m.hidden=false;m.textContent=sites.length?(sites.length>EF_FIND_MAX?sites.length+' sites match – showing '+EF_FIND_MAX+'. Keep typing to narrow it down.':sites.length+(sites.length===1?' site matches.':' sites match.')):'No site code contains “'+v+'”. Check the code with your driver or the office.';
  if(sites.length===1){PAGE_STATE.site=sites[0].code;clockInLabel();}efMarkSel();}
document.addEventListener('input',function(e){if(e.target&&e.target.id==='efSiteFind')efFind(e.target.value);});
(function(){var base=clockView;clockView=function(){var h=base(),a=h.indexOf('<div class="label">Which site are you at?'),b=h.indexOf('<div class="label">Location check</div>');
  if(a<0||b<a||!ME)return h;return h.slice(0,a)+efPicker(ME)+h.slice(b);};})();

/* ---------- My shifts ---------- */
function efState(){return PAGE_STATE.ef||(PAGE_STATE.ef={q:'',wk:'',past:false,n:EF_PAGE,openN:EF_OPEN_PAGE});}
function efWeekLabel(ws){var T=today(),cur=weekStart(T),we=addDays(ws,6),fm=function(d){return shortDay(d).replace(/^\w+ /,'');};
  var rng=fm(ws)+' – '+(ws.slice(5,7)===we.slice(5,7)?String(+we.slice(8)):fm(we));
  return ws===cur?'This week ('+rng+')':ws===addDays(cur,-7)?'Last week ('+rng+')':ws===addDays(cur,7)?'Next week ('+rng+')':'Week of '+rng;}
function efItems(u){var T=today(),ent=DB.time.filter(function(t){return t.userId===u.id&&!t.test;}),done={};ent.forEach(function(t){if(t.shiftId)done[t.shiftId]=1;});
  var kind=u.type==='worker'?'crew':'employee';
  var asg=DB.shifts.filter(function(s){return s.kind===kind&&!s.test&&s.date>=T&&(s.booked||[]).indexOf(u.id)>=0&&!done[s.id];});
  var it=ent.map(function(t){var sh=t.shiftId?DB.shifts.filter(function(s){return s.id===t.shiftId;})[0]:null;return {k:'t',date:t.date,site:t.site||(sh&&sh.site)||'',start:t['in']||'',t:t,cur:!t.out&&t.clock};})
    .concat(asg.map(function(s){return {k:'a',date:s.date,site:s.site||'',start:s.start||'',s:s};}));
  return it;}
function efMatch(i,st){if(st.q&&efNorm(i.site).indexOf(efNorm(st.q))<0)return false;if(st.wk&&weekStart(i.date)!==st.wk)return false;return true;}
function efHours(t){if(!t.out)return 0;var w=hrs(t['in'],t.out);return w-unpaidBreak(w,t);}
function efRow(i){var d=shortDay(i.date).split(' '),dd='<div class="ef-d"><b>'+esc(d[0])+'</b><span>'+esc(d[1]+' '+d[2])+'</span></div>';
  if(i.k==='a'){var s=i.s;return '<div class="ef-row ef-asg" data-date="'+esc(i.date)+'" data-site="'+esc(i.site)+'">'+dd+'<div class="ef-m"><div class="ef-l1"><b>'+esc(i.site)+'</b> · '+esc(s.start)+' – '+esc(s.end)+plus1H(s.start,s.end)+'</div><div class="ef-l2">'+esc(s.title||'')+(s.kind==='crew'&&typeof roleLabel==='function'?' · '+esc(roleLabel(s)):'')+'</div></div><div class="ef-h"><span class="pill s-mut">'+(i.date===today()?'Today':'Assigned')+'</span></div></div>';}
  var t=i.t,w=t.out?hrs(t['in'],t.out):0,br=unpaidBreak(w,t),c=typeof latestChange==='function'?latestChange(t.key0||('t:'+t.id)):null;
  return '<div class="ef-row'+(t.manual?' mt-row':'')+'" data-date="'+esc(i.date)+'" data-site="'+esc(i.site)+'">'+dd+'<div class="ef-m"><div class="ef-l1"><b>'+esc(i.site)+'</b> · '+esc(t['in'])+' – '+(t.out?esc(t.out)+plus1H(t['in'],t.out):'<span class="pill s-ok">on shift</span>')+(t.manual?' <span class="pill s-manual">Manual</span>':'')+'</div>'+
    '<div class="ef-l2">'+(t.out?'Worked '+fmtDur(w)+' · '+(t.breakMissed?'<span class="pill s-warn">break missed – paid</span>':br?'break '+fmtDur(br):'no break'):'Started '+esc(t['in']))+'</div>'+
    (t.orig?'<div class="ef-l2">changed from '+esc(t.orig['in'])+'–'+esc(t.orig.out)+' (farm change approved by office)</div>':'')+(c&&c.status==='Pending'?'<div class="ef-l2"><span class="pill s-pend">Farm change pending</span></div>':'')+'</div>'+
    '<div class="ef-h">'+(t.out?'<b>'+(w-br).toFixed(2)+'</b><small>hrs</small>':'–')+'</div></div>';}
function efSum(list){var n=0,h=0;list.forEach(function(i){if(i.k==='t'){n++;h+=efHours(i.t);}});return {n:n,h:h};}
function efBody(u){var st=efState(),T=today(),all=efItems(u),f=!!(st.q||st.wk),L=all.filter(function(i){return efMatch(i,st);});
  var byDesc=function(a,b){return a.date<b.date?1:a.date>b.date?-1:(a.start<b.start?1:-1);},byAsc=function(a,b){return -byDesc(a,b);};
  var now=L.filter(function(i){return i.date===T||(i.k==='t'&&i.cur);}).sort(byAsc),up=L.filter(function(i){return i.date>T;}).sort(byAsc),past=L.filter(function(i){return i.date<T&&!(i.k==='t'&&i.cur);}).sort(byDesc);
  var x='';
  if(!all.length)return '<p class="muted" id="efnone">No shifts yet. When you clock in, your shifts show up here.</p>'+efOpenHtml(u,st,f);
  if(f&&!L.length)return '<p class="muted" id="efnomatch">No shifts match'+(st.q?' site “'+esc(efNorm(st.q))+'”':'')+(st.wk?(st.q?' in ':' ')+esc(efWeekLabel(st.wk).replace(/^Week of /,'the week of ')):'')+'. <button type="button" class="linklike" data-act="efclear">Clear filter</button></p>'+efOpenHtml(u,st,f);
  var ts=efSum(now);
  x+='<section class="ef-sec" id="efToday"><h2 class="ef-h2">Today <span class="ef-cnt">'+esc(shortDay(T))+(ts.h?' · '+ts.h.toFixed(2)+' hrs':'')+'</span></h2>'+(now.length?'<div class="ef-list">'+now.map(efRow).join('')+'</div>':'<p class="muted small ef-empty">Nothing today'+(f?' for this filter':'')+'.</p>')+'</section>';
  x+='<section class="ef-sec" id="efUp"><h2 class="ef-h2">Upcoming <span class="ef-cnt">'+(up.length||'')+'</span></h2>'+(up.length?'<div class="ef-list">'+up.map(efRow).join('')+'</div>':'<p class="muted small ef-empty">'+(u.type==='employee'?'No assigned shifts coming up. The office assigns company employees to shifts.':'No crew assignments coming up.')+'</p>')+'</section>';
  var open=st.past||f,ps=efSum(past);
  x+='<section class="ef-sec" id="efPast">';
  if(!past.length)x+=(f?'':'<p class="muted small ef-empty">No past shifts yet.</p>');
  else if(!open)x+='<button type="button" class="ef-more" id="efPastBtn" data-act="efpast" aria-expanded="false">Show past shifts ('+past.length+')</button>';
  else{var shown=past.slice(0,st.n);
    x+='<h2 class="ef-h2">Past shifts <span class="ef-cnt">'+ps.n+' shift'+(ps.n===1?'':'s')+' · '+ps.h.toFixed(2)+' hrs</span>'+(f?'':' <button type="button" class="linklike ef-hide" data-act="efpast" aria-expanded="true">Hide</button>')+'</h2><div class="ef-list" id="efPastList">'+shown.map(efRow).join('')+'</div>'+
      '<div class="ef-pager small muted" id="efPager">Showing '+shown.length+' of '+past.length+'</div>'+(past.length>shown.length?'<button type="button" class="ef-more" id="efPastMore" data-act="efmore">Show '+Math.min(EF_PAGE,past.length-shown.length)+' more</button>':'');}
  x+='</section>';
  return x+efOpenHtml(u,st,f);}
function efOpenHtml(u,st,f){var T=today(),x='';
  if(u.type==='worker'){var op=DB.shifts.filter(function(s){return s.kind==='crew'&&!s.test&&s.date>=T&&(s.booked||[]).indexOf(u.id)<0&&efMatch({site:s.site||'',date:s.date},st);}).sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:(a.start<b.start?-1:1);}),os=op.slice(0,st.openN);
    x+='<section class="ef-sec" id="efOpen"><h2 class="ef-h2">Crew shifts you can sign up for <span class="ef-cnt">'+(op.length||'')+'</span></h2><p class="small muted">Your employer ('+esc(employerName(u))+') can also place you on crews.</p>'+(os.map(function(s){return shiftCard(s,u,'signup');}).join('')||'<p class="muted small">No open crew shifts'+(f?' for this filter':' right now')+'.</p>')+
      (op.length>os.length?'<button type="button" class="ef-more" id="efOpenMore" data-act="efopenmore">Show more ('+(op.length-os.length)+' left)</button>':'')+'</section>';}
  return x;}
function efWeekOpts(u){var st=efState(),set={},T=today(),cur=weekStart(T);[cur,addDays(cur,-7)].forEach(function(w){set[w]=1;});efItems(u).forEach(function(i){set[weekStart(i.date)]=1;});if(st.wk)set[st.wk]=1;
  return '<option value="">All dates</option>'+Object.keys(set).sort().reverse().map(function(w){return '<option value="'+w+'"'+(st.wk===w?' selected':'')+'>'+esc(efWeekLabel(w))+'</option>';}).join('');}
myShiftsView=function(){var u=ME,st=efState(),T=today(),cw=weekStart(T),wk=efSum(efItems(u).filter(function(i){return i.k==='t'&&weekStart(i.date)===cw;}));
  return '<div class="ef-top"><h1 class="h1">My shifts</h1><span class="ef-week small">This week: <b>'+wk.h.toFixed(2)+' hrs</b></span></div>'+
  '<div class="ef-bar" role="search"><input type="text" id="efQ" class="ef-q" value="'+esc(st.q)+'" placeholder="Site code…" aria-label="Filter by site code" autocapitalize="characters" autocomplete="off" spellcheck="false" enterkeyhint="search"><select id="efWk" class="ef-wk" aria-label="Filter by week">'+efWeekOpts(u)+'</select></div>'+
  '<div id="efBody">'+efBody(u)+'</div>';};
function efRefresh(){var b=document.getElementById('efBody');if(b&&ME)b.innerHTML=efScrub(efBody(ME));}
ACT.efpast=function(){var st=efState();st.past=!st.past;st.n=EF_PAGE;efRefresh();var p=document.getElementById(st.past?'efPastList':'efPastBtn');if(p&&p.scrollIntoView&&st.past)p.scrollIntoView({block:'nearest'});};
ACT.efmore=function(){efState().n+=EF_PAGE;efRefresh();};
ACT.efopenmore=function(){efState().openN+=10;efRefresh();};
ACT.efclear=function(){var st=efState();st.q='';st.wk='';var q=document.getElementById('efQ'),w=document.getElementById('efWk');if(q)q.value='';if(w)w.value='';efRefresh();};
document.addEventListener('input',function(e){if(e.target&&e.target.id==='efQ'){var st=efState();st.q=e.target.value;st.n=EF_PAGE;st.openN=EF_OPEN_PAGE;efRefresh();}});
document.addEventListener('change',function(e){if(e.target&&e.target.id==='efWk'){var st=efState();st.wk=e.target.value;st.n=EF_PAGE;st.openN=EF_OPEN_PAGE;efRefresh();}});
VIEWS['worker:shifts']=VIEWS['employee:shifts']=function(){return myShiftsView();};
/* employee / worker sessions: "CODE – label" everywhere (e.g. crew shift cards) uses the generic label, never a client name; office unchanged */
(function(){var on=siteName;siteName=function(code){if(!ME||(ME.type!=='employee'&&ME.type!=='worker'))return on(code);var s=(DB.sites||[]).filter(function(x){return x.code===code;})[0];if(!s)return code;var l=efSiteLabel(s);return l?s.code+' – '+l:s.code;};})();
/* employee / worker sessions: blocker messages such as "Shifts at <client name> are blocked: …" (v2-farmrates) name the site code instead.
   Wrapped lazily (first employee screen / DOMContentLoaded) so it sits outside every later blockers() wrapper. Office unchanged. */
function efWrapBlockers(){if(efWrapBlockers.done||typeof blockers!=='function')return;efWrapBlockers.done=true;var ob=blockers;
  blockers=function(u,date,shift){var b=ob(u,date,shift);if(!ME||(ME.type!=='employee'&&ME.type!=='worker')||!b||!b.length)return b;
    var names=(DB.users||[]).filter(function(f){return f.type==='firm'&&f.name&&String(f.name).trim().length>2;}).map(function(f){return String(f.name);}).sort(function(a,c){return c.length-a.length;});
    return b.map(function(x){var m=String(x&&x.m||''),hit=false;names.forEach(function(n){if(m.indexOf(n)>=0){m=m.split(n).join(shift&&shift.site?shift.site:'this farm');hit=true;}});return hit?Object.assign({},x,{m:m}):x;});};}
document.addEventListener('DOMContentLoaded',efWrapBlockers);
(function(){var mv=myShiftsView,cv=clockView;myShiftsView=function(){efWrapBlockers();return mv();};clockView=function(){efWrapBlockers();return cv();};})();
