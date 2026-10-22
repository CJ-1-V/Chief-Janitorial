/* v2-dupshift.js – dupshift1 (owner Oct 19 2026, 5:54 PM). TEST COPY.
   "Under the manual hours give me option to add similar shift or shifts with similar hours without them being assigned."
   - All hours → open a farm box: every finished shift row gets a "Same hours" button (next to Edit hours / Remove), and the bar
     gets "+ Add shifts with the same hours". The "+ Add manual entry" window gets a box "Add shifts with the same hours" that uses
     the times just typed.
   - Pick how many (1–30, default 1) and an optional nickname start (e.g. "Extra" → "Extra 1", "Extra 2" …). A check step says
     "Add N unassigned shifts, 07:00–15:30, X h each, total Y h?". Then N UNASSIGNED shifts are added (the same kind as
     unassigned1: manual reg_time_entries rows, unassigned:true, userId 'ua-<id>') – same farm, date, start, finish, break setting.
     Red until a person is assigned; they count for the farm hours / invoice and the possibly-missing alert straight away.
   - Who: same as Manual hours / unassigned shifts (Owner / Admin / Payroll-billing). Same store switch (unassignedShifts).
   - No SQL: same table, same fields, same save path as unassigned1 (019a already live).
   Load after v2-edithours.js. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function ON(){return !window.REG_LIVE||!!(window.REG_STORE&&window.REG_STORE.unassignedShifts);}
var R=['owner','admin','payroll','billing'];
function can(){if(window.MT_OFF||!ON())return false;if(typeof mtCan==='function')return !!mtCan();var u=typeof ME!=='undefined'&&ME;if(!u||u.type!=='admin')return false;
  return R.indexOf(u.officeRole)>=0||(typeof officeRoleOf==='function'&&R.indexOf(officeRoleOf(u))>=0)||(u.officeRoles||[]).some(function(r){return R.indexOf(r)>=0;});}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function farmOf(c){return typeof firmOfSite==='function'?firmOfSite(c):null;}
function siteLabel(c){var f=farmOf(c);return c+(f&&!helper()?' – '+(f.realName||f.name):'');}
function byId(id){return (DB.time||[]).filter(function(t){return String(t.id)===String(id);})[0]||null;}
function siteOf(t){if(t.site)return t.site;var s=(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return s?s.site:'';}
function span(a,b){return a+'–'+b+(typeof plus1==='function'?plus1(a,b):'');}
function paid(a,b,none){var w=hrs(a,b);return Math.max(0,w-unpaidBreak(w,{breakMissed:!!none}));}
function h2(x){return (Math.round(x*100)/100).toFixed(2).replace(/\.00$/,'').replace(/(\.\d)0$/,'$1');}
function brkTxt(a,b,none){if(none)return 'no break';var m=Math.round(unpaidBreak(hrs(a,b),{})*60);return m?m+' min break':'no break (5 h or less)';}
function check(d){var E1=[];if(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||''))E1.push('Pick the shift date.');else if(!officeAnyTime()&&d.date>today())E1.push('The date cannot be in the future.');
  var sites=(typeof companySites==='function'?companySites({withFirm:true,skipPractice:true,activeOnly:true}):(DB.sites||[]).filter(function(s){return s.firmId;}));
  if(!sites.some(function(s){return s.code===d.site;}))E1.push('Pick a farm site.');
  if(!quarterOk(d['in'])||!quarterOk(d.out))E1.push('Use quarter-hour times (:00, :15, :30, :45).');else if(spanErr(d['in'],d.out))E1.push(spanErr(d['in'],d.out));
  else if(!E1.length&&!officeAnyTime()&&hmMsLocal(d.date,d['in'])+hrs(d['in'],d.out)*3600000>Date.now())E1.push('This shift would end in the future. Hours can only be added after they are worked.');
  var n=+d.n;if(!(n>=1&&n<=30&&Math.floor(n)===n))E1.push('How many: a number from 1 to 30.');return E1;}
function nicks(d){var p=String(d.pre||'').trim().slice(0,50),n=+d.n,L=[];if(!p){for(var i=0;i<n;i++)L.push('');return L;}
  var used=0;(DB.time||[]).forEach(function(t){if(t.unassigned&&!t.removed&&t.date===d.date&&siteOf(t)===d.site){var m=new RegExp('^'+p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+' (\\d+)$').exec(t.uaNick||'');if(m)used=Math.max(used,+m[1]);}});
  for(var j=1;j<=n;j++)L.push(p+' '+(used+j));return L;}
/* the window: step 1 = how many, step 2 = check */
function step1(d,err){var none=d.brk==='none',ph=paid(d['in'],d.out,none);
  modal('<div id="dsbox"><h2>Add shifts with the same hours</h2>'+
    '<p><b>'+E(siteLabel(d.site))+'</b> · '+E(d.date)+'</p><p class="ds-times"><b>'+E(span(d['in'],d.out))+'</b> · '+E(brkTxt(d['in'],d.out,none))+' · <b>'+h2(ph)+' h</b> each</p>'+
    (d.fromName?'<p class="small muted">Copied from: '+E(d.fromName)+'</p>':'')+
    '<p class="small ds-hint">The new shifts have <b>no person yet</b>. They show in red. They count for the farm (hours and invoice) now. Tap “Assign person” later.</p>'+
    '<form data-form="dsnext" id="dsform">'+['site','date','brk','fromName'].map(function(k){return '<input type="hidden" name="'+k+'" value="'+E(d[k]||'')+'">';}).join('')+
    /* manualfix1: start / finish (and break, added by v2-hoursrules.js) can be changed here */
    '<div class="grid2"><div><label class="req" for="dsin">Start</label><input type="time" step="900" id="dsin" name="in" required value="'+E(d['in']||'')+'"></div><div><label class="req" for="dsout">Finish</label><input type="time" step="900" id="dsout" name="out" required value="'+E(d.out||'')+'"></div></div>'+
    '<div class="grid2"><div><label class="req" for="dsn">How many shifts?</label><input type="number" id="dsn" name="n" min="1" max="30" step="1" required value="'+E(d.n||1)+'" inputmode="numeric"></div>'+
    '<div><label for="dspre">Nickname (optional)</label><input type="text" id="dspre" name="pre" maxlength="50" value="'+E(d.pre||'')+'" placeholder="e.g. Extra → Extra 1, Extra 2"></div></div>'+
    (err?'<div class="alert bad small" id="dserr">'+E(err)+'</div>':'')+
    '<div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="dsnextgo">Next</button></div></form></div>');}
