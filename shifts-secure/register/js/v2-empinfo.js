/* empinfo1 – "Total hours worked" + small infographics on the employee side (owner Oct 7, 2026 12:46 AM: "add more infographics to
   employee side too"; 12:47 AM: "which shows like total hours worked"). Employee side = workers, crew leads, company employees and
   subcontractors (not office, farms or testers). Pairs with css/empinfo.css. Light inline SVG / CSS only, no libraries.
   Uses ONLY data the screens already have – no new data, no database write, no extra Supabase call:
   - Hours = the person's own time entries (subcontractor: the time entries of their own workers), paid hours = worked minus the
     unpaid break, exactly like the "Hrs" column on My shifts. "Approved hours": shifts still open (on shift now), test entries and
     late / crew-lead entries still waiting for the office (or rejected) are NOT counted; waiting hours are shown on their own line.
   - My shifts: big TOTAL HOURS WORKED card (all time + This week + pay period) and a Mon–Sun bar chart with ‹ › to older weeks.
     Pay period: company employees = the two-week payroll period the office uses (v2-payroll.js); subcontractor workers are paid
     by their employer, so they get "Last 30 days"; subcontractors get their current 30-day invoice period (as on their Dashboard).
   - Clock screen: compact hours strip (today, this week, pay period + tiny week bars). Training & quizzes: progress ring
     (X of Y passed) with expiring / to-do items highlighted. Registration checklist: step bar (done / for you / waiting).
   - Subcontractor Dashboard: crew total hours card + week chart, and a crew training ring (workers fully trained vs not).
   No site codes, farm or client names appear in any of these graphics (dates and hours only). Animations are short and only run
   when the phone/computer does not ask for reduced motion. Turn off: remove the 2 lines in index.html. */
