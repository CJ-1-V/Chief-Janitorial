/* v2-farminvite.js – "Send invite" for farms / clients (owner request Oct 22, 2026 12:19 PM ET).
   Office: Clients & logins → Send invite → text (Quo +1 902-200-4888, inbox PN5pixOySo) with email from admin@unscramble.ca as fallback.
   Status per invite: Sent → Opened → Registered (waiting approval) → Linked; Expired / Revoked / Failed; Resend (makes a new code,
   the old one is revoked – the app only keeps a fingerprint of each code).
   TEST COPY: nothing is sent. Every send is a dry run that lands in the "Test outbox" with the exact SMS / email text.
   LIVE: sends only through the server function reg-messages (one shared function for invites + reset codes) (Quo key + mail password stay on the server) and only when
   REG_STORE.inviteFn === true. Until that function is deployed, the live button falls back to the existing "Invite code". */
'use strict';
var FI_FROM_SMS='+1 902-200-4888', FI_FROM_EMAIL='admin@unscramble.ca', FI_DAYS=14;
function fiLive(){return !!window.REG_LIVE;}
function fiServerReady(){return !!(window.REG_LIVE&&window.REG_STORE&&window.REG_STORE.inviteFn===true);}
function fiE164(p){var d=digits(p);if(d.length===11&&d[0]==='1')d=d.slice(1);return d.length===10?'+1'+d:'';}
function fiMaskPhone(p){var e=fiE164(p);return e?'(•••) •••-'+e.slice(-4):'';}
function fiMaskEmail(e){e=String(e||'');var a=e.split('@');return a.length===2?a[0].slice(0,1)+'•••@'+a[1]:'';}
function fiEmailOk(e){return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e||'').trim());}
function fiFirst(n){return String(n||'').trim().split(/\s+/)[0]||'there';}
function fiNiceDate(d){try{return parseD(d).toLocaleDateString('en-CA',{month:'short',day:'numeric'});}catch(e){return d;}}
/* ---------- message text (shared with the server function – keep in sync with reg-messages/text.ts) ---------- */
function fiSmsText(o){return 'UnScramble: Hi '+fiFirst(o.name)+', set up your farm\'s UnScramble app account: '+o.url+' (code '+o.code+', expires '+fiNiceDate(o.expires)+'). Sent to you as our client contact. Reply STOP to opt out, HELP for help.';}
function fiEmail(o){var subj='You are invited to the UnScramble app';
  var text='Hello '+fiFirst(o.name)+',\n\nUnScramble invites you to set up your farm\'s client account in the UnScramble app. There you can book crews, approve time sheets and see your invoices.\n\n'+
    'Sign up here: '+o.url+'\nYour invite code: '+o.code+' (single use, expires '+fiNiceDate(o.expires)+')\n\n1. Open the link.\n2. Enter your farm name, your name, mobile phone and/or email, and a password.\n3. Tap Request sign-up. The office approves you, usually the same day.\n\n'+
    'Didn\'t expect this? Just ignore it – nothing happens without the code.\n\nThank you!\nUnScramble\n\nPlease do not reply to this email. Questions: call or text '+FI_FROM_SMS+'.';
  var html='<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#1d2b25"><h2 style="color:#1f6f43">You are invited to UnScramble</h2><p>Hello '+esc(fiFirst(o.name))+',</p><p>UnScramble invites you to set up your farm\'s client account in the UnScramble app – book crews, approve time sheets and see your invoices.</p>'+
    '<p style="text-align:center;margin:22px 0"><a href="'+esc(o.url)+'" style="background:#1f6f43;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:bold">Create my account</a></p>'+
    '<p style="text-align:center">Invite code: <b style="font-size:20px;letter-spacing:2px">'+esc(o.code)+'</b><br><span style="color:#667">single use · expires '+esc(fiNiceDate(o.expires))+'</span></p>'+
    '<ol><li>Open the link.</li><li>Enter your farm name, your name, mobile phone and/or email, and a password.</li><li>Tap <b>Request sign-up</b>. The office approves you, usually the same day.</li></ol>'+
    '<p style="color:#667;font-size:13px">Didn\'t expect this? Ignore it – nothing happens without the code.</p><p>Thank you!<br>UnScramble</p><hr style="border:0;border-top:1px solid #dde"><p style="color:#889;font-size:12px">Please do not reply to this email. Questions: call or text '+FI_FROM_SMS+'.</p></div>';
  return {from:'UnScramble <'+FI_FROM_EMAIL+'>',subject:subj,text:text,html:html};}
