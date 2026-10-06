/* Worker, Employee and Tester screens + shared document upload. */
'use strict';
NAV.worker=[['#/home','My checklist'],['#/register','My details'],['#/docs','Documents'],['#/safety','Safety training'],['#/availability','Availability'],['#/shifts','My crew assignments'],['#/alerts','Alerts'],['#/terms','Terms'],['#/profile','Profile']];
NAV.employee=[['#/home','My checklist'],['#/register','Registration & payroll'],['#/docs','Documents'],['#/safety','Safety training'],['#/availability','Availability'],['#/hours','My hours'],['#/alerts','Alerts'],['#/terms','Terms'],['#/profile','Profile']];
NAV.tester=[['#/home','Start'],['#/demo','Try registration screens'],['#/shifts','Practice shifts'],['#/hours','Test hours'],['#/invoices','Test invoices'],['#/myfeedback','My feedback'],['#/terms','Terms'],['#/profile','Profile']];
function hrs(a,b){if(!a||!b)return 0;var x=a.split(':'),y=b.split(':');return Math.max(0,((+y[0])*60+(+y[1])-(+x[0])*60-(+x[1]))/60);}
function empWait(r){return /^Your employer must/.test(r.msg||'');}
function checklistHtml(u){var R=requirements(u),todo=R.filter(function(r){return !r.ok&&r.st.s!=='Optional';}),wait=todo.filter(empWait),mineN=todo.length-wait.length,pl=function(n){return n+' item'+(n===1?'':'s');};
  var head;if(u.type==='worker'||u.type==='employee'){var ready=typeof readyForClock==='function'&&readyForClock(u);
    head=!todo.length?(ready?'<div class="alert ok"><b>All set ✓</b> Everything is complete.</div>':'<div class="alert ok"><b>Your part is done ✓</b> Everything you need to do is complete.</div>')
      :'<div class="alert warn" id="todocount">'+(mineN?'<b>'+pl(mineN)+' for you to finish</b>'+(ready?' – please do them soon.':'.'):'<b>Nothing for you to do right now.</b>')+(wait.length?' '+pl(wait.length)+' waiting for your employer.':'')+'</div>';}
  else head=todo.length?'<div class="alert warn"><b>'+todo.length+' item(s) to finish</b> before you can supply workers.</div>':'<div class="alert ok"><b>All set.</b> Everything required is complete and valid.</div>';
  return head+
  '<div class="card"><ul class="check">'+R.map(function(r){return '<li>'+pill(r.st)+'<div><b>'+esc(r.label)+'</b>'+(!r.ok&&r.msg?'<div class="small">'+(empWait(r)?'Waiting for your employer – nothing for you to do.':esc(r.msg)+' '+(r.fix&&r.fix!=='#/home'?'<a href="'+r.fix+'">Start →</a>':''))+'</div>':'')+(r.st.ex?'<div class="small muted">Expiry / due: '+esc(r.st.ex)+'</div>':'')+'</div></li>';}).join('')+'</ul></div>';}

VIEWS['worker:home']=VIEWS['employee:home']=function(){var u=ME;
  var x='<h1>Hello, '+esc((u.profile&&u.profile.preferredName)||u.name.split(' ')[0])+'</h1><p>Your employer: <b>'+esc(employerName(u))+'</b>'+(u.type==='worker'?' <span class="small muted">(your employer is your subcontractor – not UnScramble and not the farm)</span>':'')+'</p>';
  if(u.convertedFrom)x+='<div class="alert info">Your testing account was converted to a full account. Only the items still missing for your new role are shown below.</div>';
  if(u.type==='worker'&&tempActive(subOf(u)))x+='<div class="alert warn">'+tempBadge(subOf(u))+' Your employer is working under a temporary arrangement approved by UnScramble. You can keep working and clocking your crew shifts at sites until '+esc(subOf(u).company.temp.end)+'.</div>';
  if(u.type==='employee'&&!(u.wagepoint&&u.wagepoint.added))x+='<div class="alert info">Payroll setup pending – the office still needs to add you to Wagepoint payroll.</div>';
  return x+checklistHtml(u);};

/* ---------- Registration (worker / employee) ---------- */
VIEWS['worker:register']=function(){var u=ME,p=u.profile||{};
  return '<h1>My details</h1><div class="card"><form data-form="regWorker"><div class="grid2">'+inp('name','Legal name (as on ID)',u.name,{req:true})+sel('lang','Preferred language',LANGS,p.lang,{req:true,blank:true})+inp('email','Email',u.email,{type:'email',hint:'You can sign in with your email, phone or username.'})+inp('phone','Phone (optional)',u.phone,{type:'tel'})+'</div>'+
  '<fieldset><legend>Emergency contact</legend><div class="grid2">'+inp('emName','Name',p.emName,{req:true})+inp('emRel','Relationship',p.emRel,{req:true})+inp('emContact','Phone or email',p.emContact,{req:true})+'</div></fieldset>'+
  rolesField(u)+'<div class="alert info small">UnScramble does not ask for or store your SIN. Your employer ('+esc(employerName(u))+') keeps it.</div><button>Save</button></form></div>';};
