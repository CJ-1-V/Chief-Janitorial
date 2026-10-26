/* v2-ownerreq1.js – owner requests Oct 25 2026 (TEST COPY ONLY – not deployed). Loaded last.
   1) Owner view: every farm/site code shows as "Farm name (CODE)" (just "CODE" while no real name is on file).
   2) Rates: only General Labour, Driver and Painting stay active. Other role rates (and "other role") are hidden / retired,
      never deleted: old values stay in every rate version and are carried forward when a new version is saved.
      Rollback: DB.settings.rateRolesActive = null (or remove this file's tag).
   3) People: "Send invite" button for the OWNER only (not office admin) – emails a farm a login invite through the existing
      farm-invite path (v2-farminvite.js → reg-messages edge function on live, from admin@unscramble.ca; flags stay off until secrets are added).
   4) Invite-only sign-up (DB.settings.inviteOnly, default ON in the test copy): only invited emails / valid invite codes can register;
      an invited sign-up is auto-approved (farms: linked to their client too). Non-invited tries are refused and listed for the office admin.
      Workers joining through their subcontractor's join link/code count as invited (owner choice pending).
   5) Unknown farms / sites ("Unknown farm XXX" clients, UNK sites, unmatched farm codes): shown ONLY to the office admin
      (Unknown list: button on Clients & logins); hidden from the owner's views everywhere. Farm code at sign-up and at clock-in auto-matches. */
'use strict';
(function(){
var OR_ACTIVE_DEFAULT=['labour','driver','painting'];
var OR_LABEL={labour:'General Labour',driver:'Driver',painting:'Painting'};
function live(){return !!window.REG_LIVE;}
function rolesOf(u){u=u||ME||{};var r=(u.officeRoles&&u.officeRoles.length?u.officeRoles:(u.officeRole?[u.officeRole]:[])).map(String);if(typeof officeRoleOf==='function'){var x=officeRoleOf(u);if(x&&r.indexOf(String(x))<0)r.push(String(x));}return r;}
function isHelper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
/* owner = office login with staff role 'owner'; test copy: the 'office' login (no roles) is the owner */
function isOwner(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||isHelper())return false;var r=rolesOf();if(r.indexOf('owner')>=0)return true;return !live()&&!r.length;}
function isOfficeAdmin(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||isHelper())return false;var r=rolesOf();return r.indexOf('admin')>=0&&r.indexOf('owner')<0;}
window.orIsOwner=isOwner;window.orIsOfficeAdmin=isOfficeAdmin;

