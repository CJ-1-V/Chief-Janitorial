/* v2-invtheme.js – invtheme3 (Oct 6 2026; owner 11:08 PM ET on invtheme2: "no keep the site color and original logo"). Same invoice as
   invtheme1 (owner 10:37 PM ET: "when farms try to download their invoice it has the invoice theme same as our original invoice" – the
   Google Docs template of USDC-TSC-002, USDC-MDF-004, USDC-SPF-021, USDC-CAF-006): same order, same fields, same wording – "Invoice" +
   company block, logo top right, "Billed To", Invoice # / Receipt Date, DESCRIPTION / AMOUNT, Subtotal / GST/HST / TOTAL, the 3 footer
   lines. Keeps invtheme2's cleaner layout (one type scale, balanced 0.75 in margins, right-aligned invoice # / date block, amounts in one
   column, light row rules + zebra, clear TOTAL, footer under a rule, "Page 1 of 1"), now in the unscramble.ca colours: indigo #332E57
   main, gold #D9A03C accent. Logo = the original UnScramble wordmark only (UnScramble / The HR Company), vector, exactly as
   unscramble.ca assets/brand/unscramble-logo.svg. Fixed text is still copied ONLY from the original invoices.
   Data: invoice #, receipt date (= issued), billed-to name (the client's real name – the office and that client's own logins only – else
   "Client <code>"), billing address (office field on Clients & logins → Edit), lines, totals. New invoices are numbered USDC-<FARM>-NNN.
   Uploaded past invoices still download their own stored file (v2-pastinvoices.js). The PDF is made in this browser – no libraries,
   nothing is sent – and is plain ASCII (standard Helvetica, logo = vector paths), so it downloads the same way in Safari / iPhone. */
