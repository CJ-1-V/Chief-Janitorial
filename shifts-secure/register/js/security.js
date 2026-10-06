/* Login security guardrails (local demonstration of what the real server will enforce – see SECURITY-PLAN.md). */
'use strict';
var LOCK_TRIES=5,LOCK_MIN=15,IDLE_MIN=30,CODE_MIN=10;
var COMMON_PW=['password','password1','password123','passw0rd','123456789','1234567890','12345678','qwertyuiop','qwerty123','iloveyou','welcome1','welcome123','letmein','admin123','administrator','unscramble','unscramble1','summer2026','winter2026','test1234','testing123','abc123456','monkey123','football','baseball','11111111','00000000','trustno1','sunshine','princess','dragon123','farmwork','harvest2026','changeme','potato123'];
function pwCheck(pw,ctx){pw=pw||'';var m=[],low=pw.toLowerCase();
  if(pw.length<10)m.push('at least 10 characters');
  var hit=COMMON_PW.filter(function(c){return low===c||(c.length>=8&&low.indexOf(c)>=0);})[0];if(hit||/^(.)\1+$/.test(pw)||/^(0123456789|abcdefghij)/.test(low))m.push(hit&&hit!==low?'no common word or pattern (it contains “'+hit+'”)':'not a common or easy-to-guess password');
  var names=[];if(ctx){[ctx.username,ctx.email&&String(ctx.email).split('@')[0]].forEach(function(x){if(x)names.push(String(x).toLowerCase());});String(ctx.name||'').toLowerCase().split(/\s+/).forEach(function(x){if(x.length>=3)names.push(x);});}
  if(names.some(function(n){return n.length>=3&&low.indexOf(n)>=0;}))m.push('not your name or username');
  var cls=[/[a-z]/,/[A-Z]/,/\d/,/[^A-Za-z0-9]/].filter(function(r){return r.test(pw);}).length;
  var score=(pw.length>=10?1:0)+(pw.length>=14?1:0)+(cls>=3?1:0)+(cls===4?1:0);if(m.length)score=Math.min(score,1);
  return {ok:!m.length,msgs:m,score:score,label:['Too weak','Weak','OK','Strong','Very strong'][score]};}
CALC.pw=function(el){var f=el.form,ctx=ME&&ME.type!=='admin'?ME:{};if(f){ctx={username:(f.username&&f.username.value)||(ctx.username||''),email:(f.email&&f.email.value)||(ctx.email||''),name:(f.name&&f.name.value)||(ctx.name||'')};if(f.id&&f.id.value){var u=user(f.id.value);if(u)ctx=u;}}
  var r=pwCheck(el.value,ctx),m=el.parentNode.querySelector('.pwmeter');if(!m)return;
  m.innerHTML='<div class="pwbar"><div style="width:'+(el.value?(r.score+1)*20:0)+'%;background:'+['#c0392b','#e67e22','#D9A03C','#1f8a4c','#1f8a4c'][r.score]+'"></div></div><div class="small">'+(el.value?'<b>'+r.label+'</b>'+(r.msgs.length?' – needs: '+esc(r.msgs.join(', ')):' ✓ meets the rules'):esc(PW_IDLE))+'</div>';};
/* friendly password messages (one wording everywhere) */
var PW_IDLE='At least 10 characters. Tip: 3 or 4 random words and a number work well, like Green-Bucket-Sky-82 (make up your own).';
function pwMsg(r){return 'Please choose a stronger password. It needs: '+r.msgs.join('; ')+'. Tip: 3 or 4 random words and a number work well, like Green-Bucket-Sky-82 (make up your own).';}
function afterRender(root){[].forEach.call((root||document).querySelectorAll('input[name=pw]'),function(el){if(el.dataset.calc)return;el.dataset.calc='pw';el.setAttribute('autocomplete','new-password');var m=document.createElement('div');m.className='pwmeter';el.parentNode.appendChild(m);CALC.pw(el);});}
function pwGuard(formName,ctxFn,after){var orig=FORMS[formName];FORMS[formName]=function(f,d){var r=pwCheck(d.pw,ctxFn(d));if(!r.ok){toast(pwMsg(r));return;}orig(f,d);if(after)after(d);};}
pwGuard('signup',function(d){return d;});
pwGuard('reset2',function(){return PAGE_STATE.reset?user(PAGE_STATE.reset.uid):{};},null);
pwGuard('pw',function(){return ME;},function(){if(ME){ME.mustChangePw=false;save();}});
pwGuard('adminpw',function(d){return user(d.id);},function(d){var u=user(d.id);u.mustChangePw=true;u.failed=0;u.lockedUntil=0;save();});
pwGuard('addworker',function(d){return d;});
pwGuard('newfirm',function(d){return d;});