function fiSegments(s){var gsm=/^[\x20-\x7E\n\r£¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ¤¡ÄÖÑÜ§¿äöñüà]*$/.test(s);var n=s.length,per=gsm?(n>160?153:160):(n>70?67:70);return {n:n,seg:Math.ceil(n/per),gsm:gsm};}
/* ---------- state ---------- */
function fiOptedOut(phone){var e=fiE164(phone);return !!e&&(DB.fiOptOut||[]).indexOf(e)>=0;}
function fiStatus(i){var c=user(i.clientId),u=i.usedBy?user(i.usedBy):null;
  if(i.usedBy)return {k:'linked',t:'Registered & linked',c:'s-ok'};
  var pend=(DB.users||[]).filter(function(x){return x.type==='firm'&&x.firm&&x.firm.inviteCode&&clCodeHash(x.firm.inviteCode)===i.codeHash;})[0];
  if(i.revokedAt)return {k:'revoked',t:i.replacedBy?'Replaced by resend':'Revoked',c:'s-mut'};
  if(pend||i.registeredAt)return {k:'registered',t:'Registered – waiting for approval',c:'s-ok',login:pend};
  if(i.expires<today())return {k:'expired',t:'Expired '+i.expires,c:'s-bad'};
  if(i.openedAt)return {k:'opened',t:'Opened '+fmtStamp(i.openedAt),c:'s-warn'};
  var l=(i.sends||[])[(i.sends||[]).length-1];if(l&&l.status==='failed')return {k:'failed',t:'Not delivered',c:'s-bad'};
  if(l)return {k:'sent',t:'Sent by '+(l.channel==='sms'?'text':'email')+(l.dryRun?' (test)':''),c:'s-ok'};
  return {k:'made',t:'Code made – not sent',c:'s-mut'};}
function fiSent(){return (DB.clientInvites||[]).filter(function(i){return !i.byFarm&&(i.sends||i.sendTo);});}
/* ---------- transport ---------- */
function fiDeliver(i,code,url,want,cb){var to=i.sendTo||{},res=[];var o={name:to.name,url:url,code:code,expires:i.expires};
  var order=want==='email'?['email']:want==='sms'?['sms']:['sms','email'];
  var tryOne=function(k){var ch=order[k];if(!ch){cb(res);return;}
    if(ch==='sms'&&!fiE164(to.phone)){res.push({channel:'sms',status:'skipped',why:'no mobile number'});return tryOne(k+1);}
    if(ch==='sms'&&fiOptedOut(to.phone)){res.push({channel:'sms',status:'skipped',why:'number replied STOP'});return tryOne(k+1);}
    if(ch==='email'&&!fiEmailOk(to.email)){res.push({channel:'email',status:'skipped',why:'no email'});return tryOne(k+1);}
    var msg=ch==='sms'?{content:fiSmsText(o)}:fiEmail(o);
    /* TEST COPY: dry run only. A mobile ending 0000 simulates a failed text so the email fallback can be tested. */
    var fail=ch==='sms'&&/0000$/.test(fiE164(to.phone));
    (DB.fiOutbox=DB.fiOutbox||[]).push(Object.assign({id:uid('fo'),inviteId:i.id,at:new Date().toISOString(),channel:ch,dryRun:true,status:fail?'failed':'sent',
      to:ch==='sms'?fiE164(to.phone):String(to.email).trim(),from:ch==='sms'?'PN5pixOySo ('+FI_FROM_SMS+')':FI_FROM_EMAIL},msg));
    res.push({channel:ch,status:fail?'failed':'sent',dryRun:true,to:ch==='sms'?fiMaskPhone(to.phone):fiMaskEmail(to.email),at:new Date().toISOString()});
    if(fail)return tryOne(k+1);cb(res);};
  tryOne(0);}
