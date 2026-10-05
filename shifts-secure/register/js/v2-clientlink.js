/* v2-clientlink.js – existing clients pre-loaded + farm logins linked to them (owner request Oct 4, 2026, 11:57 PM).
   TEST ONLY – fake names (Test Farm G …). In the real version the same screens run on the database (migration 016h).
   1) Client records: one per existing client, holding its site codes. Code 'C-01'… + site codes; "Real name" field (office-editable).
      Real names are shown ONLY to the office and to that client's own logins. Workers, crew leads and subcontractors see
      the client code / site codes only (here: every page and pop-up is scrubbed; real version: row-level security, 016h).
      Office: add, edit (real name, type, sites, notes), merge clients.
   2) Linking a farm login: (a) office invite code/link per client (single-use, expires after 14 days by default, shown once
      with Copy buttons) that the farm enters at sign-up – after office approval the login is attached to that client;
      (b) without a code, the approval screen offers "Link to existing client" with a picker (client code / site codes / name).
      A linked login immediately sees the client's sites, anonymous workers/crews on those sites, past + new invoices
      (incl. uploaded past invoices), orders and the agreement.
   3) Guardrails: one client per login, link/unlink/merge/invite audited, a code shows nothing before approval, no duplicate
      links (same login twice, used/expired/revoked code, same email twice on one client), several logins per client allowed. */
'use strict';
var CL_INVITE_DAYS=14, CL_ALPHA='ABCDEFGHJKMNPQRSTUVWXYZ23456789', CL_ROLES=['Owner','Manager','Bookkeeper','Other'];
var CL_LOGIN_FIELDS={passHash:1,mustChangePw:1,twoStep:1,username:1,email:1,phone:1,lastLogin:1,failed:1,lockedUntil:1,tempPwAt:1,tempPwBy:1,loginRole:1};

/* ---------- small helpers ---------- */
function clSha256(s){s=unescape(encodeURIComponent(String(s)));function rr(v,a){return (v>>>a)|(v<<(32-a));}var mp=Math.pow,mw=mp(2,32),out='',w=[],bl=s.length*8,h=[],k=[],pc=0,comp={},i,j;
  for(var c=2;pc<64;c++){if(!comp[c]){for(i=0;i<313;i+=c)comp[i]=c;h[pc]=(mp(c,.5)*mw)|0;k[pc++]=(mp(c,1/3)*mw)|0;}}h=h.slice(0,8);s+='\x80';while(s.length%64-56)s+='\x00';
  for(i=0;i<s.length;i++){j=s.charCodeAt(i);w[i>>2]|=j<<((3-i)%4)*8;}w[w.length]=((bl/mw)|0);w[w.length]=bl;
  for(j=0;j<w.length;){var x=w.slice(j,j+=16),old=h;h=h.slice(0,8);for(i=0;i<64;i++){var a15=x[i-15],a2=x[i-2],a=h[0],e=h[4];
    var t1=h[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&h[5])^((~e)&h[6]))+k[i]+(x[i]=(i<16)?x[i]:(x[i-16]+(rr(a15,7)^rr(a15,18)^(a15>>>3))+x[i-7]+(rr(a2,17)^rr(a2,19)^(a2>>>10)))|0);
    var t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&h[1])^(a&h[2])^(h[1]&h[2]));h=[(t1+t2)|0].concat(h);h[4]=(h[4]+t1)|0;}for(i=0;i<8;i++)h[i]=(h[i]+old[i])|0;}
  for(i=0;i<8;i++)for(j=3;j+1;j--){var b=(h[i]>>(j*8))&255;out+=((b<16)?'0':'')+b.toString(16);}return out;}
function clNormCode(c){var s=String(c||'').toUpperCase().replace(/[^A-Z0-9]/g,'');return s.length===8&&s.split('').every(function(ch){return CL_ALPHA.indexOf(ch)>=0;})?s.slice(0,4)+'-'+s.slice(4):'';}
function clCodeHash(code){return clSha256('unscramble-invite:'+String(code).replace('-',''));}
function clGenCode(){var a=new Uint32Array(8),s='';(window.crypto||window.msCrypto).getRandomValues(a);for(var i=0;i<8;i++)s+=CL_ALPHA[a[i]%CL_ALPHA.length];return s.slice(0,4)+'-'+s.slice(4);}
function clSignupUrl(code){var base=window.REG_LIVE?'https://www.chiefjanitorial.com/shifts-secure/register/':(location.href.split('#')[0]);return base+'#/signup/firm?invite='+code;}
function clCode(f){return (f&&f.firm&&f.firm.clientCode)||'–';}
function clTypeOf(f){return typeof clientTypeOf==='function'?clientTypeOf(f):((f&&f.firm&&f.firm.clientType)||'Farm');}
function clSites(f){return f?(DB.sites||[]).filter(function(s){return s.firmId===f.id;}).map(function(s){return s.code;}):[];}
function clLabel(f){var s=clSites(f);return 'Client '+clCode(f)+(s.length?' · '+s.join(', '):'');}
function clResolve(id){var u=user(id),n=0;while(u&&u.mergedInto&&n<10){u=user(u.mergedInto);n++;}return u;}
function clIsClient(u){return !!(u&&u.type==='firm'&&!u.loginOf&&!u.mergedInto);}
function clAll(){return (DB.users||[]).filter(clIsClient);}
function clLoginsOf(f){return (DB.users||[]).filter(function(u){return u.type==='firm'&&u.loginOf===f.id;});}
function clOwnLogin(f){return !!(f&&f.passHash&&!f.preloaded);}
function clCanSeeName(f){return !!(ME&&f&&(ME.type==='admin'||(ME.type==='firm'&&ME.id===f.id)));}
function clName(f){return clCanSeeName(f)?f.name:clLabel(f);}
function clNextCode(){var n=0;(DB.users||[]).forEach(function(u){var m=/^C-(\d+)$/.exec((u.firm&&u.firm.clientCode)||'');if(m)n=Math.max(n,+m[1]);});n++;return 'C-'+(n<10?'0':'')+n;}
function clHasOwnData(u){var id=u.id,has=function(l){return (l||[]).some(function(x){return x.firmId===id;});};return has(DB.sites)||has(DB.clientInvoices)||has(DB.crewOrders)||has(DB.firmSigs)||has(DB.farmRates);}
function clStatus(f){var L=clLoginsOf(f).filter(function(u){return u.active!==false;}).length+(clOwnLogin(f)?1:0);
  if(f.accountApproved===false)return {t:'Sign-up pending',c:'s-pend'};if(f.active===false)return {t:'Switched off',c:'s-bad'};
  return L?{t:L+' login'+(L>1?'s':''),c:'s-ok'}:{t:'Pre-loaded – no login yet',c:'s-mut'};}
