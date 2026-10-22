/* v2-terms11.js – terms version 1.1: real plain-English wording replaces the 6 "sample"/"placeholder" texts,
   a "Terms updated" prompt for people who accepted an older version, and the accepted version is recorded
   (reg_terms_acceptances already stores key + version, so no new DB columns are needed).
   TEST COPY: publishes v1.1 in ?store=mock only. With real data nothing here changes settings; the office publishes
   v1.1 later (see proposed SQL). Conversion fee and notice period are blanks for the owner to set. */
'use strict';
(function(){
var CO='Unscramble The HR Company Inc. (a Prince Edward Island corporation, registration no. 169973)';
var FEE='[CONVERSION FEE – owner to set]',NOTICE='one month\'s';
var HOURS='No minimum shift: you are paid only for the hours you actually work. (A farm\'s daily minimum in its agreement with UnScramble is a billing rule between UnScramble and the farm; it does not change your pay.) Breaks: no break is required on a shift of up to 5 hours; on a shift over 5 hours there is a 30-minute unpaid break.';
var NS=(typeof NON_SOLICIT==='string'&&NON_SOLICIT)||'Non-solicit: see Schedule A.';
var T11={
 sub_agreement:'MASTER LABOUR CONTRACT AGREEMENT\n\nBetween '+CO+' ("UnScramble") and the subcontractor company named in this account ("you").\n\n'+
  '1. What this covers: UnScramble supplies farm workers to farms and other clients. You supply workers for that work. This agreement, Schedule A and the Privacy Notice apply every time you or your workers work through UnScramble.\n'+
  '2. Term: there is no end date. The agreement renews automatically until it is ended.\n'+
  '3. Ending it: either side can end the agreement with '+NOTICE+' written notice. UnScramble can end it right away for cause, for example a safety problem, fraud, or required documents or insurance lapsing.\n'+
  '4. Your workers: you are the legal employer of your workers. You pay them, keep their time and payroll records, and give those records to UnScramble within 5 business days when asked.\n'+
  '5. Shifts and breaks: '+HOURS+'\n'+
  '6. No registration, no shift, no pay: your company documents (WCB clearance as set out in Schedule A, and insurance) must stay valid. If they lapse, all of your workers are blocked from shifts until they are fixed.\n'+
  '7. Invoicing and payment: as set out in Schedule A. You send one invoice every 30 days in the app. Invoices sent more than 60 days late are not payable. UnScramble may hold a payment while your WCB clearance or insurance has lapsed or a records request is overdue.\n'+
  '8. Rates: Schedule A shows what UnScramble pays you. Farm bill rates and farm invoices are never shown to you; a farm\'s invoices are visible only to the UnScramble owner and that farm.\n'+
  '9. '+NS+'\n'+
  '10. Conversion fee: '+FEE+' (see Schedule A).\n'+
  '11. Changes: Schedule A can change. Each new version is shown in the app and must be accepted before your workers can take more shifts.',
 schedule_c:'SCHEDULE C – WORKER ACKNOWLEDGEMENT\n\n'+
  '• Your employer is {EMPLOYER}. Your employer is NOT UnScramble ('+CO+') and NOT the farm or client site.\n'+
  '• Your employer pays you and keeps your time records and your SIN. UnScramble does not ask for or store your SIN.\n'+
  '• Shifts and breaks: '+HOURS+'\n'+
  '• You must follow site safety rules and wear the PPE you are given. You have the right to refuse unsafe work.\n'+
  '• You must keep your documents (work permit, licences, training) up to date, or you cannot be placed on a crew.',
 employee_terms:'EMPLOYEE TERMS ACKNOWLEDGEMENT\n\nYour employer is '+CO+' ("UnScramble").\n\n'+
  '1. Pay: you are paid every two weeks (bi-weekly) for the hours you work, with vacation pay (4% to start) and paid holidays under the PEI Employment Standards Act.\n'+
  '2. Shifts and breaks: '+HOURS+'\n'+
  '3. Health and safety: you have the right to know about hazards, to take part in safety, and to refuse unsafe work. Report any injury to UnScramble right away.\n'+
  '4. Site rules: wear the PPE you are given and follow each farm\'s rules, including food-safety and hygiene rules.\n'+
  '5. Privacy: see the Privacy Notice. The app collects your contact, payroll and document details and your location when you clock in, only to register you, schedule you and pay you.',
 privacy:'PRIVACY NOTICE AND CONSENT\n\nThis notice is from '+CO+' ("UnScramble").\n\n'+
  '• We collect only what we need to register you, check your documents, schedule shifts and (for UnScramble employees) pay you.\n'+
  '• When you clock in, the app may check your location at the work site.\n'+
  '• Workers and employees give a home or pickup address so the crew van can pick them up. Only the UnScramble office and, for subcontractor workers, your employer can see it. Farms and other clients never see it. You can change it in My profile.\n'+
  '• Text me sign-in codes (optional): We\'ll text sign-in codes from UnScramble. Msg rates may apply. Reply STOP to stop. You can turn this on or off in My profile.\n'+
  '• SIN and banking are kept only in the restricted payroll area (UnScramble employees only).\n'+
  '• Only people who need it can see your documents. Every view, upload and approval is logged.\n'+
  '• You can ask to see or correct your information at any time (Profile > Privacy request).\n'+
  '• Retention periods are set by the UnScramble office.',
 app_testing:'APP TERMS OF USE AND TESTING TERMS\n\nThe UnScramble app is run by '+CO+' ("UnScramble").\n\n'+
  '1. You have been given a testing account to try the UnScramble app and give feedback.\n'+
  '2. Testing is for feedback only. It is NOT work. Nothing you do as a tester (test shifts, test hours, test invoices) is real work, goes to payroll, or is paid.\n'+
  '3. No documents are needed for a testing account. Please do not upload real personal documents.\n'+
  '4. Privacy: your name, login and anything you type get the same protection as any other account. We use it only to run and improve the app. You can ask to see or correct your data at any time.\n'+
  '5. Use the app only for its purpose. Do not try to see other people\'s information or get around the app\'s security.\n'+
  '6. The office can switch your testing account off at any time, or change it to a Subcontractor or Employee account if you will do real paid work.'
};
window.TERMS11=T11;window.TERMS11_BLANKS=[FEE];
var V='1.1',WHY='Plain-English wording; "sample"/"placeholder" removed';
function isMock(){try{return !!(window.REG_STORE&&REG_STORE.mode==='mock');}catch(e){return false;}}
/* Schedule A wording (applies to new Schedule A versions) */
if(typeof defaultScheduleA==='function'){var _dsa=defaultScheduleA;defaultScheduleA=function(){var a=_dsa();a.conversionFee='12-month conversion fee: '+FEE+' if a farm, a client or UnScramble hires one of your workers directly within 12 months of their last shift through UnScramble.';a.notice='Written notice period to end the agreement: one month. Rate changes: 14 days\' written notice; new rates apply only to shifts on or after the effective date.';return a;};}
if(typeof scheduleAText==='function'){var _sat=scheduleAText;scheduleAText=function(){var t=String(_sat());
  t=t.replace(/^SCHEDULE A – COMMERCIAL TERMS \(PLACEHOLDER[^\n]*\)/,'SCHEDULE A – COMMERCIAL TERMS\nBetween '+CO+' and you.');
  t=t.replace(/\n11\. Payment holds:/,'\n11. Shifts and breaks: '+HOURS+'\n12. Payment holds:');
  return t;};}
function fixSA(){var a=DB.settings.scheduleA;if(!a)return;if(/to be decided|\[amount/i.test(a.conversionFee||''))a.conversionFee=defaultScheduleA().conversionFee;if(/to be decided|placeholder|owner to set/i.test(a.notice||''))a.notice=defaultScheduleA().notice;}
/* publish 1.1 in the mock store only */
function publish(){if(!isMock()||typeof DB==='undefined'||!DB||!DB.settings||!DB.settings.terms)return;var S=DB.settings,did=false;S.termsHistory=S.termsHistory||[];
  for(var k in TERMS_DEF){var cur=S.terms[k];if(!cur||parseFloat(cur.version)>=1.1)continue;
    var txt=k==='schedule_a'?(fixSA(),typeof scheduleAText==='function'&&S.scheduleA?scheduleAText():cur.text):T11[k];if(!txt)continue;
    S.termsHistory.push({key:k,version:cur.version,text:cur.text});S.terms[k]={version:V,publishedAt:today(),text:txt,note:WHY};did=true;
    try{audit('Published new terms version',TERMS_DEF[k].name+' v'+V,WHY);}catch(e){}}
  if(did)try{save();}catch(e){}}
function updatedKeys(u){if(!u||typeof missingTerms!=='function')return [];return missingTerms(u).filter(function(k){return (DB.acceptances||[]).some(function(a){return a.userId===u.id&&a.key===k;});});}
window.termsUpdatedKeys=updatedKeys;
function card(keys){return '<div class="card hl" id="terms11-updated" style="border-left:6px solid #c8a24a"><h2 style="margin-top:0">Terms updated</h2><p>We have updated '+(keys.length>1?'these terms':'this')+' to <b>version '+V+'</b>. The wording is now final, in plain English. Please read and accept to keep using the app'+(ME&&ME.type!=='tester'?' and getting shifts':'')+'.</p><ul class="small">'+keys.map(function(k){var o=(DB.acceptances||[]).filter(function(a){return a.userId===ME.id&&a.key===k;}).pop();return '<li>'+esc(TERMS_DEF[k].name)+' – you accepted v'+esc(o.version)+'; now v'+esc(termsCurrent(k).version)+'</li>';}).join('')+'</ul><p class="small muted">Your acceptance is recorded with the version, date, time and device.</p></div>';}
if(typeof VIEWS.terms==='function'){var _tv=VIEWS.terms;VIEWS.terms=function(){var x=String(_tv.apply(this,arguments));try{var k=updatedKeys(ME);if(k.length)x=x.replace('<h1>Terms</h1>','<h1>Terms</h1>'+card(k));}catch(e){}return x;};}
function prompt(){try{if(typeof ME!=='undefined'&&ME&&!/^#\/terms/.test(location.hash)&&!document.getElementById('modal')){var k=updatedKeys(ME),flag='terms11-seen-'+ME.id;
    if(k.length&&!sessionStorage.getItem(flag)){sessionStorage.setItem(flag,'1');modal('<div id="terms11-prompt"><h2>Terms updated</h2><p>Our terms are now <b>version '+V+'</b>, in plain English. Please read and accept them'+(ME.type!=='tester'?' – you can\'t take new shifts until you do':'')+'.</p><ul class="small">'+k.map(function(x){return '<li>'+esc(TERMS_DEF[x].name)+'</li>';}).join('')+'</ul><div class="row"><button class="btn primary" data-act="terms11go">Read and accept</button> <button class="sec" data-act="closeModal">Later</button></div></div>');}}}catch(e){}}
var _r=render;render=function(){try{publish();minfix();}catch(e){}var out=_r.apply(this,arguments);setTimeout(prompt,300);return out;};
/* other scripts keep a reference to the original render (hashchange, sign-in), so also check on a light timer */
setInterval(function(){try{publish();}catch(e){}prompt();},1000);
/* mock only: test data saved before terms11 still holds the old 5-hour billing minimum */
function minfix(){if(!isMock()||typeof DB==='undefined'||!DB||!DB.settings)return;var c=DB.settings.clientBilling;if(c&&Number(c.minHours)===5&&!DB.settings.terms11Min3){c.minHours=3;DB.settings.terms11Min3=true;try{save();}catch(e){}}}
setInterval(minfix,1000);
ACT.terms11go=function(){closeModal();go('#/terms');};
})();
