/* v2-orderform.js – UnScramble orderform1 (Oct 6 2026). Loaded right after v2-orders.js. TEST COPY until the owner OKs it.
   Owner, Oct 6 2026 11:18 PM ET: "change the ordering form to have a recurring option no last day mandatory as they choose number of
   workers they get as many boxes below with quantity next to them, when they choose the workers job and increase quantity the boxes
   keep getting lesser and final crew comes up also see that they have option to add the site address merge google maps".
   Farm / client "Order a crew" form (and its Change box):
   - "How long?" One-time | Recurring. Start date required, Last day OPTIONAL for both (one-time: blank = one day, up to 31 days;
     recurring: Mon–Sun picks, blank = ongoing until the farm cancels or the office stops it).
   - "How many workers?" N → N boxes, each = job + quantity. Raising a box's quantity to q covers q workers, so the boxes shrink
     (boxes = N – extra quantity). Total never goes over N; lowering a quantity brings boxes back. Picking a job another box already
     has adds to that box. Live "Your crew: 3 Graders, 2 Packers, 1 Truck driver = 6 workers" + "X still need a job"; Send only when all
     N have a job. Job list = the existing orderRoleList() (agreed-rate jobs), most-ordered first.
   - Site address (optional, prefilled from the site or the last order for that site) + Google Maps preview with NO API key
     (google.com/maps?q=…&output=embed iframe) + "Open in Google Maps" link + optional "Use my current location" (lat,lng).
   Storage: no database change. Everything rides in the existing crew order record (reg_crew_orders.data JSON): fields gain
   crew:[{role,qty}], sched:{kind:'once'|'weekly',from,until,days}, addr, lat, lng. `workers` = N and `role` = the biggest line, so
   older screens, the office booking and the server guard keep working. One order record per request (a recurring order is ONE
   standing order; its "date" is the next work day).
   Office: crew lines, schedule and address with map link on every order card; Adjust uses the same crew boxes.
   Employees never see these records (RLS: own farm + office only); bookings made from an order carry no farm name or address.
   Owner, Oct 7 2026 12:34–12:35 AM ET: farm "Cancel all orders" (danger, confirm dialog) for every open/pending order of that farm only
   (same cancel-request path as a single Cancel; recurring = cancel that standing order so no more work days); and a clear
   "Select location on Google Maps" button (opens Maps to pick/search), pastable Maps share links / lat,lng, map preview, Use my location. */
'use strict';
var OF_SHORT={labour:['General labourer','General labourers'],grader:['Grader','Graders'],packer:['Packer','Packers'],forklift:['Forklift / bin piler','Forklift / bin pilers'],
  binpiler:['Bin piler','Bin pilers'],driver:['Truck driver','Truck drivers'],construction:['Construction labourer','Construction labourers'],baker:['Baker','Bakers'],
  painting:['Painter','Painters'],cleaner:['Cleaner','Cleaners']};
var OF_ADJ=null,OF_DRAWING=false;   /* OF_DRAWING: removing a focused box fires blur/change – ignore those */
function ofClone(x){return x==null?x:JSON.parse(JSON.stringify(x));}
function ofRoleWord(firm,k,n){var s=OF_SHORT[k];return s?s[n===1?0:1]:orderRoleName(firm,k);}
function ofCrewOf(f){if(!f)return [];if(f.crew&&f.crew.length)return f.crew;return f.role&&+f.workers?[{role:f.role,qty:+f.workers}]:[];}
function ofCrewSum(c){return (c||[]).reduce(function(a,x){return a+(+x.qty||0);},0);}
function ofMainRole(c){var b=null;(c||[]).forEach(function(x){if(x.role&&(!b||+x.qty>+b.qty))b=x;});return b?b.role:'';}
function ofCrewText(firm,c){var g=[];(c||[]).forEach(function(x){if(!x.role)return;var e=g.filter(function(y){return y.role===x.role;})[0];if(e)e.qty+=+x.qty;else g.push({role:x.role,qty:+x.qty});});
  return g.map(function(x){return x.qty+' '+ofRoleWord(firm,x.role,x.qty);}).join(', ');}
function ofCrewLine(firm,f){var c=ofCrewOf(f),n=+f.workers||ofCrewSum(c);return ofCrewText(firm,c)+' = '+n+' worker'+(n===1?'':'s');}
/* job list: the existing agreed-rate list, the jobs this farm orders most first, then the usual order */
function ofRoles(firm){var l=orderRoleList(firm),cnt={};
  crewOrders().forEach(function(o){if(o.kind||!firm||o.firmId!==firm.id)return;var f=o.cur||o.req;ofCrewOf(f).forEach(function(x){cnt[x.role]=(cnt[x.role]||0)+(+x.qty||0);});});
  return l.map(function(r,i){return {r:r,i:i};}).sort(function(a,b){return (b.r.ok-a.r.ok)||((cnt[b.r.key]||0)-(cnt[a.r.key]||0))||(a.i-b.i);}).map(function(x){return x.r;});}

/* ---------- schedule ---------- */
function ofSched(f){var s=f&&f.sched;return s&&s.from&&(s.kind==='weekly'||(s.kind==='once'&&s.until&&s.until>s.from))?s:null;}   // multi-day only
function ofOn(s,d){if(d<s.from||(s.until&&d>s.until))return false;return s.kind!=='weekly'||(s.days||[]).map(Number).indexOf(parseD(d).getDay())>=0;}
function ofNextDay(s,from){var d=from>s.from?from:s.from;for(var i=0;i<400;i++,d=addDays(d,1)){if(s.until&&d>s.until)return null;if(ofOn(s,d))return d;}return null;}
function ofNextOcc(s,start,afterMs){var d=today()>s.from?today():s.from;for(var i=0;i<400;i++,d=addDays(d,1)){if(s.until&&d>s.until)return null;if(ofOn(s,d)&&hmMsLocal(d,start||'00:00')>afterMs)return d;}return null;}
function ofLastOcc(s){if(!s.until)return null;for(var d=s.until,i=0;d>=s.from&&i<400;d=addDays(d,-1),i++)if(ofOn(s,d))return d;return null;}
function ofDaysWord(days){days=(days||[]).map(Number);return days.length===7?'every day':'every '+ordDaysLabel(days);}
function ofSchedKey(f){var s=f&&f.sched;if(!s||!s.from||(s.kind!=='weekly'&&!(s.until&&s.until>s.from)))return 'one';return s.kind==='weekly'?'w|'+(s.days||[]).map(Number).sort().join()+'|'+s.from+'|'+(s.until||''):'o|'+s.from+'|'+s.until;}   /* 'one' = a single day (the Date line shows it) */
function ofSchedText(f,who){var s=f&&f.sched;if(!s||!s.from)return 'One-time · '+shortDay(f.date);
  if(s.kind==='weekly')return 'Recurring · '+ofDaysWord(s.days)+' · from '+shortDay(s.from)+(s.until?' to '+shortDay(s.until):' · no last day (ongoing until '+(who==='office'?'the farm cancels or the office stops it':'you cancel')+')');
  return 'One-time · '+shortDay(s.from)+(s.until&&s.until>s.from?' – '+shortDay(s.until)+' (every day, '+(daysBetween(s.from,s.until)+1)+' days)':'');}

