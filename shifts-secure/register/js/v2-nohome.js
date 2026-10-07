/* nohome1 – employees and subcontractors only sign in and sign out: no links from the app to the company website (owner Oct 6, 2026
   11:34 PM: "Also disable the employees to reach home page of the company, they just login and out"; Oct 7 12:04 AM: "when I say
   employee it also means a subcontractor").
   Takes away the "Home" / "unscramble.ca" links that js/v2-homelink.js adds (signinload1, PR #29):
   - Signed-out pages (sign-in, forgot password, sign-up, 2-step): nobody is known yet, so no Home button and the logos are plain
     pictures again (as before signinload1).
   - Workers, crew leads, employees, subcontractors and testers, on every screen (phone layout and the waiting-for-approval /
     terms / new-password screens): no Home button in the top bar, no "unscramble.ca" next to Sign out, none in the Menu.
   - Office (admin) and farms/clients (firm) keep the "unscramble.ca" button next to Sign out.
   Safety net on those same pages: any other link to the company website (unscramble.ca or chiefjanitorial.com outside
   /shifts-secure/, or a "/..." or "../" link) is shown as plain text. tel:, mailto: and in-app (#/...) links are kept.
   Sign out already goes back to this app's sign-in page (#/), not the website. Load after all other js/.
   Turn off: remove the script tag in index.html. */
(function(){
  if(typeof layout!=='function')return;
  var EMP={worker:1,employee:1,sub:1,tester:1};
  function noHome(){return typeof ME==='undefined'||!ME||!!EMP[ME.type];}
  function siteLink(h){h=String(h||'').trim();
    if(/^(https?:)?\/\/(www\.)?(unscramble\.ca|chiefjanitorial\.com)(\/|$|\?|#)/i.test(h))return !/^(https?:)?\/\/[^\/]+\/shifts-secure\//i.test(h);
    if(/^\/(?!\/)/.test(h))return !/^\/shifts-secure\//i.test(h);
    return /^\.\.(\/|$)/.test(h);}
  function strip(x){
    x=String(x);
    x=x.replace(/<a class="ush [^"]*"[^>]*>[\s\S]*?<\/a>/g,'');                         /* Home / unscramble.ca buttons */
    x=x.replace(/<div class="who ush-who"><\/div>/g,'');
    x=x.replace(/<a class="ush-logo [^"]*"[^>]*>(<img [^>]*>)<\/a>/g,'$1');             /* sign-in logos: picture only */
    x=x.replace(/<a\b([^>]*?)\bhref="([^"]*)"([^>]*)>([\s\S]*?)<\/a>/g,function(m,a,h,b,inner){return siteLink(h)?'<span class="nh-off">'+inner+'</span>':m;});
    return x;}
  window.nhStrip=strip;window.nhNoHome=noHome;
  var ol=layout;
  layout=function(){var x=ol.apply(this,arguments);try{if(noHome())x=strip(x);}catch(e){}return x;};
  if(typeof modal==='function'){var om=modal;modal=function(h){try{if(noHome())arguments[0]=strip(h);}catch(e){}return om.apply(this,arguments);};}
})();
