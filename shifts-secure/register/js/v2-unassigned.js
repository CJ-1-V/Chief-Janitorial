/* v2-unassigned.js – unassigned1 (owner Oct 18 2026, 10:38 / 10:40 / 10:43 PM). TEST COPY.
   "Just give the office a way to enter a shift in the farms under manual entry where the shift is counted but the person who was at
    that shift can be selected later … keep it red … For office give the option to use suggestions by looking at no. of people punched in."
   "Give office a way to add nickname to that shift until the person is chosen."
   "turn the notifications on the farms yellow where it says possible missing log ins when the no. of people are all added but actual
    employees are missing."
   - UNASSIGNED SHIFT = a manual time entry (DB.time / reg_time_entries) with  unassigned:true  and a placeholder person id
     userId = 'ua-<entry id>' (no account has that id). Optional nickname (uaNick, e.g. "Tall guy in blue") and office note.
     All hours → open a farm box → "+ Add manual entry" → Worker: "Person: pick later (unassigned)". Date, start, finish, break
     (30 min over 5 h, 60 min at 8 h or more – the normal rule), nickname, note.
   - COUNTS for the farm: hours, money, invoices, daily / weekly totals, the 5-hour minimum, the box people counts and the daily
     headcount (each unassigned shift = one person, shown to the farm as an ordinary "Worker #n" – never the word "unassigned").
     NOT counted for payroll / Wagepoint / worker hours (there is no person yet).
   - Shown RED: "Unassigned: <nickname>, add person" with "Assign person" and "Nickname" buttons; red "N unassigned" on the farm box
     and the day. Assign = pick an approved worker / employee → it becomes that person's normal manual entry (from then on it counts
     for payroll), who / when and the nickname are kept in the entry's history and the audit log.
   - SUGGESTIONS (opened farm / day): highest crew reported at clock-in / clock-out (clockboxes1 rule) higher than the people in the
     app → "Suggested: N missing shifts, usually 07:00–15:00" → "Add N unassigned shifts" (review each one, nickname optional) or
     "Dismiss" (kept in settings until a higher number is reported).
   - "Possibly missing" alert has 3 states: RED = still missing; YELLOW = "All N counted, X need a person" (enough unassigned
     shifts were added); normal = complete and assigned. All hours boxes + opened farm, and Clocked in right now (today's
     unassigned shifts at that site count there too).
   - Who: same as Manual hours (Owner / Admin / Billing (payroll)). Others see the red shifts but no buttons. Office Assistant: codes only.
   Live switch: store-config  unassignedShifts: false  (turn on after 019a). Load after v2-mtinall.js, before v2-keepscroll.js. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function LIVE(){return !!window.REG_LIVE;}
function ON(){return !LIVE()||!!(window.REG_STORE&&window.REG_STORE.unassignedShifts);}
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
var MT_ROLES=['owner','admin','payroll','billing'];
function can(){if(window.MT_OFF)return false;if(typeof mtCan==='function')return mtCan();var u=typeof ME!=='undefined'&&ME;if(!u||u.type!=='admin'||window.MT_OFF)return false;return MT_ROLES.indexOf(u.officeRole)>=0||(typeof officeRoleOf==='function'&&MT_ROLES.indexOf(officeRoleOf(u))>=0)||(u.officeRoles||[]).some(function(r){return MT_ROLES.indexOf(r)>=0;});}
function isUA(t){return !!(t&&t.unassigned===true);}
function live(t){return t&&!t.test&&!t.removed;}
function uaList(){return (DB.time||[]).filter(function(t){return isUA(t)&&live(t);});}
function siteOfT(t){if(t.site)return t.site;var sh=t.shiftId&&(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return sh&&sh.site||'';}
function byId(id){return (DB.time||[]).filter(function(t){return t.id===id;})[0]||null;}
function label(t){return 'Unassigned'+(t.uaNick?': '+t.uaNick:'')+', add person';}
function farmOf(code){return typeof firmOfSite==='function'?firmOfSite(code):null;}
function siteLabel(code){var f=farmOf(code);return code+(f&&!helper()?' – '+(f.realName||f.name):'');}
function nowIso(){return new Date().toISOString();}

/* ---------- 1. counting: a stand-in "person" per unassigned shift, only while farm totals / All hours / headcount are worked out ---------- */
var DEPTH=0,ADDED=[];
function vuser(t){return {id:t.userId,type:'unassigned',name:(typeof ME!=='undefined'&&ME&&ME.type==='admin')?label(t):'Worker',virtual:true,active:true,approved:true,accountApproved:true,profile:{},roles:[],orientations:[],jobRole:'labour',company:{}};}
function withV(fn,self,args){if(DEPTH===0){var have={};(DB.users||[]).forEach(function(u){have[u.id]=1;});
    ADDED=(DB.time||[]).filter(function(t){return isUA(t)&&!t.test&&t.userId&&!have[t.userId];}).map(vuser);if(ADDED.length)DB.users=DB.users.concat(ADDED);}
  DEPTH++;try{return fn.apply(self,args);}finally{DEPTH--;if(DEPTH===0&&ADDED.length){var a=ADDED;DB.users=DB.users.filter(function(u){return a.indexOf(u)<0;});ADDED=[];}}}