function fiNewCode(c,days){var code=clGenCode(),i={id:uid('inv'),clientId:c.id,codeHash:clCodeHash(code),last4:code.slice(-4),createdAt:new Date().toISOString(),createdBy:ME.name,expires:addDays(today(),days),days:days,usedBy:'',usedAt:'',revokedAt:''};return {code:code,inv:i};}
function fiResultText(r){var ok=r.filter(function(x){return x.status==='sent';})[0];
  return (ok?'Sent by '+(ok.channel==='sms'?'text to '+ok.to:'email to '+ok.to)+(ok.dryRun?' – test only, nothing really sent':''):'Not sent')+'. '+r.filter(function(x){return x.status!=='sent';}).map(function(x){return (x.channel==='sms'?'Text':'Email')+' '+(x.status==='failed'?'failed':'skipped')+(x.why?' ('+x.why+')':'');}).join('; ');}
/* live: everything happens in the server function (makes the code, stores only its fingerprint, sends, logs) */
function fiLiveSend(body,done){var bz=function(o,m){try{if(typeof busy==='function')busy(o,m);}catch(e){}};bz(true,'Sending invite…');window.REG_SB.functions.invoke('reg-messages',{body:body}).then(function(r){bz(false);
  if(r.error||!r.data||!r.data.ok){toast((r.data&&r.data.error)||'The invite could not be sent. Nothing was charged; try again or use Invite code.');return;}done(r.data);}).catch(function(){bz(false);toast('The invite could not be sent.');});}
/* ---------- office UI ---------- */
function fiForm(c,pre){pre=pre||{};var L=clLoginsOf(c);
  return '<form data-form="fisend" id="fisendform"><input type="hidden" name="id" value="'+esc(c.id)+'">'+(pre.resend?'<input type="hidden" name="resend" value="'+esc(pre.resend)+'">':'')+
    '<div class="grid2">'+inp('name','Contact name',pre.name||(c.firm&&c.firm.contact)||'',{req:true,extra:' autocomplete="off" maxlength="80"'})+
    inp('phone','Mobile (text goes here)',pre.phone||'',{type:'tel',ph:'902 555 0123',extra:' inputmode="tel" maxlength="20"',hint:'Canadian mobile. Leave empty to send by email only.'})+
    inp('email','Email (backup)',pre.email||'',{type:'email',ph:'name@farm.ca',extra:' maxlength="120"',hint:'Used if the text can\'t be sent.'})+
    sel('via','Send by',[['auto','Text first, email if the text fails'],['sms','Text only'],['email','Email only']],pre.via||'auto')+
    sel('days','Valid for',[['7','7 days'],['14','14 days'],['30','30 days']],String(pre.days||FI_DAYS))+'</div>'+
    '<label class="chk"><input type="checkbox" name="consent" value="1"'+(pre.resend?' checked':'')+'> This person is our client contact and expects this invite (needed before we text them).</label>'+
    '<div class="card small" id="fipreview"></div>'+
    '<div class="row-end"><button type="submit" id="fisendgo">'+(pre.resend?'Resend invite':'Send invite')+'</button></div>'+
    (L.length?'<p class="small muted">This client already has '+L.length+' login'+(L.length>1?'s':'')+'. Each invite is for one more person.</p>':'')+'</form>';}
