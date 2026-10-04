/* v2-clients.js – Farms first (80–90% of the business), plus other clients.
   Internal account type stays 'firm'. Farm is the DEFAULT and FIRST industry everywhere; farm roles are listed first.
   Other industries (Construction, Bakery, Painting, Cleaning, Other) come after, in a smaller section. Industry list editable in office Settings.
   Every client rule built for farms applies to all industries: Pending office review, office-set per-role rates + OT + HST,
   Rate Schedule + Independent Contractor Service Agreement signing, re-accept on rate change, no booking until signed,
   shift-time change proposals, no worker names, never seeing subcontractor pay. Non-solicit and no-hire cover farms and all other clients.
   Document rule unchanged: only truck drivers (abstract) and forklift operators / bin pilers (certificate + years) need documents. TEST ONLY. */
'use strict';
TYPES.firm='Farm or other client';
var DEFAULT_INDUSTRIES=['Farm','Construction','Bakery','Painting','Cleaning','Other'];
function clientTypes(){var l=((typeof DB!=='undefined'&&DB&&DB.settings&&DB.settings.clientTypes)||DEFAULT_INDUSTRIES).slice();var i=l.indexOf('Farm');if(i>0){l.splice(i,1);l.unshift('Farm');}else if(i<0)l.unshift('Farm');return l;}
function clientTypeOf(f){return (f&&f.firm&&f.firm.clientType)||'Farm';}
function isFarm(f){return clientTypeOf(f)==='Farm';}
function clientSel(name,cur){cur=cur||'Farm';return '<select name="'+name+'" aria-label="Industry">'+clientTypes().map(function(t){return '<option'+(t===cur?' selected':'')+'>'+esc(t)+'</option>';}).join('')+'</select>';}

/* ---------- job roles: farm roles first, then other industries ---------- */
(function(){var defs=[['field','General labour (farm)',[]],['grader','Grader (farm)',[]],['packer','Packer (farm / bakery)',[]],['forklift','Forklift operator',['forklift']],['binpiler','Bin piler (forklift)',['forklift']],['driver','Truck driver',['driver']],
  ['labourer','General labourer – construction',[]],['construction','Construction labourer',[]],['baker','Baker – bakery',[]],['painter','Painter – painting',[]],['cleaner','Cleaner – cleaning',[]]];
  Object.keys(JOB_ROLES).forEach(function(k){delete JOB_ROLES[k];});defs.forEach(function(d){JOB_ROLES[d[0]]={label:d[1],legacy:d[2]};});})();
var ROLE_INDUSTRY={Farm:['field','grader','packer','forklift','binpiler','driver'],Construction:['labourer','construction'],Bakery:['baker','packer'],Painting:['painter'],Cleaning:['cleaner']};
function industriesOfRole(r){return Object.keys(ROLE_INDUSTRY).filter(function(i){return ROLE_INDUSTRY[i].indexOf(r)>=0;});}
defaultRoleDocs=function(){var m={};Object.keys(JOB_ROLES).forEach(function(k){m[k]=[];});m.forklift=['forklift','forklift_years'];m.binpiler=['forklift','forklift_years'];m.driver=['driver_abstract'];return m;};
defaultTrainRoles=function(){var base=['whmis','rights'],end=['harassment','incident'],m={};
  ['field','grader','packer','forklift','binpiler','driver'].forEach(function(k){m[k]=base.concat(['orientation']).concat(end);});['grader','packer'].forEach(function(k){m[k].push('food');});['forklift','binpiler'].forEach(function(k){m[k].push('machinery');});
  [['labourer','construction'],['construction','construction'],['baker','bakery'],['painter','painting'],['cleaner','cleaning']].forEach(function(r){m[r[0]]=base.concat(['sitesafety','addon_'+r[1]]).concat(end);});return m;};

/* ---------- safety orientation by industry: farm questions ONLY for farm roles; other industries = general site safety + their own add-on ---------- */
var DEFAULT_ORIENT={Farm:TRAIN_ITEMS.orientation.module,
  Construction:'Construction sites: fall protection (guardrails, harness and tie-off above 3 m), hard hat, safety boots, high-visibility vest and eye protection, stay clear of moving equipment and overhead loads, keep walkways clear.',
  Bakery:'Bakeries: food safety first – hand washing, hair nets, no jewellery, report illness; hot ovens and burns, mixers and slicers (guards in place, never reach in), slippery floors, allergen rules.',
  Painting:'Painting jobs: ladders (3-point contact, never on the top step), scaffolds, solvent and paint vapours (ventilation, respirator when required, no smoking or sparks), read the SDS, eye and skin protection.',
  Cleaning:'Cleaning jobs: cleaning chemicals – read the label and SDS, never mix products (e.g. bleach and ammonia), gloves and eye protection, wet-floor signs, sharps and waste handling.',
  Other:'Other client sites: the client or crew supervisor explains the site hazards, PPE, emergency exits and first-aid contacts before you start.'};
