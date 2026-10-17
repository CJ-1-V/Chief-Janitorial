/* v2-invrevise.js – invrevise1 (owner Oct 17 2026, 2:21 / 2:23 / 2:26 PM). TEST COPY. New file only – loaded right after
   v2-headcount.js and before v2-nohome.js (which stays LAST). Remove the 2 lines in index.html to undo everything.

   1. REVISED INVOICE (v2 supersedes v1). The owner opens an issued, unpaid farm invoice and taps "Revise invoice". The app re-pulls
      the counted hours for the same period (same rules as every invoice: break once, 5-hour minimum, waivers, signed rates, HST 15%)
      and shows WHAT CHANGED against the original: lines added / removed / changed (day, farm code, Worker #n, billable hours, $) and
      the difference in $. "Create revised invoice" makes a NEW row <original number>-R2 (R3 …) that references the original
      (revOf). Until the farm approves it the revision is "Waiting for farm approval": the ORIGINAL stays the payable invoice and the
      revision is not counted as owing anywhere. The farm sees both, with the what-changed summary, and taps Approve (or
      "Question this" with a note). On approval: who + when is recorded on the revision and in the audit log, the revision becomes
      the payable invoice (due = approval day + payment terms) and the original shows "Replaced by …-R2" (no longer owing).
      The office can withdraw a revision that is waiting / questioned (the original is untouched). Paid invoices are not revised –
      use the credit note / extra invoice from synccheck1 instead.
      Live: the farm's decision goes through the server function reg_client_invoice_decide() (migration 017a); the office side needs
      no schema change. Turned on in live by store-config  invRevise: true  (only AFTER 017a).
   2. FARM HUB on the farm's person page (People → Open a farm, OWNER ONLY): links (rates, billing by day, crew orders, codes &
      logins, headcount, See their page), the farm's invoices with Revise, the 5-hour minimum waive control per day (same logic and
      confirm as Farm billing by day / minwaive1), and "Past invoices & timesheets".
   3. PAST INVOICES & TIMESHEETS: the owner uploads a file (PDF, picture or Excel) as an Invoice or a Timesheet for a period (from –
      to, optional invoice # and amount), sees the list, and removes one (confirm, soft delete: kept with who / when, audit log).
      The farm sees its own files on "My invoices". Owner + that farm only (Office Assistant / other office logins / other farms: none).
      These are reference files – they never change hours, billing, owing or interest. Files use the same private storage as uploaded
      past invoices (reg-docs bucket, '<client id>/<row id>-…'); rows live in the new table reg_client_files (migration 017b).
      Live: store-config  clientFiles: true  (only AFTER 017b). */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof ACT==='undefined'||typeof FORMS==='undefined')return;
function LIVE(){return !!window.REG_LIVE;}
function CFG(k){return !LIVE()||!!(window.REG_STORE&&window.REG_STORE[k]);}
function E(s){return esc(s==null?'':String(s));}
function R2(x){return Math.round((+x||0)*100)/100;}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function owner(){if(typeof ME==='undefined'||!ME||ME.type!=='admin'||helper())return false;return typeof window.ivOwner==='function'?!!window.ivOwner():true;}
function isFirm(){return typeof ME!=='undefined'&&!!ME&&ME.type==='firm';}
function allInv(){return (DB&&DB.clientInvoices)||[];}
function invOf(id){if(!id)return null;var l=allInv();for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];return null;}
function nowIso(){return new Date().toISOString();}
function T(){return today();}
function ownerOnly(){if(owner())return false;toast(window.IV_MSG||'Farm invoices are visible to the owner only.');return true;}

/* ================= 1. revised invoices ================= */
function kids(i){return allInv().filter(function(x){return x.revOf===i.id;});}
function liveKid(i){return kids(i).filter(function(x){return x.revStatus!=='withdrawn';}).slice(-1)[0]||null;}
function rootOf(i){var r=i,n=0;while(r&&r.revOf&&n<20){var p=invOf(r.revOf);if(!p)break;r=p;n++;}return r;}
function waitingRev(i){return !!(i&&i.revOf&&(i.revStatus==='waiting'||i.revStatus==='questioned'));}
/* payable = counts as owing and can be marked paid */
function payable(i){if(!i)return false;if(i.revOf)return i.revStatus==='approved'&&!replaced(i);return !replaced(i);}
function replaced(i){return kids(i).some(function(k){return k.revStatus==='approved';});}
window.irPayable=payable;
function revPill(i){var k=liveKid(i);
  if(i.revOf){if(i.revStatus==='waiting')return ['Waiting for farm approval','s-pend ir-wait'];if(i.revStatus==='questioned')return ['Farm has a question','s-warn ir-q'];if(i.revStatus==='withdrawn')return ['Withdrawn','s-mut'];}
  if(k&&k.revStatus==='approved')return ['Replaced by '+k.number,'s-mut ir-repl'];
  return null;}
function nk(k){k=String(k||'');return k.indexOf('c:')===0?'c:'+k.split(':')[1]:k;}
/* counted lines for the period, same shape as synccheck1's snapshot (k,d,s,n,h,bl) + $ and Worker # (never a name or person id) */
function snap(firm,from,to){var R=firmReport(firm,from,to),m={};
  (R.shiftRows||[]).forEach(function(r){var k=nk(r.key),x=m[k]=m[k]||{k:k,d:r.date,s:r.site,n:0,h:0,bl:0,a:0,w:r.no};x.n++;x.h=R2(x.h+r.hours);x.bl=R2(x.bl+r.bill);x.a=R2(x.a+(+r.amount||0));});
  return {R:R,lines:Object.keys(m).sort().map(function(k){return m[k];})};}
function changes(base,S){var old={},cur={},out={added:[],removed:[],changed:[]};(base.lines0||base.lines||[]).forEach(function(l){old[l.k]=l;});S.lines.forEach(function(l){cur[l.k]=l;});
  Object.keys(cur).forEach(function(k){var a=old[k],b=cur[k];if(!a)out.added.push(b);else if(Math.abs((a.bl||0)-(b.bl||0))>0.004||a.n!==b.n)out.changed.push({k:k,d:b.d,s:b.s,w:b.w,was:a.bl,now:b.bl,wasA:a.a,a:b.a,h:b.h});});
  Object.keys(old).forEach(function(k){if(!cur[k])out.removed.push(old[k]);});
  var srt=function(x,y){return x.d<y.d?-1:x.d>y.d?1:(x.w||0)-(y.w||0);};out.added.sort(srt);out.removed.sort(srt);out.changed.sort(srt);
  out.noDetail=!(base.lines0||base.lines);
  out.amountWas=R2(base.amount);out.hstWas=R2(base.hst);out.totalWas=R2(base.total);
  out.amountNow=R2(S.R.tot.amount);out.hstNow=R2(S.R.tot.hst);out.totalNow=R2(S.R.tot.total);out.billWas=R2(base.billHours);out.billNow=R2(S.R.tot.bill);
  out.diff=R2(out.totalNow-out.totalWas);out.diffAmount=R2(out.amountNow-out.amountWas);return out;}
