/* v2-officebookings.js – crewone2 (Oct 21 2026, owner 4:39 AM "also in the office side"). TEST COPY – not live. Loaded LAST.
   One office "Bookings" page = every farm's crew orders + Crew coming per farm and day + the office actions.
   - Top: "Waiting for the office" (new bookings, change and cancel requests) with Confirm / Adjust / Decline (existing codec).
   - Middle: Crew coming per farm and day (existing table: tap a day to set or confirm a day's crew; numbers follow the bookings,
     crewone1 sync; an office number set after the last booking change still wins).
   - Bottom: all other bookings (confirmed, cancelled, declined) with "Make the shift" (existing cobook).
   - Filter by farm and by date (from / to) for all three parts.
   - Routes: #/creworders (nav "Bookings") and the old #/crewcoming both open this page. Office Assistant keeps the same route
     whitelist and action blocks (no rates are shown on this page). No schema change, no SQL. */
(function(){'use strict';
if(typeof VIEWS==='undefined'||!VIEWS['admin:creworders']||!VIEWS['admin:crewcoming'])return;
var oldCC=VIEWS['admin:crewcoming'];
function S(){return PAGE_STATE.obk=PAGE_STATE.obk||{farm:'',from:'',to:''};}
function firmsList(){return (typeof fhFirms==='function'?fhFirms():DB.users.filter(function(u){return u.type==='firm';}));}
function inF(o,s){if(s.farm&&o.firmId!==s.farm)return false;var d=(ordView(o)||{}).date||'';if(s.from&&d<s.from)return false;if(s.to&&d>s.to)return false;return true;}
function view(){var s=S(),F=firmsList();
  var pend=coFilterList({tab:'pending'}).filter(function(o){return inF(o,s);});
  var rest=coFilterList({tab:'all'}).filter(function(o){return !o.pending&&inF(o,s);});
  var up=rest.filter(function(o){return ['Cancelled','Declined'].indexOf(ordStatus(o))<0&&ordView(o).date>=today();}),past=rest.filter(function(o){return up.indexOf(o)<0;});
  /* Crew coming table: same office table, started at the "from" date */
  var fhc=PAGE_STATE.fhc=PAGE_STATE.fhc||{start:addDays(today(),1),q:'',all:false};if(s.from&&s.from!==fhc._from){fhc.start=s.from;}else if(!s.from&&fhc._from){fhc.start=addDays(today(),1);}fhc._from=s.from;
  var cc=oldCC().replace(/<h1>[\s\S]*?<\/h1>\s*<p class="small muted">[\s\S]*?<\/p>/,'');
  var x='<h1 id="obkhd">Bookings</h1><p class="small muted">Every farm\'s bookings, Crew coming and your actions in one place. The farm sees the same status and numbers right away.</p>'+
  '<form class="card obk-bar" data-form="obkfilter" id="obkfilter"><div class="obk-f"><label>Farm<select name="farm"><option value="">All farms</option>'+F.map(function(f){return '<option value="'+esc(f.id)+'"'+(f.id===s.farm?' selected':'')+'>'+esc((typeof fhCode==='function'?fhCode(f)+' – ':'')+f.name)+'</option>';}).join('')+'</select></label>'+
    '<label>From<input type="date" name="from" value="'+esc(s.from||'')+'"></label><label>To<input type="date" name="to" value="'+esc(s.to||'')+'"></label></div>'+
    '<div class="row"><button class="small">Filter</button> <button type="button" class="small sec" data-act="obkclear">Clear</button><span class="small muted">'+pend.length+' waiting · '+up.length+' upcoming</span></div></form>'+
  '<section class="obk-sec" id="obkwait"><h2>Waiting for the office <span class="pill '+(pend.length?'s-pend':'s-ok')+'">'+pend.length+'</span></h2>'+(pend.length?'<div id="coqueue">'+pend.map(ordCardOffice).join('')+'</div>':'<p class="muted">Nothing waiting. ✓</p>')+'</section>'+
  '<section class="obk-sec" id="obkcoming"><h2>Crew coming – per farm and day</h2>'+cc+'</section>'+
  '<section class="obk-sec" id="obkall"><h2>Upcoming bookings <span class="pill s-ok">'+up.length+'</span></h2>'+(up.length?up.map(ordCardOffice).join(''):'<p class="muted">No upcoming bookings for this filter.</p>')+
  (past.length?'<details class="pastorders" id="obkpast"><summary>Past, cancelled and declined ('+past.length+')</summary>'+past.map(ordCardOffice).join('')+'</details>':'')+'</section>';
  return x;}
VIEWS['admin:creworders']=view;VIEWS['admin:crewcoming']=view;
FORMS.obkfilter=function(f,d){if(d.from&&d.to&&d.from>d.to){toast('"From" must be before "to".');return;}var s=S();s.farm=d.farm||'';s.from=d.from||'';s.to=d.to||'';render();};
ACT.obkclear=function(){PAGE_STATE.obk={farm:'',from:'',to:''};render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('obkclear');if(typeof ADMIN_ONLY_FORM!=='undefined')ADMIN_ONLY_FORM.push('obkfilter');
/* farm filter also applies to the Crew coming rows */
var oar=afterRender;afterRender=function(root){oar(root);try{var s=S(),t=document.querySelector('#obkcoming #fhctable');if(t&&s.farm)[].forEach.call(t.querySelectorAll('tr[data-firm]'),function(r){r.hidden=r.dataset.firm!==s.farm;});
  if(t&&s.farm&&!t.querySelector('tr[data-firm="'+s.farm+'"]')){var al=document.getElementById('fhcall');if(al&&!al.checked){(PAGE_STATE.fhc=PAGE_STATE.fhc||{}).all=true;setTimeout(render,0);}}}catch(e){console.warn('officebookings',e);}};
/* nav: one "Bookings" entry; #/crewcoming stays as a route */
function navFix(){try{var N=NAV.admin;N.forEach(function(n){if(n[0]==='#/creworders')n[1]='Bookings';});for(var i=N.length-1;i>=0;i--)if(N[i][0]==='#/crewcoming')N.splice(i,1);
  if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){var k=g[1].indexOf('#/crewcoming');if(k>=0)g[1].splice(k,1);});}catch(e){}}
(function(){try{var d=Object.getOwnPropertyDescriptor(NAV,'admin');if(!d)return;var get=d.get?d.get:function(){return d.value;},set=d.set?d.set:function(v){d.value=v;};
  Object.defineProperty(NAV,'admin',{configurable:true,enumerable:true,get:function(){return (get.call(NAV)||[]).filter(function(n){return n[0]!=='#/crewcoming';}).map(function(n){return n[0]==='#/creworders'?[n[0],'Bookings']:n;});},set:function(v){set.call(NAV,v);}});}catch(e){}})();
function oldRoute(){if(/^#\/crewcoming/.test(location.hash||'')){PAGE_STATE.obkScroll='obkcoming';location.replace('#/creworders');}}
window.addEventListener('hashchange',oldRoute);oldRoute();
navFix();var oar2=afterRender;afterRender=function(root){navFix();oar2(root);try{if(PAGE_STATE.obkScroll&&document.getElementById(PAGE_STATE.obkScroll)){var el=document.getElementById(PAGE_STATE.obkScroll);PAGE_STATE.obkScroll=null;setTimeout(function(){el.scrollIntoView({block:'start'});},50);}}catch(e){}try{if(ME&&ME.type==='admin')[].forEach.call(document.querySelectorAll('nav a[href="#/crewcoming"],#obar a[href="#/crewcoming"],.menu a[href="#/crewcoming"]'),function(a){(a.closest('li')||a).remove();});}catch(e){}};
})();