function clPickerOpts(cur){return clAll().filter(function(f){return f.accountApproved!==false;}).sort(function(a,b){return clCode(a)<clCode(b)?-1:1;}).map(function(f){
  var s=clSites(f);return '<option value="'+esc(f.id)+'"'+(f.id===cur?' selected':'')+' data-search="'+esc((clCode(f)+' '+s.join(' ')+' '+f.name+' '+clTypeOf(f)).toLowerCase())+'">'+esc(clCode(f)+' · '+(s.join(', ')||'no sites')+' · '+f.name+' · '+clTypeOf(f))+'</option>';}).join('');}
function clCopyBtn(text,label,id){return '<button type="button" class="small sec clcopy" data-act="clcopy" data-v="'+esc(text)+'"'+(id?' id="'+id+'"':'')+'>'+esc(label||'Copy')+'</button>';}
ACT.clcopy=function(el){var v=el.dataset.v;var fb=function(){var t=document.createElement('textarea');t.value=v;document.body.appendChild(t);t.select();try{document.execCommand('copy');}catch(e){}t.remove();toast('Copied.');};
  try{if(navigator.clipboard&&window.isSecureContext)navigator.clipboard.writeText(v).then(function(){toast('Copied.');},fb);else fb();}catch(e){fb();}PAGE_STATE.clCopied=v;};

/* ---------- 1) users('firm') = clients only (not the extra logins, not merged records) ---------- */
(function(){var ou=users;users=function(type){var l=ou(type);return type==='firm'?l.filter(function(u){return !u.loginOf&&!u.mergedInto;}):l;};})();

/* ---------- a linked login acts for its client: same sites, invoices, orders; sign-in fields stay the login's own ---------- */
function clAsClient(login){if(!login||!login.loginOf||login.__isProxy)return login;var c=clResolve(login.loginOf);if(!c||c.active===false||c===login)return login;
  return new Proxy(c,{get:function(t,k){if(k==='__login')return login;if(k==='__isProxy')return true;return CL_LOGIN_FIELDS[k]?login[k]:t[k];},
    set:function(t,k,v){(CL_LOGIN_FIELDS[k]?login:t)[k]=v;return true;}});}
function clLoginOf(me){return me&&me.__isProxy?me.__login:me;}
(function(){var og=gateRoute;gateRoute=function(h){if(ME&&ME.loginOf&&!ME.__isProxy)ME=clAsClient(ME);return og(h);};})();
/* audit lines name the client and the login that did it: ME.name (client) + ME.username (login, via the proxy) */

/* ---------- real names never reach workers, crew leads or subcontractors (every page + pop-up is checked) ---------- */
function clScrub(html){if(!ME||ME.type==='admin'||typeof html!=='string')return html;var own=ME.type==='firm'?ME.id:null,ownLogin=ME.__isProxy?ME.__login.id:own,mine=own?[ME.name,ME.firm&&ME.firm.realName,ME.__isProxy?ME.__login.name:''].filter(Boolean).map(String):[];
  (DB.users||[]).forEach(function(f){if(f.type!=='firm'||f.id===own||f.id===ownLogin)return;var c=clIsClient(f)?f:(clResolve(f.loginOf||f.mergedInto)||f),lab='Client '+clCode(c);
    if(c.id===own)return;[f.name,f.firm&&f.firm.realName].forEach(function(n){if(!n||String(n).length<5||mine.indexOf(String(n))>=0)return;n=String(n);html=html.split(n).join(lab);var e=esc(n);if(e!==n)html=html.split(e).join(esc(lab));});});
  return html;}
(function(){var ol=layout;layout=function(c){return clScrub(ol(c));};var om=modal;modal=function(h){return om(clScrub(h));};
  var of=firmName;firmName=function(code){var f=siteFirm(code);if(f&&!clCanSeeName(f))return 'Client '+clCode(f);return of(code);};})();

/* ---------- 2a) invite codes ---------- */
function clInvites(f){return (DB.clientInvites||[]).filter(function(i){return !f||i.clientId===f.id;});}
function clInviteState(i){if(i.usedBy)return {t:'Used',c:'s-mut'};if(i.revokedAt)return {t:'Revoked',c:'s-mut'};if(i.expires<today())return {t:'Expired',c:'s-bad'};return {t:'Active – until '+i.expires,c:'s-ok'};}
function clInviteMatch(code){var n=clNormCode(code);if(!n)return {st:'none'};var h=clCodeHash(n),i=(DB.clientInvites||[]).filter(function(x){return x.codeHash===h;})[0];
  if(!i)return {st:'nomatch'};var c=clResolve(i.clientId);if(i.usedBy)return {st:'used',inv:i,client:c};if(i.revokedAt)return {st:'revoked',inv:i,client:c};if(i.expires<today())return {st:'expired',inv:i,client:c};
  if(!clIsClient(c))return {st:'nomatch'};return {st:'valid',inv:i,client:c};}
ACT.clinvite=function(el){var f=user(el.dataset.id);if(!clIsClient(f))return;
  modal('<h2>Invite code for '+esc(clCode(f))+'</h2><p class="small">'+esc(f.name)+' · sites '+esc(clSites(f).join(', ')||'none yet')+'</p><p class="small">Give the code or link to the farm. When they sign up with it, their request shows up in <b>Review &amp; approve</b> already matched to this client; nothing about the client is shown to them until you approve. One code = one login (single use). Make another code for each extra login (e.g. owner and manager).</p>'+
  '<form data-form="clinvite" id="clinviteform"><input type="hidden" name="id" value="'+esc(f.id)+'">'+sel('days','Valid for',[['7','7 days'],['14','14 days'],['30','30 days']],String(CL_INVITE_DAYS))+'<button>Make invite code</button></form>'+
  (clInvites(f).length?'<h3>Codes for this client</h3>'+clInviteTable(clInvites(f)):''));};