/* ---------- address / Google Maps (no API key) ---------- */
function ofMapQ(f){var a=String((f&&f.addr)||'').trim();if(a)return a;return f&&f.lat!=null&&f.lng!=null&&f.lat!==''?f.lat+','+f.lng:'';}
function ofEmbedUrl(q){return 'https://www.google.com/maps?q='+encodeURIComponent(q)+'&output=embed';}
function ofOpenUrl(q){return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q);}
function ofPickUrl(q){return q?ofOpenUrl(q):'https://www.google.com/maps';}   /* open Maps blank so they can search / drop a pin, then paste the link back */
function ofSiteAddr(firm,code){var s=(DB.sites||[]).filter(function(x){return x.code===code;})[0];if(s&&(s.address||s.addr||s.siteAddress))return s.address||s.addr||s.siteAddress;
  var last=null;ordersOf(firm).forEach(function(o){var f=o.cur||o.req;if(f&&f.site===code&&f.addr&&(!last||String(o.createdAt||'')>=last.t))last={t:String(o.createdAt||''),a:f.addr};});return last?last.a:'';}
/* Accept a typed address, "lat, lng", or a Google Maps share / search / place / @lat,lng link (no API). Returns {addr,lat,lng,q} or null. */
function ofParseLoc(raw){raw=String(raw||'').replace(/\s+/g,' ').trim();if(!raw)return null;
  var m=raw.match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
  if(m){var la=+m[1],ln=+m[2];if(Math.abs(la)<=90&&Math.abs(ln)<=180)return {addr:la+', '+ln,lat:Math.round(la*1e6)/1e6,lng:Math.round(ln*1e6)/1e6,q:la+','+ln};}
  var u=null;try{if(/^https?:\/\//i.test(raw)||/^maps\.app\.goo\.gl\//i.test(raw)||/^goo\.gl\/maps\//i.test(raw))u=new URL(/^https?:/i.test(raw)?raw:'https://'+raw);}catch(e){}
  if(u&&/(google\.[^/]*\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(u.host+u.pathname+u.search)){
    var at=u.pathname.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/),q=u.searchParams.get('q')||u.searchParams.get('query')||u.searchParams.get('destination')||'';
    if(!q){var pq=u.pathname.match(/\/(?:place|search)\/([^/@]+)/);if(pq)try{q=decodeURIComponent(pq[1].replace(/\+/g,' '));}catch(e){q=pq[1].replace(/\+/g,' ');}}
    if(!at)at=String(u.href).match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)||raw.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
    if(at){la=+at[1];ln=+at[2];return {addr:(q&&!/^-?\d/.test(q)?q:la+', '+ln).slice(0,300),lat:Math.round(la*1e6)/1e6,lng:Math.round(ln*1e6)/1e6,q:q||(la+','+ln)};}
    if(q){var c=ofParseLoc(q);if(c&&c.lat!=null)return c;return {addr:String(q).slice(0,300),lat:null,lng:null,q:String(q)};}
    return {addr:raw.slice(0,300),lat:null,lng:null,q:raw};}
  return {addr:raw.slice(0,300),lat:null,lng:null,q:raw};}

/* ---------- form pieces (shared by the order form, the Change box and the office Adjust box) ---------- */
function ofRoleOpts(firm,cur){return ofRoles(firm).map(function(r){return '<option value="'+esc(r.key)+'"'+(r.ok?'':' disabled')+(r.key===cur?' selected':'')+'>'+esc(r.label)+(r.ok?'':' – no agreed rate, ask the office')+'</option>';}).join('');}
function ofRowsHtml(firm,lines){var free=lines.filter(function(x){return !x.role;}).length;
  return lines.map(function(x,i){var em=!x.role,q=+x.qty||1;
    return '<div class="of-row'+(em?' of-empty':'')+'" data-i="'+i+'"><span class="of-num" aria-hidden="true">'+(i+1)+'</span>'+
      '<select name="crole[]" class="of-job" aria-label="Job for box '+(i+1)+'"><option value="">– choose job –</option>'+ofRoleOpts(firm,x.role)+'</select>'+
      '<div class="of-qty" role="group" aria-label="How many for box '+(i+1)+'"><button type="button" class="of-step" data-of="qminus" aria-label="One fewer"'+(em||q<=1?' disabled':'')+'>−</button>'+
      '<input type="number" name="cqty[]" class="of-q" value="'+q+'" min="1" max="'+(q+free)+'" step="1" inputmode="numeric"'+(em?' readonly tabindex="-1"':'')+' aria-label="Workers for box '+(i+1)+'">'+
      '<button type="button" class="of-step" data-of="qplus" aria-label="One more"'+(em||!free?' disabled':'')+'>+</button></div></div>';}).join('');}
function ofLinesFor(f){var n=+f.workers||0,l=ofClone(ofCrewOf(f)).filter(function(x){return x.role&&+x.qty>0;}),s=ofCrewSum(l);while(s<n){l.push({role:'',qty:1});s++;}return l;}
function ofCrewBlock(firm,f,o){o=o||{};var lines=ofLinesFor(f),n=+f.workers||'';
  return '<div class="of-crew" data-of="crew"><label class="req" for="'+(o.id||'ofn')+'">How many workers?</label>'+
    '<div class="of-nrow"><button type="button" class="of-step of-big" data-of="nminus" aria-label="One less worker">−</button>'+
    '<input id="'+(o.id||'ofn')+'" type="number" name="workers" class="of-n" value="'+n+'" min="1" max="'+ORDER_MAX_WORKERS+'" step="1" inputmode="numeric" placeholder="0"'+(o.office?'':' required')+'>'+
    '<button type="button" class="of-step of-big" data-of="nplus" aria-label="One more worker">+</button></div>'+
    '<input type="hidden" name="role" value="'+esc(ofMainRole(lines))+'">'+
    '<div class="of-help small"'+(lines.length?'':' hidden')+'>Pick a job in each box. Same job for several workers? Raise the number next to it – the boxes below get fewer.</div>'+
    '<div class="of-rows">'+ofRowsHtml(firm,lines)+'</div><div class="of-sum" aria-live="polite"></div></div>';}
function ofSchedBlock(f,o){o=o||{};var s=f.sched||{kind:'once',from:f.date,until:'',days:[]},rec=s.kind==='weekly',days=rec?(s.days||[]).map(Number):[1,2,3,4,5],min=o.edit?'':' min="'+today()+'"';
  return '<div class="of-schedwrap"><fieldset class="ordlen of-type"'+(o.edit?'':' id="ordlen"')+'><legend>How long?</legend><div class="ordlen-opts">'+
    '<label class="ordlen-opt"><input type="radio" name="otype" value="once"'+(rec?'':' checked')+'> <span>One-time</span></label>'+
    '<label class="ordlen-opt"><input type="radio" name="otype" value="recurring"'+(rec?' checked':'')+'> <span>Recurring <small>(repeats every week)</small></span></label></div></fieldset>'+
    '<div class="grid2 of-dates"><div><label class="req">Start date</label><input type="date" name="date" value="'+esc(s.from||f.date||'')+'" required'+min+'></div>'+
    '<div><label>Last day <small class="of-opt">(optional)</small></label><input type="date" name="lastday" value="'+esc(s.until||'')+'"'+min+'><div class="hint of-lasthint"></div></div></div>'+
    '<div class="ordrep of-rec"'+(rec?'':' hidden')+'><label>Repeat on</label><div class="daypick">'+WEEKDAYS.map(function(w){return '<label class="inline"><input type="checkbox" name="odays[]" value="'+w[0]+'"'+(days.indexOf(w[0])>=0?' checked':'')+'> '+w[1]+'</label>';}).join('')+'</div></div>'+
    '<div class="ordcount of-schedline" aria-live="polite"></div></div>';}
function ofAddrBlock(f,o){o=o||{};var q=ofMapQ(f);
  return '<div class="of-addr" data-of="addr"><label for="'+(o.id||'ofaddr')+'">Site address <small class="of-opt">(optional – helps the crew find you)</small></label>'+
    '<input id="'+(o.id||'ofaddr')+'" type="text" name="addr" class="of-addrin" value="'+esc(f.addr||'')+'" maxlength="500" autocomplete="street-address" placeholder="Type an address, paste a Google Maps link, or lat,lng">'+
    '<input type="hidden" name="lat" value="'+esc(f.lat==null?'':f.lat)+'"><input type="hidden" name="lng" value="'+esc(f.lng==null?'':f.lng)+'">'+
    '<div class="of-addrbtns">'+
      '<a class="btn of-pickmap" target="_blank" rel="noopener" data-of="pickmap" href="'+esc(ofPickUrl(q))+'" id="'+(o.id||'ofaddr')+'-pick">🗺 Select location on Google Maps</a>'+
      '<button type="button" class="sec of-geo" data-of="geo">📍 Use my current location</button>'+
      '<a class="of-maplink" target="_blank" rel="noopener" href="'+(q?esc(ofOpenUrl(q)):'#')+'"'+(q?'':' hidden')+'>Open in Google Maps ↗</a></div>'+
    '<div class="of-pickhint small muted">Opens Google Maps so you can search or drop a pin. Then paste the Maps link (or the address) back into the box above – the preview updates. No paid map key.</div>'+
    '<div class="of-geomsg small" aria-live="polite"></div>'+
    '<div class="of-map"'+(q?'':' hidden')+'><iframe class="of-iframe" title="Map preview of the site address" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="'+(q?esc(ofEmbedUrl(q)):'about:blank')+'"></iframe></div></div>';}

/* ---------- client: the order form ---------- */
orderForm=function(firm){var sites=DB.sites.filter(function(s){return s.firmId===firm.id;}),first=addDays(today(),1),site1=sites.length===1?sites[0].code:'';
  var f={date:first,workers:'',crew:[],sched:{kind:'once',from:first,until:'',days:[]},addr:site1?ofSiteAddr(firm,site1):''};
  return '<div class="card hl of-form" id="orderform"><form data-form="crewOrder" class="of-f">'+(sites.length===1?'<input type="hidden" name="site" value="'+esc(sites[0].code)+'"><p class="small muted">Site: <b>'+esc(siteName(sites[0].code))+'</b></p>':'')+
  (sites.length>1?'<div class="of-site">'+sel('site','Site',sites.map(function(s){return [s.code,s.code+' – '+s.name];}),'',{req:true,blank:true})+'</div>':'')+
  ofSchedBlock(f)+'<div class="grid2">'+qSel('start','Start time','07:00',{req:true})+'</div>'+ofCrewBlock(firm,f)+ofAddrBlock(f)+
  '<details class="more"><summary>More options</summary><div class="grid2">'+
  qSel('end','Finish time (optional)','',{blank:'– not set –',hint:'Earlier than the start = next day (overnight), max '+MAX_SHIFT_H+' h.'})+
  inp('hours','…or hours (optional)','',{type:'number',extra:' min="0.25" max="16" step="0.25"'})+
  '<div><label>Safety gear (PPE) supplied by:</label><select name="ppe"><option value="">Not sure – office will confirm</option>'+GEAR_OPTS.map(function(g){return '<option value="'+g+'">'+esc(gearLabel(g,firm))+'</option>';}).join('')+'</select></div></div>'+
  '<label>Note (optional)</label><textarea name="note" placeholder="e.g. meet at the packing shed"></textarea></details>'+
  ordReplyBox('ordreplyform')+'<p><button type="submit" class="big" id="ordsend">Send order</button></p><p class="small muted">Changes less than '+orderCutoffH()+' hours before the start may be charged per your agreement.</p></form></div>';};

/* ---------- fields, checks, differences (wrap v2-orders.js; old one-role orders read as one crew line) ---------- */
(function(){
  var _ff=ordFieldsFrom;ordFieldsFrom=function(d,base){base=base||{};var f=_ff(d,base);
    if(d.crole!==undefined){var rs=[].concat(d.crole),qs=[].concat(d.cqty||[]),crew=[],open=0;
      rs.forEach(function(r,i){var q=Math.max(1,Math.floor(+qs[i]||1));if(!r){open+=q;return;}var e=crew.filter(function(c){return c.role===r;})[0];if(e)e.qty+=q;else crew.push({role:String(r),qty:q});});
      f.crew=crew;open=Math.max(open,(+f.workers||0)-ofCrewSum(crew));Object.defineProperty(f,'_open',{value:open,enumerable:false,configurable:true});if(crew.length)f.role=ofMainRole(crew);}
    else if(base.crew&&base.crew.length&&+f.workers===+base.workers&&f.role===base.role)f.crew=ofClone(base.crew);
    else if(f.role&&+f.workers)f.crew=[{role:f.role,qty:+f.workers}];
    if(d.otype){var rec=d.otype==='recurring';f.sched={kind:rec?'weekly':'once',from:d.date||'',until:d.lastday||'',days:rec?[].concat(d.odays||[]).map(Number):[]};
      f.date=d.date||f.date;if(rec&&d.date){var fo=ofNextOcc(f.sched,f.start,nowMsApp());if(fo)f.date=fo;}}
    else if(base.sched)f.sched=ofClone(base.sched);
    if(d.addr!==undefined){var loc=ofParseLoc(d.addr)||{addr:'',lat:null,lng:null};f.addr=loc.addr||'';
      var la=parseFloat(d.lat),ln=parseFloat(d.lng),ok=isFinite(la)&&isFinite(ln)&&Math.abs(la)<=90&&Math.abs(ln)<=180&&String(d.lat).trim()!=='';
      if(ok){f.lat=Math.round(la*1e6)/1e6;f.lng=Math.round(ln*1e6)/1e6;}else if(loc.lat!=null){f.lat=loc.lat;f.lng=loc.lng;}else{f.lat=null;f.lng=null;}}
    else['addr','lat','lng'].forEach(function(k){if(base[k]!==undefined)f[k]=base[k];});
    return f;};
  var _oc=ordCheck;ordCheck=function(firm,f,o){o=o||{};
    if(o.office&&OF_ADJ){var t=OF_ADJ.fields||{};
      if(!f.sched&&t.sched){f.sched=ofClone(t.sched);if(f.date!==t.date){f.sched.from=f.date;if(f.sched.until&&f.sched.until<f.date)f.sched.until='';}
        if(f.sched.kind==='weekly'){var fo=ofNextOcc(f.sched,f.start,nowMsApp());if(fo)f.date=fo;}}
      ['addr','lat','lng'].forEach(function(k){if(f[k]===undefined&&t[k]!==undefined)f[k]=t[k];});
      if(OF_ADJ.crew){f.crew=OF_ADJ.crew;Object.defineProperty(f,'_open',{value:OF_ADJ.open,enumerable:false,configurable:true});if(f.crew.length)f.role=ofMainRole(f.crew);}
      else if(!f.crew)f.crew=t.crew&&+f.workers===+t.workers&&f.role===t.role?ofClone(t.crew):(f.role&&+f.workers?[{role:f.role,qty:+f.workers}]:[]);}
    var s=f.sched;
    if(s){if(!s.from)return 'Please pick the start date.';
      if(s.until&&s.until<s.from)return 'The last day must be on or after the start date (or leave it blank).';
      if(s.kind==='once'&&s.until&&daysBetween(s.from,s.until)>ORDER_MAX_DAYS-1)return 'A one-time order can run up to '+ORDER_MAX_DAYS+' days (last day '+shortDay(addDays(s.from,ORDER_MAX_DAYS-1))+'). For longer, choose Recurring.';
      if(s.kind==='weekly'&&!(s.days||[]).length)return 'Please pick at least one day of the week.';
      if(s.kind==='weekly'&&!ofNextOcc(s,f.start,o.office?-Infinity:nowMsApp()))return 'None of the picked days fall between '+shortDay(s.from)+' and '+shortDay(s.until||s.from)+'. Pick other days or a later last day.';}
    if(f.crew){var open=f._open||0,n=+f.workers||0,sum=ofCrewSum(f.crew);
      if(n>=1&&(open>0||sum<n))return 'Please choose a job for every worker: '+(open||n-sum)+' of '+n+' still need'+((open||n-sum)===1?'s':'')+' a job.';
      if(n>=1&&sum>n)return 'The quantities add up to '+sum+' but you asked for '+n+' workers.';
      for(var i=0;i<f.crew.length;i++)if(!roleOk(firm,f.crew[i].role))return 'That job ('+orderRoleName(firm,f.crew[i].role)+') has no agreed rate yet – ask the office to add it to your Rate Schedule.';
      if(f.crew.length)f.role=ofMainRole(f.crew);}
    return _oc(firm,f,o);};
  /* multi-day orders: start = next work day (so they can still be changed / cancelled while they run), list date = next work day */
  var _sm=ordStartMs;ordStartMs=function(f){var s=ofSched(f);if(s){var n=ofNextOcc(s,f.start,nowMsApp());if(n)return hmMsLocal(n,f.start);var l=ofLastOcc(s);if(l)return hmMsLocal(l,f.start);}return _sm(f);};
  var _ov=ordView;ordView=function(o){var f=_ov(o),s=ofSched(f);if(s&&f.date<today()){var n=ofNextDay(s,today());if(n&&n!==f.date)f=Object.assign({},f,{date:n});}return f;};
  var _od=ordDiff;ordDiff=function(a,b,firm){var out=_od(a,b,firm);if(!a||!b)return out;
    var ka=ofSchedKey(a),kb=ofSchedKey(b);if(ka!==kb)out.push(['Schedule',esc(ofSchedText(a)),esc(ofSchedText(b))]);
    if(ka!=='one'&&kb!=='one')out=out.filter(function(x){return x[0]!=='Date';});   /* multi-day: the next work day moves by itself */
    var ca=ofCrewText(firm,ofCrewOf(a)),cb=ofCrewText(firm,ofCrewOf(b));if(ca!==cb){out=out.filter(function(x){return x[0]!=='Role';});out.push(['Crew',esc(ca||'–'),esc(cb||'–')]);}
    if((a.addr||'')!==(b.addr||'')||String(a.lat==null?'':a.lat)!==String(b.lat==null?'':b.lat))out.push(['Site address',esc(a.addr||(a.lat!=null?a.lat+','+a.lng:'–')),esc(b.addr||(b.lat!=null?b.lat+','+b.lng:'–'))]);
    return out;};
})();

/* ---------- client: send (one order record; old cached forms without "otype" use the previous code) ---------- */
(function(){var _old=FORMS.crewOrder;FORMS.crewOrder=function(form,d){if(!d||!d.otype)return _old(form,d);var firm=ME,b=orderBlock(firm);if(b){toast(b.why+' '+b.fix);return;}
  var f=ordFieldsFrom(d),e=ordCheck(firm,f);if(e){toast(e);var sm=form&&form.querySelector('.of-sum');if(sm&&/job/.test(e))sm.classList.add('of-shake');return;}
  f=ofClone(f);var hb=hoursBefore(f),late=hb<orderCutoffH(),crew=ofCrewLine(firm,f),sch=ofSchedText(f);
  var o={id:uid('co'),no:nextOrderNo(),firmId:firm.id,firmName:firm.name,seriesId:null,createdAt:new Date().toISOString(),createdBy:ordActor(),req:f,cur:null,status:'Requested',pending:{kind:'new',fields:ofClone(f),late:late,hoursBefore:Math.round(hb*10)/10,at:new Date().toISOString(),by:ordActor()},decisions:[],history:[],shiftId:null};
  crewOrders().push(o);
  ordLog(o,'New order requested',f.site+' · '+sch+' · '+ordTime(f)+' · '+crew+' · PPE: '+gearLabel(f.ppe,firm)+(f.addr?' · address: '+f.addr:'')+(f.lat!=null?' · pin '+f.lat+','+f.lng:'')+(late?' · SHORT NOTICE (starts within '+orderCutoffH()+' h)':'')+(f.note?' · note: '+f.note:''));
  notify('admin','New crew order from '+firm.name+': '+o.no+' – '+crew+' at '+f.site+(f.addr?' ('+f.addr+')':'')+', '+sch+', start '+f.start+'. Confirm, decline or adjust in Crew orders.');
  notify(firm.id,'We got your crew order '+o.no+'. The office will confirm it.');
  PAGE_STATE.coForm=false;save();render();
  modal(clientWord('<h2 id="orderdone">Order sent ✓</h2><p>Thank you. We got your order:</p><p><b>'+esc(crew)+'</b><br>'+esc(sch)+' · start '+esc(f.start)+'<br>'+esc(siteName(f.site))+(f.addr?'<br>'+esc(f.addr):'')+'</p>'+ordReplyBox('ordreplydone',ordReplyWhen())+'<p>You can see it, change it or cancel it under "My crew orders".</p><p><button data-act="closeModal">OK</button></p>',firm));};})();

/* ---------- client: Change box with the same pieces ---------- */
ACT.coedit=function(el){var o=ordById(el.dataset.id);if(!o||o.firmId!==ME.id){toast('Not allowed.');return;}if(!ordCanChange(o)){toast(ORD_LOCKED);return;}
  var f=(o.pending&&o.pending.kind==='change'&&o.pending.fields)||o.cur||(o.pending&&o.pending.fields)||o.req,late=hoursBefore(o.cur||f)<orderCutoffH();
  modal(clientWord('<h2>Change order</h2><p class="small">'+esc(o.no)+' · '+esc(siteName(f.site))+'</p>'+(o.cur?'<p class="small">Confirmed now: <b>'+esc(ofSchedText(o.cur))+' · '+ordTime(o.cur)+' · '+esc(ofCrewLine(ME,o.cur))+'</b>. This stays until the office says yes to your change.</p>':'')+
  (late?'<div class="alert warn small latewarn"><b>Late change:</b> this starts in less than '+orderCutoffH()+' hours. You can still change it, but late changes may be charged per your agreement.</div>':'')+
  '<form data-form="crewOrderEdit" class="of-f of-edit"><input type="hidden" name="id" value="'+o.id+'">'+ofSchedBlock(f,{edit:true})+'<div class="grid2">'+qSel('start','Start time',f.start,{req:true})+'</div>'+ofCrewBlock(ME,f,{id:'ofn-e'})+ofAddrBlock(f,{id:'ofaddr-e'})+
  '<details class="more"><summary>More options</summary><div class="grid2">'+qSel('end','Finish time (optional)',f.end||'',{blank:'– not set –',hint:'Earlier than the start = next day.'})+inp('hours','…or hours (optional)',f.hours&&!f.end?f.hours:'',{type:'number',extra:' min="0.25" max="16" step="0.25"'})+'</div><label>Note (optional)</label><textarea name="note">'+esc(f.note||'')+'</textarea></details><p><button>Send change</button></p></form>',ME));
  };

/* ---------- cards: crew lines, schedule, address + map (farm's own view and office) ---------- */
function ofDetail(o,firm,who){var f=ordView(o);if(!f)return '';var q=ofMapQ(f),c=ofCrewOf(f);
  return '<div class="of-detail">'+(c.length?'<div class="of-dl of-dcrew"><span>Crew</span><b>'+esc(ofCrewLine(firm,f))+'</b></div>':'')+
    (f.sched?'<div class="of-dl of-dsched"><span>Schedule</span>'+esc(ofSchedText(f,who))+(ofSched(f)?' <small class="muted">· next work day '+esc(shortDay(f.date))+'</small>':'')+'</div>':'')+
    (q?'<div class="of-dl of-daddr"><span>Site address</span>'+esc(f.addr||'Pin only')+(f.lat!=null&&f.addr?' <small class="muted">(pin '+esc(f.lat+','+f.lng)+')</small>':f.lat!=null?' <small class="muted">'+esc(f.lat+','+f.lng)+'</small>':'')+
      ' <a class="of-maplink" target="_blank" rel="noopener" href="'+esc(ofOpenUrl(q))+'">Open in Google Maps ↗</a>'+
      (who==='office'?'<details class="of-mapd"><summary>Show map</summary><div class="of-map"><iframe class="of-iframe" title="Map of the site address" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="'+esc(ofEmbedUrl(q))+'"></iframe></div></details>':'')+'</div>':'')+'</div>';}
(function(){
  var _cc=ordCardClient;ordCardClient=function(o,firm){var x=_cc(o,firm),f=ordView(o);if(!f||!(f.crew||f.sched||f.addr))return x;
    var old='<b>'+f.workers+' × '+esc(orderRoleName(firm,f.role))+'</b>';x=x.replace(old,'<b>'+esc(ofCrewLine(firm,f))+'</b>');
    var i=x.indexOf('<div class="oc-line">');if(i<0)return x;var j=x.indexOf('</div>',i)+6;return x.slice(0,j)+ofDetail(o,firm,'farm')+x.slice(j);};
  var _co=ordCardOffice;ordCardOffice=function(o){var x=_co(o),firm=user(o.firmId),f=ordView(o);if(!f)return x;
    if(f.crew&&f.crew.length)x=x.replace(/<div><span>Role<\/span>[^<]*<\/div>/,'<div><span>Job(s)</span>'+esc(ofCrewText(firm,f.crew))+'</div>');
    var i=x.indexOf('<div class="oc-grid">');if(i>=0&&(f.crew||f.sched||f.addr)){var j=x.indexOf('</div></div>',i);if(j>0){j+=12;x=x.slice(0,j)+ofDetail(o,firm,'office')+x.slice(j);}}
    var p=o.pending;if(p&&p.kind!=='cancel'){var t=p.fields,wi=inp('workers','Workers',t.workers,{type:'number',extra:' min="1" step="1"'}),rs=roleSelect(firm,t.role);
      if(x.indexOf(wi)>=0&&x.indexOf(rs)>=0){x=x.replace(wi,'').replace(rs,'');x=x.replace('<div class="grid2 adj">','<div class="grid2 adj">').replace(/(<div class="grid2 adj">[\s\S]*?<\/div>)(<\/details>)/,function(m,a,b2){return a+ofCrewBlock(firm,t,{id:'ofn-'+o.id,office:true})+b2;});}}
    if(o.cur&&!p&&o.status==='Confirmed'&&!ordShift(o)&&ofSched(o.cur))x=x.replace('<form data-form="cobook"','<p class="small of-booknote">Multi-day order ('+esc(ofSchedText(o.cur,'office'))+'): this button books one work day ('+esc(shortDay(o.cur.date))+'). Book the other days in Shifts.</p><form data-form="cobook"');
    return x;};
  var _cd=ACT.codec;ACT.codec=function(el){var o=ordById(el.dataset.id),form=el.closest('form');OF_ADJ=null;
    if(o&&o.pending&&form){OF_ADJ={fields:o.pending.fields};var cb=form.querySelector('.of-crew');if(cb){var d=fd(form);var rs=[].concat(d.crole||[]),qs=[].concat(d.cqty||[]),crew=[],open=0;
      rs.forEach(function(r,i){var q=Math.max(1,Math.floor(+qs[i]||1));if(!r){open+=q;return;}var e=crew.filter(function(c){return c.role===r;})[0];if(e)e.qty+=q;else crew.push({role:r,qty:q});});
      OF_ADJ.crew=crew;OF_ADJ.open=Math.max(open,(+d.workers||0)-ofCrewSum(crew));}}
    try{return _cd(el);}finally{OF_ADJ=null;}};
  var _bk=FORMS.cobook;FORMS.cobook=function(f,d){var o=ordById(d.id),had=o&&o.shiftId;var r=_bk(f,d);
    if(o&&!had&&o.shiftId){var s=ordShift(o),firm=user(o.firmId);if(s&&o.cur&&o.cur.crew&&o.cur.crew.length>1){s.title='Crew order '+o.no+' – '+ofCrewText(firm,o.cur.crew);s.orderCrew=ofClone(o.cur.crew);save();render();}}
    return r;};
})();

/* ---------- live behaviour (event delegation; works in the page form, the Change box and the office Adjust box) ---------- */
function ofFirmFor(form){if(ME&&ME.type==='firm')return ME;var c=form.closest('.ordcard');var o=c&&ordById(c.dataset.id);return o?user(o.firmId):ME;}
function ofRead(cb){var n=parseInt(cb.querySelector('.of-n').value,10);n=isFinite(n)&&n>0?Math.min(n,ORDER_MAX_WORKERS):0;
  var lines=[].map.call(cb.querySelectorAll('.of-row'),function(r){var role=r.querySelector('.of-job').value,q=parseInt(r.querySelector('.of-q').value,10);return {role:role,qty:role?(q>0?q:1):1};});return {n:n,lines:lines};}
function ofFit(st,firm){var l=st.lines,sum=ofCrewSum(l),ok=ofRoles(firm).filter(function(r){return r.ok;});
  if(ok.length===1&&st.n>0&&!l.some(function(x){return x.role&&x.role!==ok[0].key;})){st.lines=[{role:ok[0].key,qty:st.n}];return st;}
  while(sum<st.n){l.push({role:'',qty:1});sum++;}
  for(var i=l.length-1;i>=0&&sum>st.n;i--)if(!l[i].role){l.splice(i,1);sum--;}
  for(i=l.length-1;i>=0&&sum>st.n;i--){while(l[i].qty>1&&sum>st.n){l[i].qty--;sum--;}if(sum>st.n){l.splice(i,1);sum--;}}
  return st;}
function ofDraw(cb,st,firm){var rows=cb.querySelector('.of-rows'),filled=st.lines.filter(function(x){return x.role;}),empty=st.lines.filter(function(x){return !x.role;});
  st.lines=filled.concat(empty);OF_DRAWING=true;try{rows.innerHTML=ofRowsHtml(firm,st.lines);}finally{OF_DRAWING=false;}var nIn=cb.querySelector('.of-n');if(document.activeElement!==nIn||+nIn.value!==st.n)nIn.value=st.n||'';
  cb.querySelector('input[name=role]').value=ofMainRole(st.lines);var h=cb.querySelector('.of-help');if(h)h.hidden=!st.lines.length;ofSummary(cb,st,firm);}
function ofSummary(cb,st,firm){var sm=cb.querySelector('.of-sum'),open=st.lines.filter(function(x){return !x.role;}).length,txt=ofCrewText(firm,st.lines),sum=ofCrewSum(st.lines.filter(function(x){return x.role;}));
  sm.classList.remove('of-shake');
  if(!st.n){sm.className='of-sum of-sum-empty';sm.innerHTML='Enter how many workers you need – a box appears for each one.';}
  else if(open){sm.className='of-sum of-sum-warn';sm.innerHTML='<div class="of-sumline">Your crew: '+(txt?esc(txt)+' = '+sum+' of '+st.n+' workers':'no jobs picked yet ('+st.n+' worker'+(st.n===1?'':'s')+')')+'</div><div class="of-open">⚠ '+open+' worker'+(open===1?' still needs':'s still need')+' a job – pick one in the box'+(open===1?'':'es')+' above.</div>';}
  else{sm.className='of-sum of-sum-ok';sm.innerHTML='<div class="of-sumline">✓ Your crew: <b>'+esc(txt)+'</b> = '+st.n+' worker'+(st.n===1?'':'s')+'</div>';}
  var form=cb.closest('form'),btn=form&&form.querySelector('#ordsend, button:not([type=button]):not(.of-step)');
  if(btn&&form.dataset.form==='crewOrder'){var block=!st.n||open>0;btn.disabled=block;btn.setAttribute('aria-disabled',block?'true':'false');btn.title=block?(st.n?'Pick a job for every worker first':'Enter how many workers first'):'';}}
function ofCrewEvent(cb,act,row,val){if(OF_DRAWING||!cb)return;var firm=ofFirmFor(cb),st=ofRead(cb),l=st.lines;
  if(act==='n'){if(st.n===val&&ofCrewSum(l)===val)return;st.n=Math.max(0,Math.min(ORDER_MAX_WORKERS,val));}
  else if(act==='nminus')st.n=Math.max(0,st.n-1);else if(act==='nplus')st.n=Math.min(ORDER_MAX_WORKERS,st.n+1);
  else if(act==='qty'||act==='qplus'||act==='qminus'){var x=l[row];if(!x||!x.role){ofDraw(cb,ofFit(st,firm),firm);return;}var free=l.filter(function(y){return !y.role;}).length;
    var qi=cb.querySelectorAll('.of-row')[row].querySelector('.of-q'),cur=parseInt(qi.defaultValue,10)||1;var want=act==='qplus'?cur+1:act==='qminus'?cur-1:val;
    want=Math.max(1,Math.min(cur+free,isFinite(want)?Math.floor(want):cur));if(act==='qty'&&val>cur+free){setTimeout(function(){toast('That is more than the '+st.n+' workers you asked for. Raise "How many workers?" first.');},0);}
    var dlt=want-cur;x.qty=want;if(dlt>0){for(var k=l.length-1;k>=0&&dlt>0;k--)if(!l[k].role){l.splice(k,1);dlt--;}}else for(;dlt<0;dlt++)l.push({role:'',qty:1});}
  else if(act==='role'){var y=l[row];if(y){var other=val?l.filter(function(z,i){return i!==row&&z.role===val;})[0]:null;if(other){other.qty+=y.role?y.qty:1;l.splice(row,1);}else{if(!val&&y.qty>1){for(var e=1;e<y.qty;e++)l.push({role:'',qty:1});y.qty=1;}y.role=val;}}}
  ofDraw(cb,ofFit(st,firm),firm);}
function ofSchedUpdate(form){var w=form.querySelector('.of-schedwrap');if(!w)return;var r=form.querySelector('input[name=otype]:checked'),rec=!!r&&r.value==='recurring';
  var box=w.querySelector('.of-rec'),hint=w.querySelector('.of-lasthint'),out=w.querySelector('.of-schedline'),d=form.date.value,ld=form.lastday;
  if(box)box.hidden=!rec;if(d)ld.min=d;
  if(hint)hint.textContent=rec?'Leave blank to keep it going until you cancel.':'Leave blank for a one-day job. Up to '+ORDER_MAX_DAYS+' days.';
  var days=[].map.call(form.querySelectorAll('input[name="odays[]"]:checked'),function(c){return +c.value;}),f={date:d,start:form.start?form.start.value:'07:00',sched:{kind:rec?'weekly':'once',from:d,until:ld.value,days:rec?days:[]}};
  var err=!d?'Pick the start date.':ld.value&&ld.value<d?'The last day must be on or after the start date (or leave it blank).':rec&&!days.length?'Pick at least one day of the week.':(!rec&&ld.value&&daysBetween(d,ld.value)>ORDER_MAX_DAYS-1)?'A one-time order can run up to '+ORDER_MAX_DAYS+' days. For longer, choose Recurring.':'';
  if(!err&&rec){var fo=ofNextOcc(f.sched,f.start,nowMsApp());if(!fo)err='None of the picked days fall in those dates. Pick other days or a later last day.';else f.date=fo;}
  if(out){out.className='ordcount of-schedline'+(err?' bad':'');out.textContent=err||(ofSchedText(f)+(rec?' · first work day '+shortDay(f.date):''));}}
var OF_T=null,OF_NT=null;
function ofAddrUpdate(box,now){var ai=box.querySelector('.of-addrin'),latEl=box.querySelector('input[name=lat]'),lngEl=box.querySelector('input[name=lng]');
  var loc=ofParseLoc(ai.value),f={addr:loc?loc.addr:'',lat:latEl.value||null,lng:lngEl.value||null};
  if(loc&&loc.lat!=null&&!box.dataset.geoKeep){latEl.value=loc.lat;lngEl.value=loc.lng;f.lat=loc.lat;f.lng=loc.lng;}
  if(now&&loc&&loc.addr&&ai.value!==loc.addr&&(/^https?:/i.test(ai.value.trim())||/maps\.app\.goo\.gl|goo\.gl\/maps|@-?\d/i.test(ai.value))){ai.value=loc.addr;f.addr=loc.addr;}
  var q=ofMapQ(Object.assign({},f,{addr:ai.value})),map=box.querySelector('.of-map'),fr=box.querySelector('.of-iframe'),a=box.querySelector('.of-maplink'),pick=box.querySelector('.of-pickmap');
  var go=function(){if(pick)pick.href=ofPickUrl(q);if(q){var u=ofEmbedUrl(q);if(fr.getAttribute('src')!==u)fr.setAttribute('src',u);map.hidden=false;a.href=ofOpenUrl(q);a.hidden=false;}else{map.hidden=true;a.hidden=true;a.href='#';}};
  clearTimeout(OF_T);if(now)go();else OF_T=setTimeout(go,900);}
function ofRefresh(form){ofSchedUpdate(form);var cb=form.querySelector('.of-crew');if(cb){var firm=ofFirmFor(cb),st=ofRead(cb);ofDraw(cb,ofFit(st,firm),firm);}}
document.addEventListener('click',function(e){var b=e.target&&e.target.closest&&e.target.closest('[data-of]');if(!b)return;var a=b.dataset.of;if(b.tagName!=='BUTTON'&&a!=='pickmap')return;
  if(a==='geo'){e.preventDefault();var box=b.closest('.of-addr'),msg=box.querySelector('.of-geomsg');
    if(!navigator.geolocation){msg.textContent='Your browser can\'t share a location – please type the address.';return;}
    msg.textContent='Finding your location…';navigator.geolocation.getCurrentPosition(function(p){var la=Math.round(p.coords.latitude*1e6)/1e6,ln=Math.round(p.coords.longitude*1e6)/1e6;
      box.dataset.geoKeep='1';box.querySelector('input[name=lat]').value=la;box.querySelector('input[name=lng]').value=ln;var ai=box.querySelector('.of-addrin');if(!ai.value.trim())ai.value=la+', '+ln;
      msg.textContent='Location added ('+la+', '+ln+(p.coords.accuracy?', about '+Math.round(p.coords.accuracy)+' m':'')+'). You can still type the address or select a place on Google Maps.';ofAddrUpdate(box,true);delete box.dataset.geoKeep;},
      function(){msg.textContent='Couldn\'t get your location – please type the address or tap Select location on Google Maps.';},{enableHighAccuracy:true,timeout:15000,maximumAge:60000});return;}
  if(a==='pickmap'){var box=b.closest('.of-addr');if(box){var ai=box.querySelector('.of-addrin');b.href=ofPickUrl(ofMapQ({addr:ai.value,lat:box.querySelector('input[name=lat]').value,lng:box.querySelector('input[name=lng]').value}));
    var msg=box.querySelector('.of-geomsg');msg.textContent='After you pick a place in Google Maps, copy the link (Share → Copy link) and paste it into the address box.';}return;}
  var cb=b.closest('.of-crew');if(!cb)return;e.preventDefault();var row=b.closest('.of-row');ofCrewEvent(cb,a,row?+row.dataset.i:-1);});
document.addEventListener('input',function(e){var t=e.target;if(!t||!t.closest)return;
  if(t.classList.contains('of-n')){var cb=t.closest('.of-crew'),v=parseInt(t.value,10);clearTimeout(OF_NT);if(!(v>0))return;   /* typing "12" must not first cut the boxes to 1 */
    OF_NT=setTimeout(function(){if(document.body.contains(t))ofCrewEvent(cb,'n',-1,parseInt(t.value,10)||0);},450);return;}
  if(t.classList.contains('of-addrin')){var box=t.closest('.of-addr');box.dataset.touched='1';delete box.dataset.geoKeep;box.querySelector('input[name=lat]').value='';box.querySelector('input[name=lng]').value='';ofAddrUpdate(box,false);return;}
  var f=t.closest('form.of-f');if(f&&(t.name==='otype'||t.name==='date'||t.name==='lastday'||t.name==='odays[]'))ofSchedUpdate(f);});
document.addEventListener('change',function(e){var t=e.target;if(!t||!t.closest)return;
  if(t.classList.contains('of-job')){var row=t.closest('.of-row');ofCrewEvent(t.closest('.of-crew'),'role',+row.dataset.i,t.value);return;}
  if(t.classList.contains('of-n')){clearTimeout(OF_NT);var c0=t.closest('.of-crew'),s0=ofRead(c0);if(s0.n&&s0.n===ofCrewSum(s0.lines))return;ofCrewEvent(c0,'n',-1,parseInt(t.value,10)||0);return;}
  if(t.classList.contains('of-q')){var r2=t.closest('.of-row');ofCrewEvent(t.closest('.of-crew'),'qty',+r2.dataset.i,parseInt(t.value,10));return;}
  var f=t.closest('form.of-f');if(!f)return;
  if(t.name==='site'&&f.dataset.form==='crewOrder'){var box=f.querySelector('.of-addr');if(box&&!box.dataset.touched){var a=ofSiteAddr(ME,t.value);box.querySelector('.of-addrin').value=a||'';ofAddrUpdate(box,true);}}
  if(['otype','date','lastday','odays[]','start'].indexOf(t.name)>=0)ofSchedUpdate(f);});
document.addEventListener('focusout',function(e){var t=e.target;if(t&&t.classList&&t.classList.contains('of-addrin'))ofAddrUpdate(t.closest('.of-addr'),true);});
/* first paint of a freshly rendered form (page or modal; every render replaces the form) */
(function(){var oa=afterRender;afterRender=function(root){oa(root);try{var r=root||document;
  [].forEach.call(r.querySelectorAll('form.of-f'),function(f){if(!f.dataset.ofInit){f.dataset.ofInit='1';ofRefresh(f);}});
  [].forEach.call(r.querySelectorAll('.ordcard.office .of-crew'),function(cb){if(!cb.dataset.ofInit){cb.dataset.ofInit='1';var firm=ofFirmFor(cb);ofDraw(cb,ofFit(ofRead(cb),firm),firm);}});}catch(e){if(typeof logError==='function')logError(e);}};})();

/* ---------- farm: Cancel all open / pending orders (owner Oct 7 2026 12:34 AM ET) ---------- */
function ofCancelable(firm){return ordersOf(firm).filter(function(o){if(o.kind==='crewPlan')return false;var st=ordStatus(o);if(st==='Filled'||st==='Declined'||st==='Cancelled')return false;if(o.pending&&o.pending.kind==='cancel')return false;return !!ordCanChange(o);});}
function ofCancelOne(o,firm,bulk){var base=o.cur||ordView(o),hb=hoursBefore(base),late=hb<orderCutoffH();
  o.restore={status:o.status,pending:o.pending?JSON.parse(JSON.stringify(o.pending)):null};
  o.pending={kind:'cancel',fields:base,prev:o.cur,late:late,hoursBefore:Math.round(hb*10)/10,reason:bulk?'Cancel all open orders': '',at:new Date().toISOString(),by:ordActor()};o.status='Changed - awaiting office';
  /* recurring / multi-day: one standing order – cancelling it stops every future work day (no more auto-orders) */
  ordLog(o,'Cancellation requested'+(bulk?' (cancel all)':'')+(late?' (LATE CHANGE – less than '+orderCutoffH()+' h before the start)':''),bulk?'Cancel all open orders':(ofSched(base)?'Stops this recurring / multi-day schedule.':''));
  return {o:o,late:late,base:base};}
ACT.cocancelall=function(){var firm=ME;if(!firm||firm.type!=='firm'){toast('Not allowed.');return;}
  var list=ofCancelable(firm);if(!list.length){toast('You have no open crew orders to cancel.');return;}
  var rec=list.filter(function(o){return ofSched(ordView(o));}).length;
  modal(clientWord('<h2>Cancel all open crew orders?</h2><p>Cancel all open crew orders? The office will be notified.</p>'+
    '<p class="small">This sends a cancellation for <b>'+list.length+'</b> open order'+(list.length===1?'':'s')+(rec?' (including '+rec+' recurring / multi-day – those schedules stop)':'')+'. Single Cancel on each order still works. The office confirms; nothing is deleted.</p>'+
    '<form data-form="crewOrderCancelAll"><p><button class="danger big">Yes, cancel all open orders</button> <button type="button" class="sec" data-act="closeModal">No, keep them</button></p></form>',firm));};
FORMS.crewOrderCancelAll=function(){var firm=ME;if(!firm||firm.type!=='firm'){toast('Not allowed.');audit('Blocked cancel-all (not a farm)',firm&&firm.name);save();return;}
  var list=ofCancelable(firm);if(!list.length){closeModal();toast('You have no open crew orders to cancel.');render();return;}
  var lateN=0,nos=[];list.forEach(function(o){var r=ofCancelOne(o,firm,true);if(r.late)lateN++;nos.push(o.no);});
  notify('admin','CANCEL ALL – '+firm.name+' asked to cancel '+list.length+' open crew order'+(list.length===1?'':'s')+': '+nos.join(', ')+'. Confirm or decline each in Crew orders.');
  notify(firm.id,'We got your request to cancel '+list.length+' open crew order'+(list.length===1?'':'s')+' ('+nos.join(', ')+'). The office will confirm.');
  save();closeModal();toast(lateN?'Cancellation sent for '+list.length+' order'+(list.length===1?'':'s')+'. The office will confirm. '+(lateN===1?'One is':'Some are')+' a late change, so it may be charged per your agreement.':'Cancellation sent for '+list.length+' order'+(list.length===1?'':'s')+'. The office will confirm it.');render();};
(function(){var ov=VIEWS['firm:orders'];VIEWS['firm:orders']=function(){var x=ov(),firm=ME,n=ofCancelable(firm).length;
  if(!n)return x;
  var btn='<div class="of-cancelall" id="ofcancelall"><button type="button" class="danger of-cancelall-btn" data-act="cocancelall">Cancel all open orders ('+n+')</button>'+
    '<div class="small muted">Cancels every open / waiting crew order for your farm (including recurring). The office is notified and confirms. Past and already-cancelled orders stay in the list.</div></div>';
  return x.replace('<h2 id="myorders">My crew orders</h2>',btn+'<h2 id="myorders">My crew orders</h2>');};})();
ROLE_ONLY.cocancelall=['firm'];ROLE_ONLY.crewOrderCancelAll=['firm'];
