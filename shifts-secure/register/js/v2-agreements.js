/* v2-agreements.js – Master Labour Contract Agreement (evergreen, auto-renews), Schedule A (office-editable, versioned),
   rates per site/role, non-solicit + 12-month conversion fee text, WCB wording, account-type sign-up. TEST ONLY. */
'use strict';
var WCB_WORDING='WCB as required by PEI law, and no later than the end of year 1';
var PAYTERMS={net30_receipt:'Net 30 from receipt of a correct invoice',net30_farm:'Net 30 after the farm pays UnScramble'};
var ROLES=[['general','General labour'],['driver','Driver'],['forklift','Forklift'],['machinery','Machinery']];
var NON_SOLICIT='Non-solicit: from the day the subcontractor or any of its workers starts with UnScramble, neither the subcontractor nor any of its workers may work directly for any UnScramble farm or other client (construction, bakery, painting, cleaning or other) until 12 months after they stop working with UnScramble. The subcontractor must pass this on to each of its workers in writing.';
function roleName(r){var x=ROLES.filter(function(y){return y[0]===r;})[0];return x?x[1]:(r==='*'?'All roles':r);}

/* Agreement placeholder text gets the non-solicit clause */
TERMS_TEXT.sub_agreement=TERMS_TEXT.sub_agreement+'\n\n• '+NON_SOLICIT+'\n• Conversion fee: see Schedule A (12-month conversion fee).';

function defaultScheduleA(){return {paymentTerms:'net30_receipt',holdbackPct:10,
  invoicing:'One invoice every 30 days (monthly) showing ONE total amount, your legal business name, Business Number (BN) and HST number (if you have one). No hours are listed on the invoice. HST 15% is added only if you provide an HST number.',
  holdbackRelease:'Released after the end-of-season reconciliation, less any office deductions (each deduction is logged with a reason).',
  insurance:'Commercial General Liability: $2,000,000 per occurrence, UnScramble named as additional insured.\nAuto liability: $2,000,000 if you drive workers.',
  wcbTiming:WCB_WORDING+'.',
  docSub:'WCB clearance (as required by PEI law, and no later than the end of year 1); CGL insurance certificate; auto liability (if you drive workers); agency/recruiter licence or office-confirmed "not required"; banking (void cheque or bank letter). Details may be typed in instead of uploaded – originals may be requested within 5 business days.',
  docWorker:'Only the licences the job needs: driver\'s licence (correct class / air brake) for driving; forklift/machinery certification for those jobs. Proof of eligibility to work is kept by your employer (the subcontractor), not uploaded here.',
  nonSolicit:NON_SOLICIT,
  conversionFee:'12-month conversion fee: [amount to be decided with the team] if a client or UnScramble hires one of your workers directly within 12 months of their last shift.',
  notice:'Written notice period: [to be decided with the team – placeholder 30 days]. Rate changes: 14 days\' written notice; new rates apply only to shifts on or after the effective date.'};}
