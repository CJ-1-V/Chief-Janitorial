/* v2-training.js – Compliance training + quizzes (Section 9 of the App Registration Requirements). TEST ONLY.
   - Items T1–T8 per job role (editable in office Settings). First aid only for designated first aiders.
   - Quizzes: multiple choice, 4 options, one correct; question order AND option order shuffled on every attempt; pass mark 80%.
   - After every attempt (pass or fail): each question, the person's answer, the correct answer and the explanation; unlimited immediate retakes (reshuffled).
   - Every attempt recorded (date/time, score, pass/fail). Passed items renew every 12 months; reminders 14 days ahead and on the day.
   - Certificates (forklift/operator, first aid) use the normal document upload or "type the details" with the "I confirm" tick.
   - No shift booking until the role's items are done, OR the office approves a 14-day pass (existing pass mechanism, logged; pay held as usual).
   - Subcontractors confirm their workers' items. Office training matrix with filters + CSV. Testing accounts can try quizzes; results are TEST. */
'use strict';
var QUIZ_PASS=0.8;
var TRAIN_ITEMS={
  whmis:{n:'T1',label:'WHMIS 2015',quiz:'whmis',months:12,module:'WHMIS 2015 is Canada\'s system for hazard information at work. Read the label and the Safety Data Sheet (SDS) before using a product; learn the pictograms and the signal words "Danger" and "Warning". Product- and site-specific WHMIS training is given at the site.'},
  rights:{n:'T2',label:'PEI worker rights and responsibilities',quiz:'rights',months:12,module:'You have the right to know about hazards, to take part in health and safety, and to refuse unsafe work without being punished. You must work safely, use the protective equipment provided and report hazards. PEI Employment Standards cover pay, vacation pay and paid holidays.'},
  orientation:{n:'T3',label:'Farm / site safety orientation',quiz:'orientation',months:12,module:'Stay clear of moving parts and PTO shafts, ride only in proper seats, lift with your legs, watch for heat and cold stress, stay out of sprayed areas until the restricted-entry interval (REI) ends, know the emergency and first-aid contacts and wear your PPE. The farm or crew supervisor gives the site walk-through.'},
  machinery:{n:'T4',label:'Forklift / machinery operator',quiz:'machinery',cert:'forklift',months:12,module:'Only trained, authorized people operate forklifts, tractors or other powered mobile equipment. Inspect the machine before each shift, wear the seatbelt, never lift people on forks or pallets, keep guards in place and report defects. Your certificate is uploaded (or typed) under Licences & certificates.'},
  firstaid:{n:'T5',label:'First aid (designated first aiders)',cert:'first_aid',months:0,module:'Designated first aiders keep a current first aid certificate (Basic, Intermediate or Advanced) matching the workplace risk assessment. Upload it or type the details under Licences & certificates.'},
  food:{n:'T6',label:'Food safety / GMP hygiene',quiz:'food',months:12,module:'Wash your hands, wear the protective clothing provided, no jewellery, report illness and cuts, no eating or gum in food areas, never pack dropped product, report glass breakage at once and keep chemicals away from produce.'},
  harassment:{n:'T7',label:'Harassment and violence prevention',quiz:'harassment',months:12,module:'Harassment and violence are not accepted. Report it to your supervisor, or to the office if the supervisor is involved. Reports are kept confidential and there is no retaliation. You can also go to the PEI Human Rights Commission. Report threats of violence right away.'},
  incident:{n:'T8',label:'Incident reporting',quiz:'incident',months:12,module:'Report every injury, near miss and hazard right away, even small ones. Serious injuries are reported to WCB PEI immediately. Don\'t disturb the scene of a serious incident. Use the app\'s incident form or tell your supervisor.'}};
