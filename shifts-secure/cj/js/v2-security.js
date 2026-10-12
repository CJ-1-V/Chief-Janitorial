/* v2-security.js – role checks for every action added in round 3 (loaded last). TEST ONLY. */
'use strict';
ADMIN_ONLY_ACT.push('reinstate','passmodal','reqorig','docfilter','holdrel','invunhold','minwagedel','tempoff');
ADMIN_ONLY_FORM.push('terminate','schedulea','ratechg','holdded','invhold','minwage','roledocs','docyears','firmagrpub','tempon','tempext');
ROLE_ONLY.book=['worker','tester'];
ROLE_ONLY.workerrate=['sub'];ROLE_ONLY.workerrole=['sub'];ROLE_ONLY.whrange=['sub'];
ROLE_ONLY.manualdoc=['sub','worker','admin'];
ROLE_ONLY.clockin2=['employee','worker'];ROLE_ONLY.clockout2=['employee','worker'];ROLE_ONLY.clockoutyes=['employee','worker'];
ROLE_ONLY.firmsign=['firm'];ROLE_ONLY.firmagrdl=['firm','admin'];ROLE_ONLY.firmagrprint=['firm','admin'];
/* employees never sign up for shifts (the office assigns them); workers only for subcontractor crew shifts */
ACT.book=(function(ob){return function(el){if(ME.type==='employee'){toast('Company employees do not sign up for shifts – the office assigns them.');return;}var sh=DB.shifts.filter(function(s){return s.id===el.dataset.id;})[0];if(ME.type==='worker'&&sh&&sh.kind!=='crew'){toast('Only subcontractor crew shifts.');return;}return ob(el);};})(ACT.book);