'use strict';
var INVT={co:['56 I, Burns Avenue','Charlottetown PE C1E 2G1','(902) 200-4888','admin@unscramble.ca','www.unscramble.ca'],email:'admin@unscramble.ca',web:'www.unscramble.ca',
  hstNo:'712793025 RT0001',
  foot:[['UnScramble THE HR Company INC.',' consists of a team of professional workers dedicated to lending a helping hand to maintain your Peace of mind.'],
        ['','Payment is due within one month of the date this invoice is received by the customer.'],
        ['','Thank you for your business! Please contact us at the email above regarding any questions or concerns about this invoice.']],
  main:'#332e57',gold:'#d9a03c',zebra:'#f6f5f9',hair:'#e1dfe8',ink:'#222222',muted:'#4b5563',sub:'#6b7280',
  /* the UnScramble wordmark (UnScramble / The HR Company) – vector paths [fill, d] in a 400 x 134 box, exactly as unscramble.ca assets/brand/unscramble-logo.svg */
  brand:[["#332e57","M0 0L400 0L400 130L0 130Z"],["#ffffff","M26.4 78.9Q19.1 78.9 15 76.4Q10.9 73.9 9.3 69.1Q7.7 64.3 7.7 57.5L7.7 13.2L20.6 13.2L20.6 59.3Q20.6 61.8 21 64.1Q21.4 66.4 22.6 67.8Q23.9 69.3 26.4 69.3Q29.1 69.3 30.3 67.8Q31.5 66.4 31.8 64.1Q32.2 61.8 32.2 59.3L32.2 13.2L45.2 13.2L45.2 57.5Q45.2 64.3 43.6 69.1Q41.9 73.9 37.9 76.4Q33.8 78.9 26.4 78.9ZM54.7 78L54.7 31.8L66.8 31.8L66.8 36.4Q69.3 33.9 72 32.5Q74.8 31 77.9 31Q80.8 31 82.6 32.4Q84.4 33.8 85.2 36.2Q86.1 38.6 86.1 41.5L86.1 78L74.1 78L74.1 43.5Q74.1 41.6 73.5 40.6Q72.9 39.7 71.2 39.7Q70.3 39.7 69.1 40.2Q67.9 40.7 66.8 41.6L66.8 78ZM112.6 78.9Q106.6 78.9 102.6 76.7Q98.6 74.5 96.6 70Q94.5 65.6 94.3 58.7L105.6 56.8Q105.7 60.8 106.5 63.5Q107.2 66.2 108.6 67.5Q109.9 68.8 112.1 68.8Q114.6 68.8 115.5 67.2Q116.4 65.6 116.4 63.5Q116.4 59.4 114.5 56.7Q112.5 53.9 109.3 51.1L102.6 45.3Q99 42.2 96.7 38.4Q94.4 34.6 94.4 28.9Q94.4 20.9 99.1 16.7Q103.8 12.4 111.9 12.4Q116.8 12.4 119.9 14Q123 15.6 124.8 18.3Q126.5 20.9 127.2 24.1Q127.9 27.3 128 30.4L116.7 32.1Q116.6 29.1 116.2 26.9Q115.9 24.6 114.8 23.4Q113.7 22.1 111.5 22.1Q109.2 22.1 108.1 23.8Q107 25.5 107 27.6Q107 31.1 108.6 33.3Q110.1 35.5 112.8 37.8L119.4 43.6Q123.5 47.1 126.4 51.7Q129.3 56.2 129.3 62.8Q129.3 67.4 127.2 71.1Q125.1 74.7 121.4 76.8Q117.7 78.9 112.6 78.9ZM151 78.8Q145.9 78.8 142.4 76.8Q139 74.9 137.3 71.3Q135.6 67.7 135.6 62.7L135.6 47.1Q135.6 41.9 137.3 38.3Q139 34.8 142.5 32.9Q145.9 31 151 31Q156 31 159.3 32.5Q162.7 34.1 164.3 37.2Q166 40.3 166 45.1L166 49.5L154.5 49.5L154.5 44.7Q154.5 42.6 154.1 41.5Q153.7 40.3 153 39.8Q152.2 39.3 151.1 39.3Q149.9 39.3 149.1 39.9Q148.4 40.6 148 42Q147.7 43.4 147.7 45.8L147.7 64Q147.7 67.8 148.6 69.1Q149.4 70.4 151.1 70.4Q152.4 70.4 153.1 69.8Q153.8 69.2 154.2 68.1Q154.5 66.9 154.5 65.1L154.5 59.4L166 59.4L166 64.5Q166 69.2 164.3 72.4Q162.6 75.6 159.3 77.2Q155.9 78.8 151 78.8ZM174.2 78L174.2 31.8L186.3 31.8L186.3 39.2Q188.6 35.2 190.9 33.2Q193.2 31.2 196.2 31.2Q196.8 31.2 197.3 31.2Q197.7 31.3 198.1 31.4L198.1 43.6Q197.2 43.2 196.1 42.9Q195 42.7 193.8 42.7Q191.6 42.7 189.7 43.8Q187.9 44.9 186.3 47.1L186.3 78ZM212.6 78.8Q209.2 78.8 206.9 77.1Q204.5 75.5 203.3 72.9Q202.1 70.3 202.1 67.6Q202.1 63.3 203.8 60.3Q205.5 57.4 208.2 55.4Q210.9 53.3 214.3 51.9Q217.6 50.5 221 49.3L221 45Q221 43.4 220.8 42.3Q220.5 41.2 219.8 40.6Q219.2 40 217.9 40Q216.6 40 215.9 40.5Q215.2 41.1 214.9 42Q214.6 43 214.6 44.3L214.3 47.4L203 47Q203.3 38.8 207.2 34.9Q211.1 31 218.9 31Q226 31 229.3 34.8Q232.7 38.7 232.7 45.1L232.7 66.6Q232.7 69.3 232.8 71.4Q232.9 73.5 233.1 75.2Q233.3 76.8 233.5 78L222.6 78Q222.4 76.3 222 74.2Q221.7 72 221.5 71.4Q220.7 74.2 218.5 76.5Q216.3 78.8 212.6 78.8ZM216.9 70.3Q217.8 70.3 218.6 69.9Q219.4 69.5 220 68.8Q220.6 68.2 221 67.6L221 54.9Q219.3 55.9 217.9 56.9Q216.4 57.9 215.4 59.1Q214.4 60.3 213.8 61.8Q213.2 63.2 213.2 65Q213.2 67.5 214.2 68.9Q215.2 70.3 216.9 70.3ZM241.5 78L241.5 31.8L253.3 31.8L253.3 35.6Q255.8 33.1 258.5 32Q261.3 30.9 264.2 30.9Q267 30.9 269 32.3Q271 33.6 272.1 36.5Q274.7 33.4 277.7 32.2Q280.7 30.9 283.8 30.9Q286.4 30.9 288.3 32.2Q290.3 33.4 291.4 35.9Q292.5 38.4 292.5 42L292.5 78L280.8 78L280.8 43.2Q280.8 41 280 40Q279.3 39.1 277.8 39.1Q276.8 39.1 275.5 39.7Q274.1 40.3 272.9 41.3Q272.9 41.5 272.9 41.6Q272.9 41.8 272.9 42L272.9 78L261.3 78L261.3 43.2Q261.3 41 260.5 40Q259.7 39.1 258.2 39.1Q257.1 39.1 255.8 39.7Q254.5 40.3 253.3 41.3L253.3 78ZM323.1 78.8Q320.5 78.8 318.1 77.6Q315.7 76.4 313.6 74.5L313.6 78L301.5 78L301.5 13.2L313.6 13.2L313.6 35.2Q315.8 33.2 318.3 32.1Q320.8 31 323.4 31Q326.2 31 328.2 32.2Q330.1 33.4 331.3 35.5Q332.4 37.6 332.9 40.2Q333.4 42.7 333.4 45.4L333.4 63.5Q333.4 67.9 332.3 71.3Q331.2 74.8 328.9 76.8Q326.6 78.8 323.1 78.8ZM317.7 70.7Q319.2 70.7 320 69.8Q320.7 68.9 321 67.4Q321.4 65.9 321.4 64L321.4 44.6Q321.4 43 321 41.6Q320.7 40.2 320 39.4Q319.2 38.6 317.8 38.6Q316.6 38.6 315.6 39.1Q314.5 39.6 313.6 40.3L313.6 69.3Q314.5 69.9 315.6 70.3Q316.6 70.7 317.7 70.7ZM342.5 78L342.5 13.2L354.5 13.2L354.5 78ZM378.7 78.8Q373.5 78.8 370.1 76.9Q366.6 75 364.8 71.4Q363.1 67.8 363.1 62.7L363.1 47.1Q363.1 41.9 364.9 38.3Q366.6 34.7 370.1 32.9Q373.6 31 378.7 31Q383.9 31 387.2 32.9Q390.5 34.8 392 38.5Q393.5 42.1 393.5 47.4L393.5 55.5L375 55.5L375 64.5Q375 66.5 375.5 67.7Q375.9 69 376.7 69.6Q377.5 70.1 378.7 70.1Q379.8 70.1 380.6 69.6Q381.5 69 381.9 67.9Q382.3 66.8 382.3 65L382.3 60.5L393.5 60.5L393.5 64.4Q393.5 71.5 389.7 75.1Q385.8 78.8 378.7 78.8ZM375 49.8L382.3 49.8L382.3 45.2Q382.3 43.2 381.9 41.9Q381.5 40.7 380.7 40.2Q379.9 39.6 378.6 39.6Q377.4 39.6 376.6 40.2Q375.8 40.8 375.4 42.2Q375 43.6 375 46.2Z"],["#ffffff","M8 90L392 90L392 122L8 122Z"],["#332e57","M92.7 112L92.7 103L89.6 103L89.6 101.5L97.6 101.5L97.6 103L94.5 103L94.5 112ZM112.7 112L112.7 101.5L114.5 101.5L114.5 112ZM106.1 112L106.1 101.5L107.9 101.5L107.9 112ZM107.6 107.4L107.6 105.9L113.1 105.9L113.1 107.4ZM123.7 112L123.7 101.5L130.4 101.5L130.4 103L125.5 103L125.5 106L130 106L130 107.4L125.5 107.4L125.5 110.5L130.4 110.5L130.4 112ZM156.6 112L156.6 101.5L158.4 101.5L158.4 112ZM150 112L150 101.5L151.8 101.5L151.8 112ZM151.5 107.4L151.5 105.9L157 105.9L157 107.4ZM167.5 112L167.5 101.5L171.3 101.5Q172.6 101.5 173.4 101.9Q174.2 102.4 174.6 103.1Q175 103.8 175 104.7Q175 105.5 174.6 106.2Q174.2 107 173.4 107.4Q172.6 107.8 171.3 107.8L169.3 107.8L169.3 112ZM173 112L170.8 107.4L172.8 107.4L175.1 112ZM169.3 106.5L171.2 106.5Q172.2 106.5 172.7 106Q173.1 105.5 173.1 104.7Q173.1 103.9 172.7 103.5Q172.2 103 171.2 103L169.3 103ZM199.2 112.2Q197.6 112.2 196.5 111.5Q195.4 110.8 194.7 109.6Q194.1 108.4 194.1 106.8Q194.1 105.1 194.7 103.9Q195.4 102.7 196.5 102Q197.6 101.3 199.2 101.3Q201 101.3 202.2 102.2Q203.4 103.2 203.7 104.8L201.8 104.8Q201.5 104 200.9 103.4Q200.2 102.9 199.2 102.9Q198.2 102.9 197.5 103.4Q196.7 103.9 196.4 104.7Q196 105.6 196 106.8Q196 107.9 196.4 108.8Q196.7 109.7 197.5 110.1Q198.2 110.6 199.2 110.6Q200.2 110.6 200.9 110.1Q201.5 109.6 201.8 108.8L203.7 108.8Q203.4 110.4 202.2 111.3Q201 112.2 199.2 112.2ZM217.3 112.2Q215.8 112.2 214.6 111.5Q213.4 110.8 212.8 109.6Q212.1 108.4 212.1 106.8Q212.1 105.1 212.8 103.9Q213.4 102.7 214.6 102Q215.8 101.3 217.3 101.3Q218.8 101.3 220 102Q221.2 102.7 221.8 103.9Q222.4 105.1 222.4 106.8Q222.4 108.4 221.8 109.6Q221.2 110.8 220 111.5Q218.8 112.2 217.3 112.2ZM217.3 110.6Q218.3 110.6 219 110.1Q219.8 109.6 220.2 108.8Q220.6 107.9 220.6 106.8Q220.6 105.6 220.2 104.7Q219.8 103.9 219 103.4Q218.3 102.9 217.3 102.9Q216.3 102.9 215.5 103.4Q214.8 103.9 214.4 104.7Q214 105.6 214 106.8Q214 107.9 214.4 108.8Q214.8 109.6 215.5 110.1Q216.3 110.6 217.3 110.6ZM231.2 112L231.2 101.5L233.3 101.5L236.7 108.3L240 101.5L242.2 101.5L242.2 112L240.4 112L240.4 104.6L237.4 110.5L236 110.5L233 104.6L233 112ZM251.3 112L251.3 101.5L255.1 101.5Q256.3 101.5 257.2 101.9Q258 102.4 258.4 103.1Q258.8 103.8 258.8 104.7Q258.8 105.6 258.4 106.3Q258 107 257.2 107.5Q256.4 107.9 255.1 107.9L253.1 107.9L253.1 112ZM253.1 106.5L255 106.5Q256 106.5 256.5 106Q257 105.5 257 104.7Q257 103.9 256.5 103.4Q256 103 255 103L253.1 103ZM266.7 112L270.5 101.5L272.5 101.5L276.4 112L274.4 112L271.5 103.6L268.5 112ZM268.4 109.5L268.9 108.1L274 108.1L274.5 109.5ZM284.8 112L284.8 101.5L286.6 101.5L291.6 109.1L291.6 101.5L293.4 101.5L293.4 112L291.6 112L286.6 104.4L286.6 112ZM305.2 112L305.2 108.2L301.7 101.5L303.8 101.5L306.4 106.8L306 106.8L308.5 101.5L310.5 101.5L307 108.2L307 112Z"],["#d9a03c","M0 130L400 130L400 134L0 134Z"]],bw:400,bh:134,wR:[278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584,278,333,556,556,556,556,260,556,333,737,370,556,584,333,737,333,400,584,556,556,333,556,537,278,333,556,365,556,834,834,834,611,667,667,667,667,667,667,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,500,556,556,556,556,278,278,278,278,556,556,556,556,556,556,556,584,611,556,556,556,556,500,556,500],wB:[278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584,278,333,556,556,556,556,280,556,333,737,370,556,584,333,737,333,400,584,556,556,333,611,556,278,333,556,365,556,834,834,834,611,722,722,722,722,722,722,1000,722,667,667,667,667,278,278,278,278,722,722,778,778,778,778,778,584,778,722,722,722,722,667,667,611,556,556,556,556,556,556,889,556,556,556,556,556,278,278,278,278,611,611,611,611,611,611,611,584,611,611,611,611,611,556,611,556]};
