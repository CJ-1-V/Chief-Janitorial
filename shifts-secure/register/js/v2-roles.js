/* v2-roles.js – OWNER CHECKLIST (Schedule A, editable in office Settings):
   Truck drivers: driver's abstract (driving record). Forklift operators incl. bin pilers: forklift test/certificate AND years of
   forklift experience (whole number >= 0). All other roles (graders, packers, field labour…): no documents.
   Each worker/employee has ONE job role (picked by the worker or set by their subcontractor). Only that role's items are required.
   Subcontractor agreement acceptance includes a warranty that every worker is legally allowed to work in Canada. TEST ONLY. */
'use strict';
DOCS.driver_abstract={label:"Driver's abstract (driving record)",expiry:false,who:'person'};
DOCS.forklift.label='Forklift test / certificate';
var ROLE_ITEMS={driver_abstract:"Driver's abstract (driving record) – upload",forklift:'Forklift test / certificate – upload',forklift_years:'Years of forklift experience – number'};
var JOB_ROLES={
  field:{label:'Grader / packer / field labour (all other roles)',legacy:[]},
  forklift:{label:'Forklift operator (incl. bin piler)',legacy:['forklift']},
  driver:{label:'Truck driver',legacy:['driver']}};
function defaultRoleDocs(){return {field:[],forklift:['forklift','forklift_years'],driver:['driver_abstract']};}
function roleDocs(role){var m=(typeof DB!=='undefined'&&DB&&DB.settings&&DB.settings.roleDocs)||defaultRoleDocs();return (m[role]||[]).slice();}
function jobRoleOf(u){if(u.jobRole&&JOB_ROLES[u.jobRole])return u.jobRole;if(hasRole(u,'driver'))return 'driver';if(hasRole(u,'forklift')||hasRole(u,'machinery'))return 'forklift';return 'field';}
function roleItemsText(role){var it=roleDocs(role);return it.length?it.map(function(k){return ROLE_ITEMS[k];}).join(' + '):'no documents required';}
function roleDocsText(){return Object.keys(JOB_ROLES).map(function(k){return JOB_ROLES[k].label+': '+roleItemsText(k);}).join('; ');}
function applyRole(u,role,years){if(!JOB_ROLES[role])role='field';u.jobRole=role;u.roles=JOB_ROLES[role].legacy.slice();if(years!==undefined&&years!=='')u.forkliftYears=parseInt(years,10);}
function validYears(v){return /^\d+$/.test(String(v==null?'':v).trim());}

/* Schedule A worker checklist text follows the role list */
(function(){var od=defaultScheduleA;defaultScheduleA=function(){var a=od();a.docWorker=docWorkerText();return a;};})();
function docWorkerText(){return 'Document checklist by job role – only the worker\'s own role is required: '+roleDocsText()+'. Subcontractor workers do NOT upload proof of eligibility to work – the subcontractor warrants it (see the agreement).';}

/* Role picker (+ years of forklift experience) replaces the old "special jobs" ticks */
rolesField=function(u){var cur=jobRoleOf(u);return '<fieldset><legend>Job role</legend>'+sel('jobRole','My job role (only this role\'s items are required)',Object.keys(JOB_ROLES).map(function(k){return [k,JOB_ROLES[k].label+' – '+roleItemsText(k)];}),cur)+
  inp('forkliftYears','Years of forklift experience (forklift operators / bin pilers – whole number, 0 or more)',u.forkliftYears==null?'':u.forkliftYears,{type:'number',extra:' min="0" step="1" inputmode="numeric"'})+(u.type==='worker'?'<div class="hint">Your employer can also set your role.</div>':'')+'</fieldset>';};
['regWorker','regEmp'].forEach(function(k){var of=FORMS[k];if(!of)return;FORMS[k]=function(f,d){if(d.jobRole){var needY=roleDocs(d.jobRole).indexOf('forklift_years')>=0;if(needY&&!validYears(d.forkliftYears)){toast('Enter your years of forklift experience as a whole number (0 or more).');return;}if(d.forkliftYears!==''&&d.forkliftYears!=null&&!validYears(d.forkliftYears)){toast('Years of forklift experience must be a whole number (0 or more).');return;}applyRole(ME,d.jobRole,d.forkliftYears);d.roles=ME.roles.slice();}return of(f,d);};});