function rolesField(u){return '<fieldset><legend>Special jobs (optional)</legend>'+chk('roles[]','Driver (needs a valid licence of the right class)',hasRole(u,'driver'),{value:'driver'})+chk('roles[]','Forklift operator (needs certification)',hasRole(u,'forklift'),{value:'forklift'})+chk('roles[]','Machinery operator (needs certification)',hasRole(u,'machinery'),{value:'machinery'})+'</fieldset>';}
FORMS.regWorker=function(f,d){var u=ME;if(!d.email&&!u.username){toast('Email or username is needed.');return;}if(loginTaken(null,d.email,u.id)){toast('Email already used.');return;}
  u.name=d.name;u.email=d.email;u.phone=d.phone;u.roles=d.roles||[];Object.assign(u.profile,{lang:d.lang,emName:d.emName,emRel:d.emRel,emContact:d.emContact});audit('Updated registration',u.name);save();toast('Saved.');go('#/home');};

VIEWS['employee:register']=function(){var u=ME,p=u.profile||{},adm=ME.type==='admin';
  var sinOn=p.sin?dec(p.sin):'';
  var x='<h1>Registration &amp; payroll details</h1><p class="small muted">These details are what the office needs to add you to Wagepoint payroll. SIN, banking, date of birth and TD1 are kept in the restricted payroll area (office/payroll only).</p><form data-form="regEmp">';
  x+='<fieldset><legend>Basic information</legend><div class="grid2">'+inp('firstName','Legal first name',p.firstName,{req:true})+inp('middleName','Middle name (optional)',p.middleName)+inp('lastName','Legal last name',p.lastName,{req:true})+inp('preferredName','Preferred name (optional)',p.preferredName)+inp('email','Personal email',u.email,{type:'email',req:true,hint:'Wagepoint uses it to invite you to the employee portal.'})+inp('phone','Phone (optional)',u.phone,{type:'tel'})+inp('dob','Date of birth',p.dob,{type:'date',req:true,hint:'Restricted view. Under 18 = no CPP contributions (Wagepoint sets this).'})+sel('lang','Preferred language',LANGS,p.lang,{req:true,blank:true})+'</div></fieldset>';
  x+='<fieldset><legend>Home address</legend><div class="grid2">'+inp('street','Street address',p.street,{req:true})+inp('city','City / town',p.city,{req:true})+sel('prov','Province',['PE','NS','NB','NL','QC','ON','MB','SK','AB','BC','YT','NT','NU'],p.prov||'PE')+inp('postal','Postal code',p.postal,{req:true,ph:'A1A 1A1'})+'</div></fieldset>';
  x+='<fieldset><legend>Social Insurance Number (restricted payroll area)</legend><div class="grid2">'+inp('sin','SIN',p.sin?'':'',{ph:p.sin?'On file: •••••'+sinOn.slice(-3)+' – type to replace':'9 digits',hint:'Stored in the restricted payroll area; shown masked (last 3 digits) everywhere else. A SIN starting with 9 is temporary and needs a work permit and expiry date.'})+inp('sinExpiry','Temporary SIN expiry date (if SIN starts with 9)',p.sinExpiry,{type:'date'})+'</div>'+chk('noSin','I do not have a SIN yet (the office must tell Service Canada within 6 days of my start date)',p.noSin)+'</fieldset>';
  x+='<fieldset><legend>Job details</legend><div class="grid2">'+sel('provEmp','Province of employment',[['PE','Prince Edward Island (default)'],['NS','Nova Scotia'],['NB','New Brunswick']],p.provEmp||'PE',{dis:!adm,hint:'Default PEI. The office can change it.'})+inp('startDate','Start date (hire date)',p.startDate,{type:'date',req:true})+inp('firstDay','First day worked',p.firstDay,{type:'date'})+sel('jobTitle','Job title / role',JOB_TITLES,p.jobTitle,{req:true,blank:true})+inp('dept','Department (optional)',p.dept)+'<div><label>Hourly pay rate</label><div class="readonly-val">'+(Number(p.payRate)>0?money(p.payRate)+' / hour':'Not set yet')+'</div><div class="hint">Set by the UnScramble office only – you cannot change it here. Pay type: Hourly.</div></div>'+sel('payFreq','Pay frequency / pay group',['Bi-weekly'],'Bi-weekly')+sel('vacMethod','Vacation pay method',[['paid','4% paid out on each cheque'],['accrued','4% accrued each pay']],p.vacMethod,{req:true,blank:true})+inp('vacPct','Vacation %',p.vacPct||4,{type:'number',extra:' step="0.5"',dis:!adm,hint:'Starts at 4%; may rise with length of service – office confirms.'})+inp('wcbRate','WCB PEI rate / class (office sets)',p.wcbRate,{dis:!adm})+'</div></fieldset>';
  x+='<fieldset><legend>Tax information (TD1)</legend><div class="grid2">'+inp('td1Amount','Federal TD1 – total claim amount ($)',p.td1Amount,{type:'number',extra:' step="0.01" data-calc="td1"',hint:'<span id="td1code">'+(p.td1Amount!==''&&p.td1Amount!=null?'Claim code (estimate): '+claimCode(p.td1Amount):'')+'</span> Or upload your signed TD1 on the Documents page. New TD1 needed within 7 days of a change.'})+inp('td1peAmount','PEI TD1PE – total claim amount ($) – only if more than the basic amount',p.td1peAmount,{type:'number',extra:' step="0.01"',hint:'Leave empty to use the basic PEI claim code.'})+inp('extraTax','Additional tax per pay (optional, $)',p.extraTax,{type:'number',extra:' step="0.01"'})+'</div></fieldset>';
  x+='<fieldset><legend>Direct deposit (restricted payroll area)</legend><div class="grid2">'+inp('bankInst','Institution number (3 digits)',p.bankInst,{ph:'000'})+inp('bankTransit','Transit number (5 digits)',p.bankTransit,{ph:'00000'})+inp('bankAcct','Account number',p.bankAcct?'':'',{ph:p.bankAcct?'On file: '+last(dec(p.bankAcct),4)+' – type to replace':'7–12 digits',hint:'Shown as last 4 digits only. Any change is re-checked by the office before the next payroll. Or upload a void cheque on the Documents page.'})+'</div></fieldset>';
  x+='<fieldset><legend>Emergency contact</legend><div class="grid2">'+inp('emName','Name',p.emName,{req:true})+inp('emRel','Relationship',p.emRel,{req:true})+inp('emPhone','Phone',p.emPhone,{type:'tel',req:true})+inp('emEmail','Email',p.emEmail,{type:'email',req:true})+'</div></fieldset>';
  x+='<fieldset><legend>Prior payroll this year</legend>'+sel('priorPayroll','Has UnScramble already paid you this calendar year outside Wagepoint?',[['no','No'],['yes','Yes (upload your last paystub on the Documents page)']],p.priorPayroll,{req:true,blank:true})+'</fieldset>';
  x+=rolesField(u)+'<button>Save registration</button></form>';
  return x;};