var GENERAL_SITE='General site safety (all non-farm client sites): get the site orientation from the client or crew supervisor, know the exits and first-aid contacts, wear the PPE the job needs, read labels and SDS, report hazards right away, and refuse unsafe work.';
function orientText(ind){var m=(DB&&DB.settings&&DB.settings.orientationText)||{};return m[ind]||DEFAULT_ORIENT[ind]||DEFAULT_ORIENT.Other;}
(function(){var src=TRAIN_ITEMS,order=['whmis','rights','orientation','sitesafety','addon_construction','addon_bakery','addon_painting','addon_cleaning','machinery','firstaid','food','harassment','incident'],add={
  sitesafety:{n:'T3',label:'General site safety orientation (non-farm clients)',quiz:'sitesafety',months:12,module:GENERAL_SITE},
  addon_construction:{n:'T3+',label:'Construction add-on: falls and PPE',quiz:'addon_construction',months:12,ind:'Construction'},
  addon_bakery:{n:'T3+',label:'Bakery add-on: food safety',quiz:'addon_bakery',months:12,ind:'Bakery'},
  addon_painting:{n:'T3+',label:'Painting add-on: ladders and solvents',quiz:'addon_painting',months:12,ind:'Painting'},
  addon_cleaning:{n:'T3+',label:'Cleaning add-on: chemicals',quiz:'addon_cleaning',months:12,ind:'Cleaning'}};
  src.orientation.label='Farm safety orientation (farm roles)';src.orientation.ind='Farm';var all={};Object.keys(src).forEach(function(k){all[k]=src[k];});Object.keys(add).forEach(function(k){all[k]=add[k];});
  Object.keys(src).forEach(function(k){delete src[k];});order.forEach(function(k){if(all[k])src[k]=all[k];});Object.keys(all).forEach(function(k){if(!src[k])src[k]=all[k];});
  Object.keys(src).forEach(function(k){var it=src[k];if(it.ind){var fixed=it.module;Object.defineProperty(it,'module',{get:function(){return orientText(it.ind);},set:function(){},configurable:true});}});})();
/* office-editable quiz questions for the general site-safety module and the industry add-ons (placeholders) */
var EDITABLE_BANKS=['sitesafety','addon_construction','addon_bakery','addon_painting','addon_cleaning'];
function bankToText(b){return b.map(function(q){var o=[q.opts[q.ans]].concat(q.opts.filter(function(x,i){return i!==q.ans;}));return 'Q: '+q.q+'\nA: '+o[0]+' (correct)\nB: '+o[1]+'\nC: '+o[2]+'\nD: '+o[3]+'\nWhy: '+q.why;}).join('\n\n');}
function textToBank(t,prefix){var out=[],bad=0;String(t||'').split(/\n\s*\n/).forEach(function(blk,i){var g=function(k){var m=blk.match(new RegExp('^'+k+':\\s*(.*)$','m'));return m?m[1].trim():'';};var q=g('Q'),a=g('A').replace(/\s*\(correct\)\s*$/,''),b=g('B'),c=g('C'),d=g('D'),why=g('Why');if(!blk.trim())return;if(!q||!a||!b||!c||!d||!why){bad++;return;}out.push({id:prefix+(i+1),q:q,opts:[a,b,c,d],ans:0,why:why});});return bad?null:out;}
function applyBankEdits(){var m=(DB&&DB.settings&&DB.settings.quizBanks)||{};Object.keys(m).forEach(function(k){if(EDITABLE_BANKS.indexOf(k)>=0&&m[k]&&m[k].length)QUIZ_BANK[k]=m[k];});}
(function(){var ol=load;load=function(){ol();if(DB)applyBankEdits();};})();
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var x=os();var card='<div class="card" id="quizbanks"><h3 style="margin-top:0">Quiz questions – general site safety + industry add-ons</h3><p class="small">Farm safety questions go only to farm roles. Non-farm roles take the general site-safety quiz plus their industry add-on. Placeholder questions – edit them here. Format: Q:, A: (correct answer), B:, C:, D:, Why:, with a blank line between questions. Options are shuffled for every attempt.</p>'+
  EDITABLE_BANKS.map(function(k){return '<details><summary>'+esc(TRAIN_ITEMS[k].label)+' ('+QUIZ_BANK[k].length+' questions)</summary><form data-form="quizbank"><input type="hidden" name="bank" value="'+k+'"><textarea name="text" rows="10">'+esc(bankToText(QUIZ_BANK[k]))+'</textarea><button class="small">Save questions</button></form></details>';}).join('')+'</div>';
  return x.replace('<div class="card" id="trainroles">',card+'<div class="card" id="trainroles">');};})();
