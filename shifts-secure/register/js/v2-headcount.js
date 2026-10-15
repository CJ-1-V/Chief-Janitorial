/* v2-headcount.js – personpage3 (owner Oct 15 2026, 11:19 AM): "Daily headcount" – how many people worked on a day at each farm,
   to check every shift is in the system. ONLY the owner and the Office Assistant (not office admin / billing / farms / workers).
   Office Assistant: farm codes only, never names, no money. Counts unique people; voided (removed) and test entries are left out.
   Includes sub workers and subcontractor-entered shifts. Compares with crew orders when there are any. Load before v2-nohome.js. */
(function(){
'use strict';
var R='#/headcount';
function E(s){return esc(s==null?'':String(s));}
function helper(){return typeof ohIs==='function'&&ohIs();}
function allowed(){return !!(typeof ME!=='undefined'&&ME&&ME.type==='admin'&&(helper()||(typeof ivOwner==='function'&&ivOwner())));}
/* menu: add once, then show it only to the owner / assistant */
var d0=Object.getOwnPropertyDescriptor(NAV,'admin');
(function(){var L=NAV.admin;if(!L.some(function(n){return n[0]===R;}))L.push([R,'Daily headcount']);})();
if(d0&&d0.get){Object.defineProperty(NAV,'admin',{configurable:true,enumerable:true,get:function(){var L=d0.get.call(NAV);return allowed()?L:L.filter(function(n){return n[0]!==R;});},set:function(v){d0.set.call(NAV,v);}});}
else{var base=NAV.admin;Object.defineProperty(NAV,'admin',{configurable:true,enumerable:true,get:function(){return allowed()?base:base.filter(function(n){return n[0]!==R;});},set:function(v){base=v;}});}
if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){if(g[0]==='Daily work'&&g[1].indexOf(R)<0)g[1].push(R);});
var og=gateRoute;gateRoute=function(h){var r=og(h);if(r===R&&!allowed())return '#/home';return r;};

function siteOfT(t){if(t.site)return t.site;var sh=t.shiftId&&(DB.shifts||[]).filter(function(x){return x.id===t.shiftId;})[0];return sh&&sh.site||'';}
function farmLabel(code){if(!code)return 'No farm code';if(helper())return 'Farm '+code;var f=typeof siteFirm==='function'?siteFirm(code):null;return code+(f&&f.name?' – '+f.name:'');}
function add(d,n){var x=new Date(d+'T12:00:00');x.setDate(x.getDate()+n);return x.toISOString().slice(0,10);}
function entries(day){return ((typeof allTime==='function'?allTime():DB.time)||[]).filter(function(t){return t&&!t.test&&!t.removed&&t.date===day;});}
function orders(day){var by={};(DB.crewOrders||[]).forEach(function(o){var f=o.cur||o.req||{};if(!f||f.date!==day||/cancel/i.test(o.status||''))return;by[f.site]=(by[f.site]||0)+(+f.workers||0);});return by;}
function stOf(t){return !t.out?['Open – not clocked out','s-bad']:t.hoursStatus?[String(t.hoursStatus),'s-mut']:t.approved?['Approved','s-ok']:['Recorded','s-mut'];}
function dayHtml(day){var E1=entries(day),O=orders(day),by={};
  E1.forEach(function(t){var c=siteOfT(t);(by[c]=by[c]||[]).push(t);});Object.keys(O).forEach(function(c){by[c]=by[c]||[];});
  var codes=Object.keys(by).sort();if(!codes.length)return '<p class="muted">No shifts and no crew orders on this day.</p>';
  var tot=0;var x=codes.map(function(c){var L=by[c],ppl={};L.forEach(function(t){ppl[t.userId]=1;});var n=Object.keys(ppl).length;tot+=n;var open=L.filter(function(t){return !t.out;}).length,ord=O[c];
    var flag=ord!=null&&ord!==n?'<span class="pill '+(n<ord?'s-bad':'s-pend')+'">ordered '+ord+', in system '+n+'</span>':ord!=null?'<span class="pill s-ok">ordered '+ord+' ✓</span>':'';
    return '<div class="card hdc-farm"><div class="hdc-top"><b>'+E(farmLabel(c))+'</b><span class="hdc-n">'+n+'<small> '+(n===1?'person':'people')+'</small></span></div>'+
      '<div class="row hdc-flags">'+flag+(open?'<span class="pill s-bad">'+open+' open (not clocked out)</span>':'')+'</div>'+
      (L.length?'<ul class="hdc-list">'+L.sort(function(a,b){return String(a['in']).localeCompare(String(b['in']));}).map(function(t){var u=user(t.userId),s=stOf(t);
        return '<li>'+(u?'<a href="#" data-act="person" data-id="'+E(u.id)+'">'+E(u.name)+'</a>':'Unknown person')+' <span class="small muted">'+E(u&&u.type==='worker'?'sub worker':u?u.type:'')+(t.subAdded||t.addedBySub||t.subEntry?' · added by subcontractor':t.manual||t.officeEntry?' · office entry':'')+'</span>'+
          '<div class="small">'+E(t['in']||'?')+'–'+E(t.out||'…')+' <span class="pill '+s[1]+'">'+E(s[0])+'</span></div></li>';}).join('')+'</ul>':'<p class="small muted">No shifts in the system yet.</p>')+'</div>';}).join('');
  return '<p class="hdc-sum"><b>'+tot+'</b> people at <b>'+codes.length+'</b> farm'+(codes.length===1?'':'s')+'</p>'+x;}