FORMS.clinvite=function(f,d){var c=user(d.id);if(!clIsClient(c)){toast('Pick a client.');return;}var days=Math.min(30,Math.max(1,parseInt(d.days,10)||CL_INVITE_DAYS));
  var code=clGenCode(),i={id:uid('inv'),clientId:c.id,codeHash:clCodeHash(code),last4:code.slice(-4),createdAt:new Date().toISOString(),createdBy:ME.name,expires:addDays(today(),days),days:days,usedBy:'',usedAt:'',revokedAt:''};
  (DB.clientInvites=DB.clientInvites||[]).push(i);audit('Made client invite code','Client '+clCode(c),'code ending '+i.last4+' · valid until '+i.expires+' · single use');save();
  var url=clSignupUrl(code);PAGE_STATE.clLastInvite={code:code,url:url,id:i.id};
  modal('<h2>Invite code for '+esc(clCode(c))+'</h2><div class="clinvbox" id="clinvbox"><div class="small muted">Invite code (single use, valid until '+esc(i.expires)+')</div><div class="clinvcode" id="clinvcode">'+esc(code)+'</div>'+clCopyBtn(code,'Copy code','clcopycode')+
    '<div class="small muted" style="margin-top:10px">Sign-up link</div><div class="clinvurl" id="clinvurl">'+esc(url)+'</div>'+clCopyBtn(url,'Copy link','clcopylink')+'</div>'+
    '<div class="alert info small">This is the only time the full code is shown – the app keeps only a fingerprint of it. If it gets lost, revoke it and make a new one. Send it to the farm yourself (nothing is sent by the app).</div><button class="sec" data-act="closeModal">Done</button>');render();};
function clInviteTable(list){return '<div class="tw"><table class="clinvtable"><tr><th>Client</th><th>Code</th><th>Made</th><th>Status</th><th></th></tr>'+list.slice().reverse().map(function(i){var c=user(i.clientId),st=clInviteState(i),u=i.usedBy?user(i.usedBy):null;
  return '<tr data-inv="'+esc(i.id)+'"><td>'+esc(clCode(c))+'</td><td><code>••••-'+esc(i.last4)+'</code></td><td class="small">'+fmtStamp(i.createdAt)+'<br>'+esc(i.createdBy||'')+'</td><td><span class="pill '+st.c+'">'+esc(st.t)+'</span>'+(u?'<div class="small">by '+esc(u.username||u.email||u.name)+'</div>':'')+'</td><td>'+(st.c==='s-ok'?'<button class="small danger" data-act="clinvrevoke" data-id="'+esc(i.id)+'">Revoke</button>':'')+'</td></tr>';}).join('')+'</table></div>';}
ACT.clinvrevoke=function(el){var i=(DB.clientInvites||[]).filter(function(x){return x.id===el.dataset.id;})[0];if(!i||i.usedBy||i.revokedAt)return;if(!confirmBox('clrev'+i.id,'Revoke this invite code?'))return;
  i.revokedAt=new Date().toISOString();audit('Revoked client invite code','Client '+clCode(user(i.clientId)),'code ending '+i.last4);save();closeModal();toast('Code revoked.');render();};

/* ---------- 2b) link / unlink / merge (all audited) ---------- */
function clLink(login,client,o){o=o||{};
  if(!login||login.type!=='firm'||login.preloaded)return 'This is not a farm or client login.';
  if(login.loginOf){var cur=clResolve(login.loginOf);return cur===client?'This login is already linked to '+clCode(client)+'.':'This login is already linked to '+clCode(cur)+'. A login can belong to one client only – unlink it first.';}
  if(!clIsClient(client)||client.id===login.id||client.accountApproved===false)return 'Pick an existing client.';
  if(clHasOwnData(login))return 'This login already has its own client records (sites, invoices, orders, rates or a signed agreement). Use Merge on the Clients page instead.';
  var em=String(login.email||'').toLowerCase();if(em&&(clLoginsOf(client).concat(clOwnLogin(client)?[client]:[])).some(function(u){return u.id!==login.id&&String(u.email||'').toLowerCase()===em;}))return 'This client already has a login with the same email.';
  var inv=null;if(o.inviteId){inv=(DB.clientInvites||[]).filter(function(x){return x.id===o.inviteId;})[0];var m=inv?clInviteMatch(login.firm&&login.firm.inviteCode):{st:'nomatch'};
    if(!inv||m.st!=='valid'||m.inv!==inv||inv.clientId!==client.id)return 'That invite code is not valid any more (used, expired, revoked or for another client). Use the client picker instead.';}
  var role=CL_ROLES.indexOf(o.role)>=0?o.role:'Manager';
  login.loginOf=client.id;login.accountApproved=true;login.approved=true;login.linkedAt=new Date().toISOString();login.linkedBy=ME.name;login.linkVia=inv?'invite code':'office picker';login.loginRole=role;
  delete login.unlinkedFrom;if(inv){inv.usedBy=login.id;inv.usedAt=new Date().toISOString();}
  audit('Linked farm login to client','Client '+clCode(client),(login.username||login.email)+' · '+role+' · via '+login.linkVia+(inv?' (code ending '+inv.last4+')':''));
  notify(login.id,'Your UnScramble account was approved and linked to your farm/client account. Sign in to see your sites, workers, invoices and orders.');save();return null;}
function clUnlink(login,reason){if(!login||!login.loginOf)return 'This login is not linked.';var c=clResolve(login.loginOf);
  login.unlinkedFrom=login.loginOf;login.loginOf=null;login.accountApproved=false;login.unlinkedAt=new Date().toISOString();
  audit('Unlinked farm login from client','Client '+clCode(c),(login.username||login.email)+(reason?' · reason: '+reason:''));notify(login.id,'Your login is no longer linked to a farm/client account. Contact the UnScramble office.');save();return null;}