/* ---------- farm lookup ---------- */
function normC(c){return String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');}
function farms(){return (DB.users||[]).filter(function(u){return u.type==='firm'&&!u.loginOf&&!u.mergedInto;});}
function realName(f){if(!f)return '';var n=(f.firm&&f.firm.realName)||'';if(!n&&f.name&&!/^(Client|Unknown farm) /i.test(f.name))n=f.name;return String(n).trim();}
function isUnknownFarm(f){return !!(f&&((f.firm&&(f.firm.unknown===true||f.firm.unknownFarm===true))||/^Unknown farm /i.test(f.name||'')));}
function isUnknownSite(code){var n=normC(code);if(/^UNK\d+$/.test(n))return true;var s=(DB.sites||[]).filter(function(x){return normC(x.code)===n;})[0];if(s&&(s.isUnknown||s.is_unknown))return true;
  var f=s&&s.firmId?user(s.firmId):farms().filter(function(x){return normC(x.firm&&x.firm.clientCode)===n;})[0];return isUnknownFarm(f);}
function farmByCode(code){var n=normC(code);if(!n)return null;var s=(DB.sites||[]).filter(function(x){return normC(x.code)===n;})[0];if(s&&s.firmId){var f=user(s.firmId);if(f)return f;}
  return farms().filter(function(x){return normC(x.firm&&x.firm.clientCode)===n;})[0]||null;}
function codeMap(){var m={};(DB.sites||[]).forEach(function(s){if(s.code)m[s.code]=1;});farms().forEach(function(f){var c=f.firm&&f.firm.clientCode;if(c&&c!=='–')m[c]=1;});return Object.keys(m).filter(function(c){return c.length>=4;});}
window.orFarmLabel=function(code){var f=farmByCode(code),n=realName(f);return n?n+' ('+code+')':code;};
window.orIsUnknownSite=isUnknownSite;window.orIsUnknownFarm=isUnknownFarm;
/* farm code check used at sign-up and clock-in: ok = a known (not unknown) farm or site */
window.orMatchCode=function(code){var n=normC(code);if(!n)return {st:'none'};var s=(DB.sites||[]).filter(function(x){return normC(x.code)===n&&!isUnknownSite(x.code);})[0];
  var f=farmByCode(n);if(isUnknownFarm(f)||isUnknownSite(n))return {st:'unknown',code:n};if(s||f)return {st:'ok',code:s?s.code:f.firm.clientCode,farm:f,site:s||null};return {st:'nomatch',code:n};};
function addUnknown(kind,o){if(live()){if(typeof window.or2Report==='function'&&o&&o.where==='clock-in')window.or2Report(o.code,'clock-in');return;}/* ownerreq2: live = server list (sign-up rows are written by the sign-up trigger) */(DB.orUnknown=DB.orUnknown||[]).unshift(Object.assign({id:uid('unk'),kind:kind,at:new Date().toISOString(),done:false},o));if(DB.orUnknown.length>300)DB.orUnknown.length=300;}

/* ---------- 1) + 5) owner display pass (runs after every draw of #app / #modal) ---------- */
var RX=null,RXKEY='';
function rx(){var L=codeMap(),k=L.join('|');if(k!==RXKEY){RXKEY=k;L.sort(function(a,b){return b.length-a.length;});RX=L.length?new RegExp('(^|[^A-Za-z0-9-])('+L.map(function(c){return c.replace(/[-]/g,'\\-');}).join('|')+')(?![A-Za-z0-9-])','g'):null;}return RX;}
var SKIP={SCRIPT:1,STYLE:1,TEXTAREA:1,INPUT:1,CODE:1};
function hideHost(el){return el.closest('tr,li,option,label,.tile,button,.cb-box,[data-client],[data-firm],[data-site]');}
function ownerPass(root){if(!root||!isOwner()||!DB)return;var re=rx();if(!re)return;
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),n,todo=[];while((n=w.nextNode()))todo.push(n);
  todo.forEach(function(t){var p=t.parentNode;if(!p||SKIP[p.nodeName]||p.closest('[data-or-raw]'))return;var s=t.nodeValue;if(!s||s.length<4)return;re.lastIndex=0;if(!re.test(s))return;re.lastIndex=0;
    var ctx=(p.closest('button,td,li,option,a,label')||p).textContent||'';
    var out=s.replace(re,function(m,pre,code){if(isUnknownSite(code)){var h=hideHost(p);if(h&&!h.hasAttribute('data-or-keep')){if(h.tagName==='OPTION'&&!h.selected)h.remove();else{h.setAttribute('data-or-hidden','1');h.style.setProperty('display','none','important');}}return m;}
      var f=farmByCode(code),nm=realName(f);if(!nm||ctx.indexOf(nm)>=0)return m;return pre+nm+' ('+code+')';});
    if(out!==s)t.nodeValue=out;});
  /* unknown farm rows that only show the name ("Unknown farm XXX") */
  [].forEach.call(root.querySelectorAll('tr,li,option,button'),function(el){if(/Unknown farm [A-Z]{3}\d{3}/.test(el.textContent||'')&&!el.hasAttribute('data-or-keep')){if(el.tagName==='OPTION'&&!el.selected)el.remove();else{el.setAttribute('data-or-hidden','1');el.style.setProperty('display','none','important');}}});}
var busyPass=false;
function runPass(){if(busyPass)return;busyPass=true;try{['app','modal'].forEach(function(id){var e=document.getElementById(id);if(e)ownerPass(e);});}catch(e){console.warn('[ownerreq1]',e);}finally{busyPass=false;}}
var mo=new MutationObserver(function(){if(isOwner())runPass();});
/* watch the whole body: #modal can be swapped for a new element (e.g. simplify1 client panel), so watching only the old node missed it */
function watch(){if(document.body&&!document.body.__orw){document.body.__orw=1;mo.observe(document.body,{childList:true,subtree:true,characterData:false});if(isOwner())runPass();}}
document.addEventListener('DOMContentLoaded',watch);setInterval(watch,1500);watch();