function sgn(v){return (v<0?'−':'+')+money(Math.abs(v));}
function changesHtml(C,id){var rows=[];
  C.added.forEach(function(l){rows.push('<tr class="ir-add"><td>'+E(shortDay(l.d))+'</td><td>'+E(l.s)+'</td><td>Worker #'+E(l.w||'?')+'</td><td><span class="pill s-ok">Added</span></td><td class="r">– → '+(+l.bl).toFixed(2)+'</td><td class="r">'+(l.a!=null?sgn(l.a):'')+'</td></tr>');});
  C.changed.forEach(function(l){rows.push('<tr class="ir-chg"><td>'+E(shortDay(l.d))+'</td><td>'+E(l.s)+'</td><td>Worker #'+E(l.w||'?')+'</td><td><span class="pill s-warn">Changed</span></td><td class="r">'+(+l.was).toFixed(2)+' → '+(+l.now).toFixed(2)+'</td><td class="r">'+(l.wasA!=null&&l.a!=null?sgn(R2(l.a-l.wasA)):'')+'</td></tr>');});
  C.removed.forEach(function(l){rows.push('<tr class="ir-rem"><td>'+E(shortDay(l.d))+'</td><td>'+E(l.s)+'</td><td>Worker #'+E(l.w||'?')+'</td><td><span class="pill s-bad">Removed</span></td><td class="r">'+(+l.bl).toFixed(2)+' → –</td><td class="r">'+(l.a!=null?sgn(-l.a):'')+'</td></tr>');});
  return '<div class="ir-changes"'+(id?' id="'+id+'"':'')+'><h3>What changed</h3>'+
    (rows.length?'<div class="tw"><table class="no-stack ir-ctab"><tr><th>Day</th><th>Farm code</th><th>Worker</th><th>Change</th><th class="r">Billable h</th><th class="r">Amount</th></tr>'+rows.join('')+'</table></div>':(C.noDetail?'<p class="small muted">The original invoice has no line detail (made before Oct 9) – only the totals can be compared.</p>':'<p class="small muted">No line changed.</p>'))+
    '<div class="ir-sum"><div><span>Original</span><b>'+money(C.totalWas)+'</b><small>'+money(C.amountWas)+' + HST '+money(C.hstWas)+'</small></div>'+
    '<div><span>Revised</span><b>'+money(C.totalNow)+'</b><small>'+money(C.amountNow)+' + HST '+money(C.hstNow)+'</small></div>'+
    '<div class="ir-diff '+(C.diff<0?'neg':'pos')+'"><span>Difference</span><b>'+sgn(C.diff)+'</b><small>billable '+(+C.billWas).toFixed(2)+' → '+(+C.billNow).toFixed(2)+' h</small></div></div></div>';}
function canRevise(i){if(!i||i.uploaded||i.adjOf||i.sample&&!i.periodStart||!i.periodStart||!i.periodEnd)return 'This invoice can\'t be revised in the app.';
  if(i.paidAt)return 'This invoice is already paid – use a credit note or an extra invoice instead.';
  if(i.revOf&&i.revStatus!=='approved')return 'Only an approved revision can be revised again.';
  if(replaced(i))return 'This invoice was already replaced.';
  var k=liveKid(i);if(k&&waitingRev(k))return 'Revision '+k.number+' is already waiting for the farm.';
  if(LIVE()&&!CFG('invRevise'))return 'Revised invoices are not switched on yet (needs migration 017a).';return '';}
function revModal(i,C,why){var firm=user(i.firmId);
  return '<div class="ir-modal" id="irprev"><h2>Revise invoice '+E(i.number)+'</h2><p><b>'+E(firm?firm.name:'')+'</b> · '+E(i.periodStart)+' to '+E(i.periodEnd)+' · issued '+E(i.issued)+'</p>'+
  '<p class="small">The hours for this period were pulled again (approved / counted hours only, same billing rules). The revised invoice will be <b>'+E(rootOf(i).number+'-R'+(revNo(i)))+'</b>. '+
  'It replaces '+E(i.number)+' only after the farm approves it – until then '+E(i.number)+' stays the invoice to pay.</p>'+changesHtml(C,'irprevchanges')+
  (why?'<div class="alert warn small">'+E(why)+'</div>':'')+
  '<form data-form="irgo" id="irform"><input type="hidden" name="id" value="'+E(i.id)+'"><label for="irnote">Note to the farm (shown on the revised invoice)</label><input type="text" name="note" id="irnote" maxlength="200" value="Hours found after the invoice was sent were added." >'+
  '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button class="gold" id="irgo"'+(why?' disabled':'')+'>Create revised invoice – send to farm for approval</button></div></form></div>';}
function revNo(i){var r=rootOf(i),n=1;(function walk(x){kids(x).forEach(function(k){var m=/-R(\d+)$/.exec(k.number||'');if(m)n=Math.max(n,+m[1]);walk(k);});})(r);return n+1;}
ACT.irrev=function(el){if(ownerOnly())return;var i=invOf(el.dataset.id),why=canRevise(i);if(!i){toast('Not found.');return;}if(why&&!/no line/.test(why)){toast(why);return;}
  var firm=user(i.firmId);if(!firm){toast('Farm not found.');return;}var S=snap(firm,i.periodStart,i.periodEnd),C=changes(i,S);
  var nochg=!C.added.length&&!C.removed.length&&!C.changed.length&&Math.abs(C.diff)<0.005;
  PAGE_STATE.irPrev={id:i.id,C:C,S:S};modal(revModal(i,C,nochg?'The hours for this period still match this invoice – nothing to revise.':''));};
FORMS.irgo=function(f,d){if(ownerOnly())return;var P=PAGE_STATE.irPrev,i=invOf(d.id);if(!P||!i||P.id!==i.id){toast('Please open Revise again.');return;}var why=canRevise(i);if(why){toast(why);return;}
  var firm=user(i.firmId),S=snap(firm,i.periodStart,i.periodEnd),C=changes(i,S),c=CB(),k=revNo(i),root=rootOf(i);
  if(!C.added.length&&!C.removed.length&&!C.changed.length&&Math.abs(C.diff)<0.005){toast('Nothing changed.');return;}
  var v={id:uid('ci'),firmId:i.firmId,number:root.number+'-R'+k,periodStart:i.periodStart,periodEnd:i.periodEnd,billHours:S.R.tot.bill,amount:S.R.tot.amount,hst:S.R.tot.hst,total:S.R.tot.total,
    issued:T(),due:'',interestPct:i.interestPct!=null?i.interestPct:c.interestPct,paidAt:'',lines:S.lines,minTopUpHours:S.R.tot.topUp||0,minWaivedDays:(S.R.waivedDays||[]).slice(),
    revOf:i.id,rev:k,revStatus:'waiting',revAt:nowIso(),revBy:ME.name,revNote:String(d.note||'').trim().slice(0,200),revChanges:C};
  if(!i.lines0&&i.lines)i.lines0=i.lines;i.lines=S.lines;i.revisedBy=v.id;   /* the original's lock follows the new lines; the original lines are kept in lines0 */
  (DB.clientInvoices=DB.clientInvoices||[]).push(v);
  audit('Created revised client invoice',firm.name,v.number+' replaces '+i.number+' · '+money(C.totalWas)+' → '+money(C.totalNow)+' ('+sgn(C.diff)+') · waiting for farm approval');
  notify(i.firmId,'Revised client invoice '+v.number+' (replaces '+i.number+'): '+money(v.total)+'. Please open My invoices to approve it.');
  save();closeModal();PAGE_STATE.irPrev=null;toast('Revised invoice '+v.number+' sent to the farm for approval.');render();};