function wrapG(name){var o=window[name];if(typeof o!=='function')return;window[name]=function(){return withV(o,this,arguments);};}
wrapG('firmRows');wrapG('firmReport');
function deLink(x){return typeof x!=='string'?x:x.replace(/<a href="#" data-act="person" data-id="(ua-[^"]*)">([^<]*)<\/a>/g,'<span class="ua-name">$2</span>');}
['admin:allhours','admin:headcount','admin:people','firm:home','firm:invoices'].forEach(function(k){var o=VIEWS[k];if(typeof o!=='function')return;VIEWS[k]=function(){return deLink(withV(o,this,arguments));};});

/* ---------- 2. "Person: pick later (unassigned)" in the Add manual entry window ---------- */
function decorateForm(){var m=document.getElementById('miamodal');if(!m||!ON()||!can())return;var f=m.querySelector('form[data-form=manualtime]');if(!f||f.dataset.ua)return;
  var w=f.querySelector('select[name=wid]');if(!w)return;f.dataset.ua='1';
  var o=document.createElement('option');o.value='__ua';o.textContent='Person: pick later (unassigned)';o.className='ua-opt';w.insertBefore(o,w.children[1]||null);
  var box=document.createElement('div');box.className='ua-nickrow';box.hidden=true;
  box.innerHTML='<label for="uanick">Nickname (optional – until the person is chosen)</label><input type="text" name="uaNick" id="uanick" maxlength="60" placeholder="e.g. Tall guy in blue">'+
    '<p class="small ua-hint">Counts for the farm (hours, invoice) right away; not for payroll until you assign the person. Shown in red until then.</p>';
  var wf=w.closest('div');wf.parentNode.insertBefore(box,wf.nextSibling);
  w.addEventListener('change',function(){var u=w.value==='__ua';box.hidden=!u;var r=f.querySelector('select[name=reason]');if(r){r.required=!u;var rd=r.closest('div');if(rd)rd.hidden=u;}});}
function check(d){var E1=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))E1.push('Pick the shift date.');else if(!officeAnyTime()&&d.date>today())E1.push('The date cannot be in the future.');
  var sites=(typeof companySites==='function'?companySites({withFirm:true,skipPractice:true,activeOnly:true}):(DB.sites||[]).filter(function(s){return s.firmId;}));
  if(!sites.some(function(s){return s.code===d.site;}))E1.push('Pick a site.');
  if(!quarterOk(d['in'])||!quarterOk(d.out))E1.push('Use quarter-hour times (:00, :15, :30, :45).');else if(spanErr(d['in'],d.out))E1.push(spanErr(d['in'],d.out));
  else if(!E1.length&&!officeAnyTime()&&hmMsLocal(d.date,d['in'])+hrs(d['in'],d.out)*3600000>Date.now())E1.push('This shift would end in the future. Hours can only be added after they are worked.');
  return E1;}
