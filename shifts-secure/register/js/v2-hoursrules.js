/* v2-hoursrules.js – manualfix1 (owner Oct 21 2026, 10:35–10:37 PM). Load LAST.
   One shared rule set (HR in core.js) for EVERY hours entry / edit path:
   office manual entry (+ All hours farm box, unassigned), edit manual hours, Edit hours, same-hours (dupshift), crew lead hours, crew lead
   clock adjust, office crew clock, subcontractor add-shift, sub-worker missed shift, employee missed shift, late-entry approve/adjust,
   farm change request (Time sheets + farm page), employee / worker clock-out.
   - Every one of these forms gets "Break given" (None, 15, 30, 45, 60, Custom) and "Break started at" (optional), prefilled from the rule.
     Pay and billing use the break chosen (HR.brkMinOf). Shorter than the rule → plain warning "Less break than the usual rule", allowed.
   - Before each save: HR.validate (same checks everywhere; only the office may enter future hours). After each save: the new / changed
     hours entry (or farm change request) gets brkMin + brkAt and a History line.
   - Never silent: if a save changes nothing and shows nothing, a clear error is shown in the form and as a message.
   - Pop-ups: their buttons stay disabled until the box has finished appearing (a tap during the fade-in did nothing before). */
(function(){'use strict';if(typeof FORMS==='undefined'||typeof HR==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
var HF={manualtime:1,mtedit:1,mtlead:1,eheditok:1,dsnext:1,dsok:1,subaddshift:1,missedshift:1,swmissed:1,lateact:1,officecrew:1,crewadj:1,firmchg:2,tsreq:2}; /* 2 = farm forms: shared time rules only, NO break wording or fields (farms never see breaks) */
var NEXT_STEP={dsnext:1};   /* opens the next step; saves nothing by design */
function fIn(f){return f.querySelector('[name=in],[name=start]');}
function fOut(f){return f.querySelector('[name=out],[name=end]');}
function entryOf(f){var id=f.querySelector('[name=id]');id=id&&id.value;if(!id)return null;if(String(id).indexOf('key:')===0)return null;return (DB.time||[]).filter(function(t){return String(t.id)===String(id);})[0]||null;}
function dateOf(f){var d=f.querySelector('[name=date]');if(d&&d.value)return d.value;var t=entryOf(f);if(t)return t.date;var k=f.querySelector('[name=key]');if(k&&PAGE_STATE.frRows&&PAGE_STATE.frRows[k.value])return PAGE_STATE.frRows[k.value].date;return today();}
function ruleFor(a,b,x){return HR.ruleMin(HR.worked(a,b),x&&typeof x==='object'?x:{made:new Date().toISOString()});}
function midStart(a,b){var h=HR.worked(a,b);if(!a||!h)return '';var m=+a.slice(0,2)*60+ +a.slice(3)+Math.round(h*60/2/15)*15;m=((m%1440)+1440)%1440;return ('0'+Math.floor(m/60)).slice(-2)+':'+('0'+m%60).slice(-2);}
function brkHtml(cur,at,rule){var c=(cur===''||cur==null)?rule:+cur,std=HR.CHOICES.indexOf(c)>=0;
  return '<div class="hr-brk" data-hrbrk="1"><div class="hr-brk-row"><label>Break given<select name="brkMin" class="hr-bmin">'+HR.CHOICES.map(function(m){return '<option value="'+m+'"'+(std&&m===c?' selected':'')+'>'+(m?m+' min':'None')+(m===rule?' (usual)':'')+'</option>';}).join('')+
    '<option value="c"'+(!std?' selected':'')+'>Custom…</option></select></label>'+
    '<label class="hr-cust"'+(std?' hidden':'')+'>Minutes<input type="number" name="brkMinC" min="0" max="180" step="1" inputmode="numeric" value="'+(std?'':E(c))+'"></label>'+
    '<label>Break started at <span class="small muted">(optional)</span><input type="time" step="900" name="brkAt" value="'+E(at||'')+'"></label></div><div class="hr-warn small" aria-live="polite"></div></div>';}
function readBrk(f){var s=f.querySelector('[name=brkMin]');if(!s)return null;var v=s.value==='c'?(f.querySelector('[name=brkMinC]')||{}).value:s.value;var at=(f.querySelector('[name=brkAt]')||{}).value||'';return {min:v===''||v==null?'':String(+v),at:at};}
function refresh(f,force){var box=f.querySelector('[data-hrbrk]');if(!box)return;var a=(fIn(f)||{}).value,b=(fOut(f)||{}).value,dt=dateOf(f),rule=ruleFor(a,b,entryOf(f));
  var s=box.querySelector('[name=brkMin]'),at=box.querySelector('[name=brkAt]');
  if(!box.dataset.touched||force){s.value=HR.CHOICES.indexOf(rule)>=0?String(rule):'c';var c=box.querySelector('[name=brkMinC]');if(c)c.value=HR.CHOICES.indexOf(rule)>=0?'':rule;if(at&&!box.dataset.atTouched)at.value=rule?midStart(a,b):'';}
  [].forEach.call(s.options,function(o){var m=+o.value;if(o.value!=='c')o.textContent=(m?m+' min':'None')+(m===rule?' (usual)':'');});
  box.querySelector('.hr-cust').hidden=s.value!=='c';
  var r=readBrk(f),v=HR.validate({date:dt,'in':a,out:b,brkMin:r.min,brkAt:r.at},{office:officeAnyTime()});
  var msg=v.E.filter(function(x){return /^Break|break must|Break started/.test(x);}).concat(v.W);box.querySelector('.hr-warn').innerHTML=msg.length?'<span class="pill s-warn">'+E(msg.join(' '))+'</span>':'';
  var old=f.querySelector('select[name=brk]');if(old){if(old.querySelector('option[value=taken]'))old.value=(+r.min===0&&r.min!=='')?'none':'taken';else if(old.querySelector('option[value="'+r.min+'"]'))old.value=r.min;else old.value='';}
  var cb=f.querySelector('[name=breakTaken]');if(cb&&cb.type==='checkbox')cb.checked=!(r.min!==''&&+r.min===0);}
function decorate(f){if(f.querySelector('[data-hrbrk]'))return;var a=fIn(f),b=fOut(f);if(!a||!b)return;
  var t=entryOf(f),dt=dateOf(f),rule=ruleFor(a.value,b.value,t),cur=t&&HR.hasChoice(t)?+t.brkMin:(t&&t.breakMissed?0:rule),at=t&&t.brkAt||(cur?midStart(a.value,b.value):'');
  var anchor=f.querySelector('select[name=brk]')||f.querySelector('[name=breakTaken]')||b;var host=anchor.closest('div,label')||anchor;if(host===f||!f.contains(host))host=b;
  var w=document.createElement('div');w.innerHTML=brkHtml(t?cur:'',t?at:(rule?midStart(a.value,b.value):''),rule);var node=w.firstChild;
  if(f.dataset.form==='lateact'||f.dataset.form==='firmchg'||f.dataset.form==='tsreq')node.classList.add('hr-compact');
  host.parentNode.insertBefore(node,host.nextSibling);
  var old=f.querySelector('select[name=brk]');if(old){old.classList.add('hr-oldbrk');var lb=old.id&&f.querySelector('label[for="'+old.id+'"]');if(!lb){var p=old.previousElementSibling;if(p&&p.tagName==='LABEL')lb=p;}if(lb)lb.classList.add('hr-oldbrk');}
  if(!t)node.dataset.fresh='1';else node.dataset.touched='1';refresh(f);setTimeout(function(){hrFixHint(f);},0);}

function waitRows(){[].forEach.call(document.querySelectorAll('#vshtable tr[data-key^="t:"]:not([data-hrw]), #mtlist tr[data-id]:not([data-hrw])'),function(r){r.setAttribute('data-hrw','1');var id=r.getAttribute('data-id')||r.getAttribute('data-key').slice(2);
  var t=(DB.time||[]).filter(function(x){return String(x.id)===String(id);})[0];if(!t||t.lateEntry!=='pending'||t.removed)return;r.classList.add('hr-waitrow');
  var c=r.querySelector('td[data-label=Status]')||r.cells[r.cells.length-2];if(c&&!c.querySelector('.hr-waittag'))c.insertAdjacentHTML('afterbegin','<span class="pill hr-waittag" title="Counts now. The office can still change or remove it.">Waiting</span> ');});}
function scan(){waitRows();[].forEach.call(document.querySelectorAll('form[data-form]'),function(f){if(HF[f.dataset.form]===1)decorate(f);});
  var bm=document.getElementById('breakMissed');if(bm&&!document.getElementById('hrclock')){var lab=bm.closest('label')||bm;var t=(typeof openEntry==='function'&&ME)?openEntry(ME):null;var rule=t?ruleFor(t['in'],typeof hmOf==='function'?hmOf(Date.now()):'',null):HR.usual();
    var d=document.createElement('form');d.id='hrclock';d.className='hr-clockbrk';d.setAttribute('onsubmit','return false');d.innerHTML='<input type="hidden" name="in" value="'+E(t?t['in']:'')+'"><input type="hidden" name="out" value="'+E(typeof hmOf==='function'?hmOf(Date.now()):'')+'"><input type="hidden" name="date" value="'+E(t?t.date:today())+'">'+brkHtml('',rule?midStart(t?t['in']:'',typeof hmOf==='function'?hmOf(Date.now()):''):'',rule);lab.parentNode.insertBefore(d,lab.nextSibling);refresh(d);}}
document.addEventListener('change',function(e){var f=e.target&&e.target.closest&&e.target.closest('form');if(!f||!f.querySelector('[data-hrbrk]'))return;var box=f.querySelector('[data-hrbrk]');
  if(e.target.name==='brkMin'||e.target.name==='brkMinC')box.dataset.touched='1';if(e.target.name==='brkAt')box.dataset.atTouched='1';
  if(e.target.id==='breakMissed'){}refresh(f);},true);
document.addEventListener('input',function(e){var f=e.target&&e.target.closest&&e.target.closest('form');if(f&&f.querySelector('[data-hrbrk]')&&(e.target.name==='brkMinC'||e.target.name==='brkAt')){f.querySelector('[data-hrbrk]').dataset.touched='1';refresh(f);}},true);
/* ---- save wrapper ---- */
var lastToast=0;(function(){var ot=window.toast;if(typeof ot!=='function')return;window.toast=toast=function(){lastToast++;return ot.apply(this,arguments);};})();
function sig(){var m={};(DB.time||[]).forEach(function(t){m[t.id]=JSON.stringify(t);});return m;}
function changesSig(){return (DB.changes||[]).length;}
function showErr(f,msg){var a=f&&f.querySelector('.hr-err');if(f){if(!a){a=document.createElement('div');a.className='alert bad small hr-err';a.setAttribute('role','alert');var b=f.querySelector('.row-end')||f.lastElementChild;f.insertBefore(a,b);}a.textContent=msg;}toast(msg);}
function entryDate(f,d){if(d.date)return d.date;var t=entryOf(f);if(t)return t.date;if(d.key&&PAGE_STATE.frRows&&PAGE_STATE.frRows[d.key])return PAGE_STATE.frRows[d.key].date;return '';}
function wrap(n){var o=FORMS[n];if(typeof o!=='function'||o.__hr)return;var w=function(f,d){d=d||{};
  var r=null;if(f&&f.querySelector)r=readBrk(f);if(n==='dsok'&&PAGE_STATE.hrDs)r=PAGE_STATE.hrDs;
  var a=d['in']||d.start,b=d.out||d.end;
  if(a&&b&&!(n==='lateact'&&(d.act||f&&f._act)==='reject')){var v=HR.validate({date:entryDate(f,d)||undefined,'in':a,out:b,brkMin:r?r.min:'',brkAt:r?r.at:''},{office:officeAnyTime(),entry:f&&f.querySelector?entryOf(f):null});
    if(v.E.length){showErr(f,v.E[0]);return;}
    if(r&&r.min!==''){var ob=f&&f.querySelector&&f.querySelector('select[name=brk]');if(ob&&ob.querySelector('option[value=taken]')||(!ob&&'brk' in d))d.brk=+r.min===0?'none':'taken';else if(ob)d.brk=ob.value;if(n==='swmissed'||n==='crewadj')d.breakTaken=+r.min===0?'':'1';}}
  if(n==='dsnext'&&r)PAGE_STATE.hrDs=r;
  var before=sig(),cl=changesSig(),t0=lastToast,m=document.getElementById('modal'),mh=m?m.innerHTML:null,res;
  try{res=o.apply(this,arguments);}catch(e){showErr(f,'Not saved – something went wrong ('+(e&&e.message||e)+'). Please try again.');throw e;}
  var after=sig(),touched=[];Object.keys(after).forEach(function(id){if(before[id]!==after[id])touched.push(id);});
  var now=new Date().toISOString();
  if(r&&r.min!==''){touched.forEach(function(id){var t=(DB.time||[]).filter(function(x){return x.id===id;})[0];if(!t||t.removed)return;
      if(String(t.brkMin)===r.min&&(t.brkAt||'')===r.at)return;var was=HR.label(t);t.brkMin=+r.min;t.brkAt=r.at||'';
      (t.manualHistory=t.manualHistory||(t.manual?[]:t.manualHistory));(t.breakHistory=t.breakHistory||[]).push({at:now,by:ME?ME.name:'',was:was,now:HR.label(t)});
      if(t.manual)t.manualHistory.push({at:now,by:ME?ME.name:'',action:'break',reason:'Break given: '+HR.label(t)});});
    if(changesSig()>cl){(DB.changes||[]).slice(cl).forEach(function(c){c.brkMin=+r.min;c.brkAt=r.at||'';});}
    if(touched.length||changesSig()>cl){try{save();}catch(e){}}}
  if(n==='dsok')PAGE_STATE.hrDs=null;
  var m2=document.getElementById('modal'),changed=touched.length||changesSig()>cl||lastToast>t0||(m2?m2.innerHTML:null)!==mh;
  if(!changed&&!NEXT_STEP[n])showErr(f,'Nothing was saved. Please check the form and try again – if it keeps happening, tell the office.');
  return res;};w.__hr=1;FORMS[n]=w;}
function wrapAll(){Object.keys(HF).forEach(wrap);}
wrapAll();setTimeout(wrapAll,0);
/* clock-out: chosen break */
(function(){var o2=ACT.clockout2,oy=ACT.clockoutyes;if(typeof o2==='function')ACT.clockout2=function(){var f=document.getElementById('hrclock');PAGE_STATE.hrClock=f?readBrk(f):null;return o2.apply(this,arguments);};
  if(typeof oy==='function')ACT.clockoutyes=function(){var u=ME,t=typeof openEntry==='function'?openEntry(u):null,r=PAGE_STATE.hrClock;var res=oy.apply(this,arguments);
    if(t&&t.out&&r&&r.min!==''){var v=HR.validate({date:t.date,'in':t['in'],out:t.out,brkMin:r.min,brkAt:r.at},{office:true});if(!v.E.length){t.brkMin=+r.min;t.brkAt=r.at||'';if(+r.min===0)t.breakMissed=true;save();render();}}
    PAGE_STATE.hrClock=null;return res;};})();
/* pop-ups: no tap until the box is fully shown */
(function(){var om=window.modal;if(typeof om!=='function')return;window.modal=modal=function(){var r=om.apply(this,arguments);var m=document.getElementById('modal');if(!m)return r;
  var B=[].slice.call(m.querySelectorAll('button:not([disabled])')).filter(function(b){return !b.closest('.x')&&b.getAttribute('data-act')!=='closeModal'&&!/^(Cancel|Back|Close)$/i.test(b.textContent.trim());});
  B.forEach(function(b){b.disabled=true;b.dataset.hrWait='1';});var done=false,go=function(){if(done)return;done=true;B.forEach(function(b){if(b.dataset.hrWait){b.disabled=false;delete b.dataset.hrWait;}});};
  var box=m.querySelector('.modal')||m;box.addEventListener('animationend',go,{once:true});setTimeout(go,450);scan();return r;};})();
/* break shown everywhere it is shown: the break actually used for pay */
window.hrBrkLabel=function(t){return HR.label(t);};
(function(){var busy=false,q=0,mo=new MutationObserver(function(){if(busy||q)return;q=setTimeout(function(){q=0;busy=true;mo.disconnect();try{scan();}catch(e){}mo.takeRecords();mo.observe(document.documentElement,{childList:true,subtree:true});busy=false;},30);});mo.observe(document.documentElement,{childList:true,subtree:true});})();
if(!document.getElementById('hrstyle')){var st=document.createElement('style');st.id='hrstyle';st.textContent='.hr-brk [hidden],.hr-cust[hidden]{display:none!important}.hr-brk{margin:8px 0;padding:8px 10px;border:1px solid #e3e0ea;border-radius:10px;background:#faf9fc}.hr-brk-row{display:flex;flex-wrap:wrap;gap:10px}.hr-brk-row label{display:flex;flex-direction:column;font-size:14px;font-weight:600;min-width:130px;flex:1}.hr-brk select,.hr-brk input{margin-top:4px}.hr-warn:empty{display:none}.hr-warn{margin-top:6px}.hr-oldbrk{display:none!important}.hr-compact{padding:4px 6px}.hr-compact .hr-brk-row label{min-width:100px;font-size:13px}tr.hr-waitrow td{color:#7a7786;background:#f5f4f7}.hr-waittag{background:#8a8797!important;color:#fff!important}';document.head.appendChild(st);}
})();
/* manualfix1b: the "Worked … − break … = … h paid" summary uses the CHOSEN break */
function hrFixHint(f){if(!f||!f.querySelector||!f.querySelector('[data-hrbrk]'))return;var a=f.querySelector('[name=in],[name=start],[name=newIn]'),b=f.querySelector('[name=out],[name=end],[name=newOut]');if(!a||!b||!a.value||!b.value||spanErr(a.value,b.value))return;
  var sl=f.querySelector('[name=brkMin]'),mv=sl.value==='c'?(f.querySelector('[name=brkMinC]')||{}).value:sl.value;if(mv===''||mv==null||isNaN(+mv))return;var r={min:String(+mv)};var w=hrs(a.value,b.value),brk=(+r.min)/60,root=f.closest('#modal')||f.parentNode||f;
  [].forEach.call(root.querySelectorAll('#mthint,#saHint,.hr-hint,[id$=hint],[id$=Hint]'),function(h){if(!/h paid/.test(h.innerHTML)||!/Worked/.test(h.innerHTML))return;
    var tail=h.innerHTML.replace(/^[\s\S]*?h paid<\/b>/,'');var html='Worked <b>'+w.toFixed(2)+' h</b>'+(brk?' − break '+brk.toFixed(2)+' h':' − no break')+' = <b>'+Math.max(0,w-brk).toFixed(2)+' h paid</b>'+tail;if(h.innerHTML!==html)h.innerHTML=html;});}
window.hrFixHint=hrFixHint;
['input','change'].forEach(function(ev){document.addEventListener(ev,function(e){var f=e.target&&e.target.form;if(f)setTimeout(function(){hrFixHint(f);},0);},true);});