function clMerge(src,dst){if(!clIsClient(src)||!clIsClient(dst)||src.id===dst.id)return 'Pick two different clients.';
  var n={sites:0,invoices:0,orders:0,changes:0,logins:0};
  (DB.sites||[]).forEach(function(s){if(s.firmId===src.id){s.firmId=dst.id;n.sites++;}});
  (DB.clientInvoices||[]).forEach(function(i){if(i.firmId===src.id){if(typeof pastDup==='function'&&pastDup(dst.id,i.number,i.id))i.number=i.number+'-'+clCode(src);i.firmId=dst.id;n.invoices++;}});
  (DB.crewOrders||[]).forEach(function(o){if(o.firmId===src.id){o.firmId=dst.id;o.firmName=dst.name;n.orders++;}});
  (DB.changes||[]).forEach(function(c){if(c.firmId===src.id){c.firmId=dst.id;c.firmName=dst.name;n.changes++;}});
  (DB.users||[]).forEach(function(u){if(u.loginOf===src.id){u.loginOf=dst.id;n.logins++;}});
  if(clOwnLogin(src)){src.loginOf=dst.id;src.loginRole=src.loginRole||'Owner';n.logins++;}else src.active=false;
  src.mergedInto=dst.id;src.mergedAt=new Date().toISOString();
  if(!dst.firm.realName&&src.firm&&src.firm.realName){dst.firm.realName=src.firm.realName;dst.name=src.firm.realName;}
  audit('Merged clients','Client '+clCode(src)+' → Client '+clCode(dst),n.sites+' site(s), '+n.invoices+' invoice(s), '+n.orders+' order(s), '+n.logins+' login(s) moved. Rates and signed agreements of '+clCode(src)+' stay archived on it.');save();return null;}

/* ---------- office screen: Clients & logins ---------- */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/firms')return i+1;return NAV.admin.length;})(),0,['#/clients','Clients & logins']);
if(typeof MENU_GROUPS!=='undefined')MENU_GROUPS.forEach(function(g){if(g[1].indexOf('#/firms')>=0&&g[1].indexOf('#/clients')<0)g[1].splice(g[1].indexOf('#/firms')+1,0,'#/clients');});
function clPendingSignups(){return (DB.users||[]).filter(function(u){return u.type==='firm'&&u.accountApproved===false&&u.active!==false&&!u.loginOf&&!u.preloaded&&!clHasOwnData(u);});}
function clPendingCard(){var p=clPendingSignups();if(!p.length)return '';
  return '<div class="card hl" id="clpending"><h3 style="margin-top:0">Farm &amp; client sign-ups – link to an existing client</h3><p class="small">Most new farm logins belong to a client we already have. Link them so they see their sites, workers, invoices and orders right away. "Approve as new client" makes a brand-new client instead.</p><div class="tw"><table><tr><th>Sign-up</th><th>Login</th><th>Invite code</th><th></th></tr>'+
  p.map(function(u){var m=clInviteMatch(u.firm&&u.firm.inviteCode),ic='<span class="muted small">none</span>';
    if(m.st==='valid')ic='<span class="pill s-ok">Matches '+esc(clCode(m.client))+'</span><div class="small">'+esc(clSites(m.client).join(', '))+' · valid until '+esc(m.inv.expires)+'</div>';
    else if(m.st!=='none')ic='<span class="pill s-bad">'+esc({nomatch:'No matching code',used:'Code already used',revoked:'Code revoked',expired:'Code expired'}[m.st])+'</span>';
    return '<tr data-signup="'+esc(u.username||u.id)+'"><td><b>'+esc(u.name)+'</b><div class="small muted">'+esc((u.firm||{}).contact||'')+' · '+fmtStamp(u.createdAt)+'</div></td><td class="small">'+esc(u.username||'')+' '+esc(u.email||'')+'</td><td>'+ic+'</td><td><div class="row clbtns"><button class="small" data-act="cllinkpick" data-id="'+u.id+'">'+(m.st==='valid'?'Approve &amp; link to '+esc(clCode(m.client)):'Link to existing client')+'</button><button class="small sec" data-act="approvenew" data-id="'+u.id+'">Approve as new client</button></div></td></tr>';}).join('')+'</table></div></div>';}