function make(d,src,extra){var id=uid('t'),now=nowIso(),nick=String(d.uaNick||'').trim().slice(0,60),note=String(d.note||'').trim().slice(0,300);
  var t={id:id,userId:'ua-'+id,unassigned:true,uaNick:nick,site:d.site,shiftId:null,role:'labour',date:d.date,'in':d['in'],out:d.out,clock:false,manual:true,manualSource:src||'office',
    manualReason:'unassigned',manualNote:note,manualBy:ME.id,manualByName:ME.name,manualAt:now,addedAt:now,daysLate:daysBetween(d.date,today()),breakMissed:d.brk==='none',test:false,note:'',lateEntry:'',
    manualHistory:[{at:now,by:ME.name,action:'added',reason:'Unassigned shift (person to be chosen later)'+(nick?' – nickname "'+nick+'"':'')+(note?' – '+note:'')}]};
  if(extra)Object.keys(extra).forEach(function(k){t[k]=extra[k];});(DB.time=DB.time||[]).push(t);return t;}
function invNote(site,date){var f=farmOf(site);if(!f)return '';var i=(DB.clientInvoices||[]).filter(function(x){return x.firmId===f.id&&!x.uploaded&&x.periodStart&&x.periodStart<=date&&date<=(x.periodEnd||x.periodStart);})[0];
  return i?' Invoice '+i.number+' already covers this date – it is not changed.':'';}
(function(){var of=FORMS.manualtime;if(!of)return;FORMS.manualtime=function(f,d){if(!(d&&d.wid==='__ua'&&d.mode!=='bulk'))return of.apply(this,arguments);
  if(!ON()||!can()){toast('Only the Owner, an Admin or Payroll (billing) can add manual hours.');return;}
  var er=check(d);if(er.length){toast(er[0]);var w=f.querySelector('#mtwarn');if(w)w.innerHTML='<div class="alert bad small">'+E(er[0])+'</div>';return;}
  var t=make(d,'office');audit('Added unassigned shift (person to be chosen later)',siteLabel(t.site),t.date+' '+t['in']+'–'+t.out+(t.uaNick?' · nickname "'+t.uaNick+'"':'')+(t.manualNote?' · '+t.manualNote:''));
  save();closeModal();toast('Unassigned shift added – it counts for the farm. Assign the person when you know who.'+invNote(t.site,t.date));render();};})();

/* ---------- 3. assign a person / nickname ---------- */
function people(site){var f=farmOf(site),codes=f?(DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;}):[site],from=addDays(today(),-30),seen={},rec=[];
  var P=(DB.users||[]).filter(function(u){return (u.type==='worker'||u.type==='employee')&&u.accountApproved!==false&&u.active!==false&&!u.virtual;});
  (DB.time||[]).forEach(function(t){if(t.test||seen[t.userId]||codes.indexOf(siteOfT(t))<0||t.date<from)return;var u=P.filter(function(x){return x.id===t.userId;})[0];if(u){seen[u.id]=1;rec.push(u);}});
  var g={};P.forEach(function(u){var k=u.type==='employee'?'UnScramble employees':'Subcontractor workers – '+employerName(u);(g[k]=g[k]||[]).push(u);});
  return {rec:rec.sort(function(a,b){return a.name<b.name?-1:1;}),groups:g};}
