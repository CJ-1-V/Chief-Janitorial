/* officehelper1 – "Office Assistant": a second office login (owner, Oct 9 2026 12:13 PM / 12:14 PM).
   The assistant does almost everything the office does (onboarding, offboarding, hours, late entries, crew orders, documents,
   training, alerts) but never sees real farm names / contacts / addresses / farm phone, farm rates, invoice amounts, SIN, bank,
   date of birth or immigration documents. Farms show as "Farm <code>" (e.g. Farm NAF264).
   - LIVE: the database does the masking (migration 016u: reg_helper_snapshot / reg_helper_save; direct table access is refused).
     This file only routes the assistant's reads/writes to those two functions and tidies the screens.
   - MOCK (?store=mock): the same screens, masked here in the browser (test login: assistant / test1234).
   - Full office: new page "Office Assistant" (create, switch off/on, reset password, 4 owner settings, "Needs your OK",
     "Assistant changes this week", last login + device) and a "Assistant changes this week" card on Overview.
   Loaded right before v2-nohome.js (still last). Turn off: remove the script tag. */
(function(){
'use strict';
if(typeof layout!=='function'||typeof NAV==='undefined')return;
function LIVE(){return !!window.REG_LIVE;}
/* live switch: store-config officeHelper:true (set only AFTER migration 016u). Off = this file does nothing in live. */
if(window.REG_LIVE&&!(window.REG_STORE&&window.REG_STORE.officeHelper))return;
var DEF_OPTS={showPay:false,cap:false,capHours:2,capDays:14,csv:true,farmPhone:false,secrets:false};
function ohIs(u){u=u||(typeof ME!=='undefined'?ME:null);return !!(u&&u.type==='admin'&&(u.officeRole==='helper'||(u.officeRoles||[]).indexOf('helper')>=0));}
function ohFull(){return !!(ME&&ME.type==='admin'&&!ohIs());}
function ohOpts(){return Object.assign({},DEF_OPTS,LIVE()?((window.OH_ME||{}).opts||{}):((ME&&ME.ohOpts)||{}));}
window.ohIs=ohIs;window.ohOpts=ohOpts;

/* ---------- routes: whitelist for the assistant (any new office page stays closed until added here) ---------- */
var OH_OK=['#/home','#/review','#/people','#/addperson','#/documents','#/compliance','#/missingdocs','#/training','#/lateentries','#/manualtime',
  '#/allhours','#/payroll','#/farmchanges','#/creworders','#/crewcoming','#/shiftsadmin','#/invoicesadmin','#/recordsadmin','#/alerts',
  '#/feedbackadmin','#/privacy','#/ohhidden'];
var OH_LABEL={'#/invoicesadmin':'Invoices (status)','#/payroll':'Payroll hours'};
var BASE_NAV=NAV.admin;
Object.defineProperty(NAV,'admin',{configurable:true,enumerable:true,
  get:function(){if(ohIs())return BASE_NAV.filter(function(n){return OH_OK.indexOf(n[0])>=0;}).map(function(n){return OH_LABEL[n[0]]?[n[0],OH_LABEL[n[0]]]:n;}).concat([['#/ohhidden','']]);return BASE_NAV;},
  set:function(v){BASE_NAV=v;}});
if(!BASE_NAV.some(function(n){return n[0]==='#/assistants';}))BASE_NAV.push(['#/assistants','Office Assistant']);
var og=gateRoute;gateRoute=function(h){var r=og(h);if(!ohIs())return r==='#/ohhidden'?'#/home':r;
  if(r==='#/assistants'||(r.indexOf('#/')===0&&OH_OK.indexOf(r)<0&&['#/terms','#/profile','#/alerts','#/pending','#/changepw','#/quiz','#/quizresult'].indexOf(r)<0)){PAGE_STATE.ohWas=r;return '#/ohhidden';}
  return r;};
VIEWS['admin:ohhidden']=function(){var w=PAGE_STATE.ohWas||'';return '<h1>Farm details hidden</h1><div class="card oh-hidden" id="ohhidden"><p class="oh-grey"><b>Farm details hidden</b></p>'+
  '<p>This page is for the full office'+(w?' (<code>'+esc(w)+'</code>)':'')+'. You manage hours, crews and workers. Farms show as codes (like <b class="oh-code">Farm NAF264</b>) and money stays with the full office.</p>'+
  '<p><a class="btn" href="#/home">Back to Overview</a></p></div>';};

/* ---------- actions the assistant can't use (the database refuses them too) ---------- */
var OH_NO_ACT='paycsv vsinvok invreviewed invcsv invact wpcsv wpcopy wpadded wpupdated wpoverride testersoff reveal verifybank verifyempbank firmview farmratesmodal forcereset unlock toggle2fa anacsv exportall convert runalerts tempoff fcfilter clrinvite clmerge firmagrdl firmagrprint'.split(' ');
var OH_NO_FORM='emppay adminpw publish settings consentver mkt newfirm firmrate farmrates addsite wpreauth wpoverride reauthreveal roledocs icsafee cbset newrec'.split(' ');
var oaa=actionAllowed;actionAllowed=function(name,kind){if(ohIs()){if(kind==='act'&&OH_NO_ACT.indexOf(name)>=0)return false;if(kind==='form'&&OH_NO_FORM.indexOf(name)>=0&&!(name==='emppay'&&ohOpts().showPay))return false;}return oaa(name,kind);};
var odn=denied;denied=function(name){if(ohIs()){toast('This needs the full office.');try{audit('Office Assistant: needs full office',ME.name,name);save();}catch(e){}return;}return odn(name);};

/* ---------- farm names -> "Farm CODE" ---------- */
function ohCodeOf(f){var c=f&&f.firm&&f.firm.clientCode;if(!c&&f&&(f.loginOf||f.mergedInto)&&typeof user==='function'){var k=user(f.loginOf||f.mergedInto);c=k&&k.firm&&k.firm.clientCode;}
  if(!c&&f&&typeof DB!=='undefined')c=((DB.sites||[]).filter(function(s){return s.firmId===f.id;})[0]||{}).code;return c||'?';}
var NEEDLES=null,NEEDLE_SIG='';
function ohNeedles(){var sig=(DB.users||[]).length+'|'+(DB.sites||[]).length+'|'+JSON.stringify(ohOpts().farmPhone);if(NEEDLES&&sig===NEEDLE_SIG)return NEEDLES;var m={},ph=!ohOpts().farmPhone;
  var add=function(v,l){v=String(v==null?'':v).trim();if(v.length<4||/^[a-z]+$/.test(v)||/^(Farm|Client|Worksite|Site) /.test(v)||/^(farm|client|worksite|manager|owner|other)$/i.test(v))return;if(!m[v])m[v]=l;};
  (DB.users||[]).forEach(function(f){if(f.type!=='firm')return;var lab='Farm '+ohCodeOf(f);
    [f.name,f.realName,f.username,f.email].forEach(function(v){add(v,lab);});
    ['firm','company'].forEach(function(k){var o=f[k]||{};Object.keys(o).forEach(function(x){if(/name|contact|email|addr|street|signer|title|note|gate|direction/i.test(x)&&!/^(clientType|clientCode)$/.test(x)&&typeof o[x]==='string')add(o[x],lab);
      if(/phone/i.test(x)&&ph&&typeof o[x]==='string')add(o[x],'Phone hidden. Ask the full office.');});});
    if(ph&&f.phone)add(f.phone,'Phone hidden. Ask the full office.');});
  (DB.sites||[]).forEach(function(s){['name','address','addr','contact','notes'].forEach(function(k){if(typeof s[k]==='string')add(s[k],'Farm '+s.code);});});
  NEEDLES=Object.keys(m).sort(function(a,b){return b.length-a.length;}).map(function(k){return [k,m[k]];});NEEDLE_SIG=sig;return NEEDLES;}
function ohScrub(h){if(!ohIs()||typeof h!=='string')return h;ohNeedles().forEach(function(n){if(h.indexOf(n[0])>=0)h=h.split(n[0]).join(n[1]);var e=esc(n[0]);if(e!==n[0]&&h.indexOf(e)>=0)h=h.split(e).join(esc(n[1]));});
  h=h.replace(/\bClient (?!no\b)([A-Z0-9][A-Z0-9-]{1,23})\b/g,'Farm $1').replace(/\b([A-Z0-9][A-Z0-9-]{1,23}) [–-] Farm \1\b/g,'Farm $1').replace(/Farm Farm /g,'Farm ');
  h=h.replace(/(<option[^>]*data-search=")([^"]*)(")/g,function(a,p,s,q){return p+s.replace(/farm [a-z0-9-]+|·/g,'')+q;});
  return h;}
window.ohScrub=ohScrub;
var ol=layout;layout=function(c){var x=ol(c);if(!ME||ME.type!=='admin')return x;
  if(ohIs()){x=ohScrub(x).replace(/<a href="#\/ohhidden"[^>]*>[^<]*<\/a>/g,'');
    x=x.replace(/(<div class="who">)([\s\S]*?) · <b>[^<]*<\/b>/,function(a,d,n){return d+'Signed in as <b>Office Assistant</b> · '+n;});}
  else x=x.replace(/(<div class="who">[\s\S]*?) · <b>[^<]*<\/b>/,'$1 · <b>Office (full access)</b>');
  return x;};
function ohPriv(h){if(!ohIs())return h;if(ohOpts().secrets)return ohOpts().showPay?h:String(h).replace(/(<form data-form="emppay")/,'<p class="oh-grey small">Pay rate and payroll settings stay with the full office.</p><form data-form="emppay" hidden');return String(h).replace(/<h3>Payroll \(restricted\)<\/h3><div class="kv">[\s\S]*?TD1 claim code<\/div><div>[\s\S]*?<\/div><\/div>/,'<h3>Payroll</h3><p class="oh-grey small" id="ohpriv">SIN, bank details and date of birth are hidden. Ask the full office.</p>').replace(/<form data-form="reauthreveal"[\s\S]*?<div id="revealbox"><\/div>/,'').replace(/(<form data-form="emppay")/,ohOpts().showPay?'$1':'<p class="oh-grey small">Pay rate and payroll settings stay with the full office.</p><form data-form="emppay" hidden');}
function ohT(s){var d=new Date(s);if(isNaN(d))return String(s||'');var z=function(n){return (n<10?'0':'')+n;};return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())+' '+z(d.getHours())+':'+z(d.getMinutes());}
var om=modal;modal=function(h){return om(ohIs()?ohScrub(ohPriv(h)):h);};
['firmName','siteName'].forEach(function(fn){var o=window[fn];if(typeof o!=='function')return;window[fn]=function(code){if(!ohIs())return o.apply(this,arguments);
  if(fn==='siteName')return code?'Farm '+code:'';var f=typeof siteFirm==='function'?siteFirm(code):null;return f?'Farm '+ohCodeOf(f):(code?'Farm '+code:'');};});
if(typeof clCanSeeName==='function'){var occ=clCanSeeName;clCanSeeName=function(f){return ohIs()?false:occ(f);};}
if(typeof clName==='function'){var ocn=clName;clName=function(f){return ohIs()?'Farm '+ohCodeOf(f):ocn(f);};}
/* text nodes: "Farm CODE" in bold monospace; money -> "–" (hours stay) */
var MONEY=/(-?\$\s?\d[\d,]*(\.\d+)?|\d[\d,]*\.\d{2}\s?\$)/g;
function ohWalk(root){if(!ohIs()||!root)return;var pay=ohOpts().showPay,h=(location.hash||'').split('?')[0],payPage=/^#\/(payroll|people|review)$/.test(h)||!!(root.id==='modal');
  var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT,null),list=[],n;while((n=w.nextNode()))list.push(n);
  list.forEach(function(t){var p=t.parentNode;if(!p||/^(SCRIPT|STYLE|OPTION|TEXTAREA|SELECT|TITLE)$/.test(p.nodeName)||p.closest('.oh-code,.oh-money'))return;var s=t.nodeValue;
    var hasM=(!pay||!payPage)&&MONEY.test(s);MONEY.lastIndex=0;var hasF=/\bFarm [A-Z0-9][A-Z0-9-]{1,23}\b/.test(s);if(!hasM&&!hasF)return;
    var html=esc(s);if(hasM)html=html.replace(MONEY,'<span class="oh-money" title="Amounts visible to full office only.">–</span>');
    if(hasF)html=html.replace(/\bFarm ([A-Z0-9][A-Z0-9-]{1,23})\b/g,'<b class="oh-code">Farm $1</b>');
    var span=document.createElement('span');span.innerHTML=html;p.replaceChild(span,t);});
  if((!pay||!payPage)&&root.querySelector&&root.querySelector('.oh-money')&&!root.querySelector('.oh-moneynote')){var m=root.querySelector('main')||root.querySelector('.modal');if(m){var d=document.createElement('p');d.className='small oh-grey oh-moneynote';d.textContent='Amounts visible to full office only.';m.insertBefore(d,m.firstChild);}}
  [].forEach.call(root.querySelectorAll('a[href^="tel:"]'),function(a){if(/Phone hidden/.test(a.textContent)||!ohOpts().farmPhone&&ohNeedles().some(function(x){return x[1].indexOf('Phone hidden')===0&&a.getAttribute('href').replace(/\D/g,'').slice(-10)===String(x[0]).replace(/\D/g,'').slice(-10);})){var s=document.createElement('span');s.className='oh-grey';s.textContent='Phone hidden. Ask the full office.';a.replaceWith(s);}});
  [].forEach.call(root.querySelectorAll('option'),function(o){var t=ohScrub(o.textContent);if(t!==o.textContent)o.textContent=t;});}
var oar=afterRender;afterRender=function(root){oar(root);try{ohWalk(root);}catch(e){console.warn('oh walk',e);}};

/* ---------- downloads: masked CSV only (owner setting), never invoice PDFs ---------- */
function csvParse(t){var rows=[],row=[],f='',q=false;for(var i=0;i<t.length;i++){var c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++;}else q=false;}else f+=c;}
  else if(c==='"')q=true;else if(c===','){row.push(f);f='';}else if(c==='\n'){row.push(f);rows.push(row);row=[];f='';}else if(c!=='\r')f+=c;}row.push(f);rows.push(row);return rows;}
