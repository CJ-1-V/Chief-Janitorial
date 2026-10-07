/* v2-farmhome.js – UnScramble farmhome1 (Oct 6 2026). Loaded LAST (after v2-invtheme.js). TEST COPY until the owner OKs it.
   Farm / client login:
   - Top row of tabs (Home · Crew orders · Invoices · Profile) instead of the Menu dropdown, phone and desktop. Routes unchanged.
   - Home, top to bottom: Order a crew → Crew coming (tomorrow + next days, SET and CONFIRMED by the office) → period filter
     (this week / last week / pay period / this month / last month / custom) with the period total → the timesheets for that period
     (existing "Hours and billing by day" + "Shifts at your sites" tables, opened). Everything else stays in the sections below.
   Office: "Crew coming" page (#/crewcoming): number of people per farm per day, Pending / Confirmed, note to the farm,
   prefilled from crew orders and scheduled shifts.
   Storage (no schema change): one row per farm in the existing crew-orders list (live table reg_crew_orders) with kind:'crewPlan',
   status:'Plan', numbers in `cur.days`. RLS on reg_crew_orders already lets a farm read only its own client's rows (office reads all,
   employees none), and the existing reg_orders_guard trigger stops a farm from changing `cur` or `status` – only the office sets or
   confirms numbers. These rows are hidden from every crew-order list. */
