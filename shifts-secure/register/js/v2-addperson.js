/* v2-addperson.js – Office "Add person" (owner request Oct 5, 2026, 12:06 AM Toronto). TEST ONLY – loaded last, additive.
   "Office should also have an option to add people manually. In this case username is assigned randomly, which can be
    changed by the farm; employee later on can change that; and the email that we enter in this section gets an email
    with their login details and temporary password."
   - Office (Owner, Payroll administrator, Office staff) → People → "Add person": first/last name, role, email (needed for
     the welcome email), phone (optional), employer / client / usual site as fits the role. Office staff: Owner only.
   - Username: made by the app, random but readable (word + 4 digits, e.g. maple4821), unique; the office may edit it.
   - Temporary password: the SAME generator as the one-step office "Reset password" (v2-pwreset.js: 12 symbols, no
     0/O/1/I/L, XXXX-XXXX-XXXX). Must choose a new password at first sign-in (same forced-change screen).
   - Account is approved by the office at once (no "waiting for approval"), but workers/employees/subcontractors still
     need their terms, details and documents before they are cleared to work (normal rules).
   - Welcome email: the office sees the EXACT email first and must click "Send welcome email" (owner rule: no automatic
     outside email). "Copy login details" is offered instead of emailing. TEST: nothing is sent – it lands in
     "Outbox (test)" with the password hidden. The password is never written to the audit log, alerts or saved data.
   - Usernames can be changed later: by the person (Profile → My username), by a farm/client login for the logins of its
     own client (Profile → Logins for your farm account), and by the office (person panel). Unique, audited, notified.
   - Live (supabase) mode: uses window.REG_OFFICE_ADD_PERSON / REG_SEND_WELCOME / REG_CHANGE_USERNAME when the live
     data layer provides them (staged with migration 016j); otherwise the screen says it is not switched on yet. */
'use strict';
(function(){
if(typeof ACT!=='object'||typeof FORMS!=='object'||typeof VIEWS!=='object')return;
var AP_LOGIN_URL='https://www.chiefjanitorial.com/shifts-secure/register/';
var AP_FROM='UnScramble <admin@unscramble.ca>';             /* real sender (owner approved Oct 5 2026) – same as reg-send-welcome */
var AP_WORDS='acorn amber apple aspen barley beacon berry birch breeze brook canyon cedar clover comet copper coral cove daisy delta ember falcon fern finch fjord forest garden harbor harvest hazel heron island juniper kettle lantern laurel lilac maple marble meadow mint nova oak orchard otter pebble pine plum prairie quail raven ridge river robin rowan sage sparrow spruce summit sunny thistle tulip valley willow wren'.split(' ');
var AP_RESERVED=['admin','administrator','office','unscramble','support','root','system','owner','test'];
var AP_ROLES=[['employee','Worker – UnScramble employee'],['worker',"Worker – a subcontractor's worker"],['crewlead',"Crew lead – a subcontractor's worker"],
  ['sub','Subcontractor firm contact (new subcontractor company)'],['firm','Farm / client user (login for an existing client)'],['admin','Office staff (Owner only)']];
var AP_ROLE_LABEL={};AP_ROLES.forEach(function(r){AP_ROLE_LABEL[r[0]]=r[0]==='admin'?'Office staff':r[1];});
var TEMP={};                                                   /* temporary passwords: memory only, never saved */
var TEMP_MIN=30;
function live(){return !!(window.REG_STORE&&window.REG_STORE.mode==='supabase');}
function welcomeOn(){return !!(window.REG_STORE&&window.REG_STORE.welcomeEmail);}
function isOwner(){return typeof officeRoleOf==='function'&&officeRoleOf(ME)==='owner';}
function loginRec(me){return typeof clLoginOf==='function'?clLoginOf(me):me;}
function rnd(n){var a=new Uint32Array(1);(window.crypto||window.msCrypto).getRandomValues(a);return a[0]%n;}
function tempPw(){if(typeof window.genTempPassword==='function')return window.genTempPassword();
  var A='ABCDEFGHJKMNPQRSTUVWXYZ23456789',s='';for(var i=0;i<12;i++){s+=A[rnd(31)];if(i===3||i===7)s+='-';}return s;}
function tempGet(id){var t=TEMP[id];if(t&&Date.now()-t.at>TEMP_MIN*60000){delete TEMP[id];t=null;}return t||null;}
function normName(s){return String(s==null?'':s).trim().toLowerCase();}
function digits10(s){var d=String(s||'').replace(/\D/g,'');if(d.length===11&&d[0]==='1')d=d.slice(1);return d.length===10?d:'';}
function validEmail(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e||'').trim());}

/* ---------- usernames ---------- */
function usernameTaken(n,exceptId){n=normName(n);if(!n)return null;
  return DB.users.filter(function(u){return u.id!==exceptId&&(normName(u.username)===n||normName(u.email)===n);})[0]||null;}
function usernameProblem(n){n=normName(n);
  if(!n)return 'Enter a username.';
  if(n.indexOf('@')>=0)return 'A username cannot contain @ (that would look like an email).';
  if(!/^[a-z][a-z0-9._-]{2,29}$/.test(n))return 'Usernames are 3–30 characters: letters, numbers, dot, dash or underscore, starting with a letter.';
  if(AP_RESERVED.indexOf(n)>=0)return 'That username is reserved. Please pick another.';
  return '';}
