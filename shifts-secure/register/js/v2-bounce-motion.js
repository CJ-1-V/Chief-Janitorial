/* Bouncing-square loader + busy indicator + motion polish (Oct 6, 2026; test copy + live). Pairs with css/bounce-motion.css.
   - Full-screen loader (the unscramble.ca bouncing square) on first load; fades out once the app has drawn its
     first screen (at least 0.7 s so one full bounce shows, as unscramble.ca did); hard stop at 4 s.
   - Small bouncing square as the busy sign: inside a button the app marks busy (aria-busy, .busy/.loading, or
     disabled with "Saving…"-style text), and a small "Saving…" chip for fetch/XHR calls, file reading, and saves.
   - No other file is changed: hooks wrap afterRender, fetch, XMLHttpRequest and FileReader, and listen to events.
   Off switch: add ?motion=off to the address, or localStorage 'us-motion-off' = '1', or remove the 2 lines in index.html.
   prefers-reduced-motion: no loader, busy square stands still.
   signinload1 (Oct 6, 2026): the same full-screen loader also shows from the moment the sign-in form is sent until the
   signed-in screen is drawn (a wrong login hides it and the usual message shows), and on a page load it stays up until
   the first real screen is drawn (saved sign-in restored) instead of being cut off at 4 s. See section 1b. */