ACT.irwithdraw=function(el){if(ownerOnly())return;var v=invOf(el.dataset.id);if(!waitingRev(v)){toast('Only a waiting revision can be withdrawn.');return;}
  modal('<h2>Withdraw revised invoice '+E(v.number)+'?</h2><p class="small">The farm will no longer see it as waiting. The original invoice stays as it is.</p><div class="row-end"><button class="sec" data-act="closeModal">Cancel</button><button id="irwdok" data-act="irwithdrawok" data-id="'+E(v.id)+'">Yes, withdraw</button></div>');};
ACT.irwithdrawok=function(el){if(ownerOnly())return;var v=invOf(el.dataset.id);if(!waitingRev(v))return;var p=invOf(v.revOf);v.revStatus='withdrawn';v.withdrawnAt=nowIso();v.withdrawnBy=ME.name;
  if(p){if(p.lines0){p.lines=p.lines0;delete p.lines0;}delete p.revisedBy;}
  audit('Withdrew revised client invoice',(user(v.firmId)||{}).name||'',v.number);notify(v.firmId,'Revised client invoice '+v.number+' was withdrawn by UnScramble. Invoice '+(p?p.number:'')+' stays as it was.');save();closeModal();toast('Withdrawn.');render();};

/* ---------- farm: approve / question ---------- */
function farmOwns(v){return !!(v&&ME&&ME.type==='firm'&&(v.firmId===ME.id||(ME.loginOf&&v.firmId===ME.loginOf)));}
ACT.irapprove=function(el){var v=invOf(el.dataset.id);if(!farmOwns(v)||!waitingRev(v)){toast('This revised invoice can\'t be approved now.');return;}var p=invOf(v.revOf);
  modal('<h2>Approve revised invoice '+E(v.number)+'?</h2><p class="small">It replaces invoice <b>'+E(p?p.number:'')+'</b>. After you approve, '+E(v.number)+' ('+money(v.total)+') is the invoice to pay, due '+E(addDays(T(),CB().netDays))+'.</p>'+changesHtml(v.revChanges||{added:[],removed:[],changed:[]})+
    '<div class="row-end"><button class="sec" data-act="closeModal">Cancel</button><button class="gold" id="irapok" data-act="irapproveok" data-id="'+E(v.id)+'">Yes, approve</button></div>');};
function decide(v,action,note){var p=invOf(v.revOf);
  if(LIVE()){if(!window.REG_SB)return;window.REG_SB.rpc('reg_client_invoice_decide',{p_id:v.id,p_action:action,p_note:note||null}).then(function(r){if(r.error){toast(r.error.message||'Could not save.');return;}
      closeModal();toast(action==='approve'?'Approved – thank you.':'Your question was sent to UnScramble.');if(typeof window.REG_REFRESH==='function')window.REG_REFRESH('invrevise');else render();},function(){toast('Could not save – please try again.');});return;}
  var at=nowIso();
  if(action==='approve'){v.revStatus='approved';v.approvedAt=at;v.approvedBy=ME.name;v.approvedById=ME.id;v.due=addDays(T(),CB().netDays);if(p){p.supersededAt=at;p.supersededBy=v.id;}
    audit('Farm approved revised client invoice',ME.name,v.number+(p?' replaces '+p.number:'')+' · '+money(v.total));notifyOffice('Farm approved revised client invoice '+v.number+' ('+money(v.total)+').');}
  else{v.revStatus='questioned';v.question={note:note,at:at,by:ME.name,byId:ME.id};audit('Farm questioned revised client invoice',ME.name,v.number+' · '+note);notifyOffice('Farm questioned revised client invoice '+v.number+': '+note);}
  save();closeModal();toast(action==='approve'?'Approved – thank you.':'Your question was sent to UnScramble.');render();}
function notifyOffice(text){var o=(DB.users||[]).filter(function(u){return u.type==='admin'&&u.active!==false&&(!(u.officeRoles||[]).length||(u.officeRoles||[]).indexOf('owner')>=0);}).map(function(u){return u.id;});if(o.length)notify(o,text);}
ACT.irapproveok=function(el){var v=invOf(el.dataset.id);if(!farmOwns(v)||!waitingRev(v))return;decide(v,'approve','');};
ACT.irquestion=function(el){var v=invOf(el.dataset.id);if(!farmOwns(v)||!waitingRev(v))return;
  modal('<h2>Question revised invoice '+E(v.number)+'</h2><form data-form="irq" id="irqform"><input type="hidden" name="id" value="'+E(v.id)+'"><label for="irqnote">Your question for UnScramble</label><textarea name="note" id="irqnote" maxlength="500" required placeholder="e.g. Worker #3 on Sep 9 did not work for us"></textarea><div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="irqok">Send question</button></div></form>');};
FORMS.irq=function(f,d){var v=invOf(d.id),n=String(d.note||'').trim();if(!farmOwns(v)||!waitingRev(v))return;if(n.length<2){toast('Please write your question.');return;}decide(v,'question',n.slice(0,500));};
ADMIN_ONLY_ACT.push('irrev','irwithdraw','irwithdrawok');ADMIN_ONLY_FORM.push('irgo');
if(typeof ROLE_ONLY==='object'){ROLE_ONLY.irapprove=['firm'];ROLE_ONLY.irapproveok=['firm'];ROLE_ONLY.irquestion=['firm'];ROLE_ONLY.irq=['firm'];}

/* ---------- owing: a waiting revision and a replaced original never count (mock-safe masking, stored data untouched) ---------- */
var MASK=null;
function masked(fn,ctx,args){if(MASK||!DB||!Array.isArray(DB.clientInvoices))return fn.apply(ctx,args);MASK=DB.clientInvoices;DB.clientInvoices=MASK.filter(payable);try{return fn.apply(ctx,args);}finally{DB.clientInvoices=MASK;MASK=null;}}
var sv=save;save=function(){if(!MASK)return sv.apply(this,arguments);var m=DB.clientInvoices;DB.clientInvoices=MASK;try{return sv.apply(this,arguments);}finally{DB.clientInvoices=m;}};
if(VIEWS['admin:home']){var oh=VIEWS['admin:home'];VIEWS['admin:home']=function(){return masked(oh,this,arguments);};}
if(typeof adminFlags==='function'){var oaf=adminFlags;adminFlags=function(){return masked(oaf,this,arguments);};}
/* tile sheets (tilesall1) are drawn inside a click handler: mask for that one click */
function tileMask(e){var x=e.target&&e.target.closest&&e.target.closest('#oiTiles .oi-tile[id]');if(!x||MASK||!DB||!Array.isArray(DB.clientInvoices))return;if(e.type==='keydown'&&!(e.key==='Enter'||e.key===' '))return;
  MASK=DB.clientInvoices;DB.clientInvoices=MASK.filter(payable);setTimeout(function(){if(MASK){DB.clientInvoices=MASK;MASK=null;}},0);}