function dataOf(f){var d={};[].forEach.call(f.elements,function(x){if(x.name)d[x.name]=x.value;});return d;}
FORMS.dsnext=function(f,d){if(!can()){toast('Only the Owner, an Admin or Payroll (billing) can add shifts.');return;}var e=check(d);if(e.length){step1(d,e[0]);toast(e[0]);return;}
  var n=+d.n,none=d.brk==='none',ph=paid(d['in'],d.out,none),N=nicks(d);
  modal('<div id="dsbox" class="ds-confirm"><h2>Please check</h2><p class="ds-q"><b>Add '+n+' unassigned shift'+(n===1?'':'s')+', '+E(span(d['in'],d.out))+', '+h2(ph)+' h each, total '+h2(ph*n)+' h?</b></p>'+
    '<p>'+E(siteLabel(d.site))+' · '+E(d.date)+' · '+E(brkTxt(d['in'],d.out,none))+'</p>'+(N[0]?'<p class="small">Nicknames: '+E(N.length>4?N.slice(0,3).join(', ')+' … '+N[N.length-1]:N.join(', '))+'</p>':'')+
    '<form data-form="dsok">'+['site','date','in','out','brk','n','pre','fromName'].map(function(k){return '<input type="hidden" name="'+k+'" value="'+E(d[k]||'')+'">';}).join('')+
    '<div class="row-end"><button type="button" class="sec" id="dsback" data-act="dsback">Back</button><button id="dsokgo">Yes, add '+n+'</button></div></form></div>');};
