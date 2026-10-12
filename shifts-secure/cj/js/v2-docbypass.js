/* Documents never block clocking (owner request 2026-10-04).
   Pending or missing onboarding items (own documents, details, training, employer confirmations, payroll setup,
   licence/certificate for the shift role) show a short "Documents still needed" reminder with "Continue anyway".
   The clock in/out goes through, each bypass is logged (who, when, which items) and the office gets an outbox alert
   plus a "Missing documents" follow-up list. Account switched off/suspended/not approved, terms not accepted,
   practice (TEST) rules, site orientation and the employer's own compliance (incl. pay holds and practice/temporary mode)
   are unchanged. */
var CLOCK_HARD_RE=/^(This account is|You have not accepted|Testing accounts|Practice \(TEST\)|This site needs a site orientation|Employer: |Not linked to an employer|Your employer )/;
function bpList(){if(!DB.docBypass)DB.docBypass=[];return DB.docBypass;}
function clockHardBlockers(u,shift){return blockers(u,today(),shift).filter(function(b){return CLOCK_HARD_RE.test(b.m);});}
function clockDocItems(u,shift){return blockers(u,today(),shift).filter(function(b){return !CLOCK_HARD_RE.test(b.m);});}
function docShort(m){var s=String(m).replace(/: (Missing|Pending review|Pending|Not started|Expired|Rejected|In progress|Failed|Not valid|Needs update|Overdue)\b[\s\S]*$/,'');if(s===m)s=String(m).split('. ')[0].replace(/\.$/,'');return s.length>90?s.slice(0,88)+'…':s;}
function readyForClock(u){return u.accountApproved!==false&&clockHardBlockers(u).length===0;}
function docReminderBox(u){var d=clockDocItems(u);if(!d.length)return '';
  return '<div class="alert warn docremind" id="docremind"><b>📄 Documents still needed ('+d.length+')</b> – you can still clock in and out. <a href="#/checklist">Finish them →</a>'+
  '<details class="help"><summary>ⓘ Details</summary><ul class="small">'+d.map(function(b){return '<li>'+esc(docShort(b.m))+'</li>';}).join('')+'</ul></details></div>';}
(function(){var cv=clockView;clockView=function(){var h=cv(),box=docReminderBox(ME);if(!box)return h;var i=h.indexOf('</h1>');return i<0?box+h:h.slice(0,i+5)+box+h.slice(i+5);};})();
/* checklist banner: say clearly that documents do not stop clock-in */
(function(){var ck=VIEWS['worker:checklist'];VIEWS['worker:checklist']=VIEWS['employee:checklist']=function(){var h=ck();if(readyForClock(ME)&&clockDocItems(ME).length)h='<div class="alert info" id="clockok"><b>⏱ You can clock in now.</b> Documents still needed do not stop you clocking in or out – please finish them soon. <a href="#/home">Go to the clock →</a></div>'+h;return h;};})();

function logDocBypass(u,action,site,items,t){var miss=items.map(function(b){return docShort(b.m);});
  var e={id:uid('bp'),userId:u.id,name:u.name,type:u.type,subId:u.subId||null,action:action,at:new Date().toISOString(),date:today(),time:t&&(/^Clock in/.test(action)?t.in:t.out)||hmOf(Date.now()),site:site||'',missing:miss,timeId:t?t.id:null};
  bpList().unshift(e);if(DB.docBypass.length>2000)DB.docBypass.length=2000;
  audit((/^Clock in/.test(action)?'Clock in':'Clock out')+' with documents missing',u.name,(site?site+' – ':'')+miss.join('; '));
  notify(['admin'].concat(u.subId?[u.subId]:[]),'Missing documents: '+u.name+(/crew lead/.test(action)?' was clocked in by their crew lead':' used "Continue anyway" to '+action.toLowerCase())+(site?' at '+site:'')+' on '+e.date+' at '+e.time+'. Still needed: '+miss.join('; ')+'. Follow up in Missing documents.');
  return e;}
function docModal(items,act,lead){modal('<h2>Documents still needed</h2><p>'+lead+'</p><ul class="small" id="docmissing">'+items.slice(0,6).map(function(b){return '<li>'+esc(docShort(b.m))+'</li>';}).join('')+(items.length>6?'<li>…and '+(items.length-6)+' more</li>':'')+'</ul><div class="small">The office is told and will follow up. Finish them from your checklist when you can.</div><div class="row-end"><button class="btn sec" data-act="closeModal">Go back</button><button class="btn primary" id="docContinue" data-act="'+act+'">Continue anyway</button></div>');}