function genUsername(){for(var i=0;i<200;i++){var n=AP_WORDS[rnd(AP_WORDS.length)]+String(1000+rnd(9000));if(!usernameTaken(n))return n;}return 'user'+Date.now().toString().slice(-6);}
window.genUsername=genUsername;window.usernameProblem=usernameProblem;
/* one place that changes a username: checks, audit row, alert to the person (never their password) */
function changeUsername(t,raw,how){var n=normName(raw);if(!t)return 'Account not found.';
  var p=usernameProblem(n);if(p)return p;if(normName(t.username)===n)return 'That is already the username.';
  var other=usernameTaken(n,t.id);if(other)return 'That username is already used. Please pick another.';
  var old=t.username||'',by=ME?ME.name+' ('+((loginRec(ME)||ME).username||ME.email||'')+')':'system';
  t.username=n;
  var act={own:'Changed own username',farm:'Farm changed username',office:'Office changed username'}[how]||'Changed username';
  audit(act,t.name,(old?old:'(none)')+' → '+n+' · by '+by+(how==='farm'?' for Client '+((ME.firm&&ME.firm.clientCode)||ME.name):''));
  if(how!=='own')notify(t.id,'Your username was changed to "'+n+'" by '+(how==='farm'?'your farm/client account':'the UnScramble office')+'. Sign in with the new username (or your email). Your password did not change.');
  save();return null;}
window.changeUsername=changeUsername;
/* live: the server (016j reg_change_username) checks, writes the audit row + alert; the store reloads the data */
function liveUsername(t,n,how,done){if(!live())return false;if(typeof window.REG_CHANGE_USERNAME!=='function'){toast('Changing usernames is not switched on for the live site yet.');return true;}
  Promise.resolve(window.REG_CHANGE_USERNAME(t.id,normName(n))).then(function(r){if(r&&r.error){toast(r.error);return;}toast('Username changed to '+normName(n)+'.');done();},function(e){toast(String(e&&e.message||e));});return true;}

/* ---------- the welcome email ---------- */
function rolePhrase(u){var r=(u.addedByOffice||{}).role||u.type;
  if(r==='employee')return 'as an UnScramble employee';if(r==='worker')return 'as a worker for '+employerName(u);if(r==='crewlead')return 'as a crew lead for '+employerName(u);
  if(r==='sub')return 'for your company '+((u.company||{}).legalName||u.name);if(r==='firm')return 'for your farm / client account';if(r==='admin')return 'as UnScramble office staff';return '';}
function firstName(u){var a=u.addedByOffice||{};return a.first||(u.profile&&u.profile.firstName)||String(u.name||'').split(' ')[0];}
function welcomeEmail(u,pw){var nextLine=['employee','worker','crewlead'].indexOf((u.addedByOffice||{}).role)>=0?'\nAfter that, the app shows what is still needed (terms, your details and any documents) before you can be booked for work.\n':(u.type==='sub'?'\nAfter that, the app shows what your company still needs to complete (agreement, company details and documents).\n':'');
  var body='Hello '+firstName(u)+',\n\nThe UnScramble office has created an account for you '+rolePhrase(u)+'.\n\n'+
    'Sign in here: '+AP_LOGIN_URL+'\nUsername: '+u.username+'\nTemporary password: '+pw+'\n\n'+
    'You can also sign in with this email address instead of the username.\n\n'+
    'The first time you sign in you must choose your own new password. The temporary password stops working after that.\n'+nextLine+
    'You can change your username later in My profile.\n\n'+
    'Please do not share this email. If you did not expect it, contact the UnScramble office at '+ADMIN_EMAIL+'.\n\nUnScramble – The HR Company Inc.';
  return {from:AP_FROM,to:u.email,toName:u.name,subject:'Your UnScramble account – sign-in details',body:body};}
function loginText(u,pw){return 'UnScramble – sign-in details for '+u.name+'\nSign in here: '+AP_LOGIN_URL+'\nUsername: '+u.username+' (or email '+u.email+')\nTemporary password: '+pw+'\nYou must choose your own new password the first time you sign in.';}
function emailHtml(m,id){return '<div class="ap-email" id="'+(id||'apemail')+'"><div class="ap-hdr"><div><span>From</span><b>'+esc(m.from)+'</b></div><div><span>To</span><b>'+esc(m.toName)+' &lt;'+esc(m.to)+'&gt;</b></div><div><span>Subject</span><b>'+esc(m.subject)+'</b></div></div><pre class="ap-body">'+esc(m.body)+'</pre></div>';}
function mask(s,pw){return pw?String(s).split(pw).join('••••-••••-••••'):s;}

