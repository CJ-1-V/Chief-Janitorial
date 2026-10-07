/* dlapp1 – "Download the app" + first-sign-in guided tour (owner Oct 7 2026 1:34 AM ET: "Add the button to download app in menu section of
   employees"; 1:36 AM: "On first download give everyone a tour according to their role and help them download the app, even for clients").
   There is no app-store app: "download" = add UnScramble to the home screen (web app, manifest.webmanifest).
   - Every role gets "Download the app" + "Replay tour":
       workers / crew leads / employees: two tiles at the bottom of the Menu (Sign out stays last);
       subcontractors: "📲 App" button in the Menu bar + both items in the header next to Sign out (Sign out stays last);
       farms / clients, office, testers: in the header, just before Sign out.
   - Android / Chrome / Edge: the browser's own install prompt (beforeinstallprompt). iPhone / iPad Safari: a short sheet
     "Tap Share, then Add to Home Screen". Otherwise: short instructions. Opened from the installed app: shows "App installed".
   - Tour: 4–6 steps per role, once per person (account field tourSeenAt, + localStorage "us-tour-done:<user id>" on the device), Skip at any time, last step offers
     the download (left out when already inside the installed app). No farm or client names in any step.
   No links to any website, no network calls, no service worker (Chrome no longer needs one to install). Turn off: remove the script tag. */