window.addEventListener('click',tileMask,true);window.addEventListener('keydown',tileMask,true);
/* a withdrawn revision never shows to the farm */
if(typeof clientInvs==='function'){var oci=clientInvs;clientInvs=function(){var l=oci.apply(this,arguments);return isFirm()?l.filter(function(i){return i.revStatus!=='withdrawn';}):l;};}
/* "Mark paid" refused on a revision that waits / an original that was replaced */
if(ACT.clientinvpaid){var ocp=ACT.clientinvpaid;ACT.clientinvpaid=function(el){var i=invOf(el.dataset.id);if(i&&!payable(i)){toast(i.revOf?'This revised invoice is waiting for the farm\'s approval.':'This invoice was replaced by a revised invoice.');return;}return ocp.apply(this,arguments);};}
/* invoice document (screen / print / PDF): revision lines – client-safe (Worker #n only) */
if(typeof invDoc==='function'){var od=invDoc;invDoc=function(i){var L=od(i);try{var add=[],k=liveKid(i);
  if(i.revOf){var p=invOf(i.revOf),C=i.revChanges;add.push(['b','Revised invoice – replaces '+(p?p.number:'')]);
    add.push(['t',i.revStatus==='approved'?'Approved by '+(i.approvedBy||'the farm')+' on '+fmtStamp(i.approvedAt):i.revStatus==='withdrawn'?'Withdrawn by UnScramble':i.revStatus==='questioned'?'Questioned by the farm – UnScramble will reply':'Waiting for the farm\'s approval']);
    if(i.revNote)add.push(['s',i.revNote]);
    if(C){(C.added||[]).forEach(function(l){add.push(['r','  Added: '+l.d+' '+l.s+' Worker #'+(l.w||'?')+' – '+(+l.bl).toFixed(2)+' h',money(l.a||0)]);});
      (C.changed||[]).forEach(function(l){add.push(['r','  Changed: '+l.d+' '+l.s+' Worker #'+(l.w||'?')+' – '+(+l.was).toFixed(2)+' → '+(+l.now).toFixed(2)+' h',money(R2((l.a||0)-(l.wasA||0)))]);});
      (C.removed||[]).forEach(function(l){add.push(['r','  Removed: '+l.d+' '+l.s+' Worker #'+(l.w||'?')+' – '+(+l.bl).toFixed(2)+' h',money(-(l.a||0))]);});
      add.push(['r','Original invoice total',money(C.totalWas)]);add.push(['r','Difference',(C.diff<0?'-':'+')+money(Math.abs(C.diff))]);}
    add.push(['g']);}
  else if(k&&k.revStatus==='approved'){add.push(['b','Replaced by revised invoice '+k.number+' (approved '+fmtStamp(k.approvedAt)+') – nothing owing on this invoice']);add.push(['g']);}
  else if(k&&waitingRev(k)){add.push(['t','A revised invoice '+k.number+' is waiting for the farm\'s approval. This invoice stays payable until then.']);add.push(['g']);}
  if(add.length){var ix=-1;L.forEach(function(l,n){if(ix<0&&l[0]==='g')ix=n;});L.splice.apply(L,[ix<0?0:ix+1,0].concat(add));}
  if(!payable(i)){L=L.map(function(l){return l[0]==='rb'&&l[1]==='Now owing'?['rb','Now owing',money(0)]:l;});}}catch(e){}return L;};}
/* invoice status text (farm list) */
if(typeof invPlain==='function'){var op=invPlain;invPlain=function(i){var r=revPill(i);if(r)return {t:r[0],c:r[1],d:r[0]};return op.apply(this,arguments);};}

/* ---------- office + farm invoice table rows ---------- */
function rowEdit(x,i,office){var key='<tr data-inv="'+E(i.number)+'"',at=x.indexOf(key);if(at<0)return x;var end=x.indexOf('</tr>',at);if(end<0)return x;var row=x.slice(at,end);
  var r=revPill(i),k=liveKid(i),tag='';
  if(i.revOf){var p=invOf(i.revOf);tag='<div class="small ir-tag">Revised – replaces '+E(p?p.number:'')+'</div>';
    if(i.revStatus==='approved')tag+='<div class="small muted ir-who">Approved by '+E(i.approvedBy||'farm')+' · '+E(fmtStamp(i.approvedAt))+'</div>';
    if(i.revStatus==='questioned'&&i.question)tag+='<div class="small ir-qnote">Farm asks: “'+E(i.question.note)+'”</div>';}
  else if(k&&waitingRev(k))tag='<div class="small ir-tag">Revision '+E(k.number)+' waiting for farm approval</div>';
  if(tag){var c=row.indexOf('>'+E(i.number));if(c>=0){var e=row.indexOf('</td>',c);if(e>=0)row=row.slice(0,e)+tag+row.slice(e);}}
  if(r)row=row.replace(/<td><span class="pill [^"]*">[^<]*<\/span><\/td>(<td class="interest">)/,'<td><span class="pill '+r[1]+'">'+E(r[0])+'</span></td>$1');
  if(!payable(i)){row=row.replace(/<td class="interest">[\s\S]*?<\/td>/,'<td class="interest">–</td>').replace(/<td class="owing"><b>[^<]*<\/b><\/td>/,'<td class="owing"><b>'+money(0)+'</b></td>').replace(/<button class="small sec" data-act="clientinvpaid"[^>]*>Mark paid<\/button>/,'');}
  if(office&&owner()){var b='';if(!canRevise(i)&&CFG('invRevise'))b='<button class="small ir-revbtn" data-act="irrev" data-id="'+E(i.id)+'">Revise invoice</button>';
    if(waitingRev(i))b+='<button class="small sec ir-wdbtn" data-act="irwithdraw" data-id="'+E(i.id)+'">Withdraw</button>';
    if(b){var c2=row.indexOf('>'+E(i.number));var e2=c2>=0?row.indexOf('</td>',c2):-1;if(e2>=0)row=row.slice(0,e2)+'<div class="ir-btns">'+b+'</div>'+row.slice(e2);}}
  return x.slice(0,at)+row+x.slice(end);}
function waitingPanel(firm){var W=allInv().filter(function(v){return waitingRev(v)&&(!firm||v.firmId===firm.id);});if(!W.length)return '';
  return '<div class="alert info small ir-panel" id="irwaiting"><b>Revised invoices waiting for the farm</b><ul>'+W.map(function(v){var p=invOf(v.revOf),f=user(v.firmId);
    return '<li data-inv="'+E(v.number)+'"><b>'+E(v.number)+'</b> · '+E(f?f.name:'')+' · replaces '+E(p?p.number:'')+' · '+money(v.total)+' ('+sgn((v.revChanges||{}).diff||0)+') · <span class="pill '+revPill(v)[1]+'">'+E(revPill(v)[0])+'</span>'+(v.question?' <span class="ir-qnote">“'+E(v.question.note)+'”</span>':'')+' <button class="small sec" data-act="civview" data-id="'+E(v.id)+'">View</button> <button class="small sec" data-act="irwithdraw" data-id="'+E(v.id)+'">Withdraw</button></li>';}).join('')+'</ul></div>';}