/* ---------- result: account made → exact email preview → Send / Copy ---------- */
function showResult(u){var t=tempGet(u.id);if(!t){toast('The temporary password is no longer in memory. Use "Send login details again" on the person.');return;}
  var m=welcomeEmail(u,t.pw),sent=t.sentAt;
  var docs=['employee','worker','crewlead','sub'].indexOf((u.addedByOffice||{}).role)>=0;
  modal('<div class="addperson-result" id="apresult" data-user="'+esc(u.username)+'"><h2>'+(t.fresh?'Account created for ':'New login details for ')+esc(u.name)+'</h2>'+
    '<div class="ap-summary"><div><span>Username</span><code id="apuser">'+esc(u.username)+'</code></div><div><span>Role</span><b>'+esc(AP_ROLE_LABEL[(u.addedByOffice||{}).role]||TYPES[u.type])+'</b></div><div><span>Email</span><b>'+esc(u.email)+'</b></div></div>'+
    '<div class="small ap-status">✓ Account approved by the office – no waiting for approval. '+esc(firstName(u))+' must choose a new password at first sign-in.'+(docs?' Still needs terms, details and documents before being cleared to work.':'')+'</div>'+
    '<h3>Welcome email – exactly what will be sent</h3>'+emailHtml(m)+
    (sent?'<div class="alert ok small" id="apsentnote">✓ Welcome email sent to '+esc(u.email)+' at '+esc(fmtStamp(sent))+(live()?'':' – TEST: placed in "Outbox (test)", not really sent')+'.</div>':
      '<div class="alert warn small" id="apnotsent">'+(live()&&!welcomeOn()?'Nothing has been emailed yet. Use <b>Copy login details</b> to share the username and temporary password.':('Nothing has been sent yet. The email goes out only when you click <b>Send welcome email</b>.'+(live()?'':' (TEST: it goes to "Outbox (test)" – never really sent.)')))+'</div>')+
    (live()&&!welcomeOn()?'<div class="alert warn small" id="apemailsetup">Email sending is being set up — use Copy login details</div>':'')+
    '<div class="row ap-actions">'+(live()&&!welcomeOn()?'':('<button type="button" data-act="apsend" data-id="'+u.id+'"'+(sent?' disabled':'')+'>'+(sent?'Sent ✓':'Send welcome email')+'</button>'))+'<button type="button" class="sec" data-act="apcopy" data-id="'+u.id+'">Copy login details</button><button type="button" class="sec" data-act="apdone" data-id="'+u.id+'">Done</button></div>'+
    '<div class="small muted ap-foot">The temporary password is shown only on this screen (kept in memory for '+TEMP_MIN+' minutes, never saved). If it gets lost, use "Send login details again" on the person – it makes a new one.</div></div>');}
ACT.apsend=function(el){var u=user(el.dataset.id),t=u&&tempGet(u.id);if(!u)return;if(!t){toast('The temporary password is no longer in memory. Use "Send login details again" on the person.');return;}
  if(t.sentAt){toast('Already sent.');return;}if(!u.email||!validEmail(u.email)){toast('This person has no valid email. Use "Copy login details" instead.');return;}
  var m=welcomeEmail(u,t.pw);el.disabled=true;
  var done=function(){t.sentAt=new Date().toISOString();u.welcomeSentAt=t.sentAt;
    if(!live())audit('Welcome email sent',u.name,'to '+u.email+' · username '+u.username+' + temporary password + sign-in link'+(live()?'':' · TEST outbox – not really sent')+' · sent by '+ME.name+' (password not logged)');save();toast(live()?'Welcome email sent.':'Welcome email placed in the test outbox (not really sent).');showResult(u);};
  if(live()){if(!welcomeOn()||typeof window.REG_SEND_WELCOME!=='function'){el.disabled=false;toast('Email sending is being set up — use Copy login details');return;}
    Promise.resolve(window.REG_SEND_WELCOME(u.id,t.pw)).then(function(r){if(r&&r.error){el.disabled=false;toast(r.error);return;}done();},function(e){el.disabled=false;toast(String(e&&e.message||e));});return;}
  (DB.apOutbox=DB.apOutbox||[]).unshift({id:uid('mail'),userId:u.id,from:m.from,to:m.to,toName:m.toName,subject:m.subject,body:mask(m.body,t.pw),at:new Date().toISOString(),by:ME.name,test:true});
  if(DB.apOutbox.length>200)DB.apOutbox.length=200;done();};
ACT.apcopy=function(el){var u=user(el.dataset.id),t=u&&tempGet(u.id);if(!t){toast('The temporary password is no longer in memory. Use "Send login details again" on the person.');return;}
  var txt=loginText(u,t.pw),ok=function(){el.textContent='Copied ✓';el.dataset.done='1';audit('Login details copied',u.name,'by '+ME.name+' (not emailed; password not logged)');save();},
    fb=function(){var a=document.createElement('textarea');a.value=txt;a.setAttribute('readonly','');a.style.position='fixed';a.style.opacity='0';document.body.appendChild(a);a.select();var r=false;try{r=document.execCommand('copy');}catch(e){}a.remove();if(r)ok();else toast('Could not copy – select the details in the email preview instead.');};
  try{if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(txt).then(ok,fb);else fb();}catch(e){fb();}};
ACT.apdone=function(el){closeModal();if(location.hash==='#/addperson')render();};