ACT.clockin2=function(){var u=ME,site=PAGE_STATE.site;if(!site){toast('Pick a site first.');return;}if(openEntry(u)){toast('You are already clocked in.');return;}
  if(!readyForClock(u)){toast('Clock-in unlocks when your account is approved and your terms are accepted.');go('#/checklist');return;}
  var chosen=qVal('qIn')||Date.now(),sh=DB.shifts.filter(function(s){return s.date===today()&&s.site===site&&(s.booked||[]).indexOf(u.id)>=0&&!s.test;})[0];
  var hard=clockHardBlockers(u,sh||undefined);if(hard.length){toast(hard[0].m);return;}
  var note=((document.getElementById('notes')||{}).value||'').trim(),items=clockDocItems(u,sh||undefined);
  PAGE_STATE.pendIn={site:site,chosen:chosen,shiftId:sh?sh.id:null,note:note};
  if(items.length){docModal(items,'docclockin','You can clock in at <b>'+esc(site)+'</b> now. Still needed:');return;}
  doClockIn(u,null);};
ACT.docclockin=function(){var u=ME;if(!PAGE_STATE.pendIn||openEntry(u))return closeModal();var sh=DB.shifts.filter(function(s){return s.id===PAGE_STATE.pendIn.shiftId;})[0];doClockIn(u,clockDocItems(u,sh));};
function doClockIn(u,items){var p=PAGE_STATE.pendIn;if(!p)return;PAGE_STATE.pendIn=null;var sh=p.shiftId?DB.shifts.filter(function(s){return s.id===p.shiftId;})[0]:null;
  var t={id:uid('t'),userId:u.id,site:p.site,shiftId:sh?sh.id:null,role:sh?sh.role:jobRoleOf(u),date:today(),in:hmOf(p.chosen),inMs:p.chosen,realIn:new Date().toISOString(),out:'',clock:true,test:false,temp:u.type==='worker'&&(tempActive(subOf(u))||tempActive(u)),subId:u.subId||null,note:p.note,loc:'Location check-in (simulated)'};
  if(items&&items.length)t.docsMissing=items.map(function(b){return docShort(b.m);});
  DB.time.push(t);audit('Clocked in',u.name,p.site+' at '+hmOf(p.chosen));if(items&&items.length)logDocBypass(u,'Clock in',p.site,items,t);
  save();closeModal();toast(items&&items.length?'Clocked in ✓ (documents still needed – the office is told)':'Clocked in ✓');render();}
/* clock out: same reminder inside the confirm box; the button becomes "Continue anyway" and the bypass is logged */
(function(){var co2=ACT.clockout2,coy=ACT.clockoutyes;
  ACT.clockout2=function(el){co2(el);var m=document.getElementById('modal');if(!m||!PAGE_STATE.co)return;var t=openEntry(ME),items=clockDocItems(ME);if(!items.length)return;
    var b=m.querySelector('[data-act=clockoutyes]');if(b){b.textContent='Continue anyway – clock out';b.id='docContinue';}
    var box=document.createElement('div');box.className='alert warn small docremind';box.id='docremindout';box.innerHTML='<b>Documents still needed ('+items.length+')</b>: '+esc(items.slice(0,3).map(function(x){return docShort(x.m);}).join('; '))+(items.length>3?' …':'')+'. You can still clock out – the office is told.';
    var p=m.querySelector('p');if(p)p.parentNode.insertBefore(box,p.nextSibling);else m.querySelector('.modal').appendChild(box);};
  ACT.clockoutyes=function(el){var u=ME,t=openEntry(u),items=t&&PAGE_STATE.co?clockDocItems(u):[];coy(el);if(t&&t.out&&items.length){t.docsMissingOut=items.map(function(b){return docShort(b.m);});logDocBypass(u,'Clock out',t.site,items,t);save();}};})();

/* ---------- office: Missing documents follow-up ---------- */
NAV.admin.splice((function(){for(var i=0;i<NAV.admin.length;i++)if(NAV.admin[i][0]==='#/compliance')return i+1;return NAV.admin.length;})(),0,['#/missingdocs','Missing documents']);
function missingDocsPeople(){var by={};bpList().forEach(function(e){(by[e.userId]=by[e.userId]||[]).push(e);});
  return Object.keys(by).map(function(id){var u=user(id),es=by[id],now=u?clockDocItems(u).map(function(b){return docShort(b.m);}):[],fu=u&&u.docFollowUp;
    var last=es[0],st=!now.length?'Resolved':(fu&&fu.at>last.at?'Followed up':'Open');return {u:u,id:id,name:u?u.name:last.name,entries:es,now:now,last:last,status:st,fu:fu};})
  .sort(function(a,b){return a.last.at<b.last.at?1:-1;});}
