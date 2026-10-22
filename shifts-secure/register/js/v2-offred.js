/* v2-offred.js – revfilter1 (owner Oct 22 2026): farms, clients and people that are switched off (active === false) or suspended
   (suspended === true) show in red with an "Off" / "Suspended" label in the office lists (Farms & clients, People and the other
   people lists). Display only, front end only; no data is changed. Also keeps the Revenue collected box first on Farms & clients.
   Load last. */
(function(){
'use strict';
var ROUTES={'#/firms':1,'#/people':1,'#/compliance':1,'#/training':1,'#/missingdocs':1};
var ACTS={person:1,toggleactive:1,firmview:1,suspend:1,pp:1,ppopen:1,openperson:1};
function stOf(u){return !u?'':u.active===false?'off':u.suspended?'susp':'';}
function idOf(tr){var ids={};[].forEach.call(tr.querySelectorAll('[data-act][data-id]'),function(b){if(ACTS[b.dataset.act])ids[b.dataset.id]=1;});var k=Object.keys(ids);return k.length===1?k[0]:null;}
function mark(){try{if(typeof ME==='undefined'||!ME||ME.type!=='admin')return;var h=(location.hash||'').split('?')[0];if(!ROUTES[h])return;
  var app=document.getElementById('app');if(!app)return;
  [].forEach.call(app.querySelectorAll('tr'),function(tr){var id=idOf(tr);if(!id)return;var u=typeof user==='function'?user(id):null;if(!u||u.type==='admin')return;var k=stOf(u);
    tr.classList.remove('rf-off','rf-susp');if(!k)return;tr.classList.add('rf-'+k);var td=tr.querySelector('td');if(!td||td.querySelector('.rf-pill'))return;
    var has=/\b(Off|Suspended)\b/.test(tr.innerText);var s=document.createElement('span');s.className='pill rf-pill';s.textContent=k==='off'?'Off':'Suspended';if(!has||k==='susp'&&!/\bSuspended\b/.test(tr.innerText)){td.appendChild(document.createTextNode(' '));td.appendChild(s);}});
}catch(e){try{console.warn('[offred]',e);}catch(z){}}}
var busy=false,qd=false;function run(){qd=false;if(busy)return;busy=true;try{if(typeof window.revToTop==='function')window.revToTop();mark();}finally{busy=false;}}
function queue(){if(qd)return;qd=true;setTimeout(run,0);}
function hook(){var app=document.getElementById('app');if(!app||typeof MutationObserver!=='function')return false;new MutationObserver(function(){if(!busy)queue();}).observe(app,{childList:true,subtree:true});queue();return true;}
if(!hook())document.addEventListener('DOMContentLoaded',hook);
window.offRedMark=mark;
if(!document.getElementById('offredstyle')){var st=document.createElement('style');st.id='offredstyle';st.textContent='tr.rf-off td,tr.rf-susp td{background:#fdecea}tr.rf-off td:first-child,tr.rf-susp td:first-child,tr.rf-off td:first-child b,tr.rf-susp td:first-child b{color:#b3261e}tr.rf-off td:first-child{border-left:4px solid #d93025}tr.rf-susp td:first-child{border-left:4px solid #d93025}.pill.rf-pill,tr.rf-off .pill.s-mut,tr.rf-susp .pill.s-bad{background:#d93025;color:#fff;font-weight:600}';document.head.appendChild(st);}
})();