ACT.uaassign=function(el){var t=byId(el.dataset.id);if(!t||!isUA(t))return;if(!ON()||!can()){toast('Only the Owner, an Admin or Payroll (billing) can assign.');return;}var P=people(siteOfT(t)),fN=farmOf(siteOfT(t));
  var busy=function(u){try{return !!overlapsAny(u.id,t.date,t['in'],t.out,t.id);}catch(e){return false;}};
  var opt=function(u){var b=busy(u);return '<option value="'+E(u.id)+'"'+(b?' disabled':'')+'>'+E(u.name)+(b?' – already has hours then':'')+'</option>';};
  modal('<div id="uaassignbox"><h2>Assign a person</h2><p><span class="ua-pill">'+E(label(t))+'</span></p><p>'+E(siteLabel(siteOfT(t)))+' · '+E(t.date)+' · '+E(t['in'])+'–'+E(t.out)+plus1(t['in'],t.out)+'</p>'+
    '<form data-form="uaassignok"><input type="hidden" name="id" value="'+E(t.id)+'"><label class="req" for="uawho">Who worked this shift?</label><select name="who" id="uawho" required><option value="">– choose –</option>'+
    (P.rec.length?'<optgroup label="Worked at '+E(fN&&!helper()?(fN.realName||fN.name):siteOfT(t))+' (last 30 days)">'+P.rec.map(opt).join('')+'</optgroup>':'')+
    Object.keys(P.groups).sort().map(function(k){return '<optgroup label="'+E(k)+'">'+P.groups[k].sort(function(a,b){return a.name<b.name?-1:1;}).map(opt).join('')+'</optgroup>';}).join('')+'</select>'+
    '<div id="uawarn"></div><div class="ua-confirm" hidden><label class="inline"><input type="checkbox" name="ok" value="1"> <b>I checked this – assign anyway</b></label></div>'+
    '<p class="small muted">It becomes this person\'s normal manual entry: it then counts for their hours and payroll. The nickname is kept in the history.</p>'+
    '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="uaassigngo">Assign</button></div></form></div>');};
FORMS.uaassignok=function(f,d){var t=byId(d.id);if(!t||!isUA(t))return;if(!ON()||!can())return;var u=user(d.who);if(!u||u.virtual||(u.type!=='worker'&&u.type!=='employee')){toast('Pick the person.');return;}
  if(overlapsAny(u.id,t.date,t['in'],t.out,t.id)){var m=u.name+' already has hours that overlap '+t.date+' '+t['in']+'–'+t.out+'.';f.querySelector('#uawarn').innerHTML='<div class="alert bad small">'+E(m)+'</div>';toast(m);return;}
  var W=[];var ex=u.type==='employee'&&(DB.payExports||[]).filter(function(x){return x.start<=t.date&&t.date<=x.end;})[0];if(ex)W.push('The pay period '+ex.start+' to '+ex.end+' was already exported for Wagepoint – these hours must be added in Wagepoint too.');
  if(u.active===false)W.push(u.name+' is switched off.');
  if(W.length&&!d.ok){f.querySelector('#uawarn').innerHTML='<div class="alert warn small"><ul>'+W.map(function(w){return '<li>'+E(w)+'</li>';}).join('')+'</ul></div>';f.querySelector('.ua-confirm').hidden=false;toast('Please read the warning and tick the box.');return;}
  var now=nowIso(),nick=t.uaNick||'';t.userId=u.id;delete t.unassigned;if(u.subId)t.subId=u.subId;else delete t.subId;t.role=typeof jobRoleOf==='function'?jobRoleOf(u):t.role;
  t.uaAssigned={at:now,by:ME.name,byId:ME.id,nick:nick};delete t.uaNick;if(ex)t.afterExport=true;
  (t.manualHistory=t.manualHistory||[]).push({at:now,by:ME.name,action:'person assigned',reason:'Assigned to '+u.name+(nick?' (was "Unassigned: '+nick+'")':' (was unassigned)')});
  audit('Assigned person to unassigned shift',u.name,siteLabel(siteOfT(t))+' · '+t.date+' '+t['in']+'–'+t.out+(nick?' · nickname was "'+nick+'"':''));save();closeModal();toast('Assigned to '+u.name+'. It now counts for their hours and payroll.');render();};
ACT.uanick=function(el){var t=byId(el.dataset.id);if(!t||!isUA(t)||!ON()||!can())return;
  modal('<div id="uanickbox"><h2>Nickname for this shift</h2><p>'+E(siteLabel(siteOfT(t)))+' · '+E(t.date)+' · '+E(t['in'])+'–'+E(t.out)+'</p><form data-form="uanickok"><input type="hidden" name="id" value="'+E(t.id)+'"><label for="uanick2">Nickname (until the person is chosen)</label><input type="text" name="nick" id="uanick2" maxlength="60" value="'+E(t.uaNick||'')+'" placeholder="e.g. Tall guy in blue"><div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="uanickgo">Save</button></div></form></div>');};