/* ---------- 2) rates: only General Labour, Driver, Painting active ---------- */
var FULL=(typeof FARM_RATE_ROLES!=='undefined')?FARM_RATE_ROLES.slice():[];window.FARM_RATE_ROLES_ALL=FULL;
function activeKeys(){var s=DB&&DB.settings&&DB.settings.rateRolesActive;if(s===null)return null;return Array.isArray(s)&&s.length?s:OR_ACTIVE_DEFAULT;}
window.orRateActive=function(k){var a=activeKeys();return !a||a.indexOf(k)>=0;};
window.orRetiredRates=function(c){var o=[];if(!c)return o;Object.keys(c.rates||{}).forEach(function(k){if(!window.orRateActive(k)&&c.rates[k]>0){var r=FULL.filter(function(x){return x[0]===k;})[0];o.push({key:k,label:r?r[1]:k,rate:c.rates[k]});}});
  if(c.other&&c.other.rate>0&&activeKeys())o.push({key:'other',label:'Other role: '+c.other.name,rate:c.other.rate});return o;};
function applyRoles(){if(typeof FARM_RATE_ROLES==='undefined'||typeof DB==='undefined'||!DB)return;var a=activeKeys();FARM_RATE_ROLES.length=0;
  FULL.forEach(function(r){if(!a||a.indexOf(r[0])>=0)FARM_RATE_ROLES.push([r[0],a&&OR_LABEL[r[0]]?OR_LABEL[r[0]]:r[1]]);});}
if(typeof RATE_INDUSTRY!=='undefined'){Object.keys(RATE_INDUSTRY).forEach(function(k){['labour','driver','painting'].forEach(function(x){if(RATE_INDUSTRY[k].indexOf(x)<0&&k!=='Cleaning')RATE_INDUSTRY[k].push(x);});});}
var _jp=window.jpPositions;if(typeof _jp==='function')window.jpPositions=function(f){applyRoles();var l=_jp.apply(this,arguments);return activeKeys()?l.filter(function(k){return k!=='other';}):l;};
if(ACT.farmratesmodal){var _fm=ACT.farmratesmodal;ACT.farmratesmodal=function(el){applyRoles();_fm.apply(this,arguments);if(!activeKeys())return;
  var f=user(el.dataset.id),c=typeof farmRatesCur==='function'?farmRatesCur(f):null,ret=window.orRetiredRates(c);
  [].forEach.call(document.querySelectorAll('#farmratesform [name=otherName],#farmratesform [name=otherRate]'),function(i){var l=i.closest('label')||i.parentNode;if(l&&l.parentNode&&l.parentNode.id!=='farmratesform')l.style.display='none';else i.type='hidden';});
  var h=document.querySelector('#farmratesform');if(h)h.insertAdjacentHTML('afterbegin','<div class="alert info small" id="orratenote"><b>Active roles: General Labour, Driver, Painting.</b> Other roles are retired (hidden) – their rates are kept, not deleted'+(ret.length&&isOwner()?': '+ret.map(function(r){return esc(r.label)+' '+money(r.rate);}).join(' · '):'')+'.</div>');};}
if(FORMS.farmrates){var _fr=FORMS.farmrates;FORMS.farmrates=function(f,d){applyRoles();var firm=user(d.id),prev=firm&&typeof farmRatesCur==='function'?farmRatesCur(firm):null,n=(DB.farmRates||[]).length;
  if(activeKeys()&&prev&&prev.other&&!d.otherName&&!d.otherRate){d.otherName=prev.other.name;d.otherRate=prev.other.rate;}
  var r=_fr.apply(this,arguments);var a=DB.farmRates||[];if(a.length>n&&prev){var nw=a[a.length-1];var keep=[];Object.keys(prev.rates||{}).forEach(function(k){if(!window.orRateActive(k)&&prev.rates[k]>0&&!(nw.rates[k]>0)){nw.rates[k]=prev.rates[k];keep.push(k);}});
    if(keep.length){nw.retiredKept=keep;save();}}return r;};}
applyRoles();
/* re-apply when settings load (live snapshot) */
var _r0=window.render;if(typeof _r0==='function'){var w=function(){try{applyRoles();}catch(e){}return _r0.apply(this,arguments);};w.__vs=_r0.__vs;window.render=w;try{render=w;}catch(e){}}

