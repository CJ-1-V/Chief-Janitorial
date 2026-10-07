/* trainwelcome1 – welcome card about training on the first screen after sign-in (owner Oct 7, 2026 12:03 AM: "Show each employee a
   welcome message to always remain on top of their trainings as they get updated, they will receive notifications"; 12:04 AM:
   "when I say employee it also means a subcontractor"). Pairs with css/trainwelcome.css.
   Who: workers, crew leads and employees (Clock / checklist screen) and subcontractors (Dashboard). Not office, farms or testers.
   How people are told about new or updated training (what exists today): nothing sends email, SMS or push yet, so the promise is
   in the app only. This card works it out from the training data the app already has (the items for the person's job role, quiz
   passes, 12-month renewals, certificates) every time the screen opens – no new data, no database change:
   - anything not done, failed, expired, or due for renewal within 30 days shows a gold "New / updated training" badge with the
     items and a button to Training & quizzes. An item the office newly added for the person's job role is marked "New".
   - subcontractors: their workers' items still to finish, and passed items waiting for the subcontractor to confirm
     (subcontractors also get an Alert when a worker passes a quiz – existing feature).
   The card can be closed (×) for this sign-in; it comes back on the next sign-in, and at once if a new item appears. While training
   is still to do, a small gold badge line stays in its place. Turn off: remove the 2 lines in index.html. */