'use strict';
var FH_DAYS=7,FH_KEEP_DAYS=62;
var FH_IC={home:'<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',orders:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  invoices:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M8 13h8"/><path d="M8 17h5"/>',profile:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  plus:'<path d="M12 5v14"/><path d="M5 12h14"/>',people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',sheet:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>'};
function fhIcon(k,c){return '<svg class="fh-svg'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(FH_IC[k]||'')+'</svg>';}
function fhReduced(){try{return window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){return false;}}

/* ---------- storage: crew plan rows (office-owned) ---------- */
function fhIsPlan(o){return !!(o&&o.kind==='crewPlan');}
function fhPlans(firmId){return (DB.crewOrders||[]).filter(function(o){return fhIsPlan(o)&&o.firmId===firmId;});}
/* the number for one farm + day (if two office users ever made a row at the same time, the newest entry wins) */
function fhDay(firmId,date){var best=null;fhPlans(firmId).forEach(function(p){var d=p.cur&&p.cur.days&&p.cur.days[date];if(d&&(!best||String(d.at||'')>String(best.at||'')))best=d;});return best;}
/* legacy-safe shape: an older cached copy of the app (or a rollback) lists this row like an order – these fields keep its
   crew-order screens from breaking (it lands under "Past and cancelled orders"); the farm cannot change cur (reg_orders_guard) */
var FH_LEGACY={date:'2000-01-01',start:'00:00',end:'00:00',site:'',workers:0,role:'',ppe:'',note:''};
function fhCur(days){return Object.assign({},FH_LEGACY,{days:days});}
function fhPlanFor(firm){var p=fhPlans(firm.id)[0];if(p)return p;var now=new Date().toISOString();
  p={id:uid('cp'),kind:'crewPlan',no:'',firmId:firm.id,firmName:firm.name,status:'Plan',seriesId:null,createdAt:now,createdBy:'UnScramble office',req:null,cur:fhCur({}),pending:null,decisions:[],history:[],shiftId:null};
  (DB.crewOrders=DB.crewOrders||[]).push(p);return p;}
function fhSetDay(firm,date,val,action){var p=fhPlanFor(firm),days=Object.assign({},(p.cur&&p.cur.days)||{}),lo=addDays(today(),-FH_KEEP_DAYS),old=days[date]||null;
  Object.keys(days).forEach(function(k){if(k<lo)delete days[k];});
  var jobs=val?fhCleanJobs(val.jobs):[],desc=function(x){return x?x.n+(x.jobs&&x.jobs.length?' ('+fhJobsText(firm,x.jobs)+')':'')+(x.ok?' confirmed':' pending'):'not set';};
  /* farmhome2: jobs = [{role,qty,label?}] (crew-order job keys); n = their sum. Rows without jobs (farmhome1 shape) still work. */
  if(val){var e={n:jobs.length?fhJobsSum(jobs):val.n,ok:!!val.ok,note:val.note||'',by:ME?ME.name:'office',at:new Date().toISOString()};if(jobs.length)e.jobs=jobs;days[date]=e;}else delete days[date];
  p.cur=fhCur(days);(p.history=p.history||[]).push({at:new Date().toISOString(),simDate:today(),who:(ME?ME.name:'office')+' (office)',action:action||'Crew coming set',detail:date+': '+desc(old)+' → '+desc(val?days[date]:null)});
  if(p.history.length>200)p.history=p.history.slice(-200);
  audit('Crew coming: '+(action||'set'),firm.name,date+' → '+(val?desc(days[date]):'cleared'));}
/* plan rows never appear as crew orders */
(function(){
  if(typeof ordersOf==='function'){var oo=ordersOf;ordersOf=function(f){return oo(f).filter(function(o){return !fhIsPlan(o);});};}
  if(typeof coFilterList==='function'){var oc=coFilterList;coFilterList=function(st){return oc(st).filter(function(o){return !fhIsPlan(o);});};}
  var hide=function(fn){return function(){var real=DB.crewOrders;if(!real||!real.some(fhIsPlan))return fn.apply(this,arguments);DB.crewOrders=real.filter(function(o){return !fhIsPlan(o);});try{return fn.apply(this,arguments);}finally{DB.crewOrders=real;}};};
  if(VIEWS['admin:creworders'])VIEWS['admin:creworders']=hide(VIEWS['admin:creworders']);
  if(typeof adminFlags==='function')adminFlags=hide(adminFlags);
})();

/* ---------- office suggestion from crew orders + scheduled shifts ---------- */
/* farmhome2: job list = the crew-order job list (orderRoleList; orderform1's most-ordered-first list when present, else this farm's
   most-ordered jobs first), then the rest of the complete rate-role list, "Bin piler" on its own after Forklift, then "Other job…" */
var FH_SHORT={labour:['General labourer','General labourers'],grader:['Grader','Graders'],packer:['Packer','Packers'],forklift:['Forklift operator','Forklift operators'],
  binpiler:['Bin piler','Bin pilers'],driver:['Truck driver','Truck drivers'],construction:['Construction labourer','Construction labourers'],baker:['Baker','Bakers'],
  painting:['Painter','Painters'],cleaner:['Cleaner','Cleaners']};
var FH_ABBR={labour:'Lab',grader:'Grd',packer:'Pck',forklift:'Fork',binpiler:'Bin',driver:'Drv',construction:'Con',baker:'Bak',painting:'Pnt',cleaner:'Cln'};
function fhJobName(firm,k,q,label){if(k==='custom')return label||'Other';var s=FH_SHORT[k];if(s)return s[q===1?0:1];return label||(typeof orderRoleName==='function'&&firm?orderRoleName(firm,k):k);}
function fhCrewOf(f){if(!f)return [];if(f.crew&&f.crew.length)return f.crew.map(function(x){return {role:x.role,qty:+x.qty||0};});return f.role&&+f.workers?[{role:f.role,qty:+f.workers}]:[];}
function fhJobList(firm){var base=[];try{base=typeof ofRoles==='function'?ofRoles(firm):(typeof orderRoleList==='function'?orderRoleList(firm):[]);}catch(e){base=[];}
  if(typeof ofRoles!=='function'){var cnt={};(DB.crewOrders||[]).forEach(function(o){if(o.kind||!firm||o.firmId!==firm.id)return;fhCrewOf(o.cur||o.req).forEach(function(x){cnt[x.role]=(cnt[x.role]||0)+x.qty;});});
    base=base.map(function(r,i){return {r:r,i:i};}).sort(function(a,b){return ((cnt[b.r.key]||0)-(cnt[a.r.key]||0))||(a.i-b.i);}).map(function(x){return x.r;});}
  var out=[],seen={},add=function(k,lab){if(seen[k])return;seen[k]=1;out.push({key:k,label:lab});};
  base.forEach(function(r){add(r.key,fhJobName(firm,r.key,1,r.label));if(r.key==='forklift')add('binpiler','Bin piler');});
  (typeof FARM_RATE_ROLES!=='undefined'?FARM_RATE_ROLES:[]).forEach(function(r){add(r[0],fhJobName(firm,r[0],1,r[1]));if(r[0]==='forklift')add('binpiler','Bin piler');});
  add('binpiler','Bin piler');add('custom','Other job…');return out;}
function fhCleanJobs(J){var out=[];(J||[]).forEach(function(j){var q=parseInt(j&&j.qty,10),k=String(j&&j.role||''),lab=k==='custom'?String(j.label||'').trim().slice(0,40):'';if(!k||!(q>0)||(k==='custom'&&!lab))return;
  var e=out.filter(function(x){return x.role===k&&(x.label||'').toLowerCase()===lab.toLowerCase();})[0];if(e)e.qty=Math.min(500,e.qty+q);else{var o={role:k,qty:Math.min(500,q)};if(lab)o.label=lab;out.push(o);}});return out.slice(0,12);}
function fhJobsSum(J){return (J||[]).reduce(function(a,j){return a+(+j.qty||0);},0);}
function fhJobsText(firm,J){return (J||[]).map(function(j){return j.qty+' '+fhJobName(firm,j.role,+j.qty,j.label);}).join(' · ');}
function fhJobsChips(firm,J){return (J||[]).map(function(j){return '<span class="fh-job"><b>'+esc(String(j.qty))+'</b> '+esc(fhJobName(firm,j.role,+j.qty,j.label))+'</span>';}).join('');}
function fhJobsAbbr(J){if(!J||!J.length)return '';var t=J.slice(0,3).map(function(j){return j.qty+' '+(FH_ABBR[j.role]||String(j.label||j.role).slice(0,4));}).join(' · ')+(J.length>3?' +'+(J.length-3):'');return '<span class="fhc-jobs">'+esc(t)+'</span>';}
/* ---------- office suggestion from crew orders + scheduled shifts (with job lines) ---------- */
function fhSuggest(firm,date){var codes=firmCodes(firm),conf=0,req=0,sh=0,linked={},nos=[],jc=[],jr=[];
  (typeof ordersOf==='function'?ordersOf(firm):[]).forEach(function(o){var st=ordStatus(o);if(st==='Declined'||st==='Cancelled')return;
    if(o.cur){if(o.cur.date===date){conf+=+o.cur.workers||0;nos.push(o.no);jc=jc.concat(fhCrewOf(o.cur));if(o.shiftId)linked[o.shiftId]=1;}return;}
    var f=(o.pending&&o.pending.fields)||o.req;if(f&&f.date===date){req+=+f.workers||0;nos.push(o.no+' (requested)');jr=jr.concat(fhCrewOf(f));}});
  (DB.shifts||[]).forEach(function(s){if(s.test||s.date!==date||codes.indexOf(s.site)<0||linked[s.id])return;var q=Math.max(+s.needed||0,(s.booked||[]).length);sh+=q;
    if(q)jc.push({role:s.role==='driver'?'driver':s.role==='forklift'||s.role==='machinery'?'forklift':'labour',qty:q});});
  var useConf=(conf+sh)>0,jobs=fhCleanJobs(useConf?jc:jr),n=useConf?conf+sh:req;if(fhJobsSum(jobs)!==n)jobs=[];   /* only offer job lines that add up to the total */
  return {n:n,conf:conf,req:req,sh:sh,nos:nos,jobs:jobs};}

/* ---------- farm: Crew coming card ---------- */
function fhDayLabel(d){var T=today();return d===T?'Today':d===addDays(T,1)?'Tomorrow':shortDay(d).split(' ')[0];}
function fhComingCard(firm){var T=today(),tm=addDays(T,1),t=fhDay(firm.id,tm),days=[];for(var i=1;i<=FH_DAYS;i++)days.push(addDays(T,i));
  var st=function(d){return d?(d.ok?'<span class="pill s-ok fh-st">'+fhIcon('check','fh-i14')+' Confirmed by office</span>':'<span class="pill s-pend fh-st">Pending – not confirmed yet</span>'):'';};
  var week=days.reduce(function(a,d){var x=fhDay(firm.id,d);return a+(x?+x.n||0:0);},0),tj=t&&t.jobs&&t.jobs.length?t.jobs:null;
  return '<section class="card fh-card fh-coming fh-in" id="fhcoming" aria-labelledby="fhcominghd"><div class="fh-ch"><span class="fh-badge">'+fhIcon('people')+'</span><div><h2 id="fhcominghd">Crew coming</h2><div class="fh-sub">Numbers set and confirmed by the UnScramble office</div></div></div>'+
    '<div class="fh-tomorrow'+(t?(t.ok?' ok':' pend'):' none')+'" id="fhtomorrow"><div class="fh-big" data-count="'+(t?+t.n||0:'')+'">'+(t?esc(String(t.n)):'–')+'</div><div class="fh-tm"><div class="fh-lbl">'+(t?(+t.n===1?'person':'people')+' coming tomorrow':'Tomorrow – not set yet')+'</div><div class="fh-date">'+esc(shortDay(tm))+'</div>'+
    (tj?'<div class="fh-jobs" id="fhtjobs">'+fhJobsChips(firm,tj)+'</div>':'')+(t?st(t):'<div class="fh-sub">The office will set and confirm your crew numbers.</div>')+(t&&t.note?'<div class="fh-note">“'+esc(t.note)+'” – UnScramble office</div>':'')+'</div></div>'+
    '<div class="fh-strip" role="list" aria-label="Next '+FH_DAYS+' days – tap a day for its crew">'+days.map(function(d){var x=fhDay(firm.id,d),lab=fhDayLabel(d),info=x?shortDay(d)+' · '+x.n+' '+(+x.n===1?'person':'people')+' · '+(x.ok?'Confirmed by office':'Pending'):'';
      return '<div role="listitem" class="fh-dwrap"><button type="button" class="fh-day'+(x?(x.ok?' ok':' pend'):' none')+(d===tm?' tm':'')+(x&&x.jobs&&x.jobs.length?' hasjobs':'')+'" data-date="'+d+'"'+(x?' data-act="fhdayinfo" aria-expanded="false" aria-controls="fhdayinfo" data-info="'+esc(info)+'" data-jobs="'+esc(x.jobs&&x.jobs.length?fhJobsText(firm,x.jobs):'')+'"':' disabled')+' title="'+esc(shortDay(d)+': '+(x?x.n+' – '+(x.ok?'confirmed by office':'pending')+(x.jobs&&x.jobs.length?' – '+fhJobsText(firm,x.jobs):''):'not set'))+'"><span class="fh-dn">'+esc(lab==='Tomorrow'?'Tmrw':lab)+'</span><span class="fh-dd">'+esc(String(parseD(d).getDate()))+'</span><b class="fh-dv">'+(x?esc(String(x.n)):'–')+'</b><span class="fh-dot" aria-label="'+(x?(x.ok?'Confirmed':'Pending'):'Not set')+'"></span></button></div>';}).join('')+'</div>'+
    '<div class="fh-dayinfo" id="fhdayinfo" hidden aria-live="polite"></div>'+
    '<div class="fh-legend small"><span><i class="fh-dot ok"></i> Confirmed</span><span><i class="fh-dot pend"></i> Pending</span><span><i class="fh-dot none"></i> Not set</span>'+(week?'<span class="fh-wk">Next '+FH_DAYS+' days: <b>'+week+'</b> worker-days</span>':'')+'</div></section>';}
/* farm: tap a day in the strip → its crew (job types + counts only) */
ACT.fhdayinfo=function(el){var p=document.getElementById('fhdayinfo');if(!p)return;var open=el.getAttribute('aria-expanded')==='true';
  [].forEach.call(document.querySelectorAll('.fh-strip .fh-day'),function(b){b.setAttribute('aria-expanded','false');b.classList.remove('sel');});
  if(open){p.hidden=true;p.innerHTML='';return;}el.setAttribute('aria-expanded','true');el.classList.add('sel');
  var j=el.dataset.jobs||'';p.innerHTML='<b>'+esc(el.dataset.info||'')+'</b>'+(j?'<div class="fh-jobs">'+j.split(' · ').map(function(x){return '<span class="fh-job">'+esc(x)+'</span>';}).join('')+'</div>':'<div class="small muted">Total only – no job breakdown for this day.</div>');p.hidden=false;};

/* ---------- farm: period filter (drives the totals AND the timesheets – both read PAGE_STATE.fr) ---------- */
function fhMonthEnd(d){var x=parseD(d.slice(0,8)+'01');x.setMonth(x.getMonth()+1);x.setDate(0);return isoLocal(x);}
/* "This month" (owner, 11:36 PM Oct 6): the calendar month in Toronto time (1st – last day), right next to "This week" */
function fhTorToday(){try{if(DB&&DB.settings&&DB.settings.simDate)return DB.settings.simDate;var p=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),g=function(t){return (p.filter(function(x){return x.type===t;})[0]||{}).value;};var v=g('year')+'-'+g('month')+'-'+g('day');return /^\d{4}-\d{2}-\d{2}$/.test(v)?v:today();}catch(e){return today();}}
function fhMonthOf(d){var m0=d.slice(0,8)+'01';return [m0,fhMonthEnd(d)];}
function fhPresets(){var T=today(),ws=weekStart(T),M=fhMonthOf(fhTorToday()),lm=addDays(M[0],-1),out=[['week','This week',ws,addDays(ws,6)],['month','This month',M[0],M[1]],['lastweek','Last week',addDays(ws,-7),addDays(ws,-1)]];
  if(typeof payPeriodOf==='function'){var p=payPeriodOf(T);out.push(['pay','Pay period',p.start,p.end]);}
  out.push(['lastmonth','Last month',lm.slice(0,8)+'01',lm]);return out;}
