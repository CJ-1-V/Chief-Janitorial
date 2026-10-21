/* v2-bookings.js – crewone1 (Oct 21 2026, owner 4:20 AM "orders, Crew coming, confirm / cancel in sync, one page" + "also turn into booking").
   TEST COPY – not live. Loaded LAST. No schema change, no new SQL.
   1) One farm page "Bookings" (route #/orders kept so roles / links keep working): Crew coming (by day, tap a day to book or see
      that day's bookings) on top, then "Book crew", then one booking card per order (date, site, crew count, status:
      Requested / Confirmed / Changed / Cancelled) with the existing Change and Cancel actions (3 h direct-cut rule unchanged).
   2) Sync: Crew coming numbers now follow the bookings. For each day: confirmed bookings + requested ones (pending = amber).
      A cancel (once the office confirms it), a farm cut, or an office confirm / adjust shows right away. A number the office sets
      in Crew coming AFTER the last booking change for that day still wins (office override kept).
   3) Sync: a farm's direct cut on a booked shift now also updates the shift's "needed" count (it used to only tell the office).
   4) Farm wording: "Order crew" / "Order a crew" → "Book crew", "Crew orders" → "Bookings". Office side unchanged. */
(function(){'use strict';
if(typeof VIEWS==='undefined'||!VIEWS['firm:orders']||typeof fhDay!=='function')return;
var isFarm_=function(){return !!(ME&&ME.type==='firm');};
var onBook=function(){return /^#\/orders/.test(location.hash||'');};

/* ---------- 2) Crew coming follows the bookings ---------- */
function bkLast(o){var h=o.history||[],a=String(o.createdAt||'');h.forEach(function(x){if(String(x.at||'')>a)a=String(x.at);});(o.decisions||[]).forEach(function(x){if(String(x.at||'')>a)a=String(x.at);});return a;}
function bkDayFrom(firmId,date){var L=(typeof ordersOf==='function'?ordersOf({id:firmId}):[]),conf=0,req=0,jobs=[],touched=false,last='',nos=[];
  L.forEach(function(o){var dates=[o.cur&&o.cur.date,o.pending&&o.pending.fields&&o.pending.fields.date,o.req&&o.req.date];if(dates.indexOf(date)<0)return;
    touched=true;var la=bkLast(o);if(la>last)last=la;var st=o.status;if(st==='Declined'||st==='Cancelled')return;
    if(o.cur){if(o.cur.date!==date)return;conf+=+o.cur.workers||0;jobs=jobs.concat(fhCrewOf(o.cur));nos.push(o.no);if(o.pending)req+=0.0001;return;}
    var f=(o.pending&&o.pending.fields)||o.req;if(f&&f.date===date){req+=+f.workers||0;jobs=jobs.concat(fhCrewOf(f));nos.push(o.no);}});
  if(!touched)return null;var n=Math.round(conf+req);
  return {touched:true,last:last,val:n>0?{n:n,ok:req===0,jobs:(typeof fhCleanJobs==='function'?fhCleanJobs(jobs):jobs),note:'',by:'bookings',at:last,src:'bookings',nos:nos}:null};}
var plainDay=fhDay;
fhDay=function(firmId,date){var p=plainDay(firmId,date),b=bkDayFrom(firmId,date);if(!b)return p;
  if(p&&String(p.at||'')>b.last)return p;   /* office set this day after the last booking change → office wins */
  return b.val;};
window.bkDayFrom=bkDayFrom;

/* ---------- 3) direct cut also updates the booked shift ---------- */
(function(){var oe=FORMS.crewOrderEdit;FORMS.crewOrderEdit=function(f,d){var o=ordById(d&&d.id),before=o&&o.cur?JSON.stringify(o.cur):null;var r=oe.apply(this,arguments);
  try{if(o&&o.cur&&o.shiftId&&JSON.stringify(o.cur)!==before&&typeof syncOrderShift==='function'){syncOrderShift(o);save();}}catch(e){console.warn('bookings sync',e);}return r;};})();

/* ---------- 1) status words on the booking cards ---------- */
if(typeof ORDER_PLAIN==='object'){ORDER_PLAIN.Requested='Requested';ORDER_PLAIN.Confirmed='Confirmed';ORDER_PLAIN['Changed - awaiting office']='Changed – waiting for the office';ORDER_PLAIN.Cancelled='Cancelled';ORDER_PLAIN.Filled='Confirmed – all filled';}
var BK_KIND={Requested:'req',Confirmed:'ok',Filled:'ok','Changed - awaiting office':'chg',Cancelled:'can',Declined:'can'};
(function(){var oc=ordCardClient;ordCardClient=function(o,firm){var x=oc(o,firm),f=ordView(o)||{},st=ordStatus(o),k=BK_KIND[st]||'req';
  if(o.pending&&o.pending.kind==='cancel')k='chg';
  var site=(f.placeName||'')||(typeof siteName==='function'?siteName(f.site):f.site)||f.addr||'',n=+f.workers||0;
  var head='<div class="bk-sum"><span class="bk-date"><b>'+esc(String(parseD(f.date).getDate()))+'</b><small>'+esc(shortDay(f.date).split(' ')[0])+'</small></span>'+
    '<span class="bk-facts"><span class="bk-site">'+esc(site)+'</span><span class="bk-n"><b>'+n+'</b> '+(n===1?'worker':'workers')+'</span></span><span class="bk-st bk-'+k+'">'+esc(k==='req'?'Requested':k==='ok'?'Confirmed':k==='chg'?'Changed':'Cancelled')+'</span></div>';
  return x.replace('<div class="ordcard"','<div class="ordcard bkcard bk-c-'+k+'" data-date="'+esc(f.date||'')+'"').replace(/(<div class="ordcard[^>]*>)/,'$1'+head);};})();

/* ---------- 1) the one page ---------- */
(function(){var ov=VIEWS['firm:orders'];VIEWS['firm:orders']=function(){var x=ov();if(!isFarm_())return x;
  var cc='';try{cc=fhComingCard(ME).replace('id="fhcoming"','id="fhcoming" data-bk="1"');}catch(e){console.warn('bookings coming',e);}
  x=x.replace(/<h1>[^<]*<\/h1>/,'<h1 id="bkhd">Bookings</h1>'+cc);
  return x;};})();
if(typeof FH_TAB==='object'&&FH_TAB['#/orders'])FH_TAB['#/orders'][1]='Bookings';
(NAV.firm||[]).forEach(function(n){if(n[0]==='#/orders')n[1]='Bookings';});

/* Home: Crew coming + Book crew open the Bookings page; on Bookings, "Change crew" goes to the cards */
var ofs=ACT.fscoming;ACT.fscoming=function(){if(!onBook()){go('#/orders');setTimeout(function(){var l=document.getElementById('orderlist');if(l)l.scrollIntoView({block:'start'});},400);return;}
  var l=document.getElementById('orderlist');if(l){l.scrollIntoView({behavior:'smooth',block:'start'});return;}if(ofs)return ofs.apply(this,arguments);};
ACT.bkgo=function(){go('#/orders');};
ACT.bkday=function(el){var d=el.dataset.date;if(!d)return;var cards=[].slice.call(document.querySelectorAll('.bkcard:not(.bk-c-can)[data-date="'+d+'"]'));
  [].forEach.call(document.querySelectorAll('.bkcard.bk-hit'),function(c){c.classList.remove('bk-hit');});
  [].forEach.call(document.querySelectorAll('#fhcoming .fh-day'),function(b){b.classList.toggle('sel',b===el);});
  if(!cards.length){if(typeof ACT.hborderday==='function'&&d>=today()){PAGE_STATE.coForm=true;render();ACT.hborderday({dataset:{date:d}});}return;}
  cards.forEach(function(c){c.classList.add('bk-hit');var p=c.closest('details');if(p)p.open=true;});
  try{cards[0].scrollIntoView({behavior:'smooth',block:'center'});}catch(e){cards[0].scrollIntoView();}};

/* ---------- 4) farm wording ---------- */
var RW=[[/Order a crew/g,'Book crew'],[/Order crew/g,'Book crew'],[/order crews/g,'book crews'],[/Order more/g,'Book more'],[/My crew orders/g,'Your bookings'],[/Crew orders/g,'Bookings'],[/No upcoming crew orders/g,'No upcoming bookings'],[/Past and cancelled orders/g,'Past and cancelled bookings'],[/Send order/g,'Send booking'],[/Order sent/g,'Booking sent']];
function rw(s){RW.forEach(function(r){s=s.replace(r[0],r[1]);});return s;}
function relabel(root){if(!isFarm_()||!root||!root.querySelectorAll)return;var w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),t,L=[];while(t=w.nextNode())L.push(t);
  L.forEach(function(n){if(/rder|Crew orders/.test(n.nodeValue)){var v=rw(n.nodeValue);if(v!==n.nodeValue)n.nodeValue=v;}});
  [].forEach.call(root.querySelectorAll('[aria-label],[title]'),function(e){['aria-label','title'].forEach(function(a){var v=e.getAttribute(a);if(v&&/rder/.test(v))e.setAttribute(a,rw(v));});});}
var otoast=toast;toast=function(m){return otoast.apply(this,[isFarm_()&&typeof m==='string'?rw(m):m].concat([].slice.call(arguments,1)));};
var omodal=modal;modal=function(h){var r=omodal.apply(this,arguments);try{relabel(document.getElementById('modal'));}catch(e){}return r;};

/* ---------- render hooks ---------- */
function wire(root){if(!isFarm_())return;var m=document.querySelector('main');if(!m)return;
  var c=m.querySelector('#fhcoming');
  if(c){var sb=c.querySelector('.fh-ch .fh-sub');if(sb&&/set and confirmed/.test(sb.textContent))sb.textContent='From your bookings · confirmed by the UnScramble office';}
  if(c&&!onBook()&&!c.querySelector('#bkall')){var h=c.querySelector('.fh-ch');if(h)h.insertAdjacentHTML('beforeend','<button type="button" class="small sec bk-all" id="bkall" data-act="bkgo">See bookings</button>');}
  if(c&&onBook()){c.classList.add('bk-coming');var can=!(typeof orderBlock==='function'&&orderBlock(ME))&&!(window.frCan&&!frCan('order'));
    [].forEach.call(c.querySelectorAll('.fh-strip .fh-day'),function(b){var d=b.dataset.date;if(!d)return;var has=!!document.querySelector('.bkcard:not(.bk-c-can)[data-date="'+d+'"]');
      if(has||can){b.disabled=false;b.setAttribute('data-act','bkday');b.classList.add('hb-tap');if(!has){b.classList.add('hb-empty');if(!b.querySelector('.hb-plus'))b.insertAdjacentHTML('beforeend','<span class="hb-plus" aria-hidden="true">+</span>');b.setAttribute('aria-label','Book crew for '+shortDay(d));}}});
    var bar=c.querySelector('#fscc');if(bar)bar.remove();c.removeAttribute('data-fstap');}
  relabel(m);var tabs=document.querySelector('#fhtabs');if(tabs)relabel(tabs);}
var oar=afterRender;afterRender=function(root){oar(root);try{wire(root);}catch(e){console.warn('bookings',e);}};
})();