docKindsFor=(function(od){return function(u){if(u.type==='sub')return od(u);var k=u.type==='employee'?['eligibility']:[];roleDocs(jobRoleOf(u)).forEach(function(d){if(DOCS[d])k.push(d);});
  if(u.type==='employee'){k.push('td1','td1pe','void_cheque');if((u.profile||{}).priorPayroll==='yes')k.push('paystub');}return k;};})(docKindsFor);
docMetaFields=(function(om){return function(k){if(k==='driver_abstract')return inp('abstractDate','Date of the abstract','',{type:'date',req:true});if(k==='forklift')return inp('expiry','Expiry date (if any)','',{type:'date'});return om(k);};})(docMetaFields);

/* requirements: role items only */
(function(){var orq=requirements;requirements=function(u){var R=orq(u);if(u.type!=='worker'&&u.type!=='employee')return R;var role=jobRoleOf(u),items=roleDocs(role);
  R=R.filter(function(r){return ['driver_licence','forklift'].indexOf(r.key)<0;});
  var at=R.length;for(var i=0;i<R.length;i++)if(R[i].key==='safety'){at=i;break;}
  var add=[];
  items.forEach(function(k){if(k==='forklift_years'){var ok=validYears(u.forkliftYears);add.push({key:'forklift_years',label:'Years of forklift experience'+(ok?': '+u.forkliftYears:''),st:ok?{s:'Done',c:'s-ok'}:{s:'Missing',c:'s-bad'},ok:ok,msg:ok?'':'Enter your years of forklift experience (a whole number) in My details.',fix:'#/register'});return;}
    var d=latestDoc(u.id,k),st=docStatus(d);add.push({key:k,label:DOCS[k].label,st:st,ok:st.s==='Valid'||st.s==='Expiring soon',msg:d?fixMsg(k,st,d):'Upload it, or type in the details.',fix:'#/docs'});});
  add.unshift({key:'jobrole',label:'Job role: '+JOB_ROLES[role].label,st:{s:'Done',c:'s-ok'},ok:true,msg:'',fix:'#/register'});
  R.splice.apply(R,[at,0].concat(add));return R;};})();