DOCS.first_aid=DOCS.first_aid||{label:'First aid certificate',expiry:true,who:'person'};
JOB_ROLES.field.label='Field labour / general (all other roles)';
if(!JOB_ROLES.packer){var _jr={field:JOB_ROLES.field,packer:{label:'Grader / packer',legacy:[]},forklift:JOB_ROLES.forklift,driver:JOB_ROLES.driver};Object.keys(JOB_ROLES).forEach(function(k){delete JOB_ROLES[k];});Object.keys(_jr).forEach(function(k){JOB_ROLES[k]=_jr[k];});}
defaultRoleDocs=function(){return {field:[],packer:[],forklift:['forklift','forklift_years'],driver:['driver_abstract']};};
function defaultTrainRoles(){var base=['whmis','rights','orientation','harassment','incident'];return {field:base.slice(),packer:base.concat(['food']),forklift:base.concat(['machinery']),driver:base.slice()};}
function trainRoles(){return (typeof DB!=='undefined'&&DB&&DB.settings&&DB.settings.trainRoles)||defaultTrainRoles();}
function trainItemsFor(u){if(u.type==='tester')return Object.keys(TRAIN_ITEMS).filter(function(k){return TRAIN_ITEMS[k].quiz;});if(u.type!=='worker'&&u.type!=='employee')return [];
  var l=(trainRoles()[jobRoleOf(u)]||[]).filter(function(k){return TRAIN_ITEMS[k];});if(u.firstAider&&l.indexOf('firstaid')<0)l.push('firstaid');return Object.keys(TRAIN_ITEMS).filter(function(k){return l.indexOf(k)>=0;});}
function attemptsOf(u,item){return (DB.quizAttempts||[]).filter(function(a){return a.userId===u.id&&a.item===item;});}
function certState(u,kind){var d=latestDoc(u.id,kind);if(!d)return {ok:false,s:'Certificate missing',c:'s-bad'};var st=docStatus(d);var ok=d.status==='approved'&&!/Expired/.test(st.s);return {ok:ok,s:'Certificate: '+st.s,c:st.c,exp:docExpiry(d)};}
function trainState(u,item){var it=TRAIN_ITEMS[item],r={item:item,attempts:0,score:null,passedAt:'',expiry:'',ok:true,s:'Passed',c:'s-ok'};
  if(it.quiz){var at=attemptsOf(u,item);r.attempts=at.length;var lp=at.filter(function(a){return a.pass;}).pop(),last=at[at.length-1];r.score=last?last.score:null;
    if(lp){r.passedAt=isoLocal(new Date(lp.at));r.expiry=addDays(r.passedAt,365);r.score=lp.score;if(r.expiry<=today()){r.ok=false;r.s='Expired';r.c='s-bad';}}
    else if(at.length){r.ok=false;r.s='Failed – retaking';r.c='s-bad';}else{r.ok=false;r.s='Not started';r.c='s-mut';}}
  if(it.cert){var cs=certState(u,it.cert);r.cert=cs;if(!it.quiz)r.expiry=cs.exp||'';if(!cs.ok){if(r.ok){r.s=cs.s;r.c=cs.c;}r.ok=false;}}
  if(r.ok&&r.expiry&&daysBetween(today(),r.expiry)<=30){r.s='Passed – expires '+r.expiry;r.c='s-warn';}
  r.pass=!r.ok&&u.type!=='tester'&&tempActive(u,today());if(r.pass){r.s2=r.s;r.s='Pass open';r.c='s-temp';}
  r.confirm=(DB.trainConfirms||[]).filter(function(c){return c.workerId===u.id&&c.item===item&&c.passedAt===r.passedAt;})[0]||null;return r;}
function trainingDone(u){return trainItemsFor(u).every(function(k){return trainState(u,k).ok;});}

/* checklist + blocking: replaces the old one-tap "Safety training acknowledgement" */
(function(){var orq=requirements;requirements=function(u){var R=orq(u).filter(function(r){return r.key!=='safety';});if(u.type!=='worker'&&u.type!=='employee')return R;
  trainItemsFor(u).forEach(function(k){var s=trainState(u,k);R.push({key:'train_'+k,label:'Training: '+TRAIN_ITEMS[k].label,st:{s:s.s,c:s.c},ok:s.ok,msg:s.ok?'':s.pass?'Covered by a 14-day pass – finish it before the pass ends.':TRAIN_ITEMS[k].quiz?'Read the short module and pass the quiz (80%).':'Upload the certificate or type the details.',fix:'#/training'});});return R;};})();
(function(){var ob=blockers;blockers=function(u,date,shift){var b=ob(u,date,shift).filter(function(x){return x.fix!=='#/safety'&&!/safety acknowledgement/i.test(x.m);});
  if((u.type==='worker'||u.type==='employee')&&tempActive(u,date||today()))b=b.filter(function(x){return x.m.indexOf('Training: ')!==0;});return b;};})();