var INVT_MON=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function invtDate(iso){var m=/^(\d{4})-(\d{2})-(\d{2})/.exec(iso||'');return m?(+m[3])+' '+INVT_MON[+m[2]-1]+' '+m[1]:String(iso||'');}
function invtMoney(n){n=Number(n)||0;return '$ '+(n<0?'-':'')+Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');}
function invtCode(f){return String((f&&f.firm&&f.firm.clientCode)||(f&&typeof clMainSite==='function'?clMainSite(f):'')||'').toUpperCase();}
function invtBillName(f){if(!f)return '';var rn=String((f.firm&&f.firm.realName)||'').trim();if(rn)return rn;
  if(f.preloaded||/^(Client|Unknown farm) /.test(f.name||''))return 'Client '+invtCode(f);return f.name||('Client '+invtCode(f));}
function invtAddr(f){return String((f&&f.firm&&f.firm.billAddress)||'').split(/\r?\n/).map(function(s){return s.trim();}).filter(Boolean).slice(0,4);}
function invtSpan(i){var s=i.periodStart||'',e=i.periodEnd||'';var ms=/^(\d{4})-(\d{2})-01$/.exec(s);
  if(ms&&e===addDays(isoLocal(new Date(+ms[1],+ms[2],1)),-1))return 'in the month of '+INVT_MON[+ms[2]-1]+' '+ms[1];
  return s&&e?'from '+invtDate(s)+' to '+invtDate(e):'';}
/* everything shown on the invoice (client-safe: no worker names, no internal notes) */
function invtData(i){var f=user(i.firmId),name=invtBillName(f),late=i.lateLines||[],lateSum=late.reduce(function(a,l){return a+(+l.amount||0);},0),sub=[];
  if(+i.billHours>0)sub.push((+i.billHours).toFixed(2)+' billable hours');
  if(i.minTopUpHours>0)sub.push('includes '+(+i.minTopUpHours).toFixed(2)+' h for the '+CB().minHours+'-hour daily minimum per worker');
  if(i.minWaivedDays&&i.minWaivedDays.length)sub.push('daily minimum waived on '+i.minWaivedDays.map(invtDate).join(', '));
  var L=[{d:('Services provided at '+name+' '+invtSpan(i)).trim(),s:sub.join(' · '),a:Math.round(((+i.amount||0)-lateSum)*100)/100}];
  late.forEach(function(l){L.push({d:'Services provided at '+name+' on '+invtDate(l.date)+' (late entry)',s:(+l.bill||0).toFixed(2)+' billable hours'+(l.note?' · '+l.note:''),a:+l.amount||0});});
  var amt=+i.amount||0,hst=+i.hst||0,pct=amt>0?Math.round(hst/amt*1000)/10:0;
  return {number:i.number||'',date:invtDate(i.issued),name:name,addr:invtAddr(f),lines:L,subtotal:amt,hst:hst,
    hstLabel:hst>0?'GST/HST '+INVT.hstNo+' @ '+(Math.abs(pct-15)<0.06?'15.0':pct.toFixed(1))+'%':'GST/HST (not charged)',total:+i.total||0};}


/* ---------- screen + print (HTML) ---------- */
var INVT_CSS='.usinv{font-family:Helvetica,Arial,sans-serif;color:'+INVT.ink+';background:#fff;max-width:660px;margin:0 auto;padding:6px 6px 4px;font-size:13px;line-height:1.4;text-align:left}'+
 '.usinv .ui-band{height:3px;background:'+INVT.gold+';margin:0 0 16px}'+
 '.usinv .ui-top{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.usinv .ui-title{font-weight:bold;font-size:28px;line-height:1.05;color:'+INVT.main+';margin:2px 0 10px}'+
 '.usinv .ui-co div{margin:0 0 1px;font-size:12.5px;color:'+INVT.muted+'}.usinv .ui-co a{color:'+INVT.main+';text-decoration:none}'+
 '.usinv .ui-logo{display:block;width:36%;max-width:230px;height:auto;flex:0 0 auto;margin-top:2px}'+
 '.usinv .ui-rule{border:0;border-top:1px solid '+INVT.hair+';margin:16px 0 14px;height:0}'+
 '.usinv .ui-bill{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin:0 0 20px}.usinv .ui-bill>div>div{margin-bottom:2px}'+
 '.usinv .ui-lbl{font-weight:bold;font-size:12.5px;color:'+INVT.main+';margin-bottom:4px!important}.usinv .ui-name{font-weight:bold;font-size:14.5px}'+
 '.usinv .ui-meta{text-align:right}.usinv .ui-meta div{margin:0 0 4px}.usinv .ui-meta b{font-size:12.5px;color:'+INVT.main+'}.usinv .ui-meta span{display:inline-block;min-width:7.6em;text-align:left;font-size:14px;margin-left:4px}'+
 '.usinv table.ui-tab{width:100%;border-collapse:collapse;margin:0;border:1px solid '+INVT.main+'}'+
 '.usinv .ui-tab th{background:'+INVT.main+';color:#fff;font-size:11px;font-weight:bold;letter-spacing:.08em;padding:8px 14px;text-align:left;border:0;border-bottom:2px solid '+INVT.gold+'}'+
 '.usinv .ui-tab td{padding:12px 14px 13px;vertical-align:top;font-size:14px;border:0;border-top:1px solid '+INVT.hair+';background:#fff}.usinv .ui-tab tr:nth-child(odd) td{background:'+INVT.zebra+'}'+
 '.usinv .ui-tab th.a,.usinv .ui-tab td.a{width:22%;text-align:right;white-space:nowrap;border-left:1px solid '+INVT.hair+'}.usinv .ui-tab .s{display:block;font-size:11px;color:'+INVT.sub+';margin-top:3px}'+
 '.usinv .ui-tot{width:62%;margin:18px 0 0 auto}.usinv .ui-tot .r{display:flex;align-items:baseline;border-bottom:1px solid '+INVT.hair+';padding:8px 14px}'+
 '.usinv .ui-tot .l{flex:1 1 auto;text-align:right;padding-right:14px;font-size:13.5px}.usinv .ui-tot .v{flex:0 0 calc(35.5% - 14px);text-align:right;white-space:nowrap;font-size:14px}'+
 '.usinv .ui-tot .r.t{background:'+INVT.main+';border-top:2px solid '+INVT.gold+';border-bottom:0;padding:10px 14px}.usinv .ui-tot .r.t .l,.usinv .ui-tot .r.t .v{font-weight:bold;font-size:18px;color:#fff}'+
 '.usinv .ui-foot{margin-top:56px;padding-top:12px;border-top:1px solid '+INVT.gold+';font-size:11.5px;line-height:1.45;color:'+INVT.muted+'}.usinv .ui-foot p{margin:0 0 5px}.usinv .ui-foot b{color:'+INVT.main+'}'+
 '@media (max-width:560px){.usinv{font-size:12px}.usinv .ui-title{font-size:22px}.usinv .ui-co div{font-size:11.5px}.usinv .ui-bill{flex-wrap:wrap}.usinv .ui-meta span{min-width:0}'+
 '.usinv .ui-tab td{font-size:13px;padding:10px 10px 11px}.usinv .ui-tab th{padding:8px 10px}.usinv .ui-tot{width:100%}.usinv .ui-tot .r{padding:8px 10px}.usinv .ui-tot .l{font-size:12.5px;padding-right:10px}'+
 '.usinv .ui-tot .v{flex-basis:calc(22% + 10px);font-size:13px}.usinv .ui-tot .r.t .l,.usinv .ui-tot .r.t .v{font-size:16px}.usinv .ui-foot{margin-top:36px}}';
(function(){var s=document.createElement('style');s.id='invtheme-css';s.textContent=INVT_CSS+'.invt-status{margin:14px auto 0;max-width:660px}';(document.head||document.documentElement).appendChild(s);})();
function invtBrandSvg(){return '<svg class="ui-logo" viewBox="0 0 '+INVT.bw+' '+INVT.bh+'" role="img" aria-label="UnScramble - The HR Company" xmlns="http://www.w3.org/2000/svg">'+
  INVT.brand.map(function(p){return '<path fill="'+p[0]+'" d="'+p[1]+'"/>';}).join('')+'</svg>';}
function invtHtml(i){var D=invtData(i);
  return '<div class="usinv" data-invtheme="3" data-inv="'+esc(D.number)+'"><div class="ui-band"></div><div class="ui-top"><div><div class="ui-title">Invoice</div><div class="ui-co">'+
    INVT.co.map(function(c){return '<div>'+(c===INVT.email?'<a href="mailto:'+esc(c)+'">'+esc(c)+'</a>':esc(c))+'</div>';}).join('')+'</div></div>'+invtBrandSvg()+'</div>'+
    '<hr class="ui-rule"><div class="ui-bill"><div><div class="ui-lbl">Billed To</div><div class="ui-name">'+esc(D.name)+'</div>'+D.addr.map(function(a){return '<div>'+esc(a)+'</div>';}).join('')+'</div>'+
    '<div class="ui-meta"><div><b>Invoice #</b> <span class="ui-no">'+esc(D.number)+'</span></div><div><b>Receipt Date</b> <span>'+esc(D.date)+'</span></div></div></div>'+
    '<table class="ui-tab no-stack"><tr><th>DESCRIPTION</th><th class="a">AMOUNT</th></tr>'+D.lines.map(function(l){return '<tr><td>'+esc(l.d)+(l.s?'<span class="s">'+esc(l.s)+'</span>':'')+'</td><td class="a">'+invtMoney(l.a)+'</td></tr>';}).join('')+'</table>'+
    '<div class="ui-tot"><div class="r"><span class="l">Subtotal</span><span class="v">'+invtMoney(D.subtotal)+'</span></div><div class="r"><span class="l h">'+esc(D.hstLabel)+'</span><span class="v">'+invtMoney(D.hst)+'</span></div>'+
    '<div class="r t"><span class="l">TOTAL</span><span class="v ui-total">'+invtMoney(D.total)+'</span></div></div>'+
    '<div class="ui-foot">'+INVT.foot.map(function(p){return '<p>'+(p[0]?'<b>'+esc(p[0])+'</b>':'')+esc(p[1])+'</p>';}).join('')+'</div></div>';}
invHtml=invtHtml;

/* ---------- PDF (Letter, Helvetica = Arial metrics, WinAnsi text, vector logo; ASCII only) ---------- */
function invtW(s,size,bold){var t=bold?INVT.wB:INVT.wR,w=0;for(var k=0;k<s.length;k++){var c=s.charCodeAt(k),ix=c>=32&&c<=126?c-32:c>=160&&c<=255?c-160+95:-1;w+=ix>=0?t[ix]:556;}return w*size/1000;}
function invtAscii(s){return String(s==null?'':s).replace(/[\u2013\u2014\u2212]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u201c\u201d]/g,'"').replace(/\u00d7/g,'x').replace(/\u2026/g,'...').replace(/\u00b7/g,'\u00b7').replace(/[^\x20-\x7e\xa0-\xff]/g,'?');}
function invtPdfStr(s){var o='';for(var k=0;k<s.length;k++){var c=s.charCodeAt(k),ch=s[k];o+=ch==='('||ch===')'||ch==='\\'?'\\'+ch:c>126?'\\'+('00'+c.toString(8)).slice(-3):ch;}return o;}
function invtWrap(s,size,bold,maxW){var out=[],line='';String(s).split(/\s+/).forEach(function(w){if(!w)return;var t=line?line+' '+w:w;if(line&&invtW(t,size,bold)>maxW){out.push(line);line=w;}else line=t;});if(line)out.push(line);return out.length?out:[''];}
function invtRgb(hex){var n=parseInt(hex.slice(1),16);return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255].map(function(v){return v.toFixed(3);}).join(' ');}
/* SVG path (absolute M L Q Z, as made by build/make-brand.py) -> PDF path operators (quadratic -> cubic) */
function invtPath(d){var t=d.match(/[MLQZ]|-?[\d.]+/g)||[],o=[],k=0,cx=0,cy=0,sx=0,sy=0,f=function(v){return String(Math.round(v*100)/100);},n=function(){return +t[k++];};
  while(k<t.length){var c=t[k++];
    if(c==='M'||c==='L'){cx=n();cy=n();if(c==='M'){sx=cx;sy=cy;}o.push(f(cx)+' '+f(cy)+(c==='M'?' m':' l'));}
    else if(c==='Q'){var qx=n(),qy=n(),ex=n(),ey=n();o.push(f(cx+2/3*(qx-cx))+' '+f(cy+2/3*(qy-cy))+' '+f(ex+2/3*(qx-ex))+' '+f(ey+2/3*(qy-ey))+' '+f(ex)+' '+f(ey)+' c');cx=ex;cy=ey;}
    else if(c==='Z'){o.push('h');cx=sx;cy=sy;}}
  return o.join(' ');}
