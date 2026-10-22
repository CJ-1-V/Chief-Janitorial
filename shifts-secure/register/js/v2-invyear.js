/* v2-invyear.js – revfilter1 (owner Oct 22 2026, 10:48 AM): Year filter on the client invoice lists.
   Office Invoices screen and Farms & clients (month boxes), each farm's own invoice list on its People page (same month boxes),
   and the farm's "My invoices" list. Options: All years, then each year that has invoices in that list, newest first.
   Default: All years (that is what every list showed before, so nothing disappears unless someone picks a year).
   Year = the year of the invoice's WORK month (same rule the month boxes use); no period → invoice date.
   Display only: it hides boxes / cards that are already on screen, so who sees what (owner-only farm invoices, the farm's own
   invoices, no money for the Office Assistant) is unchanged. Front end only, no data changed. Load after v2-invbox.js. */
(function(){
'use strict';
if(typeof document==='undefined'||typeof MutationObserver!=='function')return;
function st(){var P=window.PAGE_STATE||{};return P.invYear||'';}
function setY(y){if(window.PAGE_STATE)PAGE_STATE.invYear=y||'';}
function yearOfInv(i){if(!i)return '';var m=typeof window.ibMonthOf==='function'?window.ibMonthOf(i):'';var y=String(m||i.issued||'').slice(0,4);return /^\d{4}$/.test(y)?y:'';}
function sel(years,cur,cls){if(cur&&years.indexOf(cur)<0)years=years.concat([cur]);years=years.slice().sort().reverse();
  return '<label class="small iy-lbl"><b>Year</b> <select class="iy-sel '+cls+'" aria-label="Year"><option value="">All years</option>'+years.map(function(y){return '<option value="'+y+'"'+(y===cur?' selected':'')+'>'+y+'</option>';}).join('')+'</select></label>';}
function uniq(a){var o={};a.forEach(function(x){if(x)o[x]=1;});return Object.keys(o);}
var busy=false;
function apply(){if(busy)return;busy=true;try{var Y=st();
  /* 1. month boxes (office: Farms & clients, Invoices, a farm's People page; Assistant status list) */
  [].forEach.call(document.querySelectorAll('.ib-wrap'),function(w){var btns=[].slice.call(w.querySelectorAll('[data-ib-month]'));var bar=w.querySelector('.iy-bar');
    if(!btns.length){if(bar)bar.remove();return;}
    var years=uniq(btns.map(function(b){return String(b.getAttribute('data-ib-month')||'').slice(0,4);}));
    if(!bar){bar=document.createElement('div');bar.className='row iy-bar';w.insertBefore(bar,w.firstChild);}
    var want=sel(years,Y,'iy-ib');if(bar.getAttribute('data-k')!==want){bar.innerHTML=want;bar.setAttribute('data-k',want);}
    var shown=0;btns.forEach(function(b){var ok=!Y||String(b.getAttribute('data-ib-month')).slice(0,4)===Y;b.style.display=ok?'':'none';if(ok)shown++;});
    var none=w.querySelector('.iy-none');if(!shown&&!none){none=document.createElement('p');none.className='muted iy-none';none.textContent='No invoices in '+Y+'.';bar.after(none);}else if(shown&&none)none.remove();});
  /* 2. the farm's own list (My invoices) */
  var L=document.getElementById('myinvlist');if(L&&L.tagName==='DIV'){var cards=[].slice.call(L.querySelectorAll('.invcard'));var inv=function(c){var b=c.querySelector('[data-act=civview][data-id]');var id=b&&b.getAttribute('data-id');return (window.DB&&DB.clientInvoices||[]).filter(function(i){return i&&i.id===id;})[0];};
    var ys=cards.map(function(c){var y=yearOfInv(inv(c));c.setAttribute('data-iy',y);return y;});var bar2=document.getElementById('iybarmy');
    if(!bar2){bar2=document.createElement('div');bar2.id='iybarmy';bar2.className='row iy-bar';L.parentNode.insertBefore(bar2,L);}
    var w2=sel(uniq(ys),Y,'iy-my');if(bar2.getAttribute('data-k')!==w2){bar2.innerHTML=w2;bar2.setAttribute('data-k',w2);}
    var n=0;cards.forEach(function(c){var ok=!Y||c.getAttribute('data-iy')===Y;c.style.display=ok?'':'none';if(ok)n++;});
    var nn=document.getElementById('iynonemy');if(!n&&cards.length){if(!nn){nn=document.createElement('p');nn.id='iynonemy';nn.className='muted';nn.textContent='No invoices in '+Y+'.';L.parentNode.insertBefore(nn,L);}}else if(nn)nn.remove();}
  /* 3. the farm's "Your invoices" table on its home page */
  var T=document.getElementById('myclientinv');if(T){var rows=[].slice.call(T.querySelectorAll('tr')),last='',ys3=[],mine=(window.DB&&DB.clientInvoices||[]).filter(function(i){return i&&window.ME&&i.firmId===ME.id;});
    rows.forEach(function(r){if(r.querySelector('th'))return;if(r.hasAttribute('data-inv')){var n=r.getAttribute('data-inv');last=yearOfInv(mine.filter(function(i){return String(i.number)===n;})[0]);ys3.push(last);}r.setAttribute('data-iy',last);});
    var tw=T.closest('.tw')||T,bar3=document.getElementById('iybarfh');if(!bar3){bar3=document.createElement('div');bar3.id='iybarfh';bar3.className='row iy-bar';tw.parentNode.insertBefore(bar3,tw);}
    var w3=sel(uniq(ys3),Y,'iy-fh');if(bar3.getAttribute('data-k')!==w3){bar3.innerHTML=w3;bar3.setAttribute('data-k',w3);}
    rows.forEach(function(r){if(r.querySelector('th'))return;r.style.display=!Y||r.getAttribute('data-iy')===Y?'':'none';});}
}catch(e){try{console.warn('[invyear]',e);}catch(z){}}finally{busy=false;}}
var q=false;function queue(){if(q||busy)return;q=true;setTimeout(function(){q=false;apply();},0);}
new MutationObserver(queue).observe(document.documentElement,{childList:true,subtree:true});
document.addEventListener('change',function(e){var t=e.target;if(!t||!t.classList||!t.classList.contains('iy-sel'))return;setY(t.value);apply();});
if(!document.getElementById('iystyle')){var s=document.createElement('style');s.id='iystyle';s.textContent='.iy-bar{margin:4px 0 8px}.iy-sel{max-width:160px;display:inline-block;width:auto}';(document.head||document.documentElement).appendChild(s);}
})();
