/* v2-msgsend.js – msgsend1 (owner request Oct 22, 2026 5:51 PM ET). TEST COPY – nothing is really sent.
   ONE way for the app to send texts (business number) and emails (admin@unscramble.ca) for:
   (a) Forgot password – a 6-digit code by TEXT or EMAIL, so phone-only people can reset too.
       Code lasts 10 minutes, max 5 tries, max 3 codes an hour per account; only a fingerprint (hash) is kept;
       the screen never says whether an account was found. If the chosen way is missing (or the number replied STOP)
       the code goes the other way when the account has it.
   (b) Farm "Invite a manager or supervisor" – UnScramble sends the invite for the farm (text, email fallback),
       with role, expiry, status (sent / not delivered / opened / joined / expired / cancelled) and Resend.
   (c) Office "Send invite" (v2-farminvite.js) – same server function.
   LIVE: every send goes through ONE server function, reg-messages (provider keys stay on the server; provider is
   chosen there: SMS_PROVIDER = quo | telnyx | twilio). The live buttons only call it when REG_STORE.messagesFn === true
   (forgot by text) or REG_STORE.inviteFn === true (invites); until then the live site behaves exactly as today. */
'use strict';
(function(){
var MS_CODE_MIN=10,MS_TRIES=5,MS_PER_HOUR=3,MS_FROM_SMS=(typeof FI_FROM_SMS!=='undefined'?FI_FROM_SMS:'+1 902-200-4888'),MS_FROM_EMAIL='admin@unscramble.ca';
function live(){return !!(window.REG_STORE&&window.REG_STORE.mode==='supabase');}
function fnReady(k){return !!(window.REG_LIVE&&window.REG_STORE&&window.REG_STORE[k]===true);}
function d10(s){var d=String(s||'').replace(/\D/g,'');if(d.length===11&&d[0]==='1')d=d.slice(1);return d.length===10?d:'';}
function bz(o,m){try{if(typeof busy==='function')busy(o,m);}catch(e){}}
function invoke(body){return window.REG_SB.functions.invoke('reg-messages',{body:body}).then(function(r){
  if(r.error||!r.data)return {error:(r.data&&r.data.error)||'Could not send right now. Please try again or contact the office.'};return r.data;},function(){return {error:'Could not send right now.'};});}
function phoneOf(u){return u&&(u.phone||(u.profile&&u.profile.phone)||(u.company&&u.company.phone))||'';}
function emailOf(u){var e=String(u&&u.email||'').trim().toLowerCase();if(!fiEmailOk(e))return '';
  if(live()){var dom=String((window.REG_STORE&&window.REG_STORE.loginDomain)||'').toLowerCase();if(dom&&e.slice(-dom.length-1)==='@'+dom)return '';}return e;}
function findAcc(login){var s=String(login||'').trim().toLowerCase(),ph=d10(s);if(!s)return null;
  return (DB.users||[]).filter(function(u){return (u.username&&u.username.toLowerCase()===s)||(u.email&&u.email.toLowerCase()===s)||(ph&&(d10(u.phone)===ph||d10(u.profile&&u.profile.phone)===ph||d10(u.company&&u.company.phone)===ph));})[0]||null;}
function genCode(){var a=new Uint32Array(1);(window.crypto||window.msCrypto).getRandomValues(a);return String(100000+(a[0]%900000));}
function codeHash(c){return hashPw('ms-reset:'+String(c||''));}

/* ---------- one dry-run transport (TEST COPY). Live = reg-messages. ---------- */
/* to {name, phone, email}; msg {sms:'text', email:{subject,text}}; want 'sms'|'email'|'auto'; meta saved with the outbox row */
function msDeliver(to,msg,want,meta,cb){var res=[],order=want==='email'?['email','sms']:want==='sms'?['sms','email']:['sms','email'];
  if(meta&&meta.strict)order=order.slice(0,1);
  var go1=function(k){var ch=order[k];if(!ch){cb(res);return;}
    if(ch==='sms'&&!fiE164(to.phone)){res.push({channel:'sms',status:'skipped',why:'no mobile number'});return go1(k+1);}
    if(ch==='sms'&&fiOptedOut(to.phone)){res.push({channel:'sms',status:'skipped',why:'number replied STOP'});return go1(k+1);}
    if(ch==='email'&&!fiEmailOk(to.email)){res.push({channel:'email',status:'skipped',why:'no email'});return go1(k+1);}
    var fail=ch==='sms'&&/0000$/.test(fiE164(to.phone));          /* test: a mobile ending 0000 = not delivered */
    var row={id:uid('fo'),at:new Date().toISOString(),channel:ch,dryRun:true,status:fail?'failed':'sent',kind:meta&&meta.kind||'',
      to:ch==='sms'?fiE164(to.phone):String(to.email).trim(),from:ch==='sms'?'PN5pixOySo ('+MS_FROM_SMS+')':MS_FROM_EMAIL};
    if(ch==='sms')row.content=msg.sms;else{row.subject=msg.email.subject;row.text=msg.email.text;row.html='';}
    if(meta&&meta.mask){if(row.content)row.content=row.content.split(meta.mask).join('••••••');if(row.text)row.text=row.text.split(meta.mask).join('••••••');}
    if(meta&&meta.inviteId)row.inviteId=meta.inviteId;
    (DB.fiOutbox=DB.fiOutbox||[]).push(row);if(DB.fiOutbox.length>300)DB.fiOutbox.splice(0,DB.fiOutbox.length-300);
    res.push({channel:ch,status:fail?'failed':'sent',dryRun:true,to:ch==='sms'?fiMaskPhone(to.phone):fiMaskEmail(to.email),at:row.at});
    if(fail)return go1(k+1);cb(res);};
  go1(0);}
window.msDeliver=msDeliver;
function okOf(r){return (r||[]).filter(function(x){return x.status==='sent';})[0];}
function resText(r,test){var ok=okOf(r);if(!ok)return 'Not sent: '+((r||[]).map(function(x){return x.why||x.status;}).join(', ')||'no mobile or email');
  return 'Sent by '+(ok.channel==='sms'?'text to '+ok.to+' from '+MS_FROM_SMS:'email to '+ok.to+' from '+MS_FROM_EMAIL)+(test?' (TEST – not really sent)':'');}

/* ---------- message texts (keep in sync with proposed/supabase/functions/reg-messages/text.ts) ---------- */
function codeSms(code){return 'UnScramble: your password reset code is '+code+'. It expires in '+MS_CODE_MIN+' minutes. Didn\'t ask? Ignore this. Reply STOP to opt out.';}
function codeEmail(u,code){return {subject:'Your UnScramble password reset code',text:'Hello '+fiFirst(u.name)+',\n\nYour UnScramble password reset code: '+code+'\n\nEnter it on the reset screen within '+MS_CODE_MIN+' minutes, then choose a new password.\n\nIf you did not ask for this, ignore this email – your password stays the same.\n\nUnScramble – The HR Company Inc.'};}
function teamSms(o){return 'UnScramble: Hi '+fiFirst(o.name)+', '+o.farm+' invited you to its UnScramble app as '+o.role+': '+o.url+' (code '+o.code+', expires '+fiNiceDate(o.expires)+'). Reply STOP to opt out, HELP for help.';}
function teamEmail(o){return {subject:o.farm+' invited you to the UnScramble app',text:'Hello '+fiFirst(o.name)+',\n\n'+o.farm+' invited you to its UnScramble app as '+o.role+'. You will see crews, hours, time sheets and crew orders.\n\nSign up here: '+o.url+'\nYour invite code: '+o.code+' (single use, expires '+fiNiceDate(o.expires)+')\n\nUnScramble checks the sign-up, usually the same day.\n\nDidn\'t expect this? Ignore it – nothing happens without the code.\n\nUnScramble\nPlease do not reply to this email. Questions: call or text '+MS_FROM_SMS+'.'};}
window.msTexts={codeSms:codeSms,codeEmail:codeEmail,teamSms:teamSms,teamEmail:teamEmail};

/* =================== (a) Forgot password: code by text or email =================== */
var MEM={};                                     /* plaintext codes: memory only (TEST hint), never saved */
var NEUTRAL='If we find an account with that login, we\'ll send a 6-digit code to the mobile number or email on file. It expires in '+MS_CODE_MIN+' minutes. Nothing arrives? Check the number/spam, or call or text the UnScramble office at '+MS_FROM_SMS+'.';
var origForgot=VIEWS.forgot,origR1=FORMS.reset1,origR2=FORMS.reset2;
VIEWS.forgot=function(){var st=PAGE_STATE.reset;
  if(st&&st.ms)return '<div class="login-wrap"><div class="card pwforgot ms-forgot" data-step="code"><h1>Enter your code</h1><div class="alert info">'+esc(NEUTRAL)+'</div>'+
    (st.hint?'<div class="alert warn small" id="mshint"><b>TEST:</b> nothing is really sent. The '+(st.hint.ch==='sms'?'text to <b>'+esc(st.hint.to)+'</b> from '+esc(MS_FROM_SMS):'email to <b>'+esc(st.hint.to)+'</b>')+' would contain code <b>'+esc(st.hint.code)+'</b>.</div>':'')+
    '<form data-form="msreset2">'+inp('code','6-digit code','',{req:true,extra:' inputmode="numeric" maxlength="6" pattern="[0-9]{6}" data-autofocus autocomplete="one-time-code"'})+
    inp('pw','New password','',{type:'password',req:true,extra:' autocomplete="new-password"'})+inp('pw2','Repeat new password','',{type:'password',req:true,extra:' autocomplete="new-password"'})+
    '<button>Set new password</button></form><p class="small muted"><a href="#/forgot" data-act="msagain">Send another code</a> · <a href="#/">Back to sign in</a></p></div></div>';
  if(st&&st.step==='sent'&&origForgot)return origForgot.apply(this,arguments);
  return '<div class="login-wrap"><div class="card pwforgot ms-forgot" data-step="request"><h1>Forgot your password?</h1>'+
    '<p>Enter the mobile number, email or username you sign in with. We\'ll send you a 6-digit code.</p><form data-form="msreset1">'+
    inp('login','Mobile number, email or username','',{req:true,extra:' data-autofocus autocomplete="username"'})+
    '<fieldset class="ms-via" id="msvia"><legend class="small">Send my code by</legend><label class="chk"><input type="radio" name="via" value="sms" checked> Text message</label><label class="chk"><input type="radio" name="via" value="email"> Email</label></fieldset>'+
    '<button id="msgo">Send me a code</button></form><p class="small muted">Texts come from UnScramble '+esc(MS_FROM_SMS)+'. Message and data rates may apply. No mobile or email on your account? Call or text the office – they can give you a temporary password.</p><p><a href="#/">Back to sign in</a></p></div></div>';};
FORMS.msreset1=function(f,d){var login=String(d.login||'').trim(),via=d.via==='email'?'email':'sms';if(!login){toast('Enter your mobile number, email or username.');return;}
  if(live()){
    if(!fnReady('messagesFn')){if(via==='email'&&origR1)return origR1.call(this,f,{login:login});toast('Codes by text are not switched on yet. Choose Email, or contact the office.');return;}
    var b=f.querySelector('button');if(b)b.disabled=true;bz(true,'Sending…');
    invoke({action:'reset_request',login:login,via:via}).then(function(r){bz(false);if(b)b.disabled=false;if(r&&r.error&&!r.ok&&/not available|setup/i.test(r.error)){toast(r.error);return;}
      PAGE_STATE.reset={ms:1,login:login,via:via,at:Date.now()};render();});return;}
  /* TEST mock – same screen whatever happens */
  DB.msCodes=DB.msCodes||[];DB.msAttempts=DB.msAttempts||[];var u=findAcc(login),now=Date.now();
  var recent=u?DB.msAttempts.filter(function(a){return a.userId===u.id&&a.k==='req'&&a.at>now-3600000;}).length:0;
  DB.msAttempts.unshift({k:'req',userId:u&&u.id||null,at:now,via:via});DB.msAttempts.length=Math.min(DB.msAttempts.length,500);
  var st={ms:1,login:login,via:via,at:now};
  if(u&&recent<MS_PER_HOUR){var code=genCode();
    msDeliver({name:u.name,phone:phoneOf(u),email:emailOf(u)},{sms:codeSms(code),email:codeEmail(u,code)},via,{kind:'reset_code',mask:code},function(r){var ok=okOf(r);
      audit('Password reset code requested',u.name,'TEST mock · '+(ok?'code '+(ok.channel==='sms'?'texted':'emailed')+' (dry run; code never logged)':'no mobile or email on file – office reset needed'));
      if(ok){DB.msCodes=DB.msCodes.filter(function(c){return c.userId!==u.id;});DB.msCodes.unshift({userId:u.id,hash:codeHash(code),exp:now+MS_CODE_MIN*60000,tries:0,via:ok.channel});MEM[u.id]=code;st.uid=u.id;st.hint={ch:ok.channel,to:ok.to,code:code};}});}
  else audit('Password reset code requested',u?u.name:'(unknown)',u?'TEST mock · rate limited ('+MS_PER_HOUR+'/hour)':'TEST mock · no matching account (not revealed)');
  PAGE_STATE.reset=st;save();render();};
FORMS.msreset2=function(f,d){var st=PAGE_STATE.reset;if(!st||!st.ms){go('#/forgot');return;}
  if(!/^\d{6}$/.test(String(d.code||'').trim())){toast('Enter the 6-digit code.');return;}if(d.pw!==d.pw2){toast('Passwords do not match.');return;}
  if(live()){if(!fnReady('messagesFn')){toast('Please request a new code.');return;}bz(true,'Saving your new password…');
    invoke({action:'reset_confirm',login:st.login,code:String(d.code).trim(),password:d.pw}).then(function(r){bz(false);
      if(!r||!r.ok){toast((r&&r.error)||'That code is not valid or has expired.');return;}PAGE_STATE.reset=null;toast('Password changed. Please sign in.');go('#/');});return;}
  DB.msCodes=DB.msCodes||[];var row=st.uid&&DB.msCodes.filter(function(c){return c.userId===st.uid;})[0];
  var fail=function(m,reset){toast(m);if(reset){DB.msCodes=DB.msCodes.filter(function(c){return c!==row;});PAGE_STATE.reset=null;save();go('#/forgot');}else save();};
  if(!row)return fail('That code is not valid or has expired. Send a new one.');
  if(Date.now()>row.exp)return fail('That code has expired. Please send a new one.',true);
  if(codeHash(String(d.code).trim())!==row.hash){row.tries++;return row.tries>=MS_TRIES?fail('Too many wrong codes. Please send a new one.',true):fail('Wrong code. '+(MS_TRIES-row.tries)+' tries left.');}
  var u=user(row.userId);if(!u)return fail('That code is not valid or has expired.',true);
  var chk=typeof pwCheck==='function'?pwCheck(d.pw,u):{ok:String(d.pw||'').length>=10,msgs:['10+ characters']};if(!chk.ok){toast('Password needs: '+(chk.msgs||[]).join(', ')+'.');return;}
  u.passHash=hashPw(d.pw);u.mustChangePw=false;u.failed=0;u.lockedUntil=0;DB.msCodes=DB.msCodes.filter(function(c){return c.userId!==u.id;});delete MEM[u.id];
  audit('Password reset by '+(row.via==='sms'?'text':'email')+' code',u.name,'self-service · TEST mock (code and password never logged)');PAGE_STATE.reset=null;save();toast('Password changed. Please sign in.');go('#/');};
ACT.msagain=function(){PAGE_STATE.reset=null;go('#/forgot');};
if(typeof PUBLIC_FORMS!=='undefined'&&PUBLIC_FORMS.push)PUBLIC_FORMS.push('msreset1','msreset2');

/* =================== (b) Farm invites its own managers / supervisors =================== */
var RL={manager:'Manager',supervisor:'Supervisor'};
function farmMain(){return !!(ME&&ME.type==='firm');}
function farmOf(){var l=(typeof clLoginOf==='function')?clLoginOf(ME):ME;return l&&l.loginOf?(typeof clResolve==='function'?clResolve(l.loginOf):user(l.loginOf)):ME;}
function farmInvs(){var c=farmOf();return (DB.clientInvites||[]).filter(function(i){return i.byFarm&&c&&i.clientId===c.id;});}
function tStatus(i){if(i.usedBy){var u=user(i.usedBy);return {k:'joined',t:'Joined'+(i.usedAt?' '+fmtStamp(i.usedAt):''),c:'s-ok',who:u};}
  if(i.revokedAt)return {k:'revoked',t:i.replacedBy?'Replaced by resend':'Cancelled',c:'s-mut'};
  if(i.expires<today())return {k:'expired',t:'Expired '+i.expires,c:'s-bad'};
  if(i.openedAt)return {k:'opened',t:'Opened '+fmtStamp(i.openedAt),c:'s-warn'};
  var ok=okOf(i.sends);if(!ok&&(i.sends||[]).some(function(x){return x.status==='failed';}))return {k:'failed',t:'Not delivered',c:'s-bad'};
  if(ok)return {k:'sent',t:'Sent by '+(ok.channel==='sms'?'text':'email')+(ok.dryRun?' (test)':''),c:'s-ok'};
  return {k:'made',t:'Code made – you send it',c:'s-mut'};}
window.msTeamStatus=tStatus;
function sendTeam(i,code,cb){var c=farmOf(),o={name:i.inviteName,farm:c&&c.name||'Your farm',role:RL[i.farmRole]||'Manager',url:clSignupUrl(code),code:code,expires:i.expires};
  var ct=i.inviteContact||'',to={name:i.inviteName,phone:/@/.test(ct)?'':ct,email:/@/.test(ct)?ct:''};
  msDeliver(to,{sms:teamSms(o),email:teamEmail(o)},'auto',{kind:'farm_invite',inviteId:i.id},function(r){i.sends=(i.sends||[]).concat(r);i.lastSentAt=new Date().toISOString();cb(r);});}
var vTeam=VIEWS['firm:team'];
if(vTeam)VIEWS['firm:team']=function(){var h=vTeam.apply(this,arguments);
  var pick='<fieldset class="ms-send" id="mssend"><legend class="small"><b>How should the invite go out?</b></legend>'+
    '<label class="chk"><input type="radio" name="msvia" value="auto" checked> <span><b>UnScramble sends it for me</b><span class="small muted"> – text from '+esc(MS_FROM_SMS)+' (or email from '+MS_FROM_EMAIL+' if you enter an email / the text fails)</span></span></label>'+
    '<label class="chk"><input type="radio" name="msvia" value="self"> <span>I\'ll send the code myself</span></label>'+
    '<label class="chk ms-consent"><input type="checkbox" name="msconsent" id="msconsent" checked> <span class="small">This person expects this invite and agreed to get it by text or email.</span></label></fieldset>';
  h=h.replace(/(<div class="small muted fr-note">[\s\S]*?)You get a one-time code and link to send yourself – the app sends nothing\./,pick+'$1UnScramble sends the code and link for you, or you send them yourself.');
  h=h.replace('id="frinvgo">Make invite<','id="frinvgo">Send invite<');
  var L=farmInvs().slice().reverse();
  if(L.length){var rows=L.slice(0,12).map(function(i){var s=tStatus(i),ok=okOf(i.sends),act=(s.k==='made'||s.k==='sent'||s.k==='failed'||s.k==='opened'||s.k==='expired');
    return '<div class="ms-row" data-msinv="'+esc(i.id)+'"><div><b>'+esc(i.inviteName||'')+'</b> <span class="pill">'+esc(RL[i.farmRole]||'')+'</span> <span class="pill '+s.c+'">'+esc(s.t)+'</span>'+
      '<div class="small muted">'+esc(i.inviteContact||'')+' · code ••••-'+esc(i.last4||'')+' · until '+esc(i.expires)+(ok?' · last sent '+esc(fmtStamp(ok.at)):'')+(s.who?' · login '+esc(s.who.username||s.who.email||s.who.phone||''):'')+'</div></div>'+
      (act?'<button type="button" class="small sec" data-act="msteamresend" data-id="'+esc(i.id)+'">Resend</button>':'')+'</div>';}).join('');
    h=h.replace(/(<div class="card fr-card" id="frinvite">)/,'<div class="card fr-card" id="msstatus"><div class="fr-card-h"><h2>Invite status</h2><span class="fr-count">'+L.length+'</span></div><p class="small muted">See who got the invite and who has joined. Resend makes a new code – the old one stops working.</p>'+rows+'</div>$1');}
  return h;};
var fTeam=FORMS.frteaminvite;
if(fTeam)FORMS.frteaminvite=function(f,d){var self=d.msvia==='self';
  if(!self&&!d.msconsent){toast('Tick the box to confirm they expect this invite, or choose "I\'ll send the code myself".');return;}
  var before=(DB.clientInvites||[]).length,r=fTeam.apply(this,arguments);if(self)return r;
  var after=function(code){var box=document.getElementById('frinvbox');
    var note=function(t,bad){if(!box)return;var n=document.createElement('div');n.className='alert '+(bad?'warn':'ok')+' ms-sent';n.id='mssent';n.textContent=t;box.parentNode.insertBefore(n,box);if(!bad){var m=box.closest('.fr-modal')||document;var sp=m.querySelector('.fr-note span');if(sp)sp.textContent='Shown once only. UnScramble sent the invite for you; the status shows on your Team page under Invite status.';var sb=m.querySelector('.fr-sendbtn span');if(sb)sb.textContent='Also send it myself';}};
    if(live()){if(!fnReady('inviteFn')){note('Automatic sending is not switched on yet – please send the code yourself with the button below.',true);return;}
      bz(true,'Sending invite…');invoke({action:'farm_invite',code:code,via:'auto',consent:true}).then(function(x){bz(false);note(x&&x.ok?(x.summary||'Invite sent.'):(x&&x.error)||'Could not send – please send it yourself.',!(x&&x.ok));});return;}
    var i=(DB.clientInvites||[])[(DB.clientInvites||[]).length-1];if(!i||(DB.clientInvites||[]).length===before||!i.byFarm)return;
    sendTeam(i,code,function(res){audit('Farm invite sent by UnScramble',(farmOf()||{}).name||'',i.inviteName+' · '+(RL[i.farmRole]||'')+' · '+resText(res,true)+' · code ending '+i.last4);save();note(resText(res,true),!okOf(res));});};
  var tries=0,poll=function(){var c=document.getElementById('frinvcode');if(c&&c.textContent.trim()){after(c.textContent.trim());return;}if(++tries<60)setTimeout(poll,150);};poll();return r;};
ACT.msteamresend=function(el){if(!farmMain())return;var old=farmInvs().filter(function(i){return i.id===el.dataset.id;})[0];if(!old)return;
  if(live()){if(!fnReady('inviteFn')){toast('Automatic sending is not switched on yet.');return;}bz(true,'Sending…');invoke({action:'farm_resend',invite_id:old.id}).then(function(x){bz(false);toast(x&&x.ok?(x.summary||'Sent again.'):(x&&x.error)||'Could not send.');PAGE_STATE.frTeam=null;render();});return;}
  var today0=new Date().toISOString().slice(0,10),n=farmInvs().filter(function(i){return (i.lastSentAt||'').slice(0,10)===today0;}).length;if(n>=10){toast('Too many invites sent today. Try again tomorrow.');return;}
  var code=clGenCode(),i=Object.assign({},old,{id:uid('finv'),codeHash:clCodeHash(code),last4:code.slice(-4),createdAt:new Date().toISOString(),expires:addDays(today(),14),usedBy:'',usedAt:'',revokedAt:'',openedAt:'',sends:[],replacedBy:''});
  old.revokedAt=new Date().toISOString();old.replacedBy=i.id;DB.clientInvites.push(i);
  sendTeam(i,code,function(res){audit('Farm invite re-sent',(farmOf()||{}).name||'',i.inviteName+' · '+resText(res,true)+' · old code ending '+old.last4+' cancelled');save();PAGE_STATE.frTeam=null;toast(resText(res,true));render();});};
})();
