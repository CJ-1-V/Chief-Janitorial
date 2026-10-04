/* v2-farmrates.js – Farm sign-up + per-farm labour rates (Rate Schedule). TEST ONLY.
   1) A farm that signs up is "Pending office review".
   2) The office enters the rates that farm is charged per role (+ optional overtime rate, HST on/off), with an effective date and a version.
   3) The farm sees the Rate Schedule with the Independent Contractor Service Agreement and signs both (copy includes the rate schedule).
   4) No shifts at that farm can be booked or assigned until rates are set AND signed.
   5) When the office changes rates, the farm must re-accept (new version; old signed versions kept). New bookings are blocked until
      re-accepted; existing bookings are flagged to the office. New rates apply only after acceptance.
   6) Farms never see subcontractor pay rates or worker pay. The farm's amount owed / HST uses the farm's signed rates. */
'use strict';
var FARM_RATE_ROLES=[['labour','General labour (field / grading / packing)'],['painting','Painting'],['forklift','Forklift operator (incl. bin piler)'],['driver','Truck driver']];
var FARM_OT_NOTE='Overtime rate (optional) applies to billable hours over 48 in a week per worker (PEI standard week – placeholder, owner to confirm).';
TYPES.firm=TYPES.firm||'Farm / business (client)';
function farmRateList(firm){return (DB.farmRates||[]).filter(function(r){return r.firmId===firm.id;}).sort(function(a,b){return a.version-b.version;});}
function farmRatesCur(firm){var l=farmRateList(firm);return l[l.length-1]||null;}
function farmSigsOf(firm){return (DB.firmSigs||[]).filter(function(s){return s.firmId===firm.id;});}
function farmRateAccepted(firm,v){return farmSigsOf(firm).filter(function(s){return s.rateVersion===v;})[0]||null;}
function farmRatesReady(firm){var c=farmRatesCur(firm);return !!(c&&farmRateAccepted(firm,c.version));}
function farmBookable(firm){return firm.accountApproved!==false&&firm.active!==false&&!!farmRatesCur(firm)&&firmSignedEver(firm)&&farmRatesReady(firm);}
function farmStatus(firm){var c=farmRatesCur(firm);
  if(firm.accountApproved===false)return {t:'Pending office review',c:'s-pend',why:'The office has not approved this farm account or set its rates yet.'};
  if(!c)return {t:'Approved – waiting for office to set rates',c:'s-bad',why:'The office has not entered this farm\'s labour rates yet.'};
  if(!firmSignedEver(firm)||!farmSigsOf(firm).some(function(s){return s.rateVersion;}))return {t:'Rates set (v'+c.version+') – waiting for farm to sign',c:'s-bad',why:'The farm has not signed the agreement and Rate Schedule yet.'};
  if(!farmRatesReady(firm))return {t:'New rates v'+c.version+' – waiting for farm to re-accept',c:'s-warn',why:'The office changed the rates; the farm must accept the new Rate Schedule.'};
  return {t:'Active – rates v'+c.version+' signed',c:'s-ok',why:''};}
function rateRowsHtml(r){if(!r)return '<p class="small muted">No rates set yet.</p>';
  var rows=FARM_RATE_ROLES.filter(function(x){return r.rates[x[0]]>0;}).map(function(x){return '<tr><td>'+esc(x[1])+'</td><td style="text-align:right"><b>'+money(r.rates[x[0]])+'</b> / h</td></tr>';});
  if(r.other&&r.other.name&&r.other.rate>0)rows.push('<tr><td>'+esc(r.other.name)+'</td><td style="text-align:right"><b>'+money(r.other.rate)+'</b> / h</td></tr>');
  rows.push('<tr><td>Overtime</td><td style="text-align:right">'+(r.overtime>0?'<b>'+money(r.overtime)+'</b> / h':'not set')+'</td></tr>');
  rows.push('<tr><td>HST</td><td style="text-align:right">'+(r.hst?'15% added':'not charged')+'</td></tr>');
  return '<table class="no-stack ratesched"><tr><th>Role</th><th style="text-align:right">Rate charged to the farm</th></tr>'+rows.join('')+'</table><div class="small muted">Rate Schedule version '+r.version+' · effective '+esc(r.effective)+(r.overtime>0?' · '+esc(FARM_OT_NOTE):'')+'</div>';}

