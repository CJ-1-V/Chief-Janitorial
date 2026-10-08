/* trainhide1 – training & quizzes go away once done (owner, Oct 8 2026, 11:32 AM: "make quiz and training go away from login when
   that is completed and an employee can only open it when new one comes"). "Employee" includes subcontractors and their workers.
   TEST COPY. Separate layer, loaded just before v2-nohome.js (v2-nohome.js stays LAST). No database change: "done" comes from the
   app's existing records (quiz passes per module, 12-month renewal, certificates – trainState()), plus an optional "updated" date on
   a module (TRAIN_ITEMS[k].updated = 'YYYY-MM-DD'): a pass from before that date counts as not done, so an updated module comes
   back until the person passes it again (a new pass has a later date, so it clears by itself).
   - Worker / crew lead / employee with nothing to do: no training card after sign-in or on home, no "Training & quizzes" tile in
     the Menu, and #/training says "All your training is done" (nothing to open).
   - Something new, updated, failed, expired or due for renewal within 30 days: the card comes back with ONLY those modules, the
     Menu tile comes back, and the Training page lists ONLY those modules.
   - Subcontractor: the "your workers' training" card only shows while a worker has something to finish or confirm.
   Office training matrix unchanged. */
'use strict';
(function(){
if(typeof VIEWS==='undefined'||typeof trainItemsFor!=='function'||typeof trainState!=='function')return;
function lastPass(u,k){var l=(DB.quizAttempts||[]).filter(function(a){return a.userId===u.id&&a.item===k&&a.pass&&!a.test;});return l[l.length-1]||null;}
function todoKeys(u){if(!u||(u.type!=='worker'&&u.type!=='employee'))return [];
  return trainItemsFor(u).filter(function(k){var s=trainState(u,k);if(!s.ok||s.c==='s-warn')return true;
    var it=TRAIN_ITEMS[k]||{};if(it.updated&&it.quiz){var lp=lastPass(u,k);if(!lp||String(lp.at||'').slice(0,10)<String(it.updated))return true;}return false;});}
function subHasTodo(s){return users('worker').some(function(w){return w.subId===s.id&&w.active!==false&&(todoKeys(w).length||trainItemsFor(w).some(function(k){var st=trainState(w,k);return st.ok&&st.passedAt&&!st.confirm;}));});}
window.trainTodo=todoKeys;
/* home: drop the training card when there is nothing to do */
function stripCard(x){var i=x.indexOf('id="trwelcome"');if(i<0)return x;var s=x.lastIndexOf('<',i);
  if(x.slice(s,s+2)==='<a'){var e=x.indexOf('</a>',i);return e<0?x:x.slice(0,s)+x.slice(e+4);}
  var d=document.createElement('div');d.innerHTML=x;var c=d.querySelector('#trwelcome');if(c)c.remove();return d.innerHTML;}
['worker','employee','sub'].forEach(function(t){var ov=VIEWS[t+':home'];if(typeof ov!=='function')return;
  VIEWS[t+':home']=function(){var x=String(ov.apply(this,arguments));try{if(ME&&ME.type===t){if(t==='sub'?!subHasTodo(ME):!todoKeys(ME).length)x=stripCard(x);
    else if(t!=='sub'&&x.indexOf('class="trw-ok"')>=0){var l=todoKeys(ME);/* only an "updated" module is left: list it instead of "up to date" */
      x=x.replace(/<div class="trw-ok">[\s\S]*?<\/div>/,'<div class="trw-todo"><span class="trw-badge">New / updated training</span><ul>'+l.map(function(k){return '<li>'+esc(TRAIN_ITEMS[k].label)+' <span class="pill s-warn">updated</span></li>';}).join('')+'</ul></div>');}}}catch(e){}return x;};});
/* menu: no Training & quizzes tile when nothing to do */
['worker','employee'].forEach(function(t){var mv=VIEWS[t+':menu'];if(typeof mv!=='function')return;
  VIEWS[t+':menu']=function(){var x=String(mv.apply(this,arguments));try{if(ME&&!todoKeys(ME).length)x=x.replace(/<a class="menu-item" href="#\/training">[\s\S]*?<\/a>/,'');}catch(e){}return x;};});
/* training page: locked when done; otherwise only the modules still to do */
['worker','employee'].forEach(function(t){['training','safety'].forEach(function(r){var tv=VIEWS[t+':'+r];if(typeof tv!=='function')return;
  VIEWS[t+':'+r]=function(){var x=tv.apply(this,arguments);try{if(ME&&ME.type===t&&!todoKeys(ME).length)return '<h1>Training &amp; quizzes</h1><div class="msg-empty" id="trdone"><b>✓ All your training is done.</b> Nothing to do here. When there is new or updated training for you, it will show after you sign in.</div>';}catch(e){}return x;};});});
function pass(){try{if(!ME||(ME.type!=='worker'&&ME.type!=='employee'))return;var h=(location.hash||'').split('?')[0];if(h!=='#/training'&&h!=='#/safety')return;
  var todo=todoKeys(ME);if(!todo.length)return;var app=document.getElementById('app')||document.body;var hid=0;
  [].forEach.call(app.querySelectorAll('[data-act="quizstart"][data-item]'),function(b){var c=b.closest('.card');if(!c||c.dataset.th)return;c.dataset.th='1';if(todo.indexOf(b.dataset.item)<0){c.style.display='none';hid++;}});
  if(hid&&!app.querySelector('#trOnlyNew')){var h1=app.querySelector('h1');if(h1)h1.insertAdjacentHTML('afterend','<div class="th-note" id="trOnlyNew">Showing only the training you still need to do ('+todo.length+').</div>');}}catch(e){}}
try{new MutationObserver(function(){pass();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
})();
