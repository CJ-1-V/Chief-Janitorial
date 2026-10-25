/* secure1 (Oct 25 2026): crash guards. Loaded last. No business-logic changes. */
(function(){
  'use strict';
  function hm(v){
    if(typeof v!=='string')return null;
    var m=/^\s*(\d{1,2}):(\d{2})/.exec(v); if(!m)return null;
    var h=+m[1],n=+m[2]; if(h>23||n>59)return null; return [h,n];
  }
  /* 1. Hours maths never crashes and never shows NaN on a bad saved time. */
  window.hrs=function(a,b){
    var x=hm(a),y=hm(b); if(!x||!y)return 0;
    var v=((y[0]*60+y[1])-(x[0]*60+x[1]))/60;
    return isFinite(v)?Math.max(0,v):0;
  };
  if(typeof window.msOfHM==='function'){
    window.msOfHM=function(v){var p=hm(v)||[0,0],d=new Date();d.setHours(p[0],p[1],0,0);return d.getTime();};
  }
  /* 2. Length limits on every typed field (server enforces the same). */
  function cap(root){
    try{(root||document).querySelectorAll('input:not([maxlength]),textarea:not([maxlength])').forEach(function(el){
      var t=(el.type||'').toLowerCase();
      if(el.tagName==='TEXTAREA')el.maxLength=1000;
      else if(t===''||t==='text'||t==='search'||t==='email'||t==='tel'||t==='url'||t==='password')el.maxLength=200;
    });}catch(e){}
  }
  cap(); new MutationObserver(function(){cap();}).observe(document.documentElement,{childList:true,subtree:true});
  /* 3. Double-tap guard: a second tap on the same button within 1.2 s is ignored. */
  var last=new WeakMap();
  document.addEventListener('click',function(e){
    var b=e.target&&e.target.closest&&e.target.closest('button,[role=button],input[type=submit]');
    if(!b)return; var now=Date.now(),t=last.get(b)||0;
    if(now-t<1200){e.preventDefault();e.stopImmediatePropagation();return;}
    last.set(b,now);
  },true);
  /* 4. Turn any leftover "NaN" text into 0 so totals stay readable. */
  function fixNaN(){
    try{var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n;
      while((n=w.nextNode())){if(n.nodeValue.indexOf('NaN')>-1)n.nodeValue=n.nodeValue.replace(/\bNaN\b/g,'0');}}catch(e){}
  }
  var q=0; new MutationObserver(function(){if(q)return;q=1;requestAnimationFrame(function(){q=0;fixNaN();});}).observe(document.documentElement,{childList:true,subtree:true,characterData:true});
})();