/* ---------- create ---------- */
function apSubs(){return users('sub').filter(function(s){return s.active!==false&&s.accountApproved!==false;});}
function apClients(){return typeof clAll==='function'?clAll().filter(function(f){return f.accountApproved!==false&&f.active!==false;}):[];}
function apSites(){return (DB.sites||[]).filter(function(s){return s.firmId&&s.code!=='TEST-PRACTICE'&&s.active!==false;}).map(function(s){return s.code;}).sort();}
function dupPhone(ph){var d=digits10(ph);if(!d)return [];return DB.users.filter(function(u){return [u.phone,u.company&&u.company.phone,u.profile&&u.profile.phone].some(function(x){return digits10(x)===d;});});}
function dupName(nm){nm=normName(nm);return DB.users.filter(function(u){return normName(u.name)===nm;});}
function subCode(name){var code=String(name).replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3)||'SUB';while(users('sub').some(function(s){return s.code===code;}))code=code.slice(0,2)+String.fromCharCode(65+rnd(26));return code;}
FORMS.addperson=function(f,d){if(!ME||ME.type!=='admin'){toast('Not allowed.');return;}
  var role=d.role,first=String(d.first||'').trim(),last=String(d.last||'').trim(),email=String(d.email||'').trim().toLowerCase(),name=(first+' '+last).trim(),un=normName(d.username);
  PAGE_STATE.apDraft=d;var stop=function(m){PAGE_STATE.apErr=m;render();toast(m);};
  if(!AP_ROLE_LABEL[role])return stop('Pick a role.');
  if(role==='admin'&&!isOwner()){audit('Blocked: add office staff',name,'Only the Owner can add office staff · tried by '+ME.name);save();return stop('Only the Owner can add office staff.');}
  if(!first||!last)return stop('Enter the first and last name.');
  if(!email)return stop('Enter an email – the welcome email with the login details goes there.');
  if(!validEmail(email))return stop('That email does not look right.');
  var p=usernameProblem(un);if(p)return stop(p);
  var e1=DB.users.filter(function(u){return normName(u.email)===email||normName(u.username)===email;})[0];
  if(e1)return stop('This email already belongs to '+e1.name+' ('+TYPES[e1.type]+'). Open that person in People instead of adding a new account.');
  if(usernameTaken(un))return stop('That username is already used. Click "New suggestion" or type another.');
  var sub=null,client=null;
  if(role==='worker'||role==='crewlead'){sub=user(d.subId);if(!sub||sub.type!=='sub')return stop('Pick the subcontractor (employer).');}
  if(role==='sub'&&!String(d.company||'').trim())return stop('Enter the subcontractor company\'s legal name.');
  if(role==='firm'){if(typeof clLink!=='function')return stop('Farm / client logins need the Clients & logins screen.');client=user(d.clientId);if(!client||(typeof clIsClient==='function'&&!clIsClient(client)))return stop('Pick the client this login belongs to.');}
  var site=(d.site&&apSites().indexOf(d.site)>=0)?d.site:'';
  /* duplicates: the email must be new; a phone may already be on another account (016c) and a name may repeat – ask once */
  var dp=dupPhone(d.phone),dn=dupName(role==='sub'?d.company:name);
  if((dp.length||dn.length)&&!d.dupOk){PAGE_STATE.apWarn={phone:dp.map(function(u){return u.name;}),name:dn.map(function(u){return u.name+' ('+TYPES[u.type]+')';})};PAGE_STATE.apErr='';render();toast('Please check the note above the button, then click Create account again.');return;}
  if(live()){if(typeof window.REG_OFFICE_ADD_PERSON!=='function')return stop('Adding people is not switched on for the live site yet (needs migration 016j and the email set-up).');
    /* live: the server makes the account, the temporary password (same generator as Reset password) and the audit row */
    var btn=document.getElementById('apcreate');if(btn)btn.disabled=true;
    Promise.resolve(window.REG_OFFICE_ADD_PERSON({role:role,first:first,last:last,name:role==='sub'?String(d.company).trim():name,email:email,phone:String(d.phone||'').trim(),username:un,subId:sub?sub.id:'',company:String(d.company||'').trim(),clientId:client?client.id:'',loginRole:d.loginRole||'',site:site,officeRole:d.officeRole||'',dupPhone:dp.map(function(x){return x.name;})}))
      .then(function(r){if(!r||r.error||!r.id||!r.tempPassword){if(btn)btn.disabled=false;stop((r&&r.error)||'Could not create the account.');return;}
        var lu=user(r.id);if(!lu){toast('Account created – please reload the page.');return;}
        TEMP[lu.id]={pw:r.tempPassword,at:Date.now(),fresh:true};PAGE_STATE.apDraft=null;PAGE_STATE.apWarn=null;PAGE_STATE.apSuggest=genUsername();render();showResult(lu);},
        function(e){if(btn)btn.disabled=false;stop(String(e&&e.message||e));});
    return;}
  var now=new Date().toISOString(),pw=tempPw(),type={employee:'employee',worker:'worker',crewlead:'worker',sub:'sub',firm:'firm',admin:'admin'}[role];
  var u={id:uid('u'),type:type,name:role==='sub'?String(d.company).trim():name,username:un,email:email,phone:String(d.phone||'').trim(),passHash:hashPw(pw),mustChangePw:true,
    active:true,suspended:false,createdAt:now,lastLogin:null,profile:{},roles:[],orientations:[],accountApproved:true,approved:false,
    addedByOffice:{by:ME.name,byId:ME.id,at:now,role:role,first:first,last:last}};
  if(site)u.homeSite=site;
  if(type==='employee')u.profile={firstName:first,lastName:last,provEmp:'PE',payFreq:'Bi-weekly',vacPct:4};
  if(type==='worker'){u.subId=sub.id;u.approved=true;u.confirmedBySub=false;u.profile={lang:''};if(role==='crewlead')u.crewLead=true;}
  if(type==='sub'){u.code=subCode(u.name);u.company={legalName:u.name,email:email,phone:u.phone,mainContact:{name:name,role:'Main contact',email:email,phone:u.phone},emergency:{},periodStart:today()};}
  if(type==='firm')u.firm={contact:name,clientType:''};
  if(type==='admin'){u.approved=true;u.officeRole=d.officeRole==='payroll'?'payroll':'staff';}
  DB.users.push(u);
  if(type==='firm'){var err=clLink(u,client,{role:d.loginRole});if(err){DB.users=DB.users.filter(function(x){return x!==u;});return stop(err);}}
  var extra=[];if(sub)extra.push('employer '+(sub.company&&sub.company.legalName||sub.name));if(client)extra.push('client '+((client.firm&&client.firm.clientCode)||client.name)+' as '+(u.loginRole||'Manager'));if(site)extra.push('usual site '+site);if(type==='admin')extra.push('office role '+OFFICE_ROLES[u.officeRole]);
  if(dp.length)extra.push('phone also on: '+dp.map(function(x){return x.name;}).join(', ')+' (allowed – contact only)');
  audit('Office added person',u.name,AP_ROLE_LABEL[role]+' · username '+un+' · email '+email+(u.phone?' · phone given':'')+(extra.length?' · '+extra.join(' · '):'')+' · account approved by the office · must choose a new password at first sign-in · added by '+ME.name);
  if(sub)notify(sub.id,'The UnScramble office added '+name+' as '+(role==='crewlead'?'a crew lead':'a worker')+' under your company. Please confirm them in your Workers page.');
  save();TEMP[u.id]={pw:pw,at:Date.now(),fresh:true};PAGE_STATE.apDraft=null;PAGE_STATE.apWarn=null;PAGE_STATE.apErr='';PAGE_STATE.apSuggest=genUsername();PAGE_STATE.apLast=u.id;
  render();showResult(u);};
