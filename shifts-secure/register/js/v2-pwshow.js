/* v2-pwshow.js (pwshow1, Oct 9 2026) – "see password" eye button in every password field
   + keeps ONE password tip on forms that already show the hrreview Tip box.
   Pure add-on layer: no existing code changed. Loaded right before v2-nohome.js. */
(function(){'use strict';
if(window.pwShow)return;
var EYE='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
var EYE_OFF='<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
var seq=0,inputs=[];
function setShown(el,btn,show){try{el.type=show?'text':'password';}catch(e){}
  btn.innerHTML=show?EYE_OFF:EYE;btn.setAttribute('aria-label',show?'Hide password':'Show password');btn.title=show?'Hide password':'Show password';
  btn.setAttribute('aria-pressed',show?'true':'false');btn.classList.toggle('pws-on',!!show);}
function place(el){var b=el._pwsBtn;if(!b)return;if(!b.isConnected||!el.isConnected)return;
  if(!el.offsetParent||el.offsetWidth===0){b.style.display='none';return;}b.style.display='';
  var h=el.offsetHeight,bw=Math.max(44,h);
  b.style.top=(el.offsetTop+(h-44)/2)+'px';b.style.left=(el.offsetLeft+el.offsetWidth-bw)+'px';b.style.width=bw+'px';}
function attach(el){if(el.dataset.pws)return;var host=el.parentNode;if(!host)return;el.dataset.pws='1';
  if(!el.id)el.id='pws-in-'+(++seq);
  var b=document.createElement('button');b.type='button';b.className='pws-btn';b.setAttribute('aria-controls',el.id);
  b.tabIndex=0;setShown(el,b,false);
  if(getComputedStyle(host).position==='static')host.classList.add('pws-host');
  el.classList.add('pws-in');
  el.insertAdjacentElement('afterend',b);el._pwsBtn=b;
  /* keep the caret / focus in the field when the eye is tapped */
  b.addEventListener('mousedown',function(e){e.preventDefault();});
  b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var show=el.type==='password';setShown(el,b,show);
    try{if(document.activeElement===el&&el.setSelectionRange){var n=el.value.length;el.setSelectionRange(n,n);}}catch(x){}});
  inputs.push(el);place(el);
  if(window.ResizeObserver){try{new ResizeObserver(function(){place(el);}).observe(el);}catch(e){}}}
/* --- one clear tip: on forms with the hrreview Tip box, hide the older duplicate hints --- */
function tidyTips(root){[].forEach.call((root||document).querySelectorAll('form'),function(f){if(!f.querySelector('.hr-pwex'))return;
  [].forEach.call(f.querySelectorAll('input[name=pw]'),function(el){var w=el.parentNode;if(!w)return;
    [].forEach.call(w.querySelectorAll('.hint'),function(h){if(/10 characters/i.test(h.textContent))h.classList.add('pws-dup');});
    var m=w.querySelector('.pwmeter');if(m){m.classList.add('pws-meter');m.classList.toggle('pws-idle',!el.value);}});});}
function scan(root){root=root||document;
  [].forEach.call(root.querySelectorAll('input[type=password]:not([data-pws])'),attach);
  tidyTips(document);
  inputs=inputs.filter(function(el){return el.isConnected;});inputs.forEach(place);}
/* password managers capture type=password fields on submit: hide every shown password just before a submit */
document.addEventListener('submit',function(e){var f=e.target;if(!f||!f.querySelectorAll)return;
  [].forEach.call(f.querySelectorAll('input.pws-in'),function(el){if(el._pwsBtn&&el.type!=='password')setShown(el,el._pwsBtn,false);});},true);
document.addEventListener('input',function(e){var el=e.target;if(el&&el.name==='pw'){var m=el.parentNode&&el.parentNode.querySelector('.pwmeter.pws-meter');if(m)m.classList.toggle('pws-idle',!el.value);}},true);
var queued=false;function q(){if(queued)return;queued=true;setTimeout(function(){queued=false;try{scan(document);}catch(e){}},30);}
function start(){scan(document);try{new MutationObserver(q).observe(document.body,{childList:true,subtree:true});}catch(e){}
  window.addEventListener('resize',q);window.addEventListener('hashchange',q);}
if(document.body)start();else document.addEventListener('DOMContentLoaded',start);
window.pwShow={scan:scan,version:'pwshow1'};
})();