/* ---------- quiz engine ---------- */
function shuffled(n){var a=[];for(var i=0;i<n;i++)a.push(i);for(var j=n-1;j>0;j--){var k=Math.floor(Math.random()*(j+1));var t=a[j];a[j]=a[k];a[k]=t;}return a;}
function bankQ(item,id){return QUIZ_BANK[TRAIN_ITEMS[item].quiz].filter(function(q){return q.id===id;})[0];}
ACT.quizstart=function(el){var item=el.dataset.item,it=TRAIN_ITEMS[item];if(!it||!it.quiz)return;var bank=QUIZ_BANK[it.quiz];
  PAGE_STATE.quiz={item:item,started:new Date().toISOString(),qs:shuffled(bank.length).map(function(i){return {id:bank[i].id,perm:shuffled(4)};})};closeModal();go('#/quiz');};
function quizView(){var Q=PAGE_STATE.quiz;if(!Q)return trainingPage();var it=TRAIN_ITEMS[Q.item];
  return '<h1>Quiz: '+esc(it.label)+'</h1><p class="small muted">'+Q.qs.length+' questions · pass mark 80% · questions and answers are in a new random order every attempt'+(ME.type==='tester'?' · <span class="badge-test">TEST</span> results never count':'')+'</p><form data-form="quizsubmit" id="quizform">'+
  Q.qs.map(function(q,i){var b=bankQ(Q.item,q.id);return '<fieldset class="card quizq" data-qid="'+esc(q.id)+'"><legend><b>'+(i+1)+'. '+esc(b.q)+'</b></legend>'+q.perm.map(function(o,j){return '<label class="inline qopt-row"><input type="radio" name="q'+i+'" value="'+j+'"> <span><b>'+'ABCD'[j]+')</b> '+esc(b.opts[o])+'</span></label>';}).join('')+'</fieldset>';}).join('')+
  '<button type="submit">Submit answers</button> <a class="btn sec" href="#/training">Cancel</a></form>';}
FORMS.quizsubmit=function(f,d){var Q=PAGE_STATE.quiz;if(!Q){go('#/training');return;}var miss=Q.qs.filter(function(q,i){return d['q'+i]==null||d['q'+i]==='';}).length;if(miss){toast('Please answer every question ('+miss+' left).');return;}
  var ans=Q.qs.map(function(q,i){var b=bankQ(Q.item,q.id),j=+d['q'+i],chosen=q.perm[j];return {qid:q.id,perm:q.perm,shown:j,chosen:chosen,correct:b.ans,ok:chosen===b.ans};});
  var c=ans.filter(function(a){return a.ok;}).length,n=ans.length,pass=c>=QUIZ_PASS*n-1e-9;
  var a={id:uid('qa'),userId:ME.id,item:Q.item,version:'1.0',at:new Date().toISOString(),tz:tz(),correct:c,total:n,score:Math.round(c/n*1000)/10,pass:pass,answers:ans,test:ME.type==='tester'};
  (DB.quizAttempts=DB.quizAttempts||[]).push(a);audit('Quiz attempt'+(a.test?' (TEST)':''),ME.name,TRAIN_ITEMS[Q.item].label+': '+c+'/'+n+' ('+a.score+'%) '+(pass?'PASS':'FAIL'));
  if(pass&&ME.subId&&!a.test)notify(ME.subId,ME.name+' passed '+TRAIN_ITEMS[Q.item].label+' ('+a.score+'%). Please confirm it in your Workers page.');
  PAGE_STATE.quiz=null;PAGE_STATE.quizResult=a.id;save();go('#/quizresult');};