if(typeof clientInvoicesHtml==='function'){var och=clientInvoicesHtml;clientInvoicesHtml=function(firm,office){var x=och.apply(this,arguments);try{
  if(office&&!owner())return x;
  var l=allInv().filter(function(i){return !firm||i.firmId===firm.id;});l.forEach(function(i){x=rowEdit(x,i,office);});
  if(office){/* synccheck1 flag: an original that was revised is no longer flagged (its revision carries the hours) + a Revise button on each flag */
    allInv().forEach(function(i){if(!i.revisedBy)return;x=x.replace(new RegExp('<li class="sc-invflag" data-inv="'+E(i.number).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'">[\\s\\S]*?</li>'),'');});
    x=x.replace(/<li class="sc-invflag" data-inv="([^"]+)">([\s\S]*?)<\/li>/g,function(m,num,body){var i=allInv().filter(function(z){return z.number===num;})[0];if(!i||canRevise(i)||!CFG('invRevise'))return m;return '<li class="sc-invflag" data-inv="'+num+'">'+body+' <button class="small ir-revbtn" data-act="irrev" data-id="'+E(i.id)+'">Revise invoice</button></li>';});
    x=x.replace('<div class="card" id="clientinvoices">','<div class="card" id="clientinvoices">'+waitingPanel(firm));}
  }catch(e){try{console.warn('[invrevise]',e);}catch(z){}}return x;};window.clientInvoicesHtml=clientInvoicesHtml;}

/* ---------- farm: My invoices – approval card + tags; home banner ---------- */
function farmWaiting(){if(!isFirm())return [];return allInv().filter(function(v){return farmOwns(v)&&waitingRev(v);});}
function farmCard(v){var p=invOf(v.revOf);
  return '<div class="card ir-farmcard" id="irfarm-'+E(v.number)+'" data-inv="'+E(v.number)+'"><h2 style="margin-top:0">Revised invoice '+E(v.number)+' <span class="pill '+revPill(v)[1]+'">'+E(revPill(v)[0])+'</span></h2>'+
   '<p>This revised invoice replaces invoice <b>'+E(p?p.number:'')+'</b> for '+E(v.periodStart)+' to '+E(v.periodEnd)+'. '+(v.revNote?'<i>'+E(v.revNote)+'</i>':'')+'</p>'+changesHtml(v.revChanges||{added:[],removed:[],changed:[]})+
   (v.revStatus==='questioned'?'<div class="alert info small">You asked: “'+E(v.question&&v.question.note)+'” ('+E(fmtStamp(v.question&&v.question.at))+'). UnScramble will reply. You can still approve.</div>':'')+
   '<p class="small muted">Until you approve, invoice '+E(p?p.number:'')+' stays the one to pay. Workers are shown as Worker #n only.</p>'+
   '<div class="row ir-farmbtns"><button class="gold" data-act="irapprove" data-id="'+E(v.id)+'">✓ Approve revised invoice</button>'+(v.revStatus==='questioned'?'':'<button class="sec" data-act="irquestion" data-id="'+E(v.id)+'">Question this</button>')+'<button class="sec" data-act="civview" data-id="'+E(v.id)+'">View invoice</button></div></div>';}
if(VIEWS['firm:invoices']){var ofi=VIEWS['firm:invoices'];VIEWS['firm:invoices']=function(){var x=ofi.apply(this,arguments);try{
  myInvoices(ME).forEach(function(i){var r=revPill(i),k=liveKid(i),tag='';if(i.revOf){var p=invOf(i.revOf);tag='<span class="small ir-tag">Revised – replaces '+E(p?p.number:'')+(i.revStatus==='approved'?' · approved by '+E(i.approvedBy||'you')+' '+E(fmtStamp(i.approvedAt)):'')+'</span>';}
    else if(k&&waitingRev(k))tag='<span class="small ir-tag">Revision '+E(k.number)+' waiting for your approval</span>';
    if(tag)x=x.replace('<span class="small">'+E(i.periodStart)+' – '+E(i.periodEnd)+'</span>','<span class="small">'+E(i.periodStart)+' – '+E(i.periodEnd)+'</span>'+tag);
    if(!payable(i))x=x.replace(new RegExp('(data-inv="'+E(i.number).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'"[\\s\\S]*?<span class="it">)[^<]*'),function(m,g){return g+money(i.total)+' <small>(not owing)</small>';});});
  var W=farmWaiting();if(W.length){var h=x.indexOf('</p>');x=h>=0?x.slice(0,h+4)+W.map(farmCard).join('')+x.slice(h+4):W.map(farmCard).join('')+x;}
  x+=farmFilesCard();}catch(e){try{console.warn('[invrevise]',e);}catch(z){}}return x;};}
if(VIEWS['firm:home']){var ofh=VIEWS['firm:home'];VIEWS['firm:home']=function(){var x=ofh.apply(this,arguments);try{var W=farmWaiting();if(W.length){var b='<div class="alert warn ir-banner" id="irbanner"><b>'+(W.length===1?'A revised invoice is':W.length+' revised invoices are')+' waiting for your approval</b> – '+W.map(function(v){return E(v.number)+' ('+money(v.total)+')';}).join(', ')+'. <a href="#/invoices">Open My invoices →</a></div>';var h=x.indexOf('</h1>');x=h>=0?x.slice(0,h+5)+b+x.slice(h+5):b+x;}}catch(e){}return x;};}

/* ================= 3. past invoices & timesheets (files) ================= */
var CF_TYPES=/^(application\/pdf|image\/(png|jpe?g|webp|heic)|application\/vnd\.openxmlformats-officedocument\.spreadsheetml\.sheet|application\/vnd\.ms-excel|text\/csv)$/i;
var CF_EXT=/\.(pdf|png|jpe?g|webp|heic|xlsx|xls|csv)$/i;
var CF={rows:null,at:0,busy:false,err:''};
function cfAll(){if(!LIVE())return (DB.clientFiles=DB.clientFiles||[]);
  if(!CFG('clientFiles'))return [];
  if(!CF.busy&&(!CF.rows||Date.now()-CF.at>60000)&&window.REG_SB){CF.busy=true;CF.at=Date.now();
    window.REG_SB.from('reg_client_files').select('id,client_id,data').then(function(r){CF.busy=false;if(r.error){CF.err=r.error.message;return;}var was=JSON.stringify(CF.rows);
      CF.rows=(r.data||[]).map(function(x){var d=Object.assign({},x.data||{});d.id=x.id;d.firmId=x.client_id;return d;});if(JSON.stringify(CF.rows)!==was)render();},function(){CF.busy=false;});}
  return CF.rows||[];}