(function(){
  if(typeof VIEWS==='undefined'||typeof DB==='undefined'||typeof ACT==='undefined')return;
  var EMP={worker:1,employee:1};
  function isEmp(){return typeof ME!=='undefined'&&ME&&!!EMP[ME.type];}
  function isSub(){return typeof ME!=='undefined'&&ME&&ME.type==='sub';}
  function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function md(d){return shortDay(d).replace(/^\w+ /,'');}                                   /* "Oct 5" */
  function rng(a,b){var A=md(a),Bm=md(b);return A+' – '+(A.slice(0,3)===Bm.slice(0,3)?Bm.slice(4):Bm);}
  function f2(h){return (Math.round(h*100)/100).toFixed(2);}
  function fs(h){var v=Math.round(h*100)/100;return String(v);}                              /* 8.25, 8.5, 8 */
  /* ---------- hours from time entries ---------- */
  function paidH(t){if(!t||!t.out||!t['in'])return 0;var w=hrs(t['in'],t.out);return Math.max(0,w-(typeof unpaidBreak==='function'?unpaidBreak(w,t):0));}
  function isWaiting(t){return t.lateEntry==='pending';}
  function counts(t){return !t.test&&!!t.out&&t.lateEntry!=='pending'&&t.lateEntry!=='rejected';}
  function idSet(ids){var s={};ids.forEach(function(i){s[i]=1;});return s;}
  function crewOf(s){return users('worker').filter(function(w){return w.subId===s.id;});}
  function idsFor(u){return u.type==='sub'?crewOf(u).map(function(w){return w.id;}):[u.id];}
  function periodFor(u){var T=today();
    if(u.type==='employee'&&typeof payPeriodOf==='function'){var p=payPeriodOf(T);return {start:p.start,end:p.end,label:'Pay period',sub:rng(p.start,p.end)};}
    if(u.type==='sub'&&typeof invoiceDue==='function'){var d=invoiceDue(u);return {start:d.periodStart,end:d.periodEnd,label:'30-day period',sub:rng(d.periodStart,d.periodEnd)};}
    return {start:addDays(T,-29),end:T,label:'Last 30 days',sub:rng(addDays(T,-29),T)};}
  function stats(u){var S=idSet(idsFor(u)),T=today(),ws=weekStart(T),we=addDays(ws,6),P=periodFor(u);
    var r={all:0,week:0,today:0,period:0,P:P,n:0,first:'',wait:0,waitN:0,chg:0,open:0};
    DB.time.forEach(function(t){if(!S[t.userId]||t.test)return;if(!t.out){if(t.clock)r.open++;return;}
      if(isWaiting(t)){r.wait+=paidH(t);r.waitN++;return;}if(!counts(t))return;var h=paidH(t);
      r.all+=h;r.n++;if(!r.first||t.date<r.first)r.first=t.date;if(t.date>=ws&&t.date<=we)r.week+=h;if(t.date===T)r.today+=h;if(t.date>=P.start&&t.date<=P.end)r.period+=h;
      if(typeof latestChange==='function'){var c=latestChange(t.key0||('t:'+t.id));if(c&&c.status==='Pending')r.chg++;}});
    return r;}
  function weekDays(u,off){var S=idSet(idsFor(u)),T=today(),ws=addDays(weekStart(T),7*(off||0)),out=[];
    for(var i=0;i<7;i++)out.push({d:addDays(ws,i),h:0});
    DB.time.forEach(function(t){if(!S[t.userId]||!counts(t))return;var k=daysBetween(ws,t.date);if(k>=0&&k<7)out[k].h+=paidH(t);});
    return {ws:ws,days:out,tot:out.reduce(function(a,x){return a+x.h;},0)};}
  /* ---------- graphics ---------- */
  function weekChart(u,off,mini){var W=weekDays(u,off),T=today(),mx=Math.max(10,Math.ceil(Math.max.apply(null,W.days.map(function(x){return x.h;})))),
      lab=typeof efWeekLabel==='function'?efWeekLabel(W.ws):'Week of '+rng(W.ws,addDays(W.ws,6));
    var aria='Hours by day, '+lab+': '+W.days.map(function(x){return shortDay(x.d).slice(0,3)+' '+fs(x.h);}).join(', ')+'. Total '+f2(W.tot)+' hours.';
    var cols=W.days.map(function(x,i){var pc=x.h>0?Math.max(4,Math.round(x.h/mx*100)):0,fut=x.d>T;
      return '<div class="ei-col'+(x.d===T?' ei-today':'')+(fut?' ei-fut':'')+'" data-date="'+x.d+'" data-h="'+f2(x.h)+'">'+(mini?'':'<span class="ei-v">'+(x.h>0?fs(x.h):'')+'</span>')+
        '<span class="ei-track"><i style="height:'+pc+'%;animation-delay:'+(i*40)+'ms"></i></span><span class="ei-d">'+(mini?shortDay(x.d).charAt(0):shortDay(x.d).slice(0,3))+'</span></div>';}).join('');
    if(mini)return '<div class="ei-bars ei-mini" role="img" aria-label="'+E(aria)+'">'+cols+'</div>';
    var line8=Math.round(8/mx*100);
    return '<div class="ei-week" id="eiWeek" data-off="'+(off||0)+'"><div class="ei-wkhd"><button type="button" class="ei-nav" data-act="eiwk" data-d="-1" aria-label="Previous week">‹</button>'+
      '<div class="ei-wkt"><b>'+E(lab)+'</b><span id="eiWkTot">'+f2(W.tot)+' hrs</span></div><button type="button" class="ei-nav" data-act="eiwk" data-d="1" aria-label="Next week"'+((off||0)>=0?' disabled':'')+'>›</button></div>'+
      '<div class="ei-bars" role="img" aria-label="'+E(aria)+'"><span class="ei-8" style="bottom:calc(var(--ei-th) * '+(line8/100)+' + var(--ei-base))" aria-hidden="true">8 h</span>'+cols+'</div>'+
      (W.tot?'':'<p class="ei-none small muted">No approved hours '+(off?'that week':'yet this week')+'.</p>')+'</div>';}
  /* segmented ring: segs = [{c:'ok'|'warn'|'bad'|'mut'|'temp'}], big = centre text */
  function ring(segs,big,small,aria){var r=42,C=2*Math.PI*r,n=Math.max(1,segs.length),gap=n>1?Math.min(4,C/n*0.18):0,len=C/n-gap;
    var arcs=segs.length?segs.map(function(s,i){return '<circle class="ei-seg ei-'+s.c+'" cx="50" cy="50" r="'+r+'" stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-(i*C/n)-gap/2).toFixed(2)+'"/>';}).join(''):'';
    return '<svg class="ei-ring" viewBox="0 0 100 100" role="img" aria-label="'+E(aria)+'"><circle class="ei-ringbg" cx="50" cy="50" r="'+r+'"/><g transform="rotate(-90 50 50)">'+arcs+'</g>'+
      '<text x="50" y="50" class="ei-rbig" text-anchor="middle" dominant-baseline="central">'+E(big)+'</text><text x="50" y="69" class="ei-rsm" text-anchor="middle">'+E(small)+'</text></svg>';}
  function tile(lab,v,sub,id){return '<div class="ei-tile"'+(id?' id="'+id+'"':'')+'><span class="ei-tl">'+E(lab)+'</span><b>'+f2(v)+'</b><small>'+E(sub||'hrs')+'</small></div>';}
  /* ---------- TOTAL HOURS WORKED (My shifts / sub Dashboard) ---------- */
  function hoursCard(u){var R=stats(u),sub=u.type==='sub',T=today(),ws=weekStart(T),nW=sub?crewOf(u).length:0;
    return '<section class="card ei-card ei-hours" id="eiHours" aria-label="'+(sub?'Your crew\'s total hours':'Total hours worked')+'">'+
      '<div class="ei-hd"><h2 class="ei-h">'+(sub?'Your crew\'s total hours':'Total hours worked')+'</h2><span class="ei-tag">Approved hours</span></div>'+
      '<div class="ei-big"><b id="eiAll">'+f2(R.all)+'</b><span>hrs</span></div>'+
      '<div class="ei-cap small">'+(R.n?'All time · '+R.n+' shift'+(R.n===1?'':'s')+' since '+E(md(R.first)+(R.first.slice(0,4)!==T.slice(0,4)?' '+R.first.slice(0,4):''))+(sub?' · '+nW+' worker'+(nW===1?'':'s'):''):(sub?'No approved hours from your workers yet.':'No approved hours yet. When you clock out, your hours add up here.'))+'</div>'+
      '<div class="ei-tiles">'+tile('This week',R.week,rng(ws,addDays(ws,6)),'eiWkT')+tile(R.P.label,R.period,R.P.sub,'eiPpT')+tile('All time',R.all,R.n?'since '+md(R.first):'hrs','eiAllT')+'</div>'+
      weekChart(u,0,false)+
      '<div class="ei-note small muted">Paid hours (worked minus the unpaid break) from '+(sub?'your workers\' clocked and office-approved shifts. Day-by-day list: <a href="#/workerhours">Workers\' hours</a>.':'your clocked and office-approved shifts – the same hours as your shifts below.')+
      (R.wait?' <span class="ei-wait" id="eiWait"><b>'+f2(R.wait)+' hrs</b> waiting for office approval (not counted yet).</span>':'')+
      (R.chg?' <span id="eiChg">'+R.chg+' shift'+(R.chg===1?'':'s')+' with a time change pending.</span>':'')+
      (R.open?' <span id="eiOpen">'+(sub?R.open+' worker'+(R.open===1?'':'s')+' on shift now – counted after clock-out.':'Your open shift is counted after you clock out.')+'</span>':'')+'</div></section>';}
  ACT.eiwk=function(el){var box=document.getElementById('eiWeek');if(!box||!ME)return;var off=Math.min(0,(+box.dataset.off||0)+(+el.dataset.d||0));
    var tmp=document.createElement('div');tmp.innerHTML=weekChart(ME,off,false);box.parentNode.replaceChild(tmp.firstChild,box);};
  /* ---------- Clock screen: compact strip ---------- */
  function clockStrip(u){var R=stats(u),op=typeof openEntry==='function'?openEntry(u):null;
    return '<a class="card ei-card ei-strip" id="eiStrip" href="#/shifts" aria-label="Hours worked – open My shifts">'+
      '<div class="ei-sl"><span class="ei-st">Hours worked <span class="ei-tag">Approved</span></span>'+
      '<div class="ei-sn"><span><b id="eiToday">'+f2(R.today)+'</b><small>Today</small></span><span><b id="eiSWk">'+f2(R.week)+'</b><small>This week</small></span><span><b id="eiSPp">'+f2(R.period)+'</b><small>'+E(R.P.label)+'</small></span></div>'+
      (op?'<div class="ei-on small">● On shift since <b>'+E(op['in'])+'</b> – added when you clock out</div>':'')+'</div>'+weekChart(u,0,true)+'<span class="ei-go" aria-hidden="true">›</span></a>';}
  /* ---------- Training & quizzes: progress ring ---------- */
  function trainCard(u){if(typeof trainItemsFor!=='function')return '';var ks=trainItemsFor(u);if(!ks.length)return '';
    var L=ks.map(function(k){var s=trainState(u,k),soon=s.ok&&s.c==='s-warn';return {k:k,s:s,c:s.ok?(soon?'warn':'ok'):(s.pass?'temp':(s.c==='s-mut'?'mut':'bad'))};}),
      ok=L.filter(function(x){return x.s.ok;}).length,soon=L.filter(function(x){return x.c==='warn';}),todo=L.filter(function(x){return !x.s.ok;});
    var hi=todo.concat(soon);
    return '<section class="card ei-card ei-train" id="eiTrain"><div class="ei-rw">'+ring(L,ok+'/'+ks.length,'passed',ok+' of '+ks.length+' training items passed'+(soon.length?', '+soon.length+' expiring within 30 days':'')+(todo.length?', '+todo.length+' to do':''))+
      '<div class="ei-rt"><h2 class="ei-h">'+(ok===ks.length?'All '+ks.length+' passed ✓':ok+' of '+ks.length+' passed')+'</h2>'+
      '<ul class="ei-leg">'+(ok-soon.length||!hi.length?'<li><i class="ei-k ei-ok"></i>Passed <b>'+(ok-soon.length)+'</b></li>':'')+(soon.length?'<li><i class="ei-k ei-warn"></i>Renew soon <b>'+soon.length+'</b></li>':'')+
        [['bad','To redo / missing'],['mut','Not started'],['temp','On 14-day pass']].map(function(g){var n=L.filter(function(x){return x.c===g[0];}).length;return n?'<li><i class="ei-k ei-'+g[0]+'"></i>'+g[1]+' <b>'+n+'</b></li>':'';}).join('')+'</ul></div></div>'+
      (hi.length?'<ul class="ei-due" id="eiDue">'+hi.map(function(x){return '<li class="ei-'+x.c+'"><button type="button" class="linklike" data-act="eijump" data-k="'+E(x.k)+'">'+E(TRAIN_ITEMS[x.k].label)+'</button> <span class="pill '+E(x.s.c)+'">'+E(x.s.s)+'</span></li>';}).join('')+'</ul>':'<p class="ei-okp small">Next renewal: '+E(nextRenew(L)||'–')+'</p>')+'</section>';}
  function nextRenew(L){var d=L.map(function(x){return x.s.expiry;}).filter(Boolean).sort()[0];return d?md(d)+' '+d.slice(0,4):'';}
  ACT.eijump=function(el){var c=document.getElementById('tr-'+el.dataset.k);if(c){c.scrollIntoView({block:'start',behavior:'smooth'});c.classList.add('ei-flash');setTimeout(function(){c.classList.remove('ei-flash');},1600);}};
  /* ---------- Registration checklist: step bar ---------- */
  function checkCard(u){if(typeof requirements!=='function')return '';var R=requirements(u).filter(function(r){return r.st.s!=='Optional';});if(!R.length)return '';
    /* same split as the message under it: "N items for you to finish" + "N waiting for your employer" (person.js checklistHtml) */
    var waitRe=/^Your employer must/,cls=function(r){if(r.ok)return r.st.c==='s-warn'||/Expiring/.test(r.st.s)?'warn':'ok';return (typeof empWait==='function'?empWait(r):waitRe.test(r.msg||''))?'wait':'bad';};
    var C=R.map(function(r){return {r:r,c:cls(r)};}),done=C.filter(function(x){return x.r.ok;}).length,wait=C.filter(function(x){return x.c==='wait';}).length,mine=R.length-done-wait,pc=Math.round(done/R.length*100);
    return '<section class="card ei-card ei-check" id="eiCheck"><div class="ei-hd"><h2 class="ei-h">'+(u.type==='sub'?'Progress':'Registration progress')+'</h2><b class="ei-pc">'+pc+'%</b></div>'+
      '<div class="ei-steps" role="img" aria-label="'+done+' of '+R.length+' done'+(mine?', '+mine+' for you to do':'')+(wait?', '+wait+' waiting for others':'')+'">'+C.map(function(x,i){return '<i class="ei-'+x.c+'" style="animation-delay:'+(i*30)+'ms" title="'+E(x.r.label)+'"></i>';}).join('')+'</div>'+
      '<ul class="ei-leg"><li><i class="ei-k ei-ok"></i>Done <b>'+done+'</b> of '+R.length+'</li>'+(mine?'<li><i class="ei-k ei-bad"></i>'+(u.type==='sub'?'To finish':'For you to finish')+' <b>'+mine+'</b></li>':'')+(wait?'<li><i class="ei-k ei-wait"></i>Waiting for your employer <b>'+wait+'</b></li>':'')+'</ul></section>';}
  /* ---------- Subcontractor: crew training ring ---------- */
  function crewTrainCard(s){var ws=crewOf(s).filter(function(w){return w.active!==false;});if(!ws.length||typeof trainItemsFor!=='function')return '';
    var L=ws.map(function(w){var ks=trainItemsFor(w),st=ks.map(function(k){return trainState(w,k);}),full=st.every(function(x){return x.ok;}),soon=full&&st.some(function(x){return x.c==='s-warn';}),left=st.filter(function(x){return !x.ok;}).length;
      return {w:w,c:full?(soon?'warn':'ok'):'bad',left:left,full:full};}),ok=L.filter(function(x){return x.full;}).length,soon=L.filter(function(x){return x.c==='warn';}).length,not=L.filter(function(x){return !x.full;});
    return '<section class="card ei-card ei-crew" id="eiCrew"><div class="ei-rw">'+ring(L,ok+'/'+ws.length,'trained',ok+' of '+ws.length+' workers fully trained')+
      '<div class="ei-rt"><h2 class="ei-h">Crew training</h2><p class="small ei-rp">'+(ok===ws.length?'All '+ws.length+' workers fully trained ✓':ok+' of '+ws.length+' workers fully trained')+'</p>'+
      '<ul class="ei-leg"><li><i class="ei-k ei-ok"></i>Trained <b>'+(ok-soon)+'</b></li>'+(soon?'<li><i class="ei-k ei-warn"></i>Renew soon <b>'+soon+'</b></li>':'')+(not.length?'<li><i class="ei-k ei-bad"></i>Not yet <b>'+not.length+'</b></li>':'')+'</ul></div></div>'+
      (not.length?'<ul class="ei-due" id="eiCrewDue">'+not.slice(0,6).map(function(x){return '<li class="ei-bad"><b>'+E(x.w.name)+'</b> <span class="small muted">'+x.left+' item'+(x.left===1?'':'s')+' to finish</span></li>';}).join('')+(not.length>6?'<li class="small muted">and '+(not.length-6)+' more</li>':'')+'</ul>':'')+
      '<a class="small" href="#/workers">Open My workers →</a></section>';}
  window.eiStats=stats;window.eiWeekDays=weekDays;  /* for checks */
  /* ---------- hook into the existing screens (employee side only) ---------- */
  if(typeof myShiftsView==='function'){var mv=myShiftsView;myShiftsView=function(){var x=mv();try{if(isEmp()){var c=hoursCard(ME);
      x=x.replace(/<span class="ef-week small">This week: <b>[^<]*<\/b><\/span>/,'');                    /* the big card replaces the header figure */
      var i=x.indexOf('<div class="ef-bar"');if(i<0){var j=x.indexOf('</h1>');i=j<0?0:j+5;}x=x.slice(0,i)+c+x.slice(i);}}catch(e){}return x;};}
  if(typeof clockView==='function'){var cv=clockView;clockView=function(){var x=cv();try{if(isEmp()){var s=clockStrip(ME),i=x.indexOf('<div class="card clock-card');
      if(i<0){var j=x.indexOf('</h1>');i=j<0?0:j+5;}x=x.slice(0,i)+s+x.slice(i);}}catch(e){}return x;};}
  ['worker','employee'].forEach(function(t){['training','safety'].forEach(function(p){var ov=VIEWS[t+':'+p];if(typeof ov!=='function')return;
    VIEWS[t+':'+p]=function(){var x=ov.apply(this,arguments);try{if(ME&&ME.type===t){var c=trainCard(ME),i=x.indexOf('</h1>');if(c)x=i<0?c+x:x.slice(0,i+5)+c+x.slice(i+5);}}catch(e){}return x;};});});
  if(typeof checklistHtml==='function'){var ch=checklistHtml;checklistHtml=function(u){var x=ch.apply(this,arguments);try{if(ME&&u&&u.id===ME.id&&(isEmp()||isSub()))x=checkCard(u)+x;}catch(e){}return x;};}
  (function(){var sh=VIEWS['sub:home'];if(typeof sh!=='function')return;VIEWS['sub:home']=function(){var x=sh.apply(this,arguments);try{if(isSub()){var c='<div class="ei-subgrid">'+hoursCard(ME)+crewTrainCard(ME)+'</div>',m='<h2>Company checklist</h2>',i=x.indexOf(m);
      x=i<0?x+c:x.slice(0,i)+c+x.slice(i);}}catch(e){}return x;};})();
})();