function quizResultView(){var a=(DB.quizAttempts||[]).filter(function(x){return x.id===PAGE_STATE.quizResult;})[0];if(!a||a.userId!==ME.id)return trainingPage();var it=TRAIN_ITEMS[a.item];
  return '<h1>Results: '+esc(it.label)+'</h1><div class="alert '+(a.pass?'ok':'bad')+'" id="quizscore"><b>'+(a.pass?'PASSED':'NOT PASSED')+' – '+a.correct+' of '+a.total+' correct ('+a.score+'%).</b> Pass mark 80%.'+(a.test?' <span class="badge-test">TEST</span> – never counts.':'')+'</div>'+
  '<div class="row"><button data-act="quizstart" data-item="'+a.item+'">'+(a.pass?'Take it again':'Retake now')+'</button>'+(a.pass?'':' <a class="btn sec" href="#/training" data-module="'+a.item+'">Back to the module</a>')+' <a class="btn sec" href="#/training">Back to training</a></div><h2>Review</h2>'+
  a.answers.map(function(x,i){var b=bankQ(a.item,x.qid);var shownCorrect=x.perm.indexOf(x.correct);return '<div class="card review-q '+(x.ok?'rv-ok':'rv-bad')+'"><b>'+(i+1)+'. '+esc(b.q)+'</b><div class="small">Your answer: <b>'+'ABCD'[x.shown]+') '+esc(b.opts[x.chosen])+'</b> '+(x.ok?'<span class="pill s-ok">Correct</span>':'<span class="pill s-bad">Wrong</span>')+'</div><div class="small">Correct answer: <b>'+'ABCD'[shownCorrect]+') '+esc(b.opts[x.correct])+'</b></div><div class="small muted">Why: '+esc(b.why)+'</div></div>';}).join('');}

/* ---------- person training page ---------- */
function trainingPage(){var u=ME,items=trainItemsFor(u);
  return '<h1>Training & quizzes</h1><p class="small">Complete every item for your job role (<b>'+esc(JOB_ROLES[jobRoleOf(u)]?JOB_ROLES[jobRoleOf(u)].label:'')+'</b>) before your first shift. Read the short module, then pass the quiz (80%). You can retake a quiz right away, as many times as you need. Passed items renew every 12 months.'+(u.type==='tester'?' <span class="badge-test">TEST</span> Testing account: results never count.':'')+'</p>'+
  (tempActive(u,today())&&!trainingDone(u)?'<div class="alert warn small">The office gave you a 14-day pass. Finish your training before it ends ('+esc(u.temp.end)+').</div>':'')+
  items.map(function(k){var it=TRAIN_ITEMS[k],s=trainState(u,k);return '<div class="card trainitem" id="tr-'+k+'"><div class="row"><b>'+it.n+' · '+esc(it.label)+'</b> <span class="pill '+s.c+'">'+esc(s.s)+'</span></div><div class="small muted">'+(s.attempts?'Attempts: '+s.attempts+' · last score '+s.score+'%':'')+(s.passedAt?' · passed '+s.passedAt+' · renew by '+s.expiry:'')+(s.cert?' · '+esc(s.cert.s):'')+'</div>'+
    '<details'+(PAGE_STATE.openModule===k?' open':'')+'><summary>Read the module</summary><p class="small">'+esc(it.module)+'</p></details>'+
    (it.quiz?'<button class="small" data-act="quizstart" data-item="'+k+'">'+(s.attempts?'Retake quiz':'Start quiz')+'</button> ':'')+(it.cert?'<a class="btn small sec" href="#/docs">'+(it.cert==='first_aid'?'First aid certificate':'Operator certificate')+'</a>':'')+'</div>';}).join('')+
  '<p class="small muted">Site-specific parts (WHMIS products, farm walk-through, food safety rules) are given at the site by the supervisor.</p>';}
['worker','employee','tester'].forEach(function(t){VIEWS[t+':training']=trainingPage;VIEWS[t+':safety']=trainingPage;VIEWS[t+':quiz']=quizView;VIEWS[t+':quizresult']=quizResultView;});
['worker','employee'].forEach(function(t){NAV[t]=NAV[t].map(function(n){return n[0]==='#/safety'?['#/training','Training & quizzes']:n;});});
if(NAV.tester&&!NAV.tester.some(function(n){return n[0]==='#/training';}))NAV.tester.push(['#/training','Training & quizzes (TEST)']);
(function(){var om=menuView;menuView=function(){var u=ME,todo=trainItemsFor(u).filter(function(k){return !trainState(u,k).ok;}).length;return om().replace('href="#/safety"','href="#/training"').replace('<b>Safety training</b>','<b>Training &amp; quizzes</b><small>'+(todo?todo+' item(s) to do':'All passed')+'</small>');};})();
/* safetyfix1 (2026-10-06): the employee/worker Menu still showed "Safety training" -> #/safety, which bounced to #/home (the Clock screen).
   Why: v2-clock.js stores VIEWS['worker:menu']/VIEWS['employee:menu'] = the ORIGINAL menuView, so the wrapper above never ran,
   and #/safety is no longer in NAV (renamed to #/training), so the router's nav check sent it to #/home.
   Fix: (1) apply the same Menu relabel to the menu VIEWS themselves; (2) treat any old #/safety link/bookmark as #/training. */