function invtPdf(i){var D=invtData(i),PH=792,pages=[],ops=[],links=[],plinks=[];
  function T(top){return (PH-top).toFixed(2);}
  function txt(x,top,size,bold,s,col,tc){s=invtAscii(s);ops.push(invtRgb(col||INVT.ink)+' rg BT /'+(bold?'F2':'F1')+' '+size+' Tf '+(tc?tc+' Tc ':'')+x.toFixed(2)+' '+T(top)+' Td ('+invtPdfStr(s)+') Tj '+(tc?'0 Tc ':'')+'ET');return invtW(s,size,bold)+(tc||0)*s.length;}
  function txtR(xr,top,size,bold,s,col,tc){var a=invtAscii(s);return txt(xr-invtW(a,size,bold)-(tc||0)*Math.max(a.length-1,0),top,size,bold,s,col,tc);}
  function rect(x,top,w,h,fill,stroke,sw){ops.push((fill?invtRgb(fill)+' rg ':'')+(stroke?invtRgb(stroke)+' RG '+(sw||0.75)+' w ':'')+x.toFixed(2)+' '+(PH-top-h).toFixed(2)+' '+w.toFixed(2)+' '+h.toFixed(2)+' re '+(fill&&stroke?'B':fill?'f':'S'));}
  function line(x1,t1,x2,t2,col,wd){ops.push(invtRgb(col||INVT.main)+' RG '+(wd||0.75)+' w '+x1.toFixed(2)+' '+T(t1)+' m '+x2.toFixed(2)+' '+T(t2)+' l S');}
  function link(x,top,w,uri){links.push('<< /Type /Annot /Subtype /Link /Rect ['+x.toFixed(2)+' '+(PH-top-2.5).toFixed(2)+' '+(x+w).toFixed(2)+' '+(PH-top+8.5).toFixed(2)+'] /Border [0 0 0] /A << /Type /Action /S /URI /URI ('+invtPdfStr(uri)+') >> >>');}
  function newPage(){pages.push(ops);plinks.push(links);ops=[];links=[];}
  var X0=54,X2=558,X1=X2-118,PAD=12,DW=X1-X0-2*PAD;   /* 0.75 in margins left and right; AMOUNT column 118 pt */
  /* header: purple top rule, "Invoice", company block, logo (vector) top right */
  rect(X0,46,X2-X0,3,INVT.gold,null);
  txt(X0,88,26,true,'Invoice',INVT.main);
  var bw=168,bh=bw*INVT.bh/INVT.bw,s=bh/INVT.bh;
  ops.push('q '+s.toFixed(5)+' 0 0 '+(-s).toFixed(5)+' '+(X2-bw).toFixed(2)+' '+T(66)+' cm '+INVT.brand.map(function(p){return invtRgb(p[0])+' rg '+invtPath(p[1])+' f';}).join(' ')+' Q');
  INVT.co.forEach(function(c,k){var top=112+k*13.5,e=c===INVT.email,w=txt(X0,top,9.5,false,c,e?INVT.main:INVT.muted);if(e)link(X0,top,w,'mailto:'+c);else if(c===INVT.web)link(X0,top,w,'https://'+c);});
  line(X0,186,X2,186,INVT.hair,0.75);
  /* Billed To (left) | Invoice # + Receipt Date (right-aligned block) */
  var bt=210;txt(X0,bt,9.5,true,'Billed To',INVT.main);txt(X0,bt+17,11,true,D.name);D.addr.forEach(function(a,k){txt(X0,bt+31+k*13.5,10,false,a);});
  var vw=Math.max(invtW(invtAscii(D.number),10.5,false),invtW(invtAscii(D.date),10.5,false)),vx=X2-vw;
  txtR(vx-4,bt,9.5,true,'Invoice #',INVT.main);txt(vx,bt,10.5,false,D.number);txtR(vx-4,bt+17,9.5,true,'Receipt Date',INVT.main);txt(vx,bt+17,10.5,false,D.date);
  /* table: lavender head, light row rules, zebra rows, amounts right-aligned */
  var top=Math.max((D.addr.length?bt+31+(D.addr.length-1)*13.5:bt+17)+22,bt+44),seg;
  function head(){seg=top;rect(X0,top,X2-X0,24,INVT.main,null);txt(X0+PAD,top+15.5,8.5,true,'DESCRIPTION','#ffffff',0.7);txtR(X2-PAD,top+15.5,8.5,true,'AMOUNT','#ffffff',0.7);line(X0,top+23,X2,top+23,INVT.gold,2);top+=24;}
  function close(){line(X1,seg,X1,top,INVT.hair,0.75);rect(X0,seg,X2-X0,top-seg,null,INVT.main,0.75);}
  head();
  D.lines.forEach(function(l,k){var dl=invtWrap(l.d,10.5,false,DW),sl=l.s?invtWrap(l.s,8.5,false,DW):[],h=Math.max(40,13+dl.length*14+sl.length*11+11);
    if(top+h>690){close();newPage();top=60;head();}
    if(k%2===1)rect(X0,top,X2-X0,h,INVT.zebra,null);if(top>seg+24.1)line(X0,top,X2,top,INVT.hair,0.75);
    dl.forEach(function(s,j){txt(X0+PAD,top+21+j*14,10.5,false,s);});sl.forEach(function(s,j){txt(X0+PAD,top+21+dl.length*14-1+j*11,8.5,false,s,INVT.sub);});
    txtR(X2-PAD,top+21,10.5,false,invtMoney(l.a));top+=h;});
  close();
  /* totals: values in the AMOUNT column, TOTAL on a lavender band */
  var tt=top+16;if(tt+90>690){newPage();tt=70;}
  var TX=X1-196,hl=D.hstLabel,hs=10;while(invtW(hl,hs,false)>X1-PAD-TX-4&&hs>7)hs-=0.5;
  txtR(X1-PAD,tt+17,10,false,'Subtotal');txtR(X2-PAD,tt+17,10.5,false,invtMoney(D.subtotal));line(TX,tt+26,X2,tt+26,INVT.hair,0.75);
  txtR(X1-PAD,tt+43,hs,false,hl);txtR(X2-PAD,tt+43,10.5,false,invtMoney(D.hst));
  rect(TX,tt+52,X2-TX,32,INVT.main,null);line(TX,tt+52,X2,tt+52,INVT.gold,2);
  txtR(X1-PAD,tt+73,13,true,'TOTAL','#ffffff');txtR(X2-PAD,tt+73,13,true,invtMoney(D.total),'#ffffff');
  /* footer (original wording) under a purple rule, kept at the foot of the page */
  var FL=INVT.foot.map(function(p){return invtWrap(p[0]+p[1],8.5,false,X2-X0);}),fh=FL.reduce(function(a,l){return a+l.length*11.5+4;},0)-4,ft=742-fh;
  if(ft-16<tt+84+24){newPage();}
  line(X0,ft-16,X2,ft-16,INVT.gold,0.75);
  INVT.foot.forEach(function(p,pi){var boldLeft=p[0].length;
    FL[pi].forEach(function(s){var b=boldLeft>0?s.slice(0,Math.min(boldLeft,s.length)):'',rest=s.slice(b.length);
      var bw2=b?txt(X0,ft,8.5,true,b,INVT.main):0;if(rest)txt(X0+bw2,ft,8.5,false,rest,INVT.muted);boldLeft-=b.length+1;ft+=11.5;});ft+=4;});
  newPage();
  /* page numbers */
  pages.forEach(function(o,ix){ops=o;txtR(X2,762,7.5,false,'Page '+(ix+1)+' of '+pages.length,INVT.sub);});
  /* objects */
  var objs=[];objs[1]='<< /Type /Catalog /Pages 2 0 R >>';
  objs[3]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';objs[4]='<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
  var kids=[],an=4+pages.length*2;pages.forEach(function(o,ix){var c=o.join('\n'),po=5+ix*2,co=po+1,refs=[];kids.push(po+' 0 R');
    plinks[ix].forEach(function(a){an++;objs[an]=a;refs.push(an+' 0 R');});
    objs[po]='<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >>'+(refs.length?' /Annots ['+refs.join(' ')+']':'')+' /Contents '+co+' 0 R >>';
    objs[co]='<< /Length '+c.length+' >>\nstream\n'+c+'\nendstream';});
  objs[2]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+pages.length+' >>';
  var out='%PDF-1.4\n',off=[];for(var n=1;n<objs.length;n++){off[n]=out.length;out+=n+' 0 obj\n'+objs[n]+'\nendobj\n';}
  var xref=out.length;out+='xref\n0 '+objs.length+'\n0000000000 65535 f \n';for(n=1;n<objs.length;n++)out+=String(off[n]).padStart(10,'0')+' 00000 n \n';
  out+='trailer\n<< /Size '+objs.length+' /Root 1 0 R /Info << /Title ('+invtPdfStr(invtAscii('Invoice '+D.number))+') /Author (UnScramble THE HR Company INC.) /Producer (UnScramble app) >> >>\nstartxref\n'+xref+'\n%%EOF';return out;}