(function(){
  if(typeof layout!=='function')return;
  var deferred=null;
  window.addEventListener('beforeinstallprompt',function(e){e.preventDefault();deferred=e;});
  window.addEventListener('appinstalled',function(){deferred=null;try{localStorage.setItem('us-app-installed','1');}catch(x){}try{toast('UnScramble was added to your home screen.');}catch(x){}});
  function standalone(){try{return (window.matchMedia&&(matchMedia('(display-mode: standalone)').matches||matchMedia('(display-mode: fullscreen)').matches||matchMedia('(display-mode: minimal-ui)').matches))||navigator.standalone===true||/[?&]dlapp=standalone/.test(location.search);}catch(e){return false;}}
  function ios(){var u=navigator.userAgent||'';return /iPhone|iPad|iPod/i.test(u)||(/Macintosh/.test(u)&&navigator.maxTouchPoints>1);}
  function android(){return /Android/i.test(navigator.userAgent||'');}
  var esc2=function(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});};
  var EMPMENU={worker:1,employee:1};
  function appTile(){var inst=standalone();
    return '<button type="button" class="menu-item dl-tile'+(inst?' dl-done':'')+'" data-act="dlapp" id="dlapptile"'+(inst?' aria-disabled="true"':'')+'><span class="mi" aria-hidden="true">📲</span><span class="mt"><b>'+(inst?'App installed':'Download the app')+'</b><small>'+(inst?'You are using the UnScramble app':'Add UnScramble to your home screen')+'</small></span>'+(inst?'<span class="chev" aria-hidden="true">✓</span>':'<span class="chev" aria-hidden="true">›</span>')+'</button>'+
      '<button type="button" class="menu-item dl-tile" data-act="dltour" id="dltourtile"><span class="mi" aria-hidden="true">🧭</span><span class="mt"><b>Replay tour</b><small>A quick look at your main screens</small></span><span class="chev" aria-hidden="true">›</span></button>';}
  function hdrBtns(){var inst=standalone();return '<button type="button" class="small sec dl-hbtn" data-act="dlapp" id="dlapphdr"'+(inst?' aria-disabled="true"':'')+'>'+(inst?'✓ App installed':'📲 Download the app')+'</button><button type="button" class="small sec dl-hbtn" data-act="dltour" id="dltourhdr">🧭 Replay tour</button> ';}
  var ol=layout;
  layout=function(content){var x=ol.apply(this,arguments);
    try{if(typeof ME!=='undefined'&&ME&&ME.accountApproved!==false){
      if(EMPMENU[ME.type]){/* Menu tiles are added to the drawn page (see addTiles) */}
      else{var SO='<button class="small sec" data-act="logout">';if(x.indexOf(SO)>=0&&x.indexOf('id="dlapphdr"')<0)x=x.replace(SO,hdrBtns()+SO);
        if(ME.type==='sub'){var IB='<button type="button" class="small sec infobtn"';if(x.indexOf(IB)>=0)x=x.replace(IB,'<button type="button" class="small sec dl-mbtn" data-act="dlapp" id="dlappbar" title="Download the app">📲 App</button>'+IB);}}
    }}catch(e){}return x;};
  /* ---------- install / instructions ---------- */
  function sheet(kind){
    var shareIc='<svg class="dl-share" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
    var head='<div class="dl-sheet"><div class="dl-hd"><img src="assets/unscramble-app-192.png" alt="" width="56" height="56"><div><h2>Download the app</h2><div class="small muted">UnScramble on your home screen – opens full-screen, like any other app.</div></div></div>';
    var body;
    if(kind==='installed')body='<p class="dl-ok">✓ You are already using the UnScramble app.</p>';
    else if(kind==='ios')body='<ol class="dl-steps"><li><span class="dl-n">1</span><span>Tap <b>Share</b> '+shareIc+' at the bottom of Safari (top right on iPad).</span></li><li><span class="dl-n">2</span><span>Scroll down and tap <b>Add to Home Screen</b> <span class="dl-plus" aria-hidden="true">＋</span>.</span></li><li><span class="dl-n">3</span><span>Tap <b>Add</b>. Open UnScramble from your home screen next time.</span></li></ol><p class="small muted">Use Safari – other iPhone browsers may not show this option.</p>';
    else if(kind==='android')body='<ol class="dl-steps"><li><span class="dl-n">1</span><span>Tap the browser menu <b>⋮</b> (top right).</span></li><li><span class="dl-n">2</span><span>Tap <b>Install app</b> or <b>Add to Home screen</b>.</span></li><li><span class="dl-n">3</span><span>Tap <b>Install</b>. Open UnScramble from your home screen next time.</span></li></ol>';
    else body='<ol class="dl-steps"><li><span class="dl-n">1</span><span>In Chrome or Edge, click the <b>install</b> icon at the right end of the address bar, or open the browser menu <b>⋮</b>.</span></li><li><span class="dl-n">2</span><span>Choose <b>Install UnScramble</b> (Chrome: <b>Cast, save and share → Install page as app</b>).</span></li><li><span class="dl-n">3</span><span>UnScramble opens in its own window and gets a desktop / dock icon.</span></li></ol><p class="small muted">On a phone it is quicker: open this page on your phone and use <b>Download the app</b> there.</p>';
    modal(head+body+'<div class="row" style="margin-top:12px"><button type="button" data-act="closeModal">Done</button></div></div>');}
  window.dlappInstall=function(){
    if(standalone()){sheet('installed');return;}
    if(deferred){var d=deferred;deferred=null;try{d.prompt();(d.userChoice||Promise.resolve({})).then(function(c){if(c&&c.outcome==='accepted'){try{toast('Installing UnScramble…');}catch(x){}}if(typeof render==='function')render();});}catch(e){sheet(ios()?'ios':android()?'android':'desktop');}return;}
    sheet(ios()?'ios':android()?'android':'desktop');};
  window.dlappSheet=sheet;
  if(typeof ACT==='object'){ACT.dlapp=function(){if(window.dlTourClose)dlTourClose(false);dlappInstall();};ACT.dltour=function(){startTour(true);};}
  /* ---------- tour ---------- */
  var DL={id:'__dl',t:'Download the app',d:'Put UnScramble on your home screen so it is one tap away. iPhone: Share → Add to Home Screen. Android / computer: Install.'};
  function steps(){var u=ME,s;
    if(u.type==='worker'||u.type==='employee'){s=[
      {sel:'.tabbar a[href="#/home"]',t:'Clock',d:'Pick your site and tap Clock in when you start, Clock out when you finish. Your breaks are worked out for you.'},
      {sel:'.tabbar a[href="#/shifts"]',t:'My shifts & hours',d:'See your shifts and the hours you have worked.'},
      {sel:'main a[href="#/training"]',alt:'.tabbar a[href="#/menu"]',t:'Training & quizzes',d:'Finish your safety training and quizzes before your first shift. You find it any time in the Menu.'}];
      if(u.crewLead)s.push({sel:'main a[href="#/crew"]',alt:'.tabbar a[href="#/menu"]',t:'Clock my crew',d:'As a crew lead you can clock your crew in and out from here (also in the Menu).'});
      s.push({sel:'.tabbar a[href="#/menu"]',t:'Menu',d:'Your documents, registration checklist, availability, alerts, Download the app, Replay tour and Sign out.'});}
    else if(u.type==='sub'){s=[
      {sel:'main h1',t:'Dashboard',d:'Your company at a glance: checklist, agreements and what needs your attention.'},
      {sel:'#navsel',t:'Menu',d:'Open the Menu for My workers, Workers\' hours, Crew assignments, Invoices and more.'},
      {sel:'main a[href="#/workers"]',alt:'#navsel',t:'Crew training',d:'See which of your workers still have training or quizzes to finish (My workers).'},
      {sel:'#navsel',t:'Workers\' hours',d:'Choose Workers\' hours in the Menu to check the hours your crew worked.'},
      {sel:'#dlapphdr',t:'App & tour',d:'Download the app and Replay tour are here at the top, next to Sign out.'}];}
    else if(u.type==='firm'){s=[
      {sel:'main a.fh-orderbtn',alt:'main a[href="#/orders"]',t:'Order a crew',d:'Ask for people for one day or on a recurring schedule. The office confirms.'},
      {sel:'#fhcoming',t:'Crew coming',d:'How many people are coming in the next days – Pending or Confirmed by the office.'},
      {sel:'#fhperiod',t:'Period total',d:'Hours and cost for the period you choose: this week, pay period, last month or custom.'},
      {sel:'main table',alt:'#fhperiod',t:'Timesheets',d:'Each day\'s hours. Use “Ask to change hours” if something is not right, or download a CSV.'},
      {sel:'.tabbar a[href="#/invoices"]',alt:'nav a[href="#/invoices"]',t:'Invoices',d:'Your invoices and agreements, ready to print or save as PDF.'}];}
    else if(u.type==='admin'){s=[
      {sel:'#obar a[href="#/home"],nav a[href="#/home"]',alt:'main h1',t:'Daily work',d:'Overview: today\'s numbers and what needs action.'},
      {sel:'#obar a[href="#/review"],nav a[href="#/review"]',alt:'#obar',t:'Approvals',d:'Review & approve new accounts, then late entries, manual hours and farm time changes.'},
      {sel:'#obar a[href="#/creworders"],nav a[href="#/creworders"]',alt:'#obar',t:'Crew orders',d:'Orders from farms and clients come in here.'},
      {sel:'#obar a[href="#/crewcoming"],nav a[href="#/crewcoming"]',alt:'#obar',t:'Crew coming',d:'Set and confirm how many people go to each farm or client per day – they see it on their Home screen.'},
      {sel:'#dlapphdr',t:'App & tour',d:'Download the app and Replay tour are at the top, next to Sign out.'}];}
    else s=[{sel:'main h1',t:'Welcome',d:'This is your home screen.'},{sel:'#dlapphdr',t:'App & tour',d:'Download the app and Replay tour are at the top, next to Sign out.'}];
    if(!standalone())s.push(DL);
    return s;}
  function key(){return 'us-tour-done:'+(ME&&ME.id);}
  /* seen = the person's own account record (tourSeenAt – saved with the account like any other own field, no migration; follows the
     person to every device) OR this device's localStorage (fallback if the account save does not go through) */
  function seen(){if(ME&&ME.tourSeenAt)return true;try{return !!localStorage.getItem(key());}catch(e){return true;}}
  function markSeen(){var t=new Date().toISOString();try{if(ME)localStorage.setItem(key(),t);}catch(e){}
    try{if(ME&&!ME.tourSeenAt){ME.tourSeenAt=t;if(typeof save==='function')save();}}catch(e){}}
  var T=null;
  function vis(el){if(!el)return false;var r=el.getBoundingClientRect(),cs=getComputedStyle(el);return r.width>0&&r.height>0&&cs.display!=='none'&&cs.visibility!=='hidden';}
  function find(st){var el=null;String(st.sel||'').split(',').some(function(q){var c=q&&document.querySelector(q.trim());if(vis(c)){el=c;return true;}return false;});
    if(!el&&st.alt){var a=document.querySelector(st.alt);if(vis(a))el=a;}return el;}
  window.dlTourClose=function(done){var o=document.getElementById('dltour');if(o)o.remove();window.removeEventListener('resize',place,true);T=null;markSeen(); /* shown once: finished, skipped or closed all count */};
  function place(){if(!T)return;var o=document.getElementById('dltour');if(!o)return;var st=T.s[T.i],el=st.id==='__dl'?null:find(st),hl=o.querySelector('.dlt-hl'),card=o.querySelector('.dlt-card');
    var vw=document.documentElement.clientWidth,vh=window.innerHeight;
    if(el){try{el.scrollIntoView({block:'center',inline:'nearest'});}catch(e){}var r=el.getBoundingClientRect(),p=6;
      hl.style.display='block';hl.style.left=Math.max(2,r.left-p)+'px';hl.style.top=Math.max(2,r.top-p)+'px';hl.style.width=Math.min(vw-4,r.width+2*p)+'px';hl.style.height=(r.height+2*p)+'px';o.classList.remove('dlt-center');
      var ch=card.offsetHeight||180,below=r.bottom+p+12;card.style.top=(below+ch<vh?below:Math.max(8,r.top-p-12-ch))+'px';}
    else{hl.style.display='none';o.classList.add('dlt-center');card.style.top=Math.max(8,(vh-(card.offsetHeight||220))/2)+'px';}}
  function draw(){var o=document.getElementById('dltour'),st=T.s[T.i],n=T.s.length,last=T.i===n-1;
    o.querySelector('.dlt-card').innerHTML='<div class="dlt-top"><span class="dlt-step">Step '+(T.i+1)+' of '+n+'</span><button type="button" class="dlt-skip" data-tour="skip">Skip tour</button></div>'+
      (st.id==='__dl'?'<img class="dlt-ic" src="assets/unscramble-app-192.png" alt="" width="44" height="44">':'')+'<h3 id="dlt-h">'+esc2(st.t)+'</h3><p>'+esc2(st.d)+'</p>'+
      '<div class="dlt-dots" aria-hidden="true">'+T.s.map(function(_,k){return '<i class="'+(k===T.i?'on':'')+'"></i>';}).join('')+'</div>'+
      '<div class="dlt-btns">'+(T.i?'<button type="button" class="sec" data-tour="back">Back</button>':'<span></span>')+
      (st.id==='__dl'?'<button type="button" class="sec" data-tour="next">Not now</button><button type="button" data-tour="install">📲 Download the app</button>':'<button type="button" data-tour="next">'+(last?'Finish':'Next')+'</button>')+'</div>';
    place();var f=o.querySelector('[data-tour="install"],[data-tour="next"]');try{f&&f.focus({preventScroll:true});}catch(e){}}
  function startTour(force){if(!ME||document.getElementById('dltour'))return;if(!force&&seen())return;
    T={s:steps(),i:0};var o=document.createElement('div');o.id='dltour';o.className='dlt';o.setAttribute('role','dialog');o.setAttribute('aria-modal','true');o.setAttribute('aria-labelledby','dlt-h');
    o.innerHTML='<div class="dlt-hl"></div><div class="dlt-card"></div>';document.body.appendChild(o);
    o.addEventListener('click',function(e){var b=e.target.closest('[data-tour]');if(!b)return;e.preventDefault();e.stopPropagation();var a=b.dataset.tour;
      if(a==='skip'){dlTourClose();return;}if(a==='back'){T.i=Math.max(0,T.i-1);draw();return;}
      if(a==='install'){dlTourClose();dlappInstall();return;}
      if(T.i>=T.s.length-1){dlTourClose();try{toast('Tour finished. Replay it any time from the Menu.');}catch(x){}return;}T.i++;draw();});
    o.addEventListener('keydown',function(e){if(e.key==='Escape')dlTourClose();});
    window.addEventListener('resize',place,true);draw();}
  window.dlTourStart=startTour;
  /* run once after the first signed-in screen is drawn (Home only, account approved, not on the gate screens) */
  var pend=null;
  function check(){if(pend)return;pend=setTimeout(function(){pend=null;
    if(typeof ME==='undefined'||!ME||ME.accountApproved===false||document.getElementById('modal')||document.getElementById('dltour'))return;
    var h=(location.hash||'#/').split('?')[0];if(h!=='#/home'&&h!=='#/'&&h!=='')return;if(!document.querySelector('#app main'))return;
    startTour(false);},900);}
  function addTiles(){if(typeof ME==='undefined'||!ME||!EMPMENU[ME.type]||ME.accountApproved===false)return;
    var ml=document.querySelector('#app .menu-list');if(!ml||document.getElementById('dlapptile'))return;ml.insertAdjacentHTML('beforeend',appTile());}
  function hook(){var app=document.getElementById('app');if(!app)return;new MutationObserver(function(){addTiles();if(T&&!document.querySelector('#app main'))dlTourClose(false);else if(T)place();else check();}).observe(app,{childList:true});}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();addTiles();
  window.addEventListener('hashchange',function(){if(T)setTimeout(place,50);});
})();