function cfFor(firmId,withRemoved){return cfAll().filter(function(r){return r.firmId===firmId&&(withRemoved||!r.removed);}).sort(function(a,b){return (b.from||'')<(a.from||'')?-1:(b.from||'')>(a.from||'')?1:0;});}
function cfMine(){if(!isFirm())return [];var ids=[ME.id];if(ME.loginOf)ids.push(ME.loginOf);return cfAll().filter(function(r){return !r.removed&&(LIVE()||ids.indexOf(r.firmId)>=0);});}
function cfById(id){var l=cfAll();for(var i=0;i<l.length;i++)if(l[i].id===id)return l[i];return null;}
function cfKind(r){return r.kind==='timesheet'?'Timesheet':'Invoice';}
function cfExt(r){return ((String(r.file&&r.file.name||'').match(/\.([A-Za-z0-9]{2,5})$/)||[])[1]||'file').toUpperCase();}
function cfRow(r,office){return '<tr data-cf="'+E(r.id)+'"'+(r.removed?' class="cf-removed"':'')+'><td><span class="pill '+(r.kind==='timesheet'?'s-mut cf-ts':'s-pend cf-inv')+'">'+cfKind(r)+'</span></td><td class="nw">'+E(r.from)+(r.to&&r.to!==r.from?' – '+E(r.to):'')+'</td><td>'+E(r.number||'–')+'</td><td class="r">'+(r.amount!=null&&r.amount!==''?money(r.amount):'–')+'</td>'+
  '<td class="small">'+E(r.file&&r.file.name||'')+' <span class="muted">'+cfExt(r)+'</span>'+(office?'<div class="muted">Added '+E(fmtStamp(r.at))+' by '+E(r.by||'')+'</div>':'')+(r.removed?'<div class="cf-rmnote">Removed '+E(fmtStamp(r.removedAt))+' by '+E(r.removedBy||'')+(r.removeReason?' – '+E(r.removeReason):'')+'</div>':'')+'</td>'+
  '<td class="nw">'+(r.removed?'':'<button class="small sec" data-act="cfopen" data-id="'+E(r.id)+'">'+(/XLSX?|CSV/.test(cfExt(r))?'Download':'View')+'</button>'+(office?' <button class="small sec cf-rm" data-act="cfrm" data-id="'+E(r.id)+'">Remove</button>':''))+'</td></tr>';}
function cfTable(L,office,id){return '<div class="tw"><table class="cf-table" id="'+id+'"><tr><th>Type</th><th>Period</th><th>Invoice #</th><th class="r">Amount</th><th>File</th><th></th></tr>'+L.map(function(r){return cfRow(r,office);}).join('')+'</table></div>';}
function cfForm(firm){var t=T(),m=t.slice(0,8)+'01';
  return '<form data-form="cfadd" class="cf-form" id="cfform"><input type="hidden" name="firmId" value="'+E(firm.id)+'"><div class="grid2">'+
   '<div><label for="cfkind">This file is</label><select name="kind" id="cfkind"><option value="invoice">An invoice</option><option value="timesheet">A timesheet</option></select></div>'+
   '<div><label for="cffile" class="req">File (PDF, picture or Excel)</label><input type="file" name="file" id="cffile" accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.xlsx,.xls,.csv,application/pdf,image/*" required></div>'+
   '<div><label for="cffrom" class="req">Period from</label><input type="date" name="from" id="cffrom" value="'+E(addDays(m,-1).slice(0,8)+'01')+'" required></div>'+
   '<div><label for="cfto" class="req">Period to</label><input type="date" name="to" id="cfto" value="'+E(addDays(m,-1))+'" required></div>'+
   '<div><label for="cfnum">Invoice # (optional)</label><input type="text" name="number" id="cfnum" maxlength="40" placeholder="e.g. USDC-TFA-004"></div>'+
   '<div><label for="cfamt">Amount incl. HST (optional)</label><input type="number" step="0.01" min="0" name="amount" id="cfamt" placeholder="$"></div></div>'+
   '<p class="small muted">Kept for your records and shown to this farm on its “My invoices” page. It does not change hours, billing or what is owing.</p><button class="small" id="cfsave">Upload</button></form>';}
function hubFiles(firm){if(LIVE()&&!CFG('clientFiles'))return '<div class="card" id="cfcard"><h3 style="margin-top:0">Past invoices &amp; timesheets</h3><p class="small muted">Switched on after migration 017b.</p></div>';
  var L=cfFor(firm.id,false),R=cfFor(firm.id,true).filter(function(r){return r.removed;}),U=allInv().filter(function(i){return i.firmId===firm.id&&i.uploaded;});
  return '<div class="card cf-card" id="cfcard"><h3 style="margin-top:0">Past invoices &amp; timesheets <span class="small muted">owner and this farm only</span></h3>'+
   (L.length?cfTable(L,true,'cflist'):'<p class="muted small" id="cflist">No files yet.</p>')+
   (U.length?'<p class="small muted cf-upl">Also on file: '+U.length+' uploaded past invoice'+(U.length===1?'':'s')+' ('+U.map(function(i){return E(i.number);}).join(', ')+') – see the invoices list above.</p>':'')+
   (R.length?'<details class="cf-rmlist"><summary>Removed ('+R.length+')</summary>'+cfTable(R,true,'cfremoved')+'</details>':'')+
   '<details class="cf-add" id="cfadd"'+(PAGE_STATE.cfOpen?' open':'')+'><summary><b>+ Upload an invoice or timesheet</b></summary>'+cfForm(firm)+'</details></div>';}
function farmFilesCard(){var L=cfMine();if(LIVE()&&!CFG('clientFiles'))return '';
  return '<div class="card cf-card" id="cffarm"><h2 style="margin-top:0">Past invoices &amp; timesheets</h2><p class="small muted">Files UnScramble keeps on record for you (made before or outside this app). Tap to view or download.</p>'+
   (L.length?cfTable(L,false,'cffarmlist'):'<p class="muted small" id="cffarmlist">None yet.</p>')+'</div>';}
