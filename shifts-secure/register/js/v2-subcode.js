/* subcode1 – workers no longer see the list of subcontractors (owner, Oct 8 2026, 10:39 AM). TEST COPY ONLY.
   Separate layer (ships with or without hrreview1); loaded just before v2-nohome.js (v2-nohome.js stays LAST).
   - Sign-up "Farm worker": the "Your employer (subcontractor)" dropdown (every subcontractor's name) is replaced by an
     employer JOIN CODE box. The worker types the code their crew company gave them, taps Check, and sees ONE name to confirm.
     Invite link also works: …/register/?join=CODE opens the worker sign-up with the code filled in.
   - Subcontractor dashboard + My workers: "Your worker join code" card (copy code / copy invite link / make a new code;
     a new code stops the old one working). Existing workers are not affected (their employer link does not change).
   - Live: needs migration 016r_subcode.sql (NOT APPLIED): reg_sub_by_code(code) returns one {id,name} (throttled),
     reg_sub_join_code(new) gives a sub its own code, and reg_public_info() stops sending the subcontractor list to the public.
     The sign-up itself is unchanged (it still sends the employer id, now taken from the code lookup).
   - Deploy order: safe either way. Front-end before 016r: live still sends the list, so the old dropdown stays and the code
     card is hidden (no broken screens). 016r before front-end: the old dropdown is empty until this file ships, so ship the
     front-end FIRST, then run 016r (that is the moment the list disappears).
   - Mock (?store=mock): codes are kept on the sub's record (joinCode) in this browser only. */