/* New self sign-ups wait for office approval; sub-added workers too */
(function(){var orig=FORMS.signup;FORMS.signup=function(f,d){var n=DB.users.length;orig(f,d);if(DB.users.length>n){var u=DB.users[DB.users.length-1];u.accountApproved=false;notify('admin','New account waiting for your approval: '+u.name+' ('+TYPES[u.type]+').');logLogin(u,u.username||u.email,true,'New account (signed up)');save();go('#/pending');}};
  var oa=FORMS.addworker;FORMS.addworker=function(f,d){var n=DB.users.length;oa(f,d);if(DB.users.length>n){var u=DB.users[DB.users.length-1];u.accountApproved=false;notify('admin','New worker account added by '+ME.name+' – waiting for office approval: '+u.name);save();render();}};})();

/* Login history */
function logLogin(u,typed,ok,reason){DB.logins.unshift({at:new Date().toISOString(),userId:u?u.id:null,name:u?u.name:'(unknown)',typed:typed||'',device:deviceInfo(),ok:!!ok,reason:reason||''});if(DB.logins.length>1500)DB.logins.length=1500;}
function hm(ms){var d=new Date(ms);return pad(d.getHours())+':'+pad(d.getMinutes());}

/* Sign in with lockout + optional 2-step code */
/* Sign-in works like the LIVE app (Oct 4 2026, migration 016g + PR #18): email, phone number or username.
   Live has no per-account lock and no "tries left" count: Supabase Auth rate-limits sign-ins and the phone/username
   lookup allows 10 failed tries per login per 15 minutes, then says "Too many tries. Please wait a few minutes…".
   This test copy copies that (tries kept in memory only). */
var LOGIN_TRY_MAX=10,LOGIN_TRY_MIN=15,LOGIN_TRIES={};
var MSG_WRONG_LOGIN='That login and password don\u2019t match. Check for typos, or use \u201cForgot password?\u201d.',MSG_TOO_MANY='Too many tries. Please wait a few minutes and try again.',MSG_TURNED_OFF='This account is turned off. Please contact the office.';
function loginDigits(s){s=String(s||'').trim();if(!/^[\d\s().+\-]+$/.test(s))return '';var dg=s.replace(/\D/g,'');return dg.length===10?dg:(dg.length===11&&dg[0]==='1')?dg.slice(1):'';}
function findLoginLive(login,pw){var u=findLogin(login);if(u)return u;var dg=loginDigits(login);if(!dg)return null;
  var c=DB.users.filter(function(x){return [x.phone,x.profile&&x.profile.phone,x.company&&x.company.phone].some(function(ph){return loginDigits(ph)===dg;});});
  return c.filter(function(x){return x.passHash===hashPw(pw);})[0]||null;}
FORMS.login=function(f,d){var key=String(d.login||'').trim().toLowerCase(),now=Date.now();LOGIN_TRIES[key]=(LOGIN_TRIES[key]||[]).filter(function(t){return now-t<LOGIN_TRY_MIN*60000;});
  if(LOGIN_TRIES[key].length>=LOGIN_TRY_MAX){logLogin(null,d.login,false,'Too many tries (wait a few minutes)');save();toast(MSG_TOO_MANY);return;}
  var u=findLoginLive(d.login,d.password);
  if(!u||u.passHash!==hashPw(d.password)){LOGIN_TRIES[key].push(now);logLogin(u,d.login,false,u?'Wrong password':'Unknown login');save();toast(MSG_WRONG_LOGIN);return;}
  if(!u.active){logLogin(u,d.login,false,'Account disabled');save();toast(MSG_TURNED_OFF);return;}
  u.failed=0;u.lockedUntil=0;
  if(u.twoStep){var code=String(Math.floor(100000+Math.random()*900000));PAGE_STATE.twofa={uid:u.id,code:code,exp:Date.now()+CODE_MIN*60000,tries:0};
    notify(u.id,'Your UnScramble sign-in code is '+code+' (valid '+CODE_MIN+' minutes). Simulated – not really sent.');logLogin(u,d.login,true,'Password OK – 2-step code sent');save();go('#/2fa');return;}
  finishLogin(u,'Password');};
