/* "Home" link back to unscramble.ca (signinload1 add-on, owner request Oct 6, 2026 1:33 PM). Pairs with css/homelink.css.
   unscramble.ca's "Compliance & Login" button opens this app; this gives a clear way back.
   - Same tab (no new tab). Signing in is kept: the link only leaves the page, it never signs out, so coming back opens
     the app still signed in.
   - Sign-in page and forgot-password page: "unscramble.ca" button at the top right of the navy header. On the sign-in
     page only, the logos (header logo and the big logo) also go to unscramble.ca.
   - Signed in, office / farm / subcontractor (and the waiting-for-approval, set-a-new-password and terms screens):
     "unscramble.ca" next to Sign out in the header.
   - Workers, employees and crew leads (phone-style layout): a home button in the top bar, and
     "Home – unscramble.ca" in the Menu above Sign out.
   Works by adding to the page that layout() draws, so no other file changes. Turn off: remove the 2 lines in index.html. */
(function(){
  if(typeof layout!=='function')return;
  var HOME='https://www.unscramble.ca/';
  var ICON='<svg class="ush-ic" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false"><path d="M8 1.5 1 7.6l1 1.1.9-.8V14.5h4.3v-4h1.6v4h4.3V7.9l.9.8 1-1.1z" fill="currentColor"/></svg>';
  function link(cls,txt){return '<a class="ush '+cls+'" href="'+HOME+'" aria-label="Home – go to unscramble.ca" title="Go to unscramble.ca (you stay signed in)">'+ICON+'<span class="ush-t">'+txt+'</span></a>';}
  function logoLink(img,cls){return '<a class="ush-logo '+cls+'" href="'+HOME+'" title="Go to unscramble.ca">'+img+'</a>';}
  var SIGNOUT_HDR='<button class="small sec" data-act="logout">',SIGNOUT_MENU='<button class="sec" data-act="logout" style="margin-top:12px;width:100%">';
  var ol=layout;
  layout=function(content){
    var x=ol.apply(this,arguments);
    try{
      if(x.indexOf('class="ush ')>=0)return x;
      var me=typeof ME!=='undefined'&&!!ME,c=String(content||'');
      if(x.indexOf('<header class="topbar">')>=0){                       /* workers / employees / crew leads */
        x=x.replace('<div class="topbar-r">','<div class="topbar-r">'+link('ush-top','Home'));
      }else if(x.indexOf('<header class="top">')>=0){                     /* everyone else, signed in or not */
        if(me&&x.indexOf(SIGNOUT_HDR)>=0)x=x.replace(SIGNOUT_HDR,link('ush-hdr','unscramble.ca')+SIGNOUT_HDR);
        else x=x.replace('</header>','<div class="who ush-who">'+link('ush-hdr','Home<span class="ush-x"> \u2013 unscramble.ca</span>')+'</div></header>');
        if(!me&&c.indexOf('data-form="login"')>=0){                       /* sign-in page only: the logos link too */
          x=x.replace(/(<header class="top">)(<img [^>]*>)/,function(m,h,img){return h+logoLink(img,'ush-logo-hdr');});
          x=x.replace(/<img class="logo-big"[^>]*>/,function(img){return logoLink(img,'ush-logo-big');});
        }
      }
      if(x.indexOf(SIGNOUT_MENU)>=0)x=x.replace(SIGNOUT_MENU,'<a class="ush ush-menu" href="'+HOME+'">'+ICON+'<span class="ush-t">Home – unscramble.ca</span></a>'+SIGNOUT_MENU);
    }catch(e){}
    return x;
  };
})();