/* ---------- 3) People: owner-only "Send invite" (email a farm a login invite) ---------- */
function inviteClients(){return farms().filter(function(f){return !isUnknownFarm(f)&&(typeof clIsClient!=='function'||clIsClient(f));}).sort(function(a,b){return (realName(a)||clCode(a)).localeCompare(realName(b)||clCode(b));});}
if(VIEWS['admin:people']){var _pp=VIEWS['admin:people'];VIEWS['admin:people']=function(){var x=_pp.apply(this,arguments);if(!isOwner()||x.indexOf('id="orinvitebtn"')>=0)return x;
  var b='<button class="small" id="orinvitebtn" data-act="orinvite">Send invite</button>';
  return x.indexOf('</h1>')>=0?x.replace('</h1>','</h1>'+b):b+x;};}
ACT.orinvite=function(){if(!isOwner()){toast('Only the owner can send farm invites here.');return;}
  if(live()&&!(window.REG_STORE&&window.REG_STORE.inviteFn===true)){toast('Email invites turn on after the owner adds the email secrets to the invite server function.');return;}
  var L=inviteClients();modal('<h2>Send a farm login invite</h2><p class="small">Emails the farm a sign-up link from '+esc(typeof FI_FROM_EMAIL!=='undefined'?FI_FROM_EMAIL:'admin@unscramble.ca')+'. Their sign-up is approved and linked to the farm automatically.</p>'+
    '<label>Farm</label><select id="orinvfarm"><option value="">Pick a farm…</option>'+L.map(function(f){var c=clCode(f);return '<option value="'+esc(f.id)+'">'+esc(realName(f)?realName(f)+' ('+c+')':c)+'</option>';}).join('')+'</select><div id="orinvform"></div>');};
document.addEventListener('change',function(e){if(!e.target||e.target.id!=='orinvfarm')return;var box=document.getElementById('orinvform'),c=user(e.target.value);if(!box)return;
  box.innerHTML=c&&typeof fiForm==='function'?fiForm(c,{via:'email'}):'';if(c&&typeof fiPreview==='function')fiPreview();});
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('orinvite');

/* ---------- 4) invite-only sign-up + auto-approve ---------- */
function inviteOnly(){if(live())return !!(window.REG_STORE&&window.REG_STORE.inviteOnly===true);return !(DB&&DB.settings&&DB.settings.inviteOnly===false);}
function lc(e){return String(e||'').trim().toLowerCase();}
function invitedEmails(){var m={};(DB.clientInvites||[]).forEach(function(i){if(i.revokedAt||i.usedBy||(i.expires&&i.expires<today()))return;var e=lc(i.sendTo&&i.sendTo.email);if(e)m[e]={kind:'firm',inv:i};});
  Object.keys(DB).forEach(function(k){if(!/Outbox$/i.test(k)||!Array.isArray(DB[k]))return;DB[k].forEach(function(o){if(o&&o.channel==='email'&&o.to&&!m[lc(o.to)]&&o.kind)m[lc(o.to)]={kind:o.kind};});});
  (DB.orInvited||[]).forEach(function(o){if(!o.revokedAt)m[lc(o.email)]={kind:o.kind||'any',rec:o};});return m;}
window.orInviteCheck=function(d,kind){var em=lc(d.email),m=invitedEmails(),hit=em&&m[em];
  if(kind==='firm'){var code=typeof clNormCode==='function'?clNormCode(String(d.invite||'')):'';if(code){var x=clInviteMatch(code);if(x.st==='valid')return {ok:true,via:'invite code',inv:x.inv};return {ok:false,why:'That invite code is not valid (used, expired or revoked). Ask UnScramble for a new invite.'};}
    if(hit&&hit.kind==='firm')return {ok:true,via:'invited email',inv:hit.inv};return {ok:false,why:'Sign-up is by invite only. Use the link in your UnScramble invite email, or ask the office for one.'};}
  if(kind==='worker'&&d.subId)return {ok:true,via:'employer join code'};
  if(hit)return {ok:true,via:'invited email'};return {ok:false,why:'Sign-up is by invite only. Ask UnScramble'+(kind==='worker'?' or your employer':'')+' to send you an invite, then use the same email.'};};