function fiPreview(){var f=document.getElementById('fisendform'),box=document.getElementById('fipreview');if(!f||!box)return;
  var o={name:f.name.value,url:clSignupUrl('ABCD-2345'),code:'ABCD-2345',expires:addDays(today(),parseInt(f.days.value,10)||FI_DAYS)},s=fiSmsText(o),g=fiSegments(s),e=fiEmail(o);
  box.innerHTML='<b>Text preview</b> <span class="muted">from '+FI_FROM_SMS+' · '+g.n+' characters, '+g.seg+' SMS part'+(g.seg>1?'s':'')+'</span><div class="fi-sms" id="fismsprev">'+esc(s)+'</div>'+
    '<details><summary><b>Email preview</b> <span class="muted">from '+FI_FROM_EMAIL+' · no signature</span></summary><div class="small"><b>Subject:</b> '+esc(e.subject)+'</div><div class="fi-mail" id="fimailprev">'+e.html+'</div></details>'+
    '<div class="muted">The real code and link are made when you send. '+(fiLive()?'':'<b>Test version: nothing is really sent – it goes to the Test outbox.</b>')+'</div>';}
ACT.fisend=function(el){var c=user(el.dataset.id);if(!clIsClient(c))return;
  if(fiLive()&&!fiServerReady()){toast('Sending by text turns on after the owner OKs the invite server function. Use Invite code for now.');return ACT.clinvite(el);}
  modal('<h2>Send invite – '+esc(clCode(c))+'</h2><p class="small">'+esc(c.name)+' · sites '+esc(clSites(c).join(', ')||'none yet')+'</p>'+fiForm(c));fiPreview();};
document.addEventListener('input',function(e){if(e.target&&e.target.form&&e.target.form.id==='fisendform')fiPreview();});
document.addEventListener('change',function(e){if(e.target&&e.target.form&&e.target.form.id==='fisendform')fiPreview();});
FORMS.fisend=function(f,d){var c=user(d.id);if(!clIsClient(c)){toast('Pick a client.');return;}
  var name=String(d.name||'').trim(),ph=String(d.phone||'').trim(),em=String(d.email||'').trim(),via=['auto','sms','email'].indexOf(d.via)>=0?d.via:'auto',days=Math.min(30,Math.max(1,parseInt(d.days,10)||FI_DAYS));
  if(!name){toast('Enter the contact name.');return;}
  if(ph&&!fiE164(ph)){toast('The mobile number needs 10 digits.');return;}
  if(em&&!fiEmailOk(em)){toast('That email does not look right.');return;}
  if(via==='sms'&&!ph){toast('Enter a mobile number, or choose email.');return;}
  if(via==='email'&&!em){toast('Enter an email, or choose text.');return;}
  if(!ph&&!em){toast('Enter a mobile number or an email.');return;}
  if(!d.consent){toast('Tick the box to confirm this person expects the invite.');return;}
  if(ph&&fiOptedOut(ph)&&!em){toast('This number replied STOP – it can\'t be texted. Add an email.');return;}
  var old=d.resend?(DB.clientInvites||[]).filter(function(x){return x.id===d.resend;})[0]:null;
  if(fiLive()){fiLiveSend({action:old?'resend':'send',client_id:c.id,resend_of:old?old.id:null,name:name,phone:fiE164(ph)||null,email:em||null,via:via,days:days,consent:true},function(r){closeModal();toast(r.summary||'Invite sent.');if(typeof refresh==='function')refresh();});return;}
  var n=fiNewCode(c,days),i=n.inv;i.sendTo={name:name,phone:fiE164(ph),email:em};i.via=via;i.consentBy=ME.name;i.consentAt=new Date().toISOString();i.sends=[];
  if(old){if(!old.usedBy&&!old.revokedAt){old.revokedAt=new Date().toISOString();}old.replacedBy=i.id;i.resendOf=old.id;i.resendCount=(old.resendCount||0)+1;}
  (DB.clientInvites=DB.clientInvites||[]).push(i);var url=clSignupUrl(n.code);
  fiDeliver(i,n.code,url,via,function(r){i.sends=i.sends.concat(r);var ok=r.some(function(x){return x.status==='sent';});
    audit(old?'Resent client invite':'Sent client invite','Client '+clCode(c),'code ending '+i.last4+' · '+r.map(function(x){return x.channel+' '+x.status+(x.dryRun?' (test)':'');}).join(', ')+' · valid until '+i.expires);save();
    modal('<h2>'+(ok?'Invite sent':'Invite not sent')+'</h2><div class="alert '+(ok?'ok':'warn')+'" id="firesult">'+esc(fiResultText(r))+'</div>'+
      '<div class="clinvbox"><div class="small muted">Backup – code (single use, valid until '+esc(i.expires)+')</div><div class="clinvcode">'+esc(n.code)+'</div>'+clCopyBtn(n.code,'Copy code','clcopycode')+
      '<div class="small muted" style="margin-top:10px">Sign-up link</div><div class="clinvurl">'+esc(url)+'</div>'+clCopyBtn(url,'Copy link','clcopylink')+'</div>'+
      '<p class="small muted">This is the only time the full code is shown. Track it under <b>Farm invites</b> on this page.</p><button class="sec" data-act="closeModal">Done</button>');render();});};