CALC.wage=function(el){var w=document.getElementById('wagewarn');if(!w)return;var v=Number(el.value);w.innerHTML=v&&v<DB.settings.minWage?'<b style="color:#c0392b">Warning: below PEI minimum wage ($'+DB.settings.minWage.toFixed(2)+'). </b>':'';};
CALC.td1=function(el){var w=document.getElementById('td1code');if(w)w.textContent=el.value!==''?'Claim code (estimate): '+claimCode(el.value):'';};
FORMS.regEmp=function(f,d){var u=ME,p=u.profile=u.profile||{},errs=[],sinD=digits(d.sin);
  if(d.postal&&!validPostal(d.postal))errs.push('Postal code must look like A1A 1A1.');
  if(sinD&&!validSIN(sinD))errs.push('That SIN is not valid (9 digits).');
  var temp=sinD?sinD[0]==='9':p.sinTemp;if(temp&&!d.sinExpiry)errs.push('A SIN starting with 9 needs its expiry date.');
  if(d.bankInst&&!/^\d{3}$/.test(d.bankInst))errs.push('Institution number must be 3 digits.');
  if(d.bankTransit&&!/^\d{5}$/.test(d.bankTransit))errs.push('Transit number must be 5 digits.');
  if(d.bankAcct&&!/^\d{7,12}$/.test(digits(d.bankAcct)))errs.push('Account number must be 7–12 digits.');
  if(loginTaken(null,d.email,u.id))errs.push('Email already used by another account.');
  if(errs.length){toast(errs.join(' '));return;}
  var wp=u.wagepoint&&u.wagepoint.added;
  if(wp){if(d.firstName!==p.firstName||d.lastName!==p.lastName||(d.middleName||'')!==(p.middleName||''))flagWagepoint(u,'name');if(d.street!==p.street||d.city!==p.city||d.postal!==p.postal)flagWagepoint(u,'address');if(String(d.td1Amount)!==String(p.td1Amount)||String(d.td1peAmount)!==String(p.td1peAmount))flagWagepoint(u,'TD1');}
  var bankChanged=(d.bankInst&&d.bankInst!==p.bankInst)||(d.bankTransit&&d.bankTransit!==p.bankTransit)||!!d.bankAcct;
  if(bankChanged&&p.bankAcct){p.bankVerified=false;notify('admin','Banking change for '+u.name+' – re-verify before the next payroll (fraud protection).');if(wp)flagWagepoint(u,'banking');}
  ['firstName','middleName','lastName','preferredName','dob','lang','street','city','prov','startDate','firstDay','jobTitle','dept','payFreq','vacMethod','td1Amount','td1peAmount','extraTax','bankInst','bankTransit','emName','emRel','emPhone','emEmail','priorPayroll','sinExpiry'].forEach(function(k){if(d[k]!==undefined)p[k]=d[k];});
  if(d.provEmp)p.provEmp=d.provEmp;if(d.vacPct)p.vacPct=d.vacPct;if(d.wcbRate!==undefined)p.wcbRate=d.wcbRate;
  p.postal=String(d.postal||'').toUpperCase().replace(/^(...)\s?(...)$/,'$1 $2');
  if(sinD){p.sin=enc(sinD);p.sinTemp=sinD[0]==='9';audit('Changed SIN (restricted)',u.name);if(wp)flagWagepoint(u,'SIN');}
  p.noSin=!!d.noSin;if(p.noSin)notify('admin',u.name+' has no SIN yet – tell Service Canada within 6 days of the start date ('+(p.startDate||'?')+').','nosin|'+u.id);
  if(d.bankAcct)p.bankAcct=enc(digits(d.bankAcct));
  u.email=d.email;u.phone=d.phone;u.name=[d.firstName,d.lastName].join(' ');u.roles=d.roles||[];
  if(!p.sinRequested&&p.startDate)p.sinRequested=today();
  toast('Saved.');
  if(registrationComplete(u)&&!u.completedAt){u.completedAt=new Date().toISOString();notify('admin',u.name+' finished registration – ready for office review.');}
  audit('Updated registration',u.name);save();go('#/home');};