FORMS.quizbank=function(f,d){if(EDITABLE_BANKS.indexOf(d.bank)<0)return;var b=textToBank(d.text,d.bank.slice(0,3).toUpperCase());if(!b||b.length<3){toast('Each question needs Q, A (correct), B, C, D and Why – at least 3 questions.');return;}
  DB.settings.quizBanks=DB.settings.quizBanks||{};DB.settings.quizBanks[d.bank]=b;QUIZ_BANK[d.bank]=b;audit('Edited quiz questions',TRAIN_ITEMS[d.bank].label,b.length+' questions');save();toast('Questions saved ('+b.length+').');render();};

/* ---------- rate roles: farm roles first ---------- */
FARM_RATE_ROLES.length=0;[['labour','General labour (farm) / general labourer'],['grader','Grader'],['packer','Packer'],['forklift','Forklift operator / bin piler'],['driver','Truck driver'],['construction','Construction labourer'],['baker','Baker'],['painting','Painter'],['cleaner','Cleaner']].forEach(function(r){FARM_RATE_ROLES.push(r);});
var RATE_INDUSTRY={Farm:['labour','grader','packer','forklift','driver'],Construction:['labour','construction','forklift','driver'],Bakery:['baker','packer','driver'],Painting:['painting'],Cleaning:['cleaner']};
farmRoleOfRow=function(x){var u=user(x.uid),j=u&&(u.jobRole||'');return {driver:'driver',forklift:'forklift',binpiler:'forklift',grader:'grader',packer:'packer',construction:'construction',baker:'baker',painter:'painting',cleaner:'cleaner'}[j]||'labour';};
(function(){var om=ACT.farmratesmodal;ACT.farmratesmodal=function(el){om(el);var f=user(el.dataset.id),keep=RATE_INDUSTRY[clientTypeOf(f)];if(!keep)return;
  FARM_RATE_ROLES.forEach(function(r){if(keep.indexOf(r[0])>=0)return;var i=document.querySelector('#farmratesform [name=r_'+r[0]+']');if(i&&!i.value)i.parentNode.remove();});
  var h=document.querySelector('#modal h2');if(h)h.insertAdjacentHTML('afterend','<p class="small">Industry: <b>'+esc(clientTypeOf(f))+'</b> – roles for this industry are shown.</p>');};})();

/* ---------- client-facing wording: farm clients see "farm"; other clients see "client" ---------- */
function clientWord(html,f){if(isFarm(f))return html;return html.replace(/farm or other client/g,'client').replace(/Farm or other client/g,'Client').replace(/farm or client/g,'client').replace(/\bfarms\b/g,'clients').replace(/\bFarms\b/g,'Clients').replace(/\bfarm\b/g,'client').replace(/\bFarm\b/g,'Client');}
(function(){var oh=VIEWS['firm:home'];VIEWS['firm:home']=function(){return '<div class="small muted" id="clienttypeline">Industry: <b>'+esc(clientTypeOf(ME))+'</b></div>'+clientWord(oh(),ME);};
  var op=VIEWS.pending;VIEWS.pending=function(){return ME&&ME.type==='firm'?clientWord(op(),ME):op();};
  var oa=firmAgreementText;firmAgreementText=function(name,f){var t=oa(name);return t.replace('[Farm legal name]','[Farm or other client legal name]');};
  var osh=firmSigHtml;firmSigHtml=function(s){var f=user(s.firmId);return clientWord(osh(s),f);};})();