ACT.firesend=function(el){var i=(DB.clientInvites||[]).filter(function(x){return x.id===el.dataset.id;})[0];if(!i||i.usedBy)return;var c=user(i.clientId);if(!clIsClient(c))return;
  if(fiLive()&&!fiServerReady()){toast('Resend turns on after the invite server function is approved.');return;}
  var t=i.sendTo||{};modal('<h2>Resend invite – '+esc(clCode(c))+'</h2><p class="small">A new code is made and the old one stops working.</p>'+fiForm(c,{resend:i.id,name:t.name,phone:t.phone,email:t.email,via:el.dataset.via||i.via,days:i.days}));fiPreview();};
ACT.fioutbox=function(){var o=(DB.fiOutbox||[]).slice(-15).reverse();modal('<h2>Test outbox</h2><p class="small">Test version only – these texts and emails were <b>not</b> sent. They show exactly what would go out.</p>'+
  (o.length?o.map(function(m){return '<div class="card small fi-out" data-ch="'+esc(m.channel)+'"><b>'+(m.channel==='sms'?'Text':'Email')+'</b> to '+esc(m.channel==='sms'?fiMaskPhone(m.to):fiMaskEmail(m.to))+' · from '+esc(m.from)+' · '+fmtStamp(m.at)+' · <span class="pill '+(m.status==='sent'?'s-ok':'s-bad')+'">'+(m.status==='sent'?'would be sent':'simulated failure')+'</span>'+
    (m.channel==='sms'?'<div class="fi-sms">'+esc(m.content)+'</div>':'<div><b>Subject:</b> '+esc(m.subject)+'</div><div class="fi-mail">'+m.html+'</div>')+'</div>';}).join(''):'<p class="muted">Nothing yet.</p>'));};
