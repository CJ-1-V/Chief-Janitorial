/* v2-sitecode-check.js – UnScramble (unstrip-live1).
   Farm/site codes are owned in UnScramble (reg_client_sites), not Shift Tracker.
   Format: 3 letters + number 201–299 (e.g. HTP250).
   REMOVED for US: "Create … in Shift Tracker" button and any ST sites insert.
   A valid new code (format OK, number and letters not used by another site) may be saved: it becomes a new UnScramble site.
   Shift Tracker side (hide the US company for employees) is a separate later change. */
(function(){
  'use strict';
  if(typeof FORMS==='undefined'||typeof DB==='undefined')return;
  var CO='us',LO=201,HI=299,RE=/^([A-Z]{3})(\d{3})$/,FRESH=60000;
  var FIELDS={newfirm:'code',addsite:'code',clnew:'farmCode',clapprovenew:'farmCode'};
  var SC=window.SITECODE={list:null,loading:null,err:'',at:0,canCreate:null,confirm:null,fields:FIELDS};
  function live(){return !!(window.REG_LIVE&&window.REG_SB);}
  function stUrl(p){return live()?'../#/admin/'+p:'https://www.chiefjanitorial.com/shifts-secure/#/admin/'+p;}
  function norm(c){return String(c==null?'':c).trim().toUpperCase().replace(/\s+/g,'');}
  function e(s){return typeof esc==='function'?esc(s):String(s);}
  function fmtProblem(c){if(!c)return 'Enter the farm code.';var m=RE.exec(c);
    if(!m)return 'A farm code is 3 letters + its site number, like HTP250 (UnScramble numbers '+LO+'–'+HI+').';
    var n=+m[2];if(n<LO||n>HI)return 'Unscramble site numbers are '+LO+'–'+HI+'. '+c+' has number '+n+'.';
    if(m[1]==='UNK')return 'UNK is reserved. Use the farm\'s own 3 letters.';return '';}
  SC.fmtProblem=fmtProblem;
  /* known codes = old US site list (read-only) + this app's own sites (reg_client_sites) */
  function mergedList(){var L=(SC.list||[]).slice(),have={};L.forEach(function(s){have[s.site_code]=1;});
    (DB.sites||[]).forEach(function(s){var c=norm(s.code);if(have[c]||fmtProblem(c))return;have[c]=1;L.push({site_no:+c.slice(3),site_code:c,active:true,is_unknown:false,company_id:CO,label:'Farm'});});return L;}

  /* ---------- Site list (format check; US create goes to reg_client_sites) ---------- */
  function mockList(){/* UnScramble DB.sites (reg_client_sites) */
    if(!DB.stSites||!live()){DB.stSites=(DB.sites||[]).filter(function(s){return !fmtProblem(norm(s.code));}).map(function(s){var c=norm(s.code);return {site_no:+c.slice(3),site_code:c,active:true,is_unknown:false,company_id:CO,label:'Farm'};});}return DB.stSites;}
  function load(){if(SC.loading)return SC.loading;
    if(!live()){SC.list=mockList();SC.at=Date.now();SC.err='';SC.canCreate=false;return Promise.resolve(SC.list);}
    var sb=window.REG_SB;
    SC.loading=sb.from('sites').select('id,site_no,site_code,active,is_unknown,company_id,label').eq('company_id',CO).order('site_no').then(function(r){
      if(r.error)throw r.error;SC.list=r.data||[];SC.at=Date.now();SC.err='';
      SC.canCreate=false; /* never create Shift Tracker sites from UnScramble */
    }).catch(function(er){SC.err='';SC.list=mockList();SC.at=Date.now();SC.canCreate=false;/* old US site list not readable: check against this app's own sites */}).then(function(){SC.loading=null;updateAll();return SC.list;});
    return SC.loading;}
  function ensure(){return (SC.list&&Date.now()-SC.at<FRESH)?Promise.resolve(SC.list):load();}
  SC.reload=function(){SC.at=0;return load();};
  function nextFree(){var nos=(SC.list||[]).filter(function(s){return !s.is_unknown&&!/^UNK/.test(s.site_code||'');}).map(function(s){return s.site_no;}),used={};nos.forEach(function(n){used[n]=1;});
    var top=Math.max.apply(null,[LO-1].concat(nos))+1;if(top<=HI)return top;for(var n=LO;n<=HI;n++)if(!used[n])return n;return null;}
  SC.nextFree=nextFree;
  /* {s:'ok'|'off'|'clash'|'missing'|'format'|'wait'|'error', m:text} */
  function status(code){code=norm(code);var fp=fmtProblem(code);if(fp)return {s:'format',m:fp};
    if(!SC.list)return SC.err?{s:'error',m:'Could not check UnScramble sites ('+SC.err+').'}:{s:'wait',m:'Checking sites…'};
    var L=mergedList(),row=L.filter(function(s){return s.site_code===code;})[0],n=+code.slice(3),a=code.slice(0,3);
    if(row)return row.active&&!row.is_unknown?{s:'ok',m:code+' is an UnScramble site – employees can pick it on the clock once it is linked to a client.'}:{s:'off',m:code+' was turned off in the old Shift Tracker site list. It can still be used here.'};
    var byNo=L.filter(function(s){return s.site_no===n;})[0];if(byNo)return {s:'clash',m:'Site number '+n+' is already '+byNo.site_code+'. If this is that farm, use '+byNo.site_code+'; otherwise pick a free number'+(nextFree()?' (next free: '+nextFree()+')':'')+'.'};
    var byA=L.filter(function(s){return (s.site_code||'').slice(0,3)===a;})[0];if(byA)return {s:'clash',m:'The letters '+a+' are already used by site '+byA.site_code+'. Each site needs its own 3 letters.'};
    return {s:'missing',m:code+' is a new site code – saving adds it as an UnScramble site (no Shift Tracker step).'};}
  SC.status=status;

  /* ---------- which code / type / rates a form is about ---------- */
  function codeOf(name,d){d=d||{};var f=FIELDS[name];if(name==='clnew')return norm(d.farmCode)||norm(((d.sites||[]).slice().sort())[0]);return norm(d[f]);}
  function firmOf(form,d){var id=(d&&d.id)||(form&&form.querySelector&&(form.querySelector('input[name=id]')||{}).value);return id&&typeof user==='function'?user(id):null;}
  function typeOf(form,d){var t=(d&&d.clientType)||(form&&form.querySelector&&(form.querySelector('[name=clientType]')||{}).value);var f=firmOf(form,d);if(!t&&f)t=(f.firm&&f.firm.clientType)||'Farm';return (t||'Farm')==='Farm'?'Farm':'Worksite';}
  function ratesOf(form,d){var out=[],f=firmOf(form,d),c=f&&typeof farmRatesCur==='function'?farmRatesCur(f):null;
    if(c&&c.rates){[['Labourer',c.rates.labour],['Machine operator',c.rates.forklift],['Truck driver',c.rates.driver]].forEach(function(x){if(+x[1]>0)out.push({role:x[0],rate:+x[1]});});return out;}
    var r=+((d&&d.rate)||(form&&form.querySelector&&(form.querySelector('input[name=rate]')||{}).value)||0);if(r>0)out.push({role:'Labourer',rate:r});return out;}

  /* ---------- the box under the field ---------- */
  function boxFor(input){var b=input.parentNode&&input.parentNode.querySelector('.sc-box');if(!b){b=document.createElement('div');b.className='sc-box small';b.setAttribute('aria-live','polite');input.parentNode.appendChild(b);}return b;}
  function render1(input,stress){var form=input.form,code=norm(input.value),b=boxFor(input);
    if(!code){b.className='sc-box small muted';b.innerHTML='Farm code = UnScramble site code: 3 letters + number '+LO+'–'+HI+' (e.g. HTP250).';return;}
    var st=status(code),cls={ok:'ok',off:'warn',clash:'bad',missing:'ok',format:'bad',wait:'muted',error:'warn'}[st.s];
    var h=(st.s==='ok'||st.s==='missing'?'✓ ':st.s==='off'?'! ':st.s==='wait'?'':'✗ ')+e(st.m);
    if(st.s==='missing'){
      /* no Create-in-Shift-Tracker: the site is added in UnScramble when this form is saved */}
    /* off/clash: stay in UnScramble – no ST Sites deep-link for US flows */
    if(st.s==='error')h+=' <button type="button" class="small sec" data-act="scretry">Try again</button>';
    if(st.s==='ok'||st.s==='missing'||st.s==='off'||st.s==='clash')h+=' <button type="button" class="small sec sc-refresh" data-act="scretry" title="Refresh site list">↻</button>';
    b.className='sc-box small sc-'+cls+(stress?' sc-stress':'');b.innerHTML=h;}
  function fieldsIn(root){var out=[];[].forEach.call((root||document).querySelectorAll('form[data-form]'),function(f){var n=f.dataset.form,fld=f.getAttribute('data-sitecode-field')||FIELDS[n];if(!fld)return;if(!FIELDS[n])FIELDS[n]=fld;var i=f.querySelector('input[name="'+fld+'"]');if(i)out.push(i);});return out;}
  function updateAll(){fieldsIn(document).forEach(function(i){if(i.dataset.scBound)render1(i);});}
  SC.updateAll=updateAll;
  function decorate(){var need=false;fieldsIn(document).forEach(function(i){if(i.dataset.scBound)return;i.dataset.scBound='1';
      i.setAttribute('placeholder','e.g. HTP250');i.setAttribute('maxlength','6');i.setAttribute('autocapitalize','characters');i.setAttribute('autocomplete','off');
      var f=i.form;if(f&&f.dataset.form==='addsite'){var nm=f.querySelector('input[name=name]');if(nm&&/Site name/.test(nm.placeholder||''))nm.placeholder='Farm or Worksite (never the client name)';}
      if(f&&f.dataset.form==='newfirm'){var st=f.querySelector('input[name=site]');if(st&&/Main Field/.test(st.placeholder||''))st.placeholder='Farm (never the client name)';}
      render1(i);need=true;});
    if(need)ensure().then(updateAll);}
  var tick=null;function soon(){if(tick)return;tick=setTimeout(function(){tick=null;try{decorate();}catch(x){}},0);}
  new MutationObserver(soon).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',soon);soon();
  var typing=null;
  document.addEventListener('input',function(ev){var i=ev.target;if(!i||!i.dataset||!i.dataset.scBound)return;i.value=i.value.toUpperCase().replace(/[^A-Z0-9]/g,'');SC.confirm=null;clearTimeout(typing);typing=setTimeout(function(){render1(i);if(!SC.list||Date.now()-SC.at>FRESH)ensure().then(function(){render1(i);});},150);},true);

  /* ---------- buttons ---------- */
  function inputFor(code){return fieldsIn(document).filter(function(i){return norm(i.value)===code;})[0]||null;}
  ACT.sccreate=function(){toast('Creating sites in Shift Tracker is turned off for UnScramble. Add the site in this app instead.');};
  ACT.scno=function(){var c=SC.confirm;SC.confirm=null;var i=inputFor(c);if(i)render1(i);};
  ACT.scretry=function(){SC.reload().then(updateAll);updateAll();};
  ACT.scyes=function(){SC.confirm=null;toast('Creating sites in Shift Tracker is turned off for UnScramble. Add the site with Add client / Add site in this app.');};
  /* no Shift Tracker sites insert from UnScramble */
  if(typeof ADMIN_ONLY_ACT!=='undefined')ADMIN_ONLY_ACT.push('sccreate','scyes','scno');


  /* ---------- one farm = one site (owner rule Oct 6, 2026 3:36 PM): site code = farm code = client no. ----------
     A Farm client may never end up with a second site: Add site, Add a client (ticks), Edit client (ticks) and Merge are
     refused when the result would give a Farm more than one site. Other client types (construction, worksite…) are not limited. */
  function sitesOfFirm(f){return f?(DB.sites||[]).filter(function(x){return x.firmId===f.id;}).map(function(x){return norm(x.code);}):[];}
  function isFarmFirm(f,typeOverride){var t=typeOverride||(f&&f.firm&&f.firm.clientType)||'Farm';return t==='Farm';}
  function uniq(a){var o=[];a.forEach(function(x){x=norm(x);if(x&&o.indexOf(x)<0)o.push(x);});return o;}
  /* '' = fine, else the reason */
  function oneSiteProblem(name,form,d){d=d||{};var f,after,ty;
    if(name==='addsite'){f=firmOf(form,d);if(!f||!isFarmFirm(f))return '';after=uniq(sitesOfFirm(f).concat([d.code]));
      if(after.length>1)return 'A farm has exactly one site (its farm code = client no.). '+(f.firm&&f.firm.clientCode?'Client '+f.firm.clientCode:'This farm')+' already has '+sitesOfFirm(f).join(', ')+'. To use another code, change it under Clients & logins → Edit instead.';return '';}
    if(name==='clnew'){if(!isFarmFirm(null,d.clientType))return '';after=uniq((d.sites||[]).concat([d.farmCode]));
      if(after.length>1)return 'A farm has exactly one site: tick only its own farm code (you picked '+after.join(', ')+').';return '';}
    if(name==='cledit'){f=typeof user==='function'?user(d.id):null;if(!f||!isFarmFirm(f,d.clientType))return '';after=uniq(d.sites||[]);
      if(after.length>1)return 'A farm has exactly one site: keep only one site code ticked (now '+after.join(', ')+'). The client no. is that code.';return '';}
    if(name==='clmerge'){var src=typeof user==='function'?user(d.src):null,dst=typeof user==='function'?user(d.dst):null;if(!src||!dst)return '';
      after=uniq(sitesOfFirm(dst).concat(sitesOfFirm(src)));if((isFarmFirm(dst)||isFarmFirm(src))&&after.length>1)return 'A farm has exactly one site, so these two records can\'t be merged as they are ('+after.join(', ')+'). Move or remove the extra site first.';return '';}
    return '';}
  SC.oneSiteProblem=oneSiteProblem;
  function guardOne(name){var orig=FORMS[name];if(!orig||orig._one)return;
    var w=function(form,d){var m=oneSiteProblem(name,form,d);if(m){toast('Not saved: '+m);if(typeof PAGE_STATE!=='undefined')PAGE_STATE.scBlocked={form:name,s:'onesite',m:m};
        var i=form&&form.querySelector&&form.querySelector('input[name="'+(FIELDS[name]||'clientCode')+'"]');if(i){var b=boxFor(i);b.className='sc-box small sc-bad sc-stress';b.innerHTML='✗ '+e(m);}return;}
      return orig.apply(this,arguments);};
    w._one=true;w._sc=orig._sc;FORMS[name]=w;}
  var ONE=['addsite','clnew','cledit','clmerge'];

  /* ---------- block saving a form with a bad code ---------- */
  function block(form,name,code,st){var i=form&&form.querySelector?form.querySelector('input[name="'+FIELDS[name]+'"]'):null;
    toast(st.s==='format'?st.m:'Not saved: '+st.m);if(i){render1(i,true);try{i.focus();}catch(x){}}
    if(typeof PAGE_STATE!=='undefined')PAGE_STATE.scBlocked={form:name,code:code,s:st.s};}
  function guard(name){var orig=FORMS[name];if(!orig||orig._sc)return;
    var w=function(form,d){var self=this,args=arguments,code=codeOf(name,d),st=status(code);
      if(typeof PAGE_STATE!=='undefined')PAGE_STATE.scBlocked=null;
      if(st.s==='ok'||st.s==='missing'||st.s==='off')return orig.apply(self,args);
      if(st.s==='wait'||st.s==='error'||(SC.list&&Date.now()-SC.at>FRESH)){if(st.s==='format')return block(form,name,code,st);
        toast('Checking sites…');return ensure().then(function(){var s2=status(code);if(s2.s==='ok'||s2.s==='missing'||s2.s==='off')orig.apply(self,args);else block(form,name,code,s2);});}
      block(form,name,code,st);};
    w._sc=true;w._orig=orig;FORMS[name]=w;if(ONE.indexOf(name)>=0)guardOne(name);}
  SC.guardAll=function(){Object.keys(FIELDS).forEach(guard);ONE.forEach(guardOne);};SC.guardAll();
  // other scripts may replace FORMS.x later (e.g. the live data layer): wrap again just before the app's own submit handler runs
  document.addEventListener('submit',function(ev){var f=ev.target;if(!f||!f.dataset)return;var n=f.dataset.form;if(n&&(FIELDS[n]||f.getAttribute('data-sitecode-field'))){if(!FIELDS[n])FIELDS[n]=f.getAttribute('data-sitecode-field');guard(n);}if(n&&ONE.indexOf(n)>=0)guardOne(n);},true);

  var css=document.createElement('style');css.textContent='.sc-box{margin-top:4px;line-height:1.4}.sc-box.sc-ok{color:#1d7a3a}.sc-box.sc-bad{color:#b3261e}.sc-box.sc-warn{color:#8a5a00}.sc-box.sc-stress{outline:2px solid #b3261e;outline-offset:2px;border-radius:4px;padding:2px 4px}.sc-box .sc-confirm{margin-top:6px;padding:8px;border:1px solid #c9d2e3;border-radius:6px;background:#f6f8fc;color:#1b2333}.sc-box .sc-err{margin-top:4px;color:#b3261e}.sc-box button.small{margin-top:4px}.sc-refresh{padding:0 6px!important;min-width:0}';
  (document.head||document.documentElement).appendChild(css);
})();