ACT.dsback=function(el){var f=el.closest('form');if(f)step1(dataOf(f));};
FORMS.dsok=function(f,d){if(!can())return;var e=check(d);if(e.length){toast(e[0]);return;}var n=+d.n,N=nicks(d),now=new Date().toISOString(),grp=uid('ds'),made=[];
  for(var i=0;i<n;i++){var id=uid('t');var t={id:id,userId:'ua-'+id,unassigned:true,uaNick:N[i],site:d.site,shiftId:null,role:'labour',date:d.date,'in':d['in'],out:d.out,clock:false,manual:true,manualSource:'office',
    manualReason:'unassigned',manualNote:'',manualBy:ME.id,manualByName:ME.name,manualAt:now,addedAt:now,daysLate:daysBetween(d.date,today()),breakMissed:d.brk==='none',test:false,note:'',lateEntry:'',uaSameHours:grp,
    manualHistory:[{at:now,by:ME.name,action:'added',reason:'Unassigned shift – same hours ('+(i+1)+' of '+n+')'+(d.fromName?' copied from '+d.fromName:'')+(N[i]?' – nickname "'+N[i]+'"':'')}]};
    (DB.time=DB.time||[]).push(t);made.push(t);}
  audit('Added unassigned shifts with the same hours',siteLabel(d.site),d.date+' '+span(d['in'],d.out)+' · '+n+' shift'+(n===1?'':'s')+(d.brk==='none'?' · no break':'')+(d.fromName?' · copied from '+d.fromName:'')+(N[0]?' · '+N[0]+(n>1?' … '+N[n-1]:''):''));
  save();closeModal();toast(n+' unassigned shift'+(n===1?'':'s')+' added (red). Assign the people when you know who.');
  if(typeof PAGE_STATE!=='undefined'){PAGE_STATE.hb=PAGE_STATE.hb||{};PAGE_STATE.hb.sel=d.date+'|'+d.site;}render();setTimeout(function(){try{render();}catch(e){}},0);};
ACT.dsrow=function(el){if(!can()){toast('Only the Owner, an Admin or Payroll (billing) can add shifts.');return;}var t,k=el.dataset.key||'',m=/^c:([^:]+):(.+)$/.exec(k);
  if(m){var sh=(DB.shifts||[]).filter(function(s){return s.id===m[1];})[0];if(!sh)return;var u=user(m[2]);t={site:sh.site,date:sh.date,'in':sh.start,out:sh.end,breakMissed:false,nm:u?u.name:''};}
  else{var x=byId(k.slice(2));if(!x||!x.out)return;var u2=x.unassigned?null:user(x.userId);t={site:siteOf(x),date:x.date,'in':x['in'],out:x.out,breakMissed:!!x.breakMissed,nm:x.unassigned?'Unassigned'+(x.uaNick?': '+x.uaNick:''):(u2?u2.name:'')};}
  step1({site:t.site,date:t.date,'in':t['in'],out:t.out,brk:t.breakMissed?'none':'taken',fromName:t.nm+' ('+span(t['in'],t.out)+')',n:1});};
