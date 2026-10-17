/* v2-keepscroll.js – keepscroll1 (owner Oct 17 2026, 3:02 PM: "whenever I choose or select something the page goes to top or resets;
   I want to stay at the same place and make changes to continue from there").
   CAUSE: every tap / select / tick that changes something calls render(), which rebuilds the whole page (app.innerHTML=…) and then
   always does window.scrollTo(0,0) (js/ui.js). The rebuild also closes any section you had opened, scrolls inner tables back to the
   left and drops the cursor out of the box you were typing in.
   FIX (one place, no screen edited): render() is wrapped. Before the rebuild we remember the scroll position, the sections you opened / closed,
   inner table scroll and the focused box; after the rebuild – ONLY when it is still the same screen – we put them back:
     same screen = same login + same page address (#/people, #/clockedin …, ignoring ?…) + same main heading (numbers ignored, so
     "People (23)" → "People (22)" is the same screen). A different page, opening a person / farm (heading changes), the next
     sign-up / quiz step etc. still start at the top as before. Going "← Back" to the screen you just came from on the same page
     returns to where you were on it.
   Code that deliberately moves the page after render() (scrollIntoView, PAGE_STATE.after) still wins – it runs after us.
   A screen can force the top with PAGE_STATE.ksTop=true before render(). Load after every other script that wraps render
   (just before v2-nohome.js). Turn off: remove the script tag in index.html. */