/* new login details later (e.g. the first ones were lost): same rules as the office reset */
ACT.apresend=function(el){var u=user(el.dataset.id);if(!u)return;if(u.id===ME.id){toast('Use "Change my password" on your Profile for your own account.');return;}
  if(u.type==='admin'&&!isOwner()){toast('Only the owner can reset an office account.');return;}
  if(!u.email){toast('This account has no email. Use "Reset password" instead.');return;}
  modal('<div class="pwreset addperson-resend"><h2>Send new login details to '+esc(u.name)+'?</h2><p>The app makes a <b>new</b> temporary password (the old one stops working right away) and shows you the welcome email again before anything is sent.</p><div class="row ap-actions"><button type="button" data-act="apresendyes" data-id="'+u.id+'">Yes, make new login details</button><button type="button" class="sec" data-act="person" data-id="'+u.id+'">Cancel</button></div></div>');};
ACT.apresendyes=function(el){var u=user(el.dataset.id);if(!u||u.id===ME.id||(u.type==='admin'&&!isOwner()))return;
  if(live()){if(typeof window.REG_NEW_TEMP_PASSWORD!=='function'){toast('Use "Reset password" on the live site for now.');return;}el.disabled=true;
    Promise.resolve(window.REG_NEW_TEMP_PASSWORD(u.id)).then(function(r){if(!r||r.error||!r.tempPassword){el.disabled=false;toast((r&&r.error)||'Could not make new login details.');return;}
      audit('Office made new login details',u.name,'New temporary password made by the server and shown once to '+ME.name+' (never stored in the log).');save();TEMP[u.id]={pw:r.tempPassword,at:Date.now(),fresh:false};showResult(u);},function(e){el.disabled=false;toast(String(e&&e.message||e));});return;}
  var pw=tempPw();u.passHash=hashPw(pw);u.mustChangePw=true;u.failed=0;u.lockedUntil=0;
  audit('Office made new login details',u.name,'New temporary password made by the app and shown once to '+ME.name+' (never stored in the log). Must choose a new password at next sign-in.');
  save();TEMP[u.id]={pw:pw,at:Date.now(),fresh:false};showResult(u);};

