/* v2-waitapprove.js – waitok1 (owner Oct 23 2026, 1:14 AM). TEST COPY. Remove the script tag in index.html to undo.
   Inline Approve / Reject on every hours row that is waiting for approval (farm-day page, All hours – #vshtable):
   - late / "added later" entries and subcontractor-added shifts (t.lateEntry==='pending') → the EXISTING FORMS.lateact
     (same permission as the Late entries page: office logins, incl. the Office Assistant whose role allows #/lateentries).
     Approve = "Counts" (lateEntry approved, audit + farm notice as today). Reject = reason required → not counted ("Late entry
     not approved"), audit + the person is told (existing). 
   - pending farm "ask to change hours" requests on that shift → the EXISTING ACT.fcdec (Approved = farm's proposed times,
     Rejected = reply note required). Owner/admin only, as on Farm changes.
   Remove stays. "Approve all waiting" approves every waiting row shown (that day on the farm-day page). */
(function(){
'use strict';
if(typeof VIEWS==='undefined'||typeof ACT==='undefined')return;
function E(s){return esc(s==null?'':String(s));}
function office(){return typeof ME!=='undefined'&&ME&&ME.type==='admin';}
function helper(){try{return typeof window.ohIs==='function'&&!!window.ohIs();}catch(e){return false;}}
function canLate(){return office()&&typeof FORMS.lateact==='function';}
function canChg(){return office()&&!helper()&&typeof ACT.fcdec==='function';}
function T(id){return (DB.time||[]).filter(function(x){return String(x.id)===String(id);})[0]||null;}
function pendChg(key){var c=typeof latestChange==='function'?latestChange(key):null;return c&&c.status==='Pending'?c:null;}
function waiting(tr){var k=tr.getAttribute('data-key')||'',t=/^t:/.test(k)?T(k.slice(2)):null,out=[];if(!t||t.removed||t.removedAt&&!t.restoredAt)return out;
  if(t.lateEntry==='pending'&&canLate())out.push({kind:'late',t:t});var c=pendChg(k);if(c&&canChg())out.push({kind:'chg',t:t,c:c});return out;}
function btns(w){return w.map(function(x){var a=x.kind==='late'?'data-wa-id="'+E(x.t.id)+'"':'data-wa-chg="'+E(x.c.id)+'"',lab=x.kind==='late'?'':' change';
  return '<div class="wa-btns" data-wa-kind="'+x.kind+'"><button type="button" class="small wa-ok" data-act="waok" '+a+'>Approve'+lab+'</button><button type="button" class="small sec wa-no" data-act="wano" '+a+'>Reject'+lab+'</button>'+(x.kind==='chg'?'<div class="small muted">Farm asked '+E((x.c.propStart||'?')+'–'+(x.c.propEnd||'?'))+'</div>':'')+'</div>';}).join('');}
function paint(){var tb=document.getElementById('vshtable');if(!tb)return;var n=0;
  [].forEach.call(tb.querySelectorAll('tr[data-key]'),function(tr){var w=waiting(tr);if(tr.offsetParent!==null&&tr.style.display!=='none')n+=w.filter(function(x){return x.kind==='late';}).length;var c=tr.cells[tr.cells.length-1];if(!c)return;
    var sig=w.map(function(x){return x.kind+(x.c?x.c.id:x.t.id);}).join(',');if(tr.getAttribute('data-wa')===sig)return;tr.setAttribute('data-wa',sig);
    [].forEach.call(c.querySelectorAll('.wa-btns'),function(b){b.remove();});if(w.length)c.insertAdjacentHTML('afterbegin',btns(w));});
  var tw=tb.closest('.tw')||tb,old=document.getElementById('waall');
  if(!n){if(old)old.remove();return;}
  var h='<div class="row wa-all" id="waall"><button type="button" class="small" data-act="waall">Approve all waiting ('+n+')</button><span class="small muted">Approves every “Waiting for approval” entry shown here (late / added-later / subcontractor-added). Farm change requests are decided one by one.</span></div>';
  if(old){if(old.getAttribute('data-n')!==String(n)){old.outerHTML=h;document.getElementById('waall').setAttribute('data-n',n);}}else{tw.insertAdjacentHTML('beforebegin',h);document.getElementById('waall').setAttribute('data-n',n);}}
function late(t,act,reason){var f=document.createElement('form');f.setAttribute('data-form','lateact');f.style.display='none';
  f.innerHTML='<input type="hidden" name="id"><input type="time" name="in"><input type="time" name="out"><input type="text" name="reason">';f.id.value=t.id;f['in'].value=t['in']||'';f.out.value=t.out||'';f.reason.value=reason||'';f._act=act;
  document.body.appendChild(f);try{FORMS.lateact(f,{id:t.id,act:act,reason:reason||'','in':t['in'],out:t.out});}finally{f.remove();}}
function chgForm(c,dec,note){var f=document.createElement('form');f.style.display='none';f.innerHTML='<input name="note"><input name="start"><input name="end">';f.note.value=note||'';f.start.value=c.propStart||c.origStart||'';f.end.value=c.propEnd||c.origEnd||'';
  if(c.propBreak!=null){f.insertAdjacentHTML('beforeend','<input name="brk">');f.brk.value=c.propBreak;}document.body.appendChild(f);var b=document.createElement('button');b.dataset.id=c.id;b.dataset.d=dec;f.appendChild(b);try{ACT.fcdec(b);}finally{f.remove();}}
ACT.waok=function(el){if(el.dataset.waId){var t=T(el.dataset.waId);if(t&&t.lateEntry==='pending'&&canLate())late(t,'approve','');return;}
  var c=(DB.changes||[]).filter(function(x){return x.id===el.dataset.waChg;})[0];if(c&&canChg())chgForm(c,'Approved','');};
ACT.wano=function(el){var id=el.dataset.waId||'',cid=el.dataset.waChg||'';
  modal('<h2>Reject'+(cid?' farm change':' this entry')+'</h2><p class="small">'+(cid?'The hours stay as they are. The farm sees your note.':'The hours stop counting (shown as “Late entry not approved”). The person is told, with your reason. It is in the Audit log.')+'</p><form data-form="warej"><input type="hidden" name="id" value="'+E(id)+'"><input type="hidden" name="cid" value="'+E(cid)+'"><label class="req" for="warsn">Reason</label><input type="text" id="warsn" name="reason" required maxlength="200" placeholder="e.g. not at this farm that day"><div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button class="danger">Reject</button></div></form>');};
FORMS.warej=function(f,d){var r=String(d.reason||'').trim();if(!r){toast('Write a reason.');return;}if(typeof closeModal==='function')closeModal();
  if(d.cid){var c=(DB.changes||[]).filter(function(x){return x.id===d.cid;})[0];if(c&&canChg())chgForm(c,'Rejected',r);return;}var t=T(d.id);if(t&&t.lateEntry==='pending'&&canLate())late(t,'reject',r);};
ACT.waall=function(){var tb=document.getElementById('vshtable');if(!tb||!canLate())return;var L=[];[].forEach.call(tb.querySelectorAll('tr[data-key^="t:"]'),function(tr){if(tr.offsetParent===null||tr.style.display==='none')return;waiting(tr).forEach(function(x){if(x.kind==='late')L.push(x.t);});});
  if(!L.length)return;if(!confirm('Approve all '+L.length+' waiting entr'+(L.length===1?'y':'ies')+' shown? Each one is logged in the Audit log.'))return;
  var tt=window.toast;window.toast=function(){};try{L.forEach(function(t){late(t,'approve','');});}finally{window.toast=tt;}audit('Approved all waiting entries',String(L.length),L.map(function(t){return t.site+' '+t.date;}).filter(function(v,i,a){return a.indexOf(v)===i;}).join(', '));save();toast('Approved '+L.length+' – they show “Counts”.');render();};
var busy=false;new MutationObserver(function(){if(busy)return;busy=true;setTimeout(function(){try{paint();}catch(e){try{console.warn('[waitapprove]',e);}catch(z){}}busy=false;},40);}).observe(document.documentElement,{childList:true,subtree:true});
var cs=document.createElement('style');cs.textContent='.wa-btns{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:6px}.wa-ok{background:#2e7d32;color:#fff}.wa-all{margin:8px 0;gap:8px;align-items:center}';document.head.appendChild(cs);
})();