/* ---------- sign-up: Farm first and default ---------- */
(function(){var os=VIEWS.signup;VIEWS.signup=function(){return os().replace(/<a class="choice" href="#\/signup\/firm"><b>[^<]*<\/b><br><span class="small">[^<]*<\/span><\/a>/,'<a class="choice" href="#/signup/firm"><b>Farm or other client</b><br><span class="small">Farms (most of our clients) – and also construction, bakery, painting, cleaning or other businesses – that want UnScramble to supply workers. The office reviews your request and sets your rates; then you sign the agreement and Rate Schedule.</span></a>');};
  var of=VIEWS.signupForm;VIEWS.signupForm=function(h){var x=of(h);if(h.split('/')[2]!=='firm')return x;return x.replace(/Sign up: [^<]*<\/h1>/,'Sign up: Farm or other client</h1>').replace('Farm / business legal name','Farm (or other client) legal name').replace('Farm location / site name (optional)','Farm or work site name / location (optional)').replace('<div><label class="req">Contact person','<div><label class="req">Industry (Farm is the default)</label>'+clientSel('clientType','Farm')+'</div><div><label class="req">Contact person');};
  var fs=FORMS.firmsignup;FORMS.firmsignup=function(f,d){var n=DB.users.length;fs(f,d);if(DB.users.length>n){var u=DB.users[DB.users.length-1];if(u.type==='firm'){u.firm.clientType=clientTypes().indexOf(d.clientType)>=0?d.clientType:'Farm';save();}}};})();

/* ---------- office: industry per client, editable industry list, orientation text ---------- */
(function(){var of=VIEWS['admin:firms'];VIEWS['admin:firms']=function(){var x=of().replace('<h1>Client firms (farms / businesses)</h1>','<h1>Farms & other clients</h1>');var fl=users('firm').slice().sort(function(a,b){return (isFarm(a)?0:1)-(isFarm(b)?0:1);});
  var card='<div class="card" id="clienttypes"><h3 style="margin-top:0">Industry per client</h3><p class="small muted">Farms first. Other industries: Construction, Bakery, Painting, Cleaning, Other (edit the list in Settings).</p><div class="tw"><table><tr><th>Client</th><th>Industry</th></tr>'+fl.map(function(f){return '<tr data-client="'+esc(f.username||f.id)+'"><td>'+esc(f.name)+'</td><td><form data-form="clienttype" class="row"><input type="hidden" name="id" value="'+f.id+'">'+clientSel('clientType',clientTypeOf(f))+'<button class="small sec">Save</button></form></td></tr>';}).join('')+'</table></div></div>';
  return x.replace('<div class="card hl" id="farmrates">',card+'<div class="card hl" id="farmrates">').replace(/(<form data-form="newfirm"[^>]*>)/,'$1<div><label class="req">Industry</label>'+clientSel('clientType','Farm')+'</div>');};})();
FORMS.clienttype=function(f,d){var u=user(d.id);if(!u||u.type!=='firm')return;if(clientTypes().indexOf(d.clientType)<0){toast('Pick an industry from the list.');return;}var old=clientTypeOf(u);u.firm.clientType=d.clientType;audit('Changed client industry',u.name,old+' → '+d.clientType);save();toast('Industry saved.');render();};
(function(){var on=FORMS.newfirm;if(!on)return;FORMS.newfirm=function(f,d){var n=DB.users.length;on(f,d);if(DB.users.length>n){var u=DB.users[DB.users.length-1];if(u.type==='firm'){u.firm.clientType=clientTypes().indexOf(d.clientType)>=0?d.clientType:'Farm';save();}}};})();
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var x=os();
  var card='<div class="card" id="clienttypeset"><h3 style="margin-top:0">Client industries</h3><p class="small">Farm is always first and the default (most clients are farms). One industry per line for the others. All client rules (rates, signing, blocking) are the same for every industry.</p><form data-form="clienttypes"><textarea name="types" rows="6">'+esc(clientTypes().join('\n'))+'</textarea><button class="small">Save industries</button></form>'+
  '<h3>Site safety orientation text by industry</h3><p class="small muted">Shown in the orientation module for workers in that industry\'s roles. Placeholder text – the office edits it.</p><form data-form="orienttext">'+clientTypes().map(function(i){return '<label>'+esc(i)+'</label><textarea name="o_'+esc(i)+'" rows="2">'+esc(orientText(i))+'</textarea>';}).join('')+'<button class="small">Save orientation text</button></form></div>';
  return x.replace('<div class="card" id="trainroles">',card+'<div class="card" id="trainroles">');};})();