/* ---------- 1) farm sign-up → Pending office review ---------- */
(function(){var os=VIEWS.signup;VIEWS.signup=function(){return os().replace('<p class="small muted" style="margin-top:14px">Only for app testing:</p>','<a class="choice" href="#/signup/firm"><b>Farm / business (client)</b><br><span class="small">You want UnScramble to supply workers. The office reviews your request and sets your rates; then you sign the agreement and Rate Schedule.</span></a><p class="small muted" style="margin-top:14px">Only for app testing:</p>');};
  var of=VIEWS.signupForm;VIEWS.signupForm=function(h){if(h.split('/')[2]!=='firm')return of(h);
    return '<div class="login-wrap"><div class="card"><h1>Sign up: Farm / business (client)</h1><div class="alert info small">After you send this, your account is <b>Pending office review</b>. The office sets the labour rates for your farm; then you sign the Independent Contractor Service Agreement and your Rate Schedule in the app. No shifts can be booked before that.</div><form data-form="firmsignup">'+
    inp('name','Farm / business legal name','',{req:true})+inp('contact','Contact person','',{req:true})+inp('email','Business email','',{type:'email',req:true})+inp('username','Username (optional)','')+inp('phone','Phone (optional)','',{type:'tel'})+inp('site','Farm location / site name (optional)','')+
    inp('pw','Password','',{type:'password',req:true})+inp('pw2','Repeat password','',{type:'password',req:true})+'<button type="submit">Request sign-up</button> <a href="#/signup" class="btn sec">Back</a></form></div></div>';};})();
FORMS.firmsignup=function(f,d){if(!d.name||!d.contact||!d.email){toast('Enter the farm name, contact person and email.');return;}
  if(d.pw.length<6){toast('Password must be at least 6 characters.');return;}if(d.pw!==d.pw2){toast('Passwords do not match.');return;}
  if(loginTaken(d.username,d.email)){toast('That username or email is already used.');return;}
  var u={id:uid('u'),type:'firm',name:d.name,username:d.username,email:d.email,phone:d.phone,passHash:hashPw(d.pw),active:true,suspended:false,approved:false,accountApproved:false,createdAt:new Date().toISOString(),lastLogin:new Date().toISOString(),profile:{},roles:[],orientations:[],firm:{billRate:0,contact:d.contact,siteRequest:d.site||''}};
  DB.users.push(u);ME=u;sessionStorage.setItem('us-test-me',u.id);audit('Farm sign-up requested',u.name,'Pending office review');notify('admin','New farm sign-up – Pending office review: '+u.name+' (contact '+d.contact+'). Set its labour rates in Farms.');logLogin(u,u.username||u.email,true,'New farm account (signed up)');save();toast('Request sent – pending office review.');go('#/pending');};
(function(){var op=VIEWS.pending;VIEWS.pending=function(){if(!ME||ME.type!=='firm')return op();
  return '<h1>Pending office review</h1><div class="alert warn"><b>Status: Pending office review.</b> UnScramble will check your request and set the labour rates for your farm. You will then be asked to sign the Independent Contractor Service Agreement and your Rate Schedule. No shifts can be booked until both are signed.</div><div class="card small">Farm: '+esc(ME.name)+'<br>Requested: '+fmtStamp(ME.createdAt)+'</div>';};})();

/* ---------- 2) office enters rates per farm (versioned, effective date) ---------- */
ACT.farmratesmodal=function(el){var f=user(el.dataset.id),c=farmRatesCur(f)||{rates:{},hst:true,overtime:null,other:null};
  modal('<h2>Labour rates for '+esc(f.name)+'</h2><p class="small">These are the rates <b>this farm is charged</b>. The farm sees them as its Rate Schedule and must sign it before any shift there can be booked. Saving makes a new version; if the farm already signed, it must accept again and the new rates apply only after it accepts. Leave a role empty if it is not offered.</p><form data-form="farmrates" id="farmratesform"><input type="hidden" name="id" value="'+f.id+'"><div class="grid2">'+
    FARM_RATE_ROLES.map(function(x){return inp('r_'+x[0],x[1]+' ($/h)',c.rates[x[0]]||'',{type:'number'});}).join('')+
    inp('otherName','Other role (optional, e.g. Pruning)',c.other?c.other.name:'')+inp('otherRate','Other role rate ($/h)',c.other?c.other.rate:'',{type:'number'})+
    inp('overtime','Overtime rate ($/h, optional)',c.overtime||'',{type:'number',hint:FARM_OT_NOTE})+inp('effective','Effective date',today(),{type:'date',req:true,hint:'Applies from this date or from the farm\'s acceptance, whichever is later.'})+'</div>'+
    chk('hst','<b>Charge HST (15%)</b> to this farm',c.hst!==false)+inp('reason',farmRatesCur(f)?'What changed (required)':'Note (optional)','',{req:!!farmRatesCur(f)})+'<button>Save rates (version '+((farmRatesCur(f)||{version:0}).version+1)+')</button></form>');
  [].forEach.call(document.querySelectorAll('#farmratesform input[type=number]'),function(i){i.step='0.01';i.min='0';});};
