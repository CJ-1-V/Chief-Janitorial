/* v2-easysignup1.js – easysignup1 (owner request Oct 26 2026 2:35 PM ET): make sign-up easy for a farmer on a phone.
   Display layer only, signed-out screens only (#/, #/signup*, #/forgot, #/2fa). No change to sign-up logic, invite
   auto-approve, approval wait, or secure1 rate limits – those all still run first; this only changes words and layout.
   - Big tap targets (48px+) and 16px text (no iPhone zoom) on the sign-in / sign-up cards.
   - Help line on every signed-out screen and inside every error: "Need help? Call or text Aasa at 705-650-0024".
   - Errors (toasts) on these screens also stay on screen in a red box at the top of the form with what to do next.
   - Farm code box: trims spaces, uppercases, fixes letter O typed for zero in the number part; plain found / not found text.
   - Shorter, plainer intro and notice text on the farm form. */
(function(){
  'use strict';
  var TEL='+17056500024',PH='705-650-0024';
  var HELP='<span class="es-help">Need help? Call or text Aasa at '+PH+'<br><a href="tel:'+TEL+'" class="es-tel">📞 Call</a> <a href="sms:'+TEL+'" class="es-sms">💬 Text</a></span>';
  function out(){return typeof ME==='undefined'||!ME;}
  function pub(){var h=String(location.hash||'#/');return out()&&(h==='#/'||h==='#'||h===''||/^#\/(signup|forgot|2fa|login)/.test(h));}
  function E(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  /* CSS */
  var css=document.createElement('style');css.id='es1css';css.textContent=
   '.login-wrap input,.login-wrap select{min-height:48px;font-size:16px;box-sizing:border-box}'+
   '.login-wrap button,.login-wrap .btn,.login-wrap a.choice{min-height:48px;font-size:17px}'+
   '.login-wrap button[type=submit]{width:100%;margin:8px 0}.login-wrap a.btn.sec{display:flex;align-items:center;justify-content:center;width:100%;box-sizing:border-box}'+
   '.login-wrap a[href="#/forgot"]{display:inline-flex;align-items:center;min-height:48px;font-size:16px}'+
   '.login-wrap input[type=checkbox],.login-wrap input[type=radio]{min-height:0;width:24px;height:24px}'+
   '#orfarmcode{font-size:22px;font-weight:700;letter-spacing:2px;text-transform:uppercase;border:2px solid var(--g,#2a7)}'+
   '#orfarmcode::placeholder{text-transform:none;font-size:16px;font-weight:400;letter-spacing:0}'+
   '.es-farmlbl{font-size:18px;font-weight:700}'+
   '.es-help{display:block;margin-top:6px;font-size:16px}.es-help a{display:inline-flex;align-items:center;min-height:48px;padding:0 6px;font-weight:700}'+
   '.es-foot{margin:14px 0 4px;text-align:center}'+
   '.es-err{font-size:16px;margin-bottom:10px}.es-err b{display:block}';
  (document.head||document.documentElement).appendChild(css);
  /* plain words for messages that say only what went wrong */
  var NEXT=[
   [/invite only/i,'Use the link in your invite email or letter. No invite? Call or text Aasa below and she will send you one.'],
   [/invite/i,'Check the code on your invite letter, or leave it empty and sign up anyway.'],
   [/already used|already (has|have) an account|already registered|taken/i,'Already have an account? Tap Sign in below, or tap Forgot password to reset it.'],
   [/password/i,'Check your password and try again. Forgot it? Tap Forgot password.'],
   [/email/i,'Check the email address and try again.'],
   [/join code|employer/i,'Ask your crew lead or boss for the join code.'],
   [/too many|wait|try again later/i,'Please wait a few minutes, then try again.'],
   [/code/i,'Check the code and try again.']];
  function nextStep(m){for(var i=0;i<NEXT.length;i++)if(NEXT[i][0].test(m))return NEXT[i][1];return 'Check the boxes in red and try again.';}
  function showErr(m){var f=document.querySelector('.login-wrap form')||document.querySelector('.login-wrap .card');if(!f)return;
    var a=document.getElementById('es1err');if(!a){a=document.createElement('div');a.id='es1err';a.className='alert bad es-err';a.setAttribute('role','alert');f.insertBefore(a,f.firstChild);}
    a.innerHTML='<b>'+E(m)+'</b>'+(/forgot|tap |try again|please (enter|pick|use|check)/i.test(m)?'':E(nextStep(m)))+HELP;try{a.scrollIntoView({block:'center'});}catch(e){}}
  var GOOD=/^(sent|done|saved|welcome|account created|thanks|code sent|we sent|signed|matched)/i;
  if(typeof window.toast==='function'){var _t=window.toast;window.toast=function(msg){var r=_t.apply(this,arguments);try{if(pub()&&msg&&!GOOD.test(String(msg)))showErr(String(msg));}catch(e){}return r;};
    try{toast=window.toast;}catch(e){}}
  /* farm code box */
  function cleanCode(v){var s=String(v||'').toUpperCase().replace(/[\s\-_.]/g,'');
    var m=/^([A-Z]{3})([0-9OIL]{1,3})$/.exec(s);if(m)s=m[1]+m[2].replace(/O/g,'0').replace(/[IL]/g,'1');return s.slice(0,10);}
  document.addEventListener('input',function(e){var t=e.target;if(!t||t.id!=='orfarmcode')return;var c=cleanCode(t.value);if(c!==t.value)t.value=c;},true);
  document.addEventListener('input',function(e){var t=e.target;if(!t||t.id!=='orfarmcode')return;setTimeout(hint,0);});
  function hint(){var i=document.getElementById('orfarmcode'),h=document.getElementById('orfarmhint');if(!i||!h)return;var v=i.value,m=window.orMatchCode?window.orMatchCode(v):{st:'none'};
    var firm=/^#\/signup\/firm/.test(location.hash||''),io=document.getElementById('orinviteonly');if(io&&document.getElementById('fiwelcome')){io.style.display='none';io=null;}
    if(m.st==='ok'){h.innerHTML='✓ Found your farm: <b>'+E(m.code)+'</b>';h.className='hint ok';if(io)io.style.display='none';}
    else if(!v){h.textContent=firm?'It is on your UnScramble letter, next to the QR code. Example: FBF239':'Ask your crew lead or driver. Not sure? Leave it empty – the office will match you.';h.className='hint';if(io)io.style.display='';}
    else if(v.length<6){h.textContent='A farm code is 3 letters and 3 numbers, like FBF239.';h.className='hint';}
    else{h.innerHTML='We can\'t find '+E(v)+'. '+(firm?'Check the code on your letter.':'Ask your crew lead for the code.')+' You can still sign up – the office will match you.'+HELP;h.className='hint warn';if(io)io.style.display='';}}
  /* words + help footer, on each render */
  var REP=[
   [/A business email is required for farms\. Phone is optional\.[\s\S]*No shifts can be booked before that\./,'Takes about 2 minutes. You need your farm code and a business email. After you sign up, the office sets you up, then you sign your agreement in the app.'],
   [/^Sign-up is by invite only\..*$/,'Got an invite? Use the email it was sent to.'],
   [/^Texts come from UnScramble \+1 902-200-4888\.(.*)$/,'Texts come from UnScramble. Message and data rates may apply. No mobile or email on your account? Call or text Aasa – she can give you a temporary password.']];
  function words(){var c=document.querySelector('.login-wrap');if(!c)return;
    c.querySelectorAll('.alert,.small,.hint,p,.muted').forEach(function(el){if(el.children.length>2||el.dataset.es1||el.closest('#es1err'))return;var t=el.textContent.trim();
      for(var i=0;i<REP.length;i++)if(REP[i][0].test(t)){if(i===0&&document.getElementById('fiwelcome')){el.style.display='none';}else el.textContent=REP[i][1];el.dataset.es1='1';break;}});
    var i=document.getElementById('orfarmcode');if(i&&!i.dataset.es1){i.dataset.es1='1';i.setAttribute('inputmode','text');i.setAttribute('autocorrect','off');i.setAttribute('spellcheck','false');i.setAttribute('aria-describedby','orfarmhint');
      var l=i.previousElementSibling;if(l&&l.tagName==='LABEL'){l.classList.add('es-farmlbl');l.setAttribute('for','orfarmcode');}
      if(i.value)i.value=cleanCode(i.value);hint();}
    var s=document.getElementById('scCode');if(s&&!s.dataset.es1){s.dataset.es1='1';s.addEventListener('input',function(){var v=s.value.toUpperCase().replace(/\s/g,'');if(v!==s.value)s.value=v;});}
    var card=c.querySelector('.card');if(card&&!card.querySelector('.es-foot')){var d=document.createElement('div');d.className='es-foot';d.innerHTML=HELP;card.appendChild(d);}}
  var tm=null;function soon(){if(tm)return;tm=setTimeout(function(){tm=null;try{if(pub())words();}catch(e){}},30);}
  new MutationObserver(soon).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('hashchange',function(){var a=document.getElementById('es1err');if(a)a.remove();soon();});
  window.ES1={cleanCode:cleanCode};
})();
