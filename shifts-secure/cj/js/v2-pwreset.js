/* v2-pwreset.js – Oct 4, 2026: ONE clear "Reset password" flow for the office.
   Why: the person panel had TWO ways to reset – a "Reset password" box where the office typed a password, and a
   "Force password reset" button. On the live site both call the server, which makes its own temporary password and
   ignores the typed one, so the office saw two different passwords and did not know which to give the employee.
   Now:
   - The typed-password box is gone. The person panel has ONE "Reset password" button (office only).
   - Office clicks it → confirms → the app makes ONE strong, easy-to-read temporary password (no 0/O, 1/I/L),
     shows it once in big text with a Copy button and the note for the employee.
   - The employee signs in with it and must choose their own new password (the app's one password rule) before
     anything else. If they just typed the temporary password to sign in, they are not asked for it a second time.
   - Audit log: who reset, when, for whom. The password itself is never logged, stored in notes or shown again.
   - Live (supabase) mode: the server function admin_reset_password makes the password, checks permissions
     (office owner/admin; only the owner can reset an office account), signs the person out everywhere, sets the
     must-change flag and writes the audit row. js/store-supabase.js exposes it as window.REG_OFFICE_RESET. */
(function(){
  if(typeof ACT!=='object'||typeof FORMS!=='object')return;
  var ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789';           /* 31 symbols: no 0/O, 1/I/L – easy to read out loud */
  function genTempPassword(){var out='',buf=new Uint8Array(1),c=window.crypto||window.msCrypto;
    while(out.replace(/-/g,'').length<12){c.getRandomValues(buf);var b=buf[0];if(b>=248)continue;   /* 248 = 8*31: no bias */
      out+=ALPHA.charAt(b%31);var n=out.replace(/-/g,'').length;if(n===4||n===8)out+='-';}
    return out;}                                           /* e.g. K7QM-3XRT-H9WA (12 random symbols ≈ 59 bits) */
  window.genTempPassword=genTempPassword;window.TEMP_PW_ALPHABET=ALPHA;
  ['pwresetyes'].forEach(function(a){if(typeof ADMIN_ONLY_ACT!=='undefined'&&ADMIN_ONLY_ACT.indexOf(a)<0)ADMIN_ONLY_ACT.push(a);});

  var LIVE=function(){return typeof window.REG_OFFICE_RESET==='function';};
  function nm(u){return u?u.name:'the person';}
  function refuse(u){if(!ME||!u)return 'Account not found.';
    if(u.id===ME.id)return 'Use "Change my password" on your Profile for your own account.';
    if(!LIVE()&&u.type==='admin'&&typeof officeRoleOf==='function'&&officeRoleOf(ME)!=='owner')return 'Only the owner can reset an office account.';
    return '';}

  /* Person panel: drop the typed-password box, ONE "Reset password" button. */
  function tidyPanel(id){var m=document.querySelector('#modal .modal');if(!m)return;var u=user(id);
    [].forEach.call(m.querySelectorAll('form[data-form=adminpw]'),function(f){f.remove();});
    var b=m.querySelector('[data-act=forcereset]');
    if(b){b.textContent='Reset password';b.classList.add('pwreset-btn');
      if(u&&u.mustChangePw&&!m.querySelector('.pwreset-wait')){var s=document.createElement('div');s.className='small muted pwreset-wait';
        s.textContent='Waiting for '+nm(u)+' to choose a new password at next sign-in.';b.parentNode.parentNode.insertBefore(s,b.parentNode.nextSibling);}}}
  if(typeof showPerson==='function'){var sp=showPerson;showPerson=function(id){var r=sp.apply(this,arguments);try{tidyPanel(id);}catch(e){}return r;};}

  /* Step 1: confirm */
  ACT.forcereset=function(el){var u=user(el.dataset.id),why=refuse(u);if(why){toast(why);if(u&&ME){audit('Blocked: reset password',u.name,why);save();}return;}
    modal('<div class="pwreset" data-step="confirm"><h2>Reset password for '+esc(u.name)+'?</h2>'+
      '<p>The app will make <b>one</b> temporary password for you to give to '+esc(u.name)+'.</p>'+
      '<ul class="small"><li>Their current password stops working right away.</li><li>They must choose a new password when they next sign in.</li></ul>'+
      '<div class="row pwreset-actions"><button type="button" data-act="pwresetyes" data-id="'+u.id+'">Yes, reset password</button><button type="button" class="sec" data-act="person" data-id="'+u.id+'">Cancel</button></div></div>');};

  /* Step 2: make the password (server in live mode, here in the test copy) and show it once */
  ACT.pwresetyes=function(el){var id=el.dataset.id,u=user(id),why=refuse(u);if(why){toast(why);return;}
    if(!LIVE()&&window.REG_STORE&&window.REG_STORE.mode==='supabase'){toast('Please reload the page and try again.');return;}   /* never make a local-only password on the real site */
    el.disabled=true;
    if(LIVE()){Promise.resolve(window.REG_OFFICE_RESET(id)).then(function(){el.disabled=false;},function(){el.disabled=false;});return;}
    var pw=genTempPassword();
    u.passHash=hashPw(pw);u.mustChangePw=true;u.failed=0;u.lockedUntil=0;
    audit('Office reset password',u.name,'Temporary password made by the app and shown once to '+(ME?ME.name:'the office')+' (never stored in the log). '+u.name+' must choose a new password at next sign-in.');
    notify(u.id,'The office reset your password. Sign in with the temporary password they give you, then choose your own new password.');
    save();window.showTempPassword(u,pw);};

  function showTempPassword(u,pw){
    modal('<div class="pwreset" data-step="done"><h2>Temporary password for '+esc(nm(u))+'</h2>'+
      '<div class="tpw-box"><code class="tpw" id="tpw" aria-label="Temporary password">'+esc(pw)+'</code></div>'+
      '<div class="row pwreset-actions"><button type="button" class="tpw-copy" data-act="pwcopy">Copy</button></div>'+
      '<p class="tpw-note">Give this temporary password to the employee. They must choose a new password when they next sign in.</p>'+
      '<div class="small muted tpw-hint">Type it exactly as shown, including the dashes. It is shown only this once – if it gets lost, just reset again.</div>'+
      '<div class="row pwreset-actions"><button type="button" class="sec" data-act="closeModal">Done</button></div></div>');}
  window.showTempPassword=showTempPassword;

  ACT.pwcopy=function(el){var t=document.getElementById('tpw');if(!t)return;var pw=t.textContent;
    var ok=function(){el.textContent='Copied ✓';el.dataset.done='1';},fb=function(){var a=document.createElement('textarea');a.value=pw;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();var r=false;try{r=document.execCommand('copy');}catch(e){}a.remove();
      if(r)ok();else{var s=document.createRange();s.selectNodeContents(t);var g=window.getSelection();g.removeAllRanges();g.addRange(s);el.textContent='Selected – press Ctrl+C / long-press to copy';}};
    try{if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(pw).then(ok,fb);else fb();}catch(e){fb();}};

  /* Next sign-in: the employee must choose a new password first. The temporary password they just typed to sign in
     is kept in memory only (never saved) so they are not asked for it twice. */
  var TEMP=null,TEMP_AT=0;
  function tempKnown(){if(TEMP&&Date.now()-TEMP_AT>15*60000)TEMP=null;return !!TEMP;}
  var ol=FORMS.login;
  if(ol)FORMS.login=function(f,d){TEMP=d&&d.password||null;TEMP_AT=Date.now();var r;
    try{r=ol.apply(this,arguments);}finally{var keep=function(){if(!(ME&&ME.mustChangePw))TEMP=null;};if(r&&typeof r.then==='function')r.then(keep,keep);else keep();}
    return r;};
  var lo=ACT.logout;if(lo)ACT.logout=function(){TEMP=null;return lo.apply(this,arguments);};
  VIEWS.changepw=function(){var k=tempKnown();
    return '<h1>Set a new password</h1><div class="alert warn pwforce-msg">You signed in with a temporary password from the office. Please choose your own new password now – you can continue after it is saved.</div>'+
      '<div class="card pwforce"><form data-form="forcepw">'+
      (k?'<p class="small ok-note">✓ Temporary password accepted.</p>':inp('old','Temporary password (from the office)','',{type:'password',req:true,extra:' autocomplete="current-password"'}))+
      inp('pw','New password','',{type:'password',req:true})+inp('pw2','Repeat new password','',{type:'password',req:true,extra:' autocomplete="new-password"'})+
      '<button>Save my new password</button></form></div>';};
  var ofp=FORMS.forcepw;
  FORMS.forcepw=function(f,d){if(!d.old&&tempKnown())d.old=TEMP;var r=ofp.apply(this,arguments);
    var done=function(){if(!ME||!ME.mustChangePw)TEMP=null;};if(r&&typeof r.then==='function')r.then(done,done);else done();return r;};
})();
