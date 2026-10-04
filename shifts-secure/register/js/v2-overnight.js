/* v2-overnight.js – overnight shifts (TEST ONLY). A finish time earlier than the start time means the next day; max 16 hours.
   The whole shift is ONE entry dated on the day it STARTED: one invoice line, the 5-hour daily minimum counted once on the start day,
   the single 30-minute break deducted once (only if taken), payroll in the pay period of the start date. 7/14-day windows count from
   the start date. Loaded right after core/person so every later module uses these helpers. */
'use strict';
var MAX_SHIFT_H=16;
function hmMin(v){var x=String(v||'').split(':');return (+x[0])*60+(+x[1]);}
hrs=function(a,b){if(!a||!b)return 0;var m=hmMin(b)-hmMin(a);if(m<0)m+=1440;return m/60;};
function isOvernight(a,b){return !!(a&&b&&hmMin(b)<hmMin(a));}
function plus1(a,b){return isOvernight(a,b)?' (+1 day)':'';}
function plus1H(a,b){return isOvernight(a,b)?' <span class="pill s-temp plus1">(+1 day)</span>':'';}
/* '' when OK, else a message. Finish earlier than start = next day. */
function spanErr(a,b){if(!a||!b)return 'Enter a start and a finish time.';if(a===b)return 'Finish time must be different from the start time.';if(hrs(a,b)>MAX_SHIFT_H)return 'A shift can be at most '+MAX_SHIFT_H+' hours (a finish earlier than the start counts as the next day).';return '';}
/* absolute minutes (local) – handles shifts that cross midnight */
function ivl(date,a,b){var d=parseD(date);d.setHours(0,0,0,0);var s=Math.round(d.getTime()/60000)+hmMin(a);return [s,s+(b?Math.round(hrs(a,b)*60):1)];}
function overlapsAny(userId,date,a,b,exceptId){var me=ivl(date,a,b);return DB.time.some(function(t){if(t.userId!==userId||t.test||t.id===exceptId||!t.in)return false;if(Math.abs(daysBetween(t.date,date))>1)return false;if(t.lateEntry==='rejected')return false;var o=ivl(t.date,t.in,t.out||null);if(!t.out)o[1]=o[0]+MAX_SHIFT_H*60;return me[0]<o[1]&&o[0]<me[1];});}
/* clock-out from real timestamps: crossing midnight allowed, capped at 16 h */
function clockOutHM(t,finMs){var startMs=hmMsLocal(t.date,t.in),cap=startMs+MAX_SHIFT_H*3600000;var capped=false;if(finMs>cap){finMs=cap;capped=true;}if(finMs<=startMs)return {out:t.in,capped:false};var d=new Date(finMs);return {out:pad(d.getHours())+':'+pad(d.getMinutes()),capped:capped};}
function hmMsLocal(date,hm){var p=parseD(date);p.setHours(+hm.slice(0,2),+hm.slice(3,5),0,0);return p.getTime();}
