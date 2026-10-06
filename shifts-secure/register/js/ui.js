/* UI framework, sign-in/sign-up, terms, profile, shared pieces. */
'use strict';
var VIEWS={},ACT={},FORMS={},NAV={},PAGE_STATE={};
function fd(form){var o={},f=new FormData(form);f.forEach(function(v,k){if(k.slice(-2)==='[]'){k=k.slice(0,-2);(o[k]=o[k]||[]).push(v);}else if(!(v instanceof File))o[k]=typeof v==='string'?v.trim():v;});return o;}
function go(h){if(location.hash===h)render();else location.hash=h;}
function opt(list,sel){return list.map(function(x){var v=Array.isArray(x)?x[0]:x,l=Array.isArray(x)?x[1]:x;return '<option value="'+esc(v)+'"'+(String(sel)===String(v)?' selected':'')+'>'+esc(l)+'</option>';}).join('');}
function inp(name,label,val,o){o=o||{};return '<div><label class="'+(o.req?'req':'')+'">'+esc(label)+'</label><input type="'+(o.type||'text')+'" name="'+name+'" value="'+esc(val==null?'':val)+'"'+(o.req?' required':'')+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.dis?' disabled':'')+(o.extra||'')+'>'+(o.hint?'<div class="hint">'+o.hint+'</div>':'')+'</div>';}
function sel(name,label,list,val,o){o=o||{};return '<div><label class="'+(o.req?'req':'')+'">'+esc(label)+'</label><select name="'+name+'"'+(o.req?' required':'')+(o.dis?' disabled':'')+'>'+(o.blank?'<option value="">– choose –</option>':'')+opt(list,val)+'</select>'+(o.hint?'<div class="hint">'+o.hint+'</div>':'')+'</div>';}
function chk(name,label,on,o){o=o||{};return '<label class="inline"><input type="checkbox" name="'+name+'" value="'+(o.value||'1')+'"'+(on?' checked':'')+(o.req?' required':'')+'> <span>'+label+'</span></label>';}
function modal(html){closeModal();var d=document.createElement('div');d.className='modal-bg';d.id='modal';d.innerHTML='<div class="modal"><button class="x" data-act="closeModal" aria-label="Close">×</button>'+html+'</div>';document.body.appendChild(d);stackTables(d);afterRender(d);}
function stackTables(root){ /* label each cell with its column header so tables can stack as cards on phones */
  [].forEach.call((root||document).querySelectorAll('table:not(.no-stack):not(.stack)'),function(t){
    var rows=t.rows;if(!rows.length)return;var h=rows[0];if(!h.cells.length||[].some.call(h.cells,function(c){return c.tagName!=='TH';}))return;
    var labels=[].map.call(h.cells,function(c){return c.textContent.trim();});h.classList.add('hdr');
    for(var i=1;i<rows.length;i++){var col=0;[].forEach.call(rows[i].cells,function(c){c.setAttribute('data-label',c.colSpan>1?'':(labels[col]||''));col+=c.colSpan||1;});}
    t.classList.add('stack');});}
function closeModal(){var m=document.getElementById('modal');if(m)m.remove();}
ACT.closeModal=closeModal;
function testBadge(u){return u&&u.type==='tester'?' <span class="badge-test">TESTING FOR APP DEVELOPMENT</span>':'';}
function typePill(u){var c={admin:'s-pend',firm:'s-mut',sub:'s-ok',worker:'s-ok',employee:'s-ok',tester:'s-test'}[u.type];return '<span class="pill '+c+'">'+esc(TYPES[u.type])+'</span>';}
function findLogin(id){id=String(id||'').toLowerCase().trim();if(!id)return null;return DB.users.filter(function(u){return (u.username&&u.username.toLowerCase()===id)||(u.email&&u.email.toLowerCase()===id);})[0]||null;}
function loginTaken(username,email,exceptId){return DB.users.some(function(u){return u.id!==exceptId&&((username&&u.username&&u.username.toLowerCase()===username.toLowerCase())||(email&&u.email&&u.email.toLowerCase()===email.toLowerCase()));});}

