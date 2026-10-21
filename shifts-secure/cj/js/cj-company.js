/* cj-company.js – THE one place for Chief Janitorial's company block (owner, Oct 12 2026).
   Used by client invoices (screen, print and PDF) and the monthly bill/invoice. Edit here only. HST rate stays 15%. */
window.CJ_COMPANY = {
  name: 'Chief Janitorial Inc.',
  address: 'Unit I, 56 Burns Avenue, Charlottetown PE C1E 2G1',
  phone: '(902) 200-4888',
  taxNo: 'GST/HST 755653946 RT0001',
  email: 'admin@chiefjanitorial.com',   // flatmonthly1 (Oct 19 2026): current invoice template contact + e-transfer address
  phoneShort: '902-200-4888',
  web: 'www.chiefjanitorial.com',
  hstRate: 0.15
};
/* invoice header lines in the invDoc line format: ['h', name] then small lines */
window.cjCompanyHead = function (L) {
  var c = window.CJ_COMPANY;
  L.push(['h', c.name]); L.push(['s', c.address]); L.push(['s', c.phone]); L.push(['s', c.taxNo]);
  return L;
};
/* 'TEST VERSION' invoice line only in mock (fake data) mode, never in live Supabase mode (Oct 12 2026) */
window.cjMockInv = function () { return !(window.REG_STORE && window.REG_STORE.mode === 'supabase'); };
