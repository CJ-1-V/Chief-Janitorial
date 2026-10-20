/* v2-jobpos.js – jobpos1 (owner Oct 20 2026). TEST COPY.
   Daily work → All hours → open a farm: every shift row gets, right below Status,
   1) a Job picker (default General Labour; the positions are the farm rate roles already in the app: FARM_RATE_ROLES, plus the farm's own
      "Other role" when its Rate Schedule has one), and
   2) a Break picker: Normal rule (default: none up to 5 h, 30 min unpaid over 5 h, 1 h unpaid at 8 h+), 15, 30 or 60 min (this shift only).
   Billing: each shift is billed at THAT farm's signed rate for the marked job on that date. If the farm has no rate for that job the
   shift is billed at the farm's General Labour rate and flagged in red on the row and on the invoice line ("no rate set").
   The invoice gets one line per job (hours × rate = amount; overtime line if the farm has an OT rate); subtotal/HST/total = sum of lines.
   Paid hours, farm totals, invoice lines and payroll hours all use the chosen break (unpaidBreak is the shared rule).
   Store: DB.shiftJobs [{id:key,key,site,date,pos,brk,by,at}] → reg_shift_jobs (022a, NOT applied live; flag REG_STORE.shiftJobs).
   Who can change: Owner / Admin / Payroll-billing. Office Assistant sees the pickers read-only, no money. Farms see lines on invoices.
   Load after v2-invbox.js. */