(function(){function relabel(x){var u=ME,todo=trainItemsFor(u).filter(function(k){return !trainState(u,k).ok;}).length;return String(x).replace('href="#/safety"','href="#/training"').replace('<b>Safety training</b>','<b>Training &amp; quizzes</b><small>'+(todo?todo+' item(s) to do':'All passed')+'</small>');}
  ['worker','employee'].forEach(function(t){var ov=VIEWS[t+':menu'];if(typeof ov==='function')VIEWS[t+':menu']=function(h){return relabel(ov(h));};});
  var og=gateRoute;gateRoute=function(h){h=og(h);return (h==='#/safety'&&ME&&['worker','employee','tester'].indexOf(ME.type)>=0)?'#/training':h;};})();
document.addEventListener('click',function(e){var a=e.target.closest&&e.target.closest('[data-module]');if(a)PAGE_STATE.openModule=a.dataset.module;});

/* ---------- reminders: 14 days ahead and on the day ---------- */
(function(){var ora=runAlerts;runAlerts=function(){ora();DB.users.forEach(function(u){if(!u.active||(u.type!=='worker'&&u.type!=='employee'))return;trainItemsFor(u).forEach(function(k){var s=trainState(u,k);if(!s.expiry||!TRAIN_ITEMS[k].quiz)return;var left=daysBetween(today(),s.expiry);if(left<0||left>14)return;
  var mark=left===0?0:14,L=TRAIN_ITEMS[k].label,key='tr|'+u.id+'|'+k+'|'+s.expiry+'|'+mark;
  notify(u.id,left?'Reminder: your '+L+' training expires on '+s.expiry+' ('+left+' days). Retake the quiz in the app.':'Your '+L+' training expires today. Retake the quiz to stay eligible for shifts.',key);
  notify(['admin'].concat(u.subId?[u.subId]:[]),u.name+': '+L+' training '+(left?'expires on '+s.expiry+' ('+left+' days)':'expires today')+'.',key);});});save();};})();

/* ---------- subcontractor confirms each worker's items ---------- */
ACT.trainconfirm=function(el){var w=user(el.dataset.id);if(!w||w.subId!==ME.id){toast('Not allowed.');return;}var s=trainState(w,el.dataset.item);if(!s.passedAt&&!s.ok){toast('Only completed items can be confirmed.');return;}
  (DB.trainConfirms=DB.trainConfirms||[]).push({id:uid('tc'),workerId:w.id,item:el.dataset.item,passedAt:s.passedAt,by:ME.name,company:ME.company.legalName,at:new Date().toISOString()});audit('Subcontractor confirmed worker training',w.name,TRAIN_ITEMS[el.dataset.item].label);save();toast('Confirmed.');render();};
ACT.firstaider=function(el){var w=user(el.dataset.id);if(!w||(ME.type!=='admin'&&w.subId!==ME.id)){toast('Not allowed.');return;}w.firstAider=!w.firstAider;audit((w.firstAider?'Designated':'Removed')+' first aider',w.name);save();render();};
(function(){var ow=VIEWS['sub:workers'];VIEWS['sub:workers']=function(){var x=ow(),ws=users('worker').filter(function(w){return w.subId===ME.id;});
  return x+'<div class="card" id="subtraining"><h3 style="margin-top:0">Training – confirm each worker\'s items</h3><p class="small">As the employer you stay responsible for your workers\' training. Confirm each item once the worker has completed it (your name and the date are recorded). The office can ask for proof.</p>'+ws.map(function(w){return '<div class="subtr"><b>'+esc(w.name)+'</b> <span class="small muted">'+esc(JOB_ROLES[jobRoleOf(w)].label)+'</span> <button class="small sec" data-act="firstaider" data-id="'+w.id+'">'+(w.firstAider?'Designated first aider ✓ (remove)':'Make designated first aider')+'</button><ul class="small">'+trainItemsFor(w).map(function(k){var s=trainState(w,k);return '<li>'+esc(TRAIN_ITEMS[k].label)+' <span class="pill '+s.c+'">'+esc(s.s)+'</span> '+(s.confirm?'Confirmed by '+esc(s.confirm.by)+' on '+esc(s.confirm.at.slice(0,10)):(s.ok?'<button class="small" data-act="trainconfirm" data-id="'+w.id+'" data-item="'+k+'">Confirm completed</button>':''))+'</li>';}).join('')+'</ul></div>';}).join('')+'</div>';};})();