/* ---------- Documents ---------- */
function docKindsFor(u){var c=u.company||{};
  if(u.type==='sub'){var k=['wcb_clearance','cgl'];if(c.drivesWorkers)k.push('auto');if(!c.licenceNotReq)k.push('agency_licence');k.push('agreement','bank_letter');if(c.hstNotReq)k.push('hst_proof');return k;}
  var k2=u.type==='employee'?['eligibility']:[];if(hasRole(u,'driver'))k2.push('driver_licence');if(hasRole(u,'forklift')||hasRole(u,'machinery'))k2.push('forklift');
  if(u.type==='employee'){k2.push('td1','td1pe','void_cheque');if((u.profile||{}).priorPayroll==='yes')k2.push('paystub');}return k2;}
function docMetaFields(k){
  if(k==='eligibility')return sel('docType','Document type',[['citizen','Canadian passport / citizenship'],['pr','Permanent resident card'],['permit','Work permit']],'',{req:true})+inp('permitEmployer','Employer named on the work permit (work permits only)','')+inp('expiry','Permit expiry date (work permits only)','',{type:'date'});
  if(k==='driver_licence')return sel('cls','Licence class',['Class 5','DZ / Class 3','AZ / Class 1'],'',{req:true})+chk('airBrake','Air brake endorsement',false)+inp('expiry','Expiry date','',{type:'date',req:true});
  if(k==='wcb_clearance')return inp('expiry','Expiry printed on the letter (if any)','',{type:'date',hint:'The office re-checks every 90 days from the date it is verified, even if no expiry is printed.'});
  if(k==='cgl')return inp('coverage','Coverage per occurrence ($)','',{type:'number',req:true,hint:'Minimum $2,000,000. UnScramble must be named as additional insured.'})+inp('expiry','Policy expiry date','',{type:'date',req:true});
  if(k==='agreement')return inp('agreementVersion','Agreement version / date signed','');
  if(DOCS[k].expiry===true)return inp('expiry','Expiry date','',{type:'date',req:true});
  return '';}