FORMS.uanickok=function(f,d){var t=byId(d.id);if(!t||!isUA(t)||!ON()||!can())return;var old=t.uaNick||'',n=String(d.nick||'').trim().slice(0,60);if(n===old){closeModal();return;}t.uaNick=n;
  (t.manualHistory=t.manualHistory||[]).push({at:nowIso(),by:ME.name,action:'nickname',reason:'Nickname: '+(old?'"'+old+'"':'(none)')+' → '+(n?'"'+n+'"':'(none)')});
  audit('Changed nickname of unassigned shift',siteLabel(siteOfT(t)),t.date+' '+t['in']+'–'+t.out+' · '+(old||'(none)')+' → '+(n||'(none)'));save();closeModal();render();};
ADMIN_ONLY_ACT.push('uaassign','uanick','uasugadd','uasugdis');ADMIN_ONLY_FORM.push('uaassignok','uanickok','uasugok');

/* ---------- 4. red rows, badges, 3-state alert ---------- */
function btns(t){return ON()&&can()?'<div class="ua-btns"><button class="small ua-assign" data-act="uaassign" data-id="'+E(t.id)+'">Assign person</button><button class="small sec" data-act="uanick" data-id="'+E(t.id)+'">'+(t.uaNick?'Edit nickname':'Nickname')+'</button></div>':'';}
function cell(t){return '<b class="ua-name">'+E(label(t))+'</b><div class="small ua-sub">Counts for the farm · not for payroll yet</div>'+btns(t);}
function crewMax(date,site){var mx=0;(DB.time||[]).forEach(function(t){if(!live(t)||t.date!==date||siteOfT(t)!==site)return;if(+t.crewIn>0)mx=Math.max(mx,+t.crewIn);if(+t.crew>0&&t.out)mx=Math.max(mx,+t.crew);});return mx;}
function uaOn(date,site){return uaList().filter(function(t){return t.date===date&&siteOfT(t)===site;});}
function yellowTxt(mx,x){return 'All '+mx+' counted, '+x+' need'+(x===1?'s':'')+' a person';}
function decorate(){var main=document.getElementById('app');if(!main)return;
  /* rows: All hours table + manual entries lists */
  [].forEach.call(document.querySelectorAll('#vshtable tr[data-key^="t:"]:not([data-ua])'),function(tr){tr.setAttribute('data-ua','0');var t=byId(tr.getAttribute('data-key').slice(2));if(!isUA(t))return;tr.setAttribute('data-ua','1');tr.classList.add('ua-row');if(tr.cells[0])tr.cells[0].innerHTML=cell(t);});
  [].forEach.call(document.querySelectorAll('#mtlist tr[data-id]:not([data-ua])'),function(tr){tr.setAttribute('data-ua','0');var t=byId(tr.getAttribute('data-id'));if(!isUA(t))return;tr.setAttribute('data-ua','1');tr.classList.add('ua-row');if(tr.cells[0])tr.cells[0].innerHTML=cell(t);});
  /* Office Assistant: farm codes only – also in the manual entries list (it showed "CODE – Farm name") */
  if(helper())[].forEach.call(document.querySelectorAll('#mtlist tr[data-id]:not([data-uah])'),function(tr){tr.setAttribute('data-uah','1');var c=tr.cells[1];if(c&&/ – /.test(c.textContent))c.textContent=c.textContent.split(' – ')[0];});
  /* All hours boxes */
  [].forEach.call(document.querySelectorAll('#hbwrap [data-hb]:not([data-uab])'),function(b){b.setAttribute('data-uab','1');var p=b.getAttribute('data-hb').split('|'),d=p[0],s=p.slice(1).join('|'),U=uaOn(d,s).length,mx=crewMax(d,s),red=b.querySelector('.cb-badge');
    var yel=!red&&U&&mx>0;
    if(U)b.insertAdjacentHTML('beforeend','<span class="ua-badge">'+U+(yel?' need'+(U===1?'s':'')+' a person':' unassigned')+'</span>');
    if(yel){b.insertAdjacentHTML('afterbegin','<span class="cb-badge ua-yellow" title="'+E(yellowTxt(mx,U))+'">✓ all in</span>');b.classList.add('ua-box-y');}
    else if(red)b.classList.add('ua-box-r');});
  [].forEach.call(document.querySelectorAll('#hbwrap .hb-day:not([data-uad])'),function(sec){sec.setAttribute('data-uad','1');var b=sec.querySelector('[data-hb]');if(!b)return;var d=b.getAttribute('data-hb').split('|')[0],U=uaList().filter(function(t){return t.date===d;}).length;
    if(U){var h=sec.querySelector('h3');if(h)h.insertAdjacentHTML('beforeend',' <span class="ua-daypill">'+U+' unassigned</span>');}});
  /* opened farm / day: alert state + suggestion */
  var w=document.getElementById('hbwrap'),sel=PAGE_STATE.hb&&PAGE_STATE.hb.sel;
  if(w&&sel&&w.querySelector('.cb-head')&&!w.dataset.uao){w.dataset.uao='1';var p=String(sel).split('|'),d=p[0],s=p.slice(1).join('|'),U=uaOn(d,s).length,st=w.querySelector('.cs-st');
    if(st&&st.classList.contains('cs-ok')&&U){st.className='cs-st cs-warn ua-yellow-st';st.innerHTML=E(yellowTxt(crewMax(d,s),U))+' – tap “Assign person” on the red shifts.';}
    else if(st&&st.classList.contains('cs-bad')&&U)st.insertAdjacentHTML('beforeend',' <span class="small">('+U+' unassigned already counted)</span>');
    else if(!st&&U){var cs=w.querySelector('.cs-sum');if(cs)cs.insertAdjacentHTML('beforeend','<div class="cs-st cs-warn ua-yellow-st">'+U+' unassigned shift'+(U===1?'':'s')+' – assign the person.</div>');}
    sugCard(w,d,s);}
  /* Clocked in right now (sheet) */
  var ci=document.getElementById('ciSheet');if(ci){[].forEach.call(ci.querySelectorAll('[data-cb]:not([data-uab])'),function(b){b.setAttribute('data-uab','1');ciBox(b,b.getAttribute('data-cb'));});
    var hd=ci.querySelector('.cb-head');if(hd&&!hd.dataset.uab){hd.dataset.uab='1';var k=(hd.querySelector('.cb-code')||{}).textContent||'';ciSum(ci,k);}}}