(function(){
  if(typeof VIEWS==='undefined'||typeof trainItemsFor!=='function'||typeof trainState!=='function')return;
  var OFF='us-trw-off-',SEEN='us-trw-seen-';
  function ss(k,v){try{if(v===undefined)return sessionStorage.getItem(k);if(v===null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v);}catch(e){}return null;}
  function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);localStorage.setItem(k,v);}catch(e){}return null;}
  function first(u){var p=u.profile||{},c=u.company||{},mc=c.mainContact||{};
    if(u.type==='sub')return mc.name?String(mc.name).trim().split(/\s+/)[0]:String(c.operatingName||c.legalName||u.name||'').trim();   /* sub: main contact's first name, else the company name */
    return String(p.firstName||u.name||'').trim().split(/\s+/)[0]||'';}
  function canGo(u,h){var nav=(typeof gateNav==='function'&&gateNav(u))||NAV[u.type]||[];return nav.some(function(n){return n[0]===h;});}
  function seenList(u){var v=ls(SEEN+u.id);try{return v?JSON.parse(v):null;}catch(e){return null;}}
  function markSeen(u){ls(SEEN+u.id,JSON.stringify(trainItemsFor(u)));}
  /* person: items to do / renew. New = required item the person has not seen in the list before (office added it to the role). */
  function personTodo(u){var seen=seenList(u);if(!seen){markSeen(u);seen=trainItemsFor(u);}
    return trainItemsFor(u).map(function(k){var s=trainState(u,k),soon=s.ok&&s.c==='s-warn';if(s.ok&&!soon)return null;
      return {k:k,label:TRAIN_ITEMS[k].label,s:s.s,c:s.c,isNew:seen.indexOf(k)<0};}).filter(Boolean);}
  /* subcontractor: own workers only (names of the sub's own workers, never farm or client names) */
  function subTodo(u){var todo=0,conf=0,ppl=[];users('worker').filter(function(w){return w.subId===u.id&&w.active!==false;}).forEach(function(w){var t=0,c=0;
      trainItemsFor(w).forEach(function(k){var s=trainState(w,k);if(!s.ok||s.c==='s-warn')t++;else if(s.passedAt&&!s.confirm)c++;});
      todo+=t;conf+=c;if(t||c)ppl.push({n:w.name,t:t,c:c});});return {todo:todo,conf:conf,ppl:ppl};}
  function sig(list){return list.map(function(x){return x.k||x.n;}).join(',');}
  var BADGE='<span class="trw-badge">New / updated training</span>';
  function card(u){
    if(u.type==='sub'){if(!canGo(u,'#/workers'))return '';var S=subTodo(u),has=S.todo+S.conf>0,sg='sub:'+S.todo+'/'+S.conf+':'+sig(S.ppl),off=ss(OFF+u.id);
      var btn='<a class="btn btn-gold trw-go" href="#/workers">Open My workers – training</a>';
      var what=has?'<div class="trw-todo">'+BADGE+'<ul>'+S.ppl.slice(0,5).map(function(p){return '<li><b>'+esc(p.n)+'</b>: '+(p.t?p.t+' item'+(p.t>1?'s':'')+' to finish':'')+(p.t&&p.c?', ':'')+(p.c?p.c+' to confirm':'')+'</li>';}).join('')+(S.ppl.length>5?'<li>and '+(S.ppl.length-5)+' more</li>':'')+'</ul></div>':'<div class="trw-ok">✓ Your workers\' training is up to date.</div>';
      if(off!==null&&off===sg)return has?'<a class="trw-mini" id="trwelcome" href="#/workers">'+BADGE+' <span>'+(S.todo?S.todo+' to finish':'')+(S.todo&&S.conf?' · ':'')+(S.conf?S.conf+' to confirm':'')+' →</span></a>':'';
      return '<div class="trw card" id="trwelcome" role="region" aria-label="Welcome"><button class="trw-x" data-act="trwoff" data-sig="'+esc(sg)+'" aria-label="Close" title="Close">×</button>'+
        '<h2 class="trw-h">Welcome, '+esc(first(u))+'</h2><p class="trw-p">Please keep your workers on top of their safety training. Trainings get updated from time to time – when a worker has training to finish, or a passed item for you to confirm, you\'ll be notified right here in the app each time you sign in, and in Alerts when a worker passes a quiz.</p>'+what+btn+'</div>';}
    if(!canGo(u,'#/training'))return '';
    var L=personTodo(u),sg=sig(L),off=ss(OFF+u.id),nw=L.filter(function(x){return x.isNew;}).length;
    if(off!==null&&off===sg)return L.length?'<a class="trw-mini" id="trwelcome" href="#/training">'+BADGE+' <span>'+L.length+' to do →</span></a>':'';
    var what=L.length?'<div class="trw-todo">'+BADGE+'<ul>'+L.slice(0,5).map(function(x){return '<li>'+(x.isNew?'<span class="trw-new">New</span> ':'')+esc(x.label)+' <span class="pill '+esc(x.c)+'">'+esc(x.s)+'</span></li>';}).join('')+(L.length>5?'<li>and '+(L.length-5)+' more</li>':'')+'</ul></div>':'<div class="trw-ok">✓ All your training is up to date.</div>';
    return '<div class="trw card" id="trwelcome" role="region" aria-label="Welcome"><button class="trw-x" data-act="trwoff" data-sig="'+esc(sg)+'" aria-label="Close" title="Close">×</button>'+
      '<h2 class="trw-h">Welcome, '+esc(first(u))+'</h2><p class="trw-p">Please stay on top of your safety training. Trainings get updated from time to time – when there\'s something new or due for you, you\'ll be notified right here in the app each time you sign in, and on Menu → Training &amp; quizzes.</p>'+
      what+'<a class="btn btn-gold trw-go" href="#/training">Open Training &amp; quizzes</a></div>';}
  window.trwCard=card;
  ACT.trwoff=function(el){if(!ME)return;ss(OFF+ME.id,el.dataset.sig||'');render();};
  ['worker','employee','sub'].forEach(function(t){var ov=VIEWS[t+':home'];if(typeof ov!=='function')return;
    VIEWS[t+':home']=function(){var x=ov.apply(this,arguments);try{if(ME&&ME.type===t)x=card(ME)+x;}catch(e){}return x;};});
  /* opening Training & quizzes counts as having seen the list (the "New" mark goes, the item stays until done) */
  ['worker','employee'].forEach(function(t){var tv=VIEWS[t+':training'];if(typeof tv!=='function')return;VIEWS[t+':training']=function(){try{if(ME)markSeen(ME);}catch(e){}return tv.apply(this,arguments);};});
  /* a new sign-in shows the full card again */
  if(typeof ACT.logout==='function'){var lo=ACT.logout;ACT.logout=function(){try{if(ME)ss(OFF+ME.id,null);}catch(e){}return lo.apply(this,arguments);};}
})();
