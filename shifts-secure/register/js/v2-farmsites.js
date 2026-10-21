/* v2-farmsites.js – farmsites1 (Oct 21 2026, owner 1:27 AM + 1:30 AM). TEST COPY – not live. Loaded after v2-farmroles.js.
   1) Saved sites: a farm keeps a few ordering locations (name, address, map pin, notes such as the gate or parking spot).
      Profile / Home → Sites (#/places). Owner + managers add / change / remove; supervisors only pick them when ordering.
      Free map: Leaflet (self-hosted in vendor/leaflet) + OpenStreetMap tiles; address search = OSM Nominatim (on button press only,
      no key). Every site also has "Open in Google Maps". Storage: DB.farmPlaces ↔ reg_farm_places (migration 026a, RLS own farm only).
   2) Order a crew / Change: saved sites as quick picks with a small map preview; picking fills the address + pin. One-off addresses
      still work. The order keeps placeId / placeName / placeNotes; the office sees the site name, notes, address and map link.
   3) Crew coming (Home): tap the card or "Change crew" → the upcoming orders → Change. On a CONFIRMED order, 3 h or more before
      the start: fewer workers, another saved site / address or a new note apply right away and the office is notified. More
      workers (total or any job), or a new date / time, always go to the office as a request (pending; office confirms or declines,
      the farm is notified). Inside 3 h nothing changes directly: the change is sent to the office as a (late) request.
      Server: 026a reg_orders_guard enforces the same 3 h / no-increase rule. Live switch: store-config farmSites:true AFTER 026a. */