ACT.fioptout=function(el){var i=(DB.clientInvites||[]).filter(function(x){return x.id===el.dataset.id;})[0];var e=i&&i.sendTo&&fiE164(i.sendTo.phone);if(!e)return;DB.fiOptOut=DB.fiOptOut||[];if(DB.fiOptOut.indexOf(e)<0)DB.fiOptOut.push(e);audit('Marked number as STOP (no more texts)','Client '+clCode(user(i.clientId)),fiMaskPhone(e));save();toast('Marked STOP – this number won\'t be texted again.');render();};
function fiTable(){var L=fiSent().slice().reverse();if(!L.length)return '<p class="muted small">No invites sent yet. Use <b>Send invite</b> on a client.</p>';
  var cnt={sent:0,opened:0,registered:0,linked:0,expired:0};L.forEach(function(i){var s=fiStatus(i).k;if(cnt[s]!=null)cnt[s]++;});
  return '<div class="row fi-counts small">'+['sent','opened','registered','linked','expired'].map(function(k){return '<span class="pill s-mut">'+({sent:'Sent',opened:'Opened',registered:'Registered',linked:'Linked',expired:'Expired'})[k]+' '+cnt[k]+'</span>';}).join(' ')+'</div>'+
  '<div class="tw"><table class="fitable"><tr><th>Client</th><th>Sent to</th><th>Status</th><th>Expires</th><th></th></tr>'+L.map(function(i){var c=user(i.clientId),s=fiStatus(i),t=i.sendTo||{},l=(i.sends||[]).filter(function(x){return x.status==='sent';}).pop();
    var to=[t.name?esc(t.name):'',t.phone?esc(fiMaskPhone(t.phone))+(fiOptedOut(t.phone)?' <span class="pill s-bad">STOP</span>':''):'',t.email?esc(fiMaskEmail(t.email)):''].filter(Boolean).join('<br>');
    var acts=(s.k==='linked'||s.k==='revoked'||s.k==='registered')?'':'<button class="small sec" data-act="firesend" data-id="'+esc(i.id)+'">Resend</button>'+(t.email&&t.phone?'<button class="small sec" data-act="firesend" data-via="email" data-id="'+esc(i.id)+'">Email instead</button>':'')+(t.phone&&!fiOptedOut(t.phone)&&!fiLive()?'<button class="small sec" data-act="fioptout" data-id="'+esc(i.id)+'" title="They replied STOP">Mark STOP</button>':'');
    return '<tr data-fi="'+esc(i.id)+'" data-st="'+s.k+'"><td>'+esc(clCode(c))+'<div class="small muted">••••-'+esc(i.last4)+(i.resendCount?' · resend '+i.resendCount:'')+'</div></td><td class="small">'+to+'</td><td><span class="pill '+s.c+'">'+esc(s.t)+'</span>'+(l?'<div class="small muted">'+(l.channel==='sms'?'text':'email')+' '+fmtStamp(l.at)+'</div>':'')+'</td><td class="small">'+esc(i.expires)+'</td><td><div class="row clbtns">'+acts+'</div></td></tr>';}).join('')+'</table></div>';}
(function(){var ov=VIEWS['admin:clients'];VIEWS['admin:clients']=function(){var x=ov.apply(this,arguments);
  x=x.replace(/<button class="small" data-act="clinvite" data-id="([^"]+)">Invite code<\/button>/g,'<button class="small" data-act="fisend" data-id="$1">Send invite</button><button class="small sec" data-act="clinvite" data-id="$1">Invite code</button>');
  var card='<div class="card" id="ficard"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Farm invites</h2>'+(fiLive()?'':'<button class="small sec" data-act="fioutbox">Test outbox</button>')+'</div><p class="small muted">Texts come from '+FI_FROM_SMS+' with STOP wording; email from '+FI_FROM_EMAIL+' is the backup. Status updates when the farm opens the link and when it signs up.</p>'+fiTable()+'</div>';
  var at=x.indexOf('<details class="card" id="clinvcard">');return at>=0?x.slice(0,at)+card+x.slice(at):x+card;};})();
/* ---------- farm side: "opened" + friendlier invited sign-up ---------- */
function fiMarkOpened(code){if(!code)return;var h=clCodeHash(code);
  if(fiLive()){try{window.REG_SB&&window.REG_SB.rpc('reg_invite_opened',{p_code_hash:h}).then(function(){},function(){});}catch(e){}return;}
  var i=(DB.clientInvites||[]).filter(function(x){return x.codeHash===h;})[0];if(i&&!i.openedAt&&!i.usedBy&&!i.revokedAt){i.openedAt=new Date().toISOString();save();}}
(function(){var of=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=of(h);if(String(h).split('/')[2]!=='firm')return x;var code=clInviteFromHash();
  if(code){if(PAGE_STATE.fiOpened!==code){PAGE_STATE.fiOpened=code;fiMarkOpened(code);}
    x=x.replace('<form data-form="firmsignup">','<div class="alert ok" id="fiwelcome"><b>Welcome! UnScramble invited you.</b> Your invite code is filled in below. Fill in your details and tap <b>Request sign-up</b> – it takes about 2 minutes.</div><form data-form="firmsignup">');}
  return x;};})();
