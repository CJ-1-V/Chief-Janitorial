/* Oct 4, 2026: pop-ups (the #modal window) always close.
   Why: css/motion.css animated every child of the pop-up with a "filled" animation; in Chrome/Safari that kept each
   child (the title, etc.) on its own layer drawn ON TOP of the × button, so taps on × landed on the title and nothing
   happened. css/popup.css now animates the whole box once and lifts × above everything. This file makes closing
   bullet-proof on every device:
   - ×, and any [data-act=closeModal] (Cancel / Close) button inside a pop-up, close it straight away, before any other
     click code runs (so no role check, re-render or other handler can get in the way).
   - Escape closes the pop-up.
   - Tapping the dark area outside the box closes it, unless something was typed into a form in the pop-up (so a
     stray tap never loses typed work) or the pop-up opened less than 0.4 s ago (the second tap of a double tap).
   - Closing removes every pop-up layer, and a second click on the same spot within 0.35 s after closing is ignored,
     so a double tap on × can never "click through" to whatever was under it.
   - No closing step waits for an animation, so reduced-motion, interrupted animations or slow phones can't block it. */
(function(){
  if(typeof modal!=='function'||typeof closeModal!=='function')return;
  var openedAt=0,closedAt=0,closedXY=null,downOnBg=false;
  function layers(){return document.querySelectorAll('#modal, .modal-bg');}
  function isOpen(){return layers().length>0;}
  function hardClose(){var l=layers();for(var i=0;i<l.length;i++){if(l[i].parentNode)l[i].parentNode.removeChild(l[i]);}}
  function userClose(e){if(!isOpen())return;hardClose();closedAt=Date.now();closedXY=(e&&e.clientX!=null&&(e.clientX||e.clientY))?[e.clientX,e.clientY]:null;}
  window.POPUP={isOpen:isOpen,close:userClose,state:function(){return {openedAt:openedAt,closedAt:closedAt};}};
  closeModal=hardClose;ACT.closeModal=function(){userClose();};
  var om=modal;
  modal=function(){var r=om.apply(this,arguments);openedAt=Date.now();
    var m=document.getElementById('modal');
    if(m){m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');m._dirty=false;
      var x=m.querySelector('.modal > .x');if(x){x.type='button';x.title='Close';}
      var mark=function(e){if(e.target&&e.target.closest&&e.target.closest('form'))m._dirty=true;};
      m.addEventListener('input',mark);m.addEventListener('change',mark);}
    return r;};
  document.addEventListener('pointerdown',function(e){var bg=e.target&&e.target.classList&&e.target.classList.contains('modal-bg');downOnBg=!!bg;},true);
  document.addEventListener('click',function(e){var t=e.target;if(!t||!t.closest)return;
    if(t.closest('.modal-bg .modal > .x, #modal [data-act=closeModal]')){e.preventDefault();e.stopPropagation();userClose(e);return;}
    if(t.classList&&t.classList.contains('modal-bg')){
      var ok=downOnBg!==false&&Date.now()-openedAt>400&&!t._dirty;downOnBg=false;
      if(ok){e.preventDefault();e.stopPropagation();userClose(e);}return;}
    if(!isOpen()&&closedXY&&Date.now()-closedAt<350&&Math.abs(e.clientX-closedXY[0])<40&&Math.abs(e.clientY-closedXY[1])<40){e.preventDefault();e.stopPropagation();}
  },true);
  document.addEventListener('keydown',function(e){if((e.key==='Escape'||e.key==='Esc')&&isOpen()){
    var g=document.querySelector('#obar .ogrp.open');if(g)return; /* the office menu's own Escape closes the menu first */
    e.preventDefault();userClose();}});
})();