FORMS.cfadd=function(f,d){if(ownerOnly())return;var firm=user(d.firmId),inp=f&&f.querySelector('input[type=file]'),file=inp&&inp.files&&inp.files[0];
  if(!firm||firm.type!=='firm'){toast('Farm not found.');return;}if(!file){toast('Choose a file.');return;}
  if(!(CF_TYPES.test(file.type||'')||CF_EXT.test(file.name||''))){toast('Please choose a PDF, a picture or an Excel file.');return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.from||'')||!/^\d{4}-\d{2}-\d{2}$/.test(d.to||'')){toast('Enter the period (from and to).');return;}
  if(d.to<d.from){toast('"To" must be on or after "From".');return;}if(d.from>T()){toast('The period can\'t start in the future.');return;}
  var amt=d.amount===''||d.amount==null?null:R2(d.amount);if(amt!=null&&!(amt>=0)){toast('Enter an amount of 0 or more, or leave it empty.');return;}
  var kind=d.kind==='timesheet'?'timesheet':'invoice',row={id:uid('cf'),firmId:firm.id,kind:kind,from:d.from,to:d.to,number:String(d.number||'').trim().slice(0,40),amount:amt,at:nowIso(),by:ME.name,byId:ME.id,removed:false};
  var dupe=row.number&&cfFor(firm.id,false).some(function(r){return r.number&&r.number.replace(/\s+/g,'').toUpperCase()===row.number.replace(/\s+/g,'').toUpperCase();});
  var done=function(){audit('Past invoice / timesheet file uploaded',firm.name,cfKind(row)+' '+row.from+' – '+row.to+(row.number?' · '+row.number:'')+(amt!=null?' · '+money(amt):'')+' · '+row.file.name);PAGE_STATE.cfOpen=false;save();toast(cfKind(row)+' uploaded'+(dupe?' (note: that invoice # was already on file)':'')+'.');render();};
  if(LIVE()){var sb=window.REG_SB,bucket=(window.REG_STORE&&window.REG_STORE.bucket)||'reg-docs',nm=String(file.name).replace(/[^A-Za-z0-9._-]+/g,'_').slice(-60)||'file',path=firm.id+'/'+row.id+'-'+Math.random().toString(36).slice(2,8)+'-'+nm;
    toast('Uploading…');sb.storage.from(bucket).upload(path,file,{contentType:file.type||'application/octet-stream',upsert:false}).then(function(up){if(up.error)throw up.error;
      row.file={name:file.name,type:file.type||'',size:file.size,data:'sb:'+path};var data=Object.assign({},row);delete data.id;  /* data.firmId -> client_id (a0_derive) */
      return sb.from('reg_client_files').insert({id:row.id,client_id:firm.id,data:data});}).then(function(r){if(r&&r.error)throw r.error;CF.at=0;CF.rows=(CF.rows||[]).concat([row]);done();},function(e){toast('Upload failed: '+((e&&e.message)||'please try again'));});return;}
  readUpload(file,function(fl){if(!fl){toast('Could not read that file.');return;}row.file={name:fl.name,type:fl.type,size:file.size,data:fl.data};(DB.clientFiles=DB.clientFiles||[]).push(row);done();});};
ACT.cfopen=function(el){var r=cfById(el.dataset.id);if(!r||r.removed){toast('Not found.');return;}
  if(ME.type==='admin'){if(ownerOnly())return;}else if(!(isFirm()&&(LIVE()||r.firmId===ME.id||r.firmId===ME.loginOf))){toast('Not allowed – you can only see your own files.');return;}
  var d=String(r.file&&r.file.data||''),open=function(u){if(!u){toast('Could not open the file.');return;}var a=document.createElement('a');a.href=u;a.download=r.file.name||'file';a.target='_blank';document.body.appendChild(a);a.click();setTimeout(function(){a.remove();},200);};
  audit('Past invoice / timesheet file opened',(user(r.firmId)||{}).name||'',cfKind(r)+' '+(r.file&&r.file.name||''));save();
  if(d.indexOf('data:')===0){open(dataToBlobUrl(d));return;}if(d&&typeof window.REG_FILE_BLOB==='function'){window.REG_FILE_BLOB(d).then(open,function(){open('');});return;}open('');};
ACT.cfrm=function(el){if(ownerOnly())return;var r=cfById(el.dataset.id);if(!r||r.removed)return;
  modal('<h2>Remove this '+cfKind(r).toLowerCase()+'?</h2><p>'+E(r.file&&r.file.name||'')+' · '+E(r.from)+' – '+E(r.to)+(r.number?' · '+E(r.number):'')+'</p><p class="small">The farm will no longer see it. It is kept (with who removed it and when) in case it was removed by mistake, and the removal is written to the audit log.</p>'+
   '<form data-form="cfrmok" id="cfrmform"><input type="hidden" name="id" value="'+E(r.id)+'"><label for="cfrmwhy">Reason (optional)</label><input type="text" name="why" id="cfrmwhy" maxlength="200" placeholder="e.g. wrong farm"><div class="row-end"><button type="button" class="sec" data-act="closeModal">Cancel</button><button id="cfrmgo" class="danger">Yes, remove</button></div></form>');};
FORMS.cfrmok=function(f,d){if(ownerOnly())return;var r=cfById(d.id);if(!r||r.removed)return;var why=String(d.why||'').trim().slice(0,200),at=nowIso();
  var fin=function(){r.removed=true;r.removedAt=at;r.removedBy=ME.name;r.removedById=ME.id;r.removeReason=why;audit('Past invoice / timesheet file removed',(user(r.firmId)||{}).name||'',cfKind(r)+' '+r.from+' – '+r.to+' · '+(r.file&&r.file.name||'')+(why?' · reason: '+why:''));save();closeModal();toast('Removed.');render();};
  if(LIVE()){var data=Object.assign({},r,{removed:true,removedAt:at,removedBy:ME.name,removedById:ME.id,removeReason:why});delete data.id;
    window.REG_SB.from('reg_client_files').update({data:data}).eq('id',r.id).select('id').then(function(x){if(x.error||!(x.data||[]).length){toast('Could not remove: '+((x.error&&x.error.message)||'not allowed'));return;}fin();});return;}
  fin();};
ACT.cfaddopen=function(){PAGE_STATE.cfOpen=true;render();var e=document.getElementById('cfadd');if(e){e.open=true;e.scrollIntoView({block:'start'});}};
ADMIN_ONLY_ACT.push('cfrm','cfaddopen');ADMIN_ONLY_FORM.push('cfadd','cfrmok');

/* ================= 2. farm hub on the farm's person page (owner only) ================= */
function ppFirm(){var s=PAGE_STATE.pp,u=s&&user(s.id);return u&&u.type==='firm'&&(s.tab||'details')==='details'?u:null;}
function hubLinks(firm){var codes=(DB.sites||[]).filter(function(s){return s.firmId===firm.id;}).map(function(s){return s.code;});
  return '<div class="card ir-hub" id="farmhub"><h3 style="margin-top:0">Farm hub <span class="small muted">owner only</span></h3><div class="row ir-hublinks">'+
   '<button class="small" data-act="pptab" data-tab="view">👁 See their page</button>'+
   '<a class="btn small sec" href="#/firms" data-hub="rates">Rates &amp; signed agreement</a>'+
   '<button class="small sec" data-act="farmbilling" data-id="'+E(firm.id)+'">Billing by day</button>'+
   '<a class="btn small sec" href="#/creworders" data-hub="orders">Crew orders</a>'+
   '<a class="btn small sec" href="#/clients" data-hub="codes">Codes &amp; logins</a>'+
   '<a class="btn small sec" href="#/headcount" data-hub="headcount">Daily headcount</a>'+
   '<button class="small sec" data-act="cfaddopen">+ Upload invoice / timesheet</button></div>'+
   '<p class="small muted">Farm code'+(codes.length===1?'':'s')+': <b>'+E(codes.join(', ')||'–')+'</b></p></div>';}