function fhCurPreset(){var fr=PAGE_STATE.fr||{};if(!fr.from)return 'week';if(PAGE_STATE.fhp&&PAGE_STATE.fhp!=='custom'){var p=fhPresets().filter(function(x){return x[0]===PAGE_STATE.fhp;})[0];if(p&&p[2]===fr.from&&p[3]===fr.to)return p[0];}
  var m=fhPresets().filter(function(x){return x[2]===fr.from&&x[3]===fr.to;})[0];return m?m[0]:'custom';}
function fhPeriodBar(){var cur=fhCurPreset(),fr=PAGE_STATE.fr||{},P=fhPresets(),sel=P.filter(function(x){return x[0]===cur;})[0],from=sel?sel[2]:fr.from,to=sel?sel[3]:fr.to;
  return '<section class="card fh-card fh-period fh-in" id="fhperiod" aria-labelledby="fhperiodhd"><div class="fh-ch"><span class="fh-badge gold">'+fhIcon('cal')+'</span><div><h2 id="fhperiodhd">Period total</h2><div class="fh-sub" id="fhrange">'+esc(shortDay(from)+' – '+shortDay(to))+'</div></div></div>'+
    '<div class="fh-chips" role="radiogroup" aria-label="Period">'+P.map(function(x){return '<button type="button" role="radio" class="fh-chip'+(x[0]===cur?' on':'')+'" aria-checked="'+(x[0]===cur)+'" data-act="fhperiod" data-p="'+x[0]+'">'+esc(x[1])+'</button>';}).join('')+'<button type="button" role="radio" class="fh-chip'+(cur==='custom'?' on':'')+'" aria-checked="'+(cur==='custom')+'" data-act="fhperiod" data-p="custom">Custom…</button></div>'+
    '<form data-form="fhrange" class="fh-custom" id="fhcustom"'+(cur==='custom'||PAGE_STATE.fhCustomOpen?'':' hidden')+'><label>From<input type="date" name="from" value="'+esc(from)+'" required></label><label>To<input type="date" name="to" value="'+esc(to)+'" required></label><button class="small">Show</button></form>'+
    '<div class="fh-stats" id="fhstats" aria-live="polite"></div></section>';}