function finishLogin(u,how){ME=u;u.lastLogin=new Date().toISOString();sessionStorage.setItem('us-test-me',u.id);touch();logLogin(u,u.username||u.email,true,'Signed in ('+how+')');audit('Signed in',u.name,how);runAlerts();save();go('#/home');}
VIEWS.twofa=function(){var st=PAGE_STATE.twofa;if(!st)return VIEWS.login();var u=user(st.uid);
  return '<div class="login-wrap"><div class="card"><h1>2-step sign-in</h1><p>We sent a 6-digit code to '+esc(u.email||u.phone||'your account')+'. Enter it below.</p><div class="alert info small"><b>Test version:</b> nothing is really sent. The simulated message (also listed in the office Alerts outbox) says: <b>Your sign-in code is '+st.code+'</b></div><form data-form="twofa">'+inp('code','6-digit code','',{req:true,extra:' inputmode="numeric" maxlength="6" data-autofocus autocomplete="one-time-code"'})+'<button>Verify and sign in</button> <a href="#/" data-act="cancel2fa" class="btn sec">Cancel</a></form></div></div>';};
FORMS.twofa=function(f,d){var st=PAGE_STATE.twofa;if(!st){go('#/');return;}var u=user(st.uid);
  if(Date.now()>st.exp){PAGE_STATE.twofa=null;logLogin(u,u.username,false,'2-step code expired');save();toast('That code has expired. Please sign in again to get a new code.');go('#/');return;}
  if(d.code!==st.code){st.tries++;logLogin(u,u.username,false,'Wrong 2-step code');save();if(st.tries>=5){PAGE_STATE.twofa=null;toast('Too many wrong codes. Please sign in again to get a new code.');go('#/');}else toast('That code is not right. Check the 6 digits and try again.');return;}
  PAGE_STATE.twofa=null;finishLogin(u,'Password + 2-step code');};
ACT.cancel2fa=function(){PAGE_STATE.twofa=null;go('#/');};

/* Auto sign-out after 30 minutes idle */
var LAST_ACT=Date.now();function touch(){LAST_ACT=Date.now();}
['click','keydown','input','touchstart','scroll'].forEach(function(e){document.addEventListener(e,touch,{passive:true});});
function checkIdle(){if(ME&&Date.now()-LAST_ACT>IDLE_MIN*60000){logLogin(ME,ME.username||ME.email,true,'Auto signed out after '+IDLE_MIN+' min idle');audit('Auto signed out ('+IDLE_MIN+' min idle)',ME.name);save();ME=null;sessionStorage.removeItem('us-test-me');closeModal();PAGE_STATE.loginMsg='For your safety you were signed out after '+IDLE_MIN+' minutes without activity. Please sign in again.';go('#/');}}
setInterval(checkIdle,30000);
(function(){var ol=VIEWS.login;VIEWS.login=function(){var m=PAGE_STATE.loginMsg;PAGE_STATE.loginMsg=null;return (m?'<div class="login-wrap" style="margin-bottom:0"><div class="alert warn">'+esc(m)+'</div></div>':'')+ol();};})();

