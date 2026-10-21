/* v2-farmroles.js – farmroles1 (Oct 21 2026, owner 12:40 AM). TEST COPY – not live.
   A farm's own managers and supervisors get their own login, linked to the farm (loginOf, as today) with farmRole.
   - Farm owner (the farm account, or a linked "Owner" login): Profile/Home → Team (#/team): invite by email or phone (single-use
     code + link, the app sends nothing – "Open email" / "Open text" open the owner's own app), change role / permissions, remove.
     The office approves the sign-up in Review & approve as today; the role comes from the invite (DB trigger a3_farm_invite_role too).
   - Manager / supervisor: Home, Time sheets, Crew orders, Profile, Alerts only. No Invoices tab; #/invoices (and any other page)
     shows "For the farm owner". No rates, no dollar amounts, no invoice notes anywhere (pages, pop-ups, alerts).
   - Defaults: manager approves time sheets + orders crew; supervisor orders crew, does not approve (owner can change per person).
     Both can ask to change hours. Reminder settings, agreement and rates stay with the owner.
   - Server (migration 025a): RLS gives these logins 0 rows from invoices, rates, client files, signatures, the farm account row,
     invoice notes and stored files; approvals / orders checked too. Live switch: store-config farmRoles:true (only AFTER 025a). */
(function(){'use strict';
if(typeof NAV==='undefined'||!NAV.firm||typeof VIEWS==='undefined')return;
if(window.REG_LIVE&&!(window.REG_STORE&&window.REG_STORE.farmRoles))return;
var LIVE=!!window.REG_LIVE;
var ROLES={manager:'Manager',supervisor:'Supervisor'};
var FR_OK=['#/home','#/orders','#/timesheets','#/profile','#/alerts','#/terms','#/pending','#/changepw','#/frhidden'];
function frDefault(role){return {approve:role==='manager',order:true};}
function frLogin(){return (typeof clLoginOf==='function')?clLoginOf(ME):ME;}
function frRoleOf(u){return u&&u.type==='firm'&&ROLES[u.farmRole]?u.farmRole:null;}
function frLimited(){return !!(ME&&ME.type==='firm'&&frRoleOf(frLogin()));}
function frPerms(u){return Object.assign(frDefault(u.farmRole),u.farmPerms||{});}
function frCan(w){return frLimited()?!!frPerms(frLogin())[w]:true;}
function frMain(){if(!ME||ME.type!=='firm'||frLimited())return false;var l=frLogin();return !l.loginOf||l.loginRole==='Owner';}
function frClient(){var l=frLogin();return l&&l.loginOf?(typeof clResolve==='function'?clResolve(l.loginOf):user(l.loginOf)):ME;}
function frMoneyText(t){t=String(t||'');return /\$\s?\d|\d\s?\$/.test(t)||/\b(invoice|invoices|rate|rates|billing|billed|credit note|top-up|HST)\b/i.test(t);}
window.frLimited=frLimited;window.frCan=frCan;window.frMain=frMain;window.frMoneyText=frMoneyText;

/* ---------- tabs and routes ---------- */
var BASE_NAV=NAV.firm;
Object.defineProperty(NAV,'firm',{configurable:true,enumerable:true,
  get:function(){if(frLimited())return BASE_NAV.filter(function(n){return FR_OK.indexOf(n[0])>=0;}).concat([['#/frhidden','']]);
    return frMain()?BASE_NAV.concat([['#/team','']]):BASE_NAV;},
  set:function(v){BASE_NAV=v;}});
if(typeof fhTabs==='function'){var ofh=fhTabs;fhTabs=function(nav,h,u){return ofh((nav||[]).filter(function(n){return n[0]!=='#/team'&&n[0]!=='#/frhidden';}),h,u);};}
var og=gateRoute;gateRoute=function(h){var r=og(h);if(!ME||ME.type!=='firm')return r;
  if(frLimited()&&r.indexOf('#/')===0&&FR_OK.indexOf(r)<0){PAGE_STATE.frWas=r;return '#/frhidden';}
  if((r==='#/team'&&!frMain())||(r==='#/frhidden'&&!frLimited()))return '#/home';return r;};
VIEWS['firm:frhidden']=function(){var w=PAGE_STATE.frWas||'',inv=/invoice/.test(w);
  return '<h1>'+(inv?'Invoices':'This page')+' – for the farm owner</h1><div class="card fr-hidden" id="frhidden"><p><b>'+(inv?'Invoices, rates and amounts':'This page')+' are only for the farm owner.</b></p>'+
    '<p>Your login ('+esc(ROLES[frRoleOf(frLogin())]||'')+') is for crews, hours, time sheets and crew orders. Ask the farm owner if you need something here.</p><p><a class="btn" href="#/home">Back to Home</a></p></div>';};

/* ---------- actions a team login can't use (the database refuses them too) ---------- */
var NO_ALWAYS='firmsign firmagrpub firmagrdl firmagrprint civview civprint civdl clientinvpaid pastinvview pastinvdl tuunpay farmratesmodal'.split(' ');
var NO_ORDER='crewOrder crewOrderEdit crewOrderCancel crewOrderCancelAll cobook codates codecnone coedit cocancel cocancelall'.split(' ');
var NO_APPROVE=['tsokday','tsokweek'];
var oaa=actionAllowed;actionAllowed=function(name,kind){if(frLimited()){if(NO_ALWAYS.indexOf(name)>=0)return false;if(!frCan('order')&&NO_ORDER.indexOf(name)>=0)return false;
    if(!frCan('approve')&&NO_APPROVE.indexOf(name)>=0)return false;if(/^fr(t|team)/.test(name))return false;}
  if(/^frteam/.test(name)&&!frMain())return false;return oaa(name,kind);};
var odn=denied;denied=function(name){if(frLimited()){toast(NO_APPROVE.indexOf(name)>=0?'Approving time sheets is for the farm owner or a manager.':NO_ORDER.indexOf(name)>=0?'Ordering crew is turned off for your login. Ask the farm owner.':'This is for the farm owner.');return;}return odn(name);};

/* ---------- a team login never gets invoices, rates, signed agreement, money notes (same as the database gives it) ---------- */
var FR_SW=null,FR_K=['clientInvoices','clientInvoicesDel','clientFiles','farmRates','firmSigs','notes'];
function swapOn(){if(FR_SW||!frLimited())return false;var keep={};FR_K.forEach(function(k){keep[k]=DB[k];});FR_SW=keep;
  DB.clientInvoices=[];DB.clientInvoicesDel=[];
  /* agreement signed + rate version (so hours and crew orders work) – never the amounts or the signed text */
  DB.farmRates=(keep.farmRates||[]).map(function(r){return r.teamStub?r:{id:r.id,firmId:r.firmId,version:r.version,effective:r.effective,rates:{},overtime:0,other:null,hst:r.hst,teamStub:true};});
  DB.firmSigs=(keep.firmSigs||[]).map(function(x){return x.teamStub?x:{id:x.id,firmId:x.firmId,version:x.version,rateVersion:x.rateVersion,at:x.at,teamStub:true};});
  DB.clientFiles=(keep.clientFiles||[]).filter(function(f){return f&&f.kind==='timesheet';}).map(function(f){return Object.assign({},f,{amount:null,number:''});});
  DB.notes=(keep.notes||[]).filter(function(n){return !frMoneyText(n&&n.text);});return true;}
function swapOff(){if(!FR_SW)return;var keep=FR_SW;FR_SW=null;FR_K.forEach(function(k){if(keep[k]===undefined)delete DB[k];else DB[k]=keep[k];});}
function frSwap(fn,self,args){var on=swapOn();try{return fn.apply(self,args);}finally{if(on)swapOff();}}
/* every screen and pop-up is built with the money-free lists (synchronously; nothing async ever sees them), and save() always
   writes the real lists */
Object.keys(VIEWS).forEach(function(k){var v=VIEWS[k];if(typeof v!=='function')return;VIEWS[k]=function(){return frSwap(v,this,arguments);};});
var omo=modal;modal=function(){return frSwap(omo,this,arguments);};
var osv=save;save=function(){var was=!!FR_SW;swapOff();try{return osv.apply(this,arguments);}finally{if(was)swapOn();}};
/* text: amounts -> "–", invoice sentences and owner-only controls removed */
var MONEY=/(-?\$\s?\d[\d,]*(\.\d+)?|\d[\d,]*\.\d{2}\s?\$)/g;
function frWalk(root){if(!frLimited()||!root||!root.querySelectorAll)return;
  [].forEach.call(root.querySelectorAll('.ts-note'),function(n){if(/invoice/i.test(n.textContent))n.textContent='Approving tells the office the hours look right. The office still approves pay separately.';});
  var rem=root.querySelector('#tsrem');if(rem){var p=rem.closest('label')?rem.closest('label').parentNode:rem.parentNode;if(p&&p!==root)p.style.display='none';rem.disabled=true;}
  if(!frCan('approve'))[].forEach.call(root.querySelectorAll('[data-act=tsokday],[data-act=tsokweek]'),function(b){var s=document.createElement('span');s.className='small muted fr-noapprove';s.textContent='Approval: farm owner or a manager';b.replaceWith(s);});
  if(!frCan('order'))[].forEach.call(root.querySelectorAll('a[href="#/orders?new=1"],[data-act=coopen],[data-act=coedit],[data-act=cocancel],form[data-form=crewOrder]'),function(b){b.style.display='none';});
  [].forEach.call(root.querySelectorAll('#sect-agr,#firmagr,.fh-stat-money,[data-fr-money]'),function(e){e.style.display='none';});
  [].forEach.call(root.querySelectorAll('.trow'),function(r){if(/rate|amount|bill(ed|ing)? /i.test(r.textContent)&&/×|rate/i.test(r.textContent))r.style.display='none';});
  [].forEach.call(root.querySelectorAll('th'),function(th){if(/amount|rate|\$/i.test(th.textContent)){var t=th.closest('table'),i=[].indexOf.call(th.parentNode.children,th);if(t)[].forEach.call(t.rows,function(r){if(r.cells[i])r.cells[i].style.display='none';});}});
  [].forEach.call(root.querySelectorAll('.fh-stat'),function(st){if(/\$|amount|billing|bill\b/i.test(st.textContent))st.style.display='none';});
  [].forEach.call(root.querySelectorAll('a[href^="#/invoices"],[data-act=civview],[data-act=firmagrdl],[data-act=firmagrprint],[data-act=farmratesmodal]'),function(a){a.style.display='none';});
  [].forEach.call(root.querySelectorAll('details'),function(d){var su=d.querySelector('summary');if(su&&/invoice|interest|agreement|\brates?\b/i.test(su.textContent))d.style.display='none';});
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),list=[],n;while((n=w.nextNode()))list.push(n);
  list.forEach(function(t){if(/^\s*(HST\b|Total to pay|Amount\b|Interest\b|Credit\b|Rate\b)/i.test(t.nodeValue)&&t.parentNode){var e=t.parentNode,r=e.closest('tr')||(e.parentNode&&e.parentNode!==root?e.parentNode:e);if(r&&!/^(MAIN|BODY|SECTION)$/.test(r.nodeName))r.style.display='none';}});
  list.forEach(function(t){var p=t.parentNode;if(!p||/^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName))return;var s=t.nodeValue;MONEY.lastIndex=0;
    if(MONEY.test(s)){MONEY.lastIndex=0;t.nodeValue=s.replace(MONEY,'–');}});}