/* ---------- office page ---------- */
function apForm(){var err=PAGE_STATE.apErr||'';PAGE_STATE.apErr='';var d=PAGE_STATE.apDraft||{},w=PAGE_STATE.apWarn,role=d.role||'employee',owner=isOwner(),sugg=d.username||PAGE_STATE.apSuggest||(PAGE_STATE.apSuggest=genUsername());
  var roleOpts=AP_ROLES.map(function(r){var dis=r[0]==='admin'&&!owner,dis2=r[0]==='firm'&&typeof clLink!=='function';return '<option value="'+r[0]+'"'+(r[0]===role?' selected':'')+(dis||dis2?' disabled':'')+'>'+esc(r[1])+'</option>';}).join('');
  var subs=apSubs().map(function(s){return [s.id,(s.company&&s.company.legalName)||s.name];}),sites=apSites();
  var clientOpts=typeof clPickerOpts==='function'?clPickerOpts(d.clientId||''):'';
  var warn='';if(w&&(w.phone.length||w.name.length))warn='<div class="alert warn small" id="apdupwarn">'+(w.phone.length?'<div><b>This phone number is already on another account:</b> '+esc(w.phone.join(', '))+'. That is allowed (for example someone who already has a Shift Tracker login) – it is kept as contact information only and is never used to sign in to the new account.</div>':'')+(w.name.length?'<div><b>Someone with this name already exists:</b> '+esc(w.name.join(', '))+'. Make sure this is a different person.</div>':'')+chk('dupOk','I checked – create the account anyway',false,{req:true})+'</div>';
  return '<div class="card ap-card" id="addpersoncard"><form data-form="addperson" id="addpersonform" autocomplete="off">'+
    '<div class="grid2">'+inp('first','First name',d.first||'',{req:true,extra:' maxlength="40"'})+inp('last','Last name',d.last||'',{req:true,extra:' maxlength="40"'})+'</div>'+
    '<div><label class="req" for="aprole">Role</label><select name="role" id="aprole" required>'+roleOpts+'</select>'+(owner?'':'<div class="hint">Only the Owner can add office staff.</div>')+'</div>'+
    '<div class="grid2">'+inp('email','Email (the welcome email goes here)',d.email||'',{type:'email',req:true,extra:' maxlength="120" autocomplete="off"'})+inp('phone','Phone (optional)',d.phone||'',{type:'tel',extra:' maxlength="20"',hint:'Contact only – never needed to sign in.'})+'</div>'+
    '<div class="ap-uname"><label class="req" for="apusername">Username (made by the app – you can change it)</label><div class="row ap-unrow"><input type="text" name="username" id="apusername" value="'+esc(sugg)+'" required maxlength="30" autocapitalize="off" spellcheck="false"><button type="button" class="small sec" data-act="apnewname">New suggestion</button></div><div class="hint">Random but easy to read. The person can change it later; a farm can change it for its own logins.</div></div>'+
    '<div data-for="worker crewlead">'+sel('subId','Employer (subcontractor)',subs,d.subId||'',{req:true,blank:true})+'</div>'+
    '<div data-for="sub">'+inp('company','Subcontractor company – legal name',d.company||'',{req:true,extra:' maxlength="100"',hint:'Creates a new subcontractor account with this person as the main contact. The company still accepts the agreement and uploads its documents.'})+'</div>'+
    '<div data-for="firm"><div><label class="req" for="apclient">Client this login belongs to</label><select name="clientId" id="apclient" required><option value="">– choose –</option>'+clientOpts+'</select><div class="hint">Client code · site codes · name (names are shown to the office only).</div></div>'+(typeof CL_ROLES!=='undefined'?sel('loginRole','This login is the client\'s…',CL_ROLES.map(function(r){return [r,r];}),d.loginRole||'Manager'):'')+'</div>'+
    '<div data-for="employee worker crewlead">'+sel('site','Usual site (optional – site code)',sites.map(function(s){return [s,s];}),d.site||'',{blank:true})+'</div>'+
    (owner?'<div data-for="admin">'+sel('officeRole','Office role',[['staff','Office staff (cannot see full SIN / bank)'],['payroll','Payroll administrator']],d.officeRole||'staff')+'</div>':'')+
    warn+(err?'<div class="alert bad small" id="aperr">'+esc(err)+'</div>':'')+
    '<div class="small muted ap-note">The account is approved by the office right away. The app makes a temporary password; you see the exact welcome email before anything is sent.</div>'+
    '<div class="row ap-actions"><button type="submit" id="apcreate">Create account</button>'+(PAGE_STATE.apDraft?'<button type="button" class="sec" data-act="apclear">Clear form</button>':'')+'</div></form></div>';}
function outboxCard(){var l=DB.apOutbox||[];
  return '<div class="card" id="apoutbox"><h2 style="margin-top:0">Outbox (test)</h2><div class="small muted ap-outnote">TEST VERSION: welcome emails are <b>not really sent</b> – they are listed here. The temporary password is hidden here; the real email contains it.</div>'+
  (l.length?'<div class="tw"><table class="aptable"><tr><th>When</th><th>To</th><th>Subject</th><th>Sent by</th><th></th></tr>'+l.slice(0,50).map(function(m){return '<tr data-mail="'+esc(m.to)+'"><td class="small">'+esc(fmtStamp(m.at))+'</td><td>'+esc(m.toName)+'<div class="small muted">'+esc(m.to)+'</div></td><td class="small">'+esc(m.subject)+'</td><td class="small">'+esc(m.by)+'</td><td><button class="small sec" data-act="apview" data-id="'+esc(m.id)+'">View</button></td></tr>';}).join('')+'</table></div>':'<p class="muted small" id="apoutboxempty">No emails yet.</p>')+'</div>';}