/* Route gates: account approval → forced password change → terms */
function gateRoute(h){if(!ME)return h;if(ME.accountApproved===false)return h==='#/profile'?h:'#/pending';if(ME.mustChangePw)return '#/changepw';if(missingTerms(ME).length&&h!=='#/terms'&&h!=='#/profile')return '#/terms';return h;}
function gateNav(u){if(u.accountApproved===false)return [['#/pending','Waiting for approval'],['#/profile','Profile']];if(u.mustChangePw)return [['#/changepw','Set a new password']];if(missingTerms(u).length)return [['#/terms','Accept terms'],['#/profile','Profile']];return null;}
VIEWS.pending=function(){return '<h1>Please wait – the office will check your account</h1><div class="alert warn" id="pendingmsg"><b>Your account is created ✓</b> The office checks every new account before it can be used. Once it is approved, sign in again and you can continue. There is nothing else you need to do for now.</div><div class="card small">Account: '+esc(ME.name)+' · '+esc(TYPES[ME.type])+(ME.type==='tester'?' <span class="badge-test">TEST</span>':'')+'<br>Created: '+fmtStamp(ME.createdAt)+'</div>';};
VIEWS.changepw=function(){return '<h1>Set a new password</h1><div class="alert warn">The office asked you to set a new password before you continue.</div><div class="card"><form data-form="forcepw">'+inp('old','Current (temporary) password','',{type:'password',req:true})+inp('pw','New password','',{type:'password',req:true})+inp('pw2','Repeat new password','',{type:'password',req:true})+'<button>Save new password</button></form></div>';};
FORMS.forcepw=function(f,d){if(ME.passHash!==hashPw(d.old)){toast('The temporary password is not right. Check it and try again.');return;}if(d.pw!==d.pw2){toast('The two new passwords are not the same. Please type them again.');return;}var r=pwCheck(d.pw,ME);if(!r.ok){toast(pwMsg(r));return;}if(hashPw(d.pw)===ME.passHash){toast('Please choose a new password – not the one you have now.');return;}ME.passHash=hashPw(d.pw);ME.mustChangePw=false;audit('Changed password (forced reset)',ME.name);save();toast('New password saved ✓');go('#/home');};

/* Role-based access: every action is checked against the signed-in role */
var ADMIN_ONLY_ACT='wcbnow invreviewed verifybank verifyempbank confirmlic rejectdoc approveacct person toggleactive suspend invcsv invact closerec wpcsv wpcopy wpadded wpupdated wpoverride testersoff convert fbshot optin anacsv runalerts closepriv exportall firmview tempoff fcdec fcfilter approvenew declinenew forcereset unlock reveal toggle2fa'.split(' ');
var ADMIN_ONLY_FORM='reviewdoc pfilter emppay orient adminpw publish ifilter newrec wpreauth wpoverride newshift settings consentver mkt newfirm firmrate addsite tempon tempext reauthreveal'.split(' ');
var ROLE_ONLY={firmchg:['firm'],firmedit:['firm'],subflag:['sub'],addworker:['sub'],crew:['sub'],recup:['sub'],company:['sub'],invoice:['sub','tester'],invsubmit:['sub','tester'],regEmp:['employee'],regWorker:['worker'],book:['employee','tester'],clockin:['employee','worker','tester'],clockout:['employee','worker','tester']};
function actionAllowed(name,kind){if(!ME)return ['login','reset1','reset2','signup','twofa','quick','resetData','cancel2fa','closeModal'].indexOf(name)>=0||!(kind==='act'?ADMIN_ONLY_ACT:ADMIN_ONLY_FORM).concat(Object.keys(ROLE_ONLY)).some(function(x){return x===name;});
  if((kind==='act'?ADMIN_ONLY_ACT:ADMIN_ONLY_FORM).indexOf(name)>=0)return ME.type==='admin';if(ROLE_ONLY[name])return ROLE_ONLY[name].indexOf(ME.type)>=0;
  if(ME.accountApproved===false)return ['logout','closeModal','profile','pw','privreq'].indexOf(name)>=0;return true;}
function denied(name){toast('You can\'t do that with this account. If you think this is wrong, contact the office.');if(ME){audit('Blocked action (role check)',ME.name,name);save();}}