(function(){
'use strict';
if(typeof DB==='undefined'||typeof VIEWS==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function roles(){var u=ME||{};var r=(u.officeRoles&&u.officeRoles.length?u.officeRoles:(u.officeRole?[u.officeRole]:[])).map(String);if(typeof officeRoleOf==='function'){var x=officeRoleOf(u);if(x&&r.indexOf(x)<0)r.push(String(x));}return r;}
function seeRates(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||helper())return false;var r=roles();if(!r.length)return !window.REG_LIVE;return ['owner','payroll','billing'].some(function(x){return r.indexOf(x)>=0;});}
window.jpSeeRates=seeRates;
function canEdit(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||helper())return false;var r=roles();if(!r.length)return !window.REG_LIVE;return ['owner','admin','payroll','billing'].some(function(x){return r.indexOf(x)>=0;});}
var SHORT={labour:'General Labour',grader:'Grader',packer:'Packer',forklift:'Forklift operator / bin piler',driver:'Truck driver',construction:'Construction labourer',baker:'Baker',painting:'Painter',cleaner:'Cleaner'};
function posLabel(p,firm,r){if(p==='other'){var o=(r&&r.other)||((firm&&typeof farmRatesCur==='function'&&farmRatesCur(firm))||{}).other;return o&&o.name?o.name:'Other role';}return SHORT[p]||p;}
window.jpPositions=function(firm){var l=(typeof FARM_RATE_ROLES!=='undefined'?FARM_RATE_ROLES:[]).map(function(x){return x[0];});var c=firm&&typeof farmRatesCur==='function'?farmRatesCur(firm):null;if(c&&c.other&&c.other.name&&c.other.rate>0)l.push('other');return l;};
function list(){return DB.shiftJobs=DB.shiftJobs||[];}
function get(k){if(!k)return null;var l=list();for(var i=0;i<l.length;i++)if(l[i].key===k)return l[i];return null;}
window.jpGet=get;
function keyOf(t){if(!t)return '';if(t.key&&/^[tc]:/.test(t.key))return t.key;if(t.key0)return t.key0;return t.id?'t:'+t.id:'';}
function rateOf(r,p){if(!r)return 0;if(p==='other')return r.other&&r.other.rate>0?r.other.rate:0;return r.rates&&r.rates[p]>0?r.rates[p]:0;}
window.jpRate=function(firm,date,p){var r=typeof farmRateOn==='function'?farmRateOn(firm,date):null;var own=rateOf(r,p);return {rate:own||rateOf(r,'labour'),missing:!own&&p!=='labour',gl:rateOf(r,'labour'),sched:r};};
/* ---- break: chosen break replaces the normal rule for that shift only ---- */
var oub=window.unpaidBreak;
if(typeof oub==='function'){window.unpaidBreak=unpaidBreak=function(h,t){var j=get(keyOf(t));if(j&&j.brk)return Math.min(Math.max(0,+h||0),(+j.brk)/60);return oub(h,t);};}
/* ---- rows carry pos + break ---- */
var ofr=window.firmRows;window.firmRows=firmRows=function(firm,from,to){var rows=ofr.apply(this,arguments);rows.forEach(function(r){var j=get(r.key);r.pos=(j&&j.pos)||'labour';if(j&&j.brk){r.brk=+j.brk;r.bill=Math.max(0,(r.hours||0)-(+j.brk)/60);}});return rows;};
window.farmRoleOfRow=farmRoleOfRow=function(x){if(x&&x.pos)return x.pos;var j=get(x&&x.key);return (j&&j.pos)||'labour';};
/* ---- report: per-job amounts at THAT farm's rate; lines per job ---- */
var orp=window.firmReport;window.firmReport=firmReport=function(firm,from,to){var R=orp.apply(this,arguments);if(typeof cjSkipFarmRates==='function'&&cjSkipFarmRates())return R;
  var old=0,wk={},L={},byDay={},list2=(R.shiftRows||[]).slice().sort(function(a,b){return a.date<b.date?-1:a.date>b.date?1:0;});
  list2.forEach(function(x){old+=x.amount||0;var p=x.pos||'labour',q=jpRate(firm,x.date,p),ot=q.sched&&q.sched.overtime>0?q.sched.overtime:0;
    var k=x.uid+'|'+weekStart(x.date),before=wk[k]||0,after=before+x.bill;wk[k]=after;var otH=ot?Math.max(0,after-Math.max(48,before)):0;
    x.rate=q.rate;x.rateMissing=q.missing;x.otH=otH;x.amount=Math.round(((x.bill-otH)*q.rate+otH*ot)*100)/100;byDay[x.date]=(byDay[x.date]||0)+x.amount;
    var lk=p+'|'+q.rate;var l=L[lk]=L[lk]||{pos:p,label:posLabel(p,firm,q.sched),hours:0,rate:q.rate,amount:0,missing:q.missing,shifts:0};l.hours+=x.bill-otH;l.shifts++;
    if(otH){var ok='ot|'+ot;var o=L[ok]=L[ok]||{pos:'ot',label:'Overtime (over 48 h a week per worker)',hours:0,rate:ot,amount:0,missing:false,shifts:0};o.hours+=otH;}});
  var lines=Object.keys(L).map(function(k){var l=L[k];l.hours=Math.round(l.hours*100)/100;l.amount=Math.round(l.hours*l.rate*100)/100;return l;})
    .sort(function(a,b){return a.pos==='ot'?1:b.pos==='ot'?-1:a.pos==='labour'?-1:b.pos==='labour'?1:a.label.localeCompare(b.label);});
  var sum=lines.reduce(function(a,l){return a+l.amount;},0);var extra=Math.round(((R.tot.amount||0)-old)*100)/100;  /* keep other add-ons (e.g. 5 h minimum) */
  (R.rows||[]).forEach(function(r){r.amount=Math.round((byDay[r.date]||0)*100)/100;});
  R.posLines=lines;R.tot.amount=Math.round((sum+extra)*100)/100;R.tot.hst=R.hstOn===false?0:Math.round(R.tot.amount*15)/100;R.tot.total=Math.round((R.tot.amount+R.tot.hst)*100)/100;return R;};
/* ---- invoices: store the job lines on the invoice when it is made ---- */
var oci=FORMS.clientinv;if(typeof oci==='function')FORMS.clientinv=function(f,d){var n=(DB.clientInvoices||[]).length;var res=oci.apply(this,arguments);var l=DB.clientInvoices||[];
  if(l.length>n){var inv=l[l.length-1],firm=user(inv.firmId);if(firm&&!inv.posLines){var R=firmReport(firm,inv.periodStart,inv.periodEnd);inv.posLines=(R.posLines||[]).map(function(x){return {pos:x.pos,label:x.label,hours:x.hours,rate:x.rate,amount:x.amount,missing:!!x.missing};});save();}}return res;};
var oid=window.invDoc;if(typeof oid==='function')window.invDoc=invDoc=function(i){var L=oid.apply(this,arguments);if(!i||!i.posLines||!i.posLines.length)return L;
  var at=-1;L.forEach(function(l,n){if(at<0&&l[0]==='r'&&/^Labour services/.test(l[1]))at=n;});if(at<0)return L;
  var rows=[['b','Job / position  ·  hours × rate']].concat(i.posLines.map(function(l){return ['r',l.label+' – '+(+l.hours).toFixed(2)+' h × '+money(l.rate)+'/h'+(l.missing?'  (no rate set for this job – billed at General Labour rate)':''),money(l.amount)];}));
  var used=i.posLines.reduce(function(a,l){return a+l.amount;},0),rest=Math.round((i.amount-used-(i.lateLines||[]).reduce(function(a,l){return a+l.amount;},0))*100)/100;
  if(Math.abs(rest)>=0.01)rows.push(['r','Other charges (minimum hours)',money(rest)]);
  L.splice.apply(L,[at,1].concat(rows));return L;};
/* ---- invoice theme 3 (screen, print, PDF): one row per job – job, hours, rate, amount; flag when the farm has no rate for that job ---- */
if(typeof window.invtData==='function'){var otd=window.invtData;window.invtData=invtData=function(i){var D=otd.apply(this,arguments);if(!i||!i.posLines||!i.posLines.length)return D;
  var first=D.lines[0],used=i.posLines.reduce(function(a,l){return a+(+l.amount||0);},0),rest=Math.round(((first?first.a:0)-used)*100)/100;
  var rows=i.posLines.map(function(l){return {d:l.label,s:(+l.hours).toFixed(2)+' h × '+invtMoney(l.rate).replace('$ ','$')+'/h'+(l.missing?' · NO RATE SET for this job at this farm – billed at the General Labour rate':''),a:+l.amount||0,h:+l.hours,r:+l.rate,miss:!!l.missing,job:1};});
  if(Math.abs(rest)>=0.01)rows.push({d:'Daily minimum hours top-up',s:first&&first.s?first.s:'',a:rest});
  D.lines=rows.concat(D.lines.slice(1));D.period=first?first.d:'';return D;};
  var oth=window.invtHtml;window.invtHtml=invtHtml=function(i){var x=oth.apply(this,arguments);if(!i||!i.posLines||!i.posLines.length)return x;var D=invtData(i);
    var t='<div class="jp-per small">'+E(D.period||'')+'</div><table class="ui-tab no-stack jp-inv"><tr><th>JOB / POSITION</th><th class="a">HOURS</th><th class="a">RATE</th><th class="a">AMOUNT</th></tr>'+D.lines.map(function(l){
      return '<tr'+(l.miss?' class="jp-miss"':'')+'><td>'+E(l.d)+(l.miss?'<span class="s jp-flag-i">No rate set for this job at this farm – billed at the General Labour rate</span>':(!l.job&&l.s?'<span class="s">'+E(l.s)+'</span>':''))+'</td><td class="a">'+(l.job?l.h.toFixed(2):'')+'</td><td class="a">'+(l.job?invtMoney(l.r)+'/h':'')+'</td><td class="a">'+invtMoney(l.a)+'</td></tr>';}).join('')+'</table>';
    return x.replace(/<table class="ui-tab no-stack">[\s\S]*?<\/table>/,function(){return t;});};
  if(typeof invHtml!=='undefined')invHtml=window.invtHtml;
  var c2=document.createElement('style');c2.textContent='.usinv .jp-inv th.a,.usinv .jp-inv td.a{width:15%}.usinv .jp-per{margin:0 0 6px;color:#555}.usinv .jp-miss td{background:#fdecec!important}.usinv .jp-flag-i{color:#9b1c1c!important;font-weight:bold}';document.head.appendChild(c2);}
/* ---- store row ---- */
function rowInfo(key){var m=/^t:(.+)$/.exec(key),t=null,site='',date='';if(m){t=(DB.time||[]).filter(function(x){return x.id===m[1];})[0];if(!t){var a=typeof allTime==='function'?allTime():[];t=a.filter(function(x){return x.id===m[1]||x.key0===key;})[0];}}
  if(!t){t=(DB.time||[]).filter(function(x){return x.key0===key;})[0]||null;}
  if(t){date=t.date;site=t.site||((DB.shifts||[]).filter(function(s){return s.id===t.shiftId;})[0]||{}).site||'';return {t:t,site:site,date:date};}
  var c=/^c:([^:]+):(.+)$/.exec(key);if(c){var sh=(DB.shifts||[]).filter(function(s){return s.id===c[1];})[0];if(sh)return {t:{key:key,'in':sh.start,out:sh.end,date:sh.date},site:sh.site,date:sh.date};}return null;}
function setRow(key,field,val){if(!canEdit()){toast('Only the owner, admin or payroll / billing can change this.');return;}var I=rowInfo(key);if(!I)return;var j=get(key);
  if(!j){j={id:key,key:key,site:I.site,date:I.date,pos:'labour',brk:''};list().push(j);}var before=j[field];j[field]=val;j.by=ME.name;j.at=new Date().toISOString();
  if(!j.pos)j.pos='labour';if(typeof audit==='function')audit(field==='pos'?'Shift job changed':'Shift break changed',I.site+' '+I.date,(before||'normal')+' → '+(val||'normal'));save();
  toast(field==='pos'?'Job saved: '+posLabel(val,typeof firmOfSite==='function'?firmOfSite(I.site):null):'Break saved: '+(val?val+' min':'normal rule'));if(typeof render==='function')render();}
/* ---- pickers below Status ---- */
function pickers(tr){var key=tr.getAttribute('data-key');if(!key)return;var st=tr.querySelector('td[data-label="Status"]');if(!st||st.querySelector('.jp-box'))return;var I=rowInfo(key);if(!I)return;
  var firm=typeof firmOfSite==='function'?firmOfSite(I.site):null,j=get(key)||{},p=j.pos||'labour',dis=canEdit()?'':' disabled',hid=!seeRates();
  var opts=jpPositions(firm).map(function(x){var q=firm?jpRate(firm,I.date,x):{missing:false};return '<option value="'+E(x)+'"'+(x===p?' selected':'')+'>'+E(posLabel(x,firm))+(q.missing?' (no rate at this farm)':'')+'</option>';}).join('');
  var b=j.brk||'',bo=[['','Normal rule'],['15','15 min'],['30','30 min'],['60','60 min']].map(function(x){return '<option value="'+x[0]+'"'+(x[0]===String(b)?' selected':'')+'>'+x[1]+'</option>';}).join('');
  var q=firm?jpRate(firm,I.date,p):{missing:false},flag='';
  if(firm&&q.missing)flag=hid?'<div class="jp-flag">No rate set for this job at this farm</div>':'<div class="jp-flag">No '+E(posLabel(p,firm))+' rate at this farm – billed at General Labour '+money(q.gl)+'/h. Set it in the farm\'s rates.</div>';
  else if(firm&&!hid&&q.rate)flag='<div class="jp-rate small muted">'+money(q.rate)+'/h</div>';
  var d=document.createElement('div');d.className='jp-box';
  d.innerHTML='<label class="jp-l">Job<select class="jp-pos" data-jpkey="'+E(key)+'"'+dis+'>'+opts+'</select></label>'+flag+'<label class="jp-l">Break<select class="jp-brk" data-jpkey="'+E(key)+'"'+dis+'>'+bo+'</select></label>';
  st.appendChild(d);
  /* paid hours + break cells follow the chosen break */
  var t=I.t;if(t&&t.out&&t['in']){var w=hrs(t['in'],t.out);if(!w&&t['in']>t.out)w=hrs(t['in'],'24:00')+hrs('00:00',t.out);var ub=unpaidBreak(w,t);
    var pc=tr.querySelector('td[data-label="Paid h"]');if(pc&&!pc.querySelector('s'))pc.textContent=Math.max(0,w-(t.breakMissed&&!j.brk?0:ub)).toFixed(2);else if(pc&&j.brk){var s=pc.querySelector('s');if(s)s.textContent=Math.max(0,w-ub).toFixed(2);}
    var bc=tr.querySelector('td.hb-brk');if(bc)bc.textContent=(ub>0?Math.round(ub*60)+' min':'none')+(j.brk?' (picked)':'');}}
function scan(){var tb=document.getElementById('vshtable');if(!tb||!tb.classList.contains('hb-open'))return;[].forEach.call(tb.querySelectorAll('tr[data-key]'),function(tr){if(tr.style.display==='none')return;pickers(tr);});}
new MutationObserver(function(){scan();}).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('change',function(e){var s=e.target;if(!s||!s.matches)return;if(s.matches('select.jp-pos'))setRow(s.getAttribute('data-jpkey'),'pos',s.value);else if(s.matches('select.jp-brk'))setRow(s.getAttribute('data-jpkey'),'brk',s.value);});
var css=document.createElement('style');css.textContent='.jp-box{margin-top:6px;display:flex;flex-direction:column;gap:4px;min-width:170px}.jp-l{display:flex;flex-direction:column;font-size:12px;font-weight:600;gap:2px}.jp-l select{font-size:13px;padding:4px 6px;min-height:32px}.jp-flag{background:#fde2e1;color:#9b1c1c;border:1px solid #f5a3a0;border-radius:6px;padding:3px 6px;font-size:12px;font-weight:600}.jp-rate{font-size:12px}';document.head.appendChild(css);
})();
/* ---- MOCK ONLY demo farm for the owner (never runs on the real database: REG_LIVE is set by store-supabase.js) ---- */
(function(){
'use strict';
if(typeof load!=='function')return;
function seedDemo(){if(window.REG_LIVE||!DB||!DB.users)return;if(DB.users.some(function(u){return u.username==='demofarm';}))return;
  var A=DB.users.filter(function(u){return u.username==='firmA';})[0];if(!A)return;
  var F=JSON.parse(JSON.stringify(A));F.id='u_jpdemo';F.name='Maple Ridge Demo Farm';F.realName='Maple Ridge Demo Farm';F.username='demofarm';F.email='demofarm@example.com';F.phone='';F.clientLink=null;delete F.client_link;
  F.firm=Object.assign({},A.firm,{billRate:24,contact:'Demo farm office (fake)',clientType:'Farm',realName:'Maple Ridge Demo Farm',clientCode:'MRD',billAddress:'1 Demo Orchard Road\nKensington PE C0B 1M0'});F.createdAt=new Date(2026,7,1).toISOString();DB.users.push(F);
  DB.sites.push({code:'MRD-01',name:'Orchard (demo)',firmId:F.id,companyId:'us'},{code:'MRD-02',name:'Packing house (demo)',firmId:F.id,companyId:'us'});
  var sig=(DB.firmSigs||[]).filter(function(s){return s.firmId===A.id;})[0];
  var rate={id:'fr_jpdemo',firmId:F.id,version:1,effective:'2026-08-01',rates:{labour:24,grader:25,packer:25.5,forklift:27.5},other:{name:'Pruning',rate:26},overtime:36,hst:true,by:'Sample data',at:new Date(2026,7,1,9).toISOString(),reason:''};
  (DB.farmRates=DB.farmRates||[]).push(rate);
  if(sig){var s2=JSON.parse(JSON.stringify(sig));s2.id='fs_jpdemo';s2.firmId=F.id;s2.firmName=F.name;s2.signerName='Demo Owner';s2.signature='Demo Owner';s2.at=new Date(2026,7,2,10).toISOString();s2.rateVersion=1;s2.rateSnapshot=JSON.parse(JSON.stringify(rate));DB.firmSigs.push(s2);}
  var emps=DB.users.filter(function(u){return u.type==='employee'&&u.approved;});var subs=DB.users.filter(function(u){return u.type==='worker'&&u.approved;});var ppl=emps.concat(subs).slice(0,5);if(!ppl.length)return;
  var POS=['labour','labour','grader','packer','forklift','other','driver'],BRK=['','','','15','30','60'],TIMES=[['07:00','15:30'],['07:00','12:00'],['08:00','16:30'],['06:30','17:00'],['09:00','14:30']];
  var n=0,d=new Date(2026,7,24),end=new Date(2026,9,20);DB.time=DB.time||[];DB.shiftJobs=DB.shiftJobs||[];
  for(;d<=end;d.setDate(d.getDate()+1)){if(d.getDay()===0)continue;var ds=isoLocal(d);var k=d.getDay()===6?2:3;
    for(var i=0;i<k;i++){n++;var p=ppl[(n+i)%ppl.length],tm=TIMES[n%TIMES.length],id='t_jp'+n,site=n%3?'MRD-01':'MRD-02';
      var t={id:id,userId:p.id,site:site,shiftId:null,date:ds,'in':tm[0],out:tm[1],clock:false,manual:true,manualSource:'office',role:'labour',by:'Sample data',at:new Date(d).toISOString()};
      if(n%17===0)t.lateEntry='pending';
      if(n%23===0){t.userId='ua-'+id;t.unassigned=true;t.uaNick='Extra '+n;}
      DB.time.push(t);var pos=POS[n%POS.length],b=BRK[n%BRK.length];if(pos!=='labour'||b)DB.shiftJobs.push({id:'t:'+id,key:'t:'+id,site:site,date:ds,pos:pos,brk:b,by:'Sample data',at:t.at});}}
  save();
  /* invoices: one per work month, lines per job */
  [['2026-08-24','2026-08-31','2026-09-02'],['2026-09-01','2026-09-30','2026-10-02'],['2026-10-01','2026-10-18','2026-10-19']].forEach(function(P,ix){var R=firmReport(F,P[0],P[1]);if(!(R.tot.amount>0))return;
    var inv={id:'ci_jpdemo'+ix,firmId:F.id,number:'UC-DEMO-00'+(ix+1),periodStart:P[0],periodEnd:P[1],billHours:R.tot.bill,amount:R.tot.amount,hst:R.tot.hst,total:R.tot.total,issued:P[2],due:addDays(P[2],30),interestPct:(typeof CB==='function'?CB().interestPct:2),paidAt:ix===0?'2026-09-20':'',
      posLines:(R.posLines||[]).map(function(x){return {pos:x.pos,label:x.label,hours:x.hours,rate:x.rate,amount:x.amount,missing:!!x.missing};})};
    (DB.clientInvoices=DB.clientInvoices||[]).push(inv);});
  save();}
var ol=load;load=function(){var r=ol.apply(this,arguments);try{seedDemo();}catch(e){console.warn('jobpos demo seed',e);}return r;};
})();