FORMS.farmrates=function(f,d){var firm=user(d.id);if(!firm||firm.type!=='firm'){toast('Not a farm.');return;}var rates={},any=false;
  FARM_RATE_ROLES.forEach(function(x){var v=d['r_'+x[0]];if(v!==''&&v!=null){var n=Math.round(Number(v)*100)/100;if(!(n>0)){any=null;return;}rates[x[0]]=n;if(any!==null)any=true;}});
  if(any===null){toast('Rates must be numbers above 0.');return;}if(!any){toast('Enter at least one role rate.');return;}
  var ot=d.overtime===''||d.overtime==null?null:Math.round(Number(d.overtime)*100)/100;if(ot!==null&&!(ot>0)){toast('Overtime rate must be above 0, or leave it empty.');return;}
  var other=null;if(d.otherName||d.otherRate){var orr=Math.round(Number(d.otherRate)*100)/100;if(!d.otherName||!(orr>0)){toast('Give the other role a name and a rate.');return;}other={name:d.otherName,rate:orr};}
  if(!d.effective){toast('Pick an effective date.');return;}var prev=farmRatesCur(firm);if(prev&&!d.reason){toast('Say what changed.');return;}
  var r={id:uid('fr'),firmId:firm.id,version:(prev?prev.version:0)+1,effective:d.effective,rates:rates,other:other,overtime:ot,hst:!!d.hst,by:ME.name,at:new Date().toISOString(),reason:d.reason||''};
  (DB.farmRates=DB.farmRates||[]).push(r);if(rates.labour)firm.firm.billRate=rates.labour;
  audit('Set farm labour rates',firm.name,'v'+r.version+' effective '+r.effective+(prev?' – '+r.reason:''));
  notify(firm.id,prev?'UnScramble updated your Rate Schedule (version '+r.version+'). Please sign in and accept it – new shifts can\'t be booked until you do. '+r.reason:'UnScramble set your labour rates. Please sign in and sign the agreement and your Rate Schedule.');
  save();closeModal();toast('Rates saved (version '+r.version+') – the farm '+(prev?'must re-accept.':'can now sign.'));render();};

/* office Farms page: status + rates per farm */
(function(){var of=VIEWS['admin:firms'];VIEWS['admin:firms']=function(){
  var x='<div class="card hl" id="farmrates"><h2 style="margin-top:0">Farm & other client sign-up, rates & signing</h2><p class="small">Farms that sign up are <b>Pending office review</b>. Enter the rates each farm is charged per role (plus optional overtime and HST on/off). The farm then signs the agreement and its Rate Schedule. <b>No shifts at a farm can be booked or assigned until its rates are set and signed.</b> Changing rates makes a new version the farm must re-accept; until then new bookings are blocked and existing bookings are flagged. Farms never see subcontractor or worker pay.</p><div class="tw"><table id="farmstatus"><tr><th>Farm</th><th>Status</th><th>Current rates</th><th>Signed versions (history)</th><th></th></tr>'+
  users('firm').map(function(f){var st=farmStatus(f),c=farmRatesCur(f),sigs=farmSigsOf(f).filter(function(s){return s.rateVersion;}),flag=farmBookedFlag(f);
    return '<tr data-firm="'+esc(f.username||f.id)+'"><td><b>'+esc(f.name)+'</b><div class="small muted">'+esc((f.firm||{}).contact||'')+'</div></td><td><span class="pill '+st.c+'">'+esc(st.t)+'</span>'+(flag?'<div class="small" style="color:#a33">'+flag+' booked shift(s) flagged – rates not re-accepted</div>':'')+'</td><td class="small">'+(c?FARM_RATE_ROLES.filter(function(r){return c.rates[r[0]];}).map(function(r){return esc(r[1].split(' (')[0])+' '+money(c.rates[r[0]]);}).join('<br>')+(c.other?'<br>'+esc(c.other.name)+' '+money(c.other.rate):'')+'<br>OT '+(c.overtime?money(c.overtime):'–')+' · HST '+(c.hst?'on':'off')+'<br><span class="muted">v'+c.version+' eff. '+esc(c.effective)+'</span>':'–')+'</td><td class="small">'+(sigs.length?sigs.map(function(s){return 'Rates v'+s.rateVersion+' + agreement v'+esc(s.version)+' – '+esc(s.signerName)+', '+fmtStamp(s.at)+' <button class="small sec" data-act="firmagrdl" data-id="'+s.id+'">Copy</button>';}).join('<br>'):'–')+'</td><td>'+(f.accountApproved===false?'<button class="small" data-act="approvenew" data-id="'+f.id+'">Approve account</button> ':'')+'<button class="small" data-act="farmratesmodal" data-id="'+f.id+'">'+(c?'Change rates':'Set rates')+'</button></td></tr>';}).join('')+'</table></div></div>';
  return x+of();};})();