/* Office tools: approve new accounts, force reset, unlock, 2-step, reveal SIN/bank after password, login history */
(function(){var orig=VIEWS['admin:review'];VIEWS['admin:review']=function(){var p=DB.users.filter(function(u){return u.accountApproved===false;});
  return '<h2 style="margin-top:0">New accounts waiting for approval</h2>'+(p.length?'<div class="tw"><table><tr><th>Name</th><th>Type</th><th>Login</th><th>Created</th><th></th></tr>'+p.map(function(u){return '<tr><td><b>'+esc(u.name)+'</b>'+(u.subId?'<div class="small">employer: '+esc(employerName(u))+'</div>':'')+'</td><td>'+typePill(u)+'</td><td class="small">'+esc(u.username||'')+' '+esc(u.email||'')+'</td><td class="small">'+fmtStamp(u.createdAt)+'</td><td><button class="small" data-act="approvenew" data-id="'+u.id+'">Approve account</button><button class="small danger" data-act="declinenew" data-id="'+u.id+'">Decline (switch off)</button></td></tr>';}).join('')+'</table></div>':'<p class="muted">None.</p>')+orig();};})();
ACT.approvenew=function(el){var u=user(el.dataset.id);u.accountApproved=true;if(u.type==='tester')u.approved=true;audit('Approved new account',u.name,TYPES[u.type]);notify(u.id,'Your UnScramble account was approved. You can now sign in and continue.');save();render();};
ACT.declinenew=function(el){var u=user(el.dataset.id);u.active=false;u.accountApproved=false;audit('Declined new account (switched off)',u.name);save();render();};
(function(){var of=adminFlags;adminFlags=function(){var f=of();var n=DB.users.filter(function(u){return u.accountApproved===false&&u.active;}).length;if(n)f.unshift({t:'New accounts',c:'s-pend',h:n+' new account(s) waiting for approval. <a href="#/review">Review →</a>'});var lk=DB.users.filter(function(u){return u.lockedUntil&&u.lockedUntil>Date.now();});lk.forEach(function(u){f.push({t:'Locked',c:'s-bad',h:esc(u.name)+' locked until '+hm(u.lockedUntil)+' (failed sign-ins). <button class="small sec" data-act="unlock" data-id="'+u.id+'">Unlock</button>'});});return f;};})();
(function(){var op=showPerson;showPerson=function(id){op(id);var u=user(id),m=document.querySelector('#modal .modal');if(!m)return;var hist=DB.logins.filter(function(l){return l.userId===id;}).slice(0,10);
  var x='<h3>Sign-in security</h3><div class="row">'+(u.type!=='admin'||u.id!==ME.id?'<button class="small sec" data-act="forcereset" data-id="'+u.id+'">'+(u.mustChangePw?'Password reset required ✓':'Force password reset at next sign-in')+'</button>':'')+(u.lockedUntil&&u.lockedUntil>Date.now()?'<button class="small" data-act="unlock" data-id="'+u.id+'">Unlock (locked until '+hm(u.lockedUntil)+')</button>':'')+(u.type==='admin'||u.type==='firm'?'<button class="small sec" data-act="toggle2fa" data-id="'+u.id+'">2-step code: '+(u.twoStep?'ON – turn off':'OFF – turn on')+'</button>':'')+(u.accountApproved===false?'<button class="small" data-act="approvenew" data-id="'+u.id+'">Approve account</button>':'')+'</div>';
  if(u.type==='employee'||u.type==='sub')x+='<form data-form="reauthreveal" class="row" style="margin-top:8px"><input type="hidden" name="id" value="'+u.id+'"><input type="password" name="pass" placeholder="Re-enter your password" style="max-width:220px" required><button class="small sec">Show full '+(u.type==='employee'?'SIN and bank':'bank')+' details</button></form><div id="revealbox"></div>';
  x+='<h3>Recent sign-ins</h3>'+(hist.length?'<div class="tw"><table><tr><th>Time</th><th>Result</th><th>Device</th></tr>'+hist.map(function(l){return '<tr><td class="small">'+fmtStamp(l.at)+'</td><td>'+(l.ok?'<span class="pill s-ok">OK</span>':'<span class="pill s-bad">Failed</span>')+' <span class="small">'+esc(l.reason)+'</span></td><td class="small">'+esc(l.device)+'</td></tr>';}).join('')+'</table></div>':'<p class="muted small">No sign-ins recorded yet.</p>');
  var d=document.createElement('div');d.innerHTML=x;m.appendChild(d);stackTables(d);};})();
