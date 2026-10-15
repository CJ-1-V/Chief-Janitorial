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
/* personpage4 (owner Oct 15 11:25): on a FARM's person page, just the number of people who worked there on the chosen day.
   Same rules as above. Owner + Office Assistant only (office admin / billing never see it). */
function farmCodes(f){return (DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;});}
function farmShifts(f,day){var c=farmCodes(f);return entries(day).filter(function(t){return c.indexOf(siteOfT(t))>=0;}).sort(function(a,b){var x=(user(a.userId)||{}).name||'',y=(user(b.userId)||{}).name||'';return x.localeCompare(y)||String(a['in']).localeCompare(String(b['in']));});}
function paidOf(t){if(!t.out)return 0;var w=hrs(t['in'],t.out);return Math.max(0,w-(typeof unpaidBreak==='function'?unpaidBreak(w,t):0));}   /* same rule as payroll/billing (break by shift length; breakMissed) */
function farmCount(f,day){var codes=(DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;}),p={};
  entries(day).forEach(function(t){if(codes.indexOf(siteOfT(t))>=0)p[t.userId]=1;});return Object.keys(p).length;}
var opp=VIEWS['admin:people'];VIEWS['admin:people']=function(){var x=opp.apply(this,arguments),s=PAGE_STATE.pp,u=s&&user(s.id);
  if(!u||u.type!=='firm'||!allowed()||(s.tab&&s.tab!=='details'))return x;
  var d=PAGE_STATE.ppHc=PAGE_STATE.ppHc||today(),n=farmCount(u,d),L=farmShifts(u,d),tot=0;
  var list=L.length?'<ul class="hdc-list hdc-fl">'+L.map(function(t){var w=user(t.userId),st=stOf(t),g=t.out?hrs(t['in'],t.out):0,h=paidOf(t);tot+=h;
      return '<li>'+(w?'<a href="#" data-act="person" data-id="'+E(w.id)+'">'+E(w.name)+'</a>':'Unknown person')+' <span class="small muted">'+E(siteOfT(t))+'</span>'+
        '<div class="small">'+E(t['in']||'?')+'–'+E(t.out||'…')+(t.out?' · break '+(g-h).toFixed(2)+' h':'')+' · <b>'+h.toFixed(2)+' h</b> <span class="pill '+st[1]+'">'+E(st[0])+'</span></div></li>';}).join('')+'</ul>'+
      '<p class="hdc-tot"><b>Total: '+tot.toFixed(2)+' h</b> <span class="small muted">('+L.length+' shift'+(L.length===1?'':'s')+'; open shifts count 0 until clocked out)</span></p>':'<p class="small muted">No shifts on this day.</p>';
  var card='<div class="card hdc-farmday" id="hdcfarmday"><div class="hdc-top" style="display:flex;justify-content:space-between;align-items:center;gap:12px"><span>People who worked here</span><span class="hdc-n" style="font-size:2em;font-weight:700;line-height:1">'+n+'</span></div>'+
    '<div class="row hdc-bar"><button class="small sec" data-act="hcfmove" data-n="-1" aria-label="Previous day">◀</button><form data-form="hcfdate" class="row"><input type="date" name="d" value="'+E(d)+'"><button class="small">Go</button></form><button class="small sec" data-act="hcfmove" data-n="1" aria-label="Next day">▶</button></div>'+list+'</div>';
  if(typeof ohScrub==='function')card=ohScrub(card);var i=x.indexOf('<div class="card pp-facts"');return i<0?x+card:x.slice(0,i)+card+x.slice(i);};
ACT.hcfmove=function(el){PAGE_STATE.ppHc=add(PAGE_STATE.ppHc||today(),+el.dataset.n);render();};
FORMS.hcfdate=function(f,d){if(d.d){PAGE_STATE.ppHc=d.d;render();}};
window.addEventListener('hashchange',function(){if(!PAGE_STATE.pp)PAGE_STATE.ppHc=null;});
})();