/* ---------- office: training matrix ---------- */
if(!NAV.admin.some(function(n){return n[0]==='#/training';}))NAV.admin.splice(Math.min(4,NAV.admin.length),0,['#/training','Training matrix']);
function trainPeople(){return DB.users.filter(function(u){return (u.type==='worker'||u.type==='employee')&&u.active!==false;});}
function matrixRows(){var F=PAGE_STATE.tf||{};return trainPeople().filter(function(u){if(F.sub&&(F.sub==='emp'?u.type!=='employee':u.subId!==F.sub))return false;if(F.role&&jobRoleOf(u)!==F.role)return false;
  if(F.item&&trainItemsFor(u).indexOf(F.item)<0)return false;if(F.status){var its=F.item?[F.item]:trainItemsFor(u);var st=its.map(function(k){return trainState(u,k);});
    if(F.status==='todo'&&!st.some(function(s){return !s.ok;}))return false;if(F.status==='done'&&!st.every(function(s){return s.ok;}))return false;if(F.status==='pass'&&!st.some(function(s){return s.pass;}))return false;if(F.status==='soon'&&!st.some(function(s){return s.expiry&&daysBetween(today(),s.expiry)<=30&&s.expiry>=today();}))return false;}return true;});}
VIEWS['admin:training']=function(){var F=PAGE_STATE.tf||{},rows=matrixRows(),items=Object.keys(TRAIN_ITEMS);
  var opt=function(v,l,cur){return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(l)+'</option>';};
  var x='<h1>Training matrix</h1><p class="small muted">One row per worker / employee, one column per item: status, last or passing score, attempts, date passed and expiry. Pass mark 80%. A 14-day pass lets a person book shifts while training is finished (logged, pay held for subcontractor workers as usual).</p>'+
  '<form data-form="trainfilter" class="row card"><select name="sub">'+opt('','All employers',F.sub)+opt('emp','UnScramble employees',F.sub)+users('sub').map(function(s){return opt(s.id,s.company.legalName||s.name,F.sub);}).join('')+'</select><select name="role">'+opt('','All roles',F.role)+Object.keys(JOB_ROLES).map(function(k){return opt(k,JOB_ROLES[k].label,F.role);}).join('')+'</select><select name="item">'+opt('','All items',F.item)+items.map(function(k){return opt(k,TRAIN_ITEMS[k].n+' '+TRAIN_ITEMS[k].label,F.item);}).join('')+'</select><select name="status">'+opt('','Any status',F.status)+opt('todo','Not complete',F.status)+opt('done','All complete',F.status)+opt('pass','Pass open',F.status)+opt('soon','Expiring in 30 days',F.status)+'</select><button class="small">Filter</button> <button type="button" class="small sec" data-act="traincsv">Export CSV</button></form>'+
  '<div class="tw"><table id="trainmatrix"><tr><th>Person</th><th>Role</th>'+items.map(function(k){return '<th title="'+esc(TRAIN_ITEMS[k].label)+'">'+TRAIN_ITEMS[k].n+'<div class="small">'+esc(TRAIN_ITEMS[k].label.split(' ')[0])+'</div></th>';}).join('')+'<th>Can book?</th><th></th></tr>'+
  rows.map(function(u){var need=trainItemsFor(u),done=trainingDone(u),pass=tempActive(u,today());return '<tr data-user="'+esc(u.username||u.id)+'"><td><a href="#" data-act="person" data-id="'+u.id+'">'+esc(u.name)+'</a><div class="small muted">'+esc(u.type==='employee'?'UnScramble employee':employerName(u))+(u.firstAider?' · first aider':'')+'</div></td><td class="small">'+esc(JOB_ROLES[jobRoleOf(u)].label)+'</td>'+
    items.map(function(k){if(need.indexOf(k)<0)return '<td class="small muted">–</td>';var s=trainState(u,k);return '<td class="small tcell" data-item="'+k+'"><span class="pill '+s.c+'">'+esc(s.s.replace(/ – expires.*/,' (exp. soon)'))+'</span>'+(s.score!=null?'<div>'+s.score+'% · '+s.attempts+' att.</div>':'')+(s.passedAt?'<div>'+s.passedAt+'</div>':'')+(s.expiry?'<div>exp. '+s.expiry+'</div>':'')+(u.type==='worker'&&s.ok&&TRAIN_ITEMS[k].quiz?'<div>'+(s.confirm?'Sub ✓':'<span style="color:#a33">Sub to confirm</span>')+'</div>':'')+'</td>';}).join('')+
    '<td>'+(done?'<span class="pill s-ok">Yes</span>':pass?'<span class="pill s-temp">14-day pass</span>':'<span class="pill s-bad">No</span>')+'</td><td><button class="small sec" data-act="passmodal" data-id="'+u.id+'">14-day pass</button></td></tr>';}).join('')+'</table></div>';
  var att=(DB.quizAttempts||[]).filter(function(a){return !a.test;});var miss={};att.forEach(function(a){a.answers.forEach(function(q){if(!q.ok)miss[a.item+'|'+q.qid]=(miss[a.item+'|'+q.qid]||0)+1;});});
  x+='<h2>Quiz analytics (no personal details)</h2><div class="tw"><table id="quizstats"><tr><th>Topic</th><th>Attempts</th><th>Pass rate</th><th>Most-missed question</th></tr>'+items.filter(function(k){return TRAIN_ITEMS[k].quiz;}).map(function(k){var a=att.filter(function(x){return x.item===k;}),p=a.filter(function(x){return x.pass;}).length;var mm=Object.keys(miss).filter(function(m){return m.indexOf(k+'|')===0;}).sort(function(m1,m2){return miss[m2]-miss[m1];})[0];
    return '<tr><td>'+esc(TRAIN_ITEMS[k].label)+'</td><td>'+a.length+'</td><td>'+(a.length?Math.round(p/a.length*100)+'%':'–')+'</td><td class="small">'+(mm?esc(bankQ(k,mm.split('|')[1]).q)+' ('+miss[mm]+'×)':'–')+'</td></tr>';}).join('')+'</table></div>';
  return x;};