function SA(){return DB.settings.scheduleA;}
function rateRows(){return (DB.rates||[]).slice().sort(function(a,b){return a.site<b.site?-1:a.site>b.site?1:a.role<b.role?-1:a.role>b.role?1:a.effective<b.effective?-1:1;});}
/* most specific site/role match with effective date on or before the shift date; latest wins */
function rateFor(site,role,date){var best=null,bs=-1;(DB.rates||[]).forEach(function(r){if(r.effective>date)return;if(!(r.site===site||r.site==='*')||!(r.role===role||r.role==='*'))return;var sc=(r.site===site?2:0)+(r.role===role?1:0);if(sc>bs||(sc===bs&&r.effective>=best.effective)){best=r;bs=sc;}});return best;}
function scheduleAText(){var a=SA();
  var rates=rateRows().map(function(r){return '  • '+(r.site==='*'?'All sites':r.site)+' – '+roleName(r.role)+': '+money(r.rate)+' per hour'+(r.effective>today()?' (NEW – effective '+r.effective+')':' (from '+r.effective+')');}).join('\n');
  return 'SCHEDULE A – COMMERCIAL TERMS (PLACEHOLDER – sample values; wording to be decided with the team)\nPart of the Master Labour Contract Agreement. Edited by the UnScramble office; every change makes a new version that you accept in the app.\n\n'+
  '1. Pay rates per site / role (office-set; what UnScramble pays you – farm bill rates are never shown):\n'+(rates||'  (none yet)')+'\n   Rate changes need 14 days\' notice and apply only to shifts on or after the effective date.\n\n'+
  '2. Invoicing: '+a.invoicing+'\n'+
  '3. Payment terms: '+PAYTERMS[a.paymentTerms]+'.\n'+
  '4. Holdback: '+a.holdbackPct+'% of each invoice amount (before HST). '+a.holdbackRelease+'\n'+
  '5. Insurance amounts:\n'+a.insurance.split('\n').map(function(l){return '  '+l;}).join('\n')+'\n'+
  '6. WCB timing: '+a.wcbTiming+'\n'+
  '7. Document checklist per role:\n  Subcontractor: '+a.docSub+'\n  Subcontractor worker: '+a.docWorker+'\n'+
  '8. '+a.nonSolicit+'\n'+
  '9. '+a.conversionFee+'\n'+
  '10. Notice: '+a.notice+'\n'+
  '11. Payment holds: payments are held while a 14-day document pass is active (released when documents are complete). The office may also put an invoice on hold with a reason, e.g. while a farm change is unsettled.';}
function bumpScheduleA(reason){var cur=DB.settings.terms.schedule_a;DB.settings.termsHistory=DB.settings.termsHistory||[];DB.settings.termsHistory.push({key:'schedule_a',version:cur.version,text:cur.text});
  var nv=((Math.round((parseFloat(cur.version)||1)*10)+1)/10).toFixed(1);
  DB.settings.terms.schedule_a={version:nv,publishedAt:today(),text:scheduleAText(),note:reason};
  (DB.settings.scheduleAHistory=DB.settings.scheduleAHistory||[]).push({version:nv,at:new Date().toISOString(),by:ME?ME.name:'system',reason:reason});
  DB.settings.paymentTerms=SA().paymentTerms==='net30_farm'?'net30_farm':'net30_submit';
  users('sub').forEach(function(s){notify(s.id,'Schedule A version '+nv+' was published ('+reason+'). Please sign in and accept it on the Agreements page.');});
  audit('Published Schedule A version',nv,reason);return nv;}

/* WCB wording (year-1 logic kept) */
wcbRuleText=function(s){var c=s.company||{};if(c.wcbRequiredNow)return WCB_WORDING+'. Required now (set by the office).';var due=wcbDue(s);return WCB_WORDING+'. '+(due?(wcbRequired(s)?'Required since '+due+' (1 year after start '+wcbStart(s)+').':'Not required until '+due+' (end of year 1, started '+wcbStart(s)+').'):'Not required until the end of year 1 – the year starts when the office approves the company.');};

/* Agreement: auto-renews; office can terminate (notice or cause) and reinstate */
function agreementPill(s){var t=(s.company||{}).termination;if(!t)return '<span class="pill s-ok">Auto-renews</span>';return '<span class="pill '+(t.effective<=today()?'s-bad':'s-warn')+'">Terminated – effective '+esc(t.effective)+'</span><div class="small">'+esc(t.type==='cause'?'Immediately for cause':'On written notice')+': '+esc(t.reason)+'</div>';}
function terminateBox(s){var t=(s.company||{}).termination;
  if(t)return '<div class="card small">'+agreementPill(s)+'<div>Ended by '+esc(t.by)+' on '+esc(t.at.slice(0,10))+'.</div><button class="small sec" data-act="reinstate" data-id="'+s.id+'">Reinstate agreement (auto-renews again)</button></div>';
  return '<details class="small"><summary>Terminate the agreement (manual)</summary><form data-form="terminate"><input type="hidden" name="id" value="'+s.id+'"><div class="grid2">'+sel('type','How',[['notice','On written notice (choose effective date)'],['cause','Immediately for cause']],'notice')+inp('effective','Effective date (notice)',addDays(today(),30),{type:'date'})+'</div><label class="req">Reason (logged, sent to the subcontractor)</label><textarea name="reason" required></textarea><button class="small danger">Terminate agreement</button></form></details>';}