function weekHtml(day){var days=[];for(var i=6;i>=0;i--)days.push(add(day,-i));var grid={},codes={};
  days.forEach(function(d){var p={};entries(d).forEach(function(t){var c=siteOfT(t);codes[c]=1;(p[c]=p[c]||{})[t.userId]=1;});Object.keys(p).forEach(function(c){(grid[c]=grid[c]||{})[d]=Object.keys(p[c]).length;});});
  var C=Object.keys(codes).sort();if(!C.length)return '<p class="muted">No shifts in these 7 days.</p>';
  return '<div class="tw"><table class="hdc-grid"><tr><th>Farm</th>'+days.map(function(d){var x=new Date(d+'T12:00:00');return '<th><a href="#" data-act="hcday" data-d="'+d+'">'+['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][x.getDay()]+'<br>'+d.slice(5)+'</a></th>';}).join('')+'</tr>'+
    C.map(function(c){return '<tr><td><b>'+E(helper()?c||'–':farmLabel(c))+'</b></td>'+days.map(function(d){var n=(grid[c]||{})[d];return '<td class="'+(n?'':'muted')+'">'+(n||'–')+'</td>';}).join('')+'</tr>';}).join('')+'</table></div><p class="small muted">Unique people per farm per day. Tap a day to see the names.</p>';}
VIEWS['admin:headcount']=function(){if(!allowed())return '<div class="card"><p>Daily headcount is for the owner and the Office Assistant.</p></div>';
  var s=PAGE_STATE.hc=PAGE_STATE.hc||{d:today(),m:'day'};
  var x='<h1>Daily headcount</h1><p class="small muted">How many people worked at each farm, to check every shift is in the system. Voided and test shifts are not counted.</p>'+
    '<div class="row hdc-bar"><button class="small sec" data-act="hcmove" data-n="-1" aria-label="Previous day">◀</button><form data-form="hcdate" class="row"><input type="date" name="d" value="'+E(s.d)+'"><button class="small">Go</button></form><button class="small sec" data-act="hcmove" data-n="1" aria-label="Next day">▶</button>'+
    '<button class="small '+(s.m==='day'?'':'sec')+'" data-act="hcmode" data-m="day">Day</button><button class="small '+(s.m==='week'?'':'sec')+'" data-act="hcmode" data-m="week">Last 7 days</button></div>';
  x+=s.m==='week'?weekHtml(s.d):dayHtml(s.d);
  return typeof ohScrub==='function'?ohScrub(x):x;};
ACT.hcmove=function(el){var s=PAGE_STATE.hc;s.d=add(s.d,+el.dataset.n);render();};
ACT.hcmode=function(el){PAGE_STATE.hc.m=el.dataset.m;render();};
ACT.hcday=function(el){PAGE_STATE.hc.d=el.dataset.d;PAGE_STATE.hc.m='day';render();};
FORMS.hcdate=function(f,d){if(d.d){PAGE_STATE.hc.d=d.d;render();}};
})();
