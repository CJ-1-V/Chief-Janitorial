/* nobrkwarn1 – owner Oct 23 2026: "when people add no break or add shifts manually show them a warning message that these hours
   are sent to farms for confirmation". Worker / employee / subcontractor / crew-lead screens only; office screens are not changed.
   - Manual shift forms (employee missed shift, sub-worker missed shift, subcontractor Add shift, crew-lead crew hours, crew-lead
     fix crew times): a yellow note at the top of the form, a second line when "no break" is picked, and a confirm on save.
   - Clock out: the note shows when "I did not get my break" is ticked, and the line is added to the existing "Clock out now?" box.
   Additive wrappers only; no data or rule changes. Loaded right before v2-nohome.js. */
(function(){
'use strict';
if(typeof FORMS==='undefined'||typeof afterRender!=='function')return;
var T={
  farm:'These hours will be sent to the farm to confirm.',
  office:'The office checks these hours first. Then they are sent to the farm to confirm.',
  nobrk:'No break: the farm will be asked to confirm this.',
  ask:'Is everything right? Press OK to send.',
  no:'Not sent. Check the hours, then press the button again.',
  clk:'Missed break: the farm will be asked to confirm this.'
};
/* form name -> {msg, break field: 'chk' = checkbox breakTaken (unticked = no break), 'sel' = select brk (none = no break); the shared "Break given" select (brkMin, v2-hoursrules) wins when present: None = no break} */
var F={missedshift:{m:'farm',b:'chk'},swmissed:{m:'office',b:'chk'},subaddshift:{m:'office',b:'sel'},mtlead:{m:'office',b:'sel'},crewadj:{m:'farm',b:'chk'}};
function E(s){return typeof esc==='function'?esc(s):String(s==null?'':s);}
function staff(){return typeof ME!=='undefined'&&ME&&(ME.type==='employee'||ME.type==='worker'||ME.type==='sub');}
function noBrk(form,cfg){if(!form)return false;var bm=form.querySelector('select[name=brkMin]')||(form.id?document.querySelector('[form="'+form.id+'"][name=brkMin]'):null);if(bm&&bm.value!=='')return bm.value==='0';if(cfg.b==='sel'){var s=form.querySelector('[name=brk]')||document.querySelector('[form="'+form.id+'"][name=brk]');return !!(s&&s.value==='none');}
  var c=form.querySelector('[name=breakTaken]')||(form.id?document.querySelector('[form="'+form.id+'"][name=breakTaken]'):null);return !!(c&&!c.checked);}
function box(id,msg){return '<div class="alert warn nbw" id="'+id+'" role="note"><b>⚠ '+E(msg)+'</b><div class="nbw-nb" hidden>'+E(T.nobrk)+'</div></div>';}
function sync(){document.querySelectorAll('form[data-form]').forEach(function(f){var cfg=F[f.dataset.form];if(!cfg||cfg.b!=='chk'&&cfg.b!=='sel')return;
    var w=f.dataset.form==='crewadj'?document.getElementById('nbw-crewadj'):f.querySelector('.nbw');if(!w)return;var nb=w.querySelector('.nbw-nb');
    if(f.dataset.form==='crewadj'){var any=[].some.call(document.querySelectorAll('form[data-form=crewadj]'),function(x){return noBrk(x,cfg);});nb.hidden=!any;}else nb.hidden=!noBrk(f,cfg);});
  var cb=document.getElementById('breakMissed'),cw=document.getElementById('nbw-clock');if(cb&&cw)cw.hidden=!cb.checked;}
function inject(root){if(!staff())return;var r=root||document;
  Object.keys(F).forEach(function(k){if(k==='crewadj')return;r.querySelectorAll('form[data-form="'+k+'"]').forEach(function(f){if(f.querySelector('.nbw'))return;f.insertAdjacentHTML('afterbegin',box('nbw-'+k,T[F[k].m]));});});
  var ca=r.querySelector('form[data-form=crewadj]');if(ca&&!document.getElementById('nbw-crewadj')){var tw=ca.closest('.tw')||ca.closest('table');if(tw)tw.insertAdjacentHTML('beforebegin',box('nbw-crewadj',T.farm));}
  var cb=r.querySelector('#breakMissed');if(cb&&!document.getElementById('nbw-clock')){var lb=cb.closest('label')||cb;lb.insertAdjacentHTML('afterend','<div class="alert warn nbw" id="nbw-clock" role="note" hidden><b>⚠ '+E(T.farm)+'</b><div>'+E(T.clk)+'</div></div>');}
  sync();}
var oa=afterRender;afterRender=function(root){oa.apply(this,arguments);try{inject(root);}catch(e){if(typeof logError==='function')logError(e);}};
document.addEventListener('change',function(e){try{var t=e.target;if(t&&(t.name==='brk'||t.name==='brkMin'||t.name==='breakTaken'||t.id==='breakMissed'))sync();}catch(x){}},true);
/* confirm on save */
Object.keys(F).forEach(function(k){var o=FORMS[k];if(typeof o!=='function')return;FORMS[k]=function(f,d){if(staff()){var msg=T[F[k].m]+(noBrk(f,F[k])?'\n'+T.nobrk:'')+'\n\n'+T.ask;if(!window.confirm(msg)){if(typeof toast==='function')toast(T.no);return;}}return o.apply(this,arguments);};});
/* clock out: add the line to the existing "Clock out now?" box when the break was missed */
if(typeof modal==='function'){var om=modal;modal=function(h){try{if(staff()&&typeof h==='string'&&h.indexOf('<h2>Clock out now?</h2>')===0&&PAGE_STATE&&PAGE_STATE.co&&PAGE_STATE.co.bm)h=h.replace('</p>','</p><div class="alert warn nbw" id="nbw-comodal"><b>⚠ '+E(T.farm)+'</b><div>'+E(T.clk)+'</div></div>');}catch(e){}return om.apply(this,[h].concat([].slice.call(arguments,1)));};}
})();