FORMS.terminate=function(f,d){var s=user(d.id);if(!d.reason){toast('A reason is required.');return;}var eff=d.type==='cause'?today():(d.effective||today());if(eff<today()){toast('Effective date cannot be in the past.');return;}
  s.company.termination={type:d.type,effective:eff,reason:d.reason,by:ME.name,at:new Date().toISOString()};audit('Terminated Master Labour Contract Agreement',s.company.legalName,(d.type==='cause'?'immediately for cause':'written notice, effective '+eff)+': '+d.reason);
  notify(['admin',s.id],'The Master Labour Contract Agreement with '+s.company.legalName+' was terminated '+(d.type==='cause'?'immediately for cause':'on written notice, effective '+eff)+'. Reason: '+d.reason);sweepBookings();save();closeModal();toast('Agreement terminated.');render();};
ACT.reinstate=function(el){var s=user(el.dataset.id);delete s.company.termination;audit('Reinstated agreement (auto-renews)',s.company.legalName);notify(s.id,'Your Master Labour Contract Agreement was reinstated. It auto-renews.');save();closeModal();render();};

/* Office Settings: Schedule A card + rates table */
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var a=SA(),cur=DB.settings.terms.schedule_a;
  var x='<div class="card hl" id="schedA"><h2 style="margin-top:0">Schedule A – commercial terms <span class="small muted">current version '+esc(cur.version)+' (published '+esc(cur.publishedAt)+')</span></h2><p class="small">Part of the <b>Master Labour Contract Agreement</b> (evergreen, auto-renews; either side can end it on written notice; UnScramble can end it immediately for cause). Saving makes a <b>new version</b> and every subcontractor is asked to accept it again. Placeholder wording – to be decided with the team.</p>'+
  '<form data-form="schedulea"><div class="grid2">'+sel('paymentTerms','Payment terms',Object.keys(PAYTERMS).map(function(k){return [k,PAYTERMS[k]];}),a.paymentTerms)+inp('holdbackPct','Holdback % (default 10)',a.holdbackPct,{type:'number',extra:' step="0.5" min="0" max="50"'})+inp('holdbackRelease','Holdback release',a.holdbackRelease)+inp('wcbTiming','WCB timing',a.wcbTiming)+'</div>'+
  '<label>Invoicing (monthly, one total amount – no hours)</label><textarea name="invoicing">'+esc(a.invoicing)+'</textarea>'+
  '<label>12-month conversion fee (text only)</label><textarea name="conversionFee">'+esc(a.conversionFee)+'</textarea>'+
  '<label>Non-solicit</label><textarea name="nonSolicit">'+esc(a.nonSolicit)+'</textarea>'+
  '<label>Insurance amounts</label><textarea name="insurance">'+esc(a.insurance)+'</textarea><label>Document checklist – subcontractor</label><textarea name="docSub">'+esc(a.docSub)+'</textarea><label>Document checklist – subcontractor worker</label><textarea name="docWorker">'+esc(a.docWorker)+'</textarea><label>Notice</label><textarea name="notice">'+esc(a.notice)+'</textarea>'+
  '<label class="req">What changed (shown in the version history)</label><input type="text" name="reason" required placeholder="e.g. holdback changed to 8%"><p><button>Save as new Schedule A version</button></p></form>'+
  '<h3>Pay rates per site / role (what UnScramble pays subcontractors – never the farm bill rate)</h3><div class="tw"><table><tr><th>Site</th><th>Role</th><th>Rate / h</th><th>Effective from</th><th>Set by</th></tr>'+rateRows().map(function(r){return '<tr><td>'+esc(r.site==='*'?'All sites':r.site)+'</td><td>'+esc(roleName(r.role))+'</td><td>'+money(r.rate)+'</td><td>'+esc(r.effective)+(r.effective>today()?' <span class="pill s-pend">upcoming</span>':'')+'</td><td class="small">'+esc(r.by)+(r.note?' – '+esc(r.note):'')+'</td></tr>';}).join('')+'</table></div>'+
  '<form data-form="ratechg" class="card"><b>Add a rate change</b><div class="grid2">'+sel('site','Site',[['*','All sites']].concat(DB.sites.filter(function(s){return s.firmId;}).map(function(s){return [s.code,s.code+' – '+s.name];})),'*')+sel('role','Role',ROLES,'general')+inp('rate','New rate $ per hour','',{type:'number',req:true,extra:' step="0.01" min="0"'})+inp('effective','Effective date (default 14 days\' notice)',addDays(today(),14),{type:'date',req:true})+'</div>'+inp('note','Note (optional)','')+'<div class="hint">Applies only to shifts on or after the effective date. Publishes a new Schedule A version and notifies subcontractors.</div><button class="small">Add rate change</button></form>'+
  '<details class="small"><summary>Version history</summary><ul>'+(DB.settings.scheduleAHistory||[]).slice().reverse().map(function(h){return '<li>v'+esc(h.version)+' – '+fmtStamp(h.at)+' – '+esc(h.by)+': '+esc(h.reason)+'</li>';}).join('')+'<li>v1.0 – first version</li></ul></details></div>';
  return os().replace('<h1>Settings</h1>','<h1>Settings</h1>'+x).replace(/<div><label[^>]*>[^<]*<\/label><select name="paymentTerms"[^]*?<\/select>(<div class="hint">[^]*?<\/div>)?<\/div>/,'');};})();