invPdf=invtPdf;
invFileName=function(i){return String(i.number||'invoice').replace(/[^A-Za-z0-9.\-]+/g,'-')+'.pdf';};

/* ---------- view (status stays outside the invoice) + print ---------- */
(function(){var pv=ACT.civview;ACT.civview=function(el){var i=invById(el.dataset.id);if(!i||i.uploaded)return pv(el);if(!invAllowed(i)){invDenied(i);return;}
  audit('Viewed client invoice',user(i.firmId).name,i.number);save();var st=invPlain(i),it=clientInvInterest(i),c=CB();
  modal(invtHtml(i)+'<div class="invt-status card small"><span class="pill '+st.c+'">'+esc(st.t)+'</span> '+esc(st.d)+
    (it.amount&&!i.paidAt?' · interest on the overdue amount '+money(it.amount)+' ('+it.months+' month(s) × '+(i.interestPct!=null?i.interestPct:c.interestPct)+'%)':'')+
    ' · <b>Now owing '+money(i.paidAt?0:i.total+it.amount)+'</b></div><p class="row"><button data-act="civpdf" data-id="'+i.id+'">Download PDF</button><button class="sec" data-act="civprint" data-id="'+i.id+'">Print</button></p>');};})();
(function(){var pp=ACT.civprint;ACT.civprint=function(el){var i=invById(el.dataset.id);if(!i||i.uploaded)return pp(el);if(!invAllowed(i)){invDenied(i);return;}
  var w=window.open('','_blank');if(!w){toast('Pop-up blocked – use Download PDF instead.');return;}
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>'+esc(i.number)+'</title><style>@page{size:letter;margin:0.6in 0.75in}html,body{margin:0;background:#fff}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}'+INVT_CSS+'.usinv{max-width:none;padding:0;font-size:13px}</style></head><body>'+invtHtml(i)+'</body></html>');
  w.document.close();w.focus();setTimeout(function(){try{w.print();}catch(e){}},400);};})();

/* ---------- numbering: USDC-<FARM>-NNN (called by v2-clientbilling.js / v2-lateentry.js when an invoice is created) ---------- */
function invNextNumber(firm){var all=DB.clientInvoices||[],pfx='';
  all.filter(function(i){return firm&&i.firmId===firm.id;}).sort(function(a,b){return a.issued<b.issued?1:a.issued>b.issued?-1:0;})
    .some(function(i){var m=/^USDC-([A-Z]{2,5})-\d{3}/.exec(i.number||'');if(m){pfx=m[1];return true;}return false;});
  if(!pfx)pfx=invtCode(firm).replace(/[^A-Z]/g,'').slice(0,3)||'CL';
  var max=0,re=new RegExp('^USDC-'+pfx+'-(\\d{3})');all.forEach(function(i){var m=re.exec(i.number||'');if(m)max=Math.max(max,+m[1]);});
  var no;do{max++;no='USDC-'+pfx+'-'+String(max).padStart(3,'0');}while(all.some(function(i){return i.number===no;}));return no;}

/* ---------- office: billing address for "Billed To" (Clients & logins → Edit) ---------- */
(function(){var oe=ACT.cledit;if(!oe)return;ACT.cledit=function(el){oe(el);var f=user(el.dataset.id),form=document.getElementById('cleditform');if(!f||!form||form.querySelector('[name=billAddress]'))return;
  var nt=form.querySelector('textarea[name=notes]'),box=document.createElement('div');box.innerHTML='<label>Billing address (printed under the name on this client\'s invoices)</label><textarea name="billAddress" rows="3" placeholder="Street&#10;Town, PE  Postal code">'+esc((f.firm&&f.firm.billAddress)||'')+'</textarea><div class="small muted">Shown only to the office and on this client\'s own invoices.</div>';
  if(nt&&nt.parentNode)nt.parentNode.parentNode.insertBefore(box,nt.parentNode);else form.insertBefore(box,form.querySelector('button'));};
  var of=FORMS.cledit;FORMS.cledit=function(form,d){var c=user(d.id),r=of.apply(this,arguments);
    if(c&&c.firm&&d.billAddress!=null&&!document.getElementById('cleditform')){var a=String(d.billAddress).replace(/\r/g,'').split('\n').map(function(s){return s.trim();}).filter(Boolean).slice(0,4).join('\n');
      if(a!==(c.firm.billAddress||'')){c.firm.billAddress=a;audit('Edited client','Client '+clCode(c),'billing address '+(a?'saved':'removed'));save();}}return r;};})();
