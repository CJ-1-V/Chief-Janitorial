/* officeinfo1 – infographics on the office screens (owner Oct 7, 2026 8:01 PM: "Add infographics to office part too").
   New file only; loaded just before v2-nohome.js (which stays last). Pairs with css/officeinfo.css.
   Office (admin) only: every chart checks ME.type==='admin' and the views it adds to are office views. Employees, subcontractors,
   subcontractor workers, crew leads and farm / client logins never see any of it.
   Every number is worked out on screen from the app's own data (time entries, invoices, crew orders, crew numbers, documents,
   accounts). Nothing is typed in, stored or sent. Pure HTML/CSS bars and inline SVG donuts – no outside libraries.
   Screens: Overview (tiles + 6 charts), Review & approve, Late entries, Payroll hours, Invoices, Crew orders, Crew coming, Compliance.
   Turn off: remove the 2 lines in index.html. */
'use strict';
(function(){
if(typeof VIEWS==='undefined'||typeof DB==='undefined')return;
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function office(){return typeof ME!=='undefined'&&!!ME&&ME.type==='admin'&&!ME.__swReal;}
function warnLog(w,e){try{console.warn('[officeinfo] '+w,e);}catch(z){}}
var C={navy:'#332E57',gold:'#D9A03C',violet:'#6f67b3',sand:'#e8c27a',ok:'#1f8a4c',warn:'#b7791f',bad:'#c0392b',lav:'#a49fd0',blue:'#2c4fa3',grey:'#9b9aa6'};
var JOBC=['#332E57','#D9A03C','#6f67b3','#2c4fa3','#e8c27a','#a49fd0','#b7791f','#5e5a7a','#c98f2e','#9b9aa6'];

/* ---------------- numbers ---------------- */
function n2(x){return Math.round(x*100)/100;}
function fmtH(x){x=Math.round(x*10)/10;return x%1===0?String(x):x.toFixed(1);}
function fmtH2(x){x=n2(x);return x.toFixed(2);}
function fmtN(x){return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function moneyR(x){return '$'+fmtN(x);}
function T(){return today();}
function weekStart(d){var x=parseD(d);return addDays(d,-((x.getDay()+6)%7));}
function counts(t){return !!(t&&!t.test&&t['in']&&t.out&&t.lateEntry!=='pending'&&t.lateEntry!=='rejected');}
function paidH(t){var w=hrs(t['in'],t.out);return Math.max(0,w-(typeof unpaidBreak==='function'?unpaidBreak(w,t):0));}
/* counted entries for this screen: [{t,g,h}] – worked out once per screen draw (user types looked up once), never stored */
var RT=null;
function realTime(){if(RT)return RT;var ty={};(DB.users||[]).forEach(function(u){ty[u.id]=u.type==='employee'?'emp':(u.type==='worker'||u.type==='sub')?'sub':null;});
  RT=[];(DB.time||[]).forEach(function(t){var g=ty[t.userId];if(g&&counts(t))RT.push({t:t,g:g,h:paidH(t)});});setTimeout(function(){RT=null;},0);return RT;}
function hoursBetween(from,to){var o={emp:0,sub:0,people:{},n:0};realTime().forEach(function(e){var t=e.t;if(t.date<from||t.date>to)return;o[e.g]+=e.h;o.people[t.userId]=1;o.n++;});o.total=o.emp+o.sub;o.nPeople=Object.keys(o.people).length;return o;}
function hoursByDay(days){var m={};days.forEach(function(d){m[d]={emp:0,sub:0};});realTime().forEach(function(e){if(!m[e.t.date])return;m[e.t.date][e.g]+=e.h;});return m;}
function clockedInNow(){var y=addDays(T(),-1);return (DB.time||[]).filter(function(t){if(t.test||!t['in']||t.out||t.date<y||t.date>T())return false;var u=user(t.userId);return u&&u.type!=='tester';}).length;}
function dayList(from,n){var o=[];for(var i=0;i<n;i++)o.push(addDays(from,i));return o;}
function wd(d){return shortDay(d).split(' ')[0];}
function dm(d){return shortDay(d).replace(/^\w+ /,'');}

/* approvals waiting – the same lists the office screens use */
function approvals(){var L=[];
  var na=(DB.users||[]).filter(function(u){return u.accountApproved===false&&u.active!==false;}).length;
  var reg=typeof pendingAccounts==='function'?pendingAccounts().length:0;
  var up=(DB.docs||[]).filter(function(d){return d.status==='pending';}).length;
  var late=(DB.time||[]).filter(function(t){return t.lateEntry==='pending'&&!t.test;}),ls=late.filter(function(t){return t.subAdded;}).length,lm=late.filter(function(t){return !t.subAdded&&t.manual;}).length,le=late.length-ls-lm;
  var ch=(DB.changes||[]).filter(function(c){return c.status==='Pending';}).length;
  var co=typeof coFilterList==='function'?coFilterList({tab:'pending'}).length:(DB.crewOrders||[]).filter(function(o){return o.pending;}).length;
  var inv=(DB.invoices||[]).filter(function(i){return !i.test&&i.status==='Submitted';}).length;
  var md=typeof missingDocsOpenCount==='function'?missingDocsOpenCount():0;
  L.push({k:'acct',label:'New accounts to approve',segs:[{v:na,c:C.navy}],href:'#/review'});
  L.push({k:'reg',label:'Registrations to approve',segs:[{v:reg,c:C.violet}],href:'#/review'});
  L.push({k:'docs',label:'Uploads to review',segs:[{v:up,c:C.lav}],href:'#/review'});
  L.push({k:'late',label:'Late entries',segs:[{v:ls,c:C.gold,l:'Added by subcontractor'},{v:lm,c:C.sand,l:'Crew lead / manual'},{v:le,c:C.warn,l:'Employee'}],href:'#/lateentries'});
  L.push({k:'chg',label:'Time changes from farms / clients',segs:[{v:ch,c:C.blue}],href:'#/farmchanges'});
  L.push({k:'co',label:'Crew orders waiting',segs:[{v:co,c:C.ok}],href:'#/creworders'});
  L.push({k:'inv',label:'Subcontractor invoices to approve',segs:[{v:inv,c:C.violet}],href:'#/invoicesadmin'});
  L.push({k:'md',label:'Missing documents to follow up',segs:[{v:md,c:C.bad}],href:'#/missingdocs'});
  L.forEach(function(r){r.total=r.segs.reduce(function(a,s){return a+s.v;},0);});return L;}

/* client invoices: paid / open (not yet due) / overdue, totals incl. HST, interest not included */
function clientInv(){var firms={};(typeof companyFirms==='function'?companyFirms():users('firm')).forEach(function(f){firms[f.id]=1;});
  var o={paid:{n:0,v:0},open:{n:0,v:0},over:{n:0,v:0},age:[0,0,0,0],ageN:[0,0,0,0]};
  (DB.clientInvoices||[]).forEach(function(i){if(i.test||!firms[i.firmId])return;var v=+i.total||0;
    if(i.paidAt){o.paid.n++;o.paid.v+=v;return;}var od=i.due?daysBetween(i.due,T()):0;
    if(od>0){o.over.n++;o.over.v+=v;var b=od<=30?0:od<=60?1:od<=90?2:3;o.age[b]+=v;o.ageN[b]++;}else{o.open.n++;o.open.v+=v;}});
  o.n=o.paid.n+o.open.n+o.over.n;o.owing=o.open.v+o.over.v;return o;}
/* subcontractor invoices by status (TEST invoices never counted) */
function subInv(){var S=['Submitted','Approved','Paid','Disputed'],o={};S.forEach(function(s){o[s]={n:0,v:0};});var over={n:0,v:0};
  (DB.invoices||[]).forEach(function(i){if(i.test)return;var s=o[i.status]?i.status:null;if(!s)return;o[s].n++;o[s].v+=+i.total||0;if(i.status!=='Paid'&&i.due&&i.due<T()){over.n++;over.v+=+i.total||0;}});
  return {by:o,over:over};}

/* crew coming per farm/day: the office-set number (Confirmed / Pending) or, when not set, the suggestion from crew orders and shifts */
function firmsList(){if(typeof fhFirms==='function')return fhFirms();return (typeof companyFirms==='function'?companyFirms():users('firm')).filter(function(f){return f.active!==false&&!f.loginOf&&!f.mergedInto;});}
function jobKey(j){return j.role==='custom'?'custom:'+(j.label||'Other'):j.role;}
function jobLabel(k,firm){if(k==='_none')return 'Job not given';if(k.indexOf('custom:')===0)return k.slice(7);
  if(typeof FH_SHORT!=='undefined'&&FH_SHORT[k])return FH_SHORT[k][1];if(typeof fhJobName==='function')return fhJobName(firm||null,k,2,'');return k;}
function crewCell(f,d){var v=typeof fhDay==='function'?fhDay(f.id,d):null;
  if(v)return {n:+v.n||0,jobs:(v.jobs||[]),st:v.ok?'ok':'pend'};
  var s=typeof fhSuggest==='function'?fhSuggest(f,d):{n:0,jobs:[]};return {n:+s.n||0,jobs:s.jobs||[],st:'sug'};}
function crewData(days){var firms=firmsList(),byDay={},byFirm=[],jobs={},jobFirm={};days.forEach(function(d){byDay[d]={};});
  firms.forEach(function(f){var r={f:f,ok:0,pend:0,sug:0};days.forEach(function(d){var c=crewCell(f,d);if(!c.n)return;r[c.st]+=c.n;
    var J=c.jobs&&c.jobs.length&&(typeof fhJobsSum!=='function'||fhJobsSum(c.jobs)===c.n)?c.jobs:[{role:'_none',qty:c.n}];
    J.forEach(function(j){var k=j.role==='_none'?'_none':jobKey(j);byDay[d][k]=(byDay[d][k]||0)+(+j.qty||0);jobs[k]=(jobs[k]||0)+(+j.qty||0);if(!jobFirm[k])jobFirm[k]=f;});});
    r.total=r.ok+r.pend+r.sug;if(r.total)byFirm.push(r);});
  var keys=Object.keys(jobs).sort(function(a,b){return a==='_none'?1:b==='_none'?-1:jobs[b]-jobs[a];});
  var series=keys.map(function(k,i){return {key:k,label:jobLabel(k,jobFirm[k]),color:k==='_none'?C.grey:JOBC[i%JOBC.length]};});
  byFirm.sort(function(a,b){return b.total-a.total;});return {byDay:byDay,series:series,byFirm:byFirm};}
function series_sum(o){var n=0;for(var k in o)if(Object.prototype.hasOwnProperty.call(o,k))n+=+o[k]||0;return n;}
function firmLabel(f){var c=typeof fhCode==='function'?fhCode(f):(typeof clCode==='function'?clCode(f):'');return {code:c&&c!=='–'?c:'',name:f.name||''};}

/* people working per farm / client, last 7 days (approved hours only) */
function peopleByFarm(from,to){var m={};realTime().forEach(function(e){var t=e.t;if(t.date<from||t.date>to)return;var f=t.site&&typeof firmOfSite==='function'?firmOfSite(t.site):null,k=f?f.id:'_nosite';
  var r=m[k]=m[k]||{f:f,p:{},h:0};r.p[t.userId]=1;r.h+=e.h;});
  return Object.keys(m).map(function(k){var r=m[k];r.n=Object.keys(r.p).length;return r;}).sort(function(a,b){return (a.f?0:1)-(b.f?0:1)||b.n-a.n||b.h-a.h;});}

/* compliance: active employees, subcontractors and their workers – clear to work vs blocked; expiring papers */
function compliance(){var bl=typeof blockedList==='function'?blockedList():[],bset={};bl.forEach(function(x){bset[x.u.id]=1;});
  var pop=(DB.users||[]).filter(function(u){return (u.type==='employee'||u.type==='worker'||u.type==='sub')&&u.active!==false&&!u.suspended;});
  var o={clear:0,blocked:0,emp:[0,0],sub:[0,0],wk:[0,0]};pop.forEach(function(u){var b=bset[u.id]?1:0;b?o.blocked++:o.clear++;var g=u.type==='employee'?o.emp:u.type==='sub'?o.sub:o.wk;g[b]++;});
  var ex=typeof expiringList==='function'?expiringList():[];o.expired=ex.filter(function(e){return e.left<=0;}).length;o.d30=ex.filter(function(e){return e.left>0&&e.left<=30;}).length;o.d90=ex.filter(function(e){return e.left>30&&e.left<=90;}).length;
  o.total=pop.length;return o;}

/* ---------------- drawing ---------------- */
function aria(s){return E(String(s).replace(/<[^>]+>/g,''));}
function empty(msg){return '<div class="oi-empty">'+E(msg)+'</div>';}
function legend(series,vals){return '<ul class="oi-legend">'+series.map(function(s){return '<li><i style="background:'+s.color+'"></i>'+E(s.label)+(vals?' <b>'+E(vals[s.key])+'</b>':'')+'</li>';}).join('')+'</ul>';}
/* vertical (stacked) bars. cols:[{label,sub,vals:{key:n},cls}] */
function vbars(o){var cols=o.cols,series=o.series,max=0,tot=0,fmt=o.fmt||fmtH;
  cols.forEach(function(c){c.sum=series.reduce(function(a,s){return a+(+c.vals[s.key]||0);},0);if(c.sum>max)max=c.sum;tot+=c.sum;});
  if(!tot)return empty(o.empty||'Nothing to show yet.');
  var desc=(o.aria||'')+': '+cols.map(function(c){return c.label+' '+(c.sub||'')+' '+fmt(c.sum);}).join(', ');
  return '<div class="oi-vb'+(cols.length>9?' oi-many':'')+'" role="img" aria-label="'+aria(desc)+'"><div class="oi-plot" style="--oi-n:'+cols.length+'">'+cols.map(function(c){var h=max?c.sum/max*100:0;
    return '<div class="oi-col'+(c.cls?' '+c.cls:'')+'" title="'+aria(c.title||(c.label+' '+(c.sub||'')+': '+fmt(c.sum)+(o.unit?' '+o.unit:'')))+'"><div class="oi-colv">'+(c.sum?E(fmt(c.sum)):'')+'</div>'+(c.sum?'<div class="oi-stack" style="height:'+h.toFixed(1)+'%">'+
      series.map(function(s){var v=+c.vals[s.key]||0;return v?'<span style="flex:'+v+' 1 0;background:'+s.color+'"></span>':'';}).join('')+'</div>':'')+'</div>';}).join('')+'</div>'+
    '<div class="oi-xax" style="--oi-n:'+cols.length+'">'+cols.map(function(c){return '<div class="oi-xl'+(c.cls?' '+c.cls:'')+'">'+E(c.label)+(c.sub?'<span>'+E(c.sub)+'</span>':'')+'</div>';}).join('')+'</div>'+
    (series.length>1||o.legend?legend(series):'')+'</div>';}
/* horizontal (stacked) bars. rows:[{label,sub,segs:[{v,c,l}],total,href,txt}] */
function hbars(rows,o){o=o||{};var max=0;rows.forEach(function(r){if(r.total>max)max=r.total;});
  if(!max&&!o.showZero)return empty(o.empty||'Nothing to show yet.');
  return '<ul class="oi-hb" role="img" aria-label="'+aria((o.aria||'')+': '+rows.map(function(r){return r.label+' '+(r.txt||r.total);}).join(', '))+'">'+rows.map(function(r){var w=max?r.total/max*100:0;
    var inner='<span class="oi-hl">'+E(r.label)+(r.sub?' <small>'+E(r.sub)+'</small>':'')+'</span><span class="oi-ht"><span class="oi-hbar" style="width:'+w.toFixed(1)+'%">'+r.segs.map(function(s){return s.v?'<span style="flex:'+s.v+' 1 0;background:'+s.c+'"'+(s.l?' title="'+aria(s.l+': '+s.v)+'"':'')+'></span>':'';}).join('')+'</span></span><b class="oi-hv'+(r.total?'':' oi-zero')+'">'+E(r.txt!=null?r.txt:String(r.total))+'</b>';
    return '<li'+(r.total?'':' class="oi-z"')+'>'+(r.href?'<a href="'+E(r.href)+'">'+inner+'</a>':'<div>'+inner+'</div>')+'</li>';}).join('')+'</ul>'+(o.legend?legend(o.legend):'');}
/* donut: segs [{v,c,l,sub}] */
function donut(segs,center,cap,o){o=o||{};var tot=segs.reduce(function(a,s){return a+s.v;},0);
  var ring='<circle cx="21" cy="21" r="15.9155" fill="none" stroke="#ece9f6" stroke-width="6"></circle>',acc=0;
  if(tot)segs.forEach(function(s){if(!s.v)return;var p=s.v/tot*100;ring+='<circle class="oi-seg" cx="21" cy="21" r="15.9155" fill="none" stroke="'+s.c+'" stroke-width="6" stroke-dasharray="'+p.toFixed(3)+' '+(100-p).toFixed(3)+'" stroke-dashoffset="'+(25-acc).toFixed(3)+'"></circle>';acc+=p;});
  return '<div class="oi-dn" role="img" aria-label="'+aria((o.aria||'')+': '+segs.map(function(s){return s.l+' '+(s.txt||s.v);}).join(', '))+'"><div class="oi-ring"><svg viewBox="0 0 42 42" aria-hidden="true" focusable="false">'+ring+'</svg><div class="oi-ctr"><b>'+E(center)+'</b><span>'+E(cap)+'</span></div></div>'+
    '<ul class="oi-legend oi-dl">'+segs.map(function(s){return '<li><i style="background:'+s.c+'"></i><span>'+E(s.l)+'</span> <b>'+E(s.txt!=null?s.txt:s.v)+'</b>'+(s.sub?'<small>'+E(s.sub)+'</small>':'')+'</li>';}).join('')+'</ul></div>';}
var IC={clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',people:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  truck:'<path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',doc:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'};
function icon(k){return '<svg class="oi-ic" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(IC[k]||'')+'</svg>';}
function tile(t){var inner=icon(t.ic)+'<div class="oi-tt"><b class="oi-tn">'+E(t.n)+'</b><span class="oi-tl">'+E(t.l)+'</span>'+(t.s?'<small>'+E(t.s)+'</small>':'')+'</div>';
  return t.href?'<a class="oi-tile'+(t.cls?' '+t.cls:'')+'" href="'+E(t.href)+'"'+(t.id?' id="'+t.id+'"':'')+'>'+inner+'</a>':'<div class="oi-tile'+(t.cls?' '+t.cls:'')+'"'+(t.id?' id="'+t.id+'"':'')+'>'+inner+'</div>';}
function card(id,title,body,o){o=o||{};return '<section class="oi-card'+(o.wide?' oi-wide':'')+'" id="'+id+'"><div class="oi-ch"><h2>'+E(title)+'</h2>'+(o.link?'<a class="oi-more" href="'+E(o.link[0])+'">'+E(o.link[1])+' →</a>':'')+'</div>'+(o.note?'<p class="oi-note">'+o.note+'</p>':'')+body+'</section>';}
function insertAt(x,marker,html,after){var i=x.indexOf(marker);if(i<0)return null;var at=after?i+marker.length:i;return x.slice(0,at)+html+x.slice(at);}

/* ---------------- chart blocks ---------------- */
function hoursChart(days,o){o=o||{};var m=hoursByDay(days),t=T();
  return vbars({aria:o.aria||'Paid hours per day',unit:'h',empty:o.empty||'No hours recorded in these days yet.',series:[{key:'emp',label:'UnScramble employees',color:C.navy},{key:'sub',label:'Subcontractor workers',color:C.gold}],legend:true,
    cols:days.map(function(d){return {label:wd(d),sub:dm(d),vals:m[d],cls:d===t?'oi-today':''};})});}
function approvalsChart(o){var L=approvals(),tot=L.reduce(function(a,r){return a+r.total;},0);
  return {tot:tot,html:tot?hbars(L,{aria:'Waiting for your approval',showZero:true,legend:L[3].total?[{label:'Late entries: added by subcontractor',color:C.gold},{label:'crew lead / manual',color:C.sand},{label:'employee',color:C.warn}]:null}):'<div class="oi-empty oi-good">Nothing is waiting for your approval.</div>'};}
function clientInvChart(){var c=clientInv();if(!c.n)return empty('No client invoices yet.');
  return donut([{v:c.paid.v,c:C.ok,l:'Paid',txt:moneyR(c.paid.v),sub:c.paid.n+' invoice'+(c.paid.n===1?'':'s')},{v:c.open.v,c:C.blue,l:'Open, not yet due',txt:moneyR(c.open.v),sub:c.open.n+' invoice'+(c.open.n===1?'':'s')},{v:c.over.v,c:C.bad,l:'Overdue',txt:moneyR(c.over.v),sub:c.over.n+' invoice'+(c.over.n===1?'':'s')}],moneyR(c.owing),'still owing',{aria:'Client invoices'});}
function agingChart(){var c=clientInv(),labs=['1–30 days late','31–60 days late','61–90 days late','Over 90 days late'],cols=[C.sand,C.warn,C.bad,'#7a1f16'];
  if(!c.over.n)return '<div class="oi-empty oi-good">No client invoice is overdue.</div>';
  return hbars(labs.map(function(l,i){return {label:l,sub:c.ageN[i]?c.ageN[i]+' invoice'+(c.ageN[i]===1?'':'s'):'',segs:[{v:c.age[i],c:cols[i]}],total:c.age[i],txt:moneyR(c.age[i])};}),{aria:'Overdue client invoices by how late',showZero:true});}
function crewChart(days,o){o=o||{};var D=crewData(days),t=T();
  var body=vbars({aria:'People coming per day by job',unit:'people',fmt:fmtN,empty:o.empty||'No crew numbers, crew orders or shifts for these days.',series:D.series,legend:true,
    cols:days.map(function(d){return {label:wd(d),sub:dm(d),vals:D.byDay[d],cls:d===addDays(t,1)?'oi-next':(d===t?'oi-today':''),title:(d===addDays(t,1)?'Tomorrow ':'')+shortDay(d)+': '+fmtN(series_sum(D.byDay[d]))+' people'};})});
  return {D:D,html:body};}
function crewFirmChart(D){if(!D.byFirm.length)return '';var rows=D.byFirm.slice(0,8).map(function(r){var L=firmLabel(r.f);return {label:L.code||L.name,sub:L.code?L.name:'',segs:[{v:r.ok,c:C.ok,l:'Confirmed by office'},{v:r.pend,c:C.gold,l:'Pending'},{v:r.sug,c:C.lav,l:'Suggested from orders / shifts (not set)'}],total:r.total,txt:fmtN(r.total)};});
  return '<h3 class="oi-h3">Per farm / client (people-days)</h3>'+hbars(rows,{aria:'People coming per farm or client',legend:[{label:'Confirmed by office',color:C.ok},{label:'Pending',color:C.gold},{label:'Suggested (not set yet)',color:C.lav}]})+(D.byFirm.length>8?'<p class="oi-note">'+(D.byFirm.length-8)+' more on the Crew coming screen.</p>':'');}
function farmPeopleChart(){var to=T(),from=addDays(to,-6),L=peopleByFarm(from,to);if(!L.length)return empty('Nobody has approved hours in the last 7 days.');
  var rows=L.slice(0,8).map(function(r){var F=r.f?firmLabel(r.f):{code:'',name:'No farm / client site recorded'};return {label:F.code||F.name,sub:F.code?F.name:'',segs:[{v:r.n,c:r.f?C.navy:C.grey}],total:r.n,txt:r.n+(r.n===1?' person':' people')+' · '+fmtH(r.h)+' h'};});
  return hbars(rows,{aria:'People who worked per farm or client in the last 7 days'})+(L.length>8?'<p class="oi-note">and '+(L.length-8)+' more.</p>':'');}
function complianceChart(noChips){var c=compliance();if(!c.total)return empty('No active employees, subcontractors or workers yet.');
  return donut([{v:c.clear,c:C.ok,l:'Clear to work',sub:'employees '+c.emp[0]+' · subcontractors '+c.sub[0]+' · workers '+c.wk[0]},{v:c.blocked,c:C.bad,l:'Blocked right now',sub:'employees '+c.emp[1]+' · subcontractors '+c.sub[1]+' · workers '+c.wk[1]}],String(c.total),'active people',{aria:'Compliance'})+(noChips?'':
    '<ul class="oi-chips"><li class="'+(c.expired?'oi-c-bad':'')+'"><b>'+c.expired+'</b> expired</li><li class="'+(c.d30?'oi-c-warn':'')+'"><b>'+c.d30+'</b> expiring in 30 days</li><li><b>'+c.d90+'</b> in 31–90 days</li></ul>');}

/* ---------------- Overview ---------------- */
function homeTiles(){var t=T(),ws=weekStart(t),ms=t.slice(0,8)+'01',w=hoursBetween(ws,t),mo=hoursBetween(ms,t),p7=hoursBetween(addDays(t,-6),t),tm=addDays(t,1),ci=clockedInNow(),ap=approvals(),apn=ap.reduce(function(a,r){return a+r.total;},0),inv=clientInv(),cp=compliance();
  var crew=0,cset=0;firmsList().forEach(function(f){var c=crewCell(f,tm);crew+=c.n;if(c.st!=='sug')cset+=c.n;});
  return '<div class="oi-tiles" id="oiTiles">'+[
    {ic:'clock',n:String(ci),l:'Clocked in right now',s:ci?'still on shift':'nobody on the clock',id:'oiTNow'},
    {ic:'cal',n:fmtH(w.total)+' h',l:'Hours this week',s:'since '+shortDay(ws),href:'#/payroll',id:'oiTWeek'},
    {ic:'cal',n:fmtH(mo.total)+' h',l:'Hours this month',s:'since '+shortDay(ms),id:'oiTMonth'},
    {ic:'people',n:String(p7.nPeople),l:'People who worked',s:'last 7 days',href:'#/people',id:'oiTPeople'},
    {ic:'truck',n:String(crew),l:'Crew coming tomorrow',s:crew?(cset+' set by office'+(crew-cset?' · '+(crew-cset)+' suggested':'')):'no numbers yet',href:'#/crewcoming',id:'oiTCrew'},
    {ic:'cash',n:moneyR(inv.owing),l:'Client invoices owing',s:inv.over.n?moneyR(inv.over.v)+' overdue':'none overdue',href:'#/firms',cls:inv.over.n?'oi-t-bad':'',id:'oiTOwing'},
    {ic:'inbox',n:String(apn),l:'Waiting for you',s:apn?'see the list below':'all clear',href:'#/review',cls:apn?'oi-t-gold':'',id:'oiTWait'},
    {ic:'shield',n:String(cp.blocked),l:'Blocked right now',s:'of '+cp.total+' active people',href:'#/compliance',cls:cp.blocked?'oi-t-bad':'',id:'oiTBlocked'}
  ].map(tile).join('')+'</div>';}
function homeCharts(){var t=T(),d14=dayList(addDays(t,-13),14),d7=dayList(addDays(t,1),7),cc=crewChart(d7),ap=approvalsChart(),h14=hoursBetween(d14[0],t);
  return '<div class="oi-grid" id="oiHome">'+
    card('oiHours','Hours worked – last 14 days',hoursChart(d14,{aria:'Paid hours per day, last 14 days'}),{wide:true,link:['#/payroll','Payroll hours'],note:'Paid hours (break taken off) from clock-ins and approved entries. Late entries still waiting are not counted. <b>'+fmtH(h14.total)+' h</b> in total · employees '+fmtH(h14.emp)+' h · subcontractor workers '+fmtH(h14.sub)+' h.'})+
    card('oiWait','Waiting for your approval',ap.html,{link:['#/review','Review & approve'],note:ap.tot?'<b>'+ap.tot+'</b> item'+(ap.tot===1?'':'s')+' in total. Tap a line to open it.':''})+
    card('oiInv','Client invoices',clientInvChart(),{link:['#/firms','Farms & other clients'],note:'Invoice totals incl. HST. Interest on late invoices is not included.'})+
    card('oiCrew','Crew coming – next 7 days',cc.html+crewFirmChart(cc.D),{wide:true,link:['#/crewcoming','Crew coming'],note:'The number you set for each farm (Confirmed or Pending), or – where none is set yet – the suggestion from crew orders and scheduled shifts.'})+
    card('oiFarms','People working by farm / client – last 7 days',farmPeopleChart(),{note:'How many different people had approved hours at each farm or client, and their paid hours.'})+
    card('oiComp','Compliance',complianceChart(),{link:['#/compliance','Compliance'],note:'Active employees, subcontractors and subcontractor workers. Blocked = cannot work a shift right now (missing or expired papers, not approved, etc.).'})+
  '</div>';}
if(VIEWS['admin:home']){var _home=VIEWS['admin:home'];VIEWS['admin:home']=function(){var x=_home.apply(this,arguments);if(!office())return x;
  try{var y=insertAt(x,'</h1>',homeTiles(),true);if(y)x=y;var c=homeCharts(),q=x.indexOf('<div class="row quickpick">'),e=q>=0?x.indexOf('</div>',q):-1;
    if(e>=0)x=x.slice(0,e+6)+c+x.slice(e+6);else{y=insertAt(x,'<details class="sect" id="sect-exp"',c);x=y||x+c;}}catch(e){warnLog('overview',e);}return x;};}

/* ---------------- Review & approve ---------------- */
function reviewBlock(){var ap=approvalsChart(),pa=(DB.users||[]).filter(function(u){return u.accountApproved===false&&u.active!==false;}).concat(typeof pendingAccounts==='function'?pendingAccounts():[]),seen={},by={employee:0,sub:0,worker:0,other:0};
  pa.forEach(function(u){if(seen[u.id])return;seen[u.id]=1;by[by[u.type]!=null?u.type:'other']++;});var na=Object.keys(seen).length;
  var tiles='<div class="oi-tiles oi-tiles-s">'+[{ic:'people',n:String(by.employee),l:'Employees waiting'},{ic:'people',n:String(by.sub),l:'Subcontractors waiting'},{ic:'people',n:String(by.worker),l:'Subcontractor workers waiting'},{ic:'doc',n:String((DB.docs||[]).filter(function(d){return d.status==='pending';}).length),l:'Uploads to review'}].map(tile).join('')+'</div>';
  return '<div class="oi-grid oi-one" id="oiReview">'+card('oiRevWait','Waiting for your approval',tiles+ap.html,{wide:true,note:na?'<b>'+na+'</b> new account'+(na===1?'':'s')+' or registration'+(na===1?'':'s')+' (each person counted once).':''})+'</div>';}
if(VIEWS['admin:review']){var _rev=VIEWS['admin:review'];VIEWS['admin:review']=function(){var x=_rev.apply(this,arguments);if(!office())return x;try{x=reviewBlock()+x;}catch(e){warnLog('review',e);}return x;};}

/* ---------------- Late entries ---------------- */
function lateBlock(){var L=(DB.time||[]).filter(function(t){return t.lateEntry&&!t.test;}),p=L.filter(function(t){return t.lateEntry==='pending';}),lim=addDays(T(),-30);
  var src=function(l){return {s:l.filter(function(t){return t.subAdded;}).length,m:l.filter(function(t){return !t.subAdded&&t.manual;}).length};};var ps=src(p);ps.e=p.length-ps.s-ps.m;
  var ap=L.filter(function(t){return t.lateEntry==='approved'&&String(t.lateApprovedAt||t.addedAt||'').slice(0,10)>=lim;}).length,rj=L.filter(function(t){return t.lateEntry==='rejected'&&String(t.lateRejectedAt||t.addedAt||'').slice(0,10)>=lim;}).length;
  var ph=p.reduce(function(a,t){return a+paidH(t);},0);
  var tiles='<div class="oi-tiles oi-tiles-s">'+[{ic:'inbox',n:String(p.length),l:'Waiting for approval',s:fmtH(ph)+' h not counted yet',cls:p.length?'oi-t-gold':''},{ic:'shield',n:String(ap),l:'Approved',s:'last 30 days'},{ic:'doc',n:String(rj),l:'Not approved',s:'last 30 days'}].map(tile).join('')+'</div>';
  var bars=p.length?hbars([{label:'Added by subcontractor',segs:[{v:ps.s,c:C.gold}],total:ps.s},{label:'Crew lead / manual hours',segs:[{v:ps.m,c:C.sand}],total:ps.m},{label:'Employee missed shift',segs:[{v:ps.e,c:C.warn}],total:ps.e}],{aria:'Late entries waiting, by who added them',showZero:true}):'<div class="oi-empty oi-good">No late entries are waiting.</div>';
  return '<div class="oi-grid oi-one" id="oiLate">'+card('oiLateCard','Late entries at a glance',tiles+'<h3 class="oi-h3">Waiting – who added them</h3>'+bars,{wide:true})+'</div>';}
if(VIEWS['admin:lateentries']){var _late=VIEWS['admin:lateentries'];VIEWS['admin:lateentries']=function(){var x=_late.apply(this,arguments);if(!office())return x;try{var b=lateBlock(),y=insertAt(x,'<div class="tw"><table id="latequeue">',b);x=y||x+b;}catch(e){warnLog('late',e);}return x;};}

/* ---------------- Payroll hours (same rows as the table below) ---------------- */
function payBlock(){if(typeof payPeriodOf!=='function'||typeof payrollRows!=='function')return '';var cur=payPeriodOf(PAGE_STATE.payDate||T()),R=payrollRows(cur.start,cur.end),days=dayList(cur.start,14),m={},t=T();days.forEach(function(d){m[d]={h:0};});
  var tot=0,sh=0,on=0;R.forEach(function(r){tot+=r.hours;sh+=r.n;on+=r.overnight||0;r.entries.forEach(function(e){if(m[e.date]){var w=hrs(e['in'],e.out);m[e.date].h+=w-unpaidBreak(w,e);}});});
  var chart=vbars({aria:'Employee paid hours per day in this pay period',unit:'h',empty:'No employee hours in this pay period.',series:[{key:'h',label:'Paid hours',color:C.navy}],cols:days.map(function(d){return {label:wd(d),sub:dm(d),vals:m[d],cls:d===t?'oi-today':(d>t?'oi-future':'')};})});
  var top=R.slice().sort(function(a,b){return b.hours-a.hours;}),people=top.length?'<h3 class="oi-h3">Paid hours per employee</h3>'+hbars(top.slice(0,10).map(function(r){return {label:r.u.name,segs:[{v:r.hours,c:C.gold}],total:r.hours,txt:fmtH2(r.hours)+' h · '+r.n+' shift'+(r.n===1?'':'s')};}),{aria:'Paid hours per employee'}):'';
  var tiles='<div class="oi-tiles oi-tiles-s">'+[{ic:'clock',n:fmtH2(tot)+' h',l:'Paid hours',s:'this pay period'},{ic:'people',n:String(R.length),l:'Employees with hours'},{ic:'cal',n:String(sh),l:'Shifts',s:on?on+' overnight':''}].map(tile).join('')+'</div>';
  return '<div class="oi-grid oi-one" id="oiPay">'+card('oiPayCard','This pay period at a glance',tiles+chart+people,{wide:true,note:'UnScramble employees only – the same hours as the table below.'})+'</div>';}
if(VIEWS['admin:payroll']){var _pay=VIEWS['admin:payroll'];VIEWS['admin:payroll']=function(){var x=_pay.apply(this,arguments);if(!office())return x;try{var b=payBlock(),y=insertAt(x,'<div class="tw"><table id="paytable">',b);x=y||x+b;}catch(e){warnLog('payroll',e);}return x;};}

/* ---------------- Invoices ---------------- */
function invBlock(){var s=subInv(),b=s.by,tot=0;Object.keys(b).forEach(function(k){tot+=b[k].v;});
  var subD=tot?donut([{v:b.Submitted.v,c:C.gold,l:'Submitted – to approve',txt:moneyR(b.Submitted.v),sub:b.Submitted.n+' invoice'+(b.Submitted.n===1?'':'s')},{v:b.Approved.v,c:C.blue,l:'Approved – to pay',txt:moneyR(b.Approved.v),sub:b.Approved.n+' invoice'+(b.Approved.n===1?'':'s')},{v:b.Paid.v,c:C.ok,l:'Paid',txt:moneyR(b.Paid.v),sub:b.Paid.n+' invoice'+(b.Paid.n===1?'':'s')},{v:b.Disputed.v,c:C.bad,l:'Disputed',txt:moneyR(b.Disputed.v),sub:b.Disputed.n+' invoice'+(b.Disputed.n===1?'':'s')}],moneyR(b.Submitted.v+b.Approved.v+b.Disputed.v),'not paid yet',{aria:'Subcontractor invoices'})+(s.over.n?'<p class="oi-note oi-badtxt"><b>'+s.over.n+'</b> past the due date: '+moneyR(s.over.v)+'</p>':''):empty('No subcontractor invoices yet.');
  return '<div class="oi-grid" id="oiInvGrid">'+card('oiSubInv','Subcontractor invoices',subD,{note:'All real invoices (TEST invoices never counted), totals incl. HST. The filter below does not change this chart.'})+
    card('oiCliInv','Client invoices',clientInvChart()+'<h3 class="oi-h3">Overdue – how late</h3>'+agingChart(),{link:['#/firms','Farms & other clients'],note:'Invoices sent to farms and other clients, totals incl. HST (interest not included).'})+'</div>';}
if(VIEWS['admin:invoicesadmin']){var _inv=VIEWS['admin:invoicesadmin'];VIEWS['admin:invoicesadmin']=function(){var x=_inv.apply(this,arguments);if(!office())return x;try{var b=invBlock(),y=insertAt(x,'<form data-form="ifilter"',b);x=y||x+b;}catch(e){warnLog('invoices',e);}return x;};}

/* ---------------- Crew orders ---------------- */
function ordBlock(){if(typeof crewOrders!=='function')return '';var t=T(),days=dayList(t,14),m={},n={ok:0,req:0,chg:0};days.forEach(function(d){m[d]={ok:0,req:0,chg:0};});
  crewOrders().forEach(function(o){var st=typeof ordStatus==='function'?ordStatus(o):o.status;if(st==='Declined'||st==='Cancelled')return;var v=typeof ordView==='function'?ordView(o):(o.cur||o.req);if(!v||!m[v.date])return;
    var k=st==='Changed - awaiting office'?'chg':(st==='Requested'?'req':'ok');m[v.date][k]+=+v.workers||0;n[k]+=+v.workers||0;});
  var chart=vbars({aria:'Workers ordered per day, next 14 days',unit:'workers',fmt:fmtN,empty:'No crew orders for the next 14 days.',legend:true,series:[{key:'ok',label:'Confirmed / filled',color:C.ok},{key:'req',label:'New – awaiting office',color:C.gold},{key:'chg',label:'Change awaiting office',color:C.warn}],
    cols:days.map(function(d){return {label:d===t?'Today':wd(d),sub:dm(d),vals:m[d],cls:d===t?'oi-today':''};})});
  return '<div class="oi-grid oi-one" id="oiOrders">'+card('oiOrdCard','Workers ordered – next 14 days',chart,{wide:true,note:'From the crew orders below (declined and cancelled orders left out). <b>'+fmtN(n.ok)+'</b> confirmed · <b>'+fmtN(n.req)+'</b> new · <b>'+fmtN(n.chg)+'</b> with a change waiting.'})+'</div>';}
if(VIEWS['admin:creworders']){var _ord=VIEWS['admin:creworders'];VIEWS['admin:creworders']=function(){var x=_ord.apply(this,arguments);if(!office())return x;try{var b=ordBlock(),y=insertAt(x,'<div class="row cotabs">',b);x=y||x+b;}catch(e){warnLog('orders',e);}return x;};}

/* ---------------- Crew coming (the week shown on the screen) ---------------- */
function comingBlock(){var S=PAGE_STATE.fhc||{start:addDays(T(),1)},days=dayList(S.start||addDays(T(),1),typeof FH_DAYS==='number'?FH_DAYS:7),cc=crewChart(days,{empty:'No crew numbers, crew orders or shifts this week.'});
  return '<div class="oi-grid oi-one" id="oiComing">'+card('oiComCard','People coming this week, by job',cc.html+crewFirmChart(cc.D),{wide:true,note:'Same week as the table below. Set numbers count as they are (Confirmed or Pending); empty days use the grey suggestion.'})+'</div>';}
if(VIEWS['admin:crewcoming']){var _com=VIEWS['admin:crewcoming'];VIEWS['admin:crewcoming']=function(){var x=_com.apply(this,arguments);if(!office())return x;try{var b=comingBlock(),y=insertAt(x,'<div class="fhc-scroll">',b)||insertAt(x,'<p class="muted" id="fhcnone">',b);x=y||x+b;}catch(e){warnLog('crewcoming',e);}return x;};}

/* ---------------- Compliance ---------------- */
function compBlock(){var c=compliance();var bars=hbars([{label:'Expired',segs:[{v:c.expired,c:C.bad}],total:c.expired},{label:'Expiring in 30 days',segs:[{v:c.d30,c:C.warn}],total:c.d30},{label:'Expiring in 31–90 days',segs:[{v:c.d90,c:C.sand}],total:c.d90}],{aria:'Papers and training by expiry',showZero:true});
  return '<div class="oi-grid" id="oiCompGrid">'+card('oiCompCard','Who can work right now',complianceChart(true),{note:'Active employees, subcontractors and subcontractor workers.'})+card('oiExpCard','Papers and training – expiry',(c.expired+c.d30+c.d90)?bars:'<div class="oi-empty oi-good">Nothing expired or expiring in the next 90 days.</div>',{note:'Approved documents with an expiry date, safety training refresh and temporary SIN dates.'})+'</div>';}
if(VIEWS['admin:compliance']){var _cmp=VIEWS['admin:compliance'];VIEWS['admin:compliance']=function(){var x=_cmp.apply(this,arguments);if(!office())return x;try{var b=compBlock(),y=insertAt(x,'</h1>',b,true);x=y||b+x;}catch(e){warnLog('compliance',e);}return x;};}

window.officeInfo={approvals:approvals,clientInv:clientInv,subInv:subInv,hoursBetween:hoursBetween,crewData:crewData,compliance:compliance,peopleByFarm:peopleByFarm};
})();
