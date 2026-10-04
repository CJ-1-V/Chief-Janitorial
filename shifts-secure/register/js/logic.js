/* Business rules: document status, requirements, blocking, alerts. */
'use strict';
function docsOf(uid_,kind){return DB.docs.filter(function(d){return d.userId===uid_&&(!kind||d.kind===kind);}).sort(function(a,b){return a.uploadedAt<b.uploadedAt?1:-1;});}
function latestDoc(uid_,kind){return docsOf(uid_,kind)[0]||null;}
function docExpiry(d){
  if(!d)return null;
  if(d.kind==='wcb_clearance'){var r=d.verifiedDate?addDays(d.verifiedDate,90):null;if(d.expiry&&(!r||d.expiry<r))return d.expiry;return r;}
  if(d.kind==='eligibility'&&d.meta&&d.meta.docType!=='permit')return null;
  return d.expiry||null;
}
/* Status words from the checklist: Missing, Pending review, Valid, Expiring soon, Expired (+Rejected shown as Missing). */
function docStatus(d,onDate){
  if(!d)return {s:'Missing',c:'s-bad'};
  if(d.status==='pending')return {s:'Pending review',c:'s-pend'};
  if(d.status==='rejected')return {s:'Missing',c:'s-bad',note:'Rejected: '+(d.reviewNote||'')};
  var ex=docExpiry(d),ref=onDate||today();
  if(ex&&ex<=ref)return {s:'Expired',c:'s-bad',ex:ex};
  if(ex&&daysBetween(today(),ex)<=30&&!onDate)return {s:'Expiring soon',c:'s-warn',ex:ex};
  return {s:'Valid',c:'s-ok',ex:ex};
}
function pill(st){return '<span class="pill '+st.c+'">'+esc(st.s)+'</span>';}
function termsCurrent(key){return DB.settings.terms[key];}
function acceptedCurrent(u,key){
  var cur=termsCurrent(key);if(!cur)return true;
  return DB.acceptances.some(function(a){return a.userId===u.id&&a.key===key&&a.version===cur.version&&(key!=='schedule_c'||a.employerId===u.subId);});
}
function requiredTerms(u){var out=[];for(var k in TERMS_DEF)if(TERMS_DEF[k].types.indexOf(u.type)>=0)out.push(k);return out;}
function missingTerms(u){return requiredTerms(u).filter(function(k){return !acceptedCurrent(u,k);});}
function subOf(u){return u&&u.subId?user(u.subId):null;}
function employerName(u){if(u.type==='employee')return 'UnScramble – The HR Company Inc.';var s=subOf(u);return s?(s.company.legalName||s.name):'(not linked)';}
function safetyExpiry(u){return u.safetyAck&&u.safetyAck.date?addDays(u.safetyAck.date,365):null;}
function hasRole(u,r){return (u.roles||[]).indexOf(r)>=0;}

/* WCB first-year rule: WCB clearance is not required (and does not block) during a subcontractor's first year
   with UnScramble, counted from the office approval / start date. Required from the 1-year mark, or earlier if the
   office marks "WCB required now" for that subcontractor. */
