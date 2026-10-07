/* Fake sample data for the TEST version (all people and companies are made up). */
'use strict';
function sampleFile(title){
  var svg='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380"><rect width="600" height="380" fill="#fff" stroke="#332E57" stroke-width="6"/><rect width="600" height="60" fill="#332E57"/><text x="20" y="40" font-family="Arial" font-size="24" fill="#D9A03C">SAMPLE DOCUMENT – TEST ONLY</text><text x="20" y="130" font-family="Arial" font-size="22" fill="#222">'+String(title).replace(/[<&>]/g,'')+'</text><text x="20" y="190" font-family="Arial" font-size="16" fill="#666">Fake document created for the local test version.</text><text x="20" y="220" font-family="Arial" font-size="16" fill="#666">Not a real person or company.</text></svg>';
  return 'data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(svg)));
}
function seedData(){
  var T=realToday(),A=function(n){return addDays(T,n);},now=new Date().toISOString(),pw=hashPw('test1234');
  var db={version:1,createdAt:now,settings:{simDate:'',minWage:16.50,peiBPA:14250,paymentTerms:'net30_submit',payrollCutoff:A(2),keepShiftsOnTermsChange:true,consentVersion:'1.0',terms:{}},
    users:[],sites:[],changes:[],logins:[],docs:[],acceptances:[],consents:[],shifts:[],time:[],invoices:[],records:[],feedback:[],notes:[],audit:[],events:[],privacyReq:[],marketing:[],convReq:[]};
  for(var k in TERMS_DEF)db.settings.terms[k]={version:'1.0',publishedAt:A(-60),text:TERMS_TEXT[k],note:'First version'};
  function U(o){var u=Object.assign({id:uid('u'),passHash:pw,active:true,suspended:false,createdAt:new Date(Date.now()-86400000*20).toISOString(),lastLogin:null,phone:'',profile:{},roles:[],orientations:[],approved:false,accountApproved:true},o);db.users.push(u);return u;}
  function acc(u,key,daysAgo){db.acceptances.push({id:uid('a'),userId:u.id,userName:u.name,key:key,name:TERMS_DEF[key].name,version:'1.0',at:new Date(Date.now()-86400000*(daysAgo||15)).toISOString(),tz:'America/Toronto',device:'Computer – sample data',employerId:u.subId||null});}
  function doc(u,kind,o){var d=Object.assign({id:uid('d'),userId:u.id,kind:kind,status:'approved',fileName:kind+'-sample.svg',fileType:'image/svg+xml',fileData:sampleFile(DOCS[kind].label+' – '+u.name),expiry:'',meta:{},uploadedAt:new Date(Date.now()-86400000*14).toISOString(),uploadedBy:u.name,reviewedBy:'Office Tester',reviewedAt:new Date(Date.now()-86400000*13).toISOString()},o);db.docs.push(d);return d;}
  function avail(){return {availDays:['Mon','Tue','Wed','Thu','Fri'],availFrom:'07:00',availTo:'17:00',seasonStart:A(-30),seasonEnd:A(120)};}

  var admin=U({type:'admin',name:'Office Tester',username:'office',email:'office@example.com',approved:true});
  var fA=U({type:'firm',name:'Test Farm A',username:'firmA',email:'firma@example.com',approved:true,firm:{billRate:24.50,contact:'Farm A office (fake)'}});
  var fB=U({type:'firm',name:'Test Farm B',username:'firmB',email:'',approved:true,firm:{billRate:26.00,contact:'Farm B office (fake)'}});
  db.sites.push({code:'TFA-01',name:'North Field',firmId:fA.id,companyId:'us'},{code:'TFA-02',name:'Packing Shed',firmId:fA.id,companyId:'us'},{code:'TFB-01',name:'Storage Barn',firmId:fB.id,companyId:'us'},{code:'TEST-PRACTICE',name:'Practice site (TEST – never billed)',firmId:null,companyId:'us'});
  fA.companyId='us';fB.companyId='us';fA.firm.clientType=fA.firm.clientType||'Farm';fB.firm.clientType=fB.firm.clientType||'Farm';
  var s1=U({type:'sub',name:'Bluewater Test Crew Inc.',username:'subco',email:'subco@example.com',approved:true,approvedAt:A(-400),code:'BTC',
    company:{legalName:'Bluewater Test Crew Inc.',operatingName:'Bluewater Crew (TEST)',address:'100 Sample Road, Testville, PE C1A 1A1',email:'subco@example.com',phone:'',bn:'123456789',rp:'123456789RP0001',hst:'123456789RT0001',wcbAccount:'WCB-TEST-0001',drivesWorkers:true,licenceNotReq:true,licenceNotReqConfirmed:true,bankInst:'001',bankTransit:'12345',bankAcct:enc('9876543210'),bankVerified:true,mainContact:{name:'Pat Sample',role:'Owner',email:'subco@example.com',phone:''},emergency:{name:'Pat Sample',phone:'902-555-0101'},supervisors:'Lee Example (crew lead)',periodStart:A(-75)}});
  acc(s1,'sub_agreement',40);acc(s1,'schedule_a',40);acc(s1,'privacy',40);
  doc(s1,'wcb_clearance',{verifiedDate:A(-20)});doc(s1,'cgl',{expiry:A(200),meta:{coverage:2000000,additionalInsured:true}});doc(s1,'auto',{expiry:A(150)});doc(s1,'bank_letter',{});
  var s2=U({type:'sub',name:'Northpoint Sample Labour Ltd.',username:'subco2',email:'subco2@example.com',approved:false,code:'NSL',
    company:{legalName:'Northpoint Sample Labour Ltd.',operatingName:'Northpoint Sample',address:'5 Example Ave, Testville, PE C1B 2B2',email:'subco2@example.com',bn:'987654321',rp:'987654321RP0001',hst:'',hstNotReq:true,wcbAccount:'WCB-TEST-0002',drivesWorkers:false,licenceNotReq:false,mainContact:{name:'Sam Placeholder',role:'Manager',email:'subco2@example.com'},emergency:{name:'Sam Placeholder',phone:'902-555-0102'},supervisors:'',periodStart:A(-20)}});
  acc(s2,'sub_agreement',10);acc(s2,'schedule_a',10);acc(s2,'privacy',10);
  doc(s2,'wcb_clearance',{status:'pending',reviewedBy:'',reviewedAt:''});doc(s2,'cgl',{expiry:A(-3),meta:{coverage:2000000,additionalInsured:true}});doc(s2,'agency_licence',{status:'pending',expiry:A(365),reviewedBy:''});

  var w1=U({type:'worker',name:'Ana Testworker',username:'worker1',email:'worker1@example.com',subId:s1.id,approved:true,payRate:18.00,confirmedBySub:true,originalsChecked:true,sinCollectedBySub:true,roles:['driver'],orientations:[SITES[0]],
    profile:Object.assign({lang:'English',emName:'Joe Testworker',emRel:'Brother',emContact:'902-555-0111'},avail()),safetyAck:{date:A(-100),items:['WHMIS','PPE','Site orientation','Food-safety/hygiene','Right to refuse unsafe work']}});
  acc(w1,'schedule_c');acc(w1,'privacy');doc(w1,'driver_licence',{expiry:A(400),meta:{cls:'Class 5',airBrake:false}});
  var w2=U({type:'worker',name:'Ben Sampleperson',username:'worker2',email:'',subId:s1.id,approved:true,confirmedBySub:true,originalsChecked:true,sinCollectedBySub:true,roles:['forklift'],
    profile:Object.assign({lang:'Spanish',emName:'Maria Sampleperson',emRel:'Spouse',emContact:'maria@example.com'},avail()),safetyAck:{date:A(-350),items:['WHMIS','PPE','Site orientation','Food-safety/hygiene','Right to refuse unsafe work']}});
  acc(w2,'schedule_c');acc(w2,'privacy');doc(w2,'forklift',{expiry:A(12)});
  var w3=U({type:'worker',name:'Chris Newhire',username:'worker3',email:'worker3@example.com',subId:s1.id,approved:false,confirmedBySub:false,roles:['driver'],profile:{lang:'English'}});
  acc(w3,'schedule_c',2);acc(w3,'privacy',2);
  var w4=U({type:'worker',name:'Dana Crewmember',username:'worker4',email:'worker4@example.com',subId:s2.id,approved:true,confirmedBySub:true,originalsChecked:true,sinCollectedBySub:true,
    profile:Object.assign({lang:'Tagalog',emName:'Rico Crewmember',emRel:'Father',emContact:'902-555-0144'},avail()),safetyAck:{date:A(-30),items:['WHMIS','PPE']}});
  acc(w4,'schedule_c');acc(w4,'privacy');

  var e1=U({type:'employee',name:'Carla Democase',username:'employee1',email:'employee1@example.com',approved:true,approvedAt:A(-12),wagepoint:{added:true,date:A(-10),by:'Office Tester'},
    profile:Object.assign({firstName:'Carla',lastName:'Democase',preferredName:'Carla',street:'12 Fictional Lane',city:'Testville',prov:'PE',postal:'C1A 4P3',dob:'1990-05-14',sin:enc('046454286'),provEmp:'PE',startDate:A(-10),firstDay:A(-9),jobTitle:'Packer',payRate:17.5,payFreq:'Bi-weekly',vacMethod:'paid',vacPct:4,wcbRate:'Class 0123 – sample rate (admin)',td1Amount:16129,td1peAmount:'',extraTax:0,bankInst:'002',bankTransit:'54321',bankAcct:enc('1234567890'),emName:'Dan Democase',emRel:'Partner',emPhone:'902-555-0122',emEmail:'dan@example.com',lang:'English',priorPayroll:'no',sinRequested:A(-10)},avail()),
    safetyAck:{date:A(-10),items:['WHMIS','PPE','Site orientation','Food-safety/hygiene','Right to refuse unsafe work']},orientations:[SITES[1]]});
  acc(e1,'employee_terms',12);acc(e1,'privacy',12);doc(e1,'eligibility',{meta:{docType:'citizen'}});
  var e2=U({type:'employee',name:'Dev Examplename',username:'employee2',email:'employee2@example.com',approved:false,
    profile:{firstName:'Dev',lastName:'Examplename',street:'7 Placeholder St',city:'Testville',prov:'PE',postal:'C1C 1C1',dob:'2008-09-01',sin:enc('925333215'),sinTemp:true,sinExpiry:A(200),provEmp:'PE',startDate:A(3),jobTitle:'Field worker',payRate:15.0,payFreq:'Bi-weekly',vacMethod:'accrued',vacPct:4,td1Amount:'',emName:'Ravi Examplename',emRel:'Parent',emPhone:'902-555-0133',emEmail:'ravi@example.com',lang:'English',priorPayroll:'no'}});
  acc(e2,'employee_terms',3);acc(e2,'privacy',3);doc(e2,'eligibility',{status:'pending',expiry:A(200),meta:{docType:'permit',permitEmployer:'UnScramble – The HR Company Inc.'},reviewedBy:''});
  var e3=U({type:'employee',name:'Erin Readyforpay',username:'employee3',email:'employee3@example.com',approved:true,approvedAt:A(-1),wagepoint:{added:false},
    profile:Object.assign({firstName:'Erin',lastName:'Readyforpay',street:'3 Mock Court',city:'Testville',prov:'PE',postal:'C1E 2Z9',dob:'1985-01-20',sin:enc('130692544'),provEmp:'PE',startDate:A(5),firstDay:A(5),jobTitle:'Driver',payRate:19,payFreq:'Bi-weekly',vacMethod:'paid',vacPct:4,td1Amount:20000,td1peAmount:15000,extraTax:25,bankInst:'003',bankTransit:'11111',bankAcct:enc('5550001234'),emName:'Ola Readyforpay',emRel:'Sister',emPhone:'902-555-0155',emEmail:'ola@example.com',lang:'French',priorPayroll:'no',sinRequested:A(-1)},avail()),
    roles:['driver'],safetyAck:{date:A(-1),items:['WHMIS','PPE','Site orientation','Food-safety/hygiene','Right to refuse unsafe work']}});
  acc(e3,'employee_terms',2);acc(e3,'privacy',2);doc(e3,'eligibility',{meta:{docType:'citizen'}});doc(e3,'driver_licence',{expiry:A(700),meta:{cls:'DZ / Class 3',airBrake:true}});

  var t1=U({type:'tester',name:'Terry Tester',username:'tester1',email:'tester1@example.com',approved:true,lastLogin:new Date(Date.now()-86400000).toISOString()});
  acc(t1,'app_testing',5);db.consents.push({id:uid('c'),userId:t1.id,choice:true,version:'1.0',at:new Date(Date.now()-86400000*5).toISOString(),tz:'America/Toronto'});
  var t2=U({type:'tester',name:'Quinn Feedback',username:'tester2',email:'',approved:true});
  acc(t2,'app_testing',4);db.consents.push({id:uid('c'),userId:t2.id,choice:false,version:'1.0',at:new Date(Date.now()-86400000*4).toISOString(),tz:'America/Toronto'});
  [e1,e2,e3,w1,w2,s1].forEach(function(u){db.consents.push({id:uid('c'),userId:u.id,choice:u===e1,version:'1.0',at:now,tz:'America/Toronto'});});

  function SH(o){var s=Object.assign({id:uid('s'),start:'07:00',end:'15:30',role:'general',kind:'employee',orientation:false,booked:[],test:false,needed:4},o);db.shifts.push(s);return s;}
  SH({date:T,site:SITES[1],title:'Packing line',booked:[e1.id]});
  SH({date:A(2),site:SITES[0],title:'Field harvest',needed:6});
  SH({date:A(4),site:SITES[1],title:'Packing line (orientation required)',orientation:true});
  SH({date:A(6),site:SITES[2],title:'Truck driver – farm to shed',role:'driver',licClass:'DZ / Class 3',airBrake:true,needed:1});
  SH({date:A(3),site:SITES[0],title:'Subcontractor crew – field',kind:'crew',needed:6,booked:[w1.id]});
  SH({date:A(20),site:SITES[2],title:'Subcontractor crew – forklift loading',kind:'crew',role:'forklift',needed:2});
  SH({date:A(1),site:'TEST-PRACTICE',title:'Practice shift – try sign-up and clock in',test:true,needed:20});
  SH({date:A(5),site:'TEST-PRACTICE',title:'Practice driver shift',test:true,needed:20});
  var wk=parseD(T).getDay();var mon=addDays(T,-((wk+6)%7));
  [[0,e1,'07:02','15:31','TFA-02'],[0,e3,'07:00','15:00','TFA-01'],[1,e1,'07:05','15:30','TFA-02'],[1,e3,'06:58','12:00','TFA-01'],[2,e1,'07:00','15:45','TFA-02'],[2,e3,'07:00','15:30','TFB-01'],[3,e1,'07:00','15:30','TFA-02'],[4,e3,'07:10','16:00','TFA-01']].forEach(function(r){var d=addDays(mon,r[0]);if(d>T)return;
    var sh={id:uid('s'),date:d,start:'07:00',end:'15:30',role:'general',kind:'employee',orientation:false,booked:[r[1].id],test:false,needed:2,site:r[4],title:'Past shift (sample)'};db.shifts.push(sh);
    db.time.push({id:uid('t'),userId:r[1].id,shiftId:sh.id,date:d,in:r[2],out:r[3],test:false});});
  var crewPast={id:uid('s'),date:addDays(mon,1)<=T?addDays(mon,1):T,start:'07:00',end:'15:30',role:'general',kind:'crew',orientation:false,booked:[w1.id,w2.id],test:false,needed:4,site:'TFA-01',title:'Subcontractor crew – field (sample, past)'};db.shifts.push(crewPast);
  db.time.push({id:uid('t'),userId:t1.id,shiftId:db.shifts[6].id,date:A(-1),in:'09:00',out:'11:00',test:true});
  db.time.push({id:uid('t'),userId:t1.id,shiftId:db.shifts[6].id,date:T,in:'08:00',out:'10:30',test:true});

  function INV(o){var i=Object.assign({id:uid('i'),subId:s1.id,legalName:s1.company.legalName,bn:s1.company.bn,hstNo:s1.company.hst,confirmed:true,detailsChanged:false,farms:'Test Farm A',workOrders:'USDC-TFA-001',note:'',pdf:null,holdback:0,setoff:0,test:false,history:[]},o);i.hst=Math.round(i.subtotal*15)/100;i.total=Math.round((i.subtotal+i.hst)*100)/100;db.invoices.push(i);return i;}
  INV({number:'BTC-001',date:A(-44),periodStart:A(-75),periodEnd:A(-46),subtotal:12000,status:'Paid',submittedAt:addDays(T,-44),due:A(-14),paidDate:A(-15),paidRef:'EFT-TEST-1001'});
  INV({number:'BTC-002',date:A(-14),periodStart:A(-45),periodEnd:A(-16),subtotal:9850.5,status:'Submitted',submittedAt:addDays(T,-14),due:A(16),holdback:500});
  INV({subId:t1.id,number:'TEST-TESTER1-001',legalName:'Terry Tester (TEST)',bn:'000000000',hstNo:'',date:A(-1),periodStart:A(-31),periodEnd:A(-2),subtotal:100,status:'Submitted',submittedAt:A(-1),due:'',test:true,farms:'',workOrders:''});
  db.records.push({id:uid('r'),subId:s1.id,text:'Please send payroll register, worker names and dates/hours worked for the BTC-002 period.',sentAt:A(-2),due:addBusinessDays(A(-2),5),status:'Open',files:[]});
  db.records.push({id:uid('r'),subId:s2.id,text:'Please send time records for the last 2 weeks.',sentAt:A(-12),due:addBusinessDays(A(-12),5),status:'Open',files:[]});
  db.feedback.push({id:uid('f'),userId:t1.id,rating:4,comment:'Sign-up was quick. The shift list could show the start time bigger.',screen:'#/shifts',screenshot:null,status:'New',at:new Date(Date.now()-86400000).toISOString()});
  db.feedback.push({id:uid('f'),userId:t2.id,rating:3,comment:'Invoice screen: not sure what "period" means.',screen:'#/invoices',screenshot:null,status:'Reviewed',at:new Date(Date.now()-86400000*3).toISOString()});
  ['#/home','#/shifts','#/shifts','#/invoices','#/home','#/feedback','#/profile'].forEach(function(sc,i){db.events.push({u:i%2?t1.id:t2.id,role:'tester',test:true,screen:sc,type:'screen',at:new Date(Date.now()-86400000*(i%4)).toISOString(),d:A(-(i%4))});});
  db.events.push({u:t1.id,role:'tester',test:true,screen:'#/invoices',type:'invoice_submit',ms:95000,at:new Date(Date.now()-86400000).toISOString(),d:A(-1)});
  seedV2(db,{A:A,T:T,mon:mon,s1:s1,s2:s2,w1:w1,w2:w2,w3:w3,w4:w4,fA:fA,fB:fB,e1:e1,e3:e3,crewPast:crewPast,uid:uid,doc:doc});
  db.audit.push({at:now,actor:'system',action:'Sample test data created',target:'',detail:'All people and companies are fake.'});
  return db;
}