VIEWS['admin:clients']=function(){var list=clAll().slice().sort(function(a,b){return clCode(a)<clCode(b)?-1:clCode(a)>clCode(b)?1:0;}),q=PAGE_STATE.clQ||'';
  var unassigned=(DB.sites||[]).filter(function(s){return !s.firmId&&s.code!=='TEST-PRACTICE';});
  return '<h1>Clients &amp; logins</h1><p class="small muted">One record per client (farm, construction or other), holding its site codes. Real names are shown only to the office and to that client\'s own logins – workers, crew leads and subcontractors only ever see the client code and site codes.</p>'+
  clPendingCard()+
  '<div class="card"><div class="row clsearchrow"><input type="search" id="clsearch" data-calc="clsearch" placeholder="Find by client code, site code or name" value="'+esc(q)+'" aria-label="Find client"><span class="small muted" id="clcount">'+list.length+' clients</span></div>'+
  '<div class="tw"><table id="clienttable"><tr><th>Client</th><th>Real name</th><th>Type</th><th>Sites</th><th>Logins</th><th></th></tr>'+list.map(function(f){var st=clStatus(f),L=clLoginsOf(f);
    return '<tr data-client="'+esc(clCode(f))+'" data-search="'+esc((clCode(f)+' '+clSites(f).join(' ')+' '+f.name+' '+clTypeOf(f)).toLowerCase())+'"><td><b>'+esc(clCode(f))+'</b>'+(f.preloaded?'<div class="small muted">pre-loaded</div>':'')+'</td><td>'+(f.firm&&f.firm.realName?esc(f.firm.realName):'<span class="muted small">not entered yet</span>')+'</td><td>'+esc(clTypeOf(f))+'</td><td class="small">'+esc(clSites(f).join(', ')||'–')+'</td>'+
    '<td><span class="pill '+st.c+'">'+esc(st.t)+'</span>'+(L.length?'<div class="small">'+L.map(function(u){return esc((u.username||u.email)+' ('+(u.loginRole||'login')+(u.active===false?', off':'')+')');}).join('<br>')+'</div>':'')+'</td>'+
    '<td><div class="row clbtns"><button class="small sec" data-act="cledit" data-id="'+f.id+'">Edit</button><button class="small" data-act="clinvite" data-id="'+f.id+'">Invite code</button><button class="small sec" data-act="clmergepick" data-id="'+f.id+'">Merge…</button></div></td></tr>';}).join('')+'</table></div></div>'+
  (unassigned.length?'<div class="card"><h3 style="margin-top:0">Sites not linked to a client</h3><p class="small">'+unassigned.map(function(s){return esc(s.code);}).join(', ')+' – open a client\'s Edit to add them.</p></div>':'')+
  '<details class="card" id="clnewcard"><summary><b>Add a client</b></summary><form data-form="clnew" class="clform">'+inp('realName','Real name (office and the client\'s own logins only)','',{})+'<div><label class="req">Type</label>'+(typeof clientSel==='function'?clientSel('clientType','Farm'):'<input name="clientType" value="Farm">')+'</div>'+clSiteChecks(null)+'<button>Add client</button></form></details>'+
  (clInvites().length?'<details class="card" id="clinvcard"><summary><b>Invite codes</b> <span class="small muted">('+clInvites().filter(function(i){return clInviteState(i).c==='s-ok';}).length+' active)</span></summary>'+clInviteTable(clInvites())+'</details>':'')+
  '<details class="card" id="clhowto"><summary><b>How sites are grouped into clients</b></summary><p class="small">Each existing site starts as its own client record (the database does not know which sites belong to the same farm). When one client has several sites, open the client that should stay, tick its other sites under Edit – or use <b>Merge…</b> to fold a whole record into another (sites, invoices, orders and logins move; nothing is deleted). Set the type (Farm, Construction, …) and type the real name if you want it on the office screens.</p></details>';};
CALC.clsearch=function(el){var q=String(el.value||'').toLowerCase().trim();PAGE_STATE.clQ=el.value;var n=0;[].forEach.call(document.querySelectorAll('#clienttable tr[data-search]'),function(tr){var ok=!q||tr.dataset.search.indexOf(q)>=0;tr.style.display=ok?'':'none';if(ok)n++;});var c=document.getElementById('clcount');if(c)c.textContent=n+' clients';};
CALC.clpick=function(el){var q=String(el.value||'').toLowerCase().trim(),s=document.querySelector('#cllinkform select[name=client]');if(!s)return;var first=null;[].forEach.call(s.options,function(o){if(!o.value)return;var ok=!q||(o.dataset.search||'').indexOf(q)>=0;o.hidden=!ok;o.disabled=!ok;if(ok&&!first)first=o;});if(first&&(s.selectedOptions[0]||{}).disabled)s.value=first.value;};
function clSiteChecks(f){var sites=(DB.sites||[]).filter(function(s){return s.code!=='TEST-PRACTICE';}).sort(function(a,b){return a.code<b.code?-1:1;});
  return '<fieldset class="clsites"><legend>Site codes</legend><div class="clsitegrid">'+sites.map(function(s){var owner=s.firmId?user(s.firmId):null,mine=f&&s.firmId===f.id;
    return '<label class="inline"><input type="checkbox" name="sites[]" value="'+esc(s.code)+'"'+(mine?' checked':'')+'> <span><b>'+esc(s.code)+'</b>'+(owner&&!mine?' <span class="small muted">(now '+esc(clCode(owner))+')</span>':'')+'</span></label>';}).join('')+'</div><p class="small muted">Ticking a site that belongs to another client moves it here (logged).</p></fieldset>';}
function clApplySites(f,codes){var moved=[];(DB.sites||[]).forEach(function(s){var want=codes.indexOf(s.code)>=0;if(want&&s.firmId!==f.id){moved.push(s.code+(s.firmId?' (from '+clCode(user(s.firmId))+')':''));s.firmId=f.id;}else if(!want&&s.firmId===f.id){moved.push(s.code+' removed');s.firmId=null;}});return moved;}
FORMS.clnew=function(f,d){if(typeof clientTypes==='function'&&clientTypes().indexOf(d.clientType)<0){toast('Pick a type.');return;}var code=clNextCode();
  var u={id:uid('cl'),type:'firm',preloaded:true,name:d.realName||('Client '+code),username:'',email:'',phone:'',active:true,suspended:false,approved:true,accountApproved:true,createdAt:new Date().toISOString(),lastLogin:null,profile:{},roles:[],orientations:[],firm:{billRate:0,contact:'',clientType:d.clientType||'Farm',clientCode:code,realName:d.realName||''}};
  DB.users.push(u);var mv=clApplySites(u,d.sites||[]);audit('Added client','Client '+code,(d.clientType||'Farm')+(mv.length?' · sites '+mv.join(', '):'')+(d.realName?' · real name entered':''));save();toast('Client '+code+' added.');render();};