function addYear(s){var d=parseD(s);d.setFullYear(d.getFullYear()+1);return isoLocal(d);}
function wcbStart(s){var c=s.company||{};return c.wcbStart||s.approvedAt||null;}
function wcbDue(s){var st=wcbStart(s);return st?addYear(st):null;}
function wcbRequired(s,date){var c=s.company||{};if(c.wcbRequiredNow)return true;var due=wcbDue(s);return !!due&&(date||today())>=due;}
function wcbRuleText(s){var c=s.company||{};if(c.wcbRequiredNow)return 'Required now (set by the office).';var due=wcbDue(s);return due?(wcbRequired(s)?'Required since '+due+' (1 year after start '+wcbStart(s)+').':'Not required until '+due+' (first year with UnScramble, started '+wcbStart(s)+').'):'Not required during the first year – the year starts when the office approves the company.';}
/* Each item: {key,label,ok,st(status obj),msg(how to fix),fix(route)} */
function requirements(u){
  var R=[];function add(key,label,st,msg,fix){R.push({key:key,label:label,st:st,ok:st.s==='Valid'||st.s==='Expiring soon'||st.s==='Done'||st.s==='Not required yet',msg:msg,fix:fix});}
  var DONE={s:'Done',c:'s-ok'},TODO={s:'Missing',c:'s-bad'};
  missingTerms(u).forEach(function(k){add('terms_'+k,'Accept: '+TERMS_DEF[k].name,TODO,'Please read and accept the current version ('+termsCurrent(k).version+').','#/terms');});
  requiredTerms(u).filter(function(k){return acceptedCurrent(u,k);}).forEach(function(k){add('terms_'+k,'Accepted: '+TERMS_DEF[k].name+' v'+termsCurrent(k).version,DONE,'','#/terms');});
  if(u.type==='tester'||u.type==='admin')return R;
  if(u.type==='sub'){
    var c=u.company||{};
    var f=c.legalName&&c.operatingName&&c.address&&c.email&&/^\d{9}$/.test(c.bn||'')&&/^\d{9}RP\d{4}$/.test(c.rp||'')&&(c.hstNotReq||/^\d{9}RT\d{4}$/.test(c.hst||''))&&c.wcbAccount&&c.mainContact&&c.mainContact.name&&c.mainContact.role&&c.mainContact.email&&c.emergency&&c.emergency.name&&c.emergency.phone&&(c.supervisors||'').trim();
    add('company','Company details (Section 2)',f?DONE:TODO,'Fill in all required company details.','#/company');
    add('approved','Company approved by UnScramble office',u.approved?DONE:{s:'Pending review',c:'s-pend'},'The office will review your registration.','#/company');
    if(wcbRequired(u)){var dw=latestDoc(u.id,'wcb_clearance'),sw=docStatus(dw);add('wcb_clearance',DOCS.wcb_clearance.label,sw,fixMsg('wcb_clearance',sw,dw)+' '+wcbRuleText(u),'#/docs');}
    else add('wcb_clearance',DOCS.wcb_clearance.label+' – not required yet',{s:'Not required yet',c:'s-ok'},wcbRuleText(u)+' You can upload it early.','#/docs');
    ['cgl'].forEach(function(k){var d=latestDoc(u.id,k),st=docStatus(d);add(k,DOCS[k].label,st,fixMsg(k,st,d),'#/docs');});
    if(c.drivesWorkers){var d1=latestDoc(u.id,'auto'),s1=docStatus(d1);add('auto',DOCS.auto.label+' (you drive workers)',s1,fixMsg('auto',s1,d1),'#/docs');}
    if(c.licenceNotReq){add('agency_licence','Agency licence: "not required" – office confirmation',c.licenceNotReqConfirmed?DONE:{s:'Pending review',c:'s-pend'},'Waiting for the office to confirm.','#/company');}
    else{var d2=latestDoc(u.id,'agency_licence'),s2=docStatus(d2);add('agency_licence',DOCS.agency_licence.label,s2,fixMsg('agency_licence',s2,d2)+' (or tick "not required" in Company details)','#/docs');}
    var tm=c.termination;add('agreement_term','Agreement: '+(tm?'terminated (effective '+tm.effective+')':'active – auto-renews (no end date)'),tm&&tm.effective<=today()?{s:'Terminated',c:'s-bad'}:tm?{s:'Ending',c:'s-warn'}:DONE,tm?'The agreement was ended by '+tm.by+' ('+tm.type+'): '+tm.reason:'','#/terms');
    if(c.hstNotReq){var d3=latestDoc(u.id,'hst_proof');add('hst_proof',DOCS.hst_proof.label+' (optional)',d3?docStatus(d3):{s:'Optional',c:'s-mut'},'','#/docs');}
    var bk=c.bankAcct||latestDoc(u.id,'bank_letter');
    add('bank','Banking for payment (needed before first invoice)',!bk?TODO:c.bankVerified?DONE:{s:'Pending review',c:'s-pend'},!bk?'Add banking details and upload a void cheque or bank letter.':'Waiting for the office to verify your banking.','#/company');
    return R;
  }
  /* person (worker / employee) */
  var p=u.profile||{};
  if(u.type==='employee'){
    var miss=employeeMissingFields(u);
    add('payroll','Personal and payroll details (Wagepoint)',miss.length?TODO:DONE,miss.length?'Still needed: '+miss.join(', ')+'.':'','#/register');
  } else {
    var okf=u.name&&(u.email||u.username)&&p.lang&&p.emName&&p.emRel&&p.emContact;
    add('details','Personal details and emergency contact',okf?DONE:TODO,'Fill in your details and an emergency contact.','#/register');
  }
  var de=u.type==='employee'?latestDoc(u.id,'eligibility'):null,se=docStatus(de);
  if(u.type==='employee')add('eligibility',DOCS.eligibility.label,se,fixMsg('eligibility',se,de),'#/docs');
  if(u.type==='employee'&&de&&de.meta&&de.meta.docType==='permit'&&de.meta.permitEmployer&&!permitMatches(u,de))add('permit_match','Employer named on work permit matches your employer',{s:'Flag',c:'s-warn'},'Your permit names "'+de.meta.permitEmployer+'" but your employer is '+employerName(u)+'. The office will check this.','#/docs');
  if(hasRole(u,'driver')){var dd=latestDoc(u.id,'driver_licence'),sd=docStatus(dd);add('driver_licence',DOCS.driver_licence.label+(dd&&dd.meta?' ('+dd.meta.cls+(dd.meta.airBrake?', air brake':'')+')':''),sd,fixMsg('driver_licence',sd,dd),'#/docs');}
  if(hasRole(u,'forklift')||hasRole(u,'machinery')){var df=latestDoc(u.id,'forklift'),sf=docStatus(df);add('forklift',DOCS.forklift.label,sf,fixMsg('forklift',sf,df),'#/docs');}
  var sx=safetyExpiry(u);
  add('safety','Safety training acknowledgement (annual)',!sx?TODO:sx<=today()?{s:'Expired',c:'s-bad'}:daysBetween(today(),sx)<=30?{s:'Expiring soon',c:'s-warn'}:DONE,!sx?'Tap to acknowledge the safety training.':'Your safety acknowledgement '+(sx<=today()?'expired':'expires')+' on '+sx+'. Please refresh it.','#/safety');
  add('availability','Availability (days, times, season)',p.availDays&&p.availDays.length&&p.seasonStart&&p.seasonEnd?DONE:TODO,'Tell us when you can work.','#/availability');
  if(u.type==='worker'){
    add('confirmed','Confirmed by your employer ('+employerName(u)+')',u.confirmedBySub?DONE:{s:'Pending review',c:'s-pend'},'Your employer must confirm you in their dashboard.','#/home');
    add('originals','Employer checked original ID / permit',u.originalsChecked?DONE:{s:'Pending review',c:'s-pend'},'Your employer must confirm they checked your originals.','#/home');
    add('sin_by_sub','Employer confirms SIN collected (UnScramble does not store it)',u.sinCollectedBySub?DONE:{s:'Pending review',c:'s-pend'},'Your employer must confirm they collected your SIN.','#/home');
  } else {
    if(p.td1Amount===''||p.td1Amount==null){var t1=latestDoc(u.id,'td1');if(t1)add('td1',DOCS.td1.label,docStatus(t1),'Or enter the TD1 total claim amount.','#/register');}
    if(p.priorPayroll==='yes'){var ps=latestDoc(u.id,'paystub'),sp=docStatus(ps);add('paystub',DOCS.paystub.label,sp,'Upload your last paystub from this year.','#/docs');}
    if(p.sinTemp){var sxe=p.sinExpiry;add('sin_temp','Temporary SIN (starts with 9) expiry'+(sxe?' '+sxe:''),!sxe?TODO:sxe<=today()?{s:'Expired',c:'s-bad'}:daysBetween(today(),sxe)<=30?{s:'Expiring soon',c:'s-warn'}:DONE,'A SIN starting with 9 needs a work permit and expiry date.','#/register');}
    add('payrate','Hourly pay rate (set by the UnScramble office)',Number(p.payRate)>0?DONE:{s:'Pending review',c:'s-pend'},'The office sets your pay rate.','#/register');
    add('approved','Registration approved by UnScramble office',u.approved?DONE:{s:'Pending review',c:'s-pend'},'The office reviews your registration once everything is in.','#/home');
    add('wagepoint','Added to Wagepoint payroll (office step)',u.wagepoint&&u.wagepoint.added?DONE:u.wagepoint&&u.wagepoint.override?{s:'Done',c:'s-ok'}:{s:'Pending review',c:'s-pend'},'Payroll setup pending – the office adds you to Wagepoint.','#/home');
  }
  return R;
}
function fixMsg(k,st,d){
  var L=DOCS[k].label;
  if(st.s==='Missing')return (st.note?st.note+'. ':'')+'Upload your '+L.toLowerCase()+'.';
  if(st.s==='Pending review')return 'Uploaded – waiting for the office to review it.';
  if(st.s==='Expired')return k==='wcb_clearance'?'Your WCB clearance 90-day re-check was due on '+st.ex+'. Upload a new clearance letter.':'Your '+L.toLowerCase()+' expired on '+st.ex+'. Upload a new one.';
  if(st.s==='Expiring soon')return 'Expires on '+st.ex+'. Upload a new one before then.';
  return '';
}
function permitMatches(u,d){var a=String(d.meta.permitEmployer||'').toLowerCase().replace(/[^a-z0-9]/g,''),b=employerName(u).toLowerCase().replace(/[^a-z0-9]/g,'');if(!a)return true;return b.indexOf(a)>=0||a.indexOf(b.slice(0,10))>=0||(u.type==='employee'&&a.indexOf('unscramble')>=0);}
function employeeMissingFields(u){
  var p=u.profile||{},m=[];
  if(!p.firstName)m.push('first name');if(!p.lastName)m.push('last name');if(!u.email)m.push('personal email');
  if(!p.street||!p.city||!validPostal(p.postal))m.push('home address with valid postal code');
  if(!p.dob)m.push('date of birth');if(!p.sin&&!p.noSin)m.push('SIN');if(p.sinTemp&&!p.sinExpiry)m.push('SIN expiry date');
  if(!p.provEmp)m.push('province of employment');if(!p.startDate)m.push('start date');if(!p.jobTitle)m.push('job title');
if(!p.vacMethod)m.push('vacation pay method');
  if((p.td1Amount===''||p.td1Amount==null)&&!latestDoc(u.id,'td1'))m.push('federal TD1 claim amount (or signed TD1 upload)');
  if(!(p.bankInst&&p.bankTransit&&p.bankAcct)&&!latestDoc(u.id,'void_cheque')&&!p.chequeApproved)m.push('direct deposit banking (or void cheque)');
  if(!p.emName||!p.emPhone||!p.emEmail)m.push('emergency contact (name, phone, email)');
  if(!p.emRel)m.push('emergency contact relationship');if(!p.lang)m.push('preferred language');
  if(!p.priorPayroll)m.push('prior payroll this year (yes/no)');
  return m;
}
function registrationComplete(u){var r=requirements(u).filter(function(x){return ['approved','wagepoint','confirmed','originals','sin_by_sub','permit_match','payrate'].indexOf(x.key)<0;});return r.every(function(x){return x.ok||x.st.s==='Optional';});}
function claimCode(amount){amount=Number(amount);if(isNaN(amount))return '';if(amount<=0)return '0';if(amount<=FED_BPA)return '1';var c=1+Math.ceil((amount-FED_BPA)/FED_BAND);return c>10?'X (manual)':String(c);}

