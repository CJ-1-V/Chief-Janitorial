/* v2-brkcorr.js – brkcorr1 (owner Oct 22 2026, 4:33 PM ET, via Grok Bot). TEST COPY. Load after v2-hoursrules.js.
   Farm "Ask to change hours" (Time sheets → Change; picker HTML in v2-timesheets.js): the farm picks the break – No break, 30 min or 60 min – and (optional) when it started.
   - The choice travels with the request: brkMin / brkAt (stamped by the shared v2-hoursrules wrapper) plus propBrkMin / propBrkAt /
     origBrkMin on the request. Stored in the existing data JSON of reg_time_proposals – no schema change.
   - Office (Farm changes): the farm's break is shown in the request; the decision box has Break given (None/15/30/45/60/now) + started at,
     prefilled with the farm's pick, and a live "Approve applies … = … h paid" line. Approve applies times + break in one step;
     Adjust uses the office's own times / break (override).
   - Hours: the entry gets brkMin / brkAt, so pay (HR.paid), billing (dayBreakH) and every list use the same shared break logic. */
(function(){'use strict';if(typeof ACT==='undefined'||typeof HR==='undefined'||typeof FORMS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function mLabel(m){m=+m;return m?m+' min':'No break';}
function brkTxt(m,at){if(m===''||m==null||isNaN(+m))return '';return mLabel(m)+(+m&&at?' from '+at:'');}
function rowMin(r){return HR.brkMinOf({'in':r.start,out:r.end,brkMin:r.brkMin,breakMissed:r.breakMissed,made:r.made,date:r.date});}
function chMin(c,which){var k=which==='orig'?'origBrkMin':'propBrkMin';if(c[k]!==undefined&&c[k]!==''&&c[k]!=null)return +c[k];
  if(which!=='orig'&&HR.hasChoice(c))return +c.brkMin;return null;}
function chAt(c){return c.propBrkAt!=null?c.propBrkAt:(c.brkAt||'');}
window.bcBrkTxt=brkTxt;

/* ---------- farm: Time sheets change request (#tsform, built in v2-timesheets.js) ---------- */
function sync(f){var p=f.querySelector('input[name=bcPick]:checked'),v=p?p.value:'keep',m=v==='keep'?null:+v,h=f.querySelector('input[name=brkMin]');if(h)h.value=m==null?'':String(m);
  var a=f.querySelector('.bc-at');if(a){a.hidden=!m;if(!m){var i=a.querySelector('input');if(i)i.value='';}}calcTs(f);}
window.bcSync=sync;
function calcTs(f){var o=f.querySelector('#tscalc'),r=(PAGE_STATE.frRows||{})[f.dataset.key||''];if(!o)return;if(!r){o.textContent='';return;}
  var st=f.start.value||r.start,en=f.end.value||r.end,mv=f.brkMin.value,cur=typeof tsCurBrk==='function'?tsCurBrk(r):0,m=mv===''?cur:+mv;
  if(spanErr(st,en)){o.innerHTML='<span class="pill s-bad">'+E(spanErr(st,en))+'</span>';return;}
  var was=Math.max(0,HR.worked(r.start,r.end)-cur/60),now=Math.max(0,HR.worked(st,en)-m/60),d=Math.round((now-was)*100)/100;
  o.innerHTML=(m&&m/60>=HR.worked(st,en)?'<span class="pill s-bad">The break must be shorter than the shift.</span> ':'')+'Hours after break: <b>'+was.toFixed(2)+' → '+now.toFixed(2)+' h</b> '+(d===0?'(no change)':'('+Math.abs(d).toFixed(2)+' h '+(d<0?'less':'more')+')');}
document.addEventListener('change',function(e){var f=e.target&&e.target.closest&&e.target.closest('#tsform');if(!f)return;if(e.target.name==='bcPick')sync(f);else calcTs(f);},true);
document.addEventListener('input',function(e){var f=e.target&&e.target.closest&&e.target.closest('#tsform');if(f)calcTs(f);},true);

/* farm + office status lines: show the minutes, not just "Break taken" */
(function(){var oS=changeStatusHtml;changeStatusHtml=function(c){var x=oS.apply(this,arguments);if(!c||!x)return x;
  var pm=chMin(c),dm=c.decBrkMin!=null&&c.decBrkMin!==''?+c.decBrkMin:null;
  if(pm!=null){x=x.replace(/(You asked for: <b>[^<]*?)( · (Break taken|No break))?<\/b>/,'$1 · '+E(brkTxt(pm,chAt(c)))+'</b>').replace(/(You asked for: [^<]*?)( · (Break taken|No break))?(<\/div>)/,'$1 · '+E(brkTxt(pm,chAt(c)))+'$4');}
  if(dm!=null)x=x.replace(/((New hours|Office changed it to): <b>[^<]*?)( · (Break taken|No break))?<\/b>/,'$1 · '+E(brkTxt(dm,c.decBrkAt))+'</b>');
  return x;};})();

/* ---------- office: Farm changes ---------- */
function paidOf(a,b,m){var w=HR.worked(a,b);return Math.max(0,w-(+m||0)/60);}
function chById(id){return (DB.changes||[]).filter(function(x){return x.id===id;})[0];}
function officeDecorate(){var tb=document.getElementById('fctable');if(!tb||!ME||ME.type!=='admin')return;
  [].forEach.call(tb.querySelectorAll('tr[data-id]:not([data-bc])'),function(tr){tr.setAttribute('data-bc','1');var c=chById(tr.getAttribute('data-id'));if(!c)return;
    var pm=chMin(c),om=chMin(c,'orig'),td=tr.cells;
    if(om!=null&&td[3]){td[3].querySelectorAll('.small').forEach(function(x){x.innerHTML=x.innerHTML.replace(/ · (Break taken|No break)$/,'');});}
    if(om!=null&&td[3])td[3].insertAdjacentHTML('beforeend','<div class="small bc-was">Break '+E(brkTxt(om,c.origBrkAt))+' · '+paidOf(c.origStart,c.origEnd,om).toFixed(2)+' h paid</div>');
    if(pm!=null&&td[4]){td[4].querySelectorAll('.small').forEach(function(x){x.innerHTML=x.innerHTML.replace(/ · <b>(Break taken|No break)<\/b>/,'');});
      td[4].insertAdjacentHTML('beforeend','<div class="bc-ask"><span class="pill bc-pill">Farm picked: '+E(brkTxt(pm,chAt(c)))+'</span><div class="small">= <b>'+paidOf(c.propStart,c.propEnd,pm).toFixed(2)+' h paid</b></div></div>');}
    var f=tr.querySelector('form.fcform');if(!f||f.querySelector('[name=brkMin]'))return;
    var old=f.querySelector('select[name=brk]'),start=pm!=null?pm:(old&&old.value==='none'?0:HR.ruleMin(HR.worked(c.propStart,c.propEnd),c)),ch=HR.CHOICES.slice();if(ch.indexOf(start)<0){ch.push(start);ch.sort(function(a,b){return a-b;});}
    if(old){old.hidden=true;old.classList.add('bc-hide');}
    var box=document.createElement('div');box.className='bc-office';
    box.innerHTML='<label>Break given<select name="brkMin" aria-label="Break given">'+ch.map(function(m){return '<option value="'+m+'"'+(m===start?' selected':'')+'>'+(m?m+' min':'None')+(m===pm?' (farm)':'')+'</option>';}).join('')+'</select></label>'+
      '<label>Started at <span class="small muted">(optional)</span><input type="time" step="900" name="brkAt" value="'+E(pm!=null?chAt(c):'')+'"></label><div class="small bc-calc" aria-live="polite"></div>';
    var row=f.querySelector('.row');row.parentNode.insertBefore(box,row.nextSibling);
    var ap=f.querySelector('[data-d=Approved]');if(ap&&pm!=null)ap.textContent='Approve (times + '+(pm?pm+' min break':'no break')+')';
    calc(f,c);});}
function calc(f,c){var o=f.querySelector('.bc-calc');if(!o)return;var st=f.start.value,en=f.end.value,m=+f.brkMin.value,old=f.querySelector('select[name=brk]');if(old)old.value=m?'taken':'none';
  if(spanErr(st,en)){o.textContent=spanErr(st,en);return;}var pm=chMin(c),same=st===c.propStart&&en===c.propEnd&&(pm==null||m===pm);
  o.innerHTML=(same?'Approve applies: ':'Adjust applies: ')+'<b>'+E(st+'–'+en)+'</b>, '+E(mLabel(m).toLowerCase())+' = <b>'+paidOf(st,en,m).toFixed(2)+' h paid</b> (was '+paidOf(c.origStart,c.origEnd,chMin(c,'orig')!=null?chMin(c,'orig'):HR.ruleMin(HR.worked(c.origStart,c.origEnd),c)).toFixed(2)+' h)';}
document.addEventListener('change',function(e){var f=e.target&&e.target.closest&&e.target.closest('form.fcform');if(f){var c=chById(f.dataset.id);if(c)calc(f,c);}},true);
document.addEventListener('input',function(e){var f=e.target&&e.target.closest&&e.target.closest('form.fcform');if(f){var c=chById(f.dataset.id);if(c)calc(f,c);}},true);
(function(){var oA=afterRender;afterRender=function(root){oA.apply(this,arguments);try{officeDecorate();}catch(e){if(typeof logError==='function')logError(e);}};})();
new MutationObserver(function(){try{if(document.querySelector('#fctable tr[data-id]:not([data-bc])'))officeDecorate();}catch(e){}}).observe(document.documentElement,{childList:true,subtree:true});

/* decision: Approve = the farm's times AND break, one step; Adjust = the office's times / break (override) */
var oDec=ACT.fcdec;
ACT.fcdec=function(el){var c=chById(el.dataset.id),f=el.closest&&el.closest('form');if(!c||c.status!=='Pending'||!f||!f.querySelector('[name=brkMin]'))return oDec.apply(this,arguments);
  var dec=el.dataset.d,pm=chMin(c),m=+f.brkMin.value,at=m?(f.brkAt.value||''):'';
  if(dec==='Approved'&&pm!=null){m=pm;at=pm?chAt(c):'';}
  if(dec!=='Rejected'){var h=HR.worked(dec==='Approved'?c.propStart:f.start.value,dec==='Approved'?c.propEnd:f.end.value),v=HR.validate({'in':dec==='Approved'?c.propStart:f.start.value,out:dec==='Approved'?c.propEnd:f.end.value,brkMin:m,brkAt:at},{office:true});
    if(v.E.length){toast(v.E[0]);return;}if(m&&m/60>=h){toast('The break must be shorter than the shift.');return;}}
  var old=f.querySelector('select[name=brk]'),pb=c.propBreak,flip=false;
  if(old)old.value=m?'taken':'none';
  /* Adjust that only changes the minutes (e.g. 30 → 60, same times): the older check would say "same as proposed" */
  if(dec==='Adjusted'&&f.start.value===c.propStart&&f.end.value===c.propEnd&&pm!=null&&m!==pm&&(m===0)===(pm===0)){flip=true;c.propBreak=pb==='none'?'taken':'none';}
  try{oDec.apply(this,arguments);}finally{if(flip)c.propBreak=pb;}
  if(c.status==='Pending'||c.status==='Rejected')return;
  var t=(DB.time||[]).filter(function(x){return x.changeId===c.id;})[0],now=new Date().toISOString();
  c.decBrkMin=m;c.decBrkAt=at;c.decBreak=m?'taken':'none';
  if(t){var was=HR.label(t);if(t.orig&&t.orig.brkMin===undefined)t.orig.brkMin=HR.hasChoice(t)?+t.brkMin:'';t.brkMin=m;t.brkAt=at;t.breakMissed=m===0;
    (t.breakHistory=t.breakHistory||[]).push({at:now,by:ME?ME.name:'',was:was,now:HR.label(t),why:'Farm change '+c.id+' '+dec.toLowerCase()});}
  audit('Farm change break applied',c.firmName,c.site+' '+c.date+' Worker #'+c.workerNo+': '+brkTxt(m,at)+(t?' = '+HR.paid(t).toFixed(2)+' h paid':'')+(dec==='Adjusted'&&pm!=null&&m!==pm?' (office changed the farm\'s '+brkTxt(pm,chAt(c))+')':''));
  save();render();};

if(!document.getElementById('bcstyle')){var s=document.createElement('style');s.id='bcstyle';s.textContent='.bc-farm{display:flex;flex-direction:column;gap:6px}.bc-pick{display:flex;flex-wrap:wrap;gap:6px}.bc-opt{display:flex;align-items:center;gap:6px;border:1.5px solid #cfcbe0;border-radius:10px;padding:8px 10px;min-height:44px;cursor:pointer;font-weight:600;background:#fff}.bc-opt input{margin:0;width:18px;height:18px}.bc-opt:has(input:checked){border-color:#1f2a5c;background:#eef1fb}.bc-fs{border:1px solid #e3e0ea;border-radius:10px;padding:8px 10px;margin:8px 0}.bc-fs legend{font-weight:700;padding:0 4px}.bc-calc{margin-top:6px}.bc-at{display:flex;flex-direction:column;font-size:13px;font-weight:600}.bc-at[hidden]{display:none!important}.bc-sub{font-size:12px;font-weight:400;color:#6b6880}.bc-pill{background:#1f2a5c!important;color:#fff!important;font-weight:700}.bc-ask{margin-top:4px}.bc-office{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0;padding:6px 8px;border:1px solid #e3e0ea;border-radius:8px;background:#faf9fc}.bc-office label{display:flex;flex-direction:column;font-size:13px;font-weight:600}.bc-calc{flex-basis:100%}.bc-hide{display:none!important}';document.head.appendChild(s);}
})();
