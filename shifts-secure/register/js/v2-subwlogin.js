/* subwlogin1 (Oct 7 2026): a subcontractor's worker could not clock in even after the office gave the WORKER a 14-day pass.
   1. A worker's 14-day pass only covers the worker's own papers. The employer's (subcontractor's) items – approval, agreement,
      insurance (CGL), agency licence – still stop the worker from clocking in. The office now sees exactly why, on the worker's
      card and in the worker's pass window, with a one-tap "Give <company> a 14-day pass" and "Open <company>".
   2. A subcontractor added by the office on live may have no saved `company` (subsafe1 gives it an in-memory placeholder that is
      never saved). Anything kept in `company` – the company's 14-day pass, company details, "agency licence not required" – was
      silently lost on reload. Now the placeholder is saved with the account as soon as the office (or the company) changes it.
      Nothing is written while it is untouched. */
'use strict';
(function(){
  function blank(u){return JSON.stringify({legalName:u.name||''});}
  /* (2) keep the placeholder company in saves once it has been changed */
  function persist(){try{if(typeof DB==='undefined'||!DB||!DB.users)return;DB.users.forEach(function(u){if(!u||u.type!=='sub'||!u.company)return;
      if(Object.prototype.propertyIsEnumerable.call(u,'company')||Object.prototype.hasOwnProperty.call(u,'toJSON'))return;
      Object.defineProperty(u,'toJSON',{value:function(){var o={},self=this;Object.keys(self).forEach(function(k){o[k]=self[k];});
        var c=self.company;if(c&&typeof c==='object'&&JSON.stringify(c)!==blank(self))o.company=c;return o;},enumerable:false,writable:true,configurable:true});});}catch(e){}}
  window.subwloginPersist=persist;
  if(typeof window.subsafeFix==='function'){var sf=window.subsafeFix;window.subsafeFix=function(){sf();persist();};}
  if(typeof save==='function'){var s0=save;save=function(){persist();return s0.apply(this,arguments);};}
  if(typeof render==='function'){var r0=render;render=function(){persist();return r0.apply(this,arguments);};}
  persist();

  /* (1) why a worker can't clock in, in plain words, for the office */
  var PASS_OK=typeof TEMP_EXEMPT!=='undefined'?TEMP_EXEMPT:/registration not yet approved|WCB|insurance|additional insured|agency licence/i;
  function plain(m){return String(m).replace(/^Employer: /,'').replace(/^Subcontractor /,'').replace(/^has not accepted the current agreement\/terms\.?/,'Has not accepted its agreement (Master Labour Contract, Schedule A, privacy)')
    .replace(/^registration not yet approved by the office\.?/,'Not approved by the office yet').replace(/^insurance \(CGL\) is (\w+)\.?/,'Insurance (CGL): $1').replace(/^agency licence is (\w+)\.?/,'Agency licence: $1');}
  function why(u){if(!u||(u.type!=='worker'&&u.type!=='employee'))return null;var s=u.type==='worker'?subOf(u):null;
    var hard=(typeof clockHardBlockers==='function'?clockHardBlockers(u):blockers(u,today())).map(function(b){return b.m;});
    var own=hard.filter(function(m){return !/^(Employer: |Not linked to an employer|Your employer )/.test(m);}),emp=hard.filter(function(m){return /^Employer: /.test(m);});
    var raw=s?companyBlockersRaw(s).filter(function(m){return /^Subcontractor|^Office has not confirmed/.test(m);}):[];
    return {u:u,s:s,ready:u.accountApproved!==false&&!hard.length,own:own,emp:emp,
      passFix:raw.filter(function(m){return PASS_OK.test(m);}),noPass:raw.filter(function(m){return !PASS_OK.test(m)&&emp.some(function(e){return e==='Employer: '+m;});}),
      subPass:s?tempActive(s):false,unlinked:hard.some(function(m){return /^Not linked to an employer/.test(m);})};}
  window.subwloginWhy=why;
  function box(u){var w=why(u);if(!w)return '';
    if(w.ready)return '<div class="alert ok small swl-box" id="swl-'+u.id+'"><b>⏱ Can clock in: yes.</b> Missing documents don\'t stop clock-in (they show as a reminder).</div>';
    var s=w.s,sn=s?employerName(u):'',x='<div class="alert warn small swl-box" id="swl-'+u.id+'"><b>⏱ Can\'t clock in yet.</b>';
    if(u.accountApproved===false)x+='<div>The account is waiting for office approval.</div>';
    if(w.own.length)x+='<div class="swl-h">'+esc(u.name)+'\'s own items:</div><ul>'+w.own.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul>';
    if(w.unlinked)x+='<div>Not linked to a subcontractor (employer).</div>';
    if(s&&w.emp.length){x+='<div class="swl-h">Held up by the employer, <b>'+esc(sn)+'</b>'+(u.type==='worker'&&tempActive(u)?' – '+esc(u.name)+'\'s own 14-day pass does not cover the employer\'s papers':'')+':</div><ul>'+
        w.emp.map(function(m){var cov=PASS_OK.test(m);return '<li>'+esc(plain(m))+(cov?' <span class="muted">– a company 14-day pass covers this</span>':' <span class="swl-np">– a pass can\'t cover this</span>')+'</li>';}).join('')+'</ul>';
      if(w.noPass.some(function(m){return /accepted the current agreement/.test(m);}))x+='<div class="swl-tip">The company\'s contact must sign in and accept the agreement. If they don\'t have their login, open the company and use <b>Send login details again</b> (or Reset password).</div>';
      x+='<div class="row swl-act">'+(!w.subPass&&w.passFix.length?'<button type="button" class="small" data-act="passmodal" data-id="'+s.id+'">Give '+esc(sn)+' a 14-day pass</button>':'')+'<button type="button" class="small sec" data-act="person" data-id="'+s.id+'">Open '+esc(sn)+'</button></div>';}
    return x+'</div>';}
  window.subwloginBox=box;
  /* office: worker / employee card */
  if(ACT.person){var op=ACT.person;ACT.person=function(el){op(el);try{var u=user(el.dataset.id),m=document.querySelector('#modal .modal');if(!u||!m||!ME||ME.type!=='admin')return;var h=box(u);if(!h)return;
    var kv=m.querySelector('.kv');if(kv)kv.insertAdjacentHTML('afterend',h);else m.insertAdjacentHTML('afterbegin',h);}catch(e){}};}
  /* office: the 14-day pass window for a worker shows the employer side too */
  if(typeof tempSection==='function'){var ts=tempSection;tempSection=function(u){var x=ts(u);try{if(u&&u.type==='worker'&&ME&&ME.type==='admin')x+=box(u);}catch(e){}return x;};}
  if(FORMS.tempon){var ft=FORMS.tempon;FORMS.tempon=function(f,d){ft(f,d);try{var u=user(d.id),w=why(u);if(u&&u.type==='worker'&&w&&!w.ready&&w.emp.length)setTimeout(function(){toast('Pass on for '+u.name+'. They still can\'t clock in until '+employerName(u)+'\'s items are sorted – see the list in this window.');},50);}catch(e){}};}
  /* worker's own Clock screen: say which employer items are open (no farm or client names involved) */
  if(typeof clockLockHtml==='function'){var cl=clockLockHtml;clockLockHtml=function(u){var h=cl(u);try{var w=why(u);if(h&&w&&w.s&&w.emp.length&&h.indexOf('cantclock')>=0&&/employer/i.test(h)){
    h=h.replace(/<\/div>\s*$/,'<details class="help swl-wd"><summary>ⓘ What your employer still needs to finish</summary><ul class="small">'+w.emp.map(function(m){return '<li>'+esc(plain(m))+'</li>';}).join('')+'</ul></details></div>');}}catch(e){}return h;};}
})();
