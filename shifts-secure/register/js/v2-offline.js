/* offline1 – registers sw.js (scope /shifts-secure/register/ only) so a phone with no internet sees the built-in
   "No internet / Connect to clock in." page instead of a browser error. Never caches data (see sw.js).
   No install card: "Download the app" (js/v2-dlapp.js) is unchanged.
   One phone: open the app with ?sw=off to remove the worker and its cache there. Whole rollback: replace sw.js with rollback/sw-off.js. */
(function(){
  try{
    if(!('serviceWorker' in navigator)||!window.isSecureContext)return;
    var scopePath=(function(){try{return new URL('./',location.href).pathname;}catch(e){return '/shifts-secure/register/';}})();
    if(/[?&]sw=off(&|$)/.test(location.search)){
      var clear=function(){try{if(window.caches)caches.keys().then(function(ks){ks.forEach(function(k){if(k.indexOf('us-reg-')===0)caches.delete(k);});});}catch(e){}};
      navigator.serviceWorker.getRegistrations().then(function(rs){return Promise.all(rs.map(function(r){try{if(new URL(r.scope).pathname===scopePath)return r.unregister();}catch(e){}}));}).then(clear,clear);
      window.addEventListener('load',function(){setTimeout(clear,1500);setTimeout(clear,6000);});
    }else{
      var reg=function(){navigator.serviceWorker.register('sw.js',{scope:'./',updateViaCache:'none'}).catch(function(e){try{console.warn('[offline1] service worker not registered',e&&e.message);}catch(x){}});};
      if(document.readyState==='complete')reg();else window.addEventListener('load',reg);
    }
  }catch(e){}
})();
