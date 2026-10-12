/* v2-polish.js – professional look: simple line icons instead of emoji, right-aligned numbers in tables. TEST ONLY. */
'use strict';
var POLISH_ICONS={
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
  doc:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6 6 0 0 1 3.5 6"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',note:'<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
  cal:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',bell:'<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  alert:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>'};
var POLISH_MAP={'⏱':'clock','☰':'list','📄':'doc','👤':'user','👥':'users','⛑':'shield','📍':'pin','📝':'note','✍':'note','📅':'cal','🔔':'bell','⚠':'alert','⚠️':'alert'};
var POLISH_RE=/(⚠️|[⏱☰⛑✍⚠]\uFE0F?|\uD83D[\uDCC4\uDC64\uDC65\uDCCD\uDCDD\uDCC5\uDD14])/;
function polishIcon(n){return '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">'+POLISH_ICONS[n]+'</svg>';}
function polishEmoji(root){if(!root||!document.createTreeWalker)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),list=[],n;
  while((n=w.nextNode()))if(POLISH_RE.test(n.nodeValue)){var p=n.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA|OPTION|TITLE)$/.test(p.nodeName))continue;list.push(n);}
  list.forEach(function(t){var parts=t.nodeValue.split(POLISH_RE),f=document.createDocumentFragment();
    parts.forEach(function(s,i){if(!s)return;if(i%2){var k=POLISH_MAP[s.replace('\uFE0F','')]||POLISH_MAP[s];var sp=document.createElement('span');sp.className='ico';sp.setAttribute('aria-hidden','true');sp.innerHTML=polishIcon(k||'alert');f.appendChild(sp);}
      else f.appendChild(document.createTextNode(i>0&&parts[i-1]?s.replace(/^\s+/,' '):s));});t.parentNode.replaceChild(f,t);});
  [].forEach.call(root.querySelectorAll?root.querySelectorAll('option'):[],function(o){if(POLISH_RE.test(o.textContent))o.textContent=o.textContent.replace(new RegExp(POLISH_RE.source,'g'),'').replace(/^\s+/,'');});}
var NUM_RE=/^[−\-+]?\s?(CA)?\$?\s?\d[\d,]*(\.\d+)?\s?(h|hrs?|%|km)?$/i;
function polishTables(root){[].forEach.call((root||document).querySelectorAll('table'),function(t){var rows=t.rows;if(rows.length<2)return;var cols={};
  [].forEach.call(rows,function(r,ri){if(ri===0&&r.cells[0]&&r.cells[0].tagName==='TH')return;[].forEach.call(r.cells,function(c,ci){if(c.tagName!=='TD'||c.colSpan>1)return;var x=c.textContent.trim();if(!x||x==='–'||x==='-')return;var o=cols[ci]=cols[ci]||{n:0,t:0};o.t++;if(NUM_RE.test(x)&&!c.querySelector('input,select,button,a'))o.n++;});});
  [].forEach.call(t.querySelectorAll('td'),function(c){var x=c.textContent.trim();if(/^\d{4}-\d{2}-\d{2}/.test(x)&&x.length<=40)c.classList.add('nw');if(c.querySelector('button')&&!c.querySelector('input,select,textarea')&&c.textContent.replace(/\s+/g,'').length===[].reduce.call(c.querySelectorAll('button'),function(a,b){return a+b.textContent.replace(/\s+/g,'').length;},0))c.classList.add('acts');});
  Object.keys(cols).forEach(function(ci){var o=cols[ci];if(!o.t||o.n/o.t<0.8)return;[].forEach.call(rows,function(r){var c=r.cells[ci];if(c&&c.colSpan===1)c.classList.add('num');});});});}
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{polishEmoji(root||document.body);polishTables(root);}catch(e){}};})();