var odl=downloadText;downloadText=function(name,text,mime){if(!ohIs())return odl(name,text,mime);
  if(!ohOpts().csv||!/csv/i.test(String(mime||''))&&!/\.csv$/i.test(name)){toast(ohOpts().csv?'This download needs the full office.':'Downloads need the full office.');audit('Office Assistant: download blocked',ME.name,name);save();return;}
  var rows=csvParse(ohScrub(String(text))),pay=ohOpts().showPay,money=[];if(rows.length){rows[0]=rows[0].map(function(h,i){if(/^(site|farm|client|department|dept)$/i.test(h.trim()))return 'Farm code';if(!pay&&/rate|amount|\$|pay\b|gross|total \$|wage|hst|bill/i.test(h))money.push(i);return h;});}
  rows=rows.map(function(r,ri){return r.map(function(v,i){if(ri&&money.indexOf(i)>=0)return '–';return String(v).replace(/^Farm ([A-Z0-9-]+)$/,'$1');});});
  audit('Office Assistant downloaded (masked)',ME.name,name);save();return odl(name,rows.map(csvRow).join('\n'),mime);};
var owo=window.open;window.open=function(){if(ohIs()&&/invoice|#\/invoice/i.test(location.hash+String(arguments[0]||''))){toast('Invoice PDFs need the full office.');return null;}return owo.apply(window,arguments);};

/* ---------- Office Assistant views ---------- */
(function(){var oh=VIEWS['admin:home'];VIEWS['admin:home']=function(){var x=oh.apply(this,arguments);
  if(ohIs()){var wel=LIVE()?localStorage.getItem('oh-welcomed-'+ME.id):ME.ohWelcomed;
    return (wel?'':'<div class="card oh-welcome" id="ohwelcome"><h3>Welcome to the UnScramble office.</h3><p>You can manage hours, crews and workers. Farms show as codes (like <b class="oh-code">Farm NAF264</b>) and money stays with the full office.</p><button class="small" data-act="ohwelcome">Got it</button> <button class="small sec" data-act="ohwelcome">Skip</button></div>')+x;}
  if(ohFull())return ohWeekCard(true)+x;return x;};})();
ACT.ohwelcome=function(){if(LIVE())localStorage.setItem('oh-welcomed-'+ME.id,'1');else{ME.ohWelcomed=true;save();}render();};
/* invoices: status only */
(function(){var oi=VIEWS['admin:invoicesadmin'];VIEWS['admin:invoicesadmin']=function(){if(!ohIs())return oi.apply(this,arguments);
  var t=today(),l=(DB.clientInvoices||[]).slice().sort(function(a,b){return String(b.issued||'').localeCompare(String(a.issued||''));});
  var rmIds=function(i){try{return typeof vsInvRemoved==='function'?vsInvRemoved(i).length:0;}catch(e){return 0;}};
  return '<h1>Invoices (status)</h1><p class="small oh-grey">Invoice amounts, rates and PDFs stay with the full office. You see the status so you can answer “has it gone out?”.</p>'+
   '<div class="tw"><table id="ohinv"><tr><th>Number</th><th>Farm code</th><th>Month</th><th>Issued</th><th>Due</th><th>Status</th></tr>'+l.map(function(i){var f=user(i.firmId),st=i.paidAt?['Paid','s-ok']:(i.due&&i.due<t?['Overdue','s-bad']:['Unpaid','s-pend']),n=rmIds(i);
     return '<tr><td>'+esc(i.number||'')+'</td><td><b class="oh-code">Farm '+esc(ohCodeOf(f))+'</b></td><td>'+esc(String(i.periodStart||'').slice(0,7))+'</td><td>'+esc(i.issued||'')+'</td><td>'+esc(i.due||'')+'</td><td><span class="pill '+st[1]+'">'+st[0]+'</span>'+
      (n&&!i.rmReviewed?' <a class="small" href="#/allhours">Includes removed hours – review</a>':'')+'</td></tr>';}).join('')+'</table></div>'+(l.length?'':'<p class="muted">No invoices yet.</p>');};})();
/* free text typed by farms */
['admin:creworders','admin:farmchanges'].forEach(function(k){var o=VIEWS[k];if(!o)return;VIEWS[k]=function(){var x=o.apply(this,arguments);return ohIs()?'<p class="small oh-grey oh-farmnote">Farm note (may include farm details) – notes and comments are shown as the farm typed them.</p>'+x:x;};});
/* Add person: no farm logins, no office accounts for the assistant */
if(VIEWS['admin:addperson']){var oap=VIEWS['admin:addperson'];VIEWS['admin:addperson']=function(){var x=oap.apply(this,arguments);if(!ohIs())return x;return x.replace(/<option value="(firm|admin)"[^>]*>[^<]*<\/option>/g,'');};}
/* manual hours / remove-restore screens check office roles in the browser: the assistant counts as office there (the DB decides) */
function ohRoles(){if(ME&&ohIs()){ME.officeRoles=['helper','payroll'];}}

/* ---------- switch off / back on with a reason (assistant) ---------- */
var OFF_REASONS=['Season ended','Quit','No-show','Documents expired'];
var otg=ACT.toggleactive;ACT.toggleactive=function(el){var u=user(el.dataset.id);if(!ohIs()||!u)return otg(el);
  if(u.type==='admin'||u.type==='firm'){toast('This needs the full office.');return;}
  if(u.active===false){if(u.doNotRehire){toast('Marked do not rehire – this needs the full office.');return;}
    var exp=(DB.docs||[]).filter(function(d){return d.userId===u.id&&d.expiry&&d.expiry<today();}).length;
    u.active=true;delete u.offReason;u.rehiredAt=new Date().toISOString();u.rehiredBy=ME.name;audit('Switched account on (rehire)',u.name,'by Office Assistant '+ME.name);
    notify(u.id,'Welcome back – your account is switched on again. Please check your documents and training.');save();closeModal();render();
    modal('<h2>'+esc(u.name)+' is switched on again</h2><p>Same account – all hours, documents and training are kept.</p>'+(exp?'<div class="alert warn">'+exp+' document(s) have expired – ask them to upload new ones before their next shift.</div>':'<p class="small">No expired documents.</p>')+'<p class="small">Training is re-checked at their next sign-in.</p>');return;}
  var open=(DB.shifts||[]).filter(function(s){return s.date>=today()&&(s.workers||s.booked||[]).some&&((s.workers||s.booked||[]).indexOf(u.id)>=0);}).length,
      unap=(DB.time||[]).filter(function(t){return t.userId===u.id&&!t.removed&&t.lateEntry==='pending';}).length;
  modal('<h2>Switch off worker</h2><p><b>'+esc(u.name)+'</b> can\'t sign in after this. All hours, documents and training are kept.</p>'+
    (open?'<div class="alert warn">'+open+' upcoming shift(s) booked.</div>':'')+(unap?'<div class="alert warn">'+unap+' hour entr'+(unap>1?'ies':'y')+' still waiting for approval.</div>':'')+
    '<form data-form="ohoff"><input type="hidden" name="id" value="'+esc(u.id)+'">'+sel('reason','Reason',OFF_REASONS.map(function(r){return [r,r];}),'',{req:true,blank:true})+
    '<p class="small oh-grey">“Do not rehire” is set by the full office only.</p><button class="danger">Switch off worker</button> <button type="button" class="sec" data-act="closeModal">Cancel</button></form>');};
FORMS.ohoff=function(f,d){var u=user(d.id);if(!u||!ohIs())return;if(OFF_REASONS.indexOf(d.reason)<0){toast('Pick a reason.');return;}
  u.active=false;u.offReason=d.reason;u.offAt=new Date().toISOString();u.offBy='Office Assistant · '+ME.name;audit('Switched account off',u.name,d.reason+' · by Office Assistant '+ME.name);save();closeModal();toast('Switched off. Their sessions end now.');render();};

/* ---------- full office: Office Assistant page ---------- */
var LIST=null;
function ohMockList(){return {helpers:(DB.users||[]).filter(function(u){return u.officeRole==='helper';}).map(function(u){return {id:u.id,name:u.name,email:u.email,active:u.active!==false,opts:Object.assign({},DEF_OPTS,u.ohOpts||{}),lastSeen:u.lastLogin,device:u.ohDevice||'',createdAt:u.createdAt};}),
  week:(DB.ohActivity||[]).filter(function(a){return Date.now()-Date.parse(a.at)<7*864e5;})};}
function ohLoadList(){if(!LIVE()){LIST=ohMockList();return Promise.resolve(LIST);}
  /* 016u not installed (function missing) or any error: an empty, flagged list – never a loop, never a broken screen */
  return Promise.resolve().then(function(){return window.REG_SB.rpc('reg_helper_list');}).then(function(r){LIST=(r&&!r.error&&r.data)?r.data:{helpers:[],week:[],missing:true,err:r&&r.error&&r.error.message};LIST.helpers=LIST.helpers||[];LIST.week=LIST.week||[];return LIST;},
    function(e){LIST={helpers:[],week:[],missing:true,err:String(e&&e.message||e)};return LIST;});}
function ohWeekCard(short){var L=LIST||(LIVE()?null:ohMockList());if(!L){ohLoadList().then(function(){if(/^#\/(home|assistants)?$/.test((location.hash||'#/home').split('?')[0]))render();});return '';}
  if(L.missing||(!L.helpers.length&&short))return '';var w=L.week||[],pend=w.filter(function(a){return a.op==='needs_office'&&!a.decided;});
  var rows=w.filter(function(a){return a.op!=='needs_office';}).slice(0,short?5:60);
  return '<div class="card oh-week" id="ohweek"><h3 style="margin-top:0">Assistant changes this week <span class="pill s-mut">'+rows.length+(short&&w.length>5?'+':'')+'</span></h3>'+
    (pend.length?'<div class="alert warn"><b>'+pend.length+' change'+(pend.length>1?'s':'')+(pend.length>1?' need':' needs')+' your OK.</b> '+(short?'<a href="#/assistants">Open Office Assistant</a>':'')+'</div>':'')+
    (rows.length?'<div class="tw"><table><tr><th>When</th><th>Who</th><th>What</th><th>Farm code</th></tr>'+rows.map(function(a){return '<tr><td>'+esc(ohT(a.at))+'</td><td>'+esc(a.who||'')+'</td><td>'+esc(ohWhat(a))+'</td><td>'+esc(a.farm||'–')+'</td></tr>';}).join('')+'</table></div>':'<p class="small muted">No changes by the assistant this week.</p>')+
    (short?'<p class="small"><a href="#/assistants">See all, settings and switch off</a></p>':'')+'</div>';}
var TBL={reg_time_entries:'Hours',reg_accounts:'Person',reg_documents:'Document',reg_crew_orders:'Crew order',reg_time_proposals:'Farm hour change',reg_bookings:'Shift',reg_training_confirmations:'Training',reg_settings:'5-hour minimum waiver',reg_doc_bypass:'14-day pass',reg_alerts_outbox:'Alert',reg_audit:'Log line'};
function ohWhat(a){var t=TBL[a.tbl]||a.tbl||'';var d=a.detail||'';if(!d&&a.before&&a.after){try{var b=a.before.data||a.before,f=a.after.data||a.after,ch=Object.keys(f).filter(function(k){return JSON.stringify(f[k])!==JSON.stringify(b[k])&&!/^(updated|history)/.test(k);}).slice(0,4);d=ch.map(function(k){return k+': '+String(JSON.stringify(b[k])||'–').slice(0,18)+' → '+String(JSON.stringify(f[k])).slice(0,18);}).join('; ');}catch(e){}}
  return t+(a.op?' · '+a.op:'')+(d?' · '+d:'');}
VIEWS['admin:assistants']=function(){if(ohIs())return VIEWS['admin:ohhidden']();var L=LIST||(LIVE()?null:ohMockList());if(!L){ohLoadList().then(render);return '<h1>Office Assistant</h1><p class="muted">Loading…</p>';}
  if(L.missing)return '<h1>Office Assistant</h1><div class="alert warn" id="ohmissing">The Office Assistant database update (016u) is not installed yet, so assistants can\'t be added. Nothing else is affected.</div><p><button class="small sec" data-act="ohretry">Check again</button></p>';
  var err=PAGE_STATE.ohErr||'';PAGE_STATE.ohErr='';var pend=(L.week||[]).filter(function(a){return a.op==='needs_office'&&!a.decided;});
  return '<h1>Office Assistant</h1><p class="small">A second office login for someone in your office. They onboard and offboard workers and subcontractors, fix hours, handle late entries, crew orders, documents and training. '+
   'They <b>never</b> see real farm names, contacts, addresses, farm rates, invoice amounts, SIN, bank, date of birth or immigration documents – farms show as codes (like <b class="oh-code">Farm NAF264</b>). Every change they make is logged here.</p>'+
   (PAGE_STATE.ohNew?'<div class="alert ok" id="ohnew"><b>Office Assistant created.</b> Sign-in: <code>'+esc(PAGE_STATE.ohNew.login)+'</code> · temporary password <code>'+esc(PAGE_STATE.ohNew.pw)+'</code> (shown once – they choose their own at first sign-in). Give it to them in person, never by a shared login.</div>':'')+
   (err?'<div class="alert bad">'+esc(err)+'</div>':'')+
   L.helpers.map(function(h){var o=Object.assign({},DEF_OPTS,h.opts||{});
     return '<div class="card oh-helper" id="oh-'+esc(h.id)+'"><div class="row"><h3 style="margin:0">'+esc(h.name)+'</h3> <span class="pill '+(h.active?'s-ok':'s-bad')+'">'+(h.active?'On':'Switched off')+'</span></div>'+
      '<p class="small">'+esc(h.email||'')+' · Last sign-in: '+(h.lastSeen?esc(ohT(h.lastSeen)):'never')+(h.device?' · '+esc(String(h.device).slice(0,60)):'')+'</p>'+
      '<form data-form="ohopts" class="oh-opts"><input type="hidden" name="id" value="'+esc(h.id)+'"><h4>Owner settings</h4>'+
      ohTog('showPay','Show worker pay amounts',o.showPay,'Off: hours visible, $ hidden.')+
      ohTog('cap','Limit each hours change',o.cap,'On: a change over '+esc(o.capHours)+' h or older than '+esc(o.capDays)+' days goes to you for OK.')+
      ohTog('csv','Allow masked CSV downloads',o.csv,'Farm codes only, no amounts. Invoice PDFs are never allowed.')+
      ohTog('farmPhone','Show farm phone numbers',o.farmPhone,'Off: “Phone hidden. Ask the full office.” (A Call button can\'t hide a number, so it is show or hide.)')+
      ohTog('secrets','Allow SIN / bank details',o.secrets,'Off by default. Leave off unless they run payroll.')+
      '<button class="small">Save settings</button></form>'+
      '<div class="row" style="margin-top:8px">'+(h.active?'<button class="small danger" data-act="ohoffh" data-id="'+esc(h.id)+'">Switch off (ends their sessions)</button>':'<button class="small" data-act="ohonh" data-id="'+esc(h.id)+'">Switch on</button>')+
      ' <button class="small sec" data-act="ohreset" data-id="'+esc(h.id)+'">Reset password</button></div></div>';}).join('')+
   (pend.length?'<div class="card hl" id="ohpending"><h3 style="margin-top:0">Needs your OK ('+pend.length+')</h3><p class="small">Hours on an issued invoice or an exported pay period, or over the limit you set.</p><div class="tw"><table><tr><th>When</th><th>Who</th><th>Change</th><th></th></tr>'+
     pend.map(function(a){var d=(a.after&&a.after.data)||{};return '<tr><td>'+esc(ohT(a.at))+'</td><td>'+esc(a.who)+'</td><td>Farm '+esc(a.farm||'?')+' · '+esc((a.after&&a.after.date)||d.date||'')+' · '+esc((d['in']||'')+'–'+(d.out||''))+(d.removed?' · remove shift':'')+'</td><td><button class="small" data-act="ohdecide" data-v="approve" data-id="'+esc(a.id)+'">Approve</button> <button class="small sec" data-act="ohdecide" data-v="decline" data-id="'+esc(a.id)+'">Decline</button></td></tr>';}).join('')+'</table></div></div>':'')+
   ohWeekCard(false)+
   '<div class="card" id="ohcreate"><h3 style="margin-top:0">Add an Office Assistant</h3><p class="small">Their own login (never a shared one). Only the owner / full office can add, switch off or reset an assistant.</p><form data-form="ohcreate"><div class="grid2">'+
   inp('first','First name','',{req:true})+inp('last','Last name','',{req:true})+'</div>'+inp('email','Email (their sign-in)','',{req:true,type:'email'})+'<button>Create Office Assistant</button></form></div>';};
function ohTog(k,l,on,hint){return '<label class="oh-tog"><input type="checkbox" name="'+k+'" value="1"'+(on?' checked':'')+'> <span><b>'+esc(l)+'</b> – '+(on?'On':'Off')+'<br><span class="small oh-grey">'+hint+'</span></span></label>';}
ACT.ohretry=function(){LIST=null;render();};
function ohReload(){LIST=null;return ohLoadList().then(function(){render();});}
FORMS.ohopts=function(f,d){if(!ohFull())return;var o={};['showPay','cap','csv','farmPhone','secrets'].forEach(function(k){o[k]=!!d[k];});
  if(LIVE()){window.REG_SB.rpc('reg_helper_admin',{p_user:d.id,p_action:'opts',p_arg:o}).then(function(r){if(r.error)PAGE_STATE.ohErr=r.error.message;else toast('Settings saved.');ohReload();});return;}
  var u=user(d.id);if(!u)return;u.ohOpts=Object.assign({},DEF_OPTS,u.ohOpts||{},o);audit('Office Assistant settings',u.name,JSON.stringify(o));save();toast('Settings saved.');ohReload();};
function ohAdmin(id,action,arg,msg){if(!ohFull())return;if(LIVE()){window.REG_SB.rpc('reg_helper_admin',{p_user:id,p_action:action,p_arg:arg||{}}).then(function(r){if(r.error)PAGE_STATE.ohErr=r.error.message;else toast(msg);ohReload();});return true;}return false;}
ACT.ohoffh=function(el){if(!confirmBox('ohoff'+el.dataset.id,'Switch this Office Assistant off? Their sessions end now.'))return;if(ohAdmin(el.dataset.id,'off',{},'Switched off – their sessions ended.'))return;
  var u=user(el.dataset.id);if(!u)return;u.active=false;audit('Office Assistant switched off',u.name);save();toast('Switched off – their sessions ended.');ohReload();};
ACT.ohonh=function(el){if(ohAdmin(el.dataset.id,'on',{},'Switched on.'))return;var u=user(el.dataset.id);if(!u)return;u.active=true;audit('Office Assistant switched on',u.name);save();ohReload();};
ACT.ohreset=function(el){if(!ohFull())return;if(LIVE()){window.REG_SB.rpc('admin_reset_password',{p_user:el.dataset.id}).then(function(r){if(r.error){PAGE_STATE.ohErr=r.error.message;render();return;}PAGE_STATE.ohNew={login:(LIST.helpers.filter(function(h){return h.id===el.dataset.id;})[0]||{}).email,pw:r.data};render();});return;}
  var u=user(el.dataset.id);if(!u)return;var pw='Tmp-'+Math.random().toString(36).slice(2,8);u.passHash=hashPw(pw);u.mustChangePw=true;audit('Office Assistant password reset',u.name);save();PAGE_STATE.ohNew={login:u.username,pw:pw};render();};
ACT.ohdecide=function(el){if(!ohFull())return;var id=el.dataset.id,v=el.dataset.v;
  if(LIVE()){window.REG_SB.rpc('reg_helper_admin',{p_user:null,p_action:v,p_arg:{id:Number(id)}}).then(function(r){if(r.error)PAGE_STATE.ohErr=r.error.message;else toast(v==='approve'?'Approved – applied.':'Declined.');ohReload();});return;}
  var a=(DB.ohActivity||[]).filter(function(x){return String(x.id)===String(id);})[0];if(!a)return;a.decided=v+'d by '+ME.name;
  if(v==='approve'&&a.after&&a.after.data){var t=(DB.time||[]).filter(function(x){return x.id===a.after.id;})[0];if(t)Object.assign(t,a.after.data);}
  audit('Office Assistant change '+v+'d',a.who,ohWhat(a));save();toast(v==='approve'?'Approved – applied.':'Declined.');ohReload();};
FORMS.ohcreate=function(f,d){if(!ohFull())return;var first=String(d.first||'').trim(),last=String(d.last||'').trim(),email=String(d.email||'').trim().toLowerCase();
  if(!first||!last||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){toast('Enter the first and last name and a valid email.');return;}
  if(LIVE()){(async function(){try{var C=window.REG_STORE,me=(await window.REG_SB.auth.getUser()).data.user;
      var tmp=window.supabase.createClient(C.url,C.key,{auth:{persistSession:false,autoRefreshToken:false,storageKey:'reg-create-tmp'}});var a=new Uint8Array(24);crypto.getRandomValues(a);
      var r=await tmp.auth.signUp({email:email,password:Array.from(a,function(b){return ('0'+b.toString(16)).slice(-2);}).join('')+'Aa1!',options:{data:{company:'us',reg_kind:'employee',full_name:first+' '+last,contact_email:email,added_by_office:me.id}}});
      try{await tmp.auth.signOut();}catch(e){}if(r.error||!r.data.user)throw r.error||new Error('Could not create the account.');
      var x=await window.REG_SB.rpc('reg_office_add_helper',{p_user:r.data.user.id,p:{first:first,last:last}});if(x.error)throw x.error;
      PAGE_STATE.ohNew={login:email,pw:x.data.temp_password};}catch(e){PAGE_STATE.ohErr=String(e&&e.message||e);}ohReload();})();return;}
  if(loginTaken(email.split('@')[0],email)){toast('That email is already used.');return;}
  var pw='Tmp-'+Math.random().toString(36).slice(2,8);
  DB.users.push({id:uid('u'),type:'admin',officeRole:'helper',officeRoles:['helper','payroll'],name:first+' '+last,username:email.split('@')[0],email:email,passHash:hashPw(pw),mustChangePw:true,active:true,approved:true,accountApproved:true,
    createdAt:new Date().toISOString(),profile:{},roles:[],orientations:[],ohOpts:Object.assign({},DEF_OPTS)});
  audit('Owner added Office Assistant',first+' '+last,email);save();PAGE_STATE.ohNew={login:email.split('@')[0],pw:pw};ohReload();};

/* ---------- mock: test login "assistant", activity log (the live log is written by the database) ---------- */
function ohMockSeed(db){if(!db||!db.users||db.users.some(function(u){return u.officeRole==='helper';}))return;var off=db.users.filter(function(u){return u.username==='office';})[0];if(!off)return;
  db.users.push({id:'u_ohassist',type:'admin',officeRole:'helper',officeRoles:['helper','payroll'],name:'Amy Assist',username:'assistant',email:'assistant@example.com',passHash:off.passHash,active:true,approved:true,accountApproved:true,
    createdAt:new Date(Date.now()-864e5*3).toISOString(),lastLogin:new Date(Date.now()-36e5*5).toISOString(),ohDevice:'iPhone – Safari (sample)',profile:{},roles:[],orientations:[],ohOpts:Object.assign({},DEF_OPTS)});
  var t=(db.time||[]).filter(function(x){return !x.test;})[0];
  db.ohActivity=[{id:'oha1',at:new Date(Date.now()-36e5*4).toISOString(),who:'Office Assistant · Amy Assist',tbl:'reg_time_entries',op:'update',farm:(t&&t.site)||'TFA-01',detail:'out: "15:30" → "15:00" (sample)'},
    {id:'oha2',at:new Date(Date.now()-36e5*3).toISOString(),who:'Office Assistant · Amy Assist',tbl:'reg_time_entries',op:'needs_office',farm:(t&&t.site)||'TFA-01',after:{id:t?t.id:'',date:t?t.date:'',data:{'in':t?t['in']:'07:00',out:'12:00'}},detail:'shift in an exported pay period (sample)'}];}
if(typeof seedV2==='function'){var osd=seedV2;seedV2=function(db,o){osd(db,o);try{ohMockSeed(db);}catch(e){}};}
var oaud=audit;audit=function(action,target,detail){oaud(action,target,detail);try{if(!LIVE()&&ohIs()&&DB.audit[0]){DB.audit[0].actor='Office Assistant · '+ME.name;(DB.ohActivity=DB.ohActivity||[]).unshift({id:uid('oha'),at:DB.audit[0].at,who:'Office Assistant · '+ME.name,tbl:'',op:'',farm:(String(detail||target||'').match(/\b[A-Z]{2,4}-?\d{2,3}\b/)||[''])[0],detail:action+(target?' · '+ohScrub(String(target)):'')+(detail?' · '+ohScrub(String(detail)).slice(0,80):'')});if(DB.ohActivity.length>500)DB.ohActivity.length=500;}}catch(e){}};
var orn=render;render=function(){try{if(!LIVE()&&typeof DB!=='undefined')ohMockSeed(DB);ohRoles();}catch(e){}return orn.apply(this,arguments);};
var olg=FORMS.login;FORMS.login=function(f,d){olg(f,d);try{if(ME&&ohIs()){ME.ohDevice=navigator.userAgent.slice(0,120);ohRoles();save();}}catch(e){}};

/* ---------- live: the assistant reads and writes ONLY through the 016u functions ---------- */
if(window.REG_SB){var sb=window.REG_SB,orpc=sb.rpc.bind(sb),ofrom=sb.from.bind(sb),OH=false,CACHE={};
  var res=function(data,error){return Promise.resolve({data:data,error:error||null});};
  var save1=function(table,op,id,data){return orpc('reg_helper_save',{p_table:table,p_op:op,p_id:String(id),p_data:data||null}).then(function(r){
    if(r.error)return {error:r.error};var x=r.data||{};if(!x.ok)return {error:{message:x.message||'This needs the full office.',code:x.conflict?'23505':'42501'}};return {data:x.data};});};
  sb.rpc=function(fn,args){
    if(fn==='reg_snapshot')return orpc(fn,args).then(function(r){if(r.error||!r.data||r.data.role!=='office'||(r.data.officeRoles||[]).length){OH=false;return r;}
      return orpc('reg_helper_snapshot',{p_device:navigator.userAgent.slice(0,150)}).then(function(h){if(h.error){OH=false;return r;}OH=true;window.OH_ME=h.data.helper||{};CACHE.timeVoided=h.data.timeVoided||[];CACHE.payExports=h.data.payExports||[];
        h.data.officeRoles=['helper','payroll'];return {data:h.data,error:null};});});
    if(OH&&fn==='reg_account_save')return save1('reg_accounts','update',args.p_id,args.p_data).then(function(x){return x.error?{data:null,error:x.error}:{data:x.data,error:null};});
    return orpc(fn,args);};
  function fake(table){var st={op:null,rows:null,id:null};var b={
    insert:function(rows){st.op='insert';st.rows=[].concat(rows);return b;},update:function(o){st.op='update';st.rows=[o];return b;},
    upsert:function(o){st.op='upsert';st.rows=[].concat(o);return b;},delete:function(){st.op='delete';return b;},
    eq:function(k,v){if(k==='id')st.id=v;return b;},order:function(){return b;},select:function(){if(!st.op)st.op='select';return b;},
    then:function(ok,ko){return run().then(ok,ko);}};
    async function run(){
      if(st.op==='select'){var k=table==='reg_time_voided'?'timeVoided':table==='reg_pay_exports'?'payExports':null;return {data:k?(CACHE[k]||[]).map(function(x){return {id:x.id,data:x};}):[],error:null};}
      if(st.op==='delete'){var d=await save1(table,'delete',st.id,null);return d.error?{data:[],error:d.error}:{data:[{id:st.id}],error:null};}
      if(st.op==='update'){var u=await save1(table,'update',st.id,st.rows[0].data);return u.error?{data:[],error:u.error}:{data:[{id:st.id,data:u.data}],error:null};}
      var out=[];for(var i=0;i<st.rows.length;i++){var r=st.rows[i],x=await save1(table,st.op==='upsert'?'update':'insert',r.id,r.data);if(x.error)return {data:null,error:x.error};out.push({id:r.id,data:x.data});}
      return {data:out,error:null};}
    return b;}
  sb.from=function(t){return OH&&/^reg_/.test(t)?fake(t):ofrom(t);};
}
})();