ACT.cledit=function(el){var f=user(el.dataset.id);if(!clIsClient(f))return;var L=clLoginsOf(f);
  modal('<h2>Client '+esc(clCode(f))+'</h2><form data-form="cledit" class="clform" id="cleditform"><input type="hidden" name="id" value="'+esc(f.id)+'">'+inp('realName','Real name',(f.firm&&f.firm.realName)||'',{hint:'Shown only to the office and to this client\'s own logins. Workers, crew leads and subcontractors see "Client '+clCode(f)+'" and the site codes.'})+
  '<div><label class="req">Type</label>'+(typeof clientSel==='function'?clientSel('clientType',clTypeOf(f)):'')+'</div>'+clSiteChecks(f)+'<div><label>Office notes</label><textarea name="notes" rows="2">'+esc((f.firm&&f.firm.notes)||'')+'</textarea></div><button>Save client</button></form>'+
  '<h3>Logins</h3>'+((L.length||clOwnLogin(f))?'<div class="tw"><table id="clloginlist"><tr><th>Login</th><th>Role</th><th>Linked</th><th></th></tr>'+(clOwnLogin(f)?'<tr><td>'+esc(f.username||f.email)+'</td><td>Main login</td><td class="small">signed up as this client</td><td></td></tr>':'')+
    L.map(function(u){return '<tr data-login="'+esc(u.username||u.id)+'"><td>'+esc(u.username||u.email)+'<div class="small muted">'+esc(u.email||'')+'</div></td><td>'+esc(u.loginRole||'')+'</td><td class="small">'+fmtStamp(u.linkedAt)+' · '+esc(u.linkVia||'')+'<br>by '+esc(u.linkedBy||'')+'</td><td><button class="small danger" data-act="clunlinkask" data-id="'+u.id+'">Unlink</button></td></tr>';}).join('')+'</table></div>':'<p class="small muted">No login yet. Use "Invite code" so the farm can sign up and be linked here.</p>'));};
FORMS.cledit=function(f,d){var c=user(d.id);if(!clIsClient(c))return;if(typeof clientTypes==='function'&&clientTypes().indexOf(d.clientType)<0){toast('Pick a type.');return;}var ch=[];
  var rn=String(d.realName||'').trim();if(rn!==(c.firm.realName||'')){ch.push(rn?(c.firm.realName?'real name changed':'real name entered'):'real name removed');c.firm.realName=rn;c.name=rn||('Client '+clCode(c));}
  if(d.clientType&&d.clientType!==clTypeOf(c)){ch.push('type '+clTypeOf(c)+' → '+d.clientType);c.firm.clientType=d.clientType;}
  var nt=String(d.notes||'');if(nt!==(c.firm.notes||'')){c.firm.notes=nt;ch.push('notes');}
  var mv=clApplySites(c,d.sites||[]);if(mv.length)ch.push('sites: '+mv.join(', '));
  audit('Edited client','Client '+clCode(c),ch.join(' · ')||'no changes');save();closeModal();toast('Client '+clCode(c)+' saved.');render();};
ACT.clmergepick=function(el){var f=user(el.dataset.id);if(!clIsClient(f))return;
  modal('<h2>Merge '+esc(clCode(f))+' into another client</h2><p class="small">Use this when two records are really the same client (e.g. one farm with two sites). Sites, invoices, orders and logins of <b>'+esc(clCode(f))+'</b> ('+esc(clSites(f).join(', ')||'no sites')+') move to the client you pick. <b>'+esc(clCode(f))+'</b> is kept as an archived record; nothing is deleted. This is logged.</p>'+
  '<form data-form="clmerge" id="clmergeform"><input type="hidden" name="src" value="'+esc(f.id)+'"><div><label class="req">Keep this client</label><select name="dst" required><option value="">– choose –</option>'+clPickerOpts('').replace('<option value="'+esc(f.id)+'"','<option disabled value="'+esc(f.id)+'"')+'</select></div>'+chk('ok','I checked that these are the same client',false,{req:true})+'<button>Merge</button></form>');};
FORMS.clmerge=function(f,d){var s=user(d.src),t=user(d.dst);if(!d.ok){toast('Tick the box to confirm.');return;}var e=clMerge(s,t);if(e){toast(e);return;}closeModal();toast('Merged '+clCode(s)+' into '+clCode(t)+'.');render();};
ACT.clunlinkask=function(el){var u=user(el.dataset.id);if(!u||!u.loginOf)return;
  modal('<h2>Unlink login</h2><p>'+esc(u.username||u.email)+' will no longer see '+esc(clCode(clResolve(u.loginOf)))+'. The login goes back to <b>Review &amp; approve</b>, where you can link it to the right client or decline it.</p><form data-form="clunlink"><input type="hidden" name="id" value="'+esc(u.id)+'">'+inp('reason','Reason (for the audit log)','',{req:true})+'<button class="danger">Unlink</button></form>');};
FORMS.clunlink=function(f,d){var u=user(d.id);if(!d.reason){toast('Give a reason.');return;}var e=clUnlink(u,d.reason);if(e){toast(e);return;}closeModal();toast('Login unlinked.');render();};
ACT.cllinkpick=function(el){var u=user(el.dataset.id);if(!u)return;var m=clInviteMatch(u.firm&&u.firm.inviteCode),pre=m.st==='valid'?m.client.id:'';
  modal('<h2>Link this sign-up to an existing client</h2><p class="small"><b>'+esc(u.name)+'</b> · '+esc(u.username||'')+' '+esc(u.email||'')+(u.firm&&u.firm.contact?' · contact '+esc(u.firm.contact):'')+(u.firm&&u.firm.siteRequest?' · site given: '+esc(u.firm.siteRequest):'')+'</p>'+
  (m.st==='valid'?'<div class="alert ok small" id="clinvmatch">Invite code matches <b>'+esc(clCode(m.client))+'</b> ('+esc(clSites(m.client).join(', '))+') – made '+fmtStamp(m.inv.createdAt)+', valid until '+esc(m.inv.expires)+'.</div>':(m.st!=='none'?'<div class="alert warn small" id="clinvmatch">The invite code they entered can\'t be used ('+esc({nomatch:'no matching code',used:'already used',revoked:'revoked',expired:'expired'}[m.st])+'). Pick the client below if you know who they are.</div>':''))+
  '<form data-form="cllink" id="cllinkform"><input type="hidden" name="id" value="'+esc(u.id)+'"><input type="hidden" name="invite" value="'+esc(m.st==='valid'?m.inv.id:'')+'">'+
  '<div><label for="clpickq">Find client</label><input type="search" id="clpickq" data-calc="clpick" placeholder="Client code, site code or name"></div>'+
  '<div><label class="req">Client</label><select name="client" required size="6" class="clpicker"><option value=""'+(pre?'':' selected')+' disabled>– choose –</option>'+clPickerOpts(pre)+'</select></div>'+
  sel('role','This login is the client\'s…',CL_ROLES.map(function(r){return [r,r];}),'Manager')+'<button>Approve &amp; link</button> <button type="button" class="sec" data-act="closeModal">Cancel</button></form>');};
