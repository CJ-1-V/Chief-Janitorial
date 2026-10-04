/* Oct 4, 2026 (live): unscramble.ca-style motion. See css/motion.css. Animates only on first load and when the
   screen changes (not when the same screen re-renders after a button press), counts numbers up like the
   unscramble.ca stats, and does nothing at all for prefers-reduced-motion: reduce.
   Live register app: hooks afterRender (security.js; also wrapped by v2-declutter/v2-polish) and reads ME, which the
   data layer (store-supabase.js) sets. The boot "Loading…" placeholder is not rendered through afterRender, so the
   intro plays on the first real screen; a background refresh of the same screen (same hash, same person) does not
   re-animate. If afterRender is missing, this file does nothing. */
(function(){
  var mq=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
  function reduced(){return !!(mq&&mq.matches);}
  function sync(){document.documentElement.classList.toggle('motion',!reduced());}
  sync();if(mq){if(mq.addEventListener)mq.addEventListener('change',sync);else if(mq.addListener)mq.addListener(sync);}
  var last=null,lastWho=null,first=true,timer=null;
  function countUp(el){
    var txt=(el.textContent||'').trim();if(!/^\d{1,6}$/.test(txt))return;var target=Number(txt);if(target<2)return;
    el.style.setProperty('--cu-color',getComputedStyle(el).color);el.style.setProperty('--cu-to',target);el.classList.add('m-cu');
    setTimeout(function(){el.classList.remove('m-cu');},800);
  }
  window.MOTION={state:function(){return {intro:first,last:last};}};
  if(typeof afterRender!=='function')return;
  var oa=afterRender;
  afterRender=function(root){
    oa(root);
    try{
      var app=document.getElementById('app');if(!root||root!==app)return;
      var h=(location.hash||'#/').split('?')[0],who=(typeof ME!=='undefined'&&ME)?ME.id:'',changed=(h!==last||who!==lastWho);
      app.classList.remove('m-intro','m-screen','m-quick');
      if(reduced()){first=false;last=h;lastWho=who;return;}
      if(first||changed){
        app.classList.add(first?'m-intro':'m-screen');
        if(who&&ME&&(ME.type==='worker'||ME.type==='employee'))app.classList.add('m-quick');
        var kids=app.querySelectorAll('#main > *');for(var i=0;i<kids.length;i++)kids[i].style.setProperty('--mi',Math.min(i,6));
        [].forEach.call(app.querySelectorAll('#main .stat'),countUp);
        clearTimeout(timer);timer=setTimeout(function(){app.classList.remove('m-intro','m-screen','m-quick');},1500);
      }
      first=false;last=h;lastWho=who;
    }catch(e){}
  };
})();
