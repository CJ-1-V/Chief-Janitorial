/* clockboxes1 – owner Oct 17 2026 2:19 PM: All hours (#/allhours) FIRST shows boxes per day: one box per site / farm code that had
   shifts that day, with the number of unique people who worked there. Tap a box = all time entries for that site and day
   (name, in, out, break, hours, status) using the SAME table rows, so Remove / Restore and every other row action stay as they are.
   "All farms" goes back. The From / To / Person-or-site form and the Show filters are unchanged and drive what the boxes count.
   Office Assistant (ohIs): codes only, no farm names. Front end only, no SQL. Turn off: remove the 2 lines in index.html. */
(function(){
'use strict';
if(typeof DB==='undefined')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function helper(){return typeof window.ohIs==='function'&&window.ohIs();}
function st(){if(typeof PAGE_STATE==='undefined')return {};return PAGE_STATE.hb=PAGE_STATE.hb||{};}
var DN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function dayLabel(d){var p=String(d).split('-');if(p.length<3)return d;var x=new Date(+p[0],+p[1]-1,+p[2]);return DN[x.getDay()]+' '+MN[x.getMonth()]+' '+x.getDate()+(typeof today==='function'&&d===today()?' (today)':'');}
function entry(key){var p=String(key||'').split(':');
  if(p[0]==='t'){var id=key.slice(2),t=(DB.time||[]).filter(function(x){return String(x.id)===id;})[0];return t?{t:t,u:t.userId,site:t.site||shSite(t.shiftId),date:t.date}:null;}
  if(p[0]==='c'){var sh=(DB.shifts||[]).filter(function(x){return x.id===p[1];})[0];return sh?{t:{'in':sh.start,out:sh.end},u:p.slice(2).join(':'),site:sh.site,date:sh.date}:null;}return null;}
function shSite(id){var s=(DB.shifts||[]).filter(function(x){return x.id===id;})[0];return s?s.site:'';}
function farmName(code){if(!code||helper())return '';var f=typeof siteFirm==='function'?siteFirm(code):null;return f?(f.realName||f.name||''):'';}
function brk(t){if(!t||!t.out||typeof hrs!=='function'||typeof unpaidBreak!=='function')return '–';var w=hrs(t['in'],t.out);if(!w&&t['in']>t.out)w=hrs(t['in'],'24:00')+hrs('00:00',t.out);var b=unpaidBreak(w,t);return b>0?Math.round(b*60)+' min':'none';}
function build(tb){var rows=[].slice.call(tb.querySelectorAll('tr[data-key]')),days={};
  rows.forEach(function(r){var e=entry(r.getAttribute('data-key'));if(!e)return;r._hb=e;var d=days[e.date]=days[e.date]||{},k=e.site||'';var g=(d[k]=d[k]||{rows:[],ppl:{},crew:[]});g.rows.push(r);g.ppl[e.u]=1;if(!e.t.removed){if(+e.t.crewIn>0)g.crew.push({n:+e.t.crewIn,at:e.t['in'],w:'clock-in'});if(+e.t.crew>0&&e.t.out)g.crew.push({n:+e.t.crew,at:e.t.out,w:'clock-out'});}});
  return {rows:rows,days:days};}
/* crew numbers (owner 2:28 PM): .crewIn = asked at clock-in, .crew = asked at clock-out; highest of both. Unique people vs highest reported that day. */
function crewOf(G){var n=Object.keys(G.ppl).length,R=G.crew.slice().sort(function(a,b){return String(a.at||'').localeCompare(String(b.at||''));});if(!R.length)return {n:n,max:0,last:null,miss:0};var mx=Math.max.apply(null,R.map(function(r){return r.n;}));return {n:n,max:mx,last:R[R.length-1],miss:Math.max(0,mx-n)};}
function sumHtml(c){var st=!c.max?'<div class="cs-st cs-none">No crew number reported this day.</div>':c.miss>0?'<div class="cs-st cs-bad">Possibly missing: <b>'+c.miss+'</b></div>':'<div class="cs-st cs-ok">All accounted for</div>';
  return '<div class="cs-sum"><div>People in the app this day: <b>'+c.n+'</b></div><div>Highest crew reported: <b>'+(c.max||'–')+'</b>'+(c.last?' <small>(latest: '+c.last.n+' at '+E(c.last.at)+', '+c.last.w+')</small>':'')+'</div>'+st+'</div>';}
function boxesHtml(M){var ds=Object.keys(M.days).sort().reverse();if(!ds.length)return '<p class="muted">No hours in this range.</p>';
  return ds.map(function(d){var S=M.days[d],ks=Object.keys(S).map(function(k){return {k:k,n:Object.keys(S[k].ppl).length,e:S[k].rows.length,c:crewOf(S[k])};}).sort(function(a,b){return b.n-a.n||(a.k||'~').localeCompare(b.k||'~');});
    var all={};ks.forEach(function(x){Object.keys(S[x.k].ppl).forEach(function(u){all[u]=1;});});
    return '<section class="hb-day"><h3>'+E(dayLabel(d))+' <small>'+(function(n){return n+(n===1?' person':' people');})(Object.keys(all).length)+' · '+ks.length+(ks.length===1?' site':' sites')+'</small></h3><div class="cb-grid">'+
      ks.map(function(x){var nm=farmName(x.k);return '<button type="button" class="cb-box" data-hb="'+E(d+'|'+x.k)+'" aria-label="'+E((x.k||'No site')+', '+dayLabel(d)+': '+x.n+' people, '+x.e+' entries')+'">'+(x.c.miss>0?'<span class="cb-badge" title="Crew reported is higher than people in the app">+'+x.c.miss+'?</span>':'')+'<span class="cb-code">'+E(x.k||'No site')+'</span><span class="cb-n">'+x.n+'</span><span class="cb-l">'+(x.n===1?'person':'people')+'</span><span class="cb-e">'+x.e+(x.e===1?' entry':' entries')+'</span>'+(nm?'<span class="cb-name">'+E(nm)+'</span>':'')+'</button>';}).join('')+'</div></section>';}).join('');}
function enhance(){var tb=document.getElementById('vshtable');if(!tb||tb.dataset.hb)return;tb.dataset.hb='1';
  var tw=tb.closest('.tw')||tb,M=build(tb),s=st(),sel=s.sel;
  var sp=sel?String(sel).split('|'):null;if(sp&&!(M.days[sp[0]]&&M.days[sp[0]][sp.slice(1).join('|')]))sel=s.sel=null,sp=null;
  var box=document.createElement('div');box.id='hbwrap';box.className='hb-wrap';tw.parentNode.insertBefore(box,tw);
  if(!sel){box.innerHTML='<p class="small muted hb-hint">Tap a farm / site box to see its time entries for that day.</p>'+boxesHtml(M);tw.style.display='none';return;}
  var d=sp[0],k=sp.slice(1).join('|'),G=M.days[d][k],nm=farmName(k),n=Object.keys(G.ppl).length;
  box.innerHTML='<div class="cb-head"><button type="button" class="small sec" data-hb-back="1">← All farms</button><h3><span class="cb-code">'+E(k||'No site')+'</span> '+E(dayLabel(d))+' · '+n+(n===1?' person':' people')+' · '+G.rows.length+(G.rows.length===1?' entry':' entries')+(nm?' <small>'+E(nm)+'</small>':'')+'</h3></div>'+sumHtml(crewOf(G));
  M.rows.forEach(function(r){if(G.rows.indexOf(r)<0)r.style.display='none';});
  var hr=tb.querySelector('tr:not([data-key])');if(hr&&hr.cells.length>3){var th=document.createElement('th');th.textContent='Break';hr.insertBefore(th,hr.cells[4]);var tc=document.createElement('th');tc.textContent='Crew reported';hr.insertBefore(tc,hr.cells[6]);}
  G.rows.forEach(function(r){var td=document.createElement('td');td.className='small hb-brk';td.setAttribute('data-label','Break');td.textContent=brk(r._hb.t);if(r.cells.length>4)r.insertBefore(td,r.cells[4]);var tc=document.createElement('td');tc.className='small hb-crew';tc.setAttribute('data-label','Crew reported');var t=r._hb.t;tc.textContent=(+t.crewIn>0||+t.crew>0)?'in: '+(+t.crewIn>0?+t.crewIn:'–')+' · out: '+(+t.crew>0?+t.crew:'–'):'–';if(r.cells.length>6)r.insertBefore(tc,r.cells[6]);});
  tb.classList.add('hb-open');}
document.addEventListener('click',function(e){if(!e.target.closest)return;var b=e.target.closest('#hbwrap [data-hb]');if(b){var s=st();s.y0=window.scrollY;s.sel=b.getAttribute('data-hb');again();setTimeout(hbShow,0);return;}
  if(e.target.closest('#hbwrap [data-hb-back]')){var s2=st(),y0=s2.y0;s2.sel=null;again();if(y0!=null)setTimeout(function(){window.scrollTo(0,y0);},0);}});
/* keepscroll1: open a box → its entries start at the top of the screen (not the top of the page); ← All farms → back to that box. */
function hbShow(){var w=document.getElementById('hbwrap');if(!w)return;var t=w.getBoundingClientRect().top;if(t<0||t>window.innerHeight*0.5)w.scrollIntoView({block:'start'});}
function again(){var w=document.getElementById('hbwrap');if(w)w.remove();var tb=document.getElementById('vshtable');if(!tb)return;
  if(typeof render==='function'){render();return;}delete tb.dataset.hb;enhance();}
new MutationObserver(enhance).observe(document.documentElement,{childList:true,subtree:true});enhance();
})();
