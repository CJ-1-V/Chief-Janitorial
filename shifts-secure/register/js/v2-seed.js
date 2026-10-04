/* v2-seed.js – sample data and data migration for round 3; PEI minimum wage stored as dated rates (switches automatically). TEST ONLY. */
'use strict';
/* PEI minimum wage – Minimum Wage Order, Employment Standards Act (official PEI government source). Editable in Settings. */
var PEI_MINWAGE_SOURCE={title:'PEI Minimum Wage Order (Employment Standards Act) – in force Oct 1, 2026',url:'https://www.princeedwardisland.ca/sites/default/files/89b2/20260331truwww_0.pdf',also:'https://www.princeedwardisland.ca/en/information/workforce-and-advanced-learning/minimum-wage-order-board-and-lodging',checked:'2026-10-03'};
function defaultMinWages(){return [{rate:17.00,effective:'2026-04-01'},{rate:17.30,effective:'2026-10-01'},{rate:17.60,effective:'2027-04-01'}];}
function minWageOn(date){var best=null;(DB.settings.minWages||[]).forEach(function(m){if(m.effective<=date&&(!best||m.effective>best.effective))best=m;});return best?best.rate:DB.settings.minWage;}
function syncMinWage(){if(DB&&DB.settings&&DB.settings.minWages)DB.settings.minWage=minWageOn(today());}

function seedV2(db,o){var A=o.A;
  db.settings.scheduleA=defaultScheduleA();db.settings.paymentTerms='net30_submit';db.settings.roleDocs=defaultRoleDocs();db.settings.scheduleA.docWorker='';
  db.settings.minWages=defaultMinWages();db.settings.minWageSource=Object.assign({},PEI_MINWAGE_SOURCE);
  db.settings.firmAgreement={version:'1.0',label:FIRM_AGR_LABEL,publishedAt:A(-30)};
  db.rates=[{id:o.uid('rt'),site:'*',role:'general',rate:18.50,effective:A(-120),by:'Office Tester',at:new Date().toISOString()},
    {id:o.uid('rt'),site:'TFA-01',role:'general',rate:19.00,effective:A(-120),by:'Office Tester',at:new Date().toISOString()},
    {id:o.uid('rt'),site:'*',role:'driver',rate:21.00,effective:A(-120),by:'Office Tester',at:new Date().toISOString()},
    {id:o.uid('rt'),site:'*',role:'forklift',rate:20.50,effective:A(-120),by:'Office Tester',at:new Date().toISOString()},
    {id:o.uid('rt'),site:'TFA-01',role:'general',rate:19.75,effective:A(14),by:'Office Tester',at:new Date().toISOString(),note:'Season increase (14 days\' notice)'}];
  db.deductions=[];db.holdbackReleases=[];
  /* job roles (owner checklist): driver → driver's abstract; forklift/bin piler → certificate + years; others → nothing */
  o.w1.jobRole='driver';o.w1.roles=['driver'];o.doc(o.w1,'driver_abstract',{meta:{abstractDate:A(-30)}});
  o.w2.jobRole='forklift';o.w2.roles=['forklift'];o.w2.forkliftYears=3;
  o.w3.jobRole='driver';o.w3.roles=['driver'];
  o.w4.jobRole='field';o.w4.roles=[];
  o.e1.jobRole='field';o.e3.jobRole='driver';o.doc(o.e3,'driver_abstract',{meta:{abstractDate:A(-20)}});
  /* both sample farms signed the farm agreement (a new farm added by the office starts unsigned) */
  db.firmSigs=[o.fA,o.fB].map(function(f,i){return {id:o.uid('fs'),firmId:f.id,firmName:f.name,version:'1.0',label:FIRM_AGR_LABEL,signerName:i?'Sam Sample':'Pat Placeholder',title:i?'Farm Manager':'Owner',signature:i?'Sam Sample':'Pat Placeholder',authorized:true,at:new Date(Date.now()-86400000*(25-i)).toISOString(),tz:'America/Halifax',device:'Computer – sample data',text:firmAgreementText(f.name)};});
  /* sample clocked hours for subcontractor workers (shown on the sub's Workers' hours page – never used for invoices) */
  var rows=[[-13,o.w1,'TFA-01','07:00','15:30'],[-12,o.w1,'TFA-01','07:00','15:15'],[-11,o.w1,'TFB-01','08:00','16:00'],[-10,o.w2,'TFA-02','07:15','15:30'],[-6,o.w1,'TFA-01','07:00','15:00'],[-5,o.w2,'TFA-02','07:00','12:00'],[-4,o.w1,'TFA-02','06:45','15:15'],[-3,o.w2,'TFA-01','07:00','15:30']];
  rows.forEach(function(r,i){db.time.push({id:o.uid('t'),userId:r[1].id,site:r[2],date:A(r[0]),in:r[3],out:r[4],test:false,clock:true,subId:o.s1.id,crew:4,loc:'Location check-in (simulated)',breakMissed:i===4});});
  var t=db.time.filter(function(x){return x.userId===o.w2.id&&x.date===A(-3);})[0];
  db.changes.push({id:o.uid('fc'),firmId:o.fA.id,firmName:o.fA.name,by:o.fA.name+' (firmA)',key:'t:'+t.id,site:t.site,date:t.date,workerNo:1,uid:o.w2.id,origStart:t.in,origEnd:t.out,propStart:t.in,propEnd:'14:30',comment:'Sample: crew left an hour early',at:new Date().toISOString(),status:'Pending'});
  /* invoices: holdback at 10% on real invoices; one office hold tied to the unsettled farm change */
  db.invoices.forEach(function(i){if(i.test)return;i.holdbackPct=10;i.holdback=Math.round(i.subtotal*10)/100;i.noHours=true;if(i.number==='BTC-002'){i.officeHold={reason:'Tied to an unsettled farm change at TFA-01 (sample)',by:'Office Tester',at:new Date().toISOString()};}});
}
(function(){var ol=load;load=function(){ol();var S=DB.settings;
  if(!S.scheduleA)S.scheduleA=defaultScheduleA();if(!S.roleDocs)S.roleDocs=defaultRoleDocs();if(!S.scheduleA.docWorker)S.scheduleA.docWorker=docWorkerText();if(!S.scheduleA.nonSolicit)S.scheduleA.nonSolicit=NON_SOLICIT;if(!S.scheduleA.invoicing)S.scheduleA.invoicing=defaultScheduleA().invoicing;delete S.scheduleA.cycle;
  if(!DB.rates)DB.rates=[];['deductions','holdbackReleases','firmSigs'].forEach(function(k){DB[k]=DB[k]||[];});
  if(!S.firmAgreement)S.firmAgreement={version:'1.0',label:FIRM_AGR_LABEL,publishedAt:today()};
  if(!S.minWages){S.minWages=defaultMinWages();S.minWageSource=Object.assign({},PEI_MINWAGE_SOURCE);}
  if(!S.terms.schedule_a)S.terms.schedule_a={version:'1.0',publishedAt:today(),text:'',note:'First version'};
  if(!S.terms.schedule_a.text||S.terms.schedule_a.text.indexOf('(generated')===0)S.terms.schedule_a.text=scheduleAText();
  if(S.terms.sub_agreement.text.indexOf('Work eligibility warranty')<0)S.terms.sub_agreement.text=TERMS_TEXT.sub_agreement;
  syncMinWage();};})();