function addedCard(){var l=DB.users.filter(function(u){return u.addedByOffice;}).sort(function(a,b){return a.addedByOffice.at<b.addedByOffice.at?1:-1;}).slice(0,30);if(!l.length)return '';
  return '<div class="card" id="apadded"><h2 style="margin-top:0">Added by the office</h2><div class="tw"><table class="aptable"><tr><th>Person</th><th>Username</th><th>Welcome email</th><th>First sign-in</th><th></th></tr>'+l.map(function(u){var a=u.addedByOffice;
    return '<tr data-user="'+esc(u.username||u.id)+'"><td><b>'+esc(u.name)+'</b><div class="small muted">'+esc(AP_ROLE_LABEL[a.role]||TYPES[u.type])+' · '+esc(fmtStamp(a.at))+'</div></td><td><code>'+esc(u.username||'')+'</code></td><td class="small">'+(u.welcomeSentAt?'<span class="pill s-ok">Sent '+esc(fmtStamp(u.welcomeSentAt))+'</span>':'<span class="pill s-mut">Not sent</span>')+'</td><td class="small">'+(u.mustChangePw?(u.lastLogin?'<span class="pill s-warn">Signed in – new password not set</span>':'<span class="pill s-pend">Not yet</span>'):'<span class="pill s-ok">Done – own password set</span>')+'</td><td><button class="small sec" data-act="person" data-id="'+u.id+'">Open</button></td></tr>';}).join('')+'</table></div></div>';}
VIEWS['admin:addperson']=function(){
  return '<h1>Add person</h1><p class="small muted ap-intro">Add a worker, crew lead, subcontractor contact, farm/client login'+(isOwner()?' or office staff member':'')+' yourself. The app makes the username and a temporary password; the person must choose their own password at first sign-in.</p>'+
    (live()&&typeof window.REG_OFFICE_ADD_PERSON!=='function'?'<div class="alert warn" id="aplivenote">Adding people is not switched on for the live site yet (needs migration 016j and the email set-up).</div>':'')+
    apForm()+addedCard()+(live()?'':outboxCard());};
ACT.apnewname=function(){var i=document.getElementById('apusername');PAGE_STATE.apSuggest=genUsername();if(PAGE_STATE.apDraft)PAGE_STATE.apDraft.username='';if(i){i.value=PAGE_STATE.apSuggest;i.focus();}};
ACT.apclear=function(){PAGE_STATE.apDraft=null;PAGE_STATE.apWarn=null;PAGE_STATE.apErr='';PAGE_STATE.apSuggest=genUsername();render();};
ACT.apview=function(el){var m=(DB.apOutbox||[]).filter(function(x){return x.id===el.dataset.id;})[0];if(!m)return;
  modal('<div class="addperson-result"><h2>Welcome email (test outbox)</h2><div class="small muted">Sent '+esc(fmtStamp(m.at))+' by '+esc(m.by)+'. TEST: not really sent. The password is hidden here.</div>'+emailHtml(m,'apviewmail')+'<div class="row ap-actions"><button type="button" class="sec" data-act="closeModal">Close</button></div></div>');};
/* show / hide the role-specific fields (hidden fields are disabled so they are not checked or sent) */
function apToggle(root){var f=(root||document).querySelector?((root||document).querySelector('#addpersonform')):null;if(!f)return;var r=f.role.value;
  [].forEach.call(f.querySelectorAll('[data-for]'),function(s){var on=s.dataset.for.split(' ').indexOf(r)>=0;s.hidden=!on;[].forEach.call(s.querySelectorAll('input,select,textarea'),function(i){i.disabled=!on;});});}
document.addEventListener('change',function(e){if(e.target&&e.target.id==='aprole'){apToggle(document);var d=PAGE_STATE.apDraft;if(d)d.role=e.target.value;}});
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{apToggle(root);}catch(e){}};})();

/* menu + People page button */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/people')return i+1;return NAV.admin.length;})(),0,['#/addperson','Add person']);
if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){var i=g[1].indexOf('#/people');if(i>=0&&g[1].indexOf('#/addperson')<0)g[1].splice(i+1,0,'#/addperson');});
(function(){var ov=VIEWS['admin:people'];VIEWS['admin:people']=function(){var x=ov();return x.replace('<h1>People</h1>','<div class="row ap-peoplehead"><h1>People</h1><a class="btn" href="#/addperson" id="apaddbtn">+ Add person</a></div>');};})();

/* person panel (office): username + who added them + new login details */
(function(){var op=showPerson;showPerson=function(id){var r=op.apply(this,arguments);try{var u=user(id),m=document.querySelector('#modal .modal');if(!u||!m||!ME||ME.type!=='admin')return r;
  var a=u.addedByOffice,canEdit=u.type!=='admin'||isOwner()||u.id===ME.id;
  var h='<div class="ap-panel" id="apperson"><h3>Username</h3>'+(a?'<div class="small">Added by the office ('+esc(a.by)+', '+esc(fmtStamp(a.at))+') · welcome email: '+(u.welcomeSentAt?'sent '+esc(fmtStamp(u.welcomeSentAt)):'not sent')+(u.homeSite?' · usual site '+esc(u.homeSite):'')+'</div>':'')+
    (canEdit&&!u.preloaded?'<form data-form="apuname" class="row ap-unrow"><input type="hidden" name="id" value="'+u.id+'"><input type="text" name="username" value="'+esc(u.username||'')+'" aria-label="Username" maxlength="30" autocapitalize="off" spellcheck="false" style="max-width:220px"><button class="small sec">Change username</button></form>':'<p class="small">'+esc(u.username||'(none)')+'</p>')+
    (a&&u.id!==ME.id&&u.email&&(u.type!=='admin'||isOwner())?'<button type="button" class="small sec" data-act="apresend" data-id="'+u.id+'">Send login details again</button>':'')+'</div>';
  m.insertAdjacentHTML('beforeend',h);}catch(e){}return r;};})();