/* clocked in: reported crew today/yesterday vs people on shift + today's unassigned shifts at that site */
function ciMax(k){var y=addDays(today(),-1),mx=0;(DB.time||[]).forEach(function(t){if(!live(t)||t.site!==k||t.date<y||t.date>today())return;if(+t.crewIn>0)mx=Math.max(mx,+t.crewIn);if(+t.crew>0&&t.out)mx=Math.max(mx,+t.crew);});return mx;}
function ciState(k,n){var U=uaOn(today(),k).length,mx=ciMax(k);if(!mx)return {s:'none',U:U,mx:mx};var miss=mx-(n+U);return {s:miss>0?'red':U?'yellow':'ok',miss:miss,U:U,mx:mx};}
function ciBox(b,k){var n=+((b.querySelector('.cb-n')||{}).textContent||0),c=ciState(k,n),old=b.querySelector('.cb-badge');if(!c.U)return;if(old)old.remove();
  if(c.s==='red')b.insertAdjacentHTML('afterbegin','<span class="cb-badge" title="Crew reported is higher than clocked in + unassigned shifts">+'+c.miss+'?</span>');
  else if(c.s==='yellow'){b.insertAdjacentHTML('afterbegin','<span class="cb-badge ua-yellow" title="'+E(yellowTxt(c.mx,c.U))+'">✓ all in</span>');b.classList.add('ua-box-y');}
  b.insertAdjacentHTML('beforeend','<span class="ua-badge">'+c.U+' unassigned today</span>');}
