/* v2-farmqr1.js – farmqr1 (owner request Oct 26 2026 1:55 PM ET).
   Farm letters carry a QR code: .../register/?farm=ACS238 (or #/signup/firm?farm=ACS238).
   On load: read farm= (address query first, then a query inside the hash), trim + uppercase, cap length,
   accept only 3 letters + site number 201–299 (same rule as v2-sitecode-check) AND, where this page already
   holds the site list (test copy / signed-in office), a known non-hidden farm (orMatchCode). Live anonymous
   visitors get no farm list (reg_public_info), so there only the format is checked – no list is exposed.
   Valid: open #/signup/firm with the Farm code box pre-filled (value set as text, box stays editable).
   Anything else: ignored silently. ?invite= links keep working (the hash is left as is). */
(function(){
  'use strict';
  var RE=/^([A-Z]{3})(\d{3})$/,LO=201,HI=299,MAXRAW=32;
  function grab(q){var m=/(?:^|[?&])farm=([^&#]*)/i.exec(q||'');if(!m)return '';var v=m[1].slice(0,MAXRAW*3);
    try{v=decodeURIComponent(v.replace(/\+/g,' '));}catch(e){return '';}return v.slice(0,MAXRAW);}
  function raw(){var h=String(location.hash||''),i=h.indexOf('?');return grab(location.search)||(i>=0?grab(h.slice(i+1)):'');}
  function fmtOk(c){var m=RE.exec(c);return !!m&&+m[2]>=LO&&+m[2]<=HI&&m[1]!=='UNK';}
  function listHere(){return typeof DB!=='undefined'&&DB&&Array.isArray(DB.sites)&&DB.sites.length>0;}
  function known(c){if(!listHere()||typeof window.orMatchCode!=='function')return true;/* no list on this page: format only */
    var m=window.orMatchCode(c);return m&&m.st==='ok';}
  var code=String(raw()).trim().toUpperCase();
  if(!code||code.length>6||!fmtOk(code))return;
  var Q=window.FARMQR={code:null,raw:code};
  function decide(){if(!Q.ready||Q.code!==null||Q.done)return;Q.done=true;
    if(!known(code))return;Q.code=code;
    if(typeof ME!=='undefined'&&ME)return;/* already signed in: leave them where they are */
    var h=String(location.hash||'');
    if(/^#\/signup\/firm(?:[?]|$)/.test(h)){fill();return;}
    if(/[?&]invite=/.test(h))return;/* an invite link to another screen: do not touch */
    location.hash='#/signup/firm';}
  function fill(){if(!Q.code)return;var i=document.getElementById('orfarmcode');
    if(!i||i.dataset.fqDone)return;if(!/^#\/signup\/firm/.test(location.hash||''))return;
    i.dataset.fqDone='1';if(String(i.value||'').trim())return;/* never overwrite what someone typed */
    i.value=Q.code;/* text only */
    try{i.dispatchEvent(new Event('input',{bubbles:true}));}catch(e){}}
  var t=null;function soon(){if(t)return;t=setTimeout(function(){t=null;try{decide();fill();}catch(e){}},0);}
  /* give the data layer a moment to load the site list (mock is immediate; live anon has none) */
  function start(){var n=0,iv=setInterval(function(){if(listHere()||++n>15){clearInterval(iv);Q.ready=true;soon();}},100);}
  new MutationObserver(soon).observe(document.documentElement,{childList:true,subtree:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