function docsPage(u){var x='';
  docKindsFor(u).forEach(function(k){var d=latestDoc(u.id,k),st=docStatus(d),hist=docsOf(u.id,k);
    x+='<div class="card"><div class="row"><b>'+esc(DOCS[k].label)+'</b>'+pill(st)+(st.ex?'<span class="small muted">expiry/due '+esc(st.ex)+'</span>':'')+'</div>';
    if(st.note)x+='<div class="small" style="color:#c0392b">'+esc(st.note)+'</div>';
    if(st.s==='Expired'||st.s==='Expiring soon')x+='<div class="small">'+esc(fixMsg(k,st,d))+'</div>';
    if(hist.length)x+='<div class="small" style="margin:6px 0">'+hist.slice(0,3).map(function(h){return '<a href="#" data-act="viewdoc" data-id="'+h.id+'">'+esc(h.fileName)+'</a> <span class="muted">('+esc(h.status)+', uploaded '+fmtStamp(h.uploadedAt)+')</span>';}).join('<br>')+'</div>';
    x+='<details><summary class="small" style="cursor:pointer;color:var(--p2)">'+(d?'Upload a new one':'Upload')+'</summary><form data-form="upload"><input type="hidden" name="kind" value="'+k+'"><input type="hidden" name="uid" value="'+u.id+'"><div class="grid2">'+docMetaFields(k)+'<div><label class="req">File (photo or PDF, max 1.5 MB)</label><input type="file" name="file" accept="image/*,application/pdf" required></div></div><button>Upload</button></form></details></div>';});
  return x;}
VIEWS['worker:docs']=VIEWS['employee:docs']=function(){var d=docsPage(ME);return '<h1>My documents</h1>'+(docKindsFor(ME).length?'<p class="small muted">The office checks every upload before it counts.</p>':'')+(d||'<div class="msg-empty" id="docsempty"><b>No documents needed for your job.</b> Nothing to do here. If your job changes, update it in My details.</div>');};
FORMS.upload=function(f,d){var u=user(d.uid);if(!u||(u.id!==ME.id&&ME.type!=='admin')){toast('Not allowed.');return;}
  if(d.kind==='cgl'&&Number(d.coverage)<2000000){toast('Coverage must be at least $2,000,000 per occurrence.');return;}
  if(d.kind==='eligibility'&&d.docType==='permit'&&!d.expiry){toast('Work permits need an expiry date.');return;}
  readUpload(f.file.files[0],function(file){if(!file)return;
    var meta={};['docType','permitEmployer','cls','coverage','agreementVersion'].forEach(function(k){if(d[k])meta[k]=d[k];});meta.airBrake=!!d.airBrake;
    DB.docs.push({id:uid('d'),userId:u.id,kind:d.kind,status:'pending',fileName:file.name,fileType:file.type,fileData:file.data,expiry:d.expiry||'',meta:meta,uploadedAt:new Date().toISOString(),uploadedBy:ME.name});
    audit('Uploaded document',u.name,DOCS[d.kind].label);notify('admin','New upload to review: '+DOCS[d.kind].label+' – '+u.name);
    if(d.kind==='td1'||d.kind==='td1pe'||d.kind==='void_cheque')flagWagepoint(u,d.kind==='void_cheque'?'banking':'TD1');
    if(save()){toast('Uploaded – waiting for office review.');render();}});};

/* ---------- Safety / availability ---------- */
var SAFETY_ITEMS=['WHMIS','PPE (personal protective equipment)','Site orientation','Food-safety / hygiene','Right to refuse unsafe work'];
VIEWS.safety=function(){var u=ME,sa=u.safetyAck,sx=safetyExpiry(u);
  return '<h1>Safety training</h1>'+(sa?'<div class="alert '+(sx<=today()?'bad':'ok')+'">Last acknowledged '+esc(sa.date)+' – refresh due '+esc(sx)+'.</div>':'')+'<div class="card"><p>Tap each item to confirm you have completed it. This must be refreshed every year.</p><form data-form="safety">'+SAFETY_ITEMS.map(function(s){return chk('items[]','I have completed: <b>'+esc(s)+'</b>',false,{value:s,req:true});}).join('')+'<button>Acknowledge today ('+today()+')</button></form></div>'+
  '<div class="card small"><b>Site orientations recorded:</b> '+((u.orientations||[]).map(siteName).join(', ')||'none yet')+' <span class="muted">(recorded by the office for sites that require one)</span></div>';};