/* shift checks: driver shifts need a valid driver's abstract (no licence class any more); forklift shifts need the certificate + years */
(function(){var ob=blockers;blockers=function(u,date,shift){var b=ob(u,date,shift);if(!shift||(u.type!=='worker'&&u.type!=='employee'))return b;
  b=b.filter(function(x){return !/^Driver shift: your driver's licence|^Driver shift needs|^Forklift\/machinery shift/.test(x.m);});
  if(shift.role==='driver'){var s=docStatus(latestDoc(u.id,'driver_abstract'),date);if(s.s!=='Valid'&&s.s!=='Expiring soon')b.push({m:"Driver shift: your driver's abstract is "+s.s+'.',fix:'#/docs'});}
  if(shift.role==='forklift'||shift.role==='machinery'){var f=docStatus(latestDoc(u.id,'forklift'),date);if(f.s!=='Valid'&&f.s!=='Expiring soon')b.push({m:'Forklift shift: your forklift test/certificate is '+f.s+'.',fix:'#/docs'});if(!validYears(u.forkliftYears))b.push({m:'Forklift shift: enter your years of forklift experience.',fix:'#/register'});else if(shift.minYears&&u.forkliftYears<shift.minYears)b.push({m:'Forklift shift needs at least '+shift.minYears+' years of forklift experience.',fix:''});}
  return b;};})();
/* office shift form: no licence class / air brake any more */
(function(){var ov=VIEWS['admin:shiftsadmin'];if(!ov)return;VIEWS['admin:shiftsadmin']=function(){return ov().replace(/<div><label[^>]*>Driver licence class needed<\/label><select name="licClass">[^]*?<\/select><\/div>/,'').replace(/<label class="inline"><input type="checkbox" name="airBrake"[^]*?<\/label>/,'');};})();

/* subcontractor sets each worker's job role + years */
(function(){var ow=VIEWS['sub:workers'];VIEWS['sub:workers']=function(){var x=ow();var ws=users('worker').filter(function(w){return w.subId===ME.id;});
  return x+'<div class="card" id="workerroles"><h3 style="margin-top:0">Job role for each worker</h3><p class="small">Only that role\'s items are required. '+esc(roleDocsText())+'.</p>'+ws.map(function(w){return '<form data-form="workerrole" class="row"><input type="hidden" name="id" value="'+w.id+'"><span style="min-width:150px"><b>'+esc(w.name)+'</b></span><select name="jobRole" style="max-width:280px">'+opt(Object.keys(JOB_ROLES).map(function(k){return [k,JOB_ROLES[k].label];}),jobRoleOf(w))+'</select><input type="number" name="forkliftYears" min="0" step="1" placeholder="Forklift yrs" value="'+esc(w.forkliftYears==null?'':w.forkliftYears)+'" style="max-width:110px"><button class="small sec">Save role</button></form>';}).join('')+'</div>';};})();
FORMS.workerrole=function(f,d){var w=user(d.id);if(!w||w.subId!==ME.id){toast('Not allowed.');return;}if(roleDocs(d.jobRole).indexOf('forklift_years')>=0&&!validYears(d.forkliftYears)){toast('Enter years of forklift experience as a whole number (0 or more).');return;}if(d.forkliftYears!==''&&!validYears(d.forkliftYears)){toast('Years must be a whole number (0 or more).');return;}
  applyRole(w,d.jobRole,d.forkliftYears);audit('Subcontractor set worker job role',w.name,JOB_ROLES[w.jobRole].label+(w.forkliftYears!=null?' ('+w.forkliftYears+' yrs forklift)':''));notify(w.id,'Your job role was set to '+JOB_ROLES[w.jobRole].label+' by your employer.');save();toast('Role saved.');render();};

/* office Settings: edit the role checklist (publishes a new Schedule A version) */
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var x=os();var card='<div class="card" id="roledocs"><h3 style="margin-top:0">Document checklist by job role (Schedule A)</h3><p class="small">Only the worker\'s own role is required. Saving publishes a new Schedule A version.</p><form data-form="roledocs"><div class="tw"><table><tr><th>Role</th>'+Object.keys(ROLE_ITEMS).map(function(k){return '<th class="small">'+esc(ROLE_ITEMS[k])+'</th>';}).join('')+'</tr>'+Object.keys(JOB_ROLES).map(function(r){var it=roleDocs(r);return '<tr><td>'+esc(JOB_ROLES[r].label)+'</td>'+Object.keys(ROLE_ITEMS).map(function(k){return '<td><input type="checkbox" name="'+r+'__'+k+'" value="1"'+(it.indexOf(k)>=0?' checked':'')+' aria-label="'+esc(JOB_ROLES[r].label+' – '+ROLE_ITEMS[k])+'"></td>';}).join('')+'</tr>';}).join('')+'</table></div><button class="small">Save role checklist</button></form></div>';
  return x.replace('<div class="card hl" id="schedA">',card+'<div class="card hl" id="schedA">');};})();
FORMS.roledocs=function(f,d){var m={};Object.keys(JOB_ROLES).forEach(function(r){m[r]=Object.keys(ROLE_ITEMS).filter(function(k){return !!d[r+'__'+k];});});DB.settings.roleDocs=m;SA().docWorker=docWorkerText();bumpScheduleA('Role document checklist: '+roleDocsText());save();toast('Role checklist saved.');render();};

/* Subcontractor agreement acceptance includes the work-eligibility warranty */
var ELIG_WARRANTY='I warrant, for the subcontractor, that every worker we send to UnScramble is legally allowed to work in Canada, and that we check and keep their proof of eligibility to work and SIN as their employer.';
TERMS_TEXT.sub_agreement=TERMS_TEXT.sub_agreement+'\n• Work eligibility warranty: the subcontractor warrants that every worker it sends is legally allowed to work in Canada. The subcontractor checks and keeps each worker\'s proof of eligibility and SIN as their employer; workers do not upload these to UnScramble. (UnScramble\'s own direct employees still provide their SIN and proof of eligibility to UnScramble.)';
(function(){var ov=VIEWS.terms;VIEWS.terms=function(){return ov().replace(/(<input type="hidden" name="key" value="sub_agreement">)/,'$1'+chk('warrant','<b>Work eligibility warranty:</b> '+esc(ELIG_WARRANTY),false,{req:true}));};})();
(function(){var oa=FORMS.accept;FORMS.accept=function(f,d){if(d.key==='sub_agreement'&&!d.warrant){toast('Please tick the work eligibility warranty.');return;}
  var n=DB.acceptances.length;oa(f,d);var a=DB.acceptances[n];if(a&&a.key==='sub_agreement'){a.warranty=ELIG_WARRANTY;save();}};})();