ACT.fhperiod=function(el){var p=el.dataset.p;if(p==='custom'){PAGE_STATE.fhCustomOpen=true;var f=document.getElementById('fhcustom');if(f){f.hidden=false;var i=f.querySelector('input');if(i)i.focus();}[].forEach.call(document.querySelectorAll('.fh-chip'),function(c){c.classList.toggle('on',c===el);c.setAttribute('aria-checked',String(c===el));});return;}
  var x=fhPresets().filter(function(q){return q[0]===p;})[0];if(!x)return;PAGE_STATE.fhp=p;PAGE_STATE.fhCustomOpen=false;PAGE_STATE.fr={from:x[2],to:x[3]};render();};
FORMS.fhrange=function(f,d){if(!d.from||!d.to){toast('Pick both dates.');return;}if(d.from>d.to){toast('"From" must be before "To".');return;}if(daysBetween(d.from,d.to)>366){toast('Pick at most one year.');return;}PAGE_STATE.fhp='custom';PAGE_STATE.fr={from:d.from,to:d.to};render();};

/* ---------- farm: home ---------- */
(function(){var oh=VIEWS['firm:home'];VIEWS['firm:home']=function(){var x=oh();if(!ME||ME.type!=='firm')return x;
  var hasTot=x.indexOf('card totals')>=0;return '<div id="fhpre" hidden></div>'+fhComingCard(ME)+(hasTot?fhPeriodBar():'')+x;};})();
function fhGreet(){var h=new Date().getHours();return h<12?'Good morning':h<18?'Good afternoon':'Good evening';}
function fhStatsFromTotals(main){var tot=main.querySelector('.card.totals');if(!tot)return [];var rows=[].slice.call(tot.querySelectorAll('.trow')),val=function(re){var r=rows.filter(function(r){var s=r.querySelector('span');return s&&re.test(s.textContent.trim());})[0];if(!r)return null;var b=r.querySelector(':scope > b');return b?b.childNodes[0].textContent.trim():null;};
  var grand=tot.querySelector('.trow.grand > b'),out=[];var bh=val(/^Billable hours$/),hw=val(/^Hours worked/),wd=val(/^Workers/);
  if(bh||hw)out.push(['clock',bh?'Billable hours':'Hours worked',bh||hw,bh&&hw?hw+' h worked':'']);if(wd)out.push(['people','Worker-days',wd,'']);if(grand)out.push(['cash','Total to pay',grand.textContent.trim(),'incl. HST']);return out;}
function fhCount(el){var t=el.textContent,m=/^([^0-9]*)([0-9][0-9,]*)(\.\d+)?(.*)$/.exec(t);if(!m||fhReduced())return;var end=parseFloat((m[2]+(m[3]||'')).replace(/,/g,'')),dec=(m[3]||'').length?m[3].length-1:0,t0=null,dur=650;if(!(end>0))return;
  var fmt=function(v){var s=v.toFixed(dec),p=s.split('.');p[0]=p[0].replace(/\B(?=(\d{3})+(?!\d))/g,m[2].indexOf(',')>=0||end>=1000?',':'');return m[1]+p.join('.')+m[4];};
  var step=function(ts){if(t0===null)t0=ts;var k=Math.min(1,(ts-t0)/dur),e=1-Math.pow(1-k,3);el.textContent=fmt(end*e);if(k<1)requestAnimationFrame(step);else el.textContent=t;};el.textContent=fmt(0);requestAnimationFrame(step);}