FORMS.schedulea=function(f,d){var a=SA();if(!d.reason){toast('Say what changed.');return;}var hb=Number(d.holdbackPct);if(isNaN(hb)||hb<0||hb>50){toast('Holdback must be between 0 and 50%.');return;}
  ['paymentTerms','holdbackRelease','wcbTiming','invoicing','conversionFee','nonSolicit','insurance','docSub','docWorker','notice'].forEach(function(k){if(d[k]!==undefined)a[k]=d[k];});a.holdbackPct=hb;
  var v=bumpScheduleA(d.reason);save();toast('Schedule A version '+v+' published – subcontractors will be asked to accept it.');render();};
FORMS.ratechg=function(f,d){var r=Number(d.rate);if(!(r>0)){toast('Enter the new rate.');return;}if(!d.effective||d.effective<today()){toast('The effective date cannot be in the past.');return;}
  var notice=daysBetween(today(),d.effective);DB.rates.push({id:uid('rt'),site:d.site,role:d.role,rate:r,effective:d.effective,by:ME.name,at:new Date().toISOString(),note:d.note||''});
  bumpScheduleA('Rate change: '+(d.site==='*'?'all sites':d.site)+' '+roleName(d.role)+' '+money(r)+'/h from '+d.effective);audit('Added rate change',(d.site==='*'?'All sites':d.site)+' '+roleName(d.role),money(r)+' effective '+d.effective+' ('+notice+' days notice)');save();
  toast(notice<14?'Saved – note: less than 14 days\' notice.':'Rate change saved (effective '+d.effective+').');render();};

/* Sign-up: three clear account types (+ separate tester option) */
VIEWS.signup=function(){
  return '<div class="login-wrap"><div class="card"><h1>Create an account</h1><p>Which account type are you?</p>'+
  '<a class="choice" href="#/signup/employee"><b>Employee</b> <span class="small muted">(company employee)</span><br><span class="small">UnScramble employs and pays you directly.</span></a>'+
  '<a class="choice" href="#/signup/sub"><b>Subcontractor</b><br><span class="small">A labour business that employs its own workers and invoices UnScramble.</span></a>'+
  '<a class="choice" href="#/signup/worker"><b>Subcontractor worker</b><br><span class="small">You work for one of our subcontractors – they are your employer. You will choose your employer on the next screen.</span></a>'+
  '<p class="small muted" style="margin-top:14px">Only for app testing:</p><a class="choice" href="#/signup/tester" style="border-color:var(--g)"><b>Testing for App Development</b> <span class="badge-test">TEST</span><br><span class="small">Try the app and give feedback. No documents needed. Never paid work.</span></a>'+
  '<p class="small muted">Phone number is optional for every account type. One login for everything – registration, documents, agreements and clocking in.</p><p><a href="#/">Back to sign in</a></p></div></div>';};