function farmBookedFlag(firm){if(farmRatesReady(firm)||!farmRatesCur(firm))return 0;var codes=firmCodes(firm);return DB.shifts.filter(function(s){return !s.test&&s.date>=today()&&codes.indexOf(s.site)>=0&&(s.booked||[]).length;}).length;}
(function(){var of=adminFlags;adminFlags=function(){var f=of();users('firm').forEach(function(fm){if(fm.active===false)return;var st=farmStatus(fm);if(st.c!=='s-ok')f.push({t:'Farm: '+fm.name,c:st.t+(farmBookedFlag(fm)?' – '+farmBookedFlag(fm)+' booked shift(s) flagged':''),h:'#/firms'});});return f;};})();

/* ---------- 4) booking / assigning blocked until rates set AND signed. After a rate change, workers already booked stay booked (flagged to the office); new bookings are blocked. ---------- */
(function(){var ob=blockers;blockers=function(u,date,shift){var b=ob(u,date,shift);if(shift&&!shift.test){var f=firmOfSite(shift.site);
  var already=(shift.booked||[]).indexOf(u.id)>=0&&farmRatesCur(f)&&farmSigsOf(f).some(function(x){return x.rateVersion;});
  if(f&&firmSignedEver(f)&&!farmBookable(f)&&!already)b.push({m:'Shifts at '+f.name+' are blocked: '+farmStatus(f).t+'.',fix:''});
  else if(f&&!firmSignedEver(f)&&!farmRatesCur(f))b.push({m:'Shifts at '+f.name+' are blocked: rates not set by the office yet.',fix:''});}return b;};})();
(function(){var on=FORMS.newshift;FORMS.newshift=function(f,d){var fm=firmOfSite(d.site);if(fm&&!farmBookable(fm))toast('Note: '+fm.name+' – '+farmStatus(fm).t+'. Nobody can be booked on this shift until that is fixed.');return on(f,d);};})();

