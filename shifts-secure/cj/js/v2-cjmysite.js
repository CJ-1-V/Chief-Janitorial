/* v2-cjmysite.js – cleaners see THEIR site, not a list of every site (owner, Oct 26 2026: "each person will be assigned a site
   they will work at so no need to show everyone all sites"). Pairs with the office Site assignments board (v2-cjassign.js).
   - Clock screen: the site picker lists only the sites the cleaner is assigned to (DB.sites[].crew, or booked on an office shift)
     – the site no longer has to be linked to a client first. One site = already selected, no search box ("Your site: CPM105").
     Up to 6 sites = tiles only, no search box. No site yet = a clear note instead of an empty list.
   - "Unusual day – log my hours" and "Regular clean today" use the same list.
   - Subcontractor company logins: sites their workers are assigned to (as before, v2-cjsiteiso.js).
   Front end only, no SQL. Loads after v2-cjsiteiso.js. Turn off: remove this file's line in index.html. */
(function () {
  'use strict';
  if (typeof VIEWS === 'undefined' || typeof afterRender !== 'function' || typeof ACT === 'undefined') return;
  function emp(u) { return !!u && (u.type === 'employee' || u.type === 'worker'); }
  function limited() { return !!(typeof ME !== 'undefined' && ME && (emp(ME) || ME.type === 'sub')); }
  function mine() {   // companySites() is already filtered to this login's assigned sites by v2-cjsiteiso.js
    if (typeof companySites !== 'function') return [];
    return companySites({ skipPractice: true, activeOnly: true }).filter(function (s) { return typeof cjSiteAllowed !== 'function' || cjSiteAllowed(s.code); });
  }
  /* the clock-in picker and the unusual-day form: assigned sites, linked to a client or not */
  ['clockSites', 'mtSites'].forEach(function (fn) {
    if (typeof window[fn] !== 'function') return; var o = window[fn];
    window[fn] = function () { return limited() ? mine() : o.apply(this, arguments); };
  });
  try { clockSites = window.clockSites; } catch (e) {}
  try { mtSites = window.mtSites; } catch (e) {}

  function hide(el) { if (el) el.style.display = 'none'; }
  function summary(s) { return typeof shSummary === 'function' ? shSummary(s) : ''; }
  function tidyClock(root) {
    var main = root.querySelector('main'); if (!main) return;
    var all = main.querySelector('#allTiles'); if (!all || main.querySelector('#mysite-line, #mysite-none')) return;   // not the clock-in screen (or done)
    var tiles = [].slice.call(main.querySelectorAll('.site-tile')), search = main.querySelector('#siteSearch');
    var subs = [].slice.call(main.querySelectorAll('.clock-card .sub')), h1 = main.querySelector('h1');
    var lab = [].filter.call(main.querySelectorAll('.label'), function (l) { return /Which site are you at/.test(l.textContent || ''); })[0];
    var notListed = all.nextElementSibling && /Site not listed/.test(all.nextElementSibling.textContent || '') ? all.nextElementSibling : null;
    var my = mine();
    if (!tiles.length) {
      hide(search); subs.forEach(hide); hide(all); hide(notListed);
      if (lab) { lab.textContent = 'Your site'; lab.insertAdjacentHTML('afterend', '<div class="alert warn small" id="mysite-none"><b>Your site has not been assigned yet.</b> Please ask the office – as soon as you are put on a site it shows up here and you can clock in.</div>'); }
      var btn = main.querySelector('#clockinBtn'); if (btn) btn.textContent = 'No site assigned yet';
      return;
    }
    if (tiles.length === 1) {
      hide(search); subs.forEach(hide);
      if (lab) lab.textContent = 'Your site';
      if (typeof ACT.picksite === 'function') ACT.picksite(tiles[0]);
    } else if (tiles.length <= 6) hide(search);
    if (h1 && my.length) h1.insertAdjacentHTML('afterend', '<div class="small muted" id="mysite-line">' + (my.length === 1 ? 'Your site: <b>' + esc(my[0].code) + '</b>' + (my[0].name && my[0].name !== my[0].code ? ' · ' + esc(my[0].name) : '') + (summary(my[0]) ? ' · ' + esc(summary(my[0])) : '') : 'Your sites: <b>' + my.map(function (s) { return esc(s.code); }).join('</b>, <b>') + '</b>') + '</div>');
  }
  var oar = afterRender;
  afterRender = function (root) { oar.apply(this, arguments); try { if (root && root.id === 'app' && emp(ME)) tidyClock(root); } catch (e) { try { console.warn('[cjmysite]', e); } catch (z) {} } };
})();