FORMS.trainfilter=function(f,d){PAGE_STATE.tf={sub:d.sub,role:d.role,item:d.item,status:d.status};render();};
ACT.traincsv=function(){var items=Object.keys(TRAIN_ITEMS),rows=[['Person','Employer','Role'].concat(items.map(function(k){return TRAIN_ITEMS[k].n+' '+TRAIN_ITEMS[k].label;})).concat(['Can book'])];
  matrixRows().forEach(function(u){rows.push([u.name,u.type==='employee'?'UnScramble':employerName(u),JOB_ROLES[jobRoleOf(u)].label].concat(items.map(function(k){if(trainItemsFor(u).indexOf(k)<0)return 'n/a';var s=trainState(u,k);return s.s+(s.score!=null?' '+s.score+'%':'')+(s.expiry?' exp '+s.expiry:'');})).concat([trainingDone(u)?'yes':tempActive(u,today())?'14-day pass':'no']));});
  downloadText('training-matrix-'+today()+'.csv',rows.map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(',');}).join('\n'),'text/csv');audit('Exported training matrix');save();};

/* ---------- office Settings: training items per job role ---------- */
(function(){var os=VIEWS['admin:settings'];VIEWS['admin:settings']=function(){var x=os(),m=trainRoles(),items=Object.keys(TRAIN_ITEMS).filter(function(k){return k!=='firstaid';});
  var card='<div class="card" id="trainroles"><h3 style="margin-top:0">Training items by job role</h3><p class="small">Required before the first shift. First aid is required only for designated first aiders (set per worker). Pass mark 80%; quiz items renew every 12 months.</p><form data-form="trainroles"><div class="tw"><table><tr><th>Role</th>'+items.map(function(k){return '<th class="small">'+TRAIN_ITEMS[k].n+' '+esc(TRAIN_ITEMS[k].label)+'</th>';}).join('')+'</tr>'+
    Object.keys(JOB_ROLES).map(function(r){return '<tr><td>'+esc(JOB_ROLES[r].label)+'</td>'+items.map(function(k){return '<td><input type="checkbox" name="'+r+'__'+k+'" value="1"'+((m[r]||[]).indexOf(k)>=0?' checked':'')+' aria-label="'+esc(JOB_ROLES[r].label+' – '+TRAIN_ITEMS[k].label)+'"></td>';}).join('')+'</tr>';}).join('')+'</table></div><button class="small">Save training items</button></form></div>';
  return x.replace('<div class="card" id="roledocs">',card+'<div class="card" id="roledocs">');};})();
