# CJ email sender (`cj-send-email`)

Proposed only. This function is not deployed, and this change does not run SQL or change Supabase Auth or SMTP. UnScramble uses the same project (`lfefpmzfnvgwuicthlyg`). Leave **Confirm email** off, and do not set a project SMTP server.

The function sends Chief Janitorial mail through Resend (`https://api.resend.com/emails`). The key is the secret `RESEND_API_KEY`. It is never written in the repo and never logged.

- From: `Chief Janitorial Support <support@chiefjanitorial.com>`
- Reply-To: `admin@chiefjanitorial.com`
- Only a signed-in user whose company is `cj` is accepted. Any other company is refused. The message goes to that user's own email.
- If `RESEND_API_KEY` is unset, or the call uses `?store=mock`, the function records the email and does not call Resend.

The CJ app calls it for the 6-digit sign-in code (plain text, 15-minute expiry). In the app, `?store=mock` records that email in the browser and does not call this function. On the public site that link is ignored, the same way the test data switch is ignored.

The company check uses the signed-in account. An app company (`app_metadata`) wins. Sign-up metadata is used only when no app company is set, which is how the CJ app marks `company: cj` today. The message goes only to that account's own email.

Draft `shifts-secure/cj/migrations/cj-sec-002.sql` is not applied and is not called. This function only sends a code it is given. The mock app creates that code. A live sign-up does not have one until that draft is applied separately.

## Setup (do this yourself)

1. In Resend, open Domains and add `chiefjanitorial.com` (the root domain, so `support@chiefjanitorial.com` can send). Pick the region closest to your recipients. North America is usually `us-east-1`.
2. Open that domain's Records tab and add every record Resend shows, copied exactly. Do not proxy CNAME records (Cloudflare's orange cloud breaks verification). Domains added after August 2026 may show CNAME records instead of TXT and MX. Use the Records tab if it differs from the example below.

   Example when Resend still shows TXT and MX for region `us-east-1` (the DKIM value is generated for your domain — paste the one Resend shows, not this sample):

   | Purpose | Type | Name | Value | Priority |
   | --- | --- | --- | --- | --- |
   | DKIM | TXT | `resend._domainkey` | the `p=...` value from the Records tab | |
   | SPF | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` | 10 |
   | SPF | TXT | `send` | `v=spf1 include:amazonses.com ~all` | |
   | DMARC | TXT | `_dmarc` | `v=DMARC1; p=none;` | |

   `send` and `_dmarc` are under `chiefjanitorial.com` (`send.chiefjanitorial.com`, `_dmarc.chiefjanitorial.com`). Add DMARC after the domain shows verified. Wait until Resend marks the domain verified (often within 15 minutes, sometimes up to 72 hours).

3. In Resend, create a sending API key. Do not commit it and do not paste it into Auth or SMTP settings.
4. Store it as a function secret (Dashboard → Edge Functions → Secrets, or the CLI after `supabase link --project-ref lfefpmzfnvgwuicthlyg`):

   ```bash
   supabase secrets set RESEND_API_KEY=re_your_key_here
   ```

5. Deploy only this function. Leave its JWT check on (the platform default). Do not change Auth, Confirm email, or SMTP.

   ```bash
   supabase functions deploy cj-send-email --project-ref lfefpmzfnvgwuicthlyg
   ```

Until the secret is set, a deployed function stays in mock mode and does not send.

## Rollback

1. Delete the function: `supabase functions delete cj-send-email --project-ref lfefpmzfnvgwuicthlyg`
2. Remove the secret: `supabase secrets unset RESEND_API_KEY --project-ref lfefpmzfnvgwuicthlyg`
3. Revert this change so the app stops calling the function.
4. Leave Auth and SMTP as they are. Nothing in this change alters them, and there is no database object to drop.
5. To stop Resend from sending as the domain, remove the DNS records you added. Leaving them in place does not send mail by itself.

## Tests

Fake addresses only. Mock mode only. No real email is sent.

```bash
node --experimental-strip-types --test supabase/functions/cj-send-email/logic_test.ts
node --test shifts-secure/cj/test/cj-sec.test.js
```