/* ---------- File upload helper (stored as local browser data for the test) ---------- */
var MAX_FILE=1500000;
function readUpload(file,cb){
  if(!file||!file.size){cb(null);return;}
  var r=new FileReader();
  r.onload=function(){var data=r.result;
    if(/^image\/(png|jpe?g|webp)/.test(file.type)){var img=new Image();img.onload=function(){var sc=Math.min(1,1400/Math.max(img.width,img.height));var c=document.createElement('canvas');c.width=Math.round(img.width*sc);c.height=Math.round(img.height*sc);c.getContext('2d').drawImage(img,0,0,c.width,c.height);var out=c.toDataURL('image/jpeg',0.75);if(out.length>MAX_FILE*1.37){toast('That picture is too large for the test storage.');cb(null);return;}cb({name:file.name,type:'image/jpeg',data:out});};img.onerror=function(){cb({name:file.name,type:file.type,data:data});};img.src=data;}
    else{if(file.size>MAX_FILE){toast('File too large (max 1.5 MB). Try a smaller file or a photo.');cb(null);return;}cb({name:file.name,type:file.type||'application/octet-stream',data:data});}
  };r.readAsDataURL(file);
}
function dataToBlobUrl(d){var p=d.split(',');var mime=(p[0].match(/:(.*?);/)||[])[1]||'application/octet-stream';var b=atob(p[1]),a=new Uint8Array(b.length);for(var i=0;i<b.length;i++)a[i]=b.charCodeAt(i);return URL.createObjectURL(new Blob([a],{type:mime}));}
function downloadText(name,text,mime){var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type:mime||'text/plain'}));a.download=name;document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},100);}
function csvRow(a){return a.map(function(v){v=String(v==null?'':v);return /[",\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v;}).join(',');}
function showFile(name,type,data,label){
  var url=dataToBlobUrl(data);
  modal('<h2>'+esc(label||name)+'</h2>'+(/^image\//.test(type)?'<img src="'+url+'" style="max-width:100%;border:1px solid #ddd">':/pdf/.test(type)?'<iframe src="'+url+'" style="width:100%;height:65vh;border:1px solid #ddd"></iframe>':'<p>Preview not available for this file type.</p>')+'<p><a class="btn sec" href="'+url+'" download="'+esc(name)+'">Download '+esc(name)+'</a></p>');
}
ACT.viewdoc=function(el){var d=DB.docs.filter(function(x){return x.id===el.dataset.id;})[0];if(!d)return;var u=user(d.userId);
  if(!canSeeDoc(d)){toast('You do not have access to this document.');return;}
  audit('Viewed document',u?u.name:'',DOCS[d.kind].label);save();showFile(d.fileName,d.fileType,d.fileData,DOCS[d.kind].label+' – '+(u?u.name:''));};
function canSeeDoc(d){if(!ME)return false;if(ME.type==='admin'||d.userId===ME.id)return true;var u=user(d.userId);return ME.type==='sub'&&u&&u.subId===ME.id&&['eligibility','driver_licence','forklift'].indexOf(d.kind)>=0;}

/* ---------- Layout ---------- */
function layout(content){
  var u=ME,nav=u?(NAV[u.type]||[]):[],h=location.hash.split('?')[0]||'#/home';
  if(u){var gn=gateNav(u);if(gn)nav=gn;}
  var unread=u?DB.notes.filter(function(n){return (n.to===u.id||(u.type==='admin'&&n.to==='admin'))&&!n.read;}).length:0;
  return '<div class="testbar"><span>TEST VERSION – local only.</span> Fake data, stored only in this browser. Nothing is sent anywhere.'+(DB.settings.simDate?' &nbsp;<span>Simulated date: '+DB.settings.simDate+'</span>':'')+'</div>'+
  '<header class="top"><img src="assets/unscramble-logo.svg" alt="UnScramble"><div><div style="font-weight:700">Registration &amp; Compliance</div><div class="small" style="opacity:.8">Shift Tracker – test build</div></div>'+
  (u?'<div class="who">'+esc(u.name)+' · <b>'+esc(TYPES[u.type])+'</b>'+(u.type==='tester'?' <span class="badge-test">TEST</span>':'')+(u.type==='sub'?tempBadge(u):u.type==='worker'?tempBadge(subOf(u)):'')+' <button class="small sec" data-act="logout">Sign out</button></div>':'')+'</header>'+
  (u?'<nav class="tabs">'+nav.map(function(n){var c=n[0]==='#/alerts'&&unread?'<span class="cnt">'+unread+'</span>':'';return '<a href="'+n[0]+'" class="'+(h===n[0]?'on':'')+'">'+esc(n[1])+c+'</a>';}).join('')+'</nav>':'')+
  '<main id="main">'+content+'</main><footer>UnScramble – The HR Company Inc. · TEST VERSION, local only · Not connected to the live Shift Tracker</footer>'+
  (u&&u.type==='tester'?'<button class="fb-btn" data-act="feedback">★ Send feedback</button>':'');
}
function render(){
  var app=document.getElementById('app');var h=(location.hash||'#/').split('?')[0];var html;
  try{
    if(!ME){var pub={'#/signup':VIEWS.signup,'#/forgot':VIEWS.forgot,'#/2fa':VIEWS.twofa};html=(pub[h]||(h.indexOf('#/signup/')===0?VIEWS.signupForm:VIEWS.login))(h);}
    else{
      if(processTemp())save();if(sweepBookings())save();
      h=gateRoute(h);
      var navOk=(NAV[ME.type]||[]).some(function(n){return n[0]===h;})||['#/terms','#/profile','#/alerts','#/pending','#/changepw'].indexOf(h)>=0||(['#/quiz','#/quizresult'].indexOf(h)>=0&&!!VIEWS[ME.type+':'+h.slice(2)]);if(!navOk)h='#/home';
      var v=VIEWS[ME.type+':'+h.slice(2)]||VIEWS[h.slice(2)]||VIEWS[ME.type+':home'];
      html=v(h);track('screen',h);save();
    }
  }catch(e){html='<div class="alert bad" id="screenerr"><b>Sorry – this screen could not open.</b> Please go back and try again. If it keeps happening, contact the office.</div>';try{console.warn('[screen error – friendly message shown]',e);}catch(x){}logError(e);}
  app.innerHTML=layout(html);stackTables(app);afterRender(app);window.scrollTo(0,0);
  var f=document.querySelector('[data-autofocus]');if(f)f.focus();
  if(PAGE_STATE.after){var a=PAGE_STATE.after;PAGE_STATE.after=null;a();}
}
function logError(e){try{if(DB&&ME){DB.events.push({u:ME.id,role:ME.type,test:ME.type==='tester',type:'error',screen:location.hash,msg:String(e&&e.message||e),at:new Date().toISOString(),d:today()});save();}}catch(x){}}
window.addEventListener('error',function(e){logError(e.error||e.message);});
document.addEventListener('click',function(e){var el=e.target.closest('[data-act]');if(!el)return;var f=ACT[el.dataset.act];if(f){e.preventDefault();if(!actionAllowed(el.dataset.act,'act')){denied(el.dataset.act);return;}f(el,e);}});
document.addEventListener('submit',function(e){var f=e.target;if(!f.dataset.form)return;e.preventDefault();var h=FORMS[f.dataset.form];if(!h)return;if(!actionAllowed(f.dataset.form,'form')){denied(f.dataset.form);return;}h(f,fd(f));});
document.addEventListener('input',function(e){var el=e.target;if(el.dataset.calc&&CALC[el.dataset.calc])CALC[el.dataset.calc](el);});
var CALC={};
window.addEventListener('hashchange',render);
ACT.logout=function(){audit('Signed out',ME.name);save();ME=null;sessionStorage.removeItem('us-test-me');go('#/');};
ACT.resetData=function(){if(!confirmBox('resetData','Reset ALL test data back to the sample data? Everything you entered will be removed from this browser.'))return;resetData();ME=null;toast('Test data reset.');go('#/');};
var CONFIRMED={};
function confirmBox(key,msg){ /* two-tap confirm without blocking dialogs */
  if(CONFIRMED[key]&&Date.now()-CONFIRMED[key]<6000){CONFIRMED[key]=0;return true;}CONFIRMED[key]=Date.now();toast(msg+' Tap again to confirm.');return false;}

/* ---------- Sign in ---------- */
VIEWS.login=function(){
  var tl=[['office','UnScramble office / admin'],['subco','Subcontractor (all valid)'],['subco2','Subcontractor (pending, insurance expired)'],['worker1','Subcontractor worker (valid, driver)'],['worker2','Subcontractor worker (permit expiring)'],['worker3','Subcontractor worker (new – items still to finish)'],['worker4','Subcontractor worker (employer papers not finished)'],['crewleadA','Crew lead (clocks the crew in and out)'],['employee1','Employee (fully set up)'],['employee2','Employee (registration in progress)'],['employee3','Employee (ready for Wagepoint)'],['tester1','Testing for App Development'],['firmA','Client firm: Test Farm A'],['firmB','Client firm: Test Farm B'],['clientFarm','Client: Sample Orchard Farm']];
  return '<div class="login-wrap"><img class="logo-big" src="assets/unscramble-logo.svg" alt="UnScramble"><div class="card"><h1>Sign in</h1>'+
  '<form data-form="login">'+inp('login','Username, email or phone','',{req:true,extra:' data-autofocus autocomplete="username"'})+inp('password','Password','',{type:'password',req:true,extra:' autocomplete="current-password"'})+
  '<div class="row" style="margin-top:12px"><button type="submit">Sign in</button><a href="#/forgot" class="right small">Forgot password?</a></div></form>'+
  '<div style="margin-top:16px;border-top:1px solid #eee;padding-top:12px"><span class="muted small">New here?</span><br><a class="btn" href="#/signup" style="margin-top:6px">Create an account</a></div></div>'+
  '<div class="card hl"><h3 style="margin-top:0">Test logins (password for all: <code>test1234</code>)</h3><div class="tw"><table>'+tl.map(function(t){return '<tr><td><a href="#" data-act="quick" data-u="'+t[0]+'"><code>'+t[0]+'</code></a></td><td>'+esc(t[1])+'</td></tr>';}).join('')+'</table></div><p class="small muted">Tap a username to fill it in. You can also sign in with the email or phone number on an account.</p>'+
  '<button class="sec small" data-act="resetData">Reset test data</button></div></div>';
};
ACT.quick=function(el){var f=document.querySelector('[data-form=login]');f.login.value=el.dataset.u;f.password.value='test1234';};
FORMS.login=function(f,d){var u=findLogin(d.login);
  if(!u||u.passHash!==hashPw(d.password)){toast('Wrong username/email or password.');return;}
  if(!u.active){toast(u.type==='tester'?'This testing account has been switched off by the office.':'This account is switched off. Contact the office.');return;}
  ME=u;u.lastLogin=new Date().toISOString();sessionStorage.setItem('us-test-me',u.id);audit('Signed in',u.name);runAlerts();save();go(u.type==='admin'?'#/home':'#/home');};

/* ---------- Forgot password ---------- */
VIEWS.forgot=function(){var st=PAGE_STATE.reset;
  return '<div class="login-wrap"><div class="card"><h1>Reset password</h1>'+(st?'<div class="alert info">Test version: the reset email to <b>'+esc(st.email)+'</b> would contain this code: <b>'+st.code+'</b> (also shown in the office "Alerts" outbox).</div><form data-form="reset2">'+inp('code','Reset code','',{req:true})+inp('pw','New password','',{type:'password',req:true})+'<button>Set new password</button></form>':
  '<form data-form="reset1">'+inp('login','Username or email','',{req:true})+'<button>Send reset email</button></form><p class="small muted">If there is no email on your account, the office resets your password for you.</p>')+'<p><a href="#/">Back to sign in</a></p></div></div>';};
FORMS.reset1=function(f,d){var u=findLogin(d.login);if(!u){toast('No account found.');return;}
  if(!u.email){modal('<h2>No email on file</h2><p>This account has no email address, so the office needs to reset the password. Please contact the UnScramble office.</p>');return;}
  var code=String(Math.floor(100000+Math.random()*900000));PAGE_STATE.reset={uid:u.id,code:code,email:u.email};notify(u.id,'Password reset code: '+code+' (simulated email)');audit('Password reset requested',u.name);save();render();};
FORMS.reset2=function(f,d){var st=PAGE_STATE.reset;if(!st||d.code!==st.code){toast('Code does not match.');return;}if(d.pw.length<6){toast('Password must be at least 6 characters.');return;}var u=user(st.uid);u.passHash=hashPw(d.pw);audit('Password reset by email',u.name);PAGE_STATE.reset=null;save();toast('Password changed. Please sign in.');go('#/');};

/* ---------- Sign up ---------- */
VIEWS.signup=function(){
  return '<div class="login-wrap"><div class="card"><h1>Create an account</h1><p>Which describes you?</p>'+
  '<a class="choice" href="#/signup/sub"><b>Subcontractor</b><br><span class="small">A labour business that employs its own workers.</span></a>'+
  '<a class="choice" href="#/signup/worker"><b>Subcontractor worker</b><br><span class="small">You work for one of our subcontractors.</span></a>'+
  '<a class="choice" href="#/signup/employee"><b>Employee of UnScramble</b><br><span class="small">UnScramble employs and pays you directly.</span></a>'+
  '<a class="choice" href="#/signup/tester" style="border-color:var(--g)"><b>Testing for App Development</b> <span class="badge-test">TEST</span><br><span class="small">Try the app and give feedback. No documents needed. Testing is never paid work.</span></a>'+
  '<p class="small muted">Phone number is optional for every account type.</p><p><a href="#/">Back to sign in</a></p></div></div>';
};
VIEWS.signupForm=function(h){var t=h.split('/')[2];if(!TYPES[t]||t==='admin'||t==='firm')return VIEWS.signup();
  var subs=users('sub').filter(function(s){return s.active;}).map(function(s){return [s.id,s.company.legalName||s.name];});
  var x='<div class="login-wrap"><div class="card"><h1>Sign up: '+esc(t==='worker'?'Farm worker':TYPES[t])+'</h1>'+(t==='tester'?'<div class="alert warn"><b>Testing for App Development.</b> You only need a name, a username or email, and a password. No documents. Everything you do is test activity and is <b>never paid</b>.</div>':'')+'<form data-form="signup"><input type="hidden" name="type" value="'+t+'">';
  x+=inp('name',t==='sub'?'Legal business name':(t==='tester'?'Your name':'Legal name (as on ID)'),'',{req:true});
  x+=inp('username','Username (a short name you will use to sign in)','',{req:false,hint:'Nobody else can have the same one.'+(t==='tester'||t==='worker'?' You need a username, an email or a phone number.':'')+' You can sign in with any of them.'});
  x+=inp('email',t==='sub'?'Business email':(t==='employee'?'Personal email':'Email'),'',{type:'email',req:t==='sub'||t==='employee',hint:t==='employee'?'Needed for Wagepoint (payroll portal).':t==='sub'?'Needed for invoices and alerts.':'Optional if you give a username or a phone number.'});
  x+=inp('phone','Phone (optional)','',{type:'tel',hint:'You can also sign in with this number.'});
  if(t==='worker')x+=sel('subId','Your employer (subcontractor)',subs,'',{req:true,blank:true});
  x+=inp('pw','Password','',{type:'password',req:true,hint:'At least 10 characters, not a common word or pattern (like test1234 or a farm word with a year), and not your name or username.'})+inp('pw2','Repeat password','',{type:'password',req:true});
  if(t==='tester'){x+='<h3>Terms</h3><div class="terms-text">'+esc(DB.settings.terms.app_testing.text)+'</div><div class="small muted">Version '+esc(DB.settings.terms.app_testing.version)+'</div>'+chk('acceptTerms','<b>I accept the App Terms of Use and Testing Terms</b> (testing is for feedback only, is not work and is never paid).',false,{req:true});}
  x+='<fieldset><legend>Optional</legend>'+chk('consent',esc(CONSENT_TEXT),false)+'<div class="hint">Optional. Saying no never blocks anything.</div></fieldset>';
  x+='<button type="submit">Create account</button> <a href="#/signup" class="btn sec">Back</a></form></div></div>';return x;};
FORMS.signup=function(f,d){
  if(!d.username&&!d.email&&!loginDigits(d.phone)){toast('Please add an email, a 10-digit phone number or a username – you will use it to sign in.');return;}
  if((d.type==='sub'||d.type==='employee')&&!d.email){toast('Please add your email – this account type needs one.');return;}
  if(d.pw.length<6){toast('That password is too short.');return;}if(d.pw!==d.pw2){toast('The two passwords are not the same. Please type them again.');return;}
  if(loginTaken(d.username,d.email)||(!d.username&&!d.email&&DB.users.some(function(x){var p=loginDigits(x.phone);return p&&p===loginDigits(d.phone);}))){toast('That login is already used. Try signing in, or use a different email, phone or username.');return;}
  if(d.type==='worker'&&!d.subId){toast('Please choose your employer (the crew company that hired you).');return;}
  var u={id:uid('u'),type:d.type,name:d.name,username:d.username,email:d.email,phone:d.phone,passHash:hashPw(d.pw),active:true,suspended:false,createdAt:new Date().toISOString(),lastLogin:new Date().toISOString(),profile:{},roles:[],orientations:[],approved:d.type==='tester'};
  if(d.type==='sub'){var code=d.name.replace(/[^A-Za-z]/g,'').toUpperCase().slice(0,3)||'SUB';while(users('sub').some(function(s){return s.code===code;}))code=code.slice(0,2)+String.fromCharCode(65+Math.floor(Math.random()*26));u.code=code;u.company={legalName:d.name,email:d.email,phone:d.phone,mainContact:{},emergency:{},periodStart:today()};}
  if(d.type==='worker'){u.subId=d.subId;u.profile.lang='';}
  if(d.type==='employee'){var nm=d.name.split(' ');u.profile={firstName:nm[0],lastName:nm.slice(1).join(' '),provEmp:'PE',payFreq:'Bi-weekly',vacPct:4};}
  DB.users.push(u);ME=u;sessionStorage.setItem('us-test-me',u.id);
  if(d.type==='tester'&&d.acceptTerms)recordAcceptance(u,'app_testing');
  recordConsent(u,!!d.consent);
  audit('Account created',u.name,TYPES[u.type]);track('signup','#/signup/'+d.type);
  notify('admin','New '+TYPES[u.type]+' sign-up: '+u.name+(u.subId?' (employer: '+employerName(u)+')':''));
  if(u.subId)notify(u.subId,'New worker registered under your company: '+u.name+'. Please confirm them in your Workers page.');
  save();toast('Account created ✓');go(missingTerms(u).length?'#/terms':'#/home');
};
function recordAcceptance(u,key){var t=DB.settings.terms[key];DB.acceptances.push({id:uid('a'),userId:u.id,userName:u.name,key:key,name:TERMS_DEF[key].name,version:t.version,at:new Date().toISOString(),tz:tz(),device:deviceInfo(),employerId:u.subId||null,employerName:key==='schedule_c'?employerName(u):''});audit('Accepted terms',u.name,TERMS_DEF[key].name+' v'+t.version);}
function recordConsent(u,choice){DB.consents.push({id:uid('c'),userId:u.id,choice:choice,version:DB.settings.consentVersion,at:new Date().toISOString(),tz:tz()});audit('Data-use consent '+(choice?'given':'declined/withdrawn'),u.name,'v'+DB.settings.consentVersion);}
function consentOf(u){var c=DB.consents.filter(function(x){return x.userId===u.id;});return c[c.length-1]||null;}
function termsText(key,u){var t=DB.settings.terms[key].text;return key==='schedule_c'?t.replace(/\{EMPLOYER\}\./g,'{EMPLOYER}\u0000').replace(/\{EMPLOYER\}/g,u?employerName(u):'your subcontractor').replace(/\.?\u0000/g,'.'):t;}

/* ---------- Terms page ---------- */
VIEWS.terms=function(){var u=ME,miss=missingTerms(u),x='<h1>Terms</h1>';
  if(miss.length)x+='<div class="alert warn">Please read and accept the current terms before you can use the app'+(u.type!=='tester'?' or see shifts':'')+'.</div>';
  miss.forEach(function(k){var t=DB.settings.terms[k];x+='<div class="card hl"><h2>'+esc(TERMS_DEF[k].name)+' <span class="small muted">v'+esc(t.version)+'</span></h2><div class="terms-text">'+esc(termsText(k,u))+'</div><form data-form="accept"><input type="hidden" name="key" value="'+k+'">'+chk('ok','I have read and I accept the '+esc(TERMS_DEF[k].name)+' (version '+esc(t.version)+').',false,{req:true})+'<button>Accept</button></form></div>';});
  var c=consentOf(u);
  if(u.type!=='firm'&&(!c||c.version!==DB.settings.consentVersion))x+='<div class="card"><h3 style="margin-top:0">Optional: data-use consent'+(c?' (wording updated – please choose again)':'')+'</h3><form data-form="consent">'+chk('consent',esc(CONSENT_TEXT),c&&c.choice)+'<div class="hint">Optional – it never blocks registration, shifts, pay or invoices.</div><button class="sec">Save my choice</button></form></div>';
  var mine=DB.acceptances.filter(function(a){return a.userId===u.id;});
  x+='<h2>Terms I have accepted (permanent history)</h2>'+(mine.length?'<div class="tw"><table><tr><th>Terms</th><th>Version</th><th>Accepted</th><th>Time zone</th><th>Device</th><th></th></tr>'+mine.map(function(a){return '<tr><td>'+esc(a.name)+(a.employerName?'<div class="small muted">Employer: '+esc(a.employerName)+'</div>':'')+'</td><td>'+esc(a.version)+'</td><td>'+fmtStamp(a.at)+'</td><td>'+esc(a.tz)+'</td><td class="small">'+esc(a.device)+'</td><td><button class="small sec" data-act="dlterms" data-id="'+a.id+'">View / download</button></td></tr>';}).join('')+'</table></div>':'<p class="muted">None yet.</p>');
  return x;};
FORMS.accept=function(f,d){recordAcceptance(ME,d.key);save();toast('Thank you – accepted.');go(missingTerms(ME).length?'#/terms':'#/home');};
FORMS.consent=function(f,d){recordConsent(ME,!!d.consent);save();toast('Choice saved.');render();};
ACT.dlterms=function(el){var a=DB.acceptances.filter(function(x){return x.id===el.dataset.id;})[0];var hist=(DB.settings.termsHistory||[]).filter(function(h){return h.key===a.key&&h.version===a.version;})[0];var cur=DB.settings.terms[a.key];var txt=hist?hist.text:(cur.version===a.version?cur.text:'(text of version '+a.version+')');if(a.key==='schedule_c')txt=txt.replace(/\{EMPLOYER\}/g,a.employerName||employerName(ME));
  var body=a.name+'\nVersion: '+a.version+'\nAccepted by: '+a.userName+'\nAccepted at: '+fmtStamp(a.at)+' ('+a.tz+')\nDevice: '+a.device+'\n\n'+txt;
  modal('<h2>'+esc(a.name)+' v'+esc(a.version)+'</h2><div class="terms-text">'+esc(body)+'</div><p><button data-act="dltxt">Download as a file</button></p>');PAGE_STATE.dl={name:'UnScramble-'+a.key+'-v'+a.version+'.txt',text:body};};
ACT.dltxt=function(){downloadText(PAGE_STATE.dl.name,PAGE_STATE.dl.text);};

/* ---------- Profile (all) ---------- */
VIEWS.profile=function(){var u=ME,c=consentOf(u);
  var x='<h1>My profile'+testBadge(u)+'</h1><div class="card"><form data-form="profile"><div class="grid2">'+inp('name','Name',u.name,{req:true,dis:u.type==='firm'})+inp('username','Username',u.username)+inp('email','Email',u.email,{type:'email',req:u.type==='employee'||u.type==='sub'})+inp('phone','Phone (optional)',u.phone,{type:'tel',hint:'Contact only. SMS reminders only if you add a phone.'})+'</div><button>Save</button></form></div>';
  x+='<div class="card"><h3 style="margin-top:0">Change password</h3><form data-form="pw"><div class="grid2">'+inp('old','Current password','',{type:'password',req:true})+inp('pw','New password','',{type:'password',req:true})+'</div><button class="sec">Change password</button></form></div>';
  if(u.type!=='firm'&&u.type!=='admin'){
    x+='<div class="card"><h3 style="margin-top:0">Data-use consent (optional)</h3><p class="small">'+esc(CONSENT_TEXT)+'</p><p>Your current choice: <b>'+(c&&c.choice?'Yes – I agree':'No')+'</b>'+(c?' <span class="small muted">('+fmtStamp(c.at)+', v'+esc(c.version)+')</span>':'')+'</p><form data-form="consent"><input type="hidden" name="'+(c&&c.choice?'x':'consent')+'" value="1"><button class="sec">'+(c&&c.choice?'Withdraw consent':'Give consent')+'</button></form><div class="hint">Withdrawal applies going forward. Full history is kept.</div></div>';
    x+='<div class="card"><h3 style="margin-top:0">Privacy request</h3><p class="small">You can ask to see or correct the information we hold about you (PIPEDA).</p><form data-form="privreq">'+sel('kind','Request type',[['access','See my information'],['correction','Correct my information']],'')+'<label>Details</label><textarea name="text"></textarea><button class="sec">Send request</button></form></div>';
  }
  if(u.type==='tester'){var pend=DB.convReq.some(function(r){return r.userId===u.id&&r.status==='Requested';});x+='<div class="card"><h3 style="margin-top:0">Will you do real paid work?</h3><p class="small">A testing account must be converted to a full Subcontractor or Employee account (and its documents completed) before any real paid work. Your login and details carry over.</p>'+(pend?'<p><span class="pill s-pend">Conversion requested – waiting for the office</span></p>':'<form data-form="convreq">'+sel('to','Convert to',[['employee','Employee of UnScramble'],['sub','Subcontractor']],'employee')+'<button class="sec">Ask the office to convert my account</button></form>')+'</div>';}
  if(u.convertedFrom)x+='<div class="alert info">This account was converted from a Testing for App Development account on '+esc(u.convertedAt)+'. Test records from before stay marked TEST and are never paid.</div>';
  return x;};
FORMS.profile=function(f,d){var u=ME;if(!d.username&&!d.email){toast('Please keep a username or an email – you need one to sign in.');return;}if((u.type==='employee'||u.type==='sub')&&!d.email){toast('Please keep your email – your account type needs one.');return;}if(loginTaken(d.username,d.email,u.id)){toast('That username or email is already taken. Please try another.');return;}
  if(u.type==='employee'&&u.wagepoint&&u.wagepoint.added&&d.name&&d.name!==u.name)flagWagepoint(u,'name');
  if(d.name)u.name=d.name;u.username=d.username;u.email=d.email;u.phone=d.phone;audit('Changed profile',u.name);save();toast('Saved ✓');render();};
FORMS.pw=function(f,d){if(ME.passHash!==hashPw(d.old)){toast('Your current password is not right. Please try again.');return;}if(d.pw.length<6){toast('That new password is too short.');return;}ME.passHash=hashPw(d.pw);audit('Changed password',ME.name);save();toast('Password changed.');render();};
FORMS.privreq=function(f,d){DB.privacyReq.unshift({id:uid('p'),userId:ME.id,name:ME.name,kind:d.kind,text:d.text,at:new Date().toISOString(),status:'Open'});notify('admin','Privacy request ('+d.kind+') from '+ME.name);save();toast('Request sent to the office.');render();};
FORMS.convreq=function(f,d){DB.convReq.unshift({id:uid('cr'),userId:ME.id,to:d.to,at:new Date().toISOString(),status:'Requested'});notify('admin','Tester '+ME.name+' asks to convert to a full '+TYPES[d.to]+' account.');save();toast('Request sent.');render();};
function flagWagepoint(u,what){u.wagepoint=u.wagepoint||{};if(!u.wagepoint.added)return;u.wagepoint.update=u.wagepoint.update||[];if(u.wagepoint.update.indexOf(what)<0)u.wagepoint.update.push(what);notify('admin','Update Wagepoint: '+u.name+' changed '+what+'.','wpu|'+u.id+'|'+what+'|'+Date.now());}

/* ---------- Alerts (my notifications) ---------- */
VIEWS.alerts=function(){var mine=DB.notes.filter(function(n){return n.to===ME.id;});mine.forEach(function(n){n.read=true;});save();
  return '<h1>My alerts</h1><p class="small muted">In the real app these go by email and push (and SMS only if you added a phone). In this test they are only shown here.</p>'+(mine.length?'<div class="tw"><table><tr><th>When</th><th>Message</th><th>Channel</th></tr>'+mine.map(function(n){return '<tr><td class="small">'+fmtStamp(n.at)+'</td><td>'+esc(n.text)+'</td><td class="small">'+esc(n.channel)+'</td></tr>';}).join('')+'</table></div>':'<p class="muted">No alerts right now.</p>');};

/* ---------- Feedback (testers) ---------- */
ACT.feedback=function(){modal('<h2>Send feedback</h2><div class="alert warn">Please do not include personal information (names, phone numbers, documents) in your comment or screenshot.</div><form data-form="feedback"><input type="hidden" name="screen" value="'+esc(location.hash||'#/home')+'"><label class="req">Rating</label><div class="row">'+[1,2,3,4,5].map(function(n){return '<label class="inline"><input type="radio" name="rating" value="'+n+'"'+(n===4?' checked':'')+' required> '+n+'★</label>';}).join(' ')+'</div><label class="req">Comment</label><textarea name="comment" required></textarea><label>Screenshot (optional)</label><input type="file" name="shot" accept="image/*"><div class="hint">Screen: '+esc(location.hash||'#/home')+'</div><p><button>Send feedback</button></p></form>');};
FORMS.feedback=function(f,d){readUpload(f.shot.files[0],function(file){DB.feedback.unshift({id:uid('f'),userId:ME.id,rating:+d.rating,comment:d.comment,screen:d.screen,screenshot:file,status:'New',at:new Date().toISOString()});track('feedback',d.screen);audit('Sent feedback',ME.name);save();closeModal();toast('Thank you for your feedback!');});};

/* ---------- Start ---------- */
function start(){load();var id=sessionStorage.getItem('us-test-me');ME=id?user(id):null;if(ME&&!ME.active)ME=null;if(ME)runAlerts();save();render();}
document.addEventListener('DOMContentLoaded',start);