FORMS.trainroles=function(f,d){var m={};Object.keys(JOB_ROLES).forEach(function(r){m[r]=Object.keys(TRAIN_ITEMS).filter(function(k){return k!=='firstaid'&&!!d[r+'__'+k];});});DB.settings.trainRoles=m;audit('Changed training items by job role','',JSON.stringify(m));save();toast('Training items saved.');render();};

/* ---------- seed + migration ---------- */
function seedTraining(db){db.quizAttempts=db.quizAttempts||[];db.trainConfirms=db.trainConfirms||[];if(!db.settings.trainRoles)db.settings.trainRoles=defaultTrainRoles();if(db.settings.roleDocs&&!db.settings.roleDocs.packer)db.settings.roleDocs.packer=[];
  var by=function(n){return db.users.filter(function(u){return u.username===n;})[0];};var DBsave=DB;DB=db;
  ['worker1','worker2','worker4','employee1','employee3'].forEach(function(n){var u=by(n);if(!u)return;trainItemsFor(u).forEach(function(k){var it=TRAIN_ITEMS[k];if(!it.quiz||db.quizAttempts.some(function(a){return a.userId===u.id&&a.item===k;}))return;
    var days=n==='worker2'&&k==='whmis'?352:20+Object.keys(TRAIN_ITEMS).indexOf(k);var bank=QUIZ_BANK[it.quiz],tot=bank.length,c=tot-(k==='rights'?1:0);
    if(n==='worker4'&&k==='incident')db.quizAttempts.push({id:uid('qa'),userId:u.id,item:k,version:'1.0',at:new Date(Date.now()-86400000*(days+1)).toISOString(),tz:'America/Halifax',correct:6,total:tot,score:Math.round(6/tot*1000)/10,pass:false,answers:bank.map(function(q,i){return {qid:q.id,perm:[0,1,2,3],shown:i<6?q.ans:(q.ans+1)%4,chosen:i<6?q.ans:(q.ans+1)%4,correct:q.ans,ok:i<6};}),test:false,sample:true});
    db.quizAttempts.push({id:uid('qa'),userId:u.id,item:k,version:'1.0',at:new Date(Date.now()-86400000*days).toISOString(),tz:'America/Halifax',correct:c,total:tot,score:Math.round(c/tot*1000)/10,pass:true,answers:bank.map(function(q,i){var ok=i>=tot-c;return {qid:q.id,perm:[0,1,2,3],shown:ok?q.ans:(q.ans+1)%4,chosen:ok?q.ans:(q.ans+1)%4,correct:q.ans,ok:ok};}),test:false,sample:true});});});
  var w1=by('worker1');if(w1)trainItemsFor(w1).forEach(function(k){var s=trainState(w1,k);if(s.passedAt)db.trainConfirms.push({id:uid('tc'),workerId:w1.id,item:k,passedAt:s.passedAt,by:'Sample Owner',company:'Bluewater Test Crew Inc.',at:new Date(Date.now()-86400000*15).toISOString()});});
  DB=DBsave;}
(function(){var os=seedV2;seedV2=function(db,o){os(db,o);seedTraining(db);};})();
(function(){var ol=load;load=function(){ol();if(DB&&!DB.quizAttempts){seedTraining(DB);save();}};})();
ROLE_ONLY.quizstart=['worker','employee','tester'];ROLE_ONLY.quizsubmit=['worker','employee','tester'];ROLE_ONLY.trainconfirm=['sub'];ROLE_ONLY.firstaider=['sub','admin'];
ADMIN_ONLY_FORM.push('trainfilter','trainroles');ADMIN_ONLY_ACT.push('traincsv');
/* designated first aiders upload (or type) a first aid certificate on their documents page */
docKindsFor=(function(od){return function(u){var k=od(u);if(u.firstAider&&u.type!=='sub'&&k.indexOf('first_aid')<0)k=k.concat(['first_aid']);return k;};})(docKindsFor);