/* ---------- Blocking rules (Section 4) ---------- */
function companyBlockersRaw(s,date){
  var b=[],c=s.company||{};date=date||today();
  if(!s.active)b.push('Subcontractor account is switched off.');
  if(s.suspended)b.push('Subcontractor '+(c.legalName||s.name)+' is suspended by the office.');
  if(!s.approved)b.push('Subcontractor registration not yet approved by the office.');
  if(missingTerms(s).length)b.push('Subcontractor has not accepted the current agreement/terms.');
  if(c.termination&&c.termination.effective<=date)b.push('Subcontractor agreement was terminated (effective '+c.termination.effective+').');
  var w=latestDoc(s.id,'wcb_clearance'),ws=docStatus(w,date);
  if(wcbRequired(s,date)&&ws.s!=='Valid')b.push(ws.s==='Expired'?'Subcontractor WCB clearance 90-day re-check overdue/expired ('+ws.ex+').':'Subcontractor WCB clearance is '+ws.s+'.');
  var g=latestDoc(s.id,'cgl'),gs=docStatus(g,date);
  if(gs.s!=='Valid')b.push(gs.s==='Expired'?'Subcontractor insurance (CGL) expired on '+gs.ex+'.':'Subcontractor insurance (CGL) is '+gs.s+'.');
  else if(!(g.meta&&g.meta.additionalInsured))b.push('Office has not confirmed UnScramble is named as additional insured.');
  if(c.licenceNotReq){if(!c.licenceNotReqConfirmed)b.push('Agency licence "not required" not yet confirmed by office.');}
  else{var l=latestDoc(s.id,'agency_licence'),ls=docStatus(l,date);if(ls.s!=='Valid')b.push('Subcontractor agency licence is '+ls.s+'.');}
  return b;
}
/* ---------- Practice / temporary mode (office-approved, per subcontractor, max 30 days) ---------- */
var TEMP_EXEMPT=/registration not yet approved|WCB|insurance|additional insured|agency licence/i;
function tempInfo(s){var t=s&&s.company&&s.company.temp;if(!t||!t.on)return null;var left=daysBetween(today(),t.end);return {t:t,left:left,active:left>=0};}
function tempActive(s,date){var i=tempInfo(s);return !!(i&&i.active&&(!date||date<=i.t.end));}
function companyBlockers(s,date){var b=companyBlockersRaw(s,date);if(tempActive(s,date||today()))b=b.filter(function(m){return !TEMP_EXEMPT.test(m);});return b;}
function companyCompliant(s){return companyBlockersRaw(s).length===0;}
function tempBadge(s){var i=tempInfo(s);if(!i||!i.active)return '';return '<span class="badge-temp">PRACTICE / TEMPORARY · ends '+esc(i.t.end)+' ('+(i.left===0?'last day':i.left+' day'+(i.left===1?'':'s')+' left')+')</span>';}
function heldInvoices(s){return DB.invoices.filter(function(i){return i.subId===s.id&&!i.test&&i.heldTemp&&i.status!=='Paid';});}
function invoiceHeld(i){if(!i.heldTemp||i.test||i.status==='Paid')return false;var s=user(i.subId);if(!s)return false;if(!companyCompliant(s))return true;return (i.heldWorkers||[]).some(function(id){var w=user(id);return w&&!workerDocsComplete(w);});}
function heldAmount(s){return heldInvoices(s).filter(invoiceHeld).reduce(function(a,i){return a+i.total;},0);}
function processTemp(){var changed=false;
  users('sub').forEach(function(s){var i=tempInfo(s);if(!i)return;
    if(i.left<0){var t=s.company.temp;t.on=false;t.expiredAt=today();(s.company.tempHistory=s.company.tempHistory||[]).push({what:'Expired automatically',at:new Date().toISOString(),end:t.end,reason:t.reason,by:'system'});
      var ok=companyCompliant(s);notify(['admin',s.id],'Practice / temporary mode for '+(s.company.legalName||s.name)+' ended on '+t.end+'. '+(ok?'They are now compliant – normal rules apply.':'They are NOT compliant, so they and all their workers are blocked again until fixed.'),'tmpx|'+s.id+'|'+t.end);
      audit('Temporary mode expired',s.name,ok?'compliant':'blocked again');changed=true;return;}
    var m=currentMark(i.left,[7,3,1]);if(m!==null)notify('admin','Practice / temporary mode for '+(s.company.legalName||s.name)+' ends on '+i.t.end+' ('+i.left+' day'+(i.left===1?'':'s')+' left). Still missing: '+(companyBlockersRaw(s).join(' ')||'nothing – compliant now')+'.','tmpa|'+s.id+'|'+i.t.end+'|'+m);});
  return changed;}

