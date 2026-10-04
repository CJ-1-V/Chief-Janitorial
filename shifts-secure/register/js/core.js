/* UnScramble Registration – TEST VERSION (local only). Core helpers, storage, config. */
'use strict';
var STORE_KEY = 'unscramble-registration-TEST-v1';
var DB = null, ME = null;
var ADMIN_EMAIL = 'admin@unscramble.ca';

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function uid(p){return (p||'id')+'_'+Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);}
function pad(n){return (n<10?'0':'')+n;}
function isoLocal(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function realToday(){return isoLocal(new Date());}
function today(){return (DB&&DB.settings.simDate)||realToday();}
function parseD(s){var p=String(s).split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function addDays(s,n){var d=parseD(s);d.setDate(d.getDate()+n);return isoLocal(d);}
function daysBetween(a,b){return Math.round((parseD(b)-parseD(a))/86400000);}
function addBusinessDays(s,n){var d=parseD(s);while(n>0){d.setDate(d.getDate()+1);var w=d.getDay();if(w!==0&&w!==6)n--;}return isoLocal(d);}
function tz(){try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'local';}catch(e){return 'local';}}
function stamp(){var d=new Date();return {iso:d.toISOString(),local:isoLocal(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds()),tz:tz()};}
function fmtStamp(s){if(!s)return '';var d=new Date(s);return isoLocal(d)+' '+pad(d.getHours())+':'+pad(d.getMinutes());}
function money(n){n=Number(n)||0;return '$'+n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function deviceInfo(){var ua=navigator.userAgent;var m=/Mobile|Android|iPhone/.test(ua)?'Phone':'Computer';return m+' – '+(ua.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/)||['browser'])[0]+' (IP not available in local test)';}
function last(s,n){s=String(s||'');return s?('•••'+s.slice(-n)):'';}
function hashPw(pw){ /* TEST ONLY – simple hash, not real security */
  var h1=0xdeadbeef^7,h2=0x41c6ce57^7,str='us-test-salt:'+pw;
  for(var i=0;i<str.length;i++){var c=str.charCodeAt(i);h1=Math.imul(h1^c,2654435761);h2=Math.imul(h2^c,1597334677);}
  h1=Math.imul(h1^(h1>>>16),2246822507)^Math.imul(h2^(h2>>>13),3266489909);
  h2=Math.imul(h2^(h2>>>16),2246822507)^Math.imul(h1^(h1>>>13),3266489909);
  return (4294967296*(2097151&h2)+(h1>>>0)).toString(36);
}
/* "Encrypted" storage stand-in for SIN/banking (TEST ONLY: simple obfuscation, real build must use real encryption). */
function enc(s){if(!s)return '';return 'enc:'+btoa(unescape(encodeURIComponent(String(s).split('').reverse().join(''))));}
function dec(s){if(!s)return '';if(String(s).indexOf('enc:')!==0)return s;return decodeURIComponent(escape(atob(s.slice(4)))).split('').reverse().join('');}
function validPostal(p){return /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i.test(String(p||'').trim());}
function validSIN(s){s=String(s||'').replace(/\D/g,'');if(s.length!==9)return false;var sum=0;for(var i=0;i<9;i++){var d=+s[i];if(i%2===1){d*=2;if(d>9)d-=9;}sum+=d;}return sum%10===0;}
function digits(s){return String(s||'').replace(/\D/g,'');}

/* ---------- Config ---------- */
var TYPES={admin:'UnScramble Office (Admin)',firm:'Client firm (farm/business)',sub:'Subcontractor',worker:'Subcontractor worker',employee:'Employee (company employee)',tester:'Testing for App Development'};
var TERMS_DEF={
  app_testing:{name:'App Terms of Use + Testing Terms',types:['tester']},
  sub_agreement:{name:'Master Labour Contract Agreement',types:['sub']},
  schedule_a:{name:'Schedule A – commercial terms',types:['sub']},
 schedule_c:{name:'Schedule C – Worker Acknowledgement',types:['worker']},
  employee_terms:{name:'Employee Terms Acknowledgement',types:['employee']},
  privacy:{name:'Privacy Notice and Consent (incl. location check-in)',types:['sub','worker','employee']}
};
var TERMS_TEXT={
 app_testing:'APP TERMS OF USE AND TESTING TERMS (sample text for the test version)\n\n1. You have been given access to try the UnScramble Shift Tracker app and give feedback.\n2. Testing is for testing and feedback only. It is NOT work. Nothing you do as a tester (test shifts, test hours, test invoices) is real work, goes to payroll, or is ever paid.\n3. No documents are needed for a testing account. Please do not upload real personal documents.\n4. Privacy: we keep your name, login and anything you type with the same protection as any other account. We only use it to run the app. You can ask to see or correct your data at any time.\n5. The office can switch your testing account off at any time, or convert it to a full Subcontractor or Employee account if you will do real paid work.',
 sub_agreement:'MASTER LABOUR CONTRACT AGREEMENT – PLACEHOLDER (sample text only – the final wording will be decided with the team)\n\n• Term: evergreen. There is no end date – the agreement renews automatically.\n• Ending it: either side can end the agreement by written notice. UnScramble can end it immediately for cause (for example safety, fraud, or required documents/insurance lapsing).\n• Schedule A holds the commercial terms that can change: pay rates per site/role, billing cycle and payment terms, holdback, insurance amounts, WCB timing, the document checklist per role and the 12-month conversion fee. A new Schedule A version must be accepted in the app.\n• You (the Subcontractor) are the legal employer of your workers. You pay them, keep their time and payroll records, and give records to UnScramble within 5 business days when asked.\n• Section 13 / Schedule B: No registration, no shift, no pay. Your company documents (WCB PEI clearance, insurance) must stay valid or all of your workers are blocked.\n• Invoices: one lump-sum invoice every 30 days plus 15% HST, submitted in the app. Invoices more than 60 days late are not payable.\n• UnScramble may withhold payment if WCB clearance or insurance lapses or a records request is overdue.\n• Schedule A: see the separate Schedule A (sample values – not real rates).',
 schedule_a:'(generated from Schedule A settings)',
 schedule_c:'SCHEDULE C – WORKER ACKNOWLEDGEMENT (sample text for the test version)\n\n• Your employer is {EMPLOYER}. Your employer is NOT UnScramble and NOT the farm/client site.\n• Your employer pays you, keeps your time records and your SIN. UnScramble does not ask for or store your SIN.\n• You must follow site safety rules, wear PPE, and you have the right to refuse unsafe work.\n• You must keep your documents (work permit, licences, training) up to date or you cannot be placed on a crew.',
 employee_terms:'EMPLOYEE TERMS ACKNOWLEDGEMENT (sample text – owner approves final wording)\n\n1. PEI Employment Standards (summary): how you are paid (bi-weekly), hours, vacation pay (4% to start), paid holidays.\n2. Occupational Health and Safety: your rights and duties, the right to refuse unsafe work, and how to report an injury right away.\n3. UnScramble safety and site rules: PPE, farm rules, food-safety and hygiene rules.\n4. Privacy consent (PIPEDA): what the app collects (contact, payroll and document details, clock-in location) and why – to register you, schedule you and pay you.',
 privacy:'PRIVACY NOTICE AND CONSENT (plain language, sample)\n\n• We collect only what we need to register you, check your documents, schedule shifts and (for UnScramble employees) pay you.\n• When you clock in, the app may check your location at the work site.\n• SIN and banking are kept only in the restricted payroll area (UnScramble employees only).\n• Only people who need it can see your documents. Every view, upload and approval is logged.\n• You can ask to see or correct your information at any time (Profile > Privacy request).\n• Retention periods are set by the UnScramble office.'
};
var CONSENT_TEXT='I agree that UnScramble may use my app usage data and feedback to improve the Shift Tracker app, and to design, develop and market this and future UnScramble apps and products. Only anonymized or combined data will be used in marketing. This is optional and I can withdraw at any time.';

var DOCS={
 wcb_clearance:{label:'WCB PEI clearance letter',expiry:'recheck',who:'sub'},
 cgl:{label:'Commercial General Liability insurance certificate',expiry:true,who:'sub'},
 auto:{label:'Auto liability certificate',expiry:true,who:'sub'},
 agency_licence:{label:'Temporary help agency / recruiter licence',expiry:true,who:'sub'},
 agreement:{label:'Signed Master Labour Contract Agreement + Schedule A (optional upload – you accept them in the app)',expiry:false,who:'sub'},
 bank_letter:{label:'Void cheque / bank letter (for payment)',expiry:false,who:'sub'},
 hst_proof:{label:'Proof HST registration not required',expiry:false,who:'sub'},
 eligibility:{label:'Proof of eligibility to work in Canada (passport / PR card / work permit)',expiry:'permit',who:'person'},
 driver_licence:{label:"Driver's licence",expiry:true,who:'person'},
 forklift:{label:'Forklift / machinery certification',expiry:true,who:'person'},
 td1:{label:'Signed federal TD1',expiry:false,who:'employee'},
 td1pe:{label:'Signed PEI TD1PE',expiry:false,who:'employee'},
 void_cheque:{label:'Void cheque / direct-deposit form',expiry:false,who:'employee'},
 paystub:{label:'Last paystub (prior payroll this year)',expiry:false,who:'employee'},
 records:{label:'Records request file',expiry:false,who:'sub'}
};
var JOB_TITLES=['Field worker','Grader','Packer','Driver','Forklift operator','Supervisor'];
var SITES=['TFA-01','TFA-02','TFB-01'];
function siteName(code){var s=(DB.sites||[]).filter(function(x){return x.code===code;})[0];return s?s.code+' – '+s.name:code;}
function siteFirm(code){var s=(DB.sites||[]).filter(function(x){return x.code===code;})[0];return s?user(s.firmId):null;}
function firmName(code){var f=siteFirm(code);return f?f.name:(code==='TEST-PRACTICE'?'Practice client (TEST)':'');}
var LANGS=['English','French','Spanish','Tagalog','Other'];
var DAYS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
/* CRA federal claim code bands (2025 table – admin must confirm current year). */
var FED_BPA=16129, FED_BAND=2835;

/* ---------- Storage ---------- */
function load(){
  try{var raw=localStorage.getItem(STORE_KEY);DB=raw?JSON.parse(raw):null;}catch(e){DB=null;}
  if(!DB||!DB.users){DB=seedData();save();}
  ['changes','logins','convReq','marketing','privacyReq','sites'].forEach(function(k){DB[k]=DB[k]||[];});
}
function save(){
  try{localStorage.setItem(STORE_KEY,JSON.stringify(DB));return true;}
  catch(e){toast('Could not save – the browser test storage is full. Try a smaller file, or Reset test data.');return false;}
}
function resetData(){localStorage.removeItem(STORE_KEY);sessionStorage.removeItem('us-test-me');DB=seedData();save();}
function user(id){for(var i=0;i<DB.users.length;i++)if(DB.users[i].id===id)return DB.users[i];return null;}
function users(type){return DB.users.filter(function(u){return !type||u.type===type;});}
function audit(action,target,detail){DB.audit.unshift({at:new Date().toISOString(),actor:ME?ME.name+' ('+(ME.username||ME.email)+')':'system',action:action,target:target||'',detail:detail||''});if(DB.audit.length>800)DB.audit.length=800;}
function notify(toIds,text,key){ /* simulated outbox: email + push, SMS only if phone on file */
  (Array.isArray(toIds)?toIds:[toIds]).forEach(function(to){
    if(key&&DB.notes.some(function(n){return n.key===key+'|'+to;}))return;
    var u=to==='admin'?null:user(to);var ch='Email + push';if(u&&u.phone)ch+=' + SMS';
    DB.notes.unshift({id:uid('n'),key:key?key+'|'+to:null,to:to,toLabel:to==='admin'?'UnScramble admin ('+ADMIN_EMAIL+')':(u?u.name+' <'+(u.email||u.username)+'>':to),text:text,channel:to==='admin'?'Email':ch,at:new Date().toISOString(),simDate:today(),read:false});
  });
  if(DB.notes.length>600)DB.notes.length=600;
}
function track(type,screen){
  if(!ME)return;DB.events.push({u:ME.id,role:ME.type,test:ME.type==='tester',screen:screen||'',type:type,at:new Date().toISOString(),d:today()});
  if(DB.events.length>3000)DB.events.splice(0,DB.events.length-3000);
}
function toast(msg){var t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove();},3200);}