FORMS.clienttypes=function(f,d){var l=String(d.types||'').split(/\n/).map(function(s){return s.trim();}).filter(function(s,i,a){return s&&a.indexOf(s)===i;});l=l.filter(function(s){return s!=='Farm';});l.unshift('Farm');
  var used=users('firm').map(clientTypeOf).filter(function(t){return l.indexOf(t)<0;});if(used.length){toast('Still used by a client: '+used[0]+'. Change that client first.');return;}
  DB.settings.clientTypes=l;audit('Changed client industries','',l.join(', '));save();toast('Industries saved (Farm stays first).');render();};
FORMS.orienttext=function(f,d){var m=DB.settings.orientationText=DB.settings.orientationText||{};clientTypes().forEach(function(i){if(d['o_'+i])m[i]=d['o_'+i];});audit('Changed orientation text by industry');save();toast('Orientation text saved.');render();};

/* ---------- seed: mostly farm clients ---------- */
function seedClients(db){db.settings.clientTypes=db.settings.clientTypes||DEFAULT_INDUSTRIES.slice();var dr=defaultRoleDocs(),dt=defaultTrainRoles();
  db.settings.roleDocs=db.settings.roleDocs||{};Object.keys(dr).forEach(function(k){if(!db.settings.roleDocs[k])db.settings.roleDocs[k]=dr[k];});
  db.settings.trainRoles=db.settings.trainRoles||{};Object.keys(dt).forEach(function(k){if(!db.settings.trainRoles[k])db.settings.trainRoles[k]=dt[k];});
  db.users.forEach(function(u){if(u.type==='firm'&&!u.firm.clientType)u.firm.clientType='Farm';});
  var fA=db.users.filter(function(u){return u.username==='firmA';})[0];if(!fA||db.users.some(function(u){return u.username==='clientFarm';}))return;
  [['clientFarm','Sample Orchard Farm (TEST)','Farm','TOF-01','Orchard block (sample)',{labour:24,grader:25,packer:25,forklift:27,driver:29}],
   ['firmD','Test Farm D','Farm','TFD-01','Potato field (sample)',{labour:24.25,grader:25.25,packer:25.25,forklift:27.25,driver:29.25}],
   ['firmE','Test Farm E','Farm','TFE-01','Berry field (sample)',{labour:24.75,packer:25.75,driver:29.75}],
   ['clientCon','Sample Build Co. (TEST)','Construction','TCN-01','Build site (sample)',null],
   ['clientBake','Sample Bakery (TEST)','Bakery','TBK-01','Bakery floor (sample)',null],
   ['clientPaint','Sample Painting Co. (TEST)','Painting','TPT-01','Repaint job (sample)',{painting:28}],
   ['clientClean','Sample Cleaning Co. (TEST)','Cleaning','TCL-01','Office cleaning (sample)',null]].forEach(function(c,i){
    var u={id:uid('u'),type:'firm',name:c[1],username:c[0],email:c[0].toLowerCase()+'@example.com',phone:'',passHash:fA.passHash,active:true,suspended:false,approved:true,accountApproved:true,createdAt:new Date(Date.now()-86400000*30).toISOString(),lastLogin:null,profile:{},roles:[],orientations:[],firm:{billRate:c[5]?(c[5].labour||c[5].painting):0,contact:'Office (fake)',clientType:c[2]}};
    db.users.push(u);db.sites.push({code:c[3],name:c[4],firmId:u.id});if(!c[5])return;
    var r={id:uid('fr'),firmId:u.id,version:1,effective:addDays(today(),-30),rates:c[5],other:null,overtime:Math.round((c[5].labour||c[5].painting)*1.5*100)/100,hst:true,by:'Sample data',at:new Date(Date.now()-86400000*30).toISOString(),reason:''};(db.farmRates=db.farmRates||[]).push(r);
    (db.firmSigs=db.firmSigs||[]).push({id:uid('fs'),firmId:u.id,firmName:u.name,version:(db.settings.firmAgreement||{version:'1.0'}).version,label:FIRM_AGR_LABEL,signerName:'Sample Signer '+(i+1),title:c[2]==='Farm'?'Farm Manager':'Manager',signature:'Sample Signer '+(i+1),authorized:true,at:new Date(Date.now()-86400000*29).toISOString(),tz:'America/Halifax',device:'Computer – sample data',text:firmAgreementText(u.name,c[2]),rateVersion:1,rateSnapshot:JSON.parse(JSON.stringify(r))});});}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedClients(db);};})();
(function(){var ol=load;load=function(){ol();if(DB&&!DB.users.some(function(u){return u.username==='clientFarm';})){seedClients(DB);save();}};})();
ADMIN_ONLY_FORM.push('clienttype','clienttypes','orienttext','quizbank');