'use strict';
(function(){
var ALPH='ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function E(s){return typeof esc==='function'?esc(s):String(s);}
function live(){return !!(window.REG_LIVE&&window.REG_SB);}
function normCode(c){return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function fmtCode(c){c=normCode(c);return c.length===8?c.slice(0,4)+'-'+c.slice(4):c;}
function newCode(){var a=new Uint8Array(8),s='';(window.crypto||window.msCrypto).getRandomValues(a);for(var i=0;i<8;i++)s+=ALPH[a[i]%ALPH.length];return s;}
function subName(s){return (s.company&&(s.company.legalName||s.company.operatingName))||s.name||'';}
/* ---------- code lookup (one subcontractor, never a list) ---------- */
function lookup(code){var c=normCode(code);if(c.length!==8)return Promise.resolve({error:'The code has 8 letters and numbers, like ABCD-2345.'});
  if(live())return window.REG_SB.rpc('reg_sub_by_code',{p_code:c}).then(function(r){if(r.error)return {error:/too many/i.test(r.error.message||'')?'Too many tries. Please wait a few minutes.':'Could not check the code. Please try again.'};
    return r.data&&r.data.id?{id:r.data.id,name:r.data.name}:{error:'We could not find that code. Check it with your employer.'};},function(){return {error:'Could not check the code. Please try again.'};});
  var s=(DB&&DB.users||[]).filter(function(u){return u.type==='sub'&&u.active!==false&&u.accountApproved!==false&&normCode(u.joinCode)===c;})[0];
  return Promise.resolve(s?{id:s.id,name:subName(s)}:{error:'We could not find that code. Check it with your employer.'});}
/* ---------- the sub's own code ---------- */
function myCode(fresh){if(!ME||ME.type!=='sub')return Promise.resolve(null);
  if(live())return window.REG_SB.rpc('reg_sub_join_code',{p_new:!!fresh}).then(function(r){return r.error?null:r.data;},function(){return null;});
  if(fresh||!ME.joinCode){ME.joinCode=newCode();ME.joinCodeAt=new Date().toISOString();try{audit(fresh?'Made a new worker join code':'Worker join code created',ME.name,'');}catch(e){}save();}
  return Promise.resolve(ME.joinCode);}
/* mock: every test subcontractor gets a code once (so the demo works without signing in as the sub first) */
if(!window.REG_LIVE&&typeof load==='function'){var _ld=load;load=function(){_ld.apply(this,arguments);try{var ch=false;(DB&&DB.users||[]).forEach(function(u){if(u.type==='sub'&&!u.joinCode){u.joinCode=u.username==='subco'?'BLUE7K4Q':newCode();ch=true;}});if(ch)save();}catch(e){}};}
/* ---------- sign-up form ---------- */
var JOIN=(function(){try{var m=/[?&]join=([A-Za-z0-9-]{4,20})/.exec(location.search);return m?normCode(m[1]):'';}catch(e){return '';}})();
/* replaceState (not location.hash) so no early render fires before the data is loaded */
if(JOIN&&!/^#\/signup\/worker/.test(location.hash||''))try{history.replaceState(null,'',location.pathname+location.search+'#/signup/worker');}catch(e){}
var BOX='<div class="sc-box" id="scBox"><label class="req" for="scCode">Employer join code</label>'+
  '<div class="sc-row"><input id="scCode" class="sc-code" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="ABCD-2345" inputmode="text" aria-describedby="scHint"><button type="button" class="btn-indigo" data-act="sccheck" id="scCheck">Check</button></div>'+
  '<div class="hint" id="scHint">Your crew company (your employer) gives you this code. Ask your boss or crew lead for it.</div>'+
  '<input type="hidden" name="subId" id="scSubId" value=""><div id="scResult" aria-live="polite"></div></div>';
if(typeof VIEWS.signupForm==='function'){var _sf=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=String(_sf.apply(this,arguments));if(!/\/signup\/worker/.test(h||location.hash))return x;
  var re=/<div><label class="req">Your employer \(subcontractor\)<\/label><select name="subId"[\s\S]*?<\/select>(<div class="hint">[\s\S]*?<\/div>)?<\/div>/;
  var m=re.exec(x);if(!m)return x;
  /* deploy-order safety: in live, if the server still sends a subcontractor list, migration 016r is not in yet, so the code
     lookup does not exist either -> keep the old dropdown until 016r runs (016r empties that list, then the code box shows). */
  if(live()&&/<option value="[^"]+"/.test(m[0]))return x;
  return x.replace(re,BOX);};}
function setResult(r){var box=document.getElementById('scResult'),hid=document.getElementById('scSubId');if(!box||!hid)return;
  if(r&&r.id){hid.value=r.id;box.innerHTML='<div class="sc-ok" id="scOk">✓ Your employer: <b>'+E(r.name)+'</b><div class="small">Not your employer? Check the code and try again.</div></div>';}
  else{hid.value='';box.innerHTML=r&&r.error?'<div class="sc-bad" id="scBad">'+E(r.error)+'</div>':'';}}
ACT.sccheck=function(){var i=document.getElementById('scCode');if(!i)return;var b=document.getElementById('scCheck');if(b)b.disabled=true;
  lookup(i.value).then(function(r){setResult(r);if(r&&r.id)i.value=fmtCode(i.value);}).then(function(){if(b)b.disabled=false;});};
document.addEventListener('input',function(e){if(e.target&&e.target.id==='scCode'){var hid=document.getElementById('scSubId');if(hid&&hid.value)setResult(null);}},true);
document.addEventListener('keydown',function(e){if(e.target&&e.target.id==='scCode'&&e.key==='Enter'){e.preventDefault();ACT.sccheck();}},true);
/* no employer confirmed yet -> clear message (both stores) */
if(FORMS&&typeof FORMS.signup==='function'){var _su=FORMS.signup;FORMS.signup=function(f,d){if(d&&d.type==='worker'&&document.getElementById('scBox')&&!d.subId){toast('Type the join code from your employer and tap Check first.');var i=document.getElementById('scCode');if(i)i.focus();return;}return _su.apply(this,arguments);};}
/* prefill from invite link */
function prefill(){if(!JOIN)return;var i=document.getElementById('scCode');if(i&&!i.value&&!i.dataset.sc){i.dataset.sc='1';i.value=fmtCode(JOIN);ACT.sccheck();}}
/* ---------- subcontractor: code card ---------- */
function inviteLink(c){var u=location.origin+location.pathname;return u+'?join='+normCode(c)+'#/signup/worker';}
var CARD='<div class="card sc-card" id="scCard"><h3 style="margin-top:0">Your worker join code</h3><p class="small">Give this code to your workers. They type it when they sign up, so their account is linked to your company. Workers never see a list of other companies.</p>'+
  '<div class="sc-codebig" id="scMine">…</div><div class="row sc-acts"><button type="button" class="small btn-indigo-outline" data-act="sccopy" data-w="code">Copy code</button><button type="button" class="small btn-indigo-outline" data-act="sccopy" data-w="link">Copy invite link</button><button type="button" class="small sec" data-act="scnew">Make a new code</button></div>'+
  '<div class="small muted">A new code stops the old one working. Workers who already signed up are not affected.</div></div>';
var NOCARD=false;/* live without 016r (reg_sub_join_code missing): no card */
function addCard(x){x=String(x);if(NOCARD||(ME&&ME.accountApproved===false)||x.indexOf('id="scCard"')>=0)return x;/* code works only once the office approved the sub */var i=x.indexOf('</h1>');return i<0?CARD+x:x.slice(0,i+5)+CARD+x.slice(i+5);}
['sub:home','sub:workers'].forEach(function(k){var ov=VIEWS[k];if(typeof ov==='function')VIEWS[k]=function(){return addCard(ov.apply(this,arguments));};});
var MINE=null;function fillCard(){var el=document.getElementById('scMine');if(!el||el.dataset.sc)return;el.dataset.sc='1';
  myCode(false).then(function(c){MINE=c;if(!c&&live()){NOCARD=true;var cd=document.getElementById('scCard');if(cd)cd.remove();return;}el.textContent=c?fmtCode(c):'Could not load the code – please refresh.';});}
ACT.sccopy=function(el){if(!MINE)return;var t=el.dataset.w==='link'?inviteLink(MINE):fmtCode(MINE);
  var ok=function(){toast(el.dataset.w==='link'?'Invite link copied.':'Code copied.');};
  try{navigator.clipboard.writeText(t).then(ok,function(){prompt('Copy this:',t);});}catch(e){prompt('Copy this:',t);}};
ACT.scnew=function(){if(!confirm('Make a new code? The old code will stop working for new sign-ups.'))return;myCode(true).then(function(c){MINE=c;var el=document.getElementById('scMine');if(el)el.textContent=c?fmtCode(c):'Could not make a new code.';if(c)toast('New code ready.');});};
function pass(){try{prefill();if(ME&&ME.type==='sub')fillCard();}catch(e){}}
try{new MutationObserver(function(){pass();}).observe(document.documentElement,{childList:true,subtree:true});}catch(e){}
document.addEventListener('DOMContentLoaded',pass);
window.subCode={lookup:lookup,fmt:fmtCode};
})();
