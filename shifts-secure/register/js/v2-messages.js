/* Friendly messages everywhere (2026-10-06; test copy + live).
   - Raw technical text (JS errors, server/Supabase codes, 'undefined', 'null') is never shown to people.
     It is mapped to a short plain message and the detail goes to the browser console only.
   - The bare "Not allowed." toast becomes one clear sentence.
   - Offline / back-online notice, and a friendly note if an action fails unexpectedly. */
'use strict';
var MSG_GENERIC='Something went wrong. Please try again. If it keeps happening, contact the office.';
var MSG_NET='No connection. Check your internet and try again.';   /* same words as the live store (store-supabase.js friendly()) */
var MSG_DENIED='You can\u2019t do that with this account. If you think this is wrong, contact the office.';
var MSG_TECH_RE=/(TypeError|ReferenceError|SyntaxError|RangeError|EvalError|\bundefined\b|^null$|\bnull\b(?! *\w)|\bNaN\b|\[object |Failed to fetch|NetworkError|Load failed|network request|ECONN|ETIMEDOUT|ERR_[A-Z_]+|JWT|PGRST|supabase|postgres|duplicate key|violates|row[- ]level security|permission denied for|relation "|column "|does not exist|\b(status|http|error|code)\s*:?\s*[45]\d\d\b|Unexpected token|in JSON at position|Cannot read prop|is not a function|is not defined|QuotaExceeded|AbortError|stack trace|Exception)/i;
function msgText(e){if(e==null)return '';if(typeof e==='string')return e;return String(e.message||e.error_description||e.error||e.msg||e.details||e);}
function friendlyError(e){var m=msgText(e).trim();
  var out=!m||/^(undefined|null|\[object Object\]|error)$/i.test(m)?MSG_GENERIC
    :(navigator.onLine===false||/Failed to fetch|NetworkError|Load failed|network request|ECONN|ETIMEDOUT|timed? ?out|ERR_INTERNET|ERR_NETWORK/i.test(m))?MSG_NET
    :/JWT|token (is )?expired|session (has )?expired|not authenticated|\b401\b/i.test(m)?'Your sign-in has expired. Please sign in again.'
    :/row[- ]level security|permission denied|not authori[sz]ed|\b403\b/i.test(m)?MSG_DENIED
    :/duplicate key|unique constraint|23505/i.test(m)?'That is already saved \u2013 it looks like a duplicate. Please check and try again.'
    :/rate limit|too many requests|\b429\b/i.test(m)?'Too many tries. Please wait a few minutes and try again.'
    :/user is banned|banned/i.test(m)?'This account is turned off. Please contact the office.'
    :/QuotaExceeded/i.test(m)?'This device is out of space for the app. Please contact the office.'
    :MSG_TECH_RE.test(m)?MSG_GENERIC:m;
  if(out!==m){try{console.warn('[shown to user as a friendly message] detail:',e);}catch(x){}}
  return out;}
(function(){var ot=toast;toast=function(m){var s=msgText(m);
  if(/^\s*Not allowed\.?\s*$/i.test(s))s=MSG_DENIED;
  else if(/^\s*Wrong login or password\.?\s*$/i.test(s))s=typeof MSG_WRONG_LOGIN==='string'?MSG_WRONG_LOGIN:s;   /* live store wording -> same as the test copy */
  else if(/^Password needs: /.test(s)&&typeof pwMsg==='function')s=pwMsg({msgs:s.replace(/^Password needs: /,'').replace(/\.$/,'').split(/, (?=not |at least|no common)/)});   /* live sign-up / change password */
  else if(/^\s*Passwords do not match\.?\s*$/i.test(s))s='The two passwords are not the same. Please type them again.';
  else if(/^\s*Choose your employer\.?\s*$/i.test(s))s='Please choose your employer (the crew company that hired you).';
  else s=friendlyError(s);
  return ot(s);};})();

/* offline / back online */
function netBanner(on){var b=document.getElementById('netbanner');
  if(on){if(b)return;b=document.createElement('div');b.id='netbanner';b.className='netbanner';b.setAttribute('role','status');
    b.innerHTML='<b>You are offline.</b> Check your internet connection. Changes can\u2019t be saved until you are back online.';document.body.appendChild(b);}
  else if(b)b.parentNode.removeChild(b);}
window.addEventListener('offline',function(){netBanner(true);});
window.addEventListener('online',function(){if(document.getElementById('netbanner')){netBanner(false);toast('Back online \u2713');}});
document.addEventListener('DOMContentLoaded',function(){if(navigator.onLine===false)netBanner(true);});

/* if something fails unexpectedly, say so plainly (once every 15 s at most); the detail stays in the console */
(function(){var last=0;function oops(detail){if(/ResizeObserver|Script error\.?$/i.test(msgText(detail)))return;var n=Date.now();if(n-last<15000)return;last=n;
    try{console.warn('[unexpected error – friendly note shown]',detail);}catch(x){}try{toast(navigator.onLine===false?MSG_NET:'Sorry \u2013 that did not work. Please try again. If it keeps happening, contact the office.');}catch(x){}}
  window.addEventListener('error',function(ev){oops(ev.error||ev.message);});
  window.addEventListener('unhandledrejection',function(ev){oops(ev.reason);});})();
