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
/* Every invoice the app lays out (screen, print, PDF) ends with these three ways to pay.
   The cheque line uses the wording for the payment block. The letterhead above keeps the full street address. */
window.cjPaymentSentence = function () {
  return 'Payment options: Interac e-Transfer to admin@chiefjanitorial.com; cheque mailed to Unit I, 56 Burns Ave, Charlottetown, PE C1E 2G1; or cheque pickup by a company employee on request.';
};
window.cjPaymentLines = function (L) {
  if (L && !L.some(function (row) { return row && row[0] === 's' && /^Payment options:/.test(String(row[1] || '')); })) L.push(['s', window.cjPaymentSentence()]);
  return L;
};
/* 'TEST VERSION' invoice line only in mock (fake data) mode, never in live Supabase mode (Oct 12 2026) */
window.cjMockInv = function () { return !(window.REG_STORE && window.REG_STORE.mode === 'supabase'); };