function hubInvoices(firm){var x=clientInvoicesHtml(firm,true);
  /* the create form: this farm only; the past-invoice upload lives on the Invoices page */
  x=x.replace(/<select name="firmId" aria-label="Client">[\s\S]*?<\/select>/,'<input type="hidden" name="firmId" value="'+E(firm.id)+'">');
  x=x.replace(/<div class="card[^"]*" id="pastinv[^"]*"[\s\S]*$/,'');
  x=x.replace('<th>Client</th>','').replace(/(<tr data-inv="[^"]*"[^>]*>)<td>[^<]*<\/td>/g,'$1');  /* one farm: no Client column */
  return x.replace('id="clientinvoices"','id="clientinvoices" data-hub="invoices"').replace('<h2 style="margin-top:0">Client invoices</h2>','<h2 style="margin-top:0">Invoices – '+E(firm.name)+'</h2>');}
function hubMin(firm){var s=PAGE_STATE.pp;if(!s.mwTo){s.mwTo=T();s.mwFrom=addDays(T(),-6);}var R=firmReport(firm,s.mwFrom,s.mwTo),c=CB(),D=R.rows.filter(function(r){return r.n;}).reverse();
  return '<div class="card ir-min" id="hubmin"><h3 style="margin-top:0">'+c.minHours+'-hour daily minimum</h3><p class="small muted">Waive the minimum for this farm on one day (confirm + audit log, can be undone). Same control as Farm billing by day.</p>'+
   '<form data-form="hubmin" class="row pp-dates"><label class="small">From <input type="date" name="from" value="'+E(s.mwFrom)+'"></label><label class="small">To <input type="date" name="to" value="'+E(s.mwTo)+'"></label><button class="small">Show</button></form>'+
   (D.length?'<div class="tw desk-only"><table class="no-stack ir-mintab"><tr><th>Day</th><th class="r">Workers</th><th class="r">Hours worked</th><th class="r">Minimum added</th><th class="r">Billable</th><th>'+c.minHours+'-hour minimum</th></tr>'+
     D.map(function(r){return '<tr data-date="'+r.date+'" class="'+(r.waived?'mw-waived':'')+'"><td class="nw">'+shortDay(r.date)+'</td><td class="r">'+r.n+'</td><td class="r">'+r.hours.toFixed(2)+'</td><td class="r">'+(r.topUp>0?r.topUp.toFixed(2):'–')+'</td><td class="r"><b>'+r.bill.toFixed(2)+'</b></td><td>'+mwCtl(firm,r)+'</td></tr>';}).join('')+'</table></div>'+
     '<div class="phone-only ir-mindays">'+D.map(function(r){return '<div class="daycard mw-card'+(r.waived?' mw-waived':'')+'" data-date="'+r.date+'"><div class="dc-head"><b>'+shortDay(r.date)+'</b><span class="small">'+r.n+' worker'+(r.n===1?'':'s')+' · '+r.hours.toFixed(2)+' h · '+(r.topUp>0?'+'+r.topUp.toFixed(2)+' h minimum':'no minimum added')+' · billable '+r.bill.toFixed(2)+' h</span></div>'+mwCtl(firm,r)+'</div>';}).join('')+'</div>'
   :'<p class="muted small">No hours at this farm in these dates.</p>')+'</div>';}
FORMS.hubmin=function(f,d){var s=PAGE_STATE.pp;if(!s)return;if(d.from&&d.to&&d.from>d.to){toast('"From" must be before "To".');return;}s.mwFrom=d.from||s.mwFrom;s.mwTo=d.to||s.mwTo;render();};
ADMIN_ONLY_FORM.push('hubmin');
if(VIEWS['admin:people']){var opp=VIEWS['admin:people'];VIEWS['admin:people']=function(){var x=opp.apply(this,arguments);try{var firm=ppFirm();if(!firm||!owner())return x;
  var hub=hubLinks(firm)+hubInvoices(firm)+hubFiles(firm)+(typeof mwCtl==='function'?hubMin(firm):'');
  var re=/<div class="card"><h3>Invoices \(\d+\) <span class="small muted">owner only<\/span><\/h3>[\s\S]*?<\/div>/;
  x=re.test(x)?x.replace(re,hub):x.replace('<h3>Full record</h3>',hub+'<h3>Full record</h3>');}catch(e){try{console.warn('[invrevise hub]',e);}catch(z){}}return x;};}

/* ================= mock data: one farm with an issued invoice + a shift found later ================= */
function seed(){if(LIVE()||!DB||!DB.users||DB.irSeed)return;var F=DB.users.filter(function(u){return u.username==='firmA';})[0];if(!F||typeof firmReport!=='function')return;
  var by=function(n){return DB.users.filter(function(u){return u.username===n;})[0];},w1=by('worker1'),w2=by('worker2'),w4=by('worker4');if(!w1||!w2||!w4)return;
  var from='2026-09-01',to='2026-09-30';DB.irSeed=1;
  ['2026-09-08','2026-09-09','2026-09-10'].forEach(function(d){[w1,w2].forEach(function(w){DB.time.push({id:uid('t'),userId:w.id,site:'TFA-01',date:d,'in':'07:00',out:'15:30',test:false,clock:true});});});
  var S=snap(F,from,to),c=CB();
  DB.clientInvoices=DB.clientInvoices||[];DB.clientInvoices.push({id:'ci_ir1_sep',firmId:F.id,number:(typeof invNextNumber==='function'?invNextNumber(F):'UC-IR1-001'),periodStart:from,periodEnd:to,billHours:S.R.tot.bill,amount:S.R.tot.amount,hst:S.R.tot.hst,total:S.R.tot.total,
    issued:'2026-10-02',due:'2026-11-01',interestPct:c.interestPct,paidAt:'',lines:S.lines,minTopUpHours:S.R.tot.topUp||0,minWaivedDays:[]});
  /* found later: Dana worked Sep 9 too (paper timesheet found Oct 16) – entered by the office after the invoice went out */
  DB.time.push({id:'t_ir1_late',userId:w4.id,site:'TFA-01',date:'2026-09-09','in':'07:00',out:'15:00',test:false,manual:true,officeEntry:true,manualAt:'2026-10-16T14:05:00.000Z',addedAt:'2026-10-16T14:05:00.000Z',manualReason:'Paper timesheet found Oct 16'});
  /* two past files on record */
  DB.clientFiles=DB.clientFiles||[];
  var pdf='data:application/pdf;base64,'+btoa('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
  DB.clientFiles.push({id:'cf_ir1_a',firmId:F.id,kind:'invoice',from:'2026-05-01',to:'2026-05-31',number:'USDC-TFA-000',amount:2817.5,at:'2026-10-15T13:00:00.000Z',by:'Office Tester',removed:false,file:{name:'USDC-TFA-000-May-2026.pdf',type:'application/pdf',size:420,data:pdf}});
  DB.clientFiles.push({id:'cf_ir1_b',firmId:F.id,kind:'timesheet',from:'2026-05-01',to:'2026-05-31',number:'',amount:null,at:'2026-10-15T13:02:00.000Z',by:'Office Tester',removed:false,file:{name:'TFA-May-2026-timesheet.pdf',type:'application/pdf',size:420,data:pdf}});
  save();}
(function(){var ol=load;load=function(){ol.apply(this,arguments);try{seed();}catch(e){try{console.warn('[invrevise seed]',e);}catch(z){}}};})();
try{if(typeof DB!=='undefined'&&DB&&DB.users)seed();}catch(e){}
})();
