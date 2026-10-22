/* v2-mtweek.js – jobpos1 add-on (owner Oct 20 2026, 4:45 PM): "I don't want to see all the manual entries here, make a filter and only show max of a week."
   All hours → open a farm → "Manual entries – <farm>": shows ONE week at a time (Mon–Sun), current week by default.
   ‹ Prev / Next › arrows, a week picker (any day → its week), "This week", a jump to the week of the opened day, and optional person + site filters.
   Count and paid-hour total are for the shown week only. Older entries stay reachable: pick their week (the Edit / Void buttons are the same),
   or open that day's farm box in All hours. Front end only, no SQL. Load after v2-mtinall.js. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function wk0(d){return typeof weekStart==='function'?weekStart(d):d;}
function S(){PAGE_STATE.mtw=PAGE_STATE.mtw||{};return PAGE_STATE.mtw;}
function boxDay(){var s=PAGE_STATE.hb&&PAGE_STATE.hb.sel;return s?String(s).split('|')[0]:'';}
var MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function lab(d){var p=d.split('-');return MN[+p[1]-1]+' '+(+p[2]);}
function apply(card){var tb=card.querySelector('#mtlist');if(!tb)return;var s=S(),from=s.from||wk0(today()),to=addDays(from,6);
  var rows=[].slice.call(tb.querySelectorAll('tr[data-id]')),ppl={},sites={},n=0,h=0;
  rows.forEach(function(tr){var c=tr.cells,who=c[0]?(c[0].querySelector('b')?c[0].querySelector('b').textContent+(c[0].querySelector('.muted')&&c[0].querySelector('.muted').textContent?' · '+c[0].querySelector('.muted').textContent:''):c[0].textContent):'',site=c[1]?c[1].textContent.split(' – ')[0].trim():'',d=c[2]?c[2].textContent.trim():'';
    tr.dataset.mtwDate=d;if(d>=from&&d<=to){ppl[who]=1;sites[site]=1;}
    var keep=d>=from&&d<=to&&(!s.who||s.who===who)&&(!s.site||s.site===site);tr.style.display=keep?'':'none';
    if(keep){n++;var ph=c[5]?parseFloat(c[5].textContent):0;if(!tr.classList.contains('mt-void')&&!/voided/i.test(tr.innerText))h+=ph||0;}});
  var empty=tb.querySelector('tr.mtw-empty');if(empty)empty.remove();
  if(!n){var r=tb.insertRow(-1);r.className='mtw-empty';r.innerHTML='<td colspan="11" class="muted">No manual entries in this week'+(s.who||s.site?' for this filter':'')+'.</td>';}
  var bd=boxDay(),bw=bd?wk0(bd):'';
  var opt=function(o,cur,all){return '<option value="">'+all+'</option>'+Object.keys(o).filter(Boolean).sort().map(function(k){return '<option'+(k===cur?' selected':'')+'>'+E(k)+'</option>';}).join('');};
  if(s.who&&!ppl[s.who])ppl[s.who]=1;if(s.site&&!sites[s.site])sites[s.site]=1;
  var bar='<div class="mtw-bar" id="mtwbar"><button type="button" class="small sec" data-mtw="prev" aria-label="Previous week">‹ Prev</button>'+
    '<b class="mtw-lab">Week '+E(lab(from))+' – '+E(lab(to))+(from===wk0(today())?' (this week)':'')+'</b>'+
    '<button type="button" class="small sec" data-mtw="next" aria-label="Next week"'+(to>=today()?' disabled':'')+'>Next ›</button>'+
    '<label class="small">Week of <input type="date" class="mtw-pick" value="'+E(from)+'" max="'+E(today())+'"></label>'+
    (from!==wk0(today())?'<button type="button" class="small sec" data-mtw="now">This week</button>':'')+
    (bw&&bw!==from?'<button type="button" class="small sec" data-mtw="box">Week of '+E(lab(bd))+'</button>':'')+
    '<select class="mtw-who" aria-label="Person">'+opt(ppl,s.who,'All people')+'</select>'+
    (Object.keys(sites).length>1||s.site?'<select class="mtw-site" aria-label="Site">'+opt(sites,s.site,'All sites')+'</select>':'')+
    '<span class="small mtw-sum"><b>'+n+'</b> '+(n===1?'entry':'entries')+' · <b>'+h.toFixed(2)+'</b> paid h this week</span></div>';
  var old=card.querySelector('#mtwbar');if(old)old.remove();var tw=tb.closest('.tw')||tb;tw.insertAdjacentHTML('beforebegin',bar);
  var hs=card.querySelector('h3 .small.muted');if(hs)hs.textContent='('+n+' shown · week '+lab(from)+'–'+lab(to)+', max 7 days)';
  card.dataset.mtw=from+'|'+(s.who||'')+'|'+(s.site||'');}
function scan(){var c=document.getElementById('miafarmlist');if(!c)return;var s=S(),k=(s.from||wk0(today()))+'|'+(s.who||'')+'|'+(s.site||'');if(c.dataset.mtw===k&&c.querySelector('#mtwbar'))return;apply(c);}
function again(){var c=document.getElementById('miafarmlist');if(c){delete c.dataset.mtw;apply(c);}}
new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('[data-mtw]');if(!b)return;var s=S(),f=s.from||wk0(today()),m=b.getAttribute('data-mtw');
  if(m==='prev')s.from=addDays(f,-7);else if(m==='next'){var nx=addDays(f,7);if(nx<=today())s.from=nx;}else if(m==='now')s.from=wk0(today());else if(m==='box'&&boxDay())s.from=wk0(boxDay());again();});
document.addEventListener('change',function(e){var t=e.target;if(!t||!t.matches)return;var s=S();
  if(t.matches('.mtw-pick')){if(t.value)s.from=wk0(t.value>today()?today():t.value);again();}else if(t.matches('.mtw-who')){s.who=t.value;again();}else if(t.matches('.mtw-site')){s.site=t.value;again();}});
var c=document.createElement('style');c.textContent='.mtw-bar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:8px 0;padding:8px;background:#f4f2fa;border-radius:8px}.mtw-bar select,.mtw-bar input{font-size:13px;padding:4px 6px;min-height:32px}.mtw-sum{margin-left:auto}@media(max-width:560px){.mtw-sum{margin-left:0;width:100%}}';document.head.appendChild(c);
})();