function refused(kind,d,why){addUnknown('signup',{who:String(d.name||'').slice(0,80),email:lc(d.email).replace(/^(.).*@/,'$1•••@'),signupKind:kind,farmCode:normC(d.farmCode),why:why});save();}
function afterSignup(n,kind,chk,d){if(live()||DB.users.length<=n)return;var u=DB.users[DB.users.length-1];if(!u)return;
  if(chk&&chk.ok){u.accountApproved=true;u.approved=u.type==='firm'?u.approved:u.approved;u.inviteVia=chk.via;audit('Auto-approved invited sign-up',u.name,chk.via);
    if(u.type==='firm'&&chk.inv&&typeof clLink==='function'){var c=user(chk.inv.clientId);if(c){u.firm=u.firm||{};if(!u.firm.inviteCode&&chk.via==='invited email'){/* email match: link without code */}
      var err=chk.via==='invite code'?clLink(u,c,{inviteId:chk.inv.id,role:'Manager'}):clLink(u,c,{role:'Manager'});if(!err&&chk.via==='invited email'){chk.inv.usedBy=u.id;chk.inv.usedAt=new Date().toISOString();}if(err)audit('Auto-link failed',u.name,err);}}}
  var fc=normC(d.farmCode);if(fc){var m=window.orMatchCode(fc);if(m.st==='ok'){u.farmCode=m.code;audit('Farm code matched at sign-up',u.name,m.code);}else{u.farmCodeTyped=fc;addUnknown('code',{who:u.name,userId:u.id,code:fc,where:'sign-up',why:m.st==='unknown'?'unknown farm':'no such farm code'});}}
  else if(u.type==='employee'||u.type==='worker'){addUnknown('code',{who:u.name,userId:u.id,code:'',where:'sign-up',why:'no farm code given'});}
  save();if(chk&&chk.ok&&typeof go==='function'){go('#/home');}}
/* sign-up gate: a capture-phase submit listener runs before ui.js's handler, so it holds even if another module replaces FORMS.signup later */
var SKIND={signup:function(d){return d&&d.type&&d.type!=='admin'&&d.type!=='firm'&&d.type!=='tester'?d.type:null;},firmsignup:function(){return 'firm';}};
function signupGate(e){var f=e.target;if(!f||!f.dataset||!SKIND[f.dataset.form])return;var d=fd(f),kind=SKIND[f.dataset.form](d);if(!kind)return;
  /* owner decision 25 Oct: invite-only applies to FARMS only; employee/worker/sub sign-up is unchanged (no gate, no auto-approve) */
  var chk=kind==='firm'?window.orInviteCheck(d,kind):null;
  if(kind==='firm'&&inviteOnly()&&!chk.ok&&!live()){/* live: the database trigger decides (sql/ownerreq1_invite_only.sql) */e.preventDefault();e.stopImmediatePropagation();refused(kind,d,chk.why);toast(chk.why);return;}
  var n=DB.users.length,t=0,iv=setInterval(function(){if(DB.users.length>n||++t>20){clearInterval(iv);afterSignup(n,kind,chk,d);}},150);}
document.addEventListener('submit',signupGate,true);
/* farm code field on sign-up forms */
if(VIEWS.signupForm){var _sf=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=_sf.apply(this,arguments);var k=String(h).split('/')[2];if(['firm','employee','worker','sub'].indexOf(k)<0||x.indexOf('name="farmCode"')>=0)return x;
  var fld='<label>Farm code'+(k==='firm'?'':' (where you work)')+'</label><input type="text" name="farmCode" id="orfarmcode" maxlength="10" autocapitalize="characters" autocomplete="off" placeholder="e.g. FBF239"><div class="hint" id="orfarmhint">'+(k==='firm'?'On your UnScramble invite or agreement.':'Ask your supervisor or driver. Leave empty if you don\'t know it – the office will match you.')+'</div>'+
    (inviteOnly()&&k==='firm'?'<div class="alert info small" id="orinviteonly">Sign-up is by invite only'+(k==='worker'?' (or your employer\'s join code)':'')+'. Use the email your invite was sent to.</div>':'');
  return x.replace(/(<form data-form="(?:signup|firmsignup)"[^>]*>)/,'$1'+fld);};}
document.addEventListener('input',function(e){if(!e.target||e.target.id!=='orfarmcode')return;var h=document.getElementById('orfarmhint'),m=window.orMatchCode(e.target.value);if(!h)return;
  h.textContent=m.st==='ok'?'Matched: '+m.code:m.st==='none'?'':'Code not found – you can still sign up; the office will match you.';h.className='hint'+(m.st==='ok'?' ok':'');});