/* ---------- 3) farm signs agreement + Rate Schedule together ---------- */
firmAgrCard=function(firm,forOffice){var a=firmAgr(),s=firmSig(firm),c=farmRatesCur(firm),st=farmStatus(firm);
  var hist=farmSigsOf(firm).slice().reverse().map(function(x){return '<li>'+fmtStamp(x.at)+' '+esc(x.tz)+' – agreement v'+esc(x.version)+(x.rateVersion?' + Rate Schedule v'+x.rateVersion:'')+' – '+esc(x.signerName)+' ('+esc(x.title)+') <button class="small sec" data-act="firmagrprint" data-id="'+x.id+'">Print / PDF</button> <button class="small sec" data-act="firmagrdl" data-id="'+x.id+'">Download</button></li>';}).join('');
  if(!c)return '<div class="card hl" id="firmagr"><h2 style="margin-top:0">Shifts blocked – waiting for your rates</h2><div class="alert bad"><b>No shifts can be booked yet.</b> UnScramble has not set the labour rates for your farm. When it does, you will sign the '+esc(FIRM_AGR_NAME)+' and your Rate Schedule here.</div></div>';
  var curAgr=firmSignedCurrent(firm),curRates=farmRatesReady(firm);
  if(curAgr&&curRates)return '<div class="card" id="firmagr"><b>'+esc(FIRM_AGR_NAME)+' + Rate Schedule</b> <span class="pill s-ok">Signed – agreement v'+esc(s.version)+', rates v'+c.version+'</span>'+rateRowsHtml(c)+'<div class="small">Signed by '+esc(s.signerName)+' ('+esc(s.title)+') on '+fmtStamp(s.at)+' '+esc(s.tz)+'.</div><button class="small sec" data-act="firmagrprint" data-id="'+s.id+'">Print / save as PDF</button> <button class="small sec" data-act="firmagrdl" data-id="'+s.id+'">Download copy</button>'+(hist?'<details><summary class="small">Signed versions (history)</summary><ul class="small">'+hist+'</ul></details>':'')+'</div>';
  var why=!s?'Please sign the agreement and your Rate Schedule. <b>No shifts can be booked until you do.</b>':!curRates?'<b>UnScramble changed your rates (Rate Schedule v'+c.version+').</b> Please review and accept. New shifts can\'t be booked until you do; the new rates apply only after you accept.':'A new version of the agreement was published. You signed v'+esc(s.version)+' on '+fmtStamp(s.at)+'. Please review and sign again.';
  return '<div class="card hl" id="firmagr"><h2 style="margin-top:0">Sign: '+esc(FIRM_AGR_NAME)+' + Rate Schedule</h2><div class="alert '+(curRates?'warn':'bad')+' small">'+why+'</div><p class="small muted">'+esc(a.label)+' · agreement app version '+esc(a.version)+'</p>'+
  '<div class="terms-text">'+esc(firmAgreementText(firm.name))+'</div><h3>Rate Schedule (Appendix "A" – schedule of labour charges)</h3>'+rateRowsHtml(c)+
  '<form data-form="firmsign"><div class="grid2">'+inp('signerName','Your full name','',{req:true})+inp('title','Your title (e.g. Owner, Farm Manager)','',{req:true})+'</div>'+chk('authorized','<b>I\'m authorized to sign for this farm</b> ('+esc(firm.name)+').',false,{req:true})+inp('signature','Type your name as your signature','',{req:true,ph:'Typed signature'})+'<div class="hint">You are signing the agreement and Rate Schedule v'+c.version+' together. Your name, title, both versions, and the date, time and time zone are recorded. You can print or save a PDF copy (it includes the rate schedule).</div><button>Sign agreement + Rate Schedule</button></form>'+(hist?'<details><summary class="small">Signed versions (history)</summary><ul class="small">'+hist+'</ul></details>':'')+'</div>';};
(function(){var os=FORMS.firmsign;FORMS.firmsign=function(f,d){var firm=ME;if(!firm||firm.type!=='firm'){toast('Not allowed.');return;}var c=farmRatesCur(firm);if(!c){toast('Your rates are not set yet – the office will set them first.');return;}
  var n=(DB.firmSigs||[]).length;os(f,d);if((DB.firmSigs||[]).length>n){var s=DB.firmSigs[DB.firmSigs.length-1];s.rateVersion=c.version;s.rateSnapshot=JSON.parse(JSON.stringify(c));
    audit('Farm accepted Rate Schedule',firm.name,'v'+c.version);notify('admin',firm.name+' accepted Rate Schedule v'+c.version+'.');save();render();}};})();
(function(){var oh=firmSigHtml;firmSigHtml=function(s){var h=oh(s);if(!s.rateSnapshot)return h;
  return h.replace('<div class="sig">','<h2 style="color:#332E57;font-size:16px">Rate Schedule v'+s.rateSnapshot.version+' (Appendix "A" – schedule of labour charges)</h2>'+rateRowsHtml(s.rateSnapshot).replace('class="no-stack ratesched"','border="1" cellpadding="6" style="border-collapse:collapse"')+'<div class="sig">').replace('<br>Authorized','<br>Signed: agreement v'+esc(s.version)+' + Rate Schedule v'+s.rateSnapshot.version+'<br>Authorized');};})();

/* ---------- 6) farm billing uses the farm's signed rates (new rates only after acceptance) ---------- */
function farmRateOn(firm,date){var best=null;farmRateList(firm).forEach(function(r){var a=farmRateAccepted(firm,r.version);if(!a)return;var ad=isoLocal(new Date(a.at)),start=r.effective>ad?r.effective:ad;if(start<=date)best=r;});
  if(!best){var acc=farmRateList(firm).filter(function(r){return farmRateAccepted(firm,r.version);});best=acc[0]||null;}return best;}