FORMS.safety=function(f,d){if((d.items||[]).length<SAFETY_ITEMS.length){toast('Please tick every item.');return;}ME.safetyAck={date:today(),items:d.items,at:new Date().toISOString()};audit('Safety acknowledgement',ME.name);save();toast('Thank you – recorded.');go('#/home');};
VIEWS.availability=function(){var p=ME.profile||{};
  return '<h1>Availability</h1><div class="card"><form data-form="avail"><label class="req">Days I can work</label><div class="row">'+DAYS.map(function(d){return '<label class="inline"><input type="checkbox" name="days[]" value="'+d+'"'+((p.availDays||[]).indexOf(d)>=0?' checked':'')+'> '+d+'</label>';}).join(' ')+'</div><div class="grid2">'+inp('from','From (time)',p.availFrom||'07:00',{type:'time'})+inp('to','To (time)',p.availTo||'17:00',{type:'time'})+inp('seasonStart','Start of season',p.seasonStart,{type:'date',req:true})+inp('seasonEnd','End of season',p.seasonEnd,{type:'date',req:true})+'</div><label>Notes</label><textarea name="notes">'+esc(p.availNotes||'')+'</textarea><button>Save</button></form><p class="small muted">You can update this any time.</p></div>';};
FORMS.avail=function(f,d){if(!(d.days||[]).length){toast('Choose at least one day.');return;}Object.assign(ME.profile,{availDays:d.days,availFrom:d.from,availTo:d.to,seasonStart:d.seasonStart,seasonEnd:d.seasonEnd,availNotes:d.notes});save();toast('Saved.');go('#/home');};

/* ---------- Shifts ---------- */
function roleLabel(sh){return sh.role==='driver'?'Driver'+(sh.licClass?' ('+sh.licClass+(sh.airBrake?', air brake':'')+')':''):sh.role==='forklift'?'Forklift':sh.role==='machinery'?'Machinery':'General';}
function shiftCard(sh,u,mode){var bl=blockers(u,sh.date,sh),booked=(sh.booked||[]).indexOf(u.id)>=0,full=(sh.booked||[]).length>=sh.needed;
  var x='<div class="card'+(sh.test?' hl':'')+'"><div class="row"><b>'+esc(sh.date)+' · '+esc(sh.start)+'–'+esc(sh.end)+'</b>'+(sh.test?'<span class="badge-test">TEST</span> <span class="unpaid">UNPAID – PRACTICE ONLY</span>':'')+'<span class="right pill s-mut">'+esc(roleLabel(sh))+'</span></div><div>'+esc(sh.title)+'</div><div class="small muted">'+esc(siteName(sh.site))+(sh.orientation?' · site orientation required':'')+' · '+(sh.booked||[]).length+'/'+sh.needed+' booked</div>';
  if(booked){x+='<div style="margin-top:6px"><span class="pill s-ok">You are booked</span> ';
    if(u.type==='tester'&&mode==='signup'){var te=DB.time.filter(function(t){return t.userId===u.id&&t.shiftId===sh.id&&t.date===today();})[0];
      if(sh.date===today()){if(!te)x+='<button class="small gold" data-act="clockin" data-id="'+sh.id+'">Clock in</button>';else if(!te.out)x+='<span class="small">In at '+esc(te.in)+'</span> <button class="small gold" data-act="clockout" data-id="'+te.id+'">Clock out</button>';else x+='<span class="small">Worked '+esc(te.in)+'–'+esc(te.out)+(te.test?' (TEST – unpaid)':'')+'</span>';}
      if(sh.date>today()&&mode==='signup')x+='<button class="small sec" data-act="unbook" data-id="'+sh.id+'">Cancel</button>';}
    x+='</div>';}
  else if(mode==='signup'){var gen=PAGE_STATE.genBl||{},extra=bl.filter(function(b){return !gen[b.m];});
    if(bl.length&&!extra.length)x+='<div class="small" style="margin-top:6px"><span class="pill s-bad">Blocked</span> see the list at the top of this page</div>';
    else if(bl.length)x+='<div class="alert bad small" style="margin:8px 0 0"><b>'+(extra.length<bl.length?'Blocked (list at top) and also for this shift:':'You cannot sign up for this shift:')+'</b><ul style="margin:4px 0 0 16px;padding:0">'+extra.map(function(b){return '<li>'+esc(b.m)+(b.fix?' <a href="'+b.fix+'">Fix →</a>':'')+'</li>';}).join('')+'</ul></div>';
    else x+='<div style="margin-top:6px">'+(full?'<span class="pill s-mut">Full</span>':'<button class="small" data-act="book" data-id="'+sh.id+'">Sign up</button>')+'</div>';}
  return x+'</div>';}