function ciSum(ci,k){var st=ci.querySelector('.cs-st');if(!st)return;var n=0;ci.querySelectorAll('.ci-row').forEach(function(){n++;});var c=ciState(k,n);if(!c.U)return;
  st.insertAdjacentHTML('beforebegin','<div>Unassigned shifts added today: <b>'+c.U+'</b></div>');
  if(c.s==='red'){st.className='cs-st cs-bad';st.innerHTML='Possibly missing: <b>'+c.miss+'</b>';}else if(c.s==='yellow'){st.className='cs-st cs-warn ua-yellow-st';st.textContent=yellowTxt(c.mx,c.U);}}

/* ---------- 5. suggestions ---------- */
function mode(L){var c={},best='',n=0;L.forEach(function(v){if(!v)return;c[v]=(c[v]||0)+1;if(c[v]>n||(c[v]===n&&v<best)){best=v;n=c[v];}});return best;}
function q15(v){if(!/^\d{2}:\d{2}$/.test(v||''))return v;var m=+v.slice(0,2)*60+ +v.slice(3);m=Math.round(m/15)*15%1440;return pad(Math.floor(m/60))+':'+pad(m%60);}
function sug(d,s,miss){var L=(DB.time||[]).filter(function(t){return live(t)&&t.date===d&&siteOfT(t)===s;});
  var mx=crewMax(d,s);miss=+miss||0;if(miss<=0||!mx)return null;var dis=((DB.settings||{}).uaDismiss||{})[s+'|'+d];if(dis&&+dis.max>=mx)return null;
  var R=L.filter(function(t){return !isUA(t)&&t.out;});var a=q15(mode(R.map(function(t){return t['in'];})))||'07:00',b=q15(mode(R.map(function(t){return t.out;})))||'15:00';
  if(spanErr(a,b))b=q15(addMin(a,480));return {n:miss,mx:mx,ppl:Math.max(0,mx-miss),'in':a,out:b};}
function addMin(hm,m){var x=(+hm.slice(0,2)*60+ +hm.slice(3)+m)%1440;return pad(Math.floor(x/60))+':'+pad(x%60);}
function boxMiss(w){var b=w.querySelector('.cs-st.cs-bad b');return b?+b.textContent||0:0;}
function sugCard(w,d,s){if(!ON()||!can()||document.getElementById('uasug'))return;var g=sug(d,s,boxMiss(w));if(!g)return;var anchor=w.querySelector('.cs-sum')||w.querySelector('.cb-head');if(!anchor)return;
  anchor.insertAdjacentHTML('afterend','<div class="card ua-sug" id="uasug"><b>Suggested: '+g.n+' missing shift'+(g.n===1?'':'s')+'</b><div class="small">Crew reported: <b>'+g.mx+'</b> · counted now: <b>'+g.ppl+'</b> · usual time that day: <b>'+E(g['in'])+'–'+E(g.out)+'</b></div>'+
    '<div class="row ua-sugbtns"><button class="small" data-act="uasugadd" data-d="'+E(d)+'" data-s="'+E(s)+'" data-n="'+esc(g.n)+'">Add '+g.n+' unassigned shift'+(g.n===1?'':'s')+'</button><button class="small sec" data-act="uasugdis" data-d="'+E(d)+'" data-s="'+E(s)+'" data-n="'+esc(g.n)+'">Dismiss</button></div></div>');}