function blockers(u,date,shift){
  date=date||today();var b=[];
  if(!u.active)b.push({m:'This account is switched off by the office.',fix:''});
  if(u.suspended)b.push({m:'This account is suspended by the office.',fix:''});
  missingTerms(u).forEach(function(k){b.push({m:'You have not accepted the current '+TERMS_DEF[k].name+' (v'+termsCurrent(k).version+').',fix:'#/terms'});});
  if(u.type==='tester'){if(shift&&!shift.test)b.push({m:'Testing accounts can never be placed on a real shift or real crew.',fix:''});return b;}
  if(shift&&shift.test)b.push({m:'Practice (TEST) shifts are only for testing accounts.',fix:''});
  if(u.type==='sub'||u.type==='admin')return b;
  requirements(u).forEach(function(r){
    if(r.key.indexOf('terms_')===0||r.key==='permit_match')return;
    if(r.key==='driver_licence'||r.key==='forklift'||r.key==='wagepoint')return; /* checked below */
    if(!r.ok&&r.st.s!=='Optional')b.push({m:r.label+': '+r.st.s+'. '+r.msg,fix:r.fix});
  });
  /* check against the shift date, not only today */
  if(date>today()){
    var de=u.type==='employee'?latestDoc(u.id,'eligibility'):null,se=docStatus(de,date);if(de&&de.status==='approved'&&se.s==='Expired')b.push({m:'Your work permit expires on '+se.ex+', before or on this shift date ('+date+'). Upload a new one.',fix:'#/docs'});
    var sx=safetyExpiry(u);if(sx&&sx<=date&&sx>today())b.push({m:'Your safety acknowledgement expires on '+sx+', before this shift. Refresh it.',fix:'#/safety'});
    var p=u.profile||{};if(p.sinTemp&&p.sinExpiry&&p.sinExpiry<=date)b.push({m:'Your temporary SIN expires on '+p.sinExpiry+', before this shift.',fix:'#/register'});
  }
  if(shift){
    if(shift.role==='driver'){var d=latestDoc(u.id,'driver_licence'),sd=docStatus(d,date);
      if(sd.s!=='Valid')b.push({m:"Driver shift: your driver's licence is "+sd.s+(sd.ex?' ('+sd.ex+')':'')+'. Upload a valid licence.',fix:'#/docs'});
      else if(shift.licClass&&d.meta&&!licenceCovers(d.meta.cls,shift.licClass))b.push({m:'Driver shift needs '+shift.licClass+'; your licence is '+d.meta.cls+'.',fix:'#/docs'});
      else if(shift.airBrake&&!(d.meta&&d.meta.airBrake))b.push({m:'Driver shift needs an air brake endorsement.',fix:'#/docs'});
      if(u.type==='worker'){var s0=subOf(u);if(s0&&!(s0.company||{}).drivesWorkers)b.push({m:'Your employer has no auto liability on file for driving.',fix:''});else if(s0){var a=docStatus(latestDoc(s0.id,'auto'),date);if(a.s!=='Valid')b.push({m:'Your employer\'s auto liability certificate is '+a.s+'.',fix:''});}}
    }
    if(shift.role==='forklift'||shift.role==='machinery'){var f=docStatus(latestDoc(u.id,'forklift'),date);if(f.s!=='Valid')b.push({m:'Forklift/machinery shift: your certification is '+f.s+'.',fix:'#/docs'});}
    if(shift.orientation&&!((u.orientations||[]).indexOf(shift.site)>=0))b.push({m:'This site needs a site orientation first ('+shift.site+'). Ask the office/your employer to record it.',fix:''});
  }
  if(u.type==='worker'){var s=subOf(u);if(!s)b.push({m:'Not linked to an employer.',fix:''});else companyBlockers(s,date).forEach(function(x){b.push({m:'Employer: '+x,fix:''});});}
  if(u.type==='employee'&&!(u.wagepoint&&(u.wagepoint.added||u.wagepoint.override)))b.push({m:'Payroll setup pending: not yet added to Wagepoint.',fix:''});
  /* de-dup */
  var seen={};return b.filter(function(x){if(seen[x.m])return false;seen[x.m]=1;return true;});
}
function licenceCovers(have,need){var rank={'Class 5':1,'DZ / Class 3':2,'AZ / Class 1':3};return (rank[have]||0)>=(rank[need]||0);}

