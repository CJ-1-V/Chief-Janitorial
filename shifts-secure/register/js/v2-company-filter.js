/* v2-company-filter.js – shared company_id scoping for UnScramble (us) / CJ (cj) shells.
   One Supabase; each shell only lists its own sites/clients. Prefer helpers over copy-paste.
   Historical rows without companyId: infer from site number (US 201–299, CJ 101–199) or industry. */
(function () {
  'use strict';
  var C = window.REG_STORE || {};

  function companyId() {
    return (C && C.companyId) || 'us';
  }

  function normCode(c) {
    return String(c == null ? '' : c).trim().toUpperCase().replace(/[\s-]+/g, '');
  }

  /* ASR266 / HTP250 / CJC101 → 266 / 250 / 101; TFA01 (hyphen stripped) may not be in range */
  function siteNumber(code) {
    var n = normCode(code);
    var m = /^[A-Z]{3}(\d{3})$/.exec(n);
    return m ? +m[1] : null;
  }

  function inferSiteCompany(s) {
    if (!s) return null;
    if (s.companyId === 'us' || s.companyId === 'cj') return s.companyId;
    if (s.company_id === 'us' || s.company_id === 'cj') return s.company_id;
    var num = siteNumber(s.code);
    if (num != null && num >= 101 && num <= 199) return 'cj';
    if (num != null && num >= 201 && num <= 299) return 'us';
    /* Legacy registration rows were US-only; untagged mock codes (TFA-01) default US */
    return 'us';
  }

  function inferFirmCompany(f) {
    if (!f) return null;
    if (f.companyId === 'us' || f.companyId === 'cj') return f.companyId;
    if (f.firm && (f.firm.companyId === 'us' || f.firm.companyId === 'cj')) return f.firm.companyId;
    var sites = (typeof DB !== 'undefined' && DB && DB.sites) ? DB.sites : [];
    var own = sites.filter(function (s) { return s.firmId === f.id; });
    if (own.length) {
      var votes = { us: 0, cj: 0 };
      own.forEach(function (s) { votes[inferSiteCompany(s)]++; });
      if (votes.cj > votes.us) return 'cj';
      if (votes.us > votes.cj) return 'us';
    }
    var t = (f.firm && f.firm.clientType) || '';
    if (/^farm$/i.test(t)) return 'us';
    if (/^(cleaning|office)$/i.test(t)) return 'cj';
    return 'us';
  }

  function siteBelongs(s) {
    return inferSiteCompany(s) === companyId();
  }

  function firmBelongs(f) {
    return inferFirmCompany(f) === companyId();
  }

  function tagCompany(row) {
    if (!row || typeof row !== 'object') return row;
    row.companyId = companyId();
    return row;
  }

  function companySites(opts) {
    opts = opts || {};
    var list = (typeof DB !== 'undefined' && DB && DB.sites) ? DB.sites : [];
    return list.filter(function (s) {
      if (!siteBelongs(s)) return false;
      if (opts.withFirm && !s.firmId) return false;
      if (opts.skipPractice && s.code === 'TEST-PRACTICE') return false;
      if (opts.activeOnly && s.active === false) return false;
      return true;
    });
  }

  function companyFirms() {
    if (typeof users !== 'function') {
      var all = (typeof DB !== 'undefined' && DB && DB.users) ? DB.users : [];
      return all.filter(function (u) { return u.type === 'firm' && firmBelongs(u); });
    }
    return users('firm').filter(firmBelongs);
  }

  function companySiteCodes() {
    var set = {};
    companySites().forEach(function (s) { set[s.code] = 1; });
    return set;
  }

  /* Scope a snapshot DB object in-place BEFORE takeBaseline so saves never delete the other company. */
  function scopeDbToCompany(db) {
    if (!db) return db;
    var co = companyId();
    var keptSites = (db.sites || []).filter(function (s) {
      /* Temporarily use row-only inference (DB may not be installed yet) */
      if (s.companyId === 'us' || s.companyId === 'cj') return s.companyId === co;
      if (s.company_id === 'us' || s.company_id === 'cj') return s.company_id === co;
      var num = siteNumber(s.code);
      if (num != null && num >= 101 && num <= 199) return co === 'cj';
      if (num != null && num >= 201 && num <= 299) return co === 'us';
      return co === 'us';
    });
    var siteSet = {};
    keptSites.forEach(function (s) { siteSet[s.code] = 1; });
    var firmIds = {};
    keptSites.forEach(function (s) { if (s.firmId) firmIds[s.firmId] = 1; });

    function firmCo(f) {
      if (f.companyId === 'us' || f.companyId === 'cj') return f.companyId;
      if (f.firm && (f.firm.companyId === 'us' || f.firm.companyId === 'cj')) return f.firm.companyId;
      if (firmIds[f.id]) return co;
      var t = (f.firm && f.firm.clientType) || '';
      if (/^farm$/i.test(t)) return 'us';
      if (/^(cleaning|office)$/i.test(t)) return 'cj';
      return 'us';
    }

    db.sites = keptSites;
    if (db.users) {
      db.users = db.users.filter(function (u) {
        if (u.type === 'firm') return firmCo(u) === co;
        /* Keep non-firm accounts (workers/office/subs) — dual employees share auth; shell filters sites */
        return true;
      });
      db.users.forEach(function (u) {
        if (u.type === 'firm' && !u.companyId) u.companyId = co;
      });
    }
    function keepByFirm(row) { return row && row.firmId && firmIds[row.firmId]; }
    function keepBySite(row) {
      if (!row) return false;
      if (row.site && siteSet[row.site]) return true;
      if (row.siteCode && siteSet[row.siteCode]) return true;
      if (!row.site && !row.siteCode && row.firmId) return !!firmIds[row.firmId];
      /* Office-wide rows without site stay for office tools */
      if (!row.site && !row.siteCode && !row.firmId) return true;
      return !!(row.site && siteSet[row.site]);
    }
    ['farmRates', 'firmSigs', 'clientInvoices', 'crewOrders', 'clientRecs'].forEach(function (k) {
      if (!db[k]) return;
      db[k] = db[k].filter(function (r) {
        if (r.companyId && r.companyId !== co) return false;
        if (r.firmId) return !!firmIds[r.firmId] || (r.companyId === co);
        return true;
      });
    });
    if (db.time) {
      db.time = db.time.filter(function (t) {
        if (t.companyId && t.companyId !== co) return false;
        if (t.site) return !!siteSet[t.site];
        return true;
      });
    }
    if (db.shifts) {
      db.shifts = db.shifts.filter(function (s) {
        if (s.companyId && s.companyId !== co) return false;
        if (s.site) return !!siteSet[s.site];
        return true;
      });
    }
    if (db.changes) {
      db.changes = db.changes.filter(function (c) {
        if (c.companyId && c.companyId !== co) return false;
        if (c.firmId && firmIds[c.firmId]) return true;
        if (c.site && siteSet[c.site]) return true;
        return !c.firmId && !c.site;
      });
    }
    db.sites.forEach(function (s) { if (!s.companyId) s.companyId = co; });
    return db;
  }

  window.REG_COMPANY = {
    id: companyId,
    companyId: companyId,
    normCode: normCode,
    siteNumber: siteNumber,
    inferSiteCompany: inferSiteCompany,
    inferFirmCompany: inferFirmCompany,
    siteBelongs: siteBelongs,
    firmBelongs: firmBelongs,
    tagCompany: tagCompany,
    companySites: companySites,
    companyFirms: companyFirms,
    companySiteCodes: companySiteCodes,
    scopeDbToCompany: scopeDbToCompany
  };
  window.companyId = companyId;
  window.tagCompany = tagCompany;
  window.companySites = companySites;
  window.companyFirms = companyFirms;
  window.siteBelongs = siteBelongs;
  window.firmBelongs = firmBelongs;
  window.scopeDbToCompany = scopeDbToCompany;

/* ---- Patch list / create paths once UI globals exist ---- */
  function patchLists() {
    if (typeof clockSites === 'function') {
      window.clockSites = function () {
        return companySites({ withFirm: true });
      };
    }
    if (typeof mtSites === 'function') {
      window.mtSites = function () {
        return companySites({ withFirm: true, skipPractice: true, activeOnly: true });
      };
    }
    /* firm create / add site – stamp companyId */
    if (typeof FORMS !== 'undefined') {
      if (FORMS.newfirm && !FORMS.newfirm._coTagged) {
        var onf = FORMS.newfirm;
        FORMS.newfirm = function (f, d) {
          var before = (DB.sites || []).length;
          var bu = (DB.users || []).length;
          onf(f, d);
          if ((DB.users || []).length > bu) {
            var u = DB.users[DB.users.length - 1];
            if (u && u.type === 'firm') tagCompany(u);
          }
          if ((DB.sites || []).length > before) {
            tagCompany(DB.sites[DB.sites.length - 1]);
          }
        };
        FORMS.newfirm._coTagged = true;
      }
      if (FORMS.addsite && !FORMS.addsite._coTagged) {
        var oas = FORMS.addsite;
        FORMS.addsite = function (f, d) {
          var before = (DB.sites || []).length;
          oas(f, d);
          if ((DB.sites || []).length > before) tagCompany(DB.sites[DB.sites.length - 1]);
        };
        FORMS.addsite._coTagged = true;
      }
      if (FORMS.clnew && !FORMS.clnew._coTagged) {
        var ocl = FORMS.clnew;
        FORMS.clnew = function (f, d) {
          var before = (DB.sites || []).length;
          var bu = (DB.users || []).length;
          ocl(f, d);
          if ((DB.users || []).length > bu) {
            var u = DB.users[DB.users.length - 1];
            if (u) tagCompany(u);
          }
          (DB.sites || []).slice(before).forEach(tagCompany);
        };
        FORMS.clnew._coTagged = true;
      }
    }
    /* Admin / client list views that call users('firm'): scope to this company */
    if (typeof users === 'function' && !window._coUsersWrapped) {
      var _users = users;
      window.users = function (t) {
        var list = _users(t);
        if (t === 'firm') return list.filter(firmBelongs);
        return list;
      };
      window._coUsersWrapped = true;
    }
  }

  function applyPatches() {
    try { patchLists(); } catch (e) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyPatches);
  } else {
    applyPatches();
  }
  setTimeout(applyPatches, 0);
  setTimeout(applyPatches, 50);
})();