function farmRoleOfRow(x){var u=user(x.uid);var j=u&&(u.jobRole||'');return j==='driver'?'driver':j==='forklift'?'forklift':'labour';}
(function(){var orr=firmReport;firmReport=function(firm,from,to){var R=orr(firm,from,to);var wk={};var list=R.shiftRows.slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  var byDay={};list.forEach(function(x){var r=farmRateOn(firm,x.date);var rate=0,ot=0;if(r){var role=farmRoleOfRow(x);rate=r.rates[role]||r.rates.labour||0;ot=r.overtime||0;}
    var k=x.uid+'|'+weekStart(x.date),before=wk[k]||0,after=before+x.bill;wk[k]=after;var otH=ot?Math.max(0,after-Math.max(48,before)):0;
    x.rate=rate;x.amount=Math.round(((x.bill-otH)*rate+otH*ot)*100)/100;byDay[x.date]=(byDay[x.date]||0)+x.amount;});
  var tot=0;R.rows.forEach(function(r){r.amount=Math.round((byDay[r.date]||0)*100)/100;tot+=r.amount;});var cur=farmRateOn(firm,to);var hst=cur?cur.hst!==false:true;
  R.tot.amount=Math.round(tot*100)/100;R.tot.hst=hst?Math.round(R.tot.amount*15)/100:0;R.tot.total=Math.round((R.tot.amount+R.tot.hst)*100)/100;R.hstOn=hst;R.rateSched=cur;return R;};})();
(function(){var op=firmPage;firmPage=function(firm){var x=op(firm),R=PAGE_STATE.frData.R,rate=firm.firm.billRate;
  x=x.split('Amount (@ '+money(rate)+'/h)').join('Amount (your signed rates)');
  x=x.replace(/<div class="trow"><span>Billable hours × bill rate<br><span class="small muted">[^<]*<\/span><\/span>/,'<div class="trow"><span>Billable hours × your signed rates<br><span class="small muted">'+R.tot.bill.toFixed(2)+' h · Rate Schedule v'+(R.rateSched?R.rateSched.version:'–')+'</span></span>');
  if(!R.hstOn)x=x.replace('<span>HST 15%</span>','<span>HST (not charged for this farm)</span>');
  var c=farmRatesCur(firm);if(c&&!farmBookable(firm))x='<div class="alert bad" id="farmblocked"><b>Shifts at your farm are blocked:</b> '+esc(farmStatus(firm).t)+'.</div>'+x;
  return x;};})();
(function(){var oh=VIEWS['firm:home'];VIEWS['firm:home']=function(){if(!farmRatesCur(ME)){return firmAgrCard(ME,false)+'<h1>'+esc(ME.name)+'</h1><p class="small muted">Your hours and billing will show here once your rates are signed and shifts start.</p>';}return oh();};})();
ADMIN_ONLY_ACT.push('farmratesmodal');ADMIN_ONLY_FORM.push('farmrates');

/* ---------- seed + migration: sample farms get Rate Schedule v1, accepted with their existing signature ---------- */
function seedFarmRates(db){db.farmRates=db.farmRates||[];db.users.filter(function(u){return u.type==='firm';}).forEach(function(f){if(db.farmRates.some(function(r){return r.firmId===f.id;}))return;var b=f.firm.billRate||0;if(!b)return;
  var r={id:uid('fr'),firmId:f.id,version:1,effective:addDays(today(),-60),rates:{labour:b,forklift:Math.round((b+2.5)*100)/100,driver:Math.round((b+4)*100)/100},other:null,overtime:Math.round(b*1.5*100)/100,hst:true,by:'Sample data',at:new Date(Date.now()-86400000*60).toISOString(),reason:''};
  if(f.username==='firmA')r.rates.painting=Math.round((b+1.5)*100)/100;db.farmRates.push(r);
  (db.firmSigs||[]).forEach(function(s){if(s.firmId===f.id&&!s.rateVersion){s.rateVersion=1;s.rateSnapshot=JSON.parse(JSON.stringify(r));}});});}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedFarmRates(db);};})();
(function(){var ol=load;load=function(){ol();if(DB&&!DB.farmRates){seedFarmRates(DB);save();}};})();