(function(){'use strict';
if(typeof NAV==='undefined'||typeof VIEWS==='undefined')return;
if(window.REG_LIVE&&!(window.REG_STORE&&window.REG_STORE.farmSites))return;
var DIRECT_H=3,MAX_PLACES=20;
var FS_IC={pin:'<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  map:'<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/>',note:'<path d="M5 4h14v12l-4 4H5z"/><path d="M15 20v-4h4"/><path d="M8 9h8M8 13h5"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  ext:'<path d="M14 4h6v6"/><path d="M20 4 11 13"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
  trash:'<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>',people:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M17 14.6a5 5 0 0 1 4.5 5.4"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',bolt:'<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',send:'<path d="M21 3 10 14"/><path d="m21 3-7 18-4-7-7-4z"/>',
  phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  locate:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/>'};
function fsI(k,c){return '<svg class="fr-ic fs-ic'+(c?' '+c:'')+'" viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+(FS_IC[k]||'')+'</svg>';}
window.fsI=fsI;
/* ---------- who ---------- */
function fsLogin(){return (typeof clLoginOf==='function')?clLoginOf(ME):ME;}
function fsRole(){if(!ME||ME.type!=='firm')return null;if(window.REG_LIVE&&!(window.REG_STORE&&window.REG_STORE.farmRoles))return null;var l=fsLogin();return l&&/^(manager|supervisor)$/.test(l.farmRole||'')?l.farmRole:null;}
function fsClient(){if(!ME||ME.type!=='firm')return null;var l=fsLogin();return l&&l.loginOf?((typeof clResolve==='function'?clResolve(l.loginOf):null)||user(l.loginOf)||ME):ME;}
function fsCanManage(){return !!(ME&&ME.type==='firm'&&fsRole()!=='supervisor');}
function fsPlaces(firmId){return (DB.farmPlaces||[]).filter(function(p){return p&&p.firmId===firmId;}).sort(function(a,b){return String(a.name||'').localeCompare(String(b.name||''));});}
function fsPlace(id){return (DB.farmPlaces||[]).filter(function(p){return p&&p.id===id;})[0]||null;}
function fsQ(p){return p?(p.lat!=null&&p.lng!=null&&p.lat!==''?p.lat+','+p.lng:String(p.addr||'').trim()):'';}
function fsGmaps(p){var q=fsQ(p);return q?'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(q):'';}
window.fsGmaps=fsGmaps;
/* ---------- Leaflet (self-hosted) ---------- */
var FS_LQ=null,FS_LFAIL=false;
function fsLeaflet(cb){if(window.L&&window.L.map){cb(true);return;}if(FS_LFAIL){cb(false);return;}if(FS_LQ){FS_LQ.push(cb);return;}FS_LQ=[cb];
  var css=document.createElement('link');css.rel='stylesheet';css.href='vendor/leaflet/leaflet.css';document.head.appendChild(css);
  var s=document.createElement('script');s.src='vendor/leaflet/leaflet.js';s.onload=function(){try{window.L.Icon.Default.imagePath='vendor/leaflet/images/';}catch(e){}var q=FS_LQ;FS_LQ=null;q.forEach(function(f){f(true);});};
  s.onerror=function(){FS_LFAIL=true;var q=FS_LQ;FS_LQ=null;q.forEach(function(f){f(false);});};document.head.appendChild(s);}
var FS_DEF=[45.0,-63.4];   /* no pin yet: Maritimes view */
function fsMap(el,ll,o){o=o||{};if(!el||el._fsMap)return el&&el._fsMap;var L=window.L;
  var m=L.map(el,{zoomControl:!o.mini,dragging:!o.mini,touchZoom:!o.mini,scrollWheelZoom:false,doubleClickZoom:!o.mini,boxZoom:false,keyboard:!o.mini,attributionControl:true,tap:!o.mini});
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(m);
  m.setView(ll||FS_DEF,ll?(o.zoom||(o.mini?14:16)):6);el._fsMap=m;
  if(ll||o.drag){var mk=L.marker(ll||FS_DEF,{draggable:!!o.drag,keyboard:!!o.drag,title:o.title||'Site pin'});if(ll)mk.addTo(m);m._fsPin=mk;
    if(o.drag){mk.on('dragend',function(){var p=mk.getLatLng();o.onMove&&o.onMove(p.lat,p.lng);});
      m.on('click',function(e){mk.setLatLng(e.latlng);if(!m.hasLayer(mk))mk.addTo(m);o.onMove&&o.onMove(e.latlng.lat,e.latlng.lng);});}}
  setTimeout(function(){try{m.invalidateSize();}catch(e){}},60);return m;}
function fsSetPin(m,lat,lng,zoom){if(!m||!m._fsPin)return;var ll=[lat,lng];m._fsPin.setLatLng(ll);if(!m.hasLayer(m._fsPin))m._fsPin.addTo(m);m.setView(ll,zoom||Math.max(m.getZoom(),16));}
function fsMapsIn(root){var els=(root||document).querySelectorAll('.fs-map[data-lat]:not(.fs-on)');if(!els.length)return;
  fsLeaflet(function(ok){[].forEach.call(els,function(el){el.classList.add('fs-on');if(!ok){el.classList.add('fs-nomap');el.innerHTML='<span>Map could not load – use “Open in Google Maps”.</span>';return;}
    var la=parseFloat(el.dataset.lat),ln=parseFloat(el.dataset.lng),ll=isFinite(la)&&isFinite(ln)?[la,ln]:null;
    if(el.dataset.edit){var f=el.closest('form');fsMap(el,ll,{drag:true,title:'Drag me to the exact spot',onMove:function(a,b){fsPinTo(f,a,b,true);}});}
    else if(ll)fsMap(el,ll,{mini:true});else{el.classList.add('fs-nomap');el.innerHTML='<span>'+fsI('map')+' No pin yet</span>';}});});}
window.fsMapsIn=fsMapsIn;
function fsPinTo(f,lat,lng,dragged){if(!f)return;lat=Math.round(lat*1e6)/1e6;lng=Math.round(lng*1e6)/1e6;f.lat.value=lat;f.lng.value=lng;
  var st=f.querySelector('.fs-pinst');if(st){st.innerHTML=fsI('pin','fr-ic-sm')+'<span>Pin set'+(dragged?' (moved by you)':'')+': '+lat.toFixed(5)+', '+lng.toFixed(5)+'</span>';st.classList.add('ok');}
  fsLinkUpd(f);}
function fsLinkUpd(f){var a=f.querySelector('.fs-gm'),q=fsQ({addr:f.addr.value,lat:f.lat.value||null,lng:f.lng.value||null});if(a){if(q){a.href=fsGmaps({addr:f.addr.value,lat:f.lat.value||null,lng:f.lng.value||null});a.hidden=false;}else a.hidden=true;}}

/* ---------- route + nav (Sites is not a tab; owners and managers reach it from Home / Profile) ---------- */
(function(){var d=Object.getOwnPropertyDescriptor(NAV,'firm');var get=d&&d.get?d.get:null,base=d&&!d.get?d.value:null;
  Object.defineProperty(NAV,'firm',{configurable:true,enumerable:true,get:function(){var n=get?get.call(NAV):base;return fsCanManage()?(n||[]).concat([['#/places','']]):n;},
    set:function(v){if(d&&d.set)d.set.call(NAV,v);else base=v;}});})();
if(typeof fhTabs==='function'){var ofh=fhTabs;fhTabs=function(nav,h,u){return ofh((nav||[]).filter(function(n){return n[0]!=='#/places';}),h,u);};}
var og=gateRoute;gateRoute=function(h){if(ME&&ME.type==='firm'&&String(h||'').split('?')[0]==='#/places')return fsCanManage()?'#/places':'#/home';return og(h);};

/* ---------- Sites page ---------- */
function fsEmpty(){return '<div class="fr-empty" id="fsempty"><svg class="fr-art" viewBox="0 0 160 96" aria-hidden="true" focusable="false">'+
  '<path d="M10 78 52 64l46 14 52-16" fill="none" stroke="#ece9f6" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>'+
  '<path d="M60 52s-14-12-14-23a14 14 0 0 1 28 0c0 11-14 23-14 23z" fill="#fbf1de" stroke="#D9A03C" stroke-width="2.5"/><circle cx="60" cy="29" r="5" fill="#fff" stroke="#D9A03C" stroke-width="2.5"/>'+
  '<path d="M106 58s-11-9-11-18a11 11 0 0 1 22 0c0 9-11 18-11 18z" fill="#ece9f6" stroke="#332E57" stroke-width="2.5"/><circle cx="106" cy="40" r="4" fill="#fff" stroke="#332E57" stroke-width="2.5"/>'+
  '<circle cx="138" cy="22" r="10" fill="#fff" stroke="#332E57" stroke-width="2.5"/><path d="M138 17v10M133 22h10" stroke="#332E57" stroke-width="2.5" stroke-linecap="round"/></svg>'+
  '<b>No saved sites yet</b><span class="small muted">Save the fields, sheds and gates you order crews to. They show up as quick picks with a map when you order.</span></div>';}
function fsCard(p,k,can){var g=fsGmaps(p);
  return '<div class="fs-place fr-rise" style="--fr-d:'+(k*60)+'ms" data-place="'+esc(p.id)+'"><div class="fs-map fs-thumb" data-lat="'+esc(p.lat==null?'':p.lat)+'" data-lng="'+esc(p.lng==null?'':p.lng)+'" aria-hidden="true"></div>'+
    '<div class="fr-pmain"><div class="fr-pname"><span class="fs-pinb">'+fsI('pin')+'</span><b>'+esc(p.name||'')+'</b></div>'+
    '<div class="fr-contact small muted">'+(p.addr?fsI('map','fr-ic-sm')+'<span>'+esc(p.addr)+'</span>':'<span>Pin only</span>')+'</div>'+
    (p.notes?'<div class="fs-notes small">'+fsI('note','fr-ic-sm')+'<span>'+esc(p.notes)+'</span></div>':'')+
    (g?'<a class="fs-gmlink small" target="_blank" rel="noopener" href="'+esc(g)+'">'+fsI('ext','fr-ic-sm')+'<span>Open in Google Maps</span></a>':'')+'</div>'+
    (can?'<div class="fr-pact"><button type="button" class="small sec" data-act="fsedit" data-id="'+esc(p.id)+'">Change</button><button type="button" class="small sec fr-danger" data-act="fsrm" data-id="'+esc(p.id)+'">Remove</button></div>':'')+'</div>';}
VIEWS['firm:places']=function(){var c=fsClient(),P=fsPlaces(c.id),can=fsCanManage();
  var x='<div class="fr-head fr-rise"><div class="fr-head-ic">'+fsI('pin')+'</div><div><h1>Sites</h1><div class="muted fr-sub">Saved places for <b>'+esc(c.name||'your farm')+'</b> – pick one when you order a crew.</div></div></div>';
  x+='<div class="fr-sees fr-rise" style="--fr-d:60ms"><div class="fr-see">'+fsI('map')+'<span>Map pin + address</span></div><div class="fr-see">'+fsI('note')+'<span>Gate / parking notes</span></div><div class="fr-see fr-see-no">'+fsI('people')+'<span>Office sees it on every order</span></div></div>';
  x+='<div class="card fr-card" id="fsplaces"><div class="fr-card-h">'+fsI('pin')+'<h2>Saved sites</h2><span class="fr-count">'+P.length+'</span>'+(can&&P.length<MAX_PLACES?'<button type="button" class="small sec fs-addbtn" data-act="fsedit" id="fsadd">'+fsI('plus','fr-ic-sm')+' Add a site</button>':'')+'</div>'+
    '<div class="fs-list">'+P.map(function(p,k){return fsCard(p,k,can);}).join('')+'</div>'+(P.length?'':fsEmpty())+
    (P.length>=MAX_PLACES?'<p class="small muted">Up to '+MAX_PLACES+' saved sites.</p>':'')+'</div>';
  return '<div class="fr-page fs-page">'+x+'</div>';};
ACT.fsgo=function(){location.hash='#/places';};
ACT.fsedit=function(el){if(!fsCanManage()){toast('Only the farm owner or a manager can change saved sites.');return;}var p=el.dataset.id?fsPlace(el.dataset.id):null,c=fsClient();
  if(!p&&fsPlaces(c.id).length>=MAX_PLACES){toast('Up to '+MAX_PLACES+' saved sites.');return;}p=p||{};var g=fsGmaps(p);
  modal('<div class="fr-modal fs-modal"><div class="fr-mh">'+fsI('pin','fr-ic-lg')+'<div><h2>'+(p.id?'Change '+esc(p.name):'Add a site')+'</h2><span class="small muted">Name, address and an exact pin</span></div></div>'+
    '<form data-form="fsplace" id="fsform"><input type="hidden" name="id" value="'+esc(p.id||'')+'"><input type="hidden" name="lat" value="'+esc(p.lat==null?'':p.lat)+'"><input type="hidden" name="lng" value="'+esc(p.lng==null?'':p.lng)+'">'+
    inp('name','Location name',p.name||'',{req:true})+
    '<label for="fsaddr">Address</label><div class="fs-srch"><input id="fsaddr" type="text" name="addr" value="'+esc(p.addr||'')+'" maxlength="500" autocomplete="street-address" placeholder="e.g. 123 Orchard Rd, Berwick NS">'+
    '<button type="button" class="small sec" data-act="fssearch" id="fsfind">'+fsI('search','fr-ic-sm')+' Find on map</button></div><div class="fs-res" id="fsres" hidden></div>'+
    '<div class="fs-map fs-edit" id="fsmap" data-edit="1" data-lat="'+esc(p.lat==null?'':p.lat)+'" data-lng="'+esc(p.lng==null?'':p.lng)+'" role="application" aria-label="Map – drag the pin or tap to set the exact spot"></div>'+
    '<div class="fs-pinrow"><div class="fs-pinst small muted'+(p.lat!=null?' ok':'')+'">'+fsI('pin','fr-ic-sm')+'<span>'+(p.lat!=null?'Pin set: '+(+p.lat).toFixed(5)+', '+(+p.lng).toFixed(5):'Find the address, or tap the map / drag the pin to the exact spot')+'</span></div>'+
    '<a class="fs-gm small" target="_blank" rel="noopener" href="'+esc(g||'#')+'"'+(g?'':' hidden')+'>'+fsI('ext','fr-ic-sm')+'<span>Open in Google Maps</span></a></div>'+
    '<label for="fsnotes">Notes for the crew <small class="of-opt">(optional – gate, parking, who to meet)</small></label><textarea id="fsnotes" name="notes" maxlength="500" placeholder="e.g. Use the east gate, park by the red barn">'+esc(p.notes||'')+'</textarea>'+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Cancel</button><button id="fssave">Save site</button></div></form></div>');
  fsMapsIn(document.getElementById('modal'));};
ACT.fssearch=function(el){var f=el.closest('form'),q=String(f.addr.value||'').trim(),box=f.querySelector('#fsres');if(q.length<3){toast('Type an address first.');return;}
  box.hidden=false;box.innerHTML='<div class="small muted fs-busy">'+fsI('search','fr-ic-sm')+' Searching OpenStreetMap…</div>';
  var mock=window.FS_GEOCODE_MOCK;var done=function(list){if(!list||!list.length){box.innerHTML='<div class="small muted">Nothing found. Try a shorter address, or tap the map to drop the pin yourself.</div>';return;}
    box.innerHTML=list.slice(0,5).map(function(r,i){return '<button type="button" class="fs-hit" data-act="fshit" data-lat="'+esc(r.lat)+'" data-lng="'+esc(r.lon)+'" data-name="'+esc(r.display_name)+'">'+fsI('pin','fr-ic-sm')+'<span>'+esc(r.display_name)+'</span></button>';}).join('')+'<div class="fs-osm small muted">Search © OpenStreetMap (Nominatim)</div>';};
  if(mock){setTimeout(function(){done(mock(q));},150);return;}
  fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca,us&q='+encodeURIComponent(q),{headers:{'Accept-Language':'en'}}).then(function(r){return r.json();}).then(done).catch(function(){box.innerHTML='<div class="small muted">Search is not available right now – tap the map to drop the pin, or use Open in Google Maps.</div>';});};
ACT.fshit=function(el){var f=el.closest('form'),la=+el.dataset.lat,ln=+el.dataset.lng;var nm=String(el.dataset.name||'').split(', ');f.addr.value=nm.slice(0,Math.min(nm.length,4)).join(', ');
  fsPinTo(f,la,ln,false);var m=document.getElementById('fsmap');if(m&&m._fsMap)fsSetPin(m._fsMap,la,ln,17);var r=f.querySelector('#fsres');r.hidden=true;r.innerHTML='';};
document.addEventListener('input',function(e){var t=e.target;if(t&&t.id==='fsaddr'&&t.form)fsLinkUpd(t.form);});
FORMS.fsplace=function(f,d){if(!fsCanManage()){toast('Only the farm owner or a manager can change saved sites.');return;}var c=fsClient(),name=String(d.name||'').trim(),addr=String(d.addr||'').trim(),notes=String(d.notes||'').trim();
  var la=parseFloat(d.lat),ln=parseFloat(d.lng),pin=isFinite(la)&&isFinite(ln)&&Math.abs(la)<=90&&Math.abs(ln)<=180;
  if(name.length<2){toast('Give the site a name, e.g. North field gate.');return;}if(!addr&&!pin){toast('Add an address or drop the pin on the map.');return;}
  var p=d.id?fsPlace(d.id):null;if(d.id&&(!p||p.firmId!==c.id)){toast('Not one of your sites.');return;}
  if(fsPlaces(c.id).some(function(x){return x.id!==(p&&p.id)&&String(x.name||'').toLowerCase()===name.toLowerCase();})){toast('You already have a site called '+name+'.');return;}
  var now=new Date().toISOString(),by=(fsLogin()||ME).name||'';
  if(!p){p={id:uid('fp'),firmId:c.id,createdAt:now,createdBy:by};(DB.farmPlaces=DB.farmPlaces||[]).push(p);}
  p.name=name.slice(0,80);p.addr=addr.slice(0,500);p.lat=pin?Math.round(la*1e6)/1e6:null;p.lng=pin?Math.round(ln*1e6)/1e6:null;p.notes=notes.slice(0,500);p.updatedAt=now;p.updatedBy=by;
  audit(d.id?'Farm changed a saved site':'Farm saved a site',c.name,p.name+' · '+(p.addr||(p.lat+','+p.lng)));save();closeModal();toast(d.id?'Site saved.':'Site added – it shows up when you order a crew.');render();};
ACT.fsrm=function(el){if(!fsCanManage())return;var p=fsPlace(el.dataset.id);if(!p)return;
  modal('<div class="fr-modal fr-rm"><div class="fr-rm-art">'+fsI('trash','fr-ic-xl')+'</div><h2>Remove '+esc(p.name||'')+'?</h2>'+
    '<div><ul class="fr-rm-list"><li>'+fsI('pin','fr-ic-sm')+'<span>No longer a quick pick when you order</span></li><li>'+fsI('clock','fr-ic-sm')+'<span>Orders already sent keep this address</span></li></ul></div>'+
    '<div class="row-end"><button type="button" class="btn sec" data-act="closeModal">Keep</button><button type="button" class="danger" data-act="fsrmgo" data-id="'+esc(p.id)+'" id="fsrmgo">Remove</button></div></div>');};
ACT.fsrmgo=function(el){if(!fsCanManage())return;var c=fsClient(),p=fsPlace(el.dataset.id);if(!p||p.firmId!==c.id)return;DB.farmPlaces=(DB.farmPlaces||[]).filter(function(x){return x.id!==p.id;});
  audit('Farm removed a saved site',c.name,p.name);save();closeModal();toast('Site removed.');render();};

/* ---------- entry card on Home and Profile (same small · sec button as "Change") ---------- */
function fsLinks(root){if(!fsCanManage()||!root||!root.querySelector)return;var h=(location.hash||'#/home').split('?')[0],m=root.querySelector('main');if(!m||m.querySelector('#fssiteslink'))return;
  if(h!=='#/profile'&&h!=='#/home'&&h!=='#/')return;var n=fsPlaces(fsClient().id).length;
  var d=document.createElement('div');d.className='card fr-entry fs-entry';d.id='fssiteslink';
  d.innerHTML='<div class="fr-entry-ic">'+fsI('pin')+'</div><div class="fr-entry-tx"><b>Sites</b><span class="small muted">'+(n?n+' saved site'+(n===1?'':'s')+' · quick picks with a map when you order':'Save your fields, sheds and gates with a map pin')+'</span></div>'+
    '<button type="button" class="small sec fr-entry-btn" data-act="fsgo" id="fssitesbtn">'+(n?'Manage':'Add sites')+'</button>';
  var t=m.querySelector('#frteamlink');if(t&&t.parentNode)t.parentNode.insertBefore(d,t.nextSibling);
  else if(h==='#/profile')m.insertBefore(d,m.children[1]||null);else{var a=m.querySelector('#fhtimesheets,.fh-ts');if(a&&a.parentNode)a.parentNode.insertBefore(d,a.nextSibling);else m.appendChild(d);}}

/* ---------- order form + Change box: saved sites as quick picks ---------- */
function fsPicker(firm,f){var c=fsClient()||firm,P=fsPlaces(c.id),sel=f&&f.placeId&&fsPlace(f.placeId)?f.placeId:'';
  if(!P.length)return fsCanManage()?'<div class="fs-pick fs-pick-none"><span class="small muted">'+fsI('pin','fr-ic-sm')+' Save your sites once and pick them here next time.</span> <button type="button" class="small sec" data-act="fsgoclose">Add sites</button></div>':'';
  var p=sel?fsPlace(sel):null;
  return '<div class="fs-pick" data-fs="pick"><input type="hidden" name="placeId" value="'+esc(sel)+'"><label>'+fsI('pin','fr-ic-sm')+' Saved sites <small class="of-opt">(tap one to fill the address)</small></label>'+
    '<div class="fs-chips" role="radiogroup" aria-label="Saved sites">'+P.map(function(x){return '<button type="button" class="fs-chip'+(x.id===sel?' on':'')+'" role="radio" aria-checked="'+(x.id===sel)+'" data-act="fspick" data-id="'+esc(x.id)+'">'+fsI('pin','fr-ic-sm')+'<span>'+esc(x.name)+'</span></button>';}).join('')+
    '<button type="button" class="fs-chip fs-oneoff'+(sel?'':' on')+'" role="radio" aria-checked="'+(!sel)+'" data-act="fspick" data-id="">'+fsI('map','fr-ic-sm')+'<span>One-off address</span></button></div>'+
    '<div class="fs-prev"'+(p?'':' hidden')+'>'+(p?fsPrevHtml(p):'')+'</div></div>';}
function fsPrevHtml(p){var g=fsGmaps(p);return '<div class="fs-map fs-mini" data-lat="'+esc(p.lat==null?'':p.lat)+'" data-lng="'+esc(p.lng==null?'':p.lng)+'" aria-hidden="true"></div><div class="fs-prev-tx"><b>'+esc(p.name)+'</b>'+
  (p.addr?'<span class="small">'+esc(p.addr)+'</span>':'')+(p.notes?'<span class="small fs-notes">'+fsI('note','fr-ic-sm')+'<span>'+esc(p.notes)+'</span></span>':'')+(g?'<a class="small fs-gmlink" target="_blank" rel="noopener" href="'+esc(g)+'">'+fsI('ext','fr-ic-sm')+'<span>Open in Google Maps</span></a>':'')+'</div>';}
ACT.fsgoclose=function(){closeModal();location.hash='#/places';};
ACT.fspick=function(el){var form=el.closest('form'),box=el.closest('.fs-pick');if(!form||!box)return;var id=el.dataset.id,p=id?fsPlace(id):null;
  [].forEach.call(box.querySelectorAll('.fs-chip'),function(b){var on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false');});
  box.querySelector('input[name=placeId]').value=p?p.id:'';var pv=box.querySelector('.fs-prev');
  var ab=form.querySelector('.of-addr'),ai=ab&&ab.querySelector('.of-addrin');
  if(p){pv.innerHTML=fsPrevHtml(p);pv.hidden=false;fsMapsIn(pv);
    if(ai){ai.value=p.addr||(p.lat!=null?p.lat+', '+p.lng:'');ab.querySelector('input[name=lat]').value=p.lat==null?'':p.lat;ab.querySelector('input[name=lng]').value=p.lng==null?'':p.lng;ab.dataset.geoKeep='1';ab.dataset.touched='1';
      if(typeof ofAddrUpdate==='function')ofAddrUpdate(ab,true);delete ab.dataset.geoKeep;}}
  else{pv.hidden=true;pv.innerHTML='';if(ai){ai.focus();}}};
/* typing your own address = a one-off address */
document.addEventListener('input',function(e){var t=e.target;if(!t||!e.isTrusted||!t.classList||!t.classList.contains('of-addrin'))return;var form=t.form,box=form&&form.querySelector('.fs-pick');if(!box)return;
  var h=box.querySelector('input[name=placeId]');if(!h.value)return;h.value='';[].forEach.call(box.querySelectorAll('.fs-chip'),function(b){var on=b.classList.contains('fs-oneoff');b.classList.toggle('on',on);b.setAttribute('aria-checked',on?'true':'false');});var pv=box.querySelector('.fs-prev');pv.hidden=true;pv.innerHTML='';});
(function(){
  var of=orderForm;orderForm=function(firm){var x=of(firm),i=x.indexOf('<div class="of-addr"');return i<0?x:x.slice(0,i)+fsPicker(firm,null)+x.slice(i);};
  var ff=ordFieldsFrom;ordFieldsFrom=function(d,base){base=base||{};var f=ff(d,base);
    if(d.placeId!==undefined){var p=d.placeId?fsPlace(d.placeId):null;if(p){f.placeId=p.id;f.placeName=p.name;f.placeNotes=p.notes||'';}else{delete f.placeId;delete f.placeName;delete f.placeNotes;}}
    else['placeId','placeName','placeNotes'].forEach(function(k){if(base[k]!==undefined)f[k]=base[k];});return f;};
  var od=ordDiff;ordDiff=function(a,b,firm){var out=od(a,b,firm);if(a&&b&&(a.placeName||'')!==(b.placeName||''))out.push(['Saved site',esc(a.placeName||'–'),esc(b.placeName||'One-off address')]);return out;};
  if(typeof ofDetail==='function'){var odt=ofDetail;ofDetail=function(o,firm,who){var x=odt(o,firm,who),f=ordView(o);if(!f||!f.placeName)return x;
    var line='<div class="of-dl of-dplace"><span>Saved site</span><b class="fs-dname">'+fsI('pin','fr-ic-sm')+esc(f.placeName)+'</b>'+(f.placeNotes?' <small class="fs-dnotes">· '+esc(f.placeNotes)+'</small>':'')+'</div>';
    return x.replace('<div class="of-detail">','<div class="of-detail">'+line);};}
})();

/* ---------- direct change (fewer workers / site / note) vs. request ---------- */
var FREE=['workers','crew','role','note','addr','lat','lng','placeId','placeName','placeNotes'],FREE_LAB=['Workers','Role','Note','Crew','Site address','Saved site'];
function fsCrewMap(f){var m={};(typeof ofCrewOf==='function'?ofCrewOf(f):[]).forEach(function(c){m[c.role]=(m[c.role]||0)+(+c.qty||0);});if(!Object.keys(m).length&&f&&f.role)m[f.role]=+f.workers||0;return m;}
function fsMore(a,b){if((+b.workers||0)>(+a.workers||0))return true;var ma=fsCrewMap(a),mb=fsCrewMap(b);return Object.keys(mb).some(function(k){return mb[k]>(ma[k]||0);});}
function fsDirectWhy(o,nf,firm){if(!o.cur||o.pending||o.status!=='Confirmed')return 'notconfirmed';if(hoursBefore(o.cur)<DIRECT_H)return 'late';
  var d=ordDiff(o.cur,nf,firm);if(!d.length)return 'same';if(d.some(function(x){return FREE_LAB.indexOf(x[0])<0;}))return 'time';if(fsMore(o.cur,nf))return 'more';if((+nf.workers||0)<1)return 'zero';return '';}
window.fsDirectWhy=fsDirectWhy;
(function(){var oe=FORMS.crewOrderEdit;FORMS.crewOrderEdit=function(f,d){var o=ordById(d.id),firm=ME;if(!o||o.firmId!==firm.id||!ordCanChange(o)||!o.cur||o.pending)return oe.apply(this,arguments);
  var nf=ordFieldsFrom(d,o.cur);nf.site=o.cur.site;nf.ppe=o.cur.ppe;var e=ordCheck(firm,nf);if(e){toast(e);return;}
  var why=fsDirectWhy(o,nf,firm);if(why==='same'){toast('You did not change anything. Change a field, or close this box.');return;}
  if(why){var r=oe.apply(this,arguments);if(why==='more'&&o.pending)setTimeout(function(){toast('More workers need the office’s OK – sent as a request. You will be notified.');},50);
    else if(why==='late'&&o.pending)setTimeout(function(){toast('It starts in less than '+DIRECT_H+' hours, so this went to the office as a request.');},50);return r;}
  var nc=JSON.parse(JSON.stringify(o.cur));FREE.forEach(function(k){if(nf[k]===undefined)delete nc[k];else nc[k]=nf[k];});
  var diff=ordDiff(o.cur,nc,firm),late=hoursBefore(o.cur)<orderCutoffH(),sh=ordShift(o),booked=sh?(sh.booked||[]).length:0;
  (o.farmEdits=o.farmEdits||[]).push({at:new Date().toISOString(),by:ordActor(),from:+o.cur.workers,to:+nc.workers,diff:diffText(diff),hoursBefore:Math.round(hoursBefore(o.cur)*10)/10});if(o.farmEdits.length>50)o.farmEdits=o.farmEdits.slice(-50);
  o.cur=nc;ordLog(o,'Farm changed the confirmed order directly'+(late?' (less than '+orderCutoffH()+' h before)':''),diffText(diff));
  notify('admin','Crew order '+o.no+' – '+firm.name+' changed it directly: '+diffText(diff)+'.'+(sh&&booked>nc.workers?' '+booked+' people are booked but only '+nc.workers+' are needed now – remove '+(booked-nc.workers)+' in Shifts.':'')+' Update Crew coming if needed.');
  save();closeModal();toast('Saved – the office has been told.'+(late?' Changes less than '+orderCutoffH()+' h before the start may be charged per your agreement.':''));render();};})();
/* Change box: the rule, plus the saved-site picks */
(function(){var oc=ACT.coedit;ACT.coedit=function(el){var r=oc.apply(this,arguments),m=document.getElementById('modal'),f=m&&m.querySelector('form[data-form=crewOrderEdit]');if(!f)return r;
  var o=ordById(el.dataset.id),hb=o&&o.cur?hoursBefore(o.cur):99,msg;
  if(o&&o.cur&&!o.pending&&o.status==='Confirmed'){msg=hb<DIRECT_H?'<div class="fs-rule fs-rule-late" id="fsrule">'+fsI('clock')+'<div><b>Starts in less than '+DIRECT_H+' hours.</b> Nothing changes right away now – what you send goes to the office as a request. Urgent? Call <a href="tel:+19022004888">902-200-4888</a>.</div></div>':
    '<div class="fs-rule" id="fsrule">'+fsI('bolt')+'<div><b>Fewer workers, another site or a new note</b> apply right away (until '+DIRECT_H+' h before the start) and the office is told. <span class="fs-rule-more">'+fsI('send','fr-ic-sm')+'<b>More workers</b> or a new date / time go to the office for approval.</span></div></div>';}
  else if(o&&o.pending&&o.pending.kind==='change')msg='<div class="fs-rule fs-rule-pend" id="fsrule">'+fsI('send')+'<div><b>A change is waiting for the office.</b> Anything you send now replaces that request.</div></div>';
  if(msg)f.insertAdjacentHTML('afterbegin',msg);
  var ab=f.querySelector('.of-addr'),fv=o?((o.pending&&o.pending.kind==='change'&&o.pending.fields)||o.cur||o.req):null;if(ab&&!f.querySelector('.fs-pick'))ab.insertAdjacentHTML('beforebegin',fsPicker(ME,fv));fsMapsIn(m);return r;};})();

/* ---------- Crew coming: tap the card → upcoming orders → Change ---------- */
function fsUpcoming(firm){var now=nowMsApp(),lim=now+8*86400000;return ordersOf(firm).filter(function(o){var s=ordStatus(o);if(['Declined','Cancelled'].indexOf(s)>=0||!ordCanChange(o))return false;var f=ordView(o),t=ordStartMs(f);return t>now&&t<lim;})
  .sort(function(a,b){return ordStartMs(ordView(a))-ordStartMs(ordView(b));});}
if(typeof fhComingCard==='function'){var occ=fhComingCard;fhComingCard=function(firm){var x=occ(firm),U=fsUpcoming(firm);
  var bar='<div class="fs-cc" id="fscc">'+'<div class="fr-entry-ic">'+fsI('people')+'</div><div class="fs-cc-tx"><b>'+(U.length?U.length+' upcoming order'+(U.length===1?'':'s'):'No upcoming orders to change')+'</b><span class="small muted">Fewer workers, site or note: right away until '+DIRECT_H+' h before · more workers: the office approves</span></div>'+
    (U.length?'<button type="button" class="small sec fr-entry-btn" data-act="fscoming" id="fsccbtn">Change crew</button>':'')+'</div>';
  var i=x.lastIndexOf('</section>');x=i<0?x:x.slice(0,i)+bar+x.slice(i);return x.replace('class="card fh-card fh-coming fh-in"','class="card fh-card fh-coming fh-in fs-tap"'+(U.length?' data-fstap="1" title="Tap to change your upcoming crew"':''));};}
document.addEventListener('click',function(e){var c=e.target.closest&&e.target.closest('#fhcoming[data-fstap]');if(!c||e.target.closest('button,a,input,select,textarea,.fh-strip,.fh-dayinfo'))return;ACT.fscoming();});
ACT.fscoming=function(){var firm=ME,U=fsUpcoming(firm);if(!U.length){toast('No upcoming orders to change.');return;}if(U.length===1){ACT.coedit({dataset:{id:U[0].id}});return;}
  modal('<div class="fr-modal fs-modal"><div class="fr-mh">'+fsI('people','fr-ic-lg')+'<div><h2>Crew coming – your orders</h2><span class="small muted">Pick the order to change</span></div></div><div class="fs-olist">'+
    U.map(function(o,k){var f=ordView(o),hb=o.cur?hoursBefore(o.cur):99;return '<div class="fs-ord fr-rise" style="--fr-d:'+(k*50)+'ms" data-ord="'+esc(o.id)+'"><div class="fs-ord-d"><b>'+esc(shortDay(f.date))+'</b><span class="small muted">'+ordTime(f)+'</span></div>'+
      '<div class="fr-pmain"><div class="fr-pname"><b>'+esc(typeof ofCrewLine==='function'?ofCrewLine(firm,f):(f.workers+' workers'))+'</b>'+ordPill(o)+'</div><div class="small muted">'+esc(o.no||'')+(f.placeName?' · '+esc(f.placeName):f.addr?' · '+esc(f.addr):'')+'</div>'+
      (o.cur&&!o.pending&&hb<DIRECT_H?'<div class="small fs-late">'+fsI('clock','fr-ic-sm')+' Less than '+DIRECT_H+' h to go – changes go to the office</div>':'')+'</div>'+
      '<div class="fr-pact"><button type="button" class="small sec" data-act="coedit" data-id="'+esc(o.id)+'">Change</button></div></div>';}).join('')+'</div></div>');};

/* ---------- render hooks ---------- */
var oar=afterRender;afterRender=function(root){oar(root);try{fsLinks(root);fsMapsIn(root);}catch(e){console.warn('farmsites',e);}};
})();