function missingDocsOpenCount(){return missingDocsPeople().filter(function(x){return x.status==='Open';}).length;}
function fmtAt(iso){var d=new Date(iso);return d.toISOString().slice(0,10)+' '+hmOf(d.getTime());}
VIEWS['admin:missingdocs']=function(){var f=(PAGE_STATE.mdf||'Open'),all=missingDocsPeople(),list=all.filter(function(x){return f==='All'||x.status===f||(f==='Open'&&x.status==='Followed up');});
  var cnt=function(s){return all.filter(function(x){return x.status===s;}).length;};
  var x='<h1>Missing documents</h1><div class="draftline small muted">People who clocked in or out with documents still needed. Clocking is never blocked by documents; follow up here.</div>';
  x+='<div class="card"><label class="field" style="max-width:320px"><span>Show</span><select id="mdfilter" class="chipsel">'+[['Open','Still missing ('+(cnt('Open')+cnt('Followed up'))+')'],['Resolved','Resolved ('+cnt('Resolved')+')'],['All','All ('+all.length+')']].map(function(o){return '<option value="'+o[0]+'"'+(o[0]===f?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select></label>';
  x+=list.length?'<div id="mdlist">'+list.map(function(r){var u=r.u,emp=u&&u.subId&&user(u.subId);
    return '<details class="sect mdrow" data-user="'+esc(r.id)+'"'+(detailsOpen2()?' open':'')+'><summary><b>'+esc(r.name)+'</b> <span class="muted small">'+esc(u?(u.type==='worker'?'Worker'+(emp?' – '+((emp.company||{}).legalName||emp.name):''):'Employee'):'')+'</span> <span class="pill '+(r.status==='Resolved'?'s-ok':r.status==='Followed up'?'s-pend':'s-bad')+'">'+r.status+'</span> <span class="small muted">'+r.entries.length+' bypass'+(r.entries.length===1?'':'es')+' · last '+esc(fmtAt(r.last.at))+'</span></summary><div class="sect-body">'+
      (r.now.length?'<p><b>Still needed now:</b></p><ul class="small">'+r.now.map(function(m){return '<li>'+esc(m)+'</li>';}).join('')+'</ul>':'<p class="small">✓ Nothing missing now.</p>')+
      (r.fu?'<p class="small muted">Followed up '+esc(fmtAt(r.fu.at))+' by '+esc(r.fu.by)+(r.fu.note?': '+esc(r.fu.note):'')+'</p>':'')+
      '<table class="small mdlog"><thead><tr><th>When</th><th>Action</th><th>Site</th><th>Missing at the time</th></tr></thead><tbody>'+r.entries.map(function(e){return '<tr><td>'+esc(e.date+' '+e.time)+'<br><span class="muted">logged '+esc(fmtAt(e.at))+'</span></td><td>'+esc(e.action)+'</td><td>'+esc(e.site)+'</td><td>'+esc(e.missing.join('; '))+'</td></tr>';}).join('')+'</tbody></table>'+
      (r.status!=='Resolved'?'<label class="field"><span>Follow-up note (optional)</span><input class="mdnote" maxlength="200" placeholder="e.g. called, will upload Friday"></label><button class="btn sec small" data-act="mdfollow" data-id="'+esc(r.id)+'">Mark followed up</button>':'')+'</div></details>';}).join('')+'</div>':'<p class="muted" id="mdempty">Nothing here.</p>';
  return x+'</div>';};
function detailsOpen2(){return typeof detailsOpen==='function'&&detailsOpen();}
document.addEventListener('change',function(e){if(e.target&&e.target.id==='mdfilter'&&ME&&ME.type==='admin'){PAGE_STATE.mdf=e.target.value;render();}});
ACT.mdfollow=function(el){var u=user(el.dataset.id);if(!u)return;var row=el.closest('.mdrow'),ni=row&&row.querySelector('.mdnote'),note=((ni&&ni.value)||'').trim();u.docFollowUp={at:new Date().toISOString(),by:ME.name,note:note.slice(0,200)};audit('Missing documents followed up',u.name,note);save();toast('Marked followed up');render();};
if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('mdfollow');
(function(){var af=adminFlags;adminFlags=function(){var f=af(),n=missingDocsOpenCount();if(n)f.unshift({t:'Missing documents',c:'s-bad',h:n+' '+(n===1?'person':'people')+' clocked in or out with documents still needed. <a href="#/missingdocs">Follow up →</a>'});return f;};})();
/* crew lead clocks: no prompt for the lead, but each crew member with documents still needed is logged for the office */
if(typeof newCrewEntry==='function')(function(){var nc=newCrewEntry;newCrewEntry=function(w,sh,hm){var t=nc.apply(this,arguments);try{var it=clockDocItems(w,sh);if(it.length&&t){t.docsMissing=it.map(function(b){return docShort(b.m);});logDocBypass(w,'Clock in (crew lead '+ME.name+')',sh.site,it,t);}}catch(e){}return t;};})();