FORMS.cllink=function(f,d){var u=user(d.id),c=user(d.client);if(!c){toast('Pick the client.');return;}var useInv=d.invite&&(DB.clientInvites||[]).some(function(i){return i.id===d.invite&&i.clientId===c.id;});
  var e=clLink(u,c,{via:useInv?'invite':'picker',inviteId:useInv?d.invite:'',role:d.role});if(e){toast(e);audit('Link refused','Client '+clCode(c),(u?(u.username||u.email):'?')+' · '+e);save();return;}
  closeModal();toast('Approved and linked to '+clCode(c)+'.');render();};
(function(){var or=VIEWS['admin:review'];VIEWS['admin:review']=function(){var x=or();var card=clPendingCard();if(!card)return x;var at=x.indexOf('<h2 style="margin-top:0">New accounts waiting for approval</h2>');return at>=0?x.slice(0,at)+card+x.slice(at):card+x;};})();
/* approving a farm as a NEW client gives it the next client code (real name = the name it signed up with) */
(function(){var oa=ACT.approvenew;ACT.approvenew=function(el){var u=user(el.dataset.id);oa(el);if(u&&u.type==='firm'&&!u.loginOf){u.firm=u.firm||{};if(!u.firm.clientCode){u.firm.clientCode=clNextCode();audit('New client code','Client '+u.firm.clientCode,(u.username||u.email)+' approved as a new client');}if(!u.firm.realName)u.firm.realName=u.name;save();render();}};})();

/* ---------- sign-up with an invite code (shows nothing about the client before approval) ---------- */
function clInviteFromHash(){var m=/[?&]invite=([A-Za-z0-9-]{8,12})/.exec(location.hash||'');return m?clNormCode(m[1]):'';}
(function(){var of=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=of(h);if(String(h).split('/')[2]!=='firm')return x;var pre=clInviteFromHash();
  var field='<div id="clinvitefield">'+inp('invite','Invite code from the office (optional)',pre,{ph:'e.g. ABCD-2345',hint:'Already a client of UnScramble? Enter the code (or open the link) the office gave you, so your login is attached to your farm after approval.'})+'</div>';
  var at=x.indexOf('<div><label class="req">Password');if(at<0)at=x.indexOf(inp('pw','Password','',{type:'password',req:true}));return at>=0?x.slice(0,at)+field+x.slice(at):x.replace('<button type="submit">',field+'<button type="submit">');};})();
(function(){var of=FORMS.firmsignup;FORMS.firmsignup=function(f,d){var raw=String(d.invite||'').trim(),code=raw?clNormCode(raw):'';
  if(raw&&!code){toast('Invite codes look like ABCD-2345 (8 letters/numbers). Check the code, or leave it empty.');return;}
  var n=DB.users.length;of(f,d);if(code&&DB.users.length>n){var u=DB.users[DB.users.length-1];if(u.type==='firm'){u.firm=u.firm||{};u.firm.inviteCode=code;audit('Sign-up with invite code',u.name,'code ending '+code.slice(-4)+' – waiting for office approval');save();render();}}};})();
(function(){var op=VIEWS.pending;VIEWS.pending=function(){var x=op();if(ME&&ME.type==='firm'&&ME.firm&&ME.firm.inviteCode)x+='<div class="card small" id="clinvitepending"><b>Invite code received.</b> The office checks it when it approves your account. After approval your login is attached to your farm and you will see your sites, invoices and orders.</div>';return x;};})();

/* ---------- farm home after linking: who is signed in, which client, which sites ---------- */
(function(){var oh=VIEWS['firm:home'];VIEWS['firm:home']=function(){var x=oh();if(!ME)return x;var L=clLoginOf(ME),others=clLoginsOf(ME).filter(function(u){return u.id!==L.id&&u.active!==false;}).length+(clOwnLogin(ME)&&L.id!==ME.id?1:0);
  var b='<div class="card cllinked" id="clientlinkbanner"><div class="row"><span class="pill s-ok">Client '+esc(clCode(ME))+'</span><b>'+esc(ME.name)+'</b></div><div class="small">Sites: '+esc(clSites(ME).join(', ')||'none yet')+(ME.__isProxy?' · signed in as '+esc(L.username||L.email)+(L.loginRole?' ('+esc(L.loginRole)+')':'')+(others?' · '+others+' other login'+(others>1?'s':'')+' for your account':''):'')+'</div></div>';
  return b+x;};})();

/* ---------- small wording fix: no client names as examples on subcontractor screens ---------- */
(function(){Object.keys(VIEWS).forEach(function(k){if(!/^sub:|^tester:/.test(k))return;var ov=VIEWS[k];VIEWS[k]=function(){var x=ov.apply(this,arguments);return typeof x==='string'?x.replace('placeholder="e.g. Test Farm A"','placeholder="e.g. site TFA-01"'):x;};});})();

/* ---------- access rules ---------- */
ADMIN_ONLY_ACT.push('clinvite','clinvrevoke','cledit','clmergepick','clunlinkask','cllinkpick');
ADMIN_ONLY_FORM.push('clinvite','clnew','cledit','clmerge','clunlink','cllink');

