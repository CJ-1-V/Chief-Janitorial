/* subsafe1: subcontractor records loaded from the live DB may have no `company` object
   (office "Add person → subcontractor" on live). Many screens read s.company.legalName and crash
   ("Sorry – this screen could not open"). Give every sub/user an in-memory, NON-enumerable empty
   company so nothing is written back to the database, and make employerName null-safe. */
(function(){
  function fix(){try{if(typeof DB==='undefined'||!DB||!DB.users)return;DB.users.forEach(function(u){if(u&&u.type==='sub'&&(u.company==null||typeof u.company!=='object')){Object.defineProperty(u,'company',{value:{legalName:u.name||''},enumerable:false,writable:true,configurable:true});}});}catch(e){}}
  window.subsafeFix=fix;
  if(typeof employerName==='function'){employerName=function(u){if(!u)return '(not linked)';if(u.type==='employee')return 'UnScramble – The HR Company Inc.';var s=subOf(u);return s?((s.company&&s.company.legalName)||s.name||'(not linked)'):'(not linked)';};}
  if(typeof render==='function'){var r0=render;render=function(){fix();return r0.apply(this,arguments);};}
  fix();
})();
