/* Public settings only. The publishable key is designed to be in the browser; all data access is enforced by
 * row-level security in the database. NEVER put the service key, DB password or any client name here. */
window.ST_CONFIG = {
  url: 'https://lfefpmzfnvgwuicthlyg.supabase.co',
  key: 'sb_publishable_3T6uAqwjHXpv4HUY5gOPGQ_gWqA88JI',
  // Employees log in with a phone number. Behind the scenes it becomes <10 digits>@<loginDomain>.
  // example.com is reserved (RFC 2606) with a "null MX" (RFC 7505): it can never receive mail.
  loginDomain: 'example.com',
  hst: 0.15,
  editDays: 14,
};