VIEWS['employee:shifts']=function(){var u=ME,list=DB.shifts.filter(function(s){return !s.test&&s.kind==='employee'&&s.date>=today();}).sort(function(a,b){return a.date<b.date?-1:1;});
  var g=blockers(u,today());PAGE_STATE.genBl={};g.forEach(function(b){PAGE_STATE.genBl[b.m]=1;});
  var out='<h1>Shifts</h1>'+(g.length?'<div class="alert bad"><b>You cannot sign up for shifts yet.</b> Please fix:<ul style="margin:4px 0 0 16px;padding:0">'+g.map(function(b){return '<li>'+esc(b.m)+(b.fix?' <a href="'+b.fix+'">Fix →</a>':'')+'</li>';}).join('')+'</ul></div>':'')+(list.map(function(s){return shiftCard(s,u,'signup');}).join('')||'<p>No shifts.</p>');PAGE_STATE.genBl={};return out;};
VIEWS['worker:shifts']=function(){var u=ME,mine=DB.shifts.filter(function(s){return s.kind==='crew'&&!s.test&&s.date>=today()&&(s.booked||[]).indexOf(u.id)>=0;});var bl=blockers(u,today()),tm=tempActive(subOf(u));
  return '<h1>My crew assignments</h1>'+(tm?'<div class="alert warn">'+tempBadge(subOf(u))+' Temporary arrangement: please <b>clock in and out</b> of your crew shifts here until '+esc(subOf(u).company.temp.end)+'.</div>':'<p class="small muted">Your employer ('+esc(employerName(u))+') places you on crews. You do not clock in here – your employer keeps your time records.</p>')+(bl.length?'<div class="alert bad"><b>You cannot be placed on a crew right now:</b><ul style="margin:4px 0 0 16px;padding:0">'+bl.map(function(b){return '<li>'+esc(b.m)+(b.fix?' <a href="'+b.fix+'">Fix →</a>':'')+'</li>';}).join('')+'</ul></div>':'<div class="alert ok">You can be placed on crews.</div>')+(mine.map(function(s){return shiftCard(s,u,'view');}).join('')||'<p class="muted">No upcoming crew assignments.</p>');};
VIEWS['tester:shifts']=function(){PAGE_STATE.genBl={};var u=ME,list=DB.shifts.filter(function(s){return s.test&&s.date>=today();});
  return '<h1>Practice shifts <span class="badge-test">TEST</span></h1><div class="alert warn">These are practice shifts for testing only. Real shifts are never shown to testing accounts. Any hours you clock here are <b>TEST – UNPAID</b> and never go to payroll.</div>'+list.map(function(s){return shiftCard(s,u,'signup');}).join('');};
ACT.book=function(el){var sh=DB.shifts.filter(function(s){return s.id===el.dataset.id;})[0];var bl=blockers(ME,sh.date,sh);if(bl.length){toast(bl[0].m);return;}if((sh.booked||[]).length>=sh.needed){toast('Shift is full.');return;}sh.booked.push(ME.id);audit('Signed up for '+(sh.test?'TEST ':'')+'shift',ME.name,sh.date+' '+sh.site);track('shift_signup',location.hash);save();toast('Signed up.');render();};
ACT.unbook=function(el){var sh=DB.shifts.filter(function(s){return s.id===el.dataset.id;})[0];sh.booked=sh.booked.filter(function(i){return i!==ME.id;});audit('Cancelled shift',ME.name,sh.date);save();render();};
function nowHM(){var d=new Date();return pad(d.getHours())+':'+pad(d.getMinutes());}
ACT.clockin=function(el){var sh=DB.shifts.filter(function(s){return s.id===el.dataset.id;})[0];if((sh.booked||[]).indexOf(ME.id)<0){toast('Only workers assigned to this shift can clock in.');return;}DB.time.push({id:uid('t'),userId:ME.id,shiftId:sh.id,date:today(),in:nowHM(),out:'',test:!!sh.test||ME.type==='tester',temp:ME.type==='worker'&&tempActive(subOf(ME)),subId:ME.subId||null,loc:'Location check-in (simulated)'});audit('Clocked in',ME.name,sh.test?'TEST':'');save();toast('Clocked in'+(sh.test?' (TEST – unpaid)':'')+'.');render();};
ACT.clockout=function(el){var t=DB.time.filter(function(x){return x.id===el.dataset.id;})[0];var co=clockOutHM(t,Date.now());t.out=co.out;if(co.capped){t.capped=true;notify('admin',ME.name+' clocked out more than '+MAX_SHIFT_H+' hours after starting – capped at '+MAX_SHIFT_H+' h, please check.');}audit('Clocked out',ME.name);save();toast('Clocked out.');render();};
VIEWS.hours=function(){var mine=DB.time.filter(function(t){return t.userId===ME.id;}).sort(function(a,b){return a.date<b.date?1:-1;});var tot=0;
  return '<h1>'+(ME.type==='tester'?'Test hours <span class="badge-test">TEST</span>':'My hours')+'</h1>'+(ME.type==='tester'?'<div class="alert warn">Test hours are never real work and are never paid.</div>':'<p class="small muted">Your hours go to UnScramble payroll (Wagepoint).</p>')+'<div class="tw"><table><tr><th>Date</th><th>Site</th><th>In</th><th>Out</th><th>Hours</th><th>Pay status</th></tr>'+mine.map(function(t){var sh=DB.shifts.filter(function(s){return s.id===t.shiftId;})[0]||{};var h=hrs(t.in,t.out);if(!t.test)tot+=h;return '<tr><td>'+esc(t.date)+'</td><td>'+esc(siteName(sh.site))+'</td><td>'+esc(t.in)+'</td><td>'+esc(t.out||'–')+(t.orig?'<div class="small muted">changed from '+esc(t.orig.in)+'–'+esc(t.orig.out)+' (farm change approved by office)</div>':'')+'</td><td>'+h.toFixed(2)+'</td><td>'+(t.test?'<span class="unpaid">TEST – UNPAID</span>':'Payroll')+'</td></tr>';}).join('')+'</table></div><p>Total real (payable) hours: <b>'+tot.toFixed(2)+'</b></p>';};