/* ---------- sample data (TEST only – fake names) ---------- */
function seedClientLink(db){db.settings=db.settings||{};if(db.settings.clSeeded)return;db.settings.clSeeded=1;db.clientInvites=db.clientInvites||[];
  var by=function(n){return db.users.filter(function(u){return u.username===n;})[0];};
  [['firmA','C-01'],['firmB','C-02'],['clientFarm','C-03'],['firmD','C-04'],['firmE','C-05'],['clientCon','C-06'],['clientBake','C-07'],['clientPaint','C-08'],['clientClean','C-09']].forEach(function(c){var u=by(c[0]);if(u){u.firm=u.firm||{};u.firm.clientCode=c[1];u.firm.realName=u.name;}});
  var t0=Date.now(),mk=function(code,real,type,sites,rate){var u={id:'cl_'+code.replace('-',''),type:'firm',preloaded:true,name:real||('Client '+code),username:'',email:'',phone:'',active:true,suspended:false,approved:true,accountApproved:true,createdAt:new Date(t0-86400000*90).toISOString(),lastLogin:null,profile:{},roles:[],orientations:[],firm:{billRate:rate||0,contact:'',clientType:type,clientCode:code,realName:real||'',notes:'Pre-loaded sample client (no login yet)'}};
    db.users.push(u);sites.forEach(function(s){db.sites.push({code:s[0],name:s[1],firmId:u.id});});return u;};
  var G=mk('C-10','Test Farm G','Farm',[['TFG-01','Upper field'],['TFG-02','Wash shed']],24.5);mk('C-11','','Farm',[['TFH-01','Field']]);mk('C-12','Sample Roofing Co. (TEST)','Construction',[['TRF-01','Roof job']]);
  var T=today(),r={id:'fr_clG1',firmId:G.id,version:1,effective:addDays(T,-80),rates:{labour:24.5,grader:25.5,packer:25.5,forklift:27.5,driver:29.5},other:null,overtime:36.75,hst:true,by:'Sample data',at:new Date(t0-86400000*80).toISOString(),reason:''};
  (db.farmRates=db.farmRates||[]).push(r);
  (db.firmSigs=db.firmSigs||[]).push({id:'fs_clG1',firmId:G.id,firmName:G.name,version:((db.settings.firmAgreement||{}).version)||'1.0',label:typeof FIRM_AGR_LABEL!=='undefined'?FIRM_AGR_LABEL:'Independent Contractor Service Agreement',signerName:'Sample Signer G',title:'Farm Manager',signature:'Sample Signer G',authorized:true,at:new Date(t0-86400000*79).toISOString(),tz:'America/Halifax',device:'Computer – sample data',text:typeof firmAgreementText==='function'?firmAgreementText(G.name,'Farm'):'',rateVersion:1,rateSnapshot:JSON.parse(JSON.stringify(r))});
  db.clientInvoices=db.clientInvoices||[];
  db.clientInvoices.push({id:'ci_clG1',firmId:G.id,number:'UC-SAMPLE-G01',periodStart:addDays(T,-75),periodEnd:addDays(T,-46),billHours:140,amount:3430,hst:514.5,total:3944.5,issued:addDays(T,-45),due:addDays(T,-15),interestPct:2,paidAt:addDays(T,-20),sample:true});
  var pdf='%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF';
  db.clientInvoices.push({id:'ci_clG2',firmId:G.id,number:'PI-2025-G07',issued:addDays(T,-200),periodStart:addDays(T,-230),periodEnd:addDays(T,-201),amount:2100,hst:315,total:2415,due:addDays(T,-170),paidAt:addDays(T,-175),note:'',billHours:0,interestPct:0,uploaded:true,file:{name:'PI-2025-G07.pdf',type:'application/pdf',size:pdf.length,data:'data:application/pdf;base64,'+btoa(pdf)},uploadedBy:'Sample office',uploadedAt:new Date(t0-86400000*30).toISOString()});
  db.orderSeq=(db.orderSeq||0)+1;var f1={site:'TFG-01',date:addDays(T,4),start:'07:00',end:'15:00',hours:null,workers:5,role:'labour',ppe:'Client',note:'Sample: grading crew'};
  (db.crewOrders=db.crewOrders||[]).push({id:'co_clG1',no:'CO-'+String(db.orderSeq).padStart(4,'0'),firmId:G.id,firmName:G.name,seriesId:null,createdAt:new Date(t0-86400000*2).toISOString(),createdBy:'Office (phone order)',req:f1,cur:JSON.parse(JSON.stringify(f1)),status:'Confirmed',pending:null,decisions:[{kind:'new',dec:'Confirmed',comment:'',by:'Sample office',at:new Date(t0-86400000*2).toISOString(),late:false}],history:[{at:new Date(t0-86400000*2).toISOString(),simDate:T,who:'Sample office',action:'Order taken by phone and confirmed',detail:'TFG-01 '+f1.date+' 07:00 · 5 workers'}],shiftId:null});
  var w4=by('worker4'),mon=addDays(T,-((parseD(T).getDay()+6)%7));if(w4)db.shifts.push({id:'s_clG1',date:mon<T?mon:addDays(T,-1),start:'07:00',end:'15:30',role:'general',kind:'crew',orientation:false,booked:[w4.id],test:false,needed:2,site:'TFG-01',title:'Subcontractor crew – field (sample, past)'});}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedClientLink(db);};})();
(function(){var ol=load;load=function(){ol();if(DB&&!window.REG_LIVE&&!(DB.settings&&DB.settings.clSeeded)&&(DB.users||[]).some(function(u){return u.username==='firmA';})){seedClientLink(DB);save();}if(DB)DB.clientInvites=DB.clientInvites||[];};})();
/* the "Client C-xx / signed in as" line stays at the top of the farm home (after the home is grouped into sections) */
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{var b=root&&root.querySelector&&root.querySelector('#clientlinkbanner'),m=root&&root.querySelector&&root.querySelector('main');
  if(b&&m){var h=m.querySelector('h1');if(h&&h.parentNode===m)h.insertAdjacentElement('afterend',b);else m.insertBefore(b,m.firstChild);}}catch(e){}};})();
/* "My profile" of a linked farm login is the PERSON's own login (name, username, email, phone), not the client record:
   the page and the save run with ME = the login (fixes "username already used" – the check compared against the client's id –
   and stops a profile save from renaming the client). */
function clAsLoginDo(fn){if(!(ME&&ME.__isProxy))return fn();var px=ME;ME=px.__login;try{return fn();}finally{if(ME===px.__login)ME=px;}}
(function(){var ov=VIEWS.profile;VIEWS.profile=function(){var a=arguments;return clAsLoginDo(function(){return ov.apply(null,a);});};
  var of=FORMS.profile;FORMS.profile=function(f,d){return clAsLoginDo(function(){return of(f,d);});};})();