/* clock-in: typed code that matches no tile → "send to office" (goes to the admin's Unknown list) */
document.addEventListener('input',function(e){if(!e.target||(e.target.id!=='siteSearch'&&e.target.id!=='efSiteFind'))return;var v=normC(e.target.value),old=document.getElementById('orunkclock');if(old)old.remove();if(v.length<6)return;
  var m=window.orMatchCode(v);if(m.st==='ok')return;e.target.insertAdjacentHTML('afterend','<div class="alert warn small" id="orunkclock">Farm code '+esc(v)+' not found. <button class="small sec" data-act="orunkclock" data-code="'+esc(v)+'">Send it to the office</button></div>');});
ACT.orunkclock=function(el){addUnknown('code',{who:ME?ME.name:'',userId:ME?ME.id:'',code:normC(el.dataset.code),where:'clock-in',why:'no such farm code'});save();toast('Sent – the office will add or match this farm.');var b=document.getElementById('orunkclock');if(b)b.remove();};

/* ---------- 5) office admin: Unknown farms & sites list ---------- */
function canSeeUnknown(){return isOfficeAdmin()||(!live()&&ME&&ME.type==='admin'&&!isOwner()&&!isHelper());}
function unkHtml(){if(!canSeeUnknown())return '<h1>Not available</h1><p class="muted">This list is for the office admin.</p>';
  var uf=farms().filter(isUnknownFarm),us=(DB.sites||[]).filter(function(s){return isUnknownSite(s.code);}),q=(DB.orUnknown||[]).filter(function(x){return !x.done;});
  var te=(DB.time||[]).filter(function(t){return t.site&&isUnknownSite(t.site);});
  return '<h1>Unknown farms & sites</h1><p class="small muted" data-or-raw>Only the office admin sees this. The owner\'s screens hide unknown farms. Match each item to a real farm (Clients & logins → Open → Duplicate record?), then mark it done.</p>'+
   '<div class="card" data-or-raw><h2>Codes to match ('+q.length+')</h2>'+(q.length?'<div class="tw"><table id="orunktable"><tr><th>When</th><th>Who</th><th>Code typed</th><th>Where</th><th>Why</th><th></th></tr>'+q.map(function(x){return '<tr data-or-keep><td class="small">'+fmtStamp(x.at)+'</td><td>'+esc(x.who||'')+(x.email?'<div class="small muted">'+esc(x.email)+'</div>':'')+'</td><td><b>'+esc(x.code||x.farmCode||'–')+'</b></td><td class="small">'+esc(x.kind==='signup'?'refused sign-up ('+(x.signupKind||'')+')':x.where||'')+'</td><td class="small">'+esc(x.why||'')+'</td><td><button class="small sec" data-act="orunkdone" data-id="'+esc(x.id)+'">Done</button></td></tr>';}).join('')+'</table></div>':'<p class="muted small">Nothing waiting.</p>')+'</div>'+
   '<div class="card" data-or-raw><h2>Unknown farm records ('+uf.length+')</h2><p class="small">'+(uf.map(function(f){return esc(clCode(f));}).join(', ')||'none')+'</p><h3>Unknown sites ('+us.length+')</h3><p class="small">'+(us.map(function(s){return esc(s.code);}).join(', ')||'none')+'</p><p class="small">Hours logged at unknown sites: <b>'+te.length+'</b> entr'+(te.length===1?'y':'ies')+'.</p></div>';};