function tsel(name,val){var x='';for(var m=0;m<1440;m+=15){var v=pad(Math.floor(m/60))+':'+pad(m%60);x+='<option value="'+v+'"'+(v===val?' selected':'')+'>'+v+'</option>';}return '<select name="'+name+'" class="ua-t" aria-label="'+name+'">'+x+'</select>';}
ACT.uasugadd=function(el){if(!ON()||!can())return;var d=el.dataset.d,s=el.dataset.s,g=sug(d,s,el.dataset.n);if(!g){toast('Nothing to add any more.');return;}var rows='';
  for(var i=0;i<g.n;i++)rows+='<tr><td>#'+(i+1)+'</td><td><input type="text" name="nick'+i+'" maxlength="60" placeholder="Nickname (optional)" aria-label="Nickname '+(i+1)+'"></td><td>'+tsel('in'+i,g['in'])+'</td><td>'+tsel('out'+i,g.out)+'</td><td><select name="brk'+i+'" aria-label="break"><option value="taken">Break taken</option><option value="none">No break</option></select></td></tr>';
  modal('<div id="uasugbox"><h2>Add '+g.n+' unassigned shift'+(g.n===1?'':'s')+'</h2><p>'+E(siteLabel(s))+' · '+E(d)+' · crew reported '+g.mx+', counted now '+g.ppl+'.</p><p class="small muted">Check the times (taken from that day\'s punches), give a nickname if you know one, then confirm. They count for the farm now and turn into normal entries when you assign the person.</p>'+
    '<form data-form="uasugok"><input type="hidden" name="d" value="'+E(d)+'"><input type="hidden" name="s" value="'+E(s)+'"><input type="hidden" name="n" value="'+esc(g.n)+'"><div class="tw"><table class="ua-sugtab"><tr><th></th><th>Nickname</th><th>Start</th><th>Finish</th><th>Break</th></tr>'+rows+'</table></div>'+
    '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="uasuggo">Confirm – add '+g.n+'</button></div></form></div>');};
FORMS.uasugok=function(f,d){if(!ON()||!can())return;var n=Math.min(50,+d.n||0),made=[],err='';
  for(var i=0;i<n;i++){var x={site:d.s,date:d.d,'in':d['in'+i],out:d['out'+i],brk:d['brk'+i],uaNick:d['nick'+i]};var e=check(x);if(e.length){err='#'+(i+1)+': '+e[0];break;}}
  if(err){toast(err);return;}
  for(var j=0;j<n;j++)made.push(make({site:d.s,date:d.d,'in':d['in'+j],out:d['out'+j],brk:d['brk'+j],uaNick:d['nick'+j]},'suggestion',{uaFromSuggestion:true}));
  audit('Added unassigned shifts from suggestion',siteLabel(d.s),d.d+' · '+n+' shift'+(n===1?'':'s')+' · '+made.map(function(t){return t['in']+'–'+t.out+(t.uaNick?' "'+t.uaNick+'"':'');}).join(', '));
  save();closeModal();toast(n+' unassigned shift'+(n===1?'':'s')+' added – assign the people when you know who.'+invNote(d.s,d.d));render();};
ACT.uasugdis=function(el){if(!ON()||!can())return;var d=el.dataset.d,s=el.dataset.s,g=sug(d,s,el.dataset.n);if(!g)return;DB.settings.uaDismiss=DB.settings.uaDismiss||{};DB.settings.uaDismiss[s+'|'+d]={max:g.mx,by:ME.name,at:nowIso()};
  audit('Dismissed missing-shift suggestion',siteLabel(s),d+' · crew reported '+g.mx+', in the app '+g.ppl);save();render();};

/* ---------- 6. owner's invoice view: a quiet note (the farm never sees it) ---------- */
(function(){var ov=ACT.civview;if(!ov)return;ACT.civview=function(el){var r=ov.apply(this,arguments);try{if(!ME||ME.type!=='admin')return r;var i=(DB.clientInvoices||[]).filter(function(x){return x.id===el.dataset.id;})[0];var m=document.querySelector('#modal .modal');if(!i||!m||m.querySelector('.ua-invnote'))return r;
  var codes=(DB.sites||[]).filter(function(s){return s.firmId===i.firmId;}).map(function(s){return s.code;});var U=uaList().filter(function(t){return codes.indexOf(siteOfT(t))>=0&&i.periodStart&&t.date>=i.periodStart&&t.date<=(i.periodEnd||i.periodStart);});
  if(U.length)m.insertAdjacentHTML('beforeend','<div class="alert warn small ua-invnote no-print">Office only: '+U.length+' shift'+(U.length===1?'':'s')+' on this invoice still '+(U.length===1?'has':'have')+' no person (red in All hours). The farm sees '+(U.length===1?'it':'them')+' as a normal Worker # line.</div>');}catch(e){}return r;};})();

new MutationObserver(function(){try{decorateForm();decorate();}catch(e){try{console.warn('[unassigned]',e);}catch(z){}}}).observe(document.documentElement,{childList:true,subtree:true});
})();