(function(){
  var W=window,D=document,H=D.documentElement;
  var off=false;try{off=/[?&#]motion=off\b/.test(location.search+location.hash)||localStorage.getItem('us-motion-off')==='1';}catch(e){}
  var mq=W.matchMedia?W.matchMedia('(prefers-reduced-motion: reduce)'):null;
  function reduced(){return !!(mq&&mq.matches);}
  var T0=Date.now();function now(){return (W.performance&&performance.now)?performance.now():Date.now()-T0;}
  var MIN_SHOW=700,MAX_SHOW=4000,FADE=400;
  var firstRender=0,renders=0,hidden=false,loaded=D.readyState==='complete';

  /* ---------- 1. Full-screen loader ---------- */
  function gone(){H.classList.add('usb-gone');}
  function hideLoader(){
    if(hidden)return;hidden=true;dropBoot();
    if(off||reduced()){H.classList.add('usb-done');gone();return;}
    H.classList.add('usb-done');reveal();setTimeout(gone,FADE+80);
  }
  function reveal(){
    try{
      var app=D.getElementById('app');if(!app||!firstRender||!H.classList.contains('motion'))return;
      var kids=app.querySelectorAll('#main > *');for(var i=0;i<kids.length;i++)kids[i].style.setProperty('--mi',Math.min(i,6));
      app.classList.add('usb-reveal');
      /* remove only after css/motion.css's own first-load classes are gone (render + 1.5 s), so nothing replays */
      setTimeout(function(){app.classList.remove('usb-reveal');},Math.max(1300,firstRender+1800-now()));
    }catch(e){}
  }
  function scheduleHide(){
    var due=Math.max(MIN_SHOW,firstRender+250);
    function go(){setTimeout(hideLoader,Math.max(0,due-now()));}
    if(loaded)go();
    else{W.addEventListener('load',function(){loaded=true;go();});setTimeout(hideLoader,Math.max(0,Math.min(firstRender+1500,MAX_SHOW)-now()));}
  }
  if(off){H.classList.add('usb-off');hidden=true;}
  else if(reduced()){hidden=true;H.classList.add('usb-done');gone();}
  setTimeout(function(){if(!(waiting&&waiting.why==='boot'))hideLoader();},Math.max(0,MAX_SHOW-now())); /* safety: never stuck (the boot hold in 1b has its own) */

  /* ---------- 1b. Same loader while signing in / while a saved sign-in is restored (signinload1) ----------
     Before: after pressing Sign in, the data layer's "Signing in…" note (#reg-busy: a .toast pinned to the top AND the
     bottom) stretched into a tall near-black panel until the account had loaded (about 1 s); css/bounce-motion.css now
     keeps that note a small light chip. Here: html.usb-wait (white cover + navy square, css section 1b) shows from the
     moment the sign-in form is sent until the signed-in screen is drawn; if sign-in fails (wrong login, no connection,
     no registration account) it hides and the usual message shows. Shown at least 0.45 s so it never blinks.
     On a page load (saved sign-in being restored, or the sign-in page) it stays up until the first real screen is
     drawn, instead of the 3.6-4 s cut-off that could show the plain "Loading…" card. Safety stop 15 s.
     Off switch / prefers-reduced-motion: nothing here (as with the first-load loader). */
  var WAIT_MIN=450,WAIT_MAX=15000,WAIT_FADE=240,waiting=null;
  function signedIn(){try{return typeof ME!=='undefined'&&!!ME;}catch(e){return false;}}
  function showWait(why){
    if(off||reduced()||waiting)return;
    var w=waiting={why:why,at:now(),focus:null};
    H.classList.remove('usb-wait-out');H.classList.add('usb-wait');
    if(why!=='boot'){
      H.classList.add('usb-wait-in');setTimeout(function(){H.classList.remove('usb-wait-in');},220);
      try{var a=D.activeElement;if(a&&a!==D.body&&a.blur){w.focus=a;a.blur();}}catch(e){} /* closes the phone keyboard so the loader is in view */
    }
    try{H.setAttribute('aria-busy','true');}catch(e){}
    w.safety=setTimeout(function(){if(w.why==='boot')hideLoader();else endWait(w,true);},WAIT_MAX);
  }
  function endWait(w,quick,refocus){
    if(!w||w!==waiting||w.ending||w.why==='boot')return;w.ending=true;
    setTimeout(function(){
      if(waiting!==w)return;waiting=null;clearTimeout(w.safety);try{clearChips();}catch(e){}
      try{H.removeAttribute('aria-busy');}catch(e){}
      if(refocus&&w.focus&&w.focus.isConnected){try{w.focus.focus({preventScroll:true});}catch(e){}}
      H.classList.add('usb-wait-out');
      setTimeout(function(){if(!waiting)H.classList.remove('usb-wait','usb-wait-in','usb-wait-out');},WAIT_FADE+30);
      if(chip)paintChip();
    },quick?0:Math.max(0,WAIT_MIN-(now()-w.at)));
  }
  function dropBoot(){
    var w=waiting;if(!w||w.why!=='boot')return;waiting=null;clearTimeout(w.safety);
    H.classList.remove('usb-wait','usb-wait-in','usb-wait-out');try{H.removeAttribute('aria-busy');}catch(e){}
    if(chip)paintChip();
  }
  /* page load: hold the loader until the first real screen (only if the CSS loader is still up, i.e. before 3.4 s) */
  if(!hidden&&now()<3400)showWait('boot');
  /* sign-in: wrap the final sign-in handler (store-supabase.js -> v2-pwreset.js in the live app; security.js in the test copy) */
  if(!off&&W.FORMS&&typeof FORMS.login==='function'){
    var oLogin=FORMS.login;
    FORMS.login=function(f,d){
      showWait('signin');var w=waiting,r;
      function settle(){if(w&&waiting===w&&!signedIn())endWait(w,false,true);} /* not signed in: hide, the message shows */
      try{r=oLogin.apply(this,arguments);}catch(e){settle();throw e;}
      if(r&&typeof r.then==='function')r.then(settle,settle);else setTimeout(settle,0);
      return r;
    };
  }
  /* coming back with the browser's Back button to a page kept in memory: never show a leftover loader */
  W.addEventListener('pageshow',function(e){if(e.persisted&&waiting){if(waiting.why==='boot')hideLoader();else endWait(waiting,true);}});

  if(typeof W.afterRender==='function'){
    var oa=W.afterRender;
    afterRender=function(root){
      oa(root);
      try{if(root&&root.id==='app'){renders++;if(!firstRender){firstRender=now();if(!hidden)scheduleHide();}
        if(waiting&&waiting.why==='signin'&&signedIn())endWait(waiting);}}catch(e){}
    };
  }
  if(off){W.USMotion={off:true,hideLoader:function(){}};return;}

  /* ---------- 2. Busy indicator ---------- */
  var SQ='<span class="usb-sq" aria-hidden="true"><i></i></span>';
  var chip=null,active=[],chipShownAt=0;
  function chipEl(){
    if(!chip||!chip.isConnected){chip=D.createElement('div');chip.id='usb-chip';chip.setAttribute('role','status');chip.setAttribute('aria-live','polite');
      chip.innerHTML=SQ+'<span class="usb-txt"></span>';D.body.appendChild(chip);}
    return chip;
  }
  function clearChips(){active.forEach(function(tok){tok.done=true;clearTimeout(tok.t);});active=[];try{var el=document.getElementById('reg-busy');if(el)el.remove();}catch(e){}paintChip();}
  function paintChip(){
    var c=chipEl();
    if(active.length&&!waiting){c.querySelector('.usb-txt').textContent=active[active.length-1].label;if(!c.classList.contains('on')){chipShownAt=now();void c.offsetWidth;c.classList.add('on');}}
    else c.classList.remove('on');
  }
  /* busy('Saving…',{delay:ms before showing, min:ms shown at least}) -> call the returned function when done */
  function busy(label,o){
    o=o||{};var delay=o.delay||0,min=o.min==null?450:o.min;
    var tok={label:label||'Working…',shown:false,done:false,at:0};
    function show(){if(tok.done)return;tok.shown=true;tok.at=now();active.push(tok);paintChip();}
    if(delay>0)tok.t=setTimeout(show,delay);else show();
    return function(){
      if(tok.done)return;tok.done=true;clearTimeout(tok.t);if(!tok.shown)return;
      setTimeout(function(){var i=active.indexOf(tok);if(i>=0)active.splice(i,1);paintChip();},Math.max(0,min-(now()-tok.at)));
    };
  }
  /* inline square inside a button; returns a function that removes it */
  function busyButton(b){
    if(!b||b.classList.contains('usb-busy'))return function(){};
    b.classList.add('usb-busy');b.insertAdjacentHTML('afterbegin',SQ);
    return function(){b.classList.remove('usb-busy');var s=b.querySelector(':scope > .usb-sq');if(s)s.remove();};
  }
  function track(p,label,btn){var d=busy(label,{delay:150}),db=btn?busyButton(btn):null;function end(){d();if(db)db();}
    if(p&&typeof p.then==='function')p.then(end,end);else end();return p;}

  /* buttons the app itself marks as busy */
  var BUSY_TXT=/(…|\.\.\.)\s*$|\b(saving|sending|uploading|loading|signing in|please wait|processing)\b/i;
  function isBusyBtn(b){
    if(b.getAttribute('aria-busy')==='true')return true;
    var c=b.classList;if(c.contains('busy')||c.contains('loading')||c.contains('is-loading'))return true;
    return !!(b.disabled&&BUSY_TXT.test((b.textContent||'').trim()));
  }
  function syncBtn(b){
    var want=isBusyBtn(b);
    if(want&&!b._usbDone)b._usbDone=busyButton(b);
    else if(!want&&b._usbDone){var d=b._usbDone;b._usbDone=null;d();}
  }
  try{
    new MutationObserver(function(list){
      for(var i=0;i<list.length;i++){var t=list[i].target;if(t.nodeType===1&&(t.tagName==='BUTTON'||(t.classList&&t.classList.contains('btn'))))syncBtn(t);}
    }).observe(D.documentElement,{subtree:true,attributes:true,attributeFilter:['disabled','aria-busy','class']});
  }catch(e){}

  /* remember the last pressed button so network calls can show the square inside it */
  var lastPress=null;
  D.addEventListener('pointerdown',function(e){var b=e.target&&e.target.closest&&e.target.closest('button,.btn');lastPress=b?{el:b,t:now()}:null;},{capture:true,passive:true});
  D.addEventListener('touchstart',function(){},{passive:true}); /* lets iOS show :active press feedback */
  function pressedBtn(){return lastPress&&now()-lastPress.t<1500&&lastPress.el.isConnected?lastPress.el:null;}

  /* fetch / XHR (the live app talks to the server; the test copy has none, so this rarely shows here) */
  function netLabel(m,u){u=String(u||'');if(/\/auth\/v1\/token|reg_login_email/.test(u))return 'Signing in…';if(/\/auth\/v1\/signup/.test(u))return 'Sending…';return /^(GET|HEAD)$/i.test(m||'GET')?'Loading…':'Saving…';}
  if(typeof W.fetch==='function'){
    var of=W.fetch;
    W.fetch=function(input,init){
      var m=(init&&init.method)||(input&&typeof input==='object'&&input.method)||'GET';
      var d=busy(netLabel(m,typeof input==='string'?input:(input&&input.url)),{delay:200,min:400}),b=pressedBtn(),db=b?busyButton(b):null;function end(){d();if(db)db();}
      var p;try{p=of.apply(W,arguments);}catch(e){end();throw e;}
      p.then(end,end);return p;
    };
  }
  if(W.XMLHttpRequest){
    var xo=XMLHttpRequest.prototype.open,xs=XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open=function(m,u){this._usbM=m;this._usbU=u;return xo.apply(this,arguments);};
    XMLHttpRequest.prototype.send=function(){
      try{var d=busy(netLabel(this._usbM,this._usbU),{delay:200,min:400});this.addEventListener('loadend',function(){d();});}catch(e){}
      return xs.apply(this,arguments);
    };
  }
  /* reading an uploaded file (photo / PDF / CSV) */
  if(W.FileReader){
    ['readAsDataURL','readAsText','readAsArrayBuffer','readAsBinaryString'].forEach(function(k){
      var o=FileReader.prototype[k];if(typeof o!=='function')return;
      FileReader.prototype[k]=function(){
        try{var d=busy('Reading file…',{delay:120,min:400});this.addEventListener('loadend',function(){d();});}catch(e){}
        return o.apply(this,arguments);
      };
    });
  }

  /* Saves in this test copy are instant (no server), so after a form or save button actually does something
     (new screen, pop-up closed, page changed) a short "Saving…" chip confirms it. Nothing shows for errors. */
  function labelFor(name){
    name=name||'';
    if(/^(login|twofa)$/.test(name))return 'Signing in…';
    if(/(filter|range)$|^(pasthrs|docyears)$/i.test(name))return 'Loading…';
    if(/^(upload|pastinv|recup)$/.test(name))return 'Uploading…';
    if(/crew|order|book|shift|firmchg|invite|feedback|reset1|signup|send/i.test(name))return 'Sending…';
    return 'Saving…';
  }
  /* buttons (data-act) that commit something; others (open, view, filter, download...) never show it */
  var SAVE_ACTS=('clockin clockin2 clockout clockout2 clockoutyes book unbook approveacct approvenew declinenew apsend apdone '+
    'apresendyes clientinvpaid invsubmit invreviewed invunhold holdrel reinstate suspend verifybank verifyempbank rejectdoc '+
    'pastbulkgook pastinvdelok trainconfirm confirmlic crewinall crewoutall pwemailsend pwresetyes mdfollow wpupdated wpadded '+
    'codec cocancel minwagedel mtvoid clinvite clinvrevoke toggleactive unlock forcereset').split(' ');
  function isSaveAct(a){return SAVE_ACTS.indexOf(a)>=0||/^(save|send|submit|approve|confirm|upload)/i.test(a);}
  var pend=null;
  function snap(){return {r:renders,h:location.hash,m:!!D.getElementById('modal')};}
  function changed(s,el){return renders>s.r||location.hash!==s.h||(!!D.getElementById('modal'))!==s.m||(el&&!el.isConnected);}
  D.addEventListener('submit',function(e){var f=e.target;if(f&&f.dataset&&f.dataset.form&&e.submitter)pend={s:snap(),el:f,label:labelFor(f.dataset.form)};},true);
  W.addEventListener('submit',function(){var p=pend;pend=null;if(p&&changed(p.s,p.el)&&!(waiting&&waiting.why==='signin'))flash(p.label);});
  var pendA=null;
  D.addEventListener('click',function(e){
    var el=e.target&&e.target.closest&&e.target.closest('[data-act]');if(!el)return;
    var a=el.dataset.act||'';if(isSaveAct(a))pendA={s:snap(),el:el,label:/^clock/.test(a)?'Saving…':labelFor(a)};
  },true);
  W.addEventListener('click',function(){var p=pendA;pendA=null;if(p)setTimeout(function(){if(changed(p.s,p.el))flash(p.label);},0);});
  function flash(label){busy(label,{min:550})();}
  /* hashchange renders run after the submit/click, so give them one tick */
  var _flash=flash;flash=function(l){setTimeout(function(){_flash(l);},0);};

  W.USMotion={busy:busy,button:busyButton,track:track,hideLoader:hideLoader,showWait:showWait,clearChips:clearChips,
    state:function(){return {firstRender:firstRender,renders:renders,loaderHidden:hidden,waiting:waiting?waiting.why:''};}};
})();
