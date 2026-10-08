/* hrreview1 – HR Bot's limited-English farm-worker review of the sign-up app (Oct 6 2026), rechecked on live master 44b7f96.
   New file only; loaded just before v2-nohome.js (v2-nohome.js stays LAST). TEST COPY ONLY – no database change, no SQL.
   Only screens seen by employees / subcontractor workers / crew leads and the public sign-up pages change; office screens are unchanged.
   1) worker whose employer's papers are not finished: plain "You can't clock in yet … Call the office" + tap-to-call 902-200-4888.
   2) password: under every new-password box a hint + an example that passes the rule (random each time, so nobody copies one).
      The rule itself is unchanged; the "common word" message now says which word to drop.
   3) one message when clock-in is allowed but items are open: "You can work now. Please finish these soon."
   4) My documents: when the job needs no documents, say "No documents needed for your job" (was hidden behind "ⓘ Details").
      Employee menu/page title "Documents" -> "My documents"; training text "Licences & certificates" -> "My documents".
   5) crew screen: start/finish choices follow the scheduled shift (shift not started yet -> say so; scheduled start/end offered).
   6) phone/desktop layout: Clock in button stays in place until a site is picked; crew table Save never wraps.
   Wording: sign-up role choice, Punjabi/Hindi/Gujarati, one "I agree" on terms, "Worker rules"/"safety gear",
   "driving record from the government (driver's abstract)", missed-break text, module as bullets, crew billing paragraph removed,
   manual hours: hour + minutes instead of one 96-line list. */