ACT.forcereset=function(el){var u=user(el.dataset.id);u.mustChangePw=true;audit('Office forced password reset',u.name);notify(u.id,'The office asked you to set a new password at your next sign-in.');save();showPerson(u.id);};
ACT.unlock=function(el){var u=user(el.dataset.id);u.lockedUntil=0;u.failed=0;audit('Office unlocked account',u.name);save();closeModal();render();};
ACT.toggle2fa=function(el){var u=user(el.dataset.id);u.twoStep=!u.twoStep;audit('2-step code '+(u.twoStep?'turned on':'turned off')+' by office',u.name);save();showPerson(u.id);};
FORMS.reauthreveal=function(f,d){if(ME.passHash!==hashPw(d.pass)){toast('Password does not match.');audit('Failed re-authentication for sensitive data',user(d.id).name);save();return;}var u=user(d.id),p=u.profile||{},c=u.company||{};
  document.getElementById('revealbox').innerHTML='<div class="alert warn small">Sensitive – shown after password check (logged). '+(u.type==='employee'?'SIN: <b>'+esc(dec(p.sin)||'–')+'</b> · Bank: <b>'+esc(p.bankInst||'')+'-'+esc(p.bankTransit||'')+' '+esc(dec(p.bankAcct)||'–')+'</b>':'Bank: <b>'+esc(c.bankInst||'')+'-'+esc(c.bankTransit||'')+' '+esc(dec(c.bankAcct)||'–')+'</b>')+'</div>';audit('Re-authenticated and viewed SIN/bank',u.name);save();};
(function(){var opf=VIEWS.profile;VIEWS.profile=function(){var x=opf();if(ME.type==='admin'||ME.type==='firm')x+='<div class="card"><h3 style="margin-top:0">2-step sign-in (optional)</h3><p class="small">When on, signing in also needs a 6-digit code sent to you (simulated in this test – shown on screen and in the office Alerts outbox).</p><button class="sec" data-act="my2fa">'+(ME.twoStep?'Turn 2-step sign-in OFF':'Turn 2-step sign-in ON')+'</button></div>';return x;};})();
ACT.my2fa=function(){ME.twoStep=!ME.twoStep;audit('2-step code '+(ME.twoStep?'turned on':'turned off'),ME.name);save();toast('2-step sign-in is '+(ME.twoStep?'ON':'OFF')+'.');render();};
NAV.admin.splice(NAV.admin.length-1,0,['#/logins','Login history']);
VIEWS['admin:logins']=function(){var f=PAGE_STATE.lf||'';var list=DB.logins.filter(function(l){return !f||(f==='fail'?!l.ok:l.ok);}).slice(0,400);
  return '<h1>Login history</h1><p class="small muted">Every sign-in attempt: time, account, device, success or failure. Accounts lock for '+LOCK_MIN+' minutes after '+LOCK_TRIES+' failed tries. Auto sign-out after '+IDLE_MIN+' minutes idle.</p><div class="row"><button class="small '+(f===''?'':'sec')+'" data-act="lfilter" data-f="">All</button><button class="small '+(f==='fail'?'':'sec')+'" data-act="lfilter" data-f="fail">Failed only</button><button class="small '+(f==='ok'?'':'sec')+'" data-act="lfilter" data-f="ok">Successful only</button></div><div class="tw" style="margin-top:8px"><table><tr><th>Time</th><th>Account</th><th>Typed login</th><th>Result</th><th>Device</th></tr>'+list.map(function(l){return '<tr><td class="small">'+fmtStamp(l.at)+'</td><td>'+esc(l.name)+'</td><td class="small">'+esc(l.typed)+'</td><td>'+(l.ok?'<span class="pill s-ok">Success</span>':'<span class="pill s-bad">Failed</span>')+' <span class="small">'+esc(l.reason)+'</span></td><td class="small">'+esc(l.device)+'</td></tr>';}).join('')+'</table></div>';};
ACT.lfilter=function(el){PAGE_STATE.lf=el.dataset.f;render();};