FORMS.apuname=function(f,d){var t=user(d.id);if(!t)return;if(t.type==='admin'&&!isOwner()&&t.id!==ME.id){toast('Only the Owner can change an office account\'s username.');return;}
  if(liveUsername(t,d.username,'office',function(){showPerson(t.id);}))return;
  var e=changeUsername(t,d.username,'office');if(e){toast(e);return;}toast('Username changed to '+t.username+'.');showPerson(t.id);};

/* ---------- Profile: the person changes their own username; a farm changes the usernames of its own logins ---------- */
(function(){var ov=VIEWS.profile;VIEWS.profile=function(){var x=ov();var L=loginRec(ME);
  x=x.replace(/(<input type="text" name="username" value="[^"]*")/,'$1 readonly aria-describedby="unamehint"').replace(/(name="username"[^>]*>)/,'$1<div class="hint" id="unamehint">Change it under "My username" below.</div>');
  var card='<div class="card" id="myusername"><h3 style="margin-top:0">My username</h3><div class="small ap-mine">'+(L.username?'Your username is <code id="myuname">'+esc(L.username)+'</code>. ':'You do not have a username yet. ')+'You can sign in with your username'+(L.email?' or your email':'')+'.</div>'+
    '<form data-form="myusername" class="row ap-unrow"><input type="text" name="username" value="" placeholder="New username" aria-label="New username" maxlength="30" autocapitalize="off" spellcheck="false" required style="max-width:240px"><button class="sec">Change username</button></form><div class="hint">3–30 characters: letters, numbers, dot, dash or underscore. It must not be used by anyone else.</div></div>';
  if(ME.type==='firm')card+=farmLoginsCard();
  var at=x.indexOf('<div class="card"><h3 style="margin-top:0">Change password</h3>');return at>=0?x.slice(0,at)+card+x.slice(at):x+card;};})();
(function(){var of=FORMS.profile;FORMS.profile=function(f,d){d.username=loginRec(ME).username||'';return of(f,d);};})();   /* usernames change only through the checked form below */
FORMS.myusername=function(f,d){var L=loginRec(ME);if(!L)return;
  if(liveUsername(L,d.username,'own',function(){render();}))return;
  var e=changeUsername(L,d.username,'own');if(e){toast(e);return;}toast('Username changed to '+L.username+'.');render();};
function farmPeople(){if(!ME||ME.type!=='firm')return [];var out=[],main=user(ME.id);if(main&&(typeof clOwnLogin==='function'?clOwnLogin(main):!!main.passHash))out.push(main);
  if(typeof clLoginsOf==='function')clLoginsOf(ME).forEach(function(u){if(u.active!==false)out.push(u);});return out;}
function farmLoginsCard(){var l=farmPeople(),me=loginRec(ME);if(!l.length)return '';
  return '<div class="card" id="farmlogins"><h3 style="margin-top:0">Logins for your farm account</h3><div class="small">Everyone who signs in for your farm/client account. You can change their usernames (each must be unique). They get a message; their password does not change.</div>'+
  l.map(function(u){return '<form data-form="farmuname" class="row ap-unrow farmlogin" data-login="'+esc(u.username||u.id)+'"><input type="hidden" name="id" value="'+u.id+'"><span class="fl-name"><b>'+esc(u.addedByOffice?(u.addedByOffice.first+' '+u.addedByOffice.last):(u.firm&&u.firm.contact)||u.name)+'</b>'+(u.id===me.id?' <span class="small muted">(you)</span>':'')+'<span class="small muted"> · '+esc(u.loginRole||(u.id===ME.id?'Main login':'login'))+'</span></span><input type="text" name="username" value="'+esc(u.username||'')+'" aria-label="Username" maxlength="30" autocapitalize="off" spellcheck="false" style="max-width:200px"><button class="small sec">Save username</button></form>';}).join('')+'</div>';}
FORMS.farmuname=function(f,d){if(!ME||ME.type!=='firm'){toast('Not allowed.');return;}var t=user(d.id),ok=farmPeople().some(function(u){return u===t;});
  if(!ok){toast('You can only change usernames of your own farm\'s logins.');audit('Blocked: farm username change',t?t.name:'?','not a login of Client '+((ME.firm&&ME.firm.clientCode)||ME.name));save();return;}
  var me=loginRec(ME),how=t.id===me.id?'own':'farm';
  if(liveUsername(t,d.username,how,function(){render();}))return;
  var e=changeUsername(t,d.username,how);if(e){toast(e);return;}toast('Username saved: '+t.username+'.');render();};

ADMIN_ONLY_ACT.push('apsend','apcopy','apnewname','apclear','apview','apresend','apresendyes','apdone');
ADMIN_ONLY_FORM.push('addperson','apuname');
if(typeof ROLE_ONLY==='object')ROLE_ONLY.farmuname=['firm'];
(function(){var ol=load;load=function(){ol();if(DB)DB.apOutbox=DB.apOutbox||[];};})();
})();