'use strict';
(function(){
var OFFICE_TEL='+19022004888',OFFICE_PH='902-200-4888';
function isWorkerSide(){return !!(typeof ME!=='undefined'&&ME&&(ME.type==='worker'||ME.type==='employee'));}
function E(s){return typeof esc==='function'?esc(s):String(s);}

/* ---------- wording: languages (Preferred language list in My details) ---------- */
try{if(typeof LANGS!=='undefined'&&Array.isArray(LANGS)){['Punjabi','Hindi','Gujarati'].forEach(function(l){if(LANGS.indexOf(l)<0){var o=LANGS.indexOf('Other');if(o<0)LANGS.push(l);else LANGS.splice(o,0,l);}});}}catch(e){}

/* ---------- wording: sign-up role choice (public page) ---------- */
if(typeof VIEWS!=='undefined'&&typeof VIEWS.signup==='function'){var _su=VIEWS.signup;VIEWS.signup=function(){var x=String(_su.apply(this,arguments));
  x=x.replace(/<b>Employee<\/b>\s*<span class="small muted">\(company employee\)<\/span><br><span class="small">[^<]*<\/span>/,'<b>UnScramble pays you</b> <span class="small muted">(employee)</span><br><span class="small">UnScramble is your employer and pays you.</span>');
  x=x.replace(/<b>Employee of UnScramble<\/b><br><span class="small">[^<]*<\/span>/,'<b>UnScramble pays you</b> <span class="small muted">(employee)</span><br><span class="small">UnScramble is your employer and pays you.</span>');
  x=x.replace(/<b>Subcontractor worker<\/b><br><span class="small">[^<]*<\/span>/,'<b>Farm worker – a crew company hired you</b> <span class="small muted">(subcontractor worker)</span><br><span class="small">The crew company is your employer. You choose it on the next screen.</span>');
  return x;};}
if(typeof VIEWS!=='undefined'&&typeof VIEWS.signupForm==='function'){var _sf=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=String(_sf.apply(this,arguments));
  return x.replace('<h1>Sign up: Employee</h1>','<h1>Sign up: UnScramble pays you <span class="small muted">(employee)</span></h1>').replace('<h1>Sign up: Farm worker</h1>','<h1>Sign up: Farm worker – a crew company hired you</h1>');};}

/* ---------- 2) password: clearer message + an example that works ---------- */
var PW_WORDS=['Blue','Green','River','Maple','Tractor','Apple','Cloud','Garden','Basket','Window','Lake','Pepper','Sunset','Pencil','Silver','Orange','Bridge','Candle'];
function pwExample(){for(var i=0;i<20;i++){var a=PW_WORDS[Math.floor(Math.random()*PW_WORDS.length)],b=PW_WORDS[Math.floor(Math.random()*PW_WORDS.length)],c=PW_WORDS[Math.floor(Math.random()*PW_WORDS.length)];if(a===b||b===c||a===c)continue;
  var ex=a+'-'+b+'-'+c+'-'+(10+Math.floor(Math.random()*90));if(typeof pwCheck!=='function'||pwCheck(ex,{}).ok)return ex;}return 'Maple-River-Cloud-47';}
if(typeof pwCheck==='function'){var _pc=pwCheck;pwCheck=function(pw,ctx){var r=_pc.apply(this,arguments);try{if(r&&r.msgs)r.msgs=r.msgs.map(function(m){
  var h=/it contains “([^”]+)”/.exec(m);if(h)return 'no easy word like “'+h[1]+'” (take it out, or use other words)';return m;});}catch(e){}return r;};}
function addPwHints(root){[].forEach.call(root.querySelectorAll('form input[type=password][name=pw]'),function(el){var f=el.form;if(!f||f.querySelector('.hr-pwex'))return;
  var d=document.createElement('div');d.className='hr-pwex small';var ex=pwExample();
  d.innerHTML='<b>Tip:</b> use 3 everyday words and a number, with a dash between them. Example that works: <code class="hr-pwex-code">'+E(ex)+'</code> <span class="muted">(make your own – do not copy this one)</span>';
  var anchor=el.closest('label,.field,div')||el;anchor.parentNode.insertBefore(d,anchor.nextSibling);});}

/* ---------- 4) My documents ---------- */
try{if(NAV&&NAV.employee)NAV.employee=NAV.employee.map(function(n){return n[0]==='#/docs'&&n[1]==='Documents'?['#/docs','My documents']:n;});}catch(e){}
['worker','employee'].forEach(function(t){var k=t+':docs',ov=VIEWS[k];if(typeof ov!=='function')return;VIEWS[k]=function(){var x=String(ov.apply(this,arguments));
  try{if(ME&&typeof docKindsFor==='function'&&!docKindsFor(ME).length&&x.indexOf('id="docsempty"')<0){
    x='<h1>My documents</h1><div class="msg-empty" id="docsempty"><b>No documents needed for your job.</b> Nothing to do here. If your job changes, update it in My details.</div>';}
    x=x.replace(/<h1>Documents<\/h1>/,'<h1>My documents</h1>');}catch(e){}return x;};});

/* ---------- terms: one "I agree" for employees and workers ---------- */
var TERM_LABEL={schedule_c:'Worker rules',privacy:'Privacy notice (including the location check when you clock in)'};
function termLabel(k){return TERM_LABEL[k]||(TERMS_DEF[k]&&TERMS_DEF[k].name)||k;}
if(typeof VIEWS.terms==='function'){var _tv=VIEWS.terms;VIEWS.terms=function(){var x=String(_tv.apply(this,arguments));if(!isWorkerSide())return x;
  try{var miss=missingTerms(ME);if(!miss.length||miss.indexOf('sub_agreement')>=0)return x;
    x=x.replace(/<form data-form="accept">[\s\S]*?<\/form>/g,'');
    miss.forEach(function(k){var n=TERMS_DEF[k]&&TERMS_DEF[k].name;if(n&&TERM_LABEL[k])x=x.replace('<h2>'+E(n)+' <span','<h2>'+E(TERM_LABEL[k])+' <span class="small muted hr-legal">('+E(n)+')</span> <span');});
    x=x.replace(/Please read and accept the current terms before you can use the app( or see shifts)?\./,'Please read these, then tap <b>I agree</b> at the bottom.');
    var list=miss.map(function(k){return '<li>'+E(termLabel(k))+'</li>';}).join('');
    var form='<div class="card hl" id="hr-agree"><form data-form="hracceptall"><p><b>I have read and I agree to:</b></p><ul class="small">'+list+'</ul><button class="btn primary huge" id="hrAgreeBtn">I agree</button></form></div>';
    var i=x.indexOf('<div class="card"><h3 style="margin-top:0">Optional: data-use consent');if(i<0)i=x.indexOf('<h2>Terms I have accepted');
    x=i<0?x+form:x.slice(0,i)+form+x.slice(i);}catch(e){}return x;};}
FORMS.hracceptall=function(f,d){if(!isWorkerSide())return;var miss=missingTerms(ME);if(!miss.length){go('#/home');return;}if(miss.indexOf('sub_agreement')>=0){toast('Please accept each section.');return;}
  miss.forEach(function(k){recordAcceptance(ME,k);});save();toast('Thank you – you agreed.');go(missingTerms(ME).length?'#/terms':'#/home');};

/* ---------- crew screen (crew lead) ---------- */
function qb(t,sel,early,tag){return '<button type="button" role="radio" class="qopt'+(early?' qearly':'')+(sel?' sel':'')+' hr-sched" aria-checked="'+(!!sel)+'" data-act="qopt" data-t="'+t+'"><b>'+hmOf(t)+'</b><small class="hr-qtag">'+E(tag)+'</small></button>';}
if(typeof VIEWS['worker:crew']==='function'){var _cv=VIEWS['worker:crew'];VIEWS['worker:crew']=function(){var x=String(_cv.apply(this,arguments));
  x=x.replace(/<div class="small muted">These times are used to bill the client only[^<]*<\/div>/,'');
  try{var sh=(DB.shifts||[]).filter(function(s){return s.id===PAGE_STATE.crewSid;})[0];if(!sh||!sh.start||!sh.end)return x;
    var now=Date.now(),ss=hmMs(sh.date,sh.start),se=hmMs(sh.date,sh.end);if(se<=ss)se+=86400000;var fl=Math.floor(now/QMS)*QMS;
    if(sh.date===today()&&now<ss-3600000){
      /* shift has not started yet: say so; start times stay behind a toggle (no clock-in in the future) */
      x=x.replace(/(<div class="card" id="crewbulk">)([\s\S]*?)(<\/div>\s*<div class="tw">)/,function(m,a,inner,c){return a+'<div class="hr-crewnote" id="hrCrewNote"><b>This shift starts at '+E(sh.start)+'.</b> It is '+hmOf(now)+' now. Clock the crew in when they start work.</div><details class="hr-crewearly"><summary>Crew already working? Show start times</summary>'+inner+'</details>'+c;});
    }else if(now>=ss){
      /* scheduled start is offered with the earlier times (reason still needed, same rule as everyone) */
      if(ss<fl-3*QMS&&now-ss<12*3600000)x=x.replace(/(id="qCrewIn"[\s\S]*?<div class="mf-early-opts">)/,function(m){return m+qb(ss,false,true,'scheduled start');});
    }
    if(now>se+30*60000&&now-se<12*3600000){
      /* finish: the scheduled end is offered (and pre-selected) when the crew lead opens the screen well after it */
      x=x.replace(/(<div class="qpick" id="qCrewOut"[^>]*>)([\s\S]*?)(<\/div>)/,function(m,a,inner,c){if(inner.indexOf('data-t="'+se+'"')>=0)return m;return a+qb(se,true,false,'scheduled end')+inner.replace(/ sel"/g,'"').replace(/aria-checked="true"/g,'aria-checked="false"')+c;});
    }
    x=x.replace(/<td><form id="ca_/g,'<td class="hr-savecell"><form id="ca_').replace(/<button class="small btn-indigo-outline">Save<\/button>/g,'<button class="small btn-indigo-outline crewsave">Save</button>');
  }catch(e){try{console.warn('[hrreview] crew',e);}catch(x2){}}
  return x;};}

/* ---------- DOM pass (employee / worker side only): wording + small widgets ---------- */
var REPL=[
  [/Schedule C – Worker Acknowledgement/g,'Worker rules'],
  [/Privacy Notice and Consent \(incl\. location check-in\)/g,'Privacy notice (including the location check when you clock in)'],
  [/accept Schedule C/g,'accept the Worker rules'],
  [/Safety gear \(PPE\)/g,'Safety gear'],
  [/\bthe PPE\b/g,'the safety gear'],[/\bPPE\b/g,'safety gear'],
  [/Driver's abstract \(driving record\)/g,"Driving record from the government (driver's abstract)"],
  [/[Yy]our driver's abstract/g,"your driving record from the government (driver's abstract)"],
  [/Licences & certificates/g,'My documents'],
  [/\(incl\. /g,'(including ']
];
function walkText(root){var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,{acceptNode:function(n){var p=n.parentNode;if(!p)return NodeFilter.FILTER_REJECT;
  if(p.closest('.terms-text,.hr-legal,textarea,script,style,code,[contenteditable]'))return NodeFilter.FILTER_REJECT;return /Schedule C|PPE|abstract|Licences|incl\.|Privacy Notice/.test(n.nodeValue)?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP;}});
  var l=[],n;while((n=w.nextNode()))l.push(n);l.forEach(function(t){var v=t.nodeValue,o=v;REPL.forEach(function(r){v=v.replace(r[0],r[1]);});if(v!==o)t.nodeValue=v;});}
function fixCantClock(root){var c=root.querySelector('#cantclock');if(!c||c.dataset.hr)return;var b=c.querySelector('b');if(!b||!/employer's papers are not finished/i.test(b.textContent))return;
  c.dataset.hr='1';b.textContent="You can't clock in yet.";var why=c.querySelector('.why');var html='Your employer\'s papers are not finished. There is nothing for you to fix. <b>Call the office:</b> <a href="tel:'+OFFICE_TEL+'" class="nw hr-call">'+OFFICE_PH+'</a>';
  if(why){var keep=[].filter.call(why.children,function(e){return e.tagName==='DETAILS';});why.innerHTML=html;keep.forEach(function(k){why.appendChild(k);});}else b.insertAdjacentHTML('afterend','<span class="why">'+html+'</span>');}
function fixWorkNow(root){var ready=false;try{ready=readyForClock(ME);}catch(e){}if(!ready)return;
  var d=root.querySelector('#docremind');if(d&&!d.dataset.hr){d.dataset.hr='1';var b=d.querySelector('b');var m=b&&/\((\d+)\)/.exec(b.textContent);var n=m?+m[1]:0;
    [].slice.call(d.childNodes).forEach(function(x){if(x.nodeType===3&&/you can still clock in/i.test(x.nodeValue))x.nodeValue=' ';});
    if(b)b.textContent='✓ You can work now. Please finish these soon'+(n?' ('+n+' item'+(n===1?'':'s')+')':'')+'.';var a=d.querySelector('a[href="#/checklist"]');if(a)a.textContent='Open the list →';}
  var t=root.querySelector('#todocount');if(t&&!t.dataset.hr&&/please do them soon/i.test(t.textContent)){t.dataset.hr='1';var bb=t.querySelector('b');var mm=bb&&/^(\d+)/.exec(bb.textContent);var rest=t.textContent.replace(/^[\s\S]*?please do them soon\.\s*/i,'');
    t.innerHTML='<b>✓ You can work now. Please finish these soon.</b> '+(mm?E(mm[1])+' item'+(mm[1]==='1'?'':'s')+' for you.':'')+(rest?' '+E(rest):'');}}
function fixBreak(root){var bx=root.querySelector('.breakbox');if(!bx||bx.dataset.hr)return;bx.dataset.hr='1';var b=bx.querySelector('b');if(b&&/did not get my break/i.test(b.textContent))b.textContent='I did not get my break. (You will be paid for it.)';
  var s=bx.querySelector('small');if(s&&/You will be paid for it/.test(s.textContent))s.textContent='Tick this if your break was missed or cut short. The office is told.';}
function fixModule(root){[].forEach.call(root.querySelectorAll('details'),function(d){var s=d.querySelector('summary');if(!s||!/Read the module/.test(s.textContent))return;var p=d.querySelector('p.small');if(!p||p.dataset.hr)return;
  var parts=p.textContent.replace(/([.;])\s+(?=[A-Z"(])/g,'$1\n').replace(/;\s+/g,';\n').split('\n').map(function(x){x=x.trim().replace(/;$/,'.');return x.charAt(0).toUpperCase()+x.slice(1);}).filter(Boolean);if(parts.length<2)return;
  var ul=document.createElement('ul');ul.className='small hr-module';ul.innerHTML=parts.map(function(x){return '<li>'+E(x)+'</li>';}).join('');p.dataset.hr='1';p.style.display='none';p.parentNode.insertBefore(ul,p);});}
/* manual hours: hour + minutes instead of one 96-line list (the original select stays the form field) */
function fixTimeSelects(root){[].forEach.call(root.querySelectorAll('select.mt-time'),function(s){if(s.dataset.hr||s.options.length<40)return;s.dataset.hr='1';
  var v=s.value||'07:00',hh=v.slice(0,2),mm=v.slice(3,5);var w=document.createElement('span');w.className='hr-hm';
  var hs='<select class="hr-h" aria-label="Hour">';for(var h=0;h<24;h++){var H=(h<10?'0':'')+h;hs+='<option value="'+H+'"'+(H===hh?' selected':'')+'>'+H+'</option>';}hs+='</select>';
  var ms='<select class="hr-m" aria-label="Minutes">';['00','15','30','45'].forEach(function(M){ms+='<option value="'+M+'"'+(M===mm?' selected':'')+'>:'+M+'</option>';});ms+='</select>';
  w.innerHTML=hs+ms;s.style.display='none';s.parentNode.insertBefore(w,s.nextSibling);
  var sync=function(){var nv=w.querySelector('.hr-h').value+':'+w.querySelector('.hr-m').value;if(s.value!==nv){s.value=nv;s.dispatchEvent(new Event('change',{bubbles:true}));s.dispatchEvent(new Event('input',{bubbles:true}));}};
  w.addEventListener('change',sync);sync();});}
var busy=false;function pass(){if(busy)return;busy=true;try{var root=document.getElementById('app')||document.body;
  if(!(typeof ME!=='undefined'&&ME)||isWorkerSide())addPwHints(document.body);
  if(isWorkerSide()){walkText(document.body);fixCantClock(root);fixWorkNow(root);fixBreak(root);fixModule(root);fixTimeSelects(document.body);}
}catch(e){try{console.warn('[hrreview] pass',e);}catch(x){}}finally{busy=false;}}
var sched=false;function kick(){if(sched)return;sched=true;(window.requestAnimationFrame||setTimeout)(function(){sched=false;pass();});}
function startObs(){try{new MutationObserver(function(){if(!busy)kick();}).observe(document.body,{childList:true,subtree:true});}catch(e){}kick();}
if(document.body)startObs();else document.addEventListener('DOMContentLoaded',startObs);
window.hrReview={pass:pass,pwExample:pwExample};
})();
