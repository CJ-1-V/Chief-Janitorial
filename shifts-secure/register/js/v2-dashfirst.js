/* dashfirst1 – the office always lands on the normal dashboard (owner Oct 19 2026, 12:28 AM: "can you make sure the Assistant
   changes this week is not on the top and it's always the dashboard").
   CAUSE: js/v2-officehelper.js put the "Assistant changes this week" card IN FRONT of the Overview (above "Office overview"),
   so after sign-in the first thing the full office saw was the assistant's change list, not the dashboard. In live the list loads a
   moment later, so the card also popped in at the top and pushed the dashboard down. A reload also kept the old page / scroll spot.
   FIX (screens only – no permissions, no database, Office Assistant rules and farm-code-only masking unchanged):
   1. Overview: the card moves to the BOTTOM of the dashboard as a closed section "Assistant changes this week (n)". Its title
      still shows "n needs your OK" when something waits for the owner; tap to open the same list + links (See all / Office Assistant page).
   2. Every office login (owner, admin, billing, Office Assistant): when the app is opened or reloaded it starts on Overview, at the top.
      Sign-in already goes to Overview. Inside the app nothing changes (moving between pages, Back, keepscroll).
      Kept: the new-password screen and pages every login needs (#/changepw, #/terms, #/pending).
   Load after v2-officehelper.js and v2-edithours.js, before v2-keepscroll.js. Turn off: remove the script tag in index.html. */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof afterRender!=='function')return;
function isOffice(){try{return typeof ME!=='undefined'&&!!ME&&ME.type==='admin';}catch(e){return false;}}
function route(){return (location.hash||'#/home').split('?')[0]||'#/home';}

/* ---------- 1. "Assistant changes this week": from the top of Overview to a closed section at the bottom ---------- */
var oh=VIEWS['admin:home'];
if(oh)VIEWS['admin:home']=function(){var x=oh.apply(this,arguments);
  if(typeof x!=='string'||x.indexOf('id="ohweek"')<0)return x;
  try{var t=document.createElement('template');t.innerHTML=x;var c=t.content.querySelector('#ohweek');if(!c)return x;
    var h=c.querySelector('h3'),pill=h&&h.querySelector('.pill'),n=pill?pill.textContent.trim():'';
    var warn=c.querySelector('.alert.warn'),need=warn?((warn.textContent.match(/^\s*(\d+)/)||[])[1]||''):'';
    if(h)h.parentNode.removeChild(h);
    var d=document.createElement('details');d.className='sect oh-week df-week';d.id='ohweek';
    d.innerHTML='<summary>Assistant changes this week <span class="pill s-mut">'+esc(n||'0')+'</span>'+
      (need?' <span class="pill s-pend df-need">'+esc(need)+' need'+(need==='1'?'s':'')+' your OK</span>':'')+'</summary>';
    var body=document.createElement('div');body.className='sect-body df-week-body';while(c.firstChild)body.appendChild(c.firstChild);d.appendChild(body);
    c.parentNode.removeChild(c);t.content.appendChild(d);return t.innerHTML;}
  catch(e){try{console.warn('[dashfirst]',e);}catch(z){}return x;}};

/* ---------- 2. app opened / reloaded by an office login: start on Overview, at the top ---------- */
var KEEP=['#/changepw','#/terms','#/pending'],FIRST=true;
try{if(sessionStorage.getItem('df-office')==='1'&&'scrollRestoration' in history)history.scrollRestoration='manual';}catch(e){}
window.addEventListener('pagehide',function(){try{if(isOffice())sessionStorage.setItem('df-office','1');else sessionStorage.removeItem('df-office');}catch(e){}});
var oa=afterRender;afterRender=function(root){oa(root);
  try{if(!FIRST||!root||root.id!=='app'||typeof ME==='undefined'||!ME)return;FIRST=false;if(!isOffice())return;
    try{if('scrollRestoration' in history)history.scrollRestoration='manual';}catch(e){}
    var r=route();
    if(r!=='#/home'&&r!=='#/'&&KEEP.indexOf(r)<0&&!ME.mustChangePw){history.replaceState(null,'','#/home');if(typeof PAGE_STATE!=='undefined')PAGE_STATE.ksTop=true;render();}
    window.scrollTo(0,0);setTimeout(function(){if(route()==='#/home'&&(window.scrollY||0)>0&&!document.querySelector('#modal .modal'))window.scrollTo(0,0);},60);}
  catch(e){try{console.warn('[dashfirst]',e);}catch(z){}}};
})();