/* Remove non-compliant bookings, notify admin + subcontractor */
function sweepBookings(){
  var changed=false;
  DB.shifts.forEach(function(sh){
    if(sh.date<today())return;
    sh.booked=(sh.booked||[]).filter(function(id){
      var u=user(id);if(!u)return false;
      var bl=blockers(u,sh.date,sh);
      if(bl.length){
        changed=true;var txt=u.name+' was removed from '+(sh.test?'TEST practice shift':'shift')+' '+sh.date+' '+sh.site+' ('+sh.title+'): '+bl[0].m;
        notify(['admin',u.id].concat(u.subId?[u.subId]:[]),txt,'rm|'+sh.id+'|'+id+'|'+sh.date);
        audit('Auto-removed booking',u.name,txt);return false;}
      return true;});
  });
  return changed;
}
/* Expiry alerts (30/14/7/1/0 days; WCB re-check 14/7/1), invoice reminders, payroll cut-off reminder */
function runAlerts(){
  processTemp();var t=today();
  DB.docs.forEach(function(d){
    if(d.status!=='approved')return;var ex=docExpiry(d);if(!ex)return;var u=user(d.userId);if(!u||!u.active)return;
    var left=daysBetween(t,ex),marks=d.kind==='wcb_clearance'?[14,7,1,0]:[30,14,7,1,0];
    var cur=newestDocOfKind(d);if(cur!==d)return;
    if(d.kind==='wcb_clearance'&&!wcbRequired(u,ex))return;
    var m=currentMark(left,marks);if(m===null)return;
    var what=d.kind==='wcb_clearance'?'WCB clearance 90-day re-check':DOCS[d.kind].label;
    var txt=(left<=0?'EXPIRED: ':'Reminder: ')+u.name+' – '+what+(left<=0?' expired/was due on ':' is due/expires on ')+ex+(left>0?' ('+left+' day'+(left===1?'':'s')+' left)':'')+'.';
    var to=['admin',u.id];if(u.subId)to.push(u.subId);notify(to,txt,'exp|'+d.id+'|'+ex+'|'+m);
  });
  users('worker').concat(users('employee')).forEach(function(u){var sx=safetyExpiry(u);if(!sx||!u.active)return;var m=currentMark(daysBetween(t,sx),[30,14,7,1,0]);if(m!==null)notify(['admin',u.id].concat(u.subId?[u.subId]:[]),(m===0?'EXPIRED: ':'Reminder: ')+u.name+' – safety training refresh due '+sx+'.','safe|'+u.id+'|'+sx+'|'+m);});
  users('sub').forEach(function(s){
    if(!s.approved||!s.active||(s.company||{}).wcbRequiredNow)return;var due=wcbDue(s);if(!due)return;var left=daysBetween(t,due);
    if(docStatus(latestDoc(s.id,'wcb_clearance'),due).s==='Valid')return;
    var m=currentMark(left,[30,14,7,1,0]);if(m===null)return;
    notify(['admin',s.id],(left<=0?'WCB clearance is now required: ':'Reminder: ')+(s.company.legalName||s.name)+' – WCB clearance '+(left<=0?'has been required since ':'becomes required on ')+due+' (1 year with UnScramble)'+(left>0?' – '+left+' day'+(left===1?'':'s')+' left. Upload a WCB clearance letter before then or workers will be blocked from shifts.':'. Workers are blocked until a valid clearance is uploaded and checked.'),'wcb1y|'+s.id+'|'+due+'|'+m);
  });
  users('sub').forEach(function(s){
    if(!s.approved||!s.active)return;var due=invoiceDue(s);
    if(due){var late=daysBetween(due.periodEnd,t);[0,3,7].filter(function(m){return late>=m&&(m===7||late<(m===0?3:7));}).forEach(function(m){notify(s.id,(m===0?'Your invoice is due':'Reminder ('+m+' days): your invoice is still not submitted')+' for '+due.periodStart+' to '+due.periodEnd+'. Invoices more than 60 days late are not payable.','inv|'+s.id+'|'+due.periodEnd+'|'+m);});}
    DB.records.forEach(function(r){if(r.subId===s.id&&r.status==='Open'&&r.due<t)notify(['admin',s.id],'Records request overdue (due '+r.due+'): '+r.text,'rr|'+r.id);});
  });
  var cut=DB.settings.payrollCutoff;if(cut){var l=daysBetween(t,cut);if(l>=0&&l<=2){var pend=users('employee').filter(function(u){return u.approved&&!(u.wagepoint&&u.wagepoint.added);});if(pend.length)notify('admin','Payroll cut-off '+cut+': '+pend.length+' employee(s) still "Payroll setup pending" (not added to Wagepoint): '+pend.map(function(u){return u.name;}).join(', '),'cut|'+cut);}}
}
function currentMark(left,marks){var best=null;marks.forEach(function(m){if(left<=m&&(best===null||m<best))best=m;});return best;}
function newestDocOfKind(d){return latestDoc(d.userId,d.kind);}
function invoiceDue(s){
  var mine=DB.invoices.filter(function(i){return i.subId===s.id&&!i.test;}).sort(function(a,b){return a.periodEnd<b.periodEnd?1:-1;});
  var start=mine.length?addDays(mine[0].periodEnd,1):(s.company&&s.company.periodStart)||addDays(today(),-29);
  var end=addDays(start,29);
  return {periodStart:start,periodEnd:end,overdue:end<today(),daysLate:daysBetween(end,today())};
}
function paymentHold(s){
  var r=[],c=s.company||{};
  var w=docStatus(latestDoc(s.id,'wcb_clearance'));if(wcbRequired(s)&&(w.s==='Expired'||w.s==='Missing'))r.push('WCB clearance '+(w.s==='Expired'?'lapsed ('+w.ex+')':'missing'));
  var g=docStatus(latestDoc(s.id,'cgl'));if(g.s==='Expired'||g.s==='Missing')r.push('insurance (CGL) '+(g.s==='Expired'?'lapsed ('+g.ex+')':'missing'));
  DB.records.forEach(function(x){if(x.subId===s.id&&x.status==='Open'&&x.due<today())r.push('records request overdue (due '+x.due+')');});
  if(c.bankAcct&&!c.bankVerified)r.push('banking change waiting for office verification');
  var ti=tempInfo(s);if(ti&&ti.active)r.unshift('Practice / temporary mode is on until '+ti.t.end+' – your invoices/payments are on hold until you are fully compliant');
  else{var h=heldInvoices(s).filter(invoiceHeld);if(h.length)r.unshift('payment on hold for '+h.length+' invoice(s) from the temporary period until you are compliant');}
  return r;
}