var FH_SECT_DEFAULT={'sect-hours':true,'sect-shifts':true};
(function(){if(typeof groupFirmHome!=='function')return;var og=groupFirmHome;groupFirmHome=function(root){og(root);try{fhArrange(root);}catch(e){logError(e);}};})();
/* entrance motion plays once per visit to Home (not on every period click), never under reduced motion */
var FH_ANIM=true;window.addEventListener('hashchange',function(){if(!/^#\/home/.test(location.hash||'#/home'))FH_ANIM=true;});
function fhArrange(root){var main=root.querySelector('main');if(!main||main.dataset.fh)return;var top=main.querySelector('.hometop');if(!top)return;main.dataset.fh='1';main.classList.add('fh-home');
  var anim=FH_ANIM&&!fhReduced();FH_ANIM=false;if(anim)main.classList.add('fh-anim');
  var h1=top.querySelector('h1'),banner=main.querySelector('#clientlinkbanner'),order=main.querySelector('#ordercard'),coming=main.querySelector('#fhcoming'),per=main.querySelector('#fhperiod'),tot=main.querySelector('.card.totals'),pre=main.querySelector('#fhpre');if(pre)pre.remove();
  /* hero: greeting + the farm's own name + client no. / sites */
  var hero=document.createElement('section');hero.className='fh-hero fh-in';hero.id='fhhero';hero.innerHTML='<div class="fh-hello">'+esc(fhGreet())+'</div>';if(h1){h1.classList.add('fh-name');hero.appendChild(h1);}
  if(banner){banner.classList.add('fh-bannerin');hero.appendChild(banner);}top.insertBefore(hero,top.firstChild);
  if(order){order.classList.add('fh-order','fh-in');var a=order.querySelector('a.btn');if(a){var blocked=/not available/.test(a.textContent);a.classList.add('fh-orderbtn');a.innerHTML=(blocked?'':fhIcon('plus','fh-i22'))+'<span>'+(blocked?esc(a.textContent):'Order a crew')+'</span>';if(!blocked){a.setAttribute('data-act','fhorder');}}
    var after=hero.nextSibling;while(after&&after!==order&&after.id!=='farmblocked'&&after.id!=='firmagr')after=after.nextSibling;top.insertBefore(order,(after&&after!==order)?after.nextSibling:hero.nextSibling);}
  var anchor=order||hero;if(coming){top.insertBefore(coming,anchor.nextSibling);anchor=coming;}
  if(per){top.insertBefore(per,anchor.nextSibling);anchor=per;if(tot){tot.classList.add('fh-totals');per.appendChild(tot);var h2=tot.querySelector('h2');if(h2)h2.classList.add('fh-tothd');}
    var st=document.getElementById('fhstats');if(st){var S=fhStatsFromTotals(main);st.innerHTML=S.map(function(s){return '<div class="fh-stat"><span class="fh-badge sm">'+fhIcon(s[0])+'</span><div><div class="fh-sv" data-count>'+esc(s[2])+'</div><div class="fh-sl">'+esc(s[1])+(s[3]?' <span class="fh-sx">· '+esc(s[3])+'</span>':'')+'</div></div></div>';}).join('');if(anim)[].forEach.call(st.querySelectorAll('[data-count]'),fhCount);}}
  /* timesheets for the chosen period, right under the total */
  var ts=document.createElement('section');ts.className='fh-ts fh-in';ts.id='fhtimesheets';ts.innerHTML='<div class="fh-ch fh-tsh"><span class="fh-badge">'+fhIcon('sheet')+'</span><div><h2>Timesheets</h2><div class="fh-sub">'+(per?esc(document.getElementById('fhrange').textContent)+' – follows the period above':'')+'</div></div></div>';
  [['sect-hours','Hours and billing by day'],['sect-shifts','Every shift – propose a time change']].forEach(function(s){var d=main.querySelector('#'+s[0]);if(!d)return;var o=SECT_OPEN[s[0]];d.open=(o===undefined?FH_SECT_DEFAULT[s[0]]:o)||detailsOpen();d.addEventListener('toggle',function(){SECT_OPEN[s[0]]=d.open;});var sm=d.querySelector('summary');if(sm)sm.textContent=clientWord(s[1],ME);ts.appendChild(d);});
  if(ts.querySelector('details'))top.parentNode.insertBefore(ts,top.nextSibling);
  [].forEach.call(ts.querySelectorAll('form[data-form="frange"]'),function(f){f.classList.add('fh-oldrange');f.hidden=true;f.style.display='none';});
  var con=main.querySelector('.fh-chip.on');if(con){var cc=con.parentNode,dx=con.getBoundingClientRect().left-cc.getBoundingClientRect().left;if(dx<0||dx+con.offsetWidth>cc.clientWidth)cc.scrollLeft+=dx-12;}
  if(coming&&anim){var b=coming.querySelector('.fh-big[data-count]');if(b&&b.dataset.count)fhCount(b);}}
/* farmhome2: an unknown address (e.g. an old #/safety link) shows the farm Home view – switch the address to #/home so it gets the full Home layout and the Home tab is highlighted */
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{if(root&&root.id==='app'&&ME&&ME.type==='firm'){var h=(location.hash||'#/home').split('?')[0];var m=root.querySelector('main');
  if(m&&!/^#\/(home)?$/.test(h)&&m.querySelector('#fhcoming')&&!m.classList.contains('fh-home')&&!(NAV.firm||[]).some(function(n){return n[0]===h;})&&['#/terms','#/profile','#/alerts','#/pending','#/changepw','#/quiz','#/quizresult'].indexOf(h)<0){history.replaceState(null,'','#/home');render();}}}catch(e){logError(e);}};})();
/* clientlink re-places its banner after afterRender; on the new farm Home keep it inside the hero */
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{var m=root&&root.querySelector&&root.querySelector('main.fh-home'),hero=m&&m.querySelector('#fhhero'),b=m&&m.querySelector('#clientlinkbanner');if(hero&&b&&b.parentNode!==hero)hero.appendChild(b);}catch(e){}};})();
ACT.fhorder=function(){if(typeof orderBlock==='function'&&orderBlock(ME)){go('#/orders');return;}PAGE_STATE.coForm=true;go('#/orders');};

/* ---------- farm: top row of tabs (the 4 sections) ---------- */
var FH_TAB={'#/home':['home','Home'],'#/orders':['orders','Crew orders'],'#/invoices':['invoices','Invoices'],'#/profile':['profile','Profile']};
function fhTabs(nav,h,unread){return '<nav class="tabs fh-tabs" id="fhtabs" aria-label="Main" style="--fh-n:'+nav.length+'">'+nav.map(function(n){var t=FH_TAB[n[0]]||['home',n[1]],on=n[0]===h||(n[0]==='#/home'&&(h==='#/'||h===''));
    return '<a href="'+esc(n[0])+'" class="fh-tab'+(on?' on':'')+'"'+(on?' aria-current="page"':'')+'>'+fhIcon(t[0])+'<span>'+esc(clientWord(t[1],ME))+'</span></a>';}).join('')+
  '<span class="fh-tabx">'+(unread?'<a class="fh-bell'+(h==='#/alerts'?' on':'')+'" href="#/alerts" title="Alerts" aria-label="'+unread+' new alerts">'+fhIcon('bell')+'<b>'+unread+'</b></a>':'')+'<button type="button" class="fh-info" data-act="togglehelp" aria-pressed="'+(typeof detailsOpen==='function'&&detailsOpen())+'" title="Show or hide all details" aria-label="Show or hide all details">'+fhIcon('info')+'</button></span></nav>';}
(function(){var ol=layout;layout=function(c){var x=ol(c),u=ME;if(!u||u.type!=='firm'||gateNav(u))return x;var m=x.match(/<nav class="tabs menubar"[\s\S]*?<\/nav>/)||x.match(/<nav class="tabs">[\s\S]*?<\/nav>/);if(!m)return x;
  var h=location.hash.split('?')[0]||'#/home',unread=DB.notes.filter(function(n){return n.to===u.id&&!n.read;}).length;return x.replace(m[0],fhTabs(NAV.firm||[],h,unread));};})();

/* ---------- office: Crew coming ---------- */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/creworders')return i+1;return NAV.admin.length;})(),0,['#/crewcoming','Crew coming (farm numbers)']);
if(typeof MENU_GROUPS!=='undefined'&&MENU_GROUPS[0]&&MENU_GROUPS[0][1].indexOf('#/crewcoming')<0)MENU_GROUPS[0][1].splice(Math.max(0,MENU_GROUPS[0][1].indexOf('#/creworders')+1),0,'#/crewcoming');
function fhFirms(){var l=(typeof companyFirms==='function'?companyFirms():DB.users.filter(function(u){return u.type==='firm';}));return l.filter(function(f){return (typeof clIsClient==='function'?clIsClient(f):!f.loginOf&&!f.mergedInto)&&f.active!==false;}).sort(function(a,b){var x=(typeof clCode==='function'?clCode(a):'')||a.name,y=(typeof clCode==='function'?clCode(b):'')||b.name;return x<y?-1:x>y?1:0;});}
function fhCode(f){var c=typeof clCode==='function'?clCode(f):'';return c&&c!=='–'?c:(firmCodes(f)[0]||'');}
VIEWS['admin:crewcoming']=function(){var S=PAGE_STATE.fhc=PAGE_STATE.fhc||{start:addDays(today(),1),q:'',all:false},days=[];for(var i=0;i<FH_DAYS;i++)days.push(addDays(S.start,i));
  var q=String(S.q||'').trim().toLowerCase(),firms=fhFirms().map(function(f){var cells=days.map(function(d){return {d:d,v:fhDay(f.id,d),s:fhSuggest(f,d)};});return {f:f,cells:cells,active:cells.some(function(c){return c.v||c.s.n;})};});
  var shown=firms.filter(function(r){if(q)return (r.f.name+' '+fhCode(r.f)+' '+firmCodes(r.f).join(' ')).toLowerCase().indexOf(q)>=0;return S.all||r.active;});
  var nSet=0,nOk=0;firms.forEach(function(r){r.cells.forEach(function(c){if(c.v){nSet++;if(c.v.ok)nOk++;}});});
  return '<h1>Crew coming – numbers each farm sees</h1><p class="small muted">Set how many people are going to each farm or client per day – as a total or by job (e.g. 1 Truck driver, 2 Graders). Tap a day to edit. The farm sees <b>only its own numbers</b> on its Home screen, and only the ones set here: <b>Confirmed by office</b> or <b>Pending</b>. Grey <i>≈ numbers</i> are suggestions from crew orders and scheduled shifts – nothing is shown to the farm until you save it.</p>'+
  '<div class="card fhc-bar"><div class="row"><button class="small sec" data-act="fhcweek" data-d="-7" aria-label="Previous 7 days">‹ Prev</button><button class="small sec" data-act="fhcweek" data-d="0">From tomorrow</button><button class="small sec" data-act="fhcweek" data-d="7" aria-label="Next 7 days">Next ›</button><b class="fhc-range">'+esc(shortDay(days[0])+' – '+shortDay(days[days.length-1]))+'</b></div>'+
  '<div class="row"><input type="text" id="fhcq" value="'+esc(S.q||'')+'" placeholder="Find farm or site code" aria-label="Find farm or site code" style="max-width:260px"><label class="inline small"><input type="checkbox" id="fhcall"'+(S.all?' checked':'')+'> Show all '+firms.length+' farms (not only those with orders, shifts or numbers)</label><span class="small muted">'+nSet+' set this week · '+nOk+' confirmed</span></div></div>'+
  (shown.length?'<div class="fhc-scroll"><table class="no-stack fhc-table" id="fhctable"><tr><th>Farm / client</th>'+days.map(function(d){return '<th class="fhc-dh">'+esc(fhDayLabel(d))+'<br><span class="small muted">'+esc(shortDay(d).replace(/^\w+ /,''))+'</span></th>';}).join('')+'<th>Week</th></tr>'+shown.map(function(r){var f=r.f;
    return '<tr data-firm="'+esc(f.id)+'"><td><b>'+esc(fhCode(f)||'–')+'</b> <span class="small">'+esc(f.name)+'</span></td>'+r.cells.map(function(c){var v=c.v,s=c.s;
      return '<td class="fhc-cell"><button type="button" class="fhc-btn'+(v?(v.ok?' ok':' pend'):(s.n?' sug':' none'))+'" data-act="fhcell" data-f="'+esc(f.id)+'" data-d="'+c.d+'" aria-label="'+esc(fhCode(f)+' '+shortDay(c.d)+': '+(v?v.n+(v.ok?' confirmed':' pending')+(v.jobs&&v.jobs.length?' – '+fhJobsText(f,v.jobs):''):s.n?'suggested '+s.n:'not set'))+'" title="'+esc(v&&v.jobs&&v.jobs.length?fhJobsText(f,v.jobs):(!v&&s.jobs.length?'Suggested: '+fhJobsText(f,s.jobs):''))+'">'+(v?'<b>'+esc(String(v.n))+'</b>'+fhJobsAbbr(v.jobs)+'<span class="fhc-st">'+(v.ok?'✓ Confirmed':'Pending')+'</span>':s.n?'<i>≈'+s.n+'</i>'+fhJobsAbbr(s.jobs)+'<span class="fhc-st">suggested</span>':'<span class="muted">–</span>')+'</button></td>';}).join('')+
      '<td class="fhc-act"><button class="small sec" data-act="fhcfill" data-f="'+esc(f.id)+'" title="Use the suggestions as Pending for empty days">Use suggestions</button> <button class="small" data-act="fhcconfirm" data-f="'+esc(f.id)+'" title="Confirm every number set this week">Confirm week</button></td></tr>';}).join('')+'</table></div>':'<p class="muted" id="fhcnone">'+(q?'No farm matches “'+esc(S.q)+'”.':'No crew orders, shifts or numbers this week. Tick “Show all farms” to set numbers for any farm.')+'</p>')+
  '<p class="small muted">Saved numbers are kept with the farm\'s crew orders (office-only changes; the farm can read but not change them). Every change is in the audit log.</p>';};
ACT.fhcweek=function(el){var S=PAGE_STATE.fhc||{};var d=+el.dataset.d;S.start=d?addDays(S.start||addDays(today(),1),d):addDays(today(),1);PAGE_STATE.fhc=S;render();};
document.addEventListener('change',function(e){if(e.target&&e.target.id==='fhcall'){(PAGE_STATE.fhc=PAGE_STATE.fhc||{}).all=e.target.checked;render();}});
document.addEventListener('keydown',function(e){if(e.target&&e.target.id==='fhcq'&&e.key==='Enter'){e.preventDefault();(PAGE_STATE.fhc=PAGE_STATE.fhc||{}).q=e.target.value;PAGE_STATE.after=function(){var i=document.getElementById('fhcq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}};render();}});
var FH_QT=null;document.addEventListener('input',function(e){if(e.target&&e.target.id==='fhcq'){clearTimeout(FH_QT);var v=e.target.value;FH_QT=setTimeout(function(){(PAGE_STATE.fhc=PAGE_STATE.fhc||{}).q=v;PAGE_STATE.after=function(){var i=document.getElementById('fhcq');if(i){i.focus();i.setSelectionRange(i.value.length,i.value.length);}};render();},350);}});
function fhOffice(){return !!(ME&&ME.type==='admin');}
/* farmhome2: per-day crew breakdown editor – job + quantity steppers, total = sum of the jobs (or a plain number when no jobs) */
function fhJobRow(firm,j){var L=fhJobList(firm),cur=j&&j.role||'';if(cur&&!L.some(function(r){return r.key===cur;}))L=L.concat([{key:cur,label:fhJobName(firm,cur,1,j.label)}]);
  return '<div class="fh-jl"><select name="jr[]" class="fh-jsel" aria-label="Job">'+L.map(function(r){return '<option value="'+esc(r.key)+'"'+(r.key===cur?' selected':'')+'>'+esc(r.label)+'</option>';}).join('')+'</select>'+
    '<input type="text" name="jx[]" class="fh-jx" placeholder="Job name" maxlength="40" aria-label="Job name" value="'+esc(cur==='custom'?(j.label||''):'')+'"'+(cur==='custom'?'':' hidden')+'>'+
    '<span class="fh-step"><button type="button" class="fh-sb" data-act="fhjdec" aria-label="One less">−</button><input type="number" name="jq[]" class="fh-q" min="1" max="500" step="1" inputmode="numeric" aria-label="How many" value="'+(j?(+j.qty||1):1)+'"><button type="button" class="fh-sb" data-act="fhjinc" aria-label="One more">+</button></span>'+
    '<button type="button" class="fh-jdel" data-act="fhjdel" aria-label="Remove this job" title="Remove">×</button></div>';}
function fhJobsSync(){var f=document.getElementById('fhsetform');if(!f)return;var rows=f.querySelectorAll('.fh-jl'),sum=0,n=f.querySelector('input[name=n]'),t=document.getElementById('fhjtotal');
  [].forEach.call(rows,function(r){var q=parseInt(r.querySelector('.fh-q').value,10);sum+=q>0?q:0;var s=r.querySelector('.fh-jsel'),x=r.querySelector('.fh-jx');if(x)x.hidden=s.value!=='custom';});
  if(rows.length){n.value=String(sum);n.readOnly=true;n.classList.add('fh-ro');}else{n.readOnly=false;n.classList.remove('fh-ro');}
  if(t)t.textContent=rows.length?'= '+sum+' (sum of the jobs)':'No jobs listed – type the total, or add jobs';
  var e=document.getElementById('fhjempty');if(e)e.hidden=rows.length>0;}
ACT.fhcell=function(el){if(!fhOffice())return;var f=user(el.dataset.f),d=el.dataset.d;if(!f)return;var v=fhDay(f.id,d),s=fhSuggest(f,d),rest=fhWeekDays().filter(function(x){return x>d;});
  var start=v?(v.jobs||[]):s.jobs,sj=JSON.stringify(s.jobs||[]);
  modal('<h2>Crew coming – '+esc(fhCode(f))+' · '+esc(shortDay(d))+'</h2><p class="small">'+esc(f.name)+'. The farm sees the total and the jobs (no names) on its Home screen as <b>Confirmed by office</b> or <b>Pending</b>.</p>'+
    '<div class="fh-sug small" id="fhsug" role="note"><b>Suggested: '+s.n+'</b> – '+s.conf+' in confirmed crew orders'+(s.nos.length?' ('+esc(s.nos.join(', '))+')':'')+', '+s.sh+' on scheduled shifts, '+s.req+' requested (not confirmed yet).'+
      (s.jobs.length?'<div class="fh-sugj">'+esc(fhJobsText(f,s.jobs))+' <button type="button" class="small sec" data-act="fhjuse" id="fhjuse" data-jobs="'+esc(sj)+'">Use these jobs</button></div>':'')+'</div>'+
    '<form data-form="fhset" id="fhsetform"><input type="hidden" name="f" value="'+esc(f.id)+'"><input type="hidden" name="d" value="'+esc(d)+'"><input type="hidden" name="copy" value="">'+
    '<fieldset class="fh-jobsbox"><legend>Crew by job</legend><div id="fhjobs" data-f="'+esc(f.id)+'">'+start.map(function(j){return fhJobRow(f,j);}).join('')+'</div>'+
    '<p class="small muted" id="fhjempty"'+(start.length?' hidden':'')+'>No jobs listed yet.</p><button type="button" class="small sec" data-act="fhjadd" id="fhjadd">＋ Add job</button></fieldset>'+
    '<div class="grid2"><div><label for="fhn">Total people coming</label><input type="number" id="fhn" name="n" min="0" max="500" step="1" inputmode="numeric" required value="'+esc(v?String(v.n):(s.n?String(s.n):''))+'"><div class="hint" id="fhjtotal"></div></div>'+
    '<div><label>Status</label><label class="inline"><input type="checkbox" name="ok"'+(v&&v.ok?' checked':(!v?' checked':''))+'> <b>Confirmed</b> – the farm sees “Confirmed by office”</label><div class="hint">Untick to show it as “Pending”.</div></div></div>'+
    inp('note','Note to the farm (optional, shown under tomorrow)',v?v.note||'':'',{extra:' maxlength="120"'})+'<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button>'+(v?'<button type="button" class="danger" data-act="fhcclear" data-f="'+esc(f.id)+'" data-d="'+esc(d)+'">Clear (farm sees “not set”)</button>':'')+
    (rest.length?'<button type="button" class="sec" data-act="fhsavecopy" id="fhsavecopy" title="Save, then put the same crew on '+esc(shortDay(rest[0]))+' – '+esc(shortDay(rest[rest.length-1]))+'">Save + copy to rest of week ('+rest.length+')</button>':'')+'<button id="fhsave">Save</button></div></form>');fhJobsSync();};
ACT.fhjadd=function(){var b=document.getElementById('fhjobs');if(!b)return;var f=user(b.dataset.f),used=[].map.call(b.querySelectorAll('.fh-jsel'),function(s){return s.value;}),L=fhJobList(f),nx=L.filter(function(r){return r.key!=='custom'&&used.indexOf(r.key)<0;})[0];
  b.insertAdjacentHTML('beforeend',fhJobRow(f,{role:nx?nx.key:L[0].key,qty:1}));fhJobsSync();var s=b.lastElementChild&&b.lastElementChild.querySelector('select');if(s)s.focus();};
ACT.fhjinc=function(el){var i=el.parentNode.querySelector('.fh-q');i.value=String(Math.min(500,(parseInt(i.value,10)||0)+1));fhJobsSync();};
ACT.fhjdec=function(el){var i=el.parentNode.querySelector('.fh-q');i.value=String(Math.max(1,(parseInt(i.value,10)||1)-1));fhJobsSync();};
ACT.fhjdel=function(el){var r=el.closest('.fh-jl');if(r)r.remove();fhJobsSync();};
ACT.fhjuse=function(el){var b=document.getElementById('fhjobs');if(!b)return;var f=user(b.dataset.f),J=[];try{J=JSON.parse(el.dataset.jobs||'[]');}catch(e){}b.innerHTML=J.map(function(j){return fhJobRow(f,j);}).join('');fhJobsSync();};
ACT.fhsavecopy=function(){var f=document.getElementById('fhsetform');if(!f)return;f.elements.copy.value='1';f.requestSubmit();};
document.addEventListener('input',function(e){if(e.target&&e.target.closest&&e.target.closest('#fhjobs'))fhJobsSync();});
document.addEventListener('change',function(e){if(e.target&&e.target.closest&&e.target.closest('#fhjobs'))fhJobsSync();});
FORMS.fhset=function(f,d){if(!fhOffice())return;var firm=user(d.f);if(!firm||firm.type!=='firm'||!/^\d{4}-\d{2}-\d{2}$/.test(d.d||'')){toast('Not saved.');return;}
  var jr=d.jr||[],jq=d.jq||[],jx=d.jx||[],jobs=[],bad='';
  for(var i=0;i<jr.length;i++){var q=parseInt(jq[i],10),k=String(jr[i]||''),nm=String(jx[i]||'').trim();if(!(q>=1&&q<=500)||String(q)!==String(jq[i]).trim()){bad='Each job needs a whole number from 1 to 500.';break;}if(k==='custom'&&!nm){bad='Type the job name for “Other job”.';break;}jobs.push({role:k,qty:q,label:k==='custom'?nm.slice(0,40):''});}
  if(bad){toast(bad);return;}jobs=fhCleanJobs(jobs);
  var n=jobs.length?fhJobsSum(jobs):parseInt(d.n,10);if(!(n>=0&&n<=500)||(!jobs.length&&String(n)!==String(d.n).trim())){toast(jobs.length?'The total of the jobs must be 500 or less.':'Enter a whole number from 0 to 500.');return;}
  var val={n:n,jobs:jobs,ok:!!d.ok,note:String(d.note||'').trim().slice(0,120)};fhSetDay(firm,d.d,val,d.ok?'confirmed':'set (pending)');
  var cp=0;if(d.copy==='1')fhWeekDays().filter(function(x){return x>d.d;}).forEach(function(x){fhSetDay(firm,x,val,'copied from '+d.d+(d.ok?' (confirmed)':' (pending)'));cp++;});
  save();closeModal();toast(fhCode(firm)+' '+shortDay(d.d)+': '+n+' '+(d.ok?'confirmed':'pending')+(cp?' – copied to '+cp+' more day'+(cp===1?'':'s'):'')+' ✓');render();};
ACT.fhcclear=function(el){if(!fhOffice())return;var f=user(el.dataset.f);if(!f)return;fhSetDay(f,el.dataset.d,null,'cleared');save();closeModal();toast('Cleared.');render();};
function fhWeekDays(){var S=PAGE_STATE.fhc||{start:addDays(today(),1)},o=[];for(var i=0;i<FH_DAYS;i++)o.push(addDays(S.start,i));return o;}
ACT.fhcfill=function(el){if(!fhOffice())return;var f=user(el.dataset.f);if(!f)return;var n=0;fhWeekDays().forEach(function(d){if(fhDay(f.id,d))return;var s=fhSuggest(f,d);if(s.n>0){fhSetDay(f,d,{n:s.n,jobs:s.jobs,ok:false,note:''},'set from suggestion (pending)');n++;}});if(n)save();toast(n?n+' day'+(n===1?'':'s')+' set as Pending from suggestions (with jobs).':'No empty days with a suggestion.');render();};
ACT.fhcconfirm=function(el){if(!fhOffice())return;var f=user(el.dataset.f);if(!f)return;var n=0;fhWeekDays().forEach(function(d){var v=fhDay(f.id,d);if(v&&!v.ok){fhSetDay(f,d,{n:v.n,jobs:v.jobs,ok:true,note:v.note},'confirmed');n++;}});if(n)save();toast(n?n+' day'+(n===1?'':'s')+' confirmed.':'Nothing pending this week.');render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('fhcell','fhcclear','fhcfill','fhcconfirm','fhcweek','fhjadd','fhjinc','fhjdec','fhjdel','fhjuse','fhsavecopy');
if(typeof ADMIN_ONLY_FORM!=='undefined')ADMIN_ONLY_FORM.push('fhset');

/* ---------- office "Farm billing by day" (v2-minwaive): add "This month" next to "This week" ---------- */
(function(){var ov=VIEWS['admin:farmbilling'];if(!ov)return;VIEWS['admin:farmbilling']=function(){var x=ov.apply(this,arguments);
  return x.replace('data-act="mwweek">This week</button>','data-act="mwweek">This week</button> <button class="small sec" type="button" data-act="mwmonth" id="mwmonth">This month</button>');};})();
ACT.mwmonth=function(){if(!fhOffice()||typeof mwState!=='function')return;var st=mwState(),M=fhMonthOf(fhTorToday());st.from=M[0];st.to=M[1];render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('mwmonth');

/* ---------- client-facing wording on farm screens (owner, 11:38 PM Oct 6: "remove these lines add professional ones and not like its a test website") ----------
   firm.js / ui.js / security.js are not edited; their farm-visible text is rewritten here (farm sessions + the office "what the farm sees" preview). */
function fhSiteChips(firm){var codes=typeof firmCodes==='function'?firmCodes(firm):[];if(!codes.length)return '';
  return '<div class="fh-sites"><span class="fh-sitel">'+(codes.length===1?'Site':'Sites')+'</span>'+codes.map(function(c){var s=(DB.sites||[]).filter(function(x){return x.code===c;})[0],nm=s&&s.name?String(s.name).trim():'';
    if(!nm||/^(farm|worksite|site)$/i.test(nm)||nm===c||/\b(test|practice|demo|sample)\b/i.test(nm))nm='';return '<span class="fh-site">'+fhIcon('pin')+'<b>'+esc(c)+'</b>'+(nm?'<span class="fh-sn">'+esc(nm)+'</span>':'')+'</span>';}).join('')+'</div>';}
var FH_PRIV='Hours are shown as crew totals. Individual worker details are kept private.';
function fhFirmCopy(html,firm){return String(html)
  .replace(/<p class="small muted">Your sites: [\s\S]*?<\/p>/,function(){return fhSiteChips(firm)+'<p class="small muted fh-priv">'+FH_PRIV+'</p>';})
  .replace(/ \(test default – owner to confirm\)/g,'')
  .replace('Subcontractor crew hours use the scheduled shift times (subcontractors keep their own time records).','Contracted crew hours follow the scheduled shift times.');}
(function(){if(typeof firmPage!=='function')return;var of=firmPage;firmPage=function(firm){return fhFirmCopy(of.apply(this,arguments),firm);};})();
(function(){var ol=layout;layout=function(c){var x=ol(c);if(!ME||ME.type!=='firm')return x;return fhFirmCopy(x,ME)
  .replace('In the real app these go by email and push (and SMS only if you added a phone). In this test they are only shown here.','Your recent notices from UnScramble.')
  .replace('When on, signing in also needs a 6-digit code sent to you (simulated in this test – shown on screen and in the office Alerts outbox).','When on, signing in also needs a 6-digit code sent to you.');};})();