/* manualfix1: prefilled from the LAST entry for that farm (any of its sites, newest date / start), not a fixed 07:00–15:00 */
ACT.dsbar=function(el){if(!can())return;var s=el.dataset.site,d=el.dataset.date,f=farmOf(s),codes=f?(DB.sites||[]).filter(function(x){return x.firmId===f.id;}).map(function(x){return x.code;}):[s];
  var T=(DB.time||[]).filter(function(t){return !t.removed&&!t.test&&t.out&&t['in']&&codes.indexOf(siteOf(t))>=0;}).sort(function(a,b){var x=(a.date+a['in']+(a.addedAt||a.manualAt||'')),y=(b.date+b['in']+(b.addedAt||b.manualAt||''));return x<y?1:x>y?-1:0;});
  var L=T[0];if(!L){step1({site:s,date:d,'in':'','out':'',brk:'taken',n:1});return;}
  step1({site:s,date:d,'in':L['in'],out:L.out,brk:(HR.hasChoice(L)?+L.brkMin===0:L.breakMissed)?'none':'taken',brkMin:HR.hasChoice(L)?L.brkMin:'',brkAt:L.brkAt||'',fromName:'last entry for this farm ('+L.date+' '+span(L['in'],L.out)+')',n:1});};
ACT.dsform=function(el){var f=el.closest('form');if(!f)return;var d=dataOf(f);step1({site:d.site,date:d.date,'in':d['in'],out:d.out,brk:d.brk,n:+((f.querySelector('#dsfn')||{}).value)||1,pre:(f.querySelector('#dsfpre')||{}).value||''});};
ADMIN_ONLY_ACT.push('dsrow','dsbar','dsform','dsback');ADMIN_ONLY_FORM.push('dsnext','dsok');
/* decorate */
function deco(){if(!can())return;
  var m=document.getElementById('miamodal'),f=m&&m.querySelector('form[data-form=manualtime]');
  if(f&&!f.querySelector('#dsfbox')&&f.querySelector('[name=in]')&&f.querySelector('[name=out]')){var btns=f.querySelector('.row-end')||f.lastElementChild;
    var box=document.createElement('div');box.id='dsfbox';box.className='ds-fbox';
    box.innerHTML='<h3>Add shifts with the same hours</h3><p class="small">Uses the farm, date, start, finish and break above. No person yet (red).</p><div class="ds-frow"><label for="dsfn">How many?</label><input type="number" id="dsfn" min="1" max="30" value="1" inputmode="numeric"><input type="text" id="dsfpre" maxlength="50" placeholder="Nickname (optional)" aria-label="Nickname (optional)"><button type="button" class="small" data-act="dsform" id="dsfgo">Add as unassigned</button></div>';
    btns.parentNode.insertBefore(box,btns.nextSibling);}
  var w=document.getElementById('hbwrap');if(!w||!w.querySelector('.cb-head'))return;
  var bar=document.getElementById('miabox'),add=bar&&bar.querySelector('[data-act=miaadd]');
  if(add&&!document.getElementById('dsbarbtn'))add.insertAdjacentHTML('afterend',' <button class="small sec" id="dsbarbtn" data-act="dsbar" data-site="'+add.getAttribute('data-site')+'" data-date="'+add.getAttribute('data-date')+'">+ Add shifts with the same hours</button>');
  [].forEach.call(document.querySelectorAll('#vshtable.hb-open tr[data-key]:not([data-ds])'),function(r){r.setAttribute('data-ds','1');var k=r.getAttribute('data-key');var t=/^t:/.test(k)?byId(k.slice(2)):null;if(t&&(t.removed||!t.out||t.lateEntry==='pending'))return;
    var rm=r.querySelector('.eh-pair')||r.querySelector('[data-act=vsrm]');var cell=rm?rm.parentNode:r.lastElementChild;if(!cell)return;
    var b=document.createElement('button');b.className='small sec ds-btn';b.setAttribute('data-act','dsrow');b.setAttribute('data-key',k);b.textContent='Same hours';b.title='Add more shifts with these hours (no person yet)';
    if(rm)cell.insertBefore(b,rm);else cell.appendChild(b);});}
new MutationObserver(function(){try{deco();}catch(e){try{console.warn('[dupshift]',e);}catch(z){}}}).observe(document.documentElement,{childList:true,subtree:true});
})();