ACT.orunklist=function(){if(!canSeeUnknown()){toast('This list is for the office admin.');return;}modal('<div id="orunkmodal">'+unkHtml()+'</div>');};
ACT.orunkdone=function(el){var x=(DB.orUnknown||[]).filter(function(y){return y.id===el.dataset.id;})[0];if(!x)return;x.done=true;x.doneBy=ME.name;x.doneAt=new Date().toISOString();audit('Unknown farm code handled',x.who||'',x.code||'');save();ACT.orunklist();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('orunkdone','orunklist');
/* no menu change (menus are being reorganised separately): the office admin opens the list from a button on Clients & logins */
if(VIEWS['admin:clients']){var _cv=VIEWS['admin:clients'];VIEWS['admin:clients']=function(){var x=_cv.apply(this,arguments);if(!canSeeUnknown()||x.indexOf('id="orunkbtn"')>=0)return x;
  var n=(DB.orUnknown||[]).filter(function(y){return !y.done;}).length;var bt='<button class="small sec" id="orunkbtn" data-act="orunklist" data-or-keep>Unknown farms &amp; sites'+(n?' ('+n+')':'')+'</button>';return x.indexOf('</h1>')>=0?x.replace('</h1>','</h1>'+bt):bt+x;};}
var st=document.createElement('style');st.textContent='[data-or-hidden]{display:none!important}#orinvitebtn,#orunkbtn{margin-left:10px}.hint.ok{color:#1f6f43}';document.head.appendChild(st);

/* ---------- mock-only sample data so all of the above can be tested ---------- */
function seed(){if(live()||typeof DB==='undefined'||!DB||!DB.users||DB.__or1)return;var t0=new Date(Date.now()-86400000*30).toISOString();
  function mk(id,code,name,real,unk){if(user(id))return;DB.users.push({id:id,type:'firm',preloaded:true,name:name,username:'',email:'',phone:'',active:true,suspended:false,approved:true,accountApproved:true,createdAt:t0,lastLogin:null,profile:{},roles:[],orientations:[],firm:{billRate:22.3,contact:'',clientType:'Farm',clientCode:code,realName:real,unknown:!!unk}});
    if(!(DB.sites||[]).some(function(s){return s.code===code;}))DB.sites.push({code:code,name:unk?'Unknown site':'Main farm',firmId:id});}
  mk('cl_FBF239','FBF239','Client FBF239','',false);mk('cl_SPF214','SPF214','Client SPF214','',false);mk('cl_PFG242','PFG242','Client PFG242','',false);mk('cl_GSF260','GSF260','Client GSF260','',false);mk('cl_ZKW203','ZKW203','Unknown farm ZKW203','',true);
  (DB.farmRates=DB.farmRates||[]).push({id:'fr_or1fbf',firmId:'cl_FBF239',version:1,effective:'2026-10-01',rates:{labour:22.3,driver:27.3,forklift:24.8,grader:22.8},other:{name:'Pruning',rate:23},overtime:null,hst:true,by:'Sample data',at:t0,reason:''});
  /* owner decision 25 Oct: real farm names from past timesheets/rate list (same map as sql/ownerreq1_farm_names.sql); mock only, fills empty names */
  DB.users.forEach(function(u){var c=u.type==='firm'&&u.firm&&u.firm.clientCode;if(c&&OR_NAMES[c]&&!u.firm.realName&&!isUnknownFarm(u))u.firm.realName=OR_NAMES[c];});
  DB.__or1=1;save();}
var OR_NAMES={"ACS238": "Arthur Cousins & Sons Inc.", "AGO256": "Atlantic Grown Organics", "AWF216": "Ashley Wood Farms", "BBV248": "Bunny Burrow Vegetable Co.", "BIF254": "Birch Farms Ltd", "BPF211": "The Berry Patch", "CAF243": "Leonard Carver Poultry / Carver Farms", "CGF228": "Crystal Green Farms Ltd.", "CPF226": "Curtis Penny Farms", "CTK229": "Country Taste Kitchen & Bakery", "CUF212": "Preston Cudmore & Sons (Cudmore Farms)", "DIF213": "Diamondale Farms Inc.", "DLC227": "D and L Contracting 2023 Ltd.", "DLJ246": "D.L.J. O'Connor", "FBF239": "Fortune Bridge Farms", "GMP222": "Green Meadow Produce Inc.", "HAF219": "Havenlee Farms Inc.", "HTF251": "Hatton Farms", "HTP250": "Hilltop Produce Ltd.", "JOF215": "Jortani Farms Ltd.", "KMF237": "Kevin Macaulay Farms", "MAF244": "Maclauchlan Farms", "MBF223": "McBeth Family Farms", "MKB249": "McKenna Bros. (1989) Ltd.", "MOF236": "MoDhaicdh Farms Ltd.", "MRT247": "Mr. Turner", "PFG242": "Penny's Farm and Garden", "POF224": "Power Farms", "RDR255": "Red Dirt Renos", "SIF245": "Spud Isle Farms (2010) Ltd.", "SPF214": "Steijn Potato Farms", "SVF240": "Spring Valley Farms Ltd", "TSC241": "Twin Shores Camping Area", "URF252": "Urbainville Farms", "VPF225": "Victoria Potato Farm Inc.", "VVF253": "Valley View Farming", "WHF218": "Webster Hilltop Farms"};
var _ld=window.load||load;try{seed();}catch(e){}
setTimeout(function(){try{seed();}catch(e){}},300);
})();