(function(){var op=processTemp;processTemp=function(){syncMinWage();return op();};})();

/* Settings: dated minimum wage (with source), keep payment terms in Schedule A */
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var S=DB.settings,src=S.minWageSource||{};var x=os();
  x=x.replace(/<div><label[^>]*>PEI minimum wage[^<]*<\/label><input[^>]*><\/div>/,'');
  var card='<div class="card" id="minwage"><h3 style="margin-top:0">PEI minimum wage (dated – switches automatically)</h3><p>Today ('+esc(today())+'): <b>'+money(minWageOn(today()))+' / hour</b>. Used to warn when an employee pay rate is below the minimum.</p><div class="tw"><table><tr><th>Rate</th><th>Effective from</th><th></th></tr>'+(S.minWages||[]).slice().sort(function(a,b){return a.effective<b.effective?-1:1;}).map(function(m,ix){return '<tr><td>'+money(m.rate)+'</td><td>'+esc(m.effective)+(m.effective>today()?' <span class="pill s-pend">upcoming</span>':m.rate===minWageOn(today())?' <span class="pill s-ok">current</span>':'')+'</td><td><button class="small sec" data-act="minwagedel" data-e="'+esc(m.effective)+'">Remove</button></td></tr>';}).join('')+'</table></div>'+
    '<p class="small">Source: <b>'+esc(src.title||'')+'</b><br>'+esc(src.url||'')+(src.also?'<br>'+esc(src.also):'')+'<br>Last checked: '+esc(src.checked||'')+'. Always re-check the official PEI government page before relying on it.</p>'+
    '<form data-form="minwage"><div class="grid2">'+inp('rate','Rate $ per hour','',{type:'number',req:true,extra:' step="0.01" min="0"'})+inp('effective','Effective from','',{type:'date',req:true})+inp('srcTitle','Source title',src.title||'')+inp('srcUrl','Source link (shown as text only)',src.url||'')+inp('checked','Source checked on',src.checked||today(),{type:'date'})+'</div><button class="small">Add / update dated rate</button></form></div>';
  return x.replace('<div class="card hl" id="schedA">',card+'<div class="card hl" id="schedA">');};})();
FORMS.minwage=function(f,d){var r=Number(d.rate);if(!(r>0)||!d.effective){toast('Enter a rate and an effective date.');return;}var S=DB.settings;S.minWages=(S.minWages||[]).filter(function(m){return m.effective!==d.effective;});S.minWages.push({rate:Math.round(r*100)/100,effective:d.effective});
  S.minWageSource={title:d.srcTitle||'',url:d.srcUrl||'',checked:d.checked||today(),also:(S.minWageSource||{}).also||''};syncMinWage();audit('Set PEI minimum wage',money(r)+' from '+d.effective,'source: '+(d.srcTitle||'')+' (checked '+(d.checked||today())+')');save();toast('Minimum wage saved.');render();};
ACT.minwagedel=function(el){var S=DB.settings;if(!confirmBox('mw'+el.dataset.e,'Remove the minimum wage dated '+el.dataset.e+'?'))return;S.minWages=(S.minWages||[]).filter(function(m){return m.effective!==el.dataset.e;});syncMinWage();audit('Removed dated minimum wage',el.dataset.e);save();render();};
(function(){var of=FORMS.settings;FORMS.settings=function(f,d){var S=DB.settings,pt=S.paymentTerms;if(d.minWage===undefined)d.minWage=S.minWage;if(d.paymentTerms===undefined)d.paymentTerms=pt;of(f,d);syncMinWage();save();};})();