/* ---------- farm sign-up form polish (audit Oct 22) ---------- */
(function(){var of=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=of(h);if(String(h).split('/')[2]!=='firm')return x;
  return x.replace(/<label[^>]*>Phone( \(optional\))?<\/label><input type="tel" name="phone"([^>]*)>/,'<label>Mobile phone</label><input type="tel" name="phone"$2 inputmode="tel" autocomplete="tel" placeholder="902 555 0123"><div class="hint">Mobile phone or email – at least one. You can sign in with either.</div>')
    .replace(/<input type="email" name="email"([^>]*)>/,'<input type="email" name="email"$1 autocomplete="email" inputmode="email" autocapitalize="off">')
    .replace(/(<input type="text" name="name")/,'$1 autocomplete="organization"').replace(/(<input type="text" name="contact")/,'$1 autocomplete="name"')
    .replace(/(<input type="text" name="username")/,'$1 autocomplete="username" autocapitalize="off"')
    .replace(/<label[^>]*>Farm or work site name \/ location \(optional\)<\/label><input type="text" name="site"([^>]*)>/,'<label>Farm address</label><input type="text" name="site"$1 autocomplete="street-address" placeholder="12 Main St, Kensington C0B 1M0"><div class="hint">Street, town and postal code of the farm or main work site. Helps the office set up your sites.</div>')
    .replace(/(<input type="password" name="pw2")/,'$1 autocomplete="new-password"');};})();
(function(){var ov=VIEWS.forgot;VIEWS.forgot=function(){var x=ov.apply(this,arguments);return x.indexOf('id="fiforgotph"')>=0?x:x.replace('<p><a href="#/">Back to sign in</a></p>','<p class="small muted" id="fiforgotph">Signed up with a mobile phone only? Call or text the office at '+FI_FROM_SMS+' and they give you a temporary password.</p><p><a href="#/">Back to sign in</a></p>');};})();
/* invite code kept on phone-only sign-ups in the test copy (v2-contactlock made those accounts itself and dropped the code) */
(function(){var of=FORMS.firmsignup;FORMS.firmsignup=function(f,d){var n=DB.users.length;var r=of(f,d);var code=clNormCode(String(d.invite||''));
  if(code&&!fiLive()&&DB.users.length>n){var u=DB.users[DB.users.length-1];if(u.type==='firm'&&!(u.firm&&u.firm.inviteCode)){u.firm=u.firm||{};u.firm.inviteCode=code;audit('Sign-up with invite code',u.name,'code ending '+code.slice(-4)+' – waiting for office approval');save();}}
  if(code&&!fiLive()&&DB.users.length>n){var i=(DB.clientInvites||[]).filter(function(x){return x.codeHash===clCodeHash(code);})[0];if(i&&!i.registeredAt){i.registeredAt=new Date().toISOString();save();}}return r;};FORMS.firmsignup._cl=1;})();
ADMIN_ONLY_ACT.push('fisend','firesend','fioutbox','fioptout');ADMIN_ONLY_FORM.push('fisend');
(function(){var s=document.createElement('style');s.textContent='.fi-sms{background:#e9f6ee;border-radius:14px 14px 14px 4px;padding:10px 12px;margin:6px 0 10px;white-space:pre-wrap;word-break:break-word;font-size:14px;max-width:340px}'+
  '.fi-mail{border:1px solid #dde3e0;border-radius:8px;padding:10px;margin:6px 0;background:#fff;overflow:auto}.fitable td{vertical-align:top}.fi-counts{gap:6px;flex-wrap:wrap;margin:6px 0}'+
  '#fisendform label.chk{display:flex;gap:8px;align-items:flex-start;margin:10px 0}#fisendform label.chk input{width:auto;margin-top:3px}';document.head.appendChild(s);})();