/* ---------- Tester screens ---------- */
VIEWS['tester:home']=function(){var u=ME,c=consentOf(u);
  return '<h1>Welcome, '+esc(u.name.split(' ')[0])+testBadge(u)+'</h1><div class="alert warn"><b>You are using a Testing for App Development account.</b> No documents are needed. Everything you do here is test activity: <b>never real work and never paid</b>.</div>'+
  '<div class="grid"><a class="choice" href="#/demo"><b>Try the registration screens</b><br><span class="small">See what subcontractors and employees fill in (nothing is saved).</span></a><a class="choice" href="#/shifts"><b>Practice shifts</b><br><span class="small">Sign up and clock in/out (TEST – unpaid).</span></a><a class="choice" href="#/invoices"><b>Test invoices</b><br><span class="small">Try the invoice screen (marked TEST, never paid).</span></a><a class="choice" href="#" data-act="feedback"><b>Send feedback</b><br><span class="small">Tell us what works and what doesn\'t.</span></a></div>'+
  '<div class="card small">Terms accepted: '+DB.acceptances.filter(function(a){return a.userId===u.id;}).map(function(a){return esc(a.name)+' v'+esc(a.version);}).join(', ')+'<br>Data-use consent: <b>'+(c&&c.choice?'Yes':'No')+'</b> (change in <a href="#/profile">Profile</a>)</div>';};
VIEWS['tester:demo']=function(){var w=PAGE_STATE.demo||'employee';
  return '<h1>Try the registration screens <span class="badge-test">DEMO</span></h1><div class="alert info">Demo only – nothing you type here is saved and no documents are needed.</div><div class="row"><button class="'+(w==='employee'?'':'sec')+'" data-act="demo" data-w="employee">Employee registration</button><button class="'+(w==='sub'?'':'sec')+'" data-act="demo" data-w="sub">Subcontractor company</button><button class="'+(w==='worker'?'':'sec')+'" data-act="demo" data-w="worker">Subcontractor worker</button></div><div class="card" id="demoArea">'+demoForm(w)+'</div>';};
ACT.demo=function(el){PAGE_STATE.demo=el.dataset.w;render();};
function demoForm(w){var real=ME,fake={id:'demo',type:w==='sub'?'sub':w,name:'',profile:{},company:{mainContact:{},emergency:{}},roles:[],subId:null};ME=fake;var h;
  try{h=(w==='employee'?VIEWS['employee:register']():w==='sub'?VIEWS['sub:company']():VIEWS['worker:register']());}finally{ME=real;PAGE_STATE.after=null;}
  return h.replace(/data-form="[^"]+"/,'data-form="demo"').replace(/<h1>.*?<\/h1>/,'');}
FORMS.demo=function(){track('demo_submit','#/demo');save();toast('Demo only – nothing was saved. Thanks for trying it!');};
VIEWS['tester:myfeedback']=function(){var mine=DB.feedback.filter(function(f){return f.userId===ME.id;});return '<h1>My feedback</h1><button class="gold" data-act="feedback">Send new feedback</button><div class="tw" style="margin-top:10px"><table><tr><th>Date</th><th>Screen</th><th>Rating</th><th>Comment</th><th>Status</th></tr>'+mine.map(function(f){return '<tr><td>'+fmtStamp(f.at)+'</td><td>'+esc(f.screen)+'</td><td>'+f.rating+'★</td><td>'+esc(f.comment)+'</td><td>'+esc(f.status)+'</td></tr>';}).join('')+'</table></div>';};
