/* v2-alertdismiss.js – alertdismiss1 (owner Oct 18 2026, 11:20 PM). TEST COPY.
   "Add a button to clear notification i mean when i dismiss a farm let the notification disapper and when i press same button it comes back."
   - One bell toggle on every farm box that shows the "possibly missing" alert (red "+N?" or yellow "✓ all in"): All hours farm boxes,
     the opened farm (All hours) and Clocked in right now (boxes + opened farm).
     🔔 = alert on → press = hide the badge, the alert text and the suggestion card for THAT farm and day.
     🔕 = alert hidden (button stays, dashed / muted) → press again = everything comes back.
   - The suggestion card's old "Dismiss" button is removed: the one "Hide alert" toggle right above the card does the same job.
     (Dismiss already did the same thing – hid it until a higher crew number – and used the same stored list.)
   - Stored in the existing office settings (reg_settings 'main' → settings.uaDismiss, the list the live Dismiss already writes):
     shared by the whole office, every device, no new SQL. Office users have no account row of their own (staff_roles only), so there
     is no per-user DB place. Office Assistant cannot write settings → their hides are kept on that device only (localStorage).
   - Comes back by itself when a HIGHER crew number is reported for that farm and day than when it was hidden.
   Load after v2-unassigned.js. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function office(){return typeof ME!=='undefined'&&ME&&ME.type==='admin';}
function crewMax(date,site){var mx=0;(DB.time||[]).forEach(function(t){if(t.test||t.removed||t.date!==date)return;var s=t.site;if(!s&&t.shiftId){var sh=(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];s=sh&&sh.site;}if(s!==site)return;
  if(+t.crewIn>0)mx=Math.max(mx,+t.crewIn);if(+t.crew>0&&t.out)mx=Math.max(mx,+t.crew);});return mx;}
/* ---- storage ---- */
function LK(){return 'reg-alert-hidden-'+(ME&&ME.id||'');}
function local(){try{return JSON.parse(localStorage.getItem(LK())||'{}')||{};}catch(e){return {};}}
function setLocal(o){try{localStorage.setItem(LK(),JSON.stringify(o));}catch(e){}}
function shared(){DB.settings=DB.settings||{};return DB.settings.uaDismiss||{};}
function entry(k){if(helper()){var l=local();if(k in l)return l[k];}return shared()[k]||null;}
/* hidden = an entry exists AND no higher crew number came in since */
function hidden(date,site){var e=entry(site+'|'+date);if(!e||e.hide===false)return false;return crewMax(date,site)<=(+e.max||0);}
function prune(o){var cut=addDays(today(),-90);Object.keys(o).forEach(function(k){var d=k.split('|').pop();if(d<cut)delete o[k];});return o;}
function toggle(date,site){var k=site+'|'+date,h=hidden(date,site),now=new Date().toISOString();
  if(helper()){var l=prune(local());if(h){if(shared()[k])l[k]={hide:false,at:now};else delete l[k];}else l[k]={hide:true,max:crewMax(date,site),at:now};setLocal(l);return !h;}
  var o=prune(Object.assign({},shared()));if(h)delete o[k];else o[k]={max:crewMax(date,site),by:ME.name,byId:ME.id,at:now,hide:true};DB.settings.uaDismiss=o;save();return !h;}
window.alertHidden=hidden;
/* ---- buttons ---- */
function bell(date,site,off,big){var lab=(off?'Show alert':'Hide alert')+' – '+site+' '+date;
  return big?'<button type="button" class="small ad-btn'+(off?' ad-off':'')+'" data-ad="'+E(date+'|'+site)+'" aria-pressed="'+(off?'true':'false')+'" aria-label="'+E(lab)+'">'+(off?'🔕 Alert hidden – show alert':'🔔 Hide alert')+'</button>'
    :'<span role="button" tabindex="0" class="ad-bell'+(off?' ad-off':'')+'" data-ad="'+E(date+'|'+site)+'" aria-pressed="'+(off?'true':'false')+'" aria-label="'+E(lab)+'" title="'+E(off?'Alert hidden – tap to show it again':'Hide this alert')+'">'+(off?'🔕':'🔔')+'</span>';}
