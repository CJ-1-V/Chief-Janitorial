/* mentorfix1 – fixes for Mentor Bot's UnScramble review (Oct 7 2026). New file only; loaded just before v2-nohome.js.
   1) startup guard: users()/user() never throw when DB is not loaded yet; mock start() self-heals once if the first load breaks.
   2) clock-in: start options = the quarter hour at/before the tap (pre-selected) + the next one; earlier times sit behind
      "Started earlier?" and need a reason. Every entry keeps the real tap time (tapIn, plus existing realIn). Office Review & approve
      lists entries whose chosen start is before the tap quarter hour with the badge "Start earlier than tap time".
   3) office "Farm billing by day": opens on the most active farm/client (highest billable amount), not the first in the list.
   4) crew order reply wording depends on lead time: start more than 2 days out -> "within 1 business day"; else the 9 PM rule.
   5) small: tour card never covers the step's button; worker count starts at 1; start-time lists show 04:00–22:00 (plus the
      saved value) instead of all 96 quarter hours; every <label> is linked to its input (for/id). */
'use strict';
(function(){
/* ---------- 1) startup guard ---------- */
users=function(type){if(!DB||!DB.users)return [];return DB.users.filter(function(u){return !type||u.type===type;});};
user=function(id){if(!DB||!DB.users)return null;for(var i=0;i<DB.users.length;i++)if(DB.users[i].id===id)return DB.users[i];return null;};
if(typeof firmAgreementText==='function'){var _fat=firmAgreementText;firmAgreementText=function(){try{return _fat.apply(this,arguments);}catch(e){try{return _fat(null,arguments[1]);}catch(x){return '';}}};}
if(!window.REG_LIVE&&typeof start==='function'){var _st=start;
  var safeStart=function(){try{_st();}catch(e){try{console.warn('[mentorfix] first start failed, retrying once',e);}catch(x){}
    try{if(!DB||!DB.users){try{localStorage.removeItem(STORE_KEY);}catch(x){}DB=null;}_st();}catch(e2){try{console.warn('[mentorfix] retry failed',e2);}catch(x){}}}};
  document.removeEventListener('DOMContentLoaded',start);start=safeStart;
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',safeStart);}

/* ---------- 2) clock-in: no silent backdating ---------- */
var START_IDS={qIn:1,qCrewIn:1};
function qbtn(t,pre,early){return '<button type="button" role="radio" class="qopt'+(early?' qearly':'')+(t===pre?' sel':'')+'" aria-checked="'+(t===pre)+'" data-act="qopt" data-t="'+t+'"><b>'+hmOf(t)+'</b></button>';}
if(typeof quarterPicker==='function'){var _qp=quarterPicker;
  quarterPicker=function(id,label,after,base){if(!START_IDS[id]||after)return _qp.apply(this,arguments);
    var now=base||Date.now(),fl=Math.floor(now/QMS)*QMS,main=[fl,fl+QMS],early=[fl-3*QMS,fl-2*QMS,fl-QMS];
    return '<div class="qpick-box mf-qbox"><div class="label">'+esc(label)+' <span class="req-star">*</span></div><div class="qpick" id="'+id+'" role="radiogroup" aria-label="'+esc(label)+'" data-tap="'+now+'" data-floor="'+fl+'">'+
      main.map(function(t){return qbtn(t,fl,false);}).join('')+
      '<details class="mf-early"><summary>Started earlier? <span class="muted small">(reason needed)</span></summary><div class="mf-early-opts">'+early.map(function(t){return qbtn(t,fl,true);}).join('')+'</div>'+
      '<label for="'+id+'Why" class="small">Why is the start earlier than now ('+hmOf(now)+')?</label><textarea id="'+id+'Why" class="mf-why" rows="2" maxlength="300" placeholder="e.g. Started at 07:45, phone was dead"></textarea></details>'+
      '</div><div class="muted small">Times are rounded to the quarter hour. Your real clock time is saved too.</div></div>';};}
ACT.qopt=function(el){var root=el.closest('.qpick')||el.parentNode;[].forEach.call(root.querySelectorAll('.qopt'),function(x){x.classList.toggle('sel',x===el);x.setAttribute('aria-checked',String(x===el));});
  if(el.classList.contains('qearly')){var d=root.querySelector('details.mf-early');if(d)d.open=true;var w=root.querySelector('.mf-why');if(w)setTimeout(function(){try{w.focus();}catch(e){}},0);}
  if(root.id==='qIn'&&typeof clockInLabel==='function')clockInLabel();};
/* returns {ok, early, reason} for the start picker */
function earlyCheck(id){var root=document.getElementById(id);if(!root||!root.dataset.floor)return {ok:true};var v=qVal(id);if(v==null)return {ok:true};
  var fl=+root.dataset.floor;if(v>=fl)return {ok:true,early:false};var w=(root.querySelector('.mf-why')||{}).value||'';w=w.trim();
  if(w.length<3){var d=root.querySelector('details.mf-early');if(d)d.open=true;return {ok:false};}return {ok:true,early:true,reason:w};}
window.mfEarlyCheck=earlyCheck;
function stampNew(beforeIds,chk,tap){(DB.time||[]).forEach(function(t){if(beforeIds[t.id])return;t.tapIn=t.realIn||new Date(tap).toISOString();if(chk&&chk.early){t.earlyStart=true;t.earlyReason=chk.reason;}});}
function idsNow(){var m={};(DB.time||[]).forEach(function(t){m[t.id]=1;});return m;}
function wrapAct(name,pid){var o=ACT[name];if(!o)return;ACT[name]=function(){var chk=earlyCheck(pid);if(!chk.ok){toast('That start is earlier than now. Add a short reason under “Started earlier?”, or pick '+hmOf(+document.getElementById(pid).dataset.floor)+'.');return;}
  PAGE_STATE.mfEarly=chk;var b=idsNow(),tap=Date.now(),r=o.apply(this,arguments);if(Object.keys(idsNow()).length!==Object.keys(b).length){stampNew(b,chk,tap);save();PAGE_STATE.mfEarly=null;}return r;};}
wrapAct('clockin2','qIn');wrapAct('crewinall','qCrewIn');
/* docbypass: clock-in finishes after the "still needed" modal -> stamp there too */
if(typeof doClockIn==='function'){var _dc=doClockIn;doClockIn=function(){var b=idsNow(),r=_dc.apply(this,arguments),chk=PAGE_STATE.mfEarly||null;if(Object.keys(idsNow()).length!==Object.keys(b).length){stampNew(b,chk,Date.now());save();}PAGE_STATE.mfEarly=null;return r;};}
/* flag = chosen start earlier than the quarter hour of the real tap */
function tapMs(t){var s=t.tapIn||t.realIn;return s?new Date(s).getTime():null;}
function startMs(t){if(t.inMs)return +t.inMs;try{var p=parseD(t.date);p.setHours(+t.in.slice(0,2),+t.in.slice(3,5),0,0);return p.getTime();}catch(e){return null;}}
function isEarly(t){var a=tapMs(t),s=startMs(t);if(a==null||s==null||!t.in)return false;return s<Math.floor(a/QMS)*QMS;}
window.mfIsEarly=isEarly;
var BADGE='Start earlier than tap time';
(function(){var or=VIEWS['admin:review'];if(!or)return;VIEWS['admin:review']=function(){var x=or.apply(this,arguments);
  var lim=addDays(today(),-14),L=(DB.time||[]).filter(function(t){return !t.test&&t.date>=lim&&isEarly(t);}).sort(function(a,b){return (b.date+b.in)<(a.date+a.in)?-1:1;});
  if(!L.length)return x;
  var card='<div class="card mf-early-card" id="mfearly"><h2 style="margin-top:0">Clock-ins with a start earlier than the tap <span class="pill s-warn">'+L.length+'</span></h2><p class="small muted">The start time chosen is before the quarter hour when the person (or crew lead) actually tapped. Check it before approving hours.</p><div class="tw"><table class="mf-early-tbl"><tr><th>Day</th><th>Site</th><th>Worker</th><th>Chosen start</th><th>Real tap time</th><th>Reason</th></tr>'+
    L.map(function(t){var u=user(t.userId);return '<tr data-id="'+esc(t.id)+'"><td>'+shortDay(t.date)+'</td><td>'+esc(t.site||'')+'</td><td>'+esc(u?u.name:'?')+(t.crewClock?'<div class="small muted">clocked by crew lead '+esc(t.clockedByName||'')+'</div>':'')+'</td><td><b>'+esc(t.in)+'</b> <span class="pill s-warn mf-badge">'+BADGE+'</span></td><td>'+hmOf(tapMs(t))+'</td><td>'+(t.earlyReason?esc(t.earlyReason):'<span class="muted">none given</span>')+'</td></tr>';}).join('')+'</table></div></div>';
  var at=x.indexOf('</h1>');return at>=0?x.slice(0,at+5)+card+x.slice(at+5):card+x;};})();

/* ---------- 3) Farm billing by day: most active client first ---------- */
if(typeof mwState==='function'&&typeof mwFarms==='function'){var _ms=mwState;mwState=function(){var st=PAGE_STATE.mwb=PAGE_STATE.mwb||{};
  if(!st.mfPicked&&!st.firmId){var fs=mwFarms(),from=st.from||weekStart(today()),to=st.to||addDays(from,6),best=null,bv=0;
    var score=function(f,a,b){try{var R=firmReport(f,a,b);return (R.rows||[]).reduce(function(s,r){return s+(+r.amount||0)+(+r.bill||0)/1000;},0);}catch(e){return 0;}};
    fs.forEach(function(f){var v=score(f,from,to);if(v>bv){bv=v;best=f;}});
    if(!best){var a=addDays(today(),-30);fs.forEach(function(f){var v=score(f,a,today());if(v>bv){bv=v;best=f;}});}
    if(best)st.firmId=best.id;st.mfPicked=true;}
  return _ms.apply(this,arguments);};}

/* ---------- 4) crew order reply depends on lead time ---------- */
function daysAhead(d){if(!/^\d{4}-\d{2}-\d{2}$/.test(d||''))return 0;return Math.round((parseD(d).getTime()-parseD(today()).getTime())/86400000);}
var FAR='The office will confirm within 1 business day. ';
window.MF_ORD_DATE=null;
if(typeof ordReplyBox==='function'){var _orb=ordReplyBox;ordReplyBox=function(id,when){var d=window.MF_ORD_DATE;if(d&&daysAhead(d)>2)return '<div class="ordreply"'+(id?' id="'+id+'"':'')+'><span aria-hidden="true">🕑</span> <span>'+FAR+ORDER_REPLY_URGENT+'</span></div>';return _orb.apply(this,arguments);};}
if(typeof ordCardClient==='function'){var _occ=ordCardClient;ordCardClient=function(o){var keep=window.MF_ORD_DATE;try{window.MF_ORD_DATE=(ordView(o)||{}).date||null;return _occ.apply(this,arguments);}finally{window.MF_ORD_DATE=keep;}};}
['crewOrder'].forEach(function(k){var of=FORMS[k];if(!of)return;FORMS[k]=function(form,d){var keep=window.MF_ORD_DATE;window.MF_ORD_DATE=(d&&(d.date||d.from))||null;try{return of.apply(this,arguments);}finally{window.MF_ORD_DATE=keep;}};});
function fixFormReply(){var box=document.getElementById('ordreplyform');if(!box)return;var f=box.closest('form'),di=f&&f.querySelector('input[name="date"]');var d=di&&di.value;
  var sp=box.querySelector('span:last-child');if(!sp)return;var want=d&&daysAhead(d)>2?FAR+ORDER_REPLY_URGENT:ORDER_REPLY_HTML;if(sp.innerHTML!==want)sp.innerHTML=want;}
document.addEventListener('input',function(e){if(e.target&&e.target.name==='date')fixFormReply();},true);
document.addEventListener('change',function(e){if(e.target&&e.target.name==='date')fixFormReply();},true);

/* ---------- 5) small fixes ---------- */
/* worker count starts at 1 on a new order */
if(typeof ofCrewBlock==='function'){var _ocb=ofCrewBlock;ofCrewBlock=function(firm,f,o){if(!(o&&o.office)&&f&&!(+f.workers)&&!(f.crew&&f.crew.length)){f=Object.assign({},f,{workers:1});}return _ocb.call(this,firm,f,o);};}
/* time lists: 04:00–22:00 (+ the saved value) */
if(typeof qSel==='function'&&typeof qTimes==='function'){qSel=function(name,label,val,o){o=o||{};var all=qTimes(),l=all.filter(function(t){var v=typeof t==='string'?t:(t&&t[0]);return v>='04:00'&&v<='22:00';});
  if(val&&l.every(function(t){return (typeof t==='string'?t:t[0])!==val;})){l.push(val);l.sort();}var id='qs-'+name;
  return '<div><label for="'+id+'" class="'+(o.req?'req':'')+'">'+esc(label)+'</label><select id="'+id+'" name="'+name+'"'+(o.req?' required':'')+'>'+(o.blank?'<option value="">'+esc(o.blank)+'</option>':'')+opt(l,val||'')+'</select>'+(o.hint?'<div class="hint">'+o.hint+'</div>':'')+'</div>';};}
/* labels linked to inputs + order reply + tour card placement, after every DOM change */
var N=0,busy=false;
function linkLabels(root){[].forEach.call((root||document).querySelectorAll('label:not([for])'),function(l){if(l.querySelector('input,select,textarea'))return;
  var c=l.nextElementSibling;if(!c||!/^(INPUT|SELECT|TEXTAREA)$/.test(c.tagName)||c.type==='hidden'||c.type==='radio'||c.type==='checkbox')return;if(!c.id)c.id='mf-f-'+(c.name||'x').replace(/[^\w-]/g,'')+'-'+(++N);l.htmlFor=c.id;});}
function fixTour(){var o=document.getElementById('dltour');if(!o)return;var hl=o.querySelector('.dlt-hl'),card=o.querySelector('.dlt-card');if(!hl||!card||hl.style.display==='none')return;
  var a=hl.getBoundingClientRect(),c=card.getBoundingClientRect(),vh=window.innerHeight;if(c.bottom<=a.top||c.top>=a.bottom)return;
  var ch=c.height,below=a.bottom+8,above=a.top-8-ch;
  if(below+ch<=vh)card.style.top=below+'px';else if(above>=4)card.style.top=above+'px';
  else{var dy=a.top-70;window.scrollBy(0,dy);hl.style.top=(parseFloat(hl.style.top)-dy)+'px';var nb=a.bottom-dy+8;card.style.top=nb+'px';card.style.maxHeight=Math.max(140,vh-nb-6)+'px';card.style.overflowY='auto';}}
function post(){busy=false;try{linkLabels();}catch(e){}try{fixFormReply();}catch(e){}try{fixTour();}catch(e){}}
function sched(){if(busy)return;busy=true;setTimeout(post,30);}
function boot(){try{new MutationObserver(sched).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['style']});}catch(e){}sched();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
window.addEventListener('resize',sched);
})();
