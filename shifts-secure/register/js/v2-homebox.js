/* v2-homebox.js – homebox1 (Oct 21 2026, owner 3:12 AM). TEST COPY – not live. Live switch: store-config homeBoxes:true (front end only, no SQL).
   Farm Home shows only: the Crew coming card (now with people graphics: a person per worker – filled = confirmed by the office,
   outlined = pending – per-day crew bars for the next days, job icons, and a Today / Tomorrow highlight; tap to change stays),
   one big "Order crew" button, and a grid of boxes (icon, title, one live line) for everything that used to sit on Home.
   A box opens the existing page (Time sheets, Crew orders, Invoices, Team, Sites, Profile) or the Home section on its own
   (Period total, Hours by day, Past hours, Agreement) with a "Home" back button. Roles: a manager / supervisor gets no money
   boxes (Invoices, Agreement) unless the owner turned "Invoices & amounts" on for them (faminv1, then Invoices only);
   Team only for the owner, Sites only where the Sites page is allowed. */
(function(){'use strict';
if(typeof VIEWS==='undefined'||typeof afterRender!=='function')return;
if(window.REG_LIVE&&!(window.REG_STORE&&window.REG_STORE.homeBoxes))return;
var IC={clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',sheet:'<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 12h7M9 16h7"/>',
  bars:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  hist:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 8v4l3 2"/>',inv:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  agr:'<path d="M5 3h10l4 4v14H5z"/><path d="M8 17c1.5-2 2.5-2 3.5 0s2 2 3.5-1"/><path d="M8 9h7"/>',team:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.6a5 5 0 0 1 4.5 5.4"/>',
  pin:'<path d="M12 21s7-6.2 7-11.5a7 7 0 0 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',truck:'<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',chev:'<path d="m9 6 6 6-6 6"/>',back:'<path d="M15 6l-6 6 6 6"/>',plus:'<circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v9M7.5 12h9"/>',
  pick:'<path d="M5 9h14l-1.5 11h-11z"/><path d="M9 9a3 3 0 0 1 6 0"/>',box:'<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  tool:'<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',lead:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'};
function I(k,c){return '<svg class="hb-ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(IC[k]||'')+'</svg>';}
var PERSON='<svg class="hb-p" viewBox="0 0 16 22" aria-hidden="true" focusable="false"><circle cx="8" cy="5" r="4"/><path d="M1 21v-3.5A5.5 5.5 0 0 1 6.5 12h3A5.5 5.5 0 0 1 15 17.5V21z"/></svg>';
function lim(){return typeof window.frLimited==='function'&&window.frLimited();}
function noMoney(){return typeof window.frNoMoney==='function'?window.frNoMoney():lim();}
function firm(){var l=(typeof clLoginOf==='function')?clLoginOf(ME):ME;if(l&&l.loginOf){var c=typeof clResolve==='function'?clResolve(l.loginOf):user(l.loginOf);if(c)return c;}return ME;}
function canOrder(){if(typeof window.frCan==='function'&&!window.frCan('order'))return false;if(typeof orderBlock==='function'&&orderBlock(ME))return false;return true;}
function navHas(h){return (NAV.firm||[]).some(function(n){return n[0]===h;});}
function plural(n,a,b){return n+' '+(n===1?a:b);}
function isHome(){var h=(location.hash||'#/home').split('?')[0];return h==='#/home'||h==='#/'||h==='';}

/* ---------- live one-line summaries ---------- */
function sumPeriod(m){var st=[].filter.call(m.querySelectorAll('#fhstats .fh-stat'),function(s){return s.style.display!=='none';}),r=document.getElementById('fhrange');
  var S=[];try{S=typeof fhStatsFromTotals==='function'?fhStatsFromTotals(m):[];}catch(e){}if(noMoney())S=S.filter(function(x){return !/\$/.test(x[2])&&!/amount|bill(ed|ing)?\b(?! *hours)|\$/i.test(x[1]);});
  var a=S.slice(0,2).map(function(x){return x[2]+' '+String(x[1]).toLowerCase();});if(!a.length)a=st.slice(0,1).map(function(s){var v=s.querySelector('.fh-sv'),l=s.querySelector('.fh-sl');return (v?v.textContent.trim():'')+' '+(l?l.firstChild.textContent.trim().toLowerCase():'');});
  return (a.join(' · ')||'Totals for a week or month')+(r?' · '+r.textContent.trim():'');}
function sumTs(){try{var f=ME,t=today(),from=addDays(t,-13),R=(firmReport(f,from,t).shiftRows||[]),D={};R.forEach(function(r){D[r.date]=1;});
  var ok=(DB.farmTs||[]),w=Object.keys(D).filter(function(d){return !ok.some(function(x){return x.id==='day|'+f.id+'|'+d;});}).length;
  return w?plural(w,'day','days')+' to approve (2 weeks)':(Object.keys(D).length?'All approved – last 2 weeks':'No hours in the last 2 weeks');}catch(e){return 'Approve days, ask to change hours';}}
function sumByDay(m){var d=m.querySelector('#sect-hours');if(!d)return '';var n=d.querySelectorAll('tbody tr').length;return n?plural(n,'row','rows')+' · people and hours per day':'People and hours per day';}
function sumOrders(f){var O=(DB.crewOrders||[]).filter(function(o){return o.firmId===f.id&&o.kind!=='crewPlan'&&!o.deleted;}),T=today();
  var w=O.filter(function(o){return /await|pending|request/i.test(o.status||'')||(o.pending&&!o.pending.done);}).length,u=O.filter(function(o){var d=(o.cur&&o.cur.date)||o.date||'';return d>=T&&!/cancel/i.test(o.status||'');}).length;
  return w?plural(w,'order','orders')+' waiting for the office':(u?plural(u,'upcoming order','upcoming orders'):'Order, change or cancel');}
function sumInv(f){var L=(DB.clientInvoices||[]).filter(function(i){return i.firmId===f.id&&!i.deleted;}),o=L.filter(function(i){return !i.paidAt&&!i.paid;}).length;
  return L.length?(o?plural(o,'invoice','invoices')+' open':'All paid · '+plural(L.length,'invoice','invoices')):'No invoices yet';}
function sumAgr(f){var s=(DB.firmSigs||[]).filter(function(x){return x.firmId===f.id;}).sort(function(a,b){return String(b.at||'').localeCompare(String(a.at||''));})[0];
  return s?'Signed'+(s.version?' · v'+s.version:'')+(s.at?' · '+shortDay(String(s.at).slice(0,10)):''):'Agreement, rates and industry';}
function sumTeam(){var n=0;try{n=(DB.users||[]).filter(function(u){return u.type==='firm'&&u.loginOf===firm().id&&/^(manager|supervisor)$/.test(u.farmRole||'')&&u.active!==false;}).length;
  if(window.REG_LIVE&&PAGE_STATE.frTeam&&PAGE_STATE.frTeam.d)n=(PAGE_STATE.frTeam.d.people||[]).length;}catch(e){}return n?plural(n,'person','people')+' with their own login':'Add managers and supervisors';}
function sumSites(f){var n=(DB.farmPlaces||[]).filter(function(p){return p.clientId===f.id||!p.clientId;}).length;return n?plural(n,'saved site','saved sites')+' with maps':'Save fields and gates with a map';}

function boxes(m){var f=firm(),B=[],main=!lim();
  var add=function(k,ic,t,s,go,sel){if(sel&&!m.querySelector(sel))return;B.push({k:k,ic:ic,t:t,s:s,go:go,sel:sel});};
  add('ts','sheet','Time sheets',sumTs(),'#/timesheets');
  add('period','bars','Period total',sumPeriod(m),'','#fhperiod');
  add('byday','cal','Hours by day',sumByDay(m),'','#fhtimesheets');
  add('orders','truck','Crew orders',sumOrders(f),'#/orders');
  add('past','hist','Past hours','Pick dates, see people per day','','#sect-past');
  if(!noMoney()&&navHas('#/invoices'))add('inv','inv','Invoices',sumInv(f),'#/invoices');
  if(main)add('agr','agr','Agreement & rates',sumAgr(f),'','#sect-agr');
  if(navHas('#/team'))add('team','team','Team',sumTeam(),'#/team');
  if(navHas('#/places'))add('sites','pin','Sites',sumSites(f),'#/places');
  add('profile','user','Profile','Your details and password','#/profile');
  return B;}
function grid(B){return '<section class="hb-grid-wrap" id="hbgrid" aria-label="More"><div class="hb-grid">'+B.map(function(b,i){
  return '<button type="button" class="hb-box" data-act="hbopen" data-k="'+b.k+'"'+(b.go?' data-go="'+b.go+'"':'')+' style="--hb-d:'+(i*40)+'ms" id="hb-'+b.k+'"><span class="hb-bic">'+I(b.ic)+'</span><span class="hb-bt"><b>'+esc(b.t)+'</b><span class="hb-bs">'+esc(b.s)+'</span></span>'+I('chev','hb-chev')+'</button>';}).join('')+'</div></section>';}

/* ---------- Crew coming: people graphics ---------- */
function jobIc(t){t=String(t||'').toLowerCase();return /pick|harvest/.test(t)?'pick':/pack|grad|sort/.test(t)?'box':/driv|truck/.test(t)?'truck':/lead|super|foreman/.test(t)?'lead':/gen|lab|help/.test(t)?'user':'tool';}
function people(n,ok,cap){n=Math.max(0,+n||0);var c=Math.min(n,cap),h='';for(var i=0;i<c;i++)h+='<span class="hb-pw '+(ok?'ok':'pend')+'" style="--hb-i:'+i+'">'+PERSON+'</span>';
  return h+(n>c?'<span class="hb-more">+'+(n-c)+'</span>':'');}
function richComing(m){var c=m.querySelector('#fhcoming');if(!c||c.dataset.hb)return;c.dataset.hb='1';c.classList.add('hb-coming');
  var tm=c.querySelector('#fhtomorrow'),big=c.querySelector('.fh-big'),n=big?parseInt(big.dataset.count||big.textContent,10)||0:0,ok=tm&&tm.classList.contains('ok');
  if(tm&&n){var r=document.createElement('div');r.className='hb-ppl';r.id='hbppl';r.setAttribute('role','img');r.setAttribute('aria-label',n+(n===1?' person':' people')+' tomorrow, '+(ok?'confirmed by the office':'pending'));
    r.innerHTML='<div class="hb-pl">'+people(n,ok,window.innerWidth<520?12:24)+'</div>';var tx=tm.querySelector('.fh-tm');(tx||tm).appendChild(r);}
  if(tm){tm.classList.add('hb-hl');var tg=document.createElement('span');tg.className='hb-tag';tg.textContent='Tomorrow';tm.insertBefore(tg,tm.firstChild);}
  /* today, if there is a crew */
  try{var f=firm(),td=typeof fhDay==='function'?fhDay(f.id,today()):null;if(td&&+td.n){var t=document.createElement('div');t.className='hb-today '+(td.ok?'ok':'pend');t.id='hbtoday';
    t.innerHTML='<span class="hb-tag on">Today</span><b>'+esc(String(td.n))+'</b> '+(+td.n===1?'person':'people')+' <span class="hb-mini">'+people(td.n,td.ok,8)+'</span><span class="small muted">'+(td.ok?'Confirmed':'Pending')+'</span>';
    if(tm&&tm.parentNode)tm.parentNode.insertBefore(t,tm);else c.appendChild(t);}}catch(e){console.warn('homebox today',e);}
  /* job chips get an icon */
  [].forEach.call(c.querySelectorAll('.fh-job'),function(j){if(j.querySelector('.hb-ic'))return;j.insertAdjacentHTML('afterbegin',I(jobIc(j.textContent),'hb-jic'));});
  /* per-day crew bars in the strip */
  var D=[].slice.call(c.querySelectorAll('.fh-strip .fh-day')),N=D.map(function(b){var x=/·\s*(\d+)\s+(person|people)/.exec(b.dataset.info||'');return x?+x[1]:0;}),mx=Math.max.apply(null,N.concat([1]));
  D.forEach(function(b,i){if(b.querySelector('.hb-bar'))return;var s=document.createElement('span');s.className='hb-bar';s.setAttribute('aria-hidden','true');s.style.setProperty('--hb-h',Math.round(100*N[i]/mx)+'%');s.innerHTML='<i></i>';b.appendChild(s);});
  /* crew-day-tap: every upcoming day is a tap target (empty day: + → Order crew for that day; day with crew: its crew + Order more / Change crew) */
  var can=canOrder();D.forEach(function(b){var d=b.dataset.date;if(!d||d<today())return;var has=!!b.getAttribute('data-act');
    if(!has&&can){b.disabled=false;b.setAttribute('data-act','hbday');b.classList.add('hb-empty');b.setAttribute('aria-label','Order crew for '+shortDay(d));b.title='Order crew for '+shortDay(d);
      if(!b.querySelector('.hb-plus'))b.insertAdjacentHTML('beforeend','<span class="hb-plus" aria-hidden="true">+</span>');}
    else if(has&&can){b.setAttribute('data-act','hbday');b.dataset.hbinfo='1';}
    if(can||has)b.classList.add('hb-tap');});
  var leg=c.querySelector('.fh-legend');if(leg&&!leg.querySelector('.hb-key'))leg.insertAdjacentHTML('afterbegin','<span class="hb-key"><span class="hb-pw ok">'+PERSON+'</span> = 1 worker</span>');}

/* ---------- arrange ---------- */
function arrange(root){var m=root&&root.querySelector&&root.querySelector('main.fh-home');if(!m||!ME||ME.type!=='firm'||!isHome())return;if(m.dataset.hbdone)return;m.dataset.hbdone='1';m.classList.add('hb-home');
  var top=m.querySelector('.hometop'),coming=m.querySelector('#fhcoming'),order=m.querySelector('#ordercard');
  richComing(m);
  if(order&&coming&&coming.parentNode){coming.parentNode.insertBefore(order,coming.nextSibling);order.classList.add('hb-order');var a=order.querySelector('.fh-orderbtn');if(a&&!/not available/i.test(a.textContent)){var sp=a.querySelector('span');if(sp)sp.textContent='Order crew';a.classList.add('hb-orderbig');}}
  var B=boxes(m),key=PAGE_STATE.hb,cur=key?B.filter(function(b){return b.k===key&&b.sel;})[0]:null;if(key&&!cur)PAGE_STATE.hb=key=null;
  var keep=['#fhhero','#fhcoming','#ordercard','#farmblocked','#clientlinkbanner'];
  var parts=[].slice.call(m.children).concat(top?[].slice.call(top.children):[]).filter(function(e){return e!==top&&!/^(H1|SCRIPT)$/.test(e.nodeName);});
  var host=document.createElement('div');host.innerHTML=grid(B);var g=host.firstChild;
  if(cur){var sec=m.querySelector(cur.sel);parts.forEach(function(e){if(e!==sec&&!e.contains(sec))e.classList.add('hb-off');});
    if(top&&!top.contains(sec))top.classList.add('hb-off');
    var bar=document.createElement('div');bar.className='hb-back';bar.id='hbback';bar.innerHTML='<button type="button" class="small sec" data-act="hbhome">'+I('back')+'<span>Home</span></button><h1 class="hb-st">'+I(B.filter(function(b){return b.k===key;})[0].ic)+'<span>'+esc(cur.t)+'</span></h1>';
    m.insertBefore(bar,m.firstChild);sec.classList.add('hb-sec');if(sec.tagName==='DETAILS')sec.open=true;[].forEach.call(sec.querySelectorAll('details.sect'),function(d){d.open=true;});
    return;}
  parts.forEach(function(e){if(keep.some(function(s){return e.matches&&e.matches(s);}))return;e.classList.add('hb-off');});
  var anchor=order&&order.parentNode?order:coming;if(anchor&&anchor.parentNode){var tp=anchor.parentNode;if(tp===top)top.parentNode.insertBefore(g,top.nextSibling);else tp.insertBefore(g,anchor.nextSibling);}else m.appendChild(g);}
var oar=afterRender;afterRender=function(root){oar(root);try{arrange(root);}catch(e){console.warn('homebox',e);}};
ACT.hbopen=function(el){var go=el.dataset.go;if(go){PAGE_STATE.hb=null;location.hash=go;return;}PAGE_STATE.hb=el.dataset.k;render();try{window.scrollTo(0,0);}catch(e){}};
ACT.hbday=function(el){var d=el.dataset.date;if(!d||d<today()||!canOrder())return;
  if(!el.dataset.hbinfo){ACT.hborderday({dataset:{date:d}});return;}
  if(typeof ACT.fhdayinfo==='function')ACT.fhdayinfo(el);var p=document.getElementById('fhdayinfo');if(!p||p.hidden)return;
  var up=[];try{up=typeof fsUpcoming==='function'?fsUpcoming(ME):[];}catch(e){}
  p.insertAdjacentHTML('beforeend','<div class="hb-dayacts"><button type="button" class="small" data-act="hborderday" data-date="'+d+'">+ Order more for '+esc(shortDay(d))+'</button>'+(ACT.fscoming?'<button type="button" class="small sec" data-act="fscoming">Change crew</button>':'')+'</div>');};
ACT.hborderday=function(el){var d=el.dataset.date;if(!d||d<today()||!canOrder())return;PAGE_STATE.coForm=true;PAGE_STATE.hbDate=d;go('#/orders');
  var n=0,t=setInterval(function(){var f=document.querySelector('form[data-form=crewOrder]'),i=f&&f.querySelector('input[name=date]');if(i||++n>40){clearInterval(t);if(!i)return;
    i.value=d;i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));
    var i2=document.querySelector('form[data-form=crewOrder] input[name=date]')||i;if(i2.value!==d)i2.value=d;
    try{f.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){f.scrollIntoView();}try{i2.focus({preventScroll:true});}catch(e){}toast('Order crew for '+shortDay(d));}},100);};
ACT.hbhome=function(){PAGE_STATE.hb=null;render();try{window.scrollTo(0,0);}catch(e){}};
window.addEventListener('hashchange',function(){if(!isHome())PAGE_STATE.hb=null;});
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('a[href="#/home"]');if(a&&PAGE_STATE.hb&&isHome()){PAGE_STATE.hb=null;setTimeout(render,0);}},true);
})();