function hasAlert(b){return !!b.querySelector('.cb-badge');}
function box(b,date,site){var off=hidden(date,site);var old=b.querySelector('.ad-bell');if(old)old.remove();b.classList.toggle('ad-hide',off);
  if(!hasAlert(b))return;b.insertAdjacentHTML('afterbegin',bell(date,site,off));}
function opened(sum,date,site,where){if(!sum)return;var st=sum.querySelector('.cs-st');var alert=st&&/cs-bad|cs-warn/.test(st.className);var sg=document.getElementById('uasug');
  var off=hidden(date,site);var old=sum.parentNode.querySelector('.ad-row[data-w="'+where+'"]');if(old)old.remove();sum.classList.toggle('ad-hide',off);if(sg)sg.classList.toggle('ad-hide',off);
  if(!alert&&!(sg))return;
  sum.insertAdjacentHTML('afterend','<div class="ad-row" data-w="'+where+'">'+bell(date,site,off,true)+(off?' <span class="small muted">Badge, alert and suggestion hidden for '+E(site)+' on '+E(date)+'. It comes back by itself if a higher crew number is reported.</span>':'')+'</div>');}
function sugMerge(){var sg=document.getElementById('uasug');if(!sg||sg.dataset.adm)return;sg.dataset.adm='1';var d=sg.querySelector('[data-act=uasugdis]');if(d)d.remove();}   /* one control: the bell row just above the card */
function decorate(){if(!office())return;
  var w=document.getElementById('hbwrap');
  if(w){sugMerge();
    [].forEach.call(w.querySelectorAll('[data-hb]:not([data-adb])'),function(b){b.setAttribute('data-adb','1');var p=b.getAttribute('data-hb').split('|');box(b,p[0],p.slice(1).join('|'));});
    var sel=PAGE_STATE.hb&&PAGE_STATE.hb.sel;if(sel&&w.querySelector('.cb-head')&&!w.dataset.ado){w.dataset.ado='1';var q=String(sel).split('|');opened(w.querySelector('.cs-sum'),q[0],q.slice(1).join('|'),'hb');}}
  var ci=document.getElementById('ciSheet');
  if(ci){[].forEach.call(ci.querySelectorAll('[data-cb]:not([data-adb])'),function(b){b.setAttribute('data-adb','1');box(b,today(),b.getAttribute('data-cb'));});
    var hd=ci.querySelector('.cb-head');if(hd&&!hd.dataset.ado){hd.dataset.ado='1';var k=(hd.querySelector('.cb-code')||{}).textContent||'';opened(ci.querySelector('.cs-sum'),today(),k,'ci');}}}
function press(e){var x=e.target&&e.target.closest&&e.target.closest('.ad-bell[data-ad],.ad-btn[data-ad]');if(!x||!office()||(x.getAttribute('data-ad')||'').indexOf('|')<0)return;e.preventDefault();e.stopPropagation();if(e.stopImmediatePropagation)e.stopImmediatePropagation();
  var p=x.getAttribute('data-ad').split('|'),date=p[0],site=p.slice(1).join('|');var off=toggle(date,site);
  try{toast(off?'Alert hidden for '+site+' on '+date+'. Press the bell to show it again.':'Alert shown again for '+site+' on '+date+'.');}catch(z){}
  var ci=document.getElementById('ciSheet');
  if(ci&&ci.contains(x)){[].forEach.call(ci.querySelectorAll('[data-cb]'),function(b){if(b.getAttribute('data-cb')===site)box(b,today(),site);});var hd=ci.querySelector('.cb-head');if(hd)opened(ci.querySelector('.cs-sum'),today(),site,'ci');return;}
  render();}
window.addEventListener('click',press,true);
window.addEventListener('keydown',function(e){if((e.key==='Enter'||e.key===' ')&&e.target&&e.target.classList&&e.target.classList.contains('ad-bell'))press(e);},true);
new MutationObserver(function(){try{decorate();}catch(e){try{console.warn('[alertdismiss]',e);}catch(z){}}}).observe(document.documentElement,{childList:true,subtree:true});
})();