(function(){
'use strict';
if(typeof render!=='function')return;
var SEL_DET='details',SEL_INNER='.tw,.table-wrap,[data-keepscroll]';
function who(){try{return (typeof ME!=='undefined'&&ME)?(ME.type+':'+ME.id):'-';}catch(e){return '-';}}
function route(){return (location.hash||'#/').split('?')[0]||'#/';}
function head(){var m=document.getElementById('main')||document.getElementById('app');if(!m)return '';
  var h=m.querySelector('h1')||m.querySelector('h2');return h?String(h.textContent||'').replace(/\d+/g,'#').replace(/\s+/g,' ').trim().slice(0,80):'';}
function curKey(){return who()+'|'+route();}
function sumText(d){var s=d.querySelector('summary');return s?String(s.textContent||'').replace(/\d+/g,'#').replace(/\s+/g,' ').trim().slice(0,60):'';}
function capture(){var app=document.getElementById('app');var s={key:app&&app.getAttribute('data-ks')||'',head:head(),y:window.scrollY||window.pageYOffset||0,x:window.scrollX||0,inner:[],focus:null};
  [].forEach.call(document.querySelectorAll('#app '+SEL_INNER),function(el,i){if(el.scrollLeft||el.scrollTop)s.inner.push({id:el.id,i:i,l:el.scrollLeft,t:el.scrollTop});});
  var a=document.activeElement;if(a&&a!==document.body&&app&&app.contains(a)&&/^(INPUT|SELECT|TEXTAREA|BUTTON)$/.test(a.tagName)){
    var f={tag:a.tagName,id:a.id,name:a.getAttribute('name')||'',act:a.getAttribute('data-act')||'',type:a.type||''};
    var same=[].filter.call(document.querySelectorAll('#app '+a.tagName.toLowerCase()),function(x){return (x.getAttribute('name')||'')===f.name&&(x.getAttribute('data-act')||'')===f.act;});f.n=same.indexOf(a);
    try{if(typeof a.selectionStart==='number'){f.ss=a.selectionStart;f.se=a.selectionEnd;}}catch(e){}s.focus=f;}
  return s;}
function findFocus(f){if(f.id){var e=document.getElementById(f.id);if(e&&e.tagName===f.tag)return e;}
  var same=[].filter.call(document.querySelectorAll('#app '+f.tag.toLowerCase()),function(x){return (x.getAttribute('name')||'')===f.name&&(x.getAttribute('data-act')||'')===f.act;});
  if(!f.name&&!f.act&&!f.id)return null;return same[f.n]||(same.length===1?same[0]:null);}
function restore(s){
  /* sections YOU opened or closed (tap on its title) stay that way; sections the screen opens / closes itself are left to the screen. */
  [].forEach.call(document.querySelectorAll('#app '+SEL_DET),function(d){var k=detKey(d);if(k&&Object.prototype.hasOwnProperty.call(DET,k)&&d.open!==DET[k])d.open=DET[k];});
  var I=document.querySelectorAll('#app '+SEL_INNER);
  s.inner.forEach(function(o){var el=(o.id&&document.getElementById(o.id))||I[o.i];if(el){el.scrollLeft=o.l;el.scrollTop=o.t;}});
  if(s.focus){var e=findFocus(s.focus);if(e&&e!==document.activeElement&&!e.disabled){try{e.focus({preventScroll:true});}catch(x){}
    try{if(s.focus.ss!=null&&typeof e.selectionStart==='number'&&/^(text|search|tel|email|url|password|)$/.test(e.type||'')){var L=String(e.value||'').length;e.setSelectionRange(Math.min(s.focus.ss,L),Math.min(s.focus.se,L));}}catch(x){}}}
  window.scrollTo(s.x,s.y);
  window.KS_LAST={y:s.y,restoredTo:window.scrollY};}
/* Anchor: the thing you just tapped / changed. If rows above it grew or shrank after the rebuild, the page is nudged so that thing
   stays exactly where it was on the screen (only small shifts, under half a screen; if it is gone or moved far away – e.g. into another list – the plain scroll position is kept). */
var ANC=null,DET={};
function detKey(d){var t=d.id||sumText(d);return t?route()+'|'+t:'';}
document.addEventListener('click',function(e){var sm=e.target&&e.target.closest&&e.target.closest('#app details > summary');if(!sm)return;var d=sm.parentNode;
  setTimeout(function(){if(document.contains(d)){var k=detKey(d);if(k)DET[k]=d.open;}},0);},true);
/* a form sent from inside a section: let the screen decide afterwards (e.g. an "Upload" section closes itself after saving) */
document.addEventListener('submit',function(e){var d=e.target&&e.target.closest&&e.target.closest('#app details');if(d){var k=detKey(d);if(k)delete DET[k];}},true);
function ancSig(el){var a=el.closest&&el.closest('#app [data-act],#app [id],#app form[data-form] [name]');if(!a||!document.getElementById('app').contains(a))return null;
  var g={act:a.getAttribute('data-act')||'',id:a.getAttribute('data-id')||'',f:a.getAttribute('data-f')||a.getAttribute('data-d')||a.getAttribute('data-m')||a.getAttribute('data-n')||'',eid:a.id||'',name:a.getAttribute('name')||'',form:(a.form&&a.form.getAttribute('data-form'))||''};
  if(!g.act&&!g.eid&&!g.name)return null;g.top=a.getBoundingClientRect().top;g.at=Date.now();return g;}
function ancFind(g){var L=[];if(g.eid){var e=document.getElementById(g.eid);if(e)return e;}
  if(g.act)L=[].filter.call(document.querySelectorAll('#app [data-act="'+g.act.replace(/"/g,'')+'"]'),function(x){return (x.getAttribute('data-id')||'')===g.id&&(x.getAttribute('data-f')||x.getAttribute('data-d')||x.getAttribute('data-m')||x.getAttribute('data-n')||'')===g.f;});
  else if(g.name)L=[].filter.call(document.querySelectorAll('#app form[data-form="'+g.form.replace(/"/g,'')+'"] [name="'+g.name.replace(/"/g,'')+'"]'),function(){return true;});
  return L.length===1?L[0]:null;}
function remember(e){try{if(e.target&&e.target.closest){var g=ancSig(e.target);if(g)ANC=g;}}catch(x){}}
document.addEventListener('click',remember,true);document.addEventListener('change',remember,true);document.addEventListener('submit',function(e){try{var b=e.submitter||e.target.querySelector('button');if(b){var g=ancSig(b);if(g)ANC=g;}}catch(x){}},true);
function nudge(g){if(!g||Date.now()-g.at>4000)return;var e=ancFind(g);if(!e)return;var d=e.getBoundingClientRect().top-g.top;if(Math.abs(d)>=1&&Math.abs(d)<window.innerHeight*0.5)window.scrollBy(0,d);}
/* Late layout: some screens add parts a moment after the rebuild (boxes, tables re-stacked for phones…), so the page can be shorter
   at the instant we restore. We look again twice (right after, and ~150 ms later) – but never if the app itself moved the page
   on purpose (scrollIntoView / scrollTo after render) or you scrolled / tapped / typed meanwhile. */
var MINE=false,MOVED=0;
(function(){var w=window,oT=w.scrollTo,oB=w.scrollBy,oI=Element.prototype.scrollIntoView;
  function mark(){if(!MINE)MOVED=Date.now();}
  try{w.scrollTo=function(){mark();return oT.apply(this,arguments);};w.scrollBy=function(){mark();return oB.apply(this,arguments);};
    Element.prototype.scrollIntoView=function(){mark();return oI.apply(this,arguments);};}catch(e){}
  ['wheel','touchstart','keydown','mousedown','pointerdown'].forEach(function(t){w.addEventListener(t,function(){MOVED=Date.now();},{capture:true,passive:true});});})();
function own(f){MINE=true;try{f();}finally{MINE=false;}}
function later(s,g,base){var pass=function(){if(MOVED!==base)return;own(function(){
    if(window.scrollY!==s.y&&(document.documentElement.scrollHeight-window.innerHeight)>window.scrollY+1)window.scrollTo(s.x,s.y);nudge(g);});};
  setTimeout(pass,0);setTimeout(pass,150);}
var prev=null; /* the screen we left on this same page (for ← Back) */
function stamp(){var app=document.getElementById('app');if(app)app.setAttribute('data-ks',curKey());}
var r0=render;
var wrapped=function(){
  var s=null;try{s=capture();}catch(e){s=null;}
  var top=!!(typeof PAGE_STATE!=='undefined'&&PAGE_STATE&&PAGE_STATE.ksTop);if(top)PAGE_STATE.ksTop=false;
  var r=r0.apply(this,arguments);
  try{var k=curKey(),h=head();
    if(s&&!top&&s.key===k){
      if(s.head===h){own(function(){restore(s);nudge(ANC);});window.KS_LAST.final=window.scrollY;later(s,ANC,MOVED);}
      else{var p=prev;prev={key:k,head:s.head,snap:s};if(p&&p.key===k&&p.head===h){own(function(){restore(p.snap);});later(p.snap,null,MOVED);}}
    }else prev=null;
    stamp();
  }catch(e){try{console.warn('[keepscroll]',e);}catch(x){}}
  return r;};
render=wrapped;try{window.render=wrapped;}catch(e){}
/* page changes through the address (hashchange → original render → top). Just remember which screen is now showing. */
window.addEventListener('hashchange',function(){prev=null;DET={};stamp();});
stamp();
})();