var oar=afterRender;afterRender=function(root){oar(root);try{frWalk(root);frTeamLinks(root);}catch(e){console.warn('farmroles',e);}};
/* anything written later (count-up animations, live refresh) is scrubbed too */
var FR_MO=null;function frObserve(){if(FR_MO||typeof MutationObserver==='undefined')return;FR_MO=new MutationObserver(function(){if(!frLimited())return;FR_MO.disconnect();try{frWalk(document.getElementById('app'));var m=document.getElementById('modal');if(m)frWalk(m);}catch(e){}FR_MO.observe(document.body,{subtree:true,childList:true,characterData:true});});
  FR_MO.observe(document.body,{subtree:true,childList:true,characterData:true});}
if(document.body)frObserve();else document.addEventListener('DOMContentLoaded',frObserve);
/* CSV downloads for a team login: no money columns or rows */
function frCsvParse(t){var rows=[],row=[],f='',q=false;for(var i=0;i<t.length;i++){var c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
  else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}row.push(f);rows.push(row);return rows;}
function frCsvClean(text){var rows=frCsvParse(String(text)),drop={},out=[];
  rows.forEach(function(r,k){if(k===0||!(rows[k-1]||[]).join('').trim()){drop={};r.forEach(function(c,i){if(/^(amount|rate|rates|hst|total \$|\$|bill rate|invoice)/i.test(String(c).trim()))drop[i]=1;});}
    if(/^(HST|Total to pay|Invoice|Credit)/i.test(String(r[0]||'').trim()))return;
    out.push(r.filter(function(c,i){return !drop[i];}).map(function(c){c=String(c).replace(/\$\s?\d[\d,]*(\.\d+)?/g,'–');return /[",\n]/.test(c)?'"'+c.replace(/"/g,'""')+'"':c;}).join(','));});
  return out.join('\n');}
window.frCsvClean=frCsvClean;
if(typeof downloadText==='function'){var odt=downloadText;downloadText=function(name,text,mime){if(frLimited()&&(/csv/i.test(mime||'')||/\.csv$/i.test(name||'')))text=frCsvClean(text);return odt.call(this,name,text,mime);};}
/* toasts with money for a team login */
if(typeof toast==='function'){var otz=toast;toast=function(m){if(frLimited()&&frMoneyText(m))m='Saved.';return otz.apply(this,[m].concat([].slice.call(arguments,1)));};}

/* ---------- farm owner: Team ---------- */
/* ---------- icons (same line style as the farm tabs: 24px grid, 2px round strokes) ---------- */
var FR_IC={team:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.6a5 5 0 0 1 4.5 5.4"/>',
  owner:'<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',manager:'<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 13h18"/>',
  supervisor:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',phone:'<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',key:'<circle cx="8" cy="15" r="4"/><path d="m10.8 12.2 9.2-9.2"/><path d="m17 6 3 3"/><path d="m14 9 2 2"/>',
  link:'<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  check:'<path d="m5 12.5 4.5 4.5L19 7.5"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  truck:'<path d="M3 6h11v10H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="2"/><circle cx="17.5" cy="18" r="2"/>',
  shield:'<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="M9 12h6"/>',remove:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 11h6"/>',
  edit:'<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',send:'<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>'};
function frI(k,c){return '<svg class="fr-ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(FR_IC[k]||'')+'</svg>';}
function frBadge(role){var t={owner:'Owner',manager:'Manager',supervisor:'Supervisor'}[role]||role;return '<span class="fr-badge fr-b-'+esc(role)+'">'+frI(role)+'<span>'+esc(t)+'</span></span>';}
function frAvatar(name,role){var n=String(name||'?').trim().split(/\s+/),ini=((n[0]||'?')[0]+((n[1]||'')[0]||'')).toUpperCase();return '<span class="fr-av fr-av-'+esc(role)+'" aria-hidden="true">'+esc(ini)+'</span>';}
/* entry point on Home and Profile: same button as "Change" (small · sec), right side of a row, like the time sheet rows */
function frTeamLinks(root){if(!frMain()||!root||!root.querySelector)return;var h=(location.hash||'#/home').split('?')[0],m=root.querySelector('main');if(!m||m.querySelector('#frteamlink'))return;
  if(h!=='#/profile'&&h!=='#/home'&&h!=='#/')return;var n=frPeopleMock?((LIVE?((PAGE_STATE.frTeam&&PAGE_STATE.frTeam.d.people)||[]):frPeopleMock(frClient())).length):0;
  var d=document.createElement('div');d.className='card fr-entry';d.id='frteamlink';
  d.innerHTML='<div class="fr-entry-ic">'+frI('team')+'</div><div class="fr-entry-tx"><b>Team</b><span class="small muted">'+(n?n+(n===1?' manager or supervisor':' managers and supervisors'):'Add your managers and supervisors')+' · no invoices or amounts</span></div>'+
    '<button type="button" class="small sec fr-entry-btn" data-act="frteamgo" id="frteambtn">'+(n?'Manage':'Add people')+'</button>';
  if(h==='#/profile')m.insertBefore(d,m.children[1]||null);else{var a=m.querySelector('#fhtimesheets,.fh-ts');if(a&&a.parentNode)a.parentNode.insertBefore(d,a.nextSibling);else m.appendChild(d);}}
ACT.frteamgo=function(){location.hash='#/team';};
function frPeopleMock(c){return (DB.users||[]).filter(function(u){return u.type==='firm'&&u.loginOf===c.id&&frRoleOf(u);})
  .map(function(u){return {id:u.id,name:u.name,email:u.email||'',phone:u.phone||'',username:u.username||'',role:u.farmRole,perms:frPerms(u),active:u.active!==false&&u.loginOf===c.id&&u.accountApproved!==false};});}
function frInvitesMock(c){return (DB.clientInvites||[]).filter(function(i){return i.clientId===c.id&&i.byFarm;}).map(function(i){return {id:i.id,last4:i.last4,expires:i.expires,used:!!i.usedBy,revoked:!!i.revokedAt,role:i.farmRole,name:i.inviteName,contact:i.inviteContact,createdAt:i.createdAt};});}
function frTeamData(){var c=frClient();if(!LIVE)return {people:frPeopleMock(c),invites:frInvitesMock(c)};
  if(PAGE_STATE.frTeam&&Date.now()-PAGE_STATE.frTeam.at<15000)return PAGE_STATE.frTeam.d;
  if(!PAGE_STATE.frTeamBusy){PAGE_STATE.frTeamBusy=1;window.REG_SB.rpc('reg_farm_team').then(function(r){PAGE_STATE.frTeamBusy=0;if(r.error){toast(r.error.message);return;}
    var d=r.data||{};d.people=(d.people||[]).filter(function(p){return ROLES[p.role];}).map(function(p){p.perms=Object.assign(frDefault(p.role),p.perms||{});return p;});PAGE_STATE.frTeam={at:Date.now(),d:d};render();});}
  return (PAGE_STATE.frTeam&&PAGE_STATE.frTeam.d)||{people:[],invites:[],loading:true};}
function yn(b,lab,ic){return '<span class="fr-perm '+(b?'fr-on':'fr-offp')+'">'+frI(b?'check':'x')+'<span>'+esc(lab)+'</span></span>';}
function istate(i){return i.used?['Used','s-mut']:i.revoked?['Cancelled','s-mut']:(i.expires<today()?['Expired','s-bad']:['Waiting · until '+i.expires,'s-pend']);}
function frEmpty(){return '<div class="fr-empty" id="frempty"><svg class="fr-art" viewBox="0 0 160 96" aria-hidden="true" focusable="false">'+
  '<rect x="8" y="70" width="144" height="10" rx="5" fill="#ece9f6"/>'+
  '<circle cx="56" cy="34" r="14" fill="#fbf1de" stroke="#D9A03C" stroke-width="2.5"/><path d="M32 72a24 24 0 0 1 48 0" fill="#fbf1de" stroke="#D9A03C" stroke-width="2.5"/>'+
  '<circle cx="104" cy="38" r="11" fill="#ece9f6" stroke="#332E57" stroke-width="2.5"/><path d="M85 72a19 19 0 0 1 38 0" fill="#ece9f6" stroke="#332E57" stroke-width="2.5"/>'+
  '<circle cx="132" cy="22" r="10" fill="#fff" stroke="#332E57" stroke-width="2.5"/><path d="M132 17v10M127 22h10" stroke="#332E57" stroke-width="2.5" stroke-linecap="round"/></svg>'+
  '<b>No managers or supervisors yet</b><span class="small muted">Invite the people who run your crews. They see hours and orders – never invoices or amounts.</span></div>';}
function frPersonCard(p,k){var you=p.owner;
  return '<div class="fr-person fr-rise'+(you?' fr-me':'')+'" style="--fr-d:'+(k*60)+'ms" data-person="'+esc(p.username||p.email||p.id)+'">'+frAvatar(p.name,p.role)+
    '<div class="fr-pmain"><div class="fr-pname"><b>'+esc(p.name||'')+'</b>'+frBadge(p.role)+(you?'<span class="small muted">You</span>':'')+'</div>'+
    '<div class="fr-contact small muted">'+(p.email?frI('mail','fr-ic-sm')+'<span>'+esc(p.email)+'</span>':'')+(p.phone?frI('phone','fr-ic-sm')+'<span>'+esc(p.phone)+'</span>':'')+(!p.email&&!p.phone&&p.username?'<span>'+esc(p.username)+'</span>':'')+'</div>'+
    (you?'<div class="fr-perms"><span class="fr-perm fr-on">'+frI('check')+'<span>Everything, incl. invoices</span></span></div>':'<div class="fr-perms">'+yn(p.perms.approve,'Approves time sheets')+yn(p.perms.order,'Orders crew')+yn(false,'Invoices & amounts')+'</div>')+'</div>'+
    (you?'':'<div class="fr-pact"><button type="button" class="small sec" data-act="frteamedit" data-id="'+esc(p.id)+'">Change</button><button type="button" class="small sec fr-danger" data-act="frteamrm" data-id="'+esc(p.id)+'">Remove</button></div>')+'</div>';}
VIEWS['firm:team']=function(){var D=frTeamData(),P=D.people||[],I=(D.invites||[]).filter(function(i){return !i.used&&!i.revoked;}),me=frLogin();
  var x='<div class="fr-head fr-rise"><div class="fr-head-ic">'+frI('team')+'</div><div><h1>Team</h1><div class="muted fr-sub">Your managers and supervisors, each with their own login for <b>'+esc(frClient().name||'your farm')+'</b>.</div></div></div>';
  x+='<div class="fr-sees fr-rise" style="--fr-d:60ms"><div class="fr-see">'+frI('clock')+'<span>Hours &amp; time sheets</span></div><div class="fr-see">'+frI('truck')+'<span>Crew orders</span></div><div class="fr-see fr-see-no">'+frI('shield')+'<span>No invoices, rates or amounts</span></div></div>';
  x+='<div class="card fr-card" id="frteam"><div class="fr-card-h">'+frI('team')+'<h2>People</h2><span class="fr-count">'+(P.length+1)+'</span></div><div class="fr-people">'+
    frPersonCard({id:'me',owner:true,name:me.name||frClient().name,email:me.email||'',phone:me.phone||'',role:'owner'},0)+
    (D.loading?'<p class="muted">Loading…</p>':P.map(function(p,k){return frPersonCard(p,k+1);}).join(''))+'</div>'+(!D.loading&&!P.length?frEmpty():'')+'</div>';
  if(I.length)x+='<div class="card fr-card" id="frinvs"><div class="fr-card-h">'+frI('send')+'<h2>Invites waiting</h2><span class="fr-count">'+I.length+'</span></div><div class="fr-invs">'+I.map(function(i,k){var s=istate(i);
    return '<div class="fr-inv fr-rise" style="--fr-d:'+(k*60)+'ms" data-inv="'+esc(i.id)+'">'+frAvatar(i.name,i.role)+'<div class="fr-pmain"><div class="fr-pname"><b>'+esc(i.name||'')+'</b>'+frBadge(i.role)+'<span class="pill '+s[1]+'">'+esc(s[0])+'</span></div>'+
      '<div class="fr-contact small muted">'+frI(/@/.test(i.contact||'')?'mail':'phone','fr-ic-sm')+'<span>'+esc(i.contact||'')+'</span>'+frI('key','fr-ic-sm')+'<span>••••-'+esc(i.last4||'')+'</span></div></div>'+
      (s[1]==='s-pend'?'<div class="fr-pact"><button type="button" class="small sec fr-danger" data-act="frteamrevoke" data-id="'+esc(i.id)+'">Cancel</button></div>':'')+'</div>';}).join('')+'</div></div>';
  x+='<div class="card fr-card" id="frinvite"><div class="fr-card-h">'+frI('plus')+'<h2>Invite a manager or supervisor</h2></div><form data-form="frteaminvite" id="frinvform"><div class="grid2">'+
    inp('name','Name','',{req:true})+inp('contact','Email or mobile phone','',{req:true})+'</div>'+
    '<div class="fr-roles" role="radiogroup" aria-label="Role"><label class="fr-role"><input type="radio" name="role" value="manager" checked><span class="fr-role-c">'+frI('manager')+'<b>Manager</b><span class="small muted">Approves time sheets, orders crew</span></span></label>'+
    '<label class="fr-role"><input type="radio" name="role" value="supervisor"><span class="fr-role-c">'+frI('supervisor')+'<b>Supervisor</b><span class="small muted">Orders crew, sees hours</span></span></label></div>'+
    '<div class="fr-checks"><label class="chk"><input type="checkbox" name="approve" id="frapprove" checked> Can approve time sheets</label><label class="chk"><input type="checkbox" name="order" checked> Can order crew</label></div>'+
    '<div class="small muted fr-note">'+frI('shield','fr-ic-sm')+'<span>You get a one-time code and link to send yourself – the app sends nothing. The office checks the sign-up, usually the same day.</span></div><div class="row-end"><button id="frinvgo">Make invite</button></div></form></div>';
  return '<div class="fr-page">'+x+'</div>';};
document.addEventListener('change',function(e){var t=e.target;if(t&&t.name==='role'&&t.form&&/^fr(invform|editform)$/.test(t.form.id)&&(t.type!=='radio'||t.checked)){var a=t.form.querySelector('[name=approve]');if(a)a.checked=t.value==='manager';}});
function done(msg){PAGE_STATE.frTeam=null;if(msg)toast(msg);if(LIVE&&window.REG_REFRESH)try{window.REG_REFRESH();}catch(e){}render();}
function rpc(name,args,ok){window.REG_SB.rpc(name,args).then(function(r){if(r.error){toast(r.error.message||'Not saved.');return;}ok();});}
FORMS.frteaminvite=function(f,d){if(!frMain())return denied('frteaminvite');var name=String(d.name||'').trim(),ct=String(d.contact||'').trim(),role=ROLES[d.role]?d.role:'manager';
  var em=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ct),ph=ct.replace(/\D/g,'').length>=10&&!/[a-z]/i.test(ct);
  if(name.length<2){toast('Enter their name.');return;}if(!em&&!ph){toast('Enter an email address or a mobile number (10 digits).');return;}
  var c=frClient(),code=clGenCode(),id=uid('finv'),perms={approve:!!d.approve,order:!!d.order},url=clSignupUrl(code);
  var show=function(exp){var msg='Hi '+name+', you are invited to UnScramble for '+(c.name||'our farm')+' as '+ROLES[role]+'. Sign up here: '+url+' (code '+code+').';
    modal('<div class="fr-modal"><div class="fr-mh">'+frI('send','fr-ic-lg')+'<div><h2>Invite ready for '+esc(name)+'</h2>'+frBadge(role)+'</div></div>'+
      '<div class="fr-code-card" id="frinvbox"><div class="fr-code-l">'+frI('key','fr-ic-sm')+'<span>One-time code · valid until '+esc(exp)+'</span></div><div class="fr-code" id="frinvcode">'+esc(code)+'</div>'+clCopyBtn(code,'Copy code','frcopycode')+
      '<div class="fr-code-l">'+frI('link','fr-ic-sm')+'<span>Sign-up link</span></div><div class="fr-url">'+esc(url)+'</div>'+clCopyBtn(url,'Copy link','frcopylink')+'</div>'+
      '<div class="fr-send">'+(em?'<a class="btn fr-sendbtn" id="frmail" href="mailto:'+esc(ct)+'?subject='+encodeURIComponent('Your UnScramble login')+'&body='+encodeURIComponent(msg)+'">'+frI('mail')+'<span>Open email to '+esc(ct)+'</span></a>':'<a class="btn fr-sendbtn" id="frsms" href="sms:'+esc(ct.replace(/[^\d+]/g,''))+'?&body='+encodeURIComponent(msg)+'">'+frI('phone')+'<span>Open text to '+esc(ct)+'</span></a>')+'</div>'+
      '<div class="small muted fr-note">'+frI('shield','fr-ic-sm')+'<span>Shown once only. The app sends nothing – your own email or text app opens with the message ready. '+esc(name)+' sees crews, hours, time sheets and crew orders, <b>never invoices, rates or amounts</b>.</span></div><div class="row-end"><button class="sec" data-act="closeModal">Done</button></div></div>');};
  if(LIVE){rpc('reg_farm_team_invite',{p_id:id,p_code_hash:clCodeHash(code),p_last4:code.slice(-4),p_days:14,p_role:role,p_name:name,p_contact:ct,p_approve:perms.approve,p_order:perms.order},function(){done();show(addDays(today(),14));});return;}
  var i={id:id,clientId:c.id,codeHash:clCodeHash(code),last4:code.slice(-4),createdAt:new Date().toISOString(),createdBy:frLogin().name||c.name,expires:addDays(today(),14),days:14,usedBy:'',usedAt:'',revokedAt:'',
    byFarm:true,farmRole:role,farmPerms:perms,inviteName:name,inviteContact:ct};
  (DB.clientInvites=DB.clientInvites||[]).push(i);audit('Farm invited a team member',c.name,name+' · '+ROLES[role]+' · code ending '+i.last4);save();done();show(i.expires);};
ACT.frteamedit=function(el){if(!frMain())return;var p=(frTeamData().people||[]).filter(function(x){return String(x.id)===el.dataset.id;})[0];if(!p)return;
  modal('<div class="fr-modal"><div class="fr-mh">'+frAvatar(p.name,p.role)+'<div><h2>Change '+esc(p.name||'')+'</h2>'+frBadge(p.role)+'</div></div><form data-form="frteamset" id="freditform"><input type="hidden" name="id" value="'+esc(p.id)+'">'+
    '<div class="fr-roles" role="radiogroup" aria-label="Role"><label class="fr-role"><input type="radio" name="role" value="manager"'+(p.role==='manager'?' checked':'')+'><span class="fr-role-c">'+frI('manager')+'<b>Manager</b></span></label><label class="fr-role"><input type="radio" name="role" value="supervisor"'+(p.role==='supervisor'?' checked':'')+'><span class="fr-role-c">'+frI('supervisor')+'<b>Supervisor</b></span></label></div>'+
    '<div class="fr-checks"><label class="chk"><input type="checkbox" name="approve"'+(p.perms.approve?' checked':'')+'> Can approve time sheets</label><label class="chk"><input type="checkbox" name="order"'+(p.perms.order?' checked':'')+'> Can order crew</label></div>'+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button>Save</button></div></form></div>');};
FORMS.frteamset=function(f,d){if(!frMain())return denied('frteamset');var role=ROLES[d.role]?d.role:'manager',ap=!!d.approve,or=!!d.order;
  if(LIVE){rpc('reg_farm_team_set',{p_login:d.id,p_role:role,p_approve:ap,p_order:or},function(){closeModal();done('Saved.');});return;}
  var u=user(d.id),c=frClient();if(!u||u.loginOf!==c.id||!frRoleOf(u)){toast('Not one of your team.');return;}
  u.farmRole=role;u.farmPerms={approve:ap,order:or};u.loginRole=ROLES[role];audit('Farm changed a team member',c.name,u.name+' · '+ROLES[role]+' · approve '+(ap?'yes':'no')+' · order '+(or?'yes':'no'));save();closeModal();done('Saved.');};
ACT.frteamrm=function(el){if(!frMain())return;var p=(frTeamData().people||[]).filter(function(x){return String(x.id)===el.dataset.id;})[0];if(!p)return;
  modal('<div class="fr-modal fr-rm"><div class="fr-rm-art">'+frI('remove','fr-ic-xl')+'</div><h2>Remove '+esc(p.name||'')+'?</h2><div class="fr-rm-b">'+frBadge(p.role)+'</div>'+
    '<div><ul class="fr-rm-list"><li>'+frI('x','fr-ic-sm')+'<span>Can\'t sign in to your farm any more – right away</span></li><li>'+frI('check','fr-ic-sm')+'<span>Past approvals and crew orders stay</span></li><li>'+frI('plus','fr-ic-sm')+'<span>You can invite them again any time</span></li></ul></div>'+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Keep</button><button type="button" class="danger" data-act="frteamrmgo" data-id="'+esc(p.id)+'" id="frrmgo">Remove</button></div></div>');};
ACT.frteamrmgo=function(el){if(!frMain())return;var id=el.dataset.id;
  if(LIVE){rpc('reg_farm_team_remove',{p_login:id,p_reason:'Removed by the farm'},function(){closeModal();done('Removed.');});return;}
  var u=user(id),c=frClient();if(!u||u.loginOf!==c.id||!frRoleOf(u)){toast('Not one of your team.');return;}
  var at=new Date().toISOString(),who=frLogin().name||c.name;u.unlinkedFrom=c.id;u.unlinkedAt=at;u.unlinkedBy=who;u.unlinkReason='Removed by the farm';u.teamRemovedAt=at;u.teamRemovedBy=who;u.loginOf=null;u.active=false;
  audit('Farm removed a team member',c.name,u.name+' · '+ROLES[u.farmRole]);save();closeModal();done('Removed.');};
ACT.frteamrevoke=function(el){if(!frMain())return;var id=el.dataset.id;
  if(LIVE){rpc('reg_farm_team_revoke',{p_invite:id},function(){done('Invite cancelled.');});return;}
  var i=(DB.clientInvites||[]).filter(function(x){return x.id===id&&x.byFarm&&x.clientId===frClient().id;})[0];if(!i||i.usedBy||i.revokedAt)return;i.revokedAt=new Date().toISOString();audit('Farm cancelled an invite',frClient().name,i.inviteName+' · code ending '+i.last4);save();done('Invite cancelled.');};

/* office links a sign-up that used a farm invite: the role comes from the invite */
if(typeof clLink==='function'){var ocl=clLink;clLink=function(login,client,o){var inv=o&&o.inviteId?(DB.clientInvites||[]).filter(function(x){return x.id===o.inviteId;})[0]:null;
  if(inv&&inv.byFarm)o=Object.assign({},o,{role:ROLES[inv.farmRole]});var err=ocl(login,client,o);
  if(!err&&inv&&inv.byFarm&&ROLES[inv.farmRole]){login.farmRole=inv.farmRole;login.farmPerms=Object.assign(frDefault(inv.farmRole),inv.farmPerms||{});save();}return err;};}
if(typeof CL_ROLES!=='undefined'&&CL_ROLES.indexOf('Supervisor')<0)CL_ROLES.splice(2,0,'Supervisor');
})();
