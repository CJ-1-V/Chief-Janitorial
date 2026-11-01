/* v2-overnight.js – overnight shifts (TEST ONLY). A finish time earlier than the start time means the next day; max 16 hours.
   The whole shift is ONE entry dated on the day it STARTED: one invoice line, the 5-hour daily minimum counted once on the start day,
   the single 30-minute break deducted once (only if taken), payroll in the pay period of the start date. 7/14-day windows count from
   the start date. Loaded right after core/person so every later module uses these helpers. */
'use strict';
var MAX_SHIFT_H=16;
function hmMin(v){var x=String(v||'').split(':');return (+x[0])*60+(+x[1]);}
/* dst1: with a date (the day the shift STARTED), hours come from real America/Halifax timestamps, so a shift over the DST change
   is 1 h longer (fall back, early Nov) or 1 h shorter (spring forward, March). Without a date: wall-clock difference, as before. */
var HFX_TZ='America/Halifax',_hfxFmt=null;
function hfxOffMin(ms){try{_hfxFmt=_hfxFmt||new Intl.DateTimeFormat('en-US',{timeZone:HFX_TZ,hourCycle:'h23',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});var o={};_hfxFmt.formatToParts(new Date(ms)).forEach(function(x){o[x.type]=x.value;});return (Date.UTC(+o.year,+o.month-1,+o.day,+o.hour%24,+o.minute)-Math.floor(ms/60000)*60000)/60000;}catch(e){return -new Date(ms).getTimezoneOffset();}}
/* Halifax wall time (date 'YYYY-MM-DD' + minutes after midnight, may be >=1440 for the next day) -> epoch ms. Repeated hour: first (daylight) one. */
function hfxMs(date,min){var x=String(date).slice(0,10).split('-'),g=Date.UTC(+x[0],+x[1]-1,+x[2])+min*60000,o1=hfxOffMin(g-hfxOffMin(g)*60000),o2=hfxOffMin(g-o1*60000);return g-Math.max(o1,o2)*60000;}
hrs=function(a,b,date){if(!a||!b)return 0;var m=hmMin(b)-hmMin(a);if(m<0)m+=1440;if(!date||!/^\d{4}-\d{2}-\d{2}/.test(String(date)))return m/60;var s=hmMin(a);return Math.round((hfxMs(date,s+m)-hfxMs(date,s))/60000)/60;};
function isOvernight(a,b){return !!(a&&b&&hmMin(b)<hmMin(a));}
function plus1(a,b){return isOvernight(a,b)?' (+1 day)':'';}
function plus1H(a,b){return isOvernight(a,b)?' <span class="pill s-temp plus1">(+1 day)</span>':'';}
/* '' when OK, else a message. Finish earlier than start = next day. */
function spanErr(a,b){if(!a||!b)return 'Enter a start and a finish time.';if(a===b)return 'Finish time must be different from the start time.';if(hrs(a,b)>MAX_SHIFT_H)return 'A shift can be at most '+MAX_SHIFT_H+' hours (a finish earlier than the start counts as the next day).';return '';}
/* absolute minutes (local) – handles shifts that cross midnight */
function ivl(date,a,b){var d=parseD(date);d.setHours(0,0,0,0);var s=Math.round(d.getTime()/60000)+hmMin(a);return [s,s+(b?Math.round(hrs(a,b,date)*60):1)];}
function overlapsAny(userId,date,a,b,exceptId){var me=ivl(date,a,b);return DB.time.some(function(t){if(t.userId!==userId||t.test||t.id===exceptId||!t.in)return false;if(Math.abs(daysBetween(t.date,date))>1)return false;if(t.lateEntry==='rejected')return false;var o=ivl(t.date,t.in,t.out||null);if(!t.out)o[1]=o[0]+MAX_SHIFT_H*60;return me[0]<o[1]&&o[0]<me[1];});}
/* clock-out from real timestamps: crossing midnight allowed, capped at 16 h */
function clockOutHM(t,finMs){var startMs=hmMsLocal(t.date,t.in),cap=startMs+MAX_SHIFT_H*3600000;var capped=false;if(finMs>cap){finMs=cap;capped=true;}if(finMs<=startMs)return {out:t.in,capped:false};var d=new Date(finMs);return {out:pad(d.getHours())+':'+pad(d.getMinutes()),capped:capped};}
function hmMsLocal(date,hm){var p=parseD(date);p.setHours(+hm.slice(0,2),+hm.slice(3,5),0,0);return p.getTime();}
