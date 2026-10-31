import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { companyOf, emailOf, FROM, handle, REPLY_TO, RESEND_URL, signInCodeText, type Deps } from "./logic.ts";

const FAKE_KEY = "re_test_fake_not_real";
const CODE = "482913";
const TO = "person@example.com";

function cjCaller() {
  return { email: TO, company: "cj" };
}

function harness(env: Record<string, string> = {}, caller = cjCaller) {
  const calls: { url: string; init: { method?: string; headers?: Record<string, string>; body?: string } }[] = [];
  const recorded: unknown[] = [];
  const logs: string[] = [];
  const deps: Deps = {
    env: (k) => env[k],
    fetch: (async (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      calls.push({ url: String(url), init: init || {} });
      return new Response(JSON.stringify({ id: "email_test_fake" }), { status: 200, headers: { "Content-Type": "application/json" } });
    }) as Deps["fetch"],
    caller: async () => caller(),
    record: (m) => recorded.push(m),
    log: (m) => logs.push(m),
  };
  return { deps, calls, recorded, logs };
}

const signin = { kind: "signin_code", company: "cj", code: CODE };

test("mock is the default when the key is unset: nothing is posted, the email is recorded", async () => {
  const t = harness();
  const out = await handle(signin, t.deps, false);
  assert.equal(out.status, 200);
  assert.equal(out.body.mock, true);
  assert.equal(t.calls.length, 0);
  const mail = out.body.recorded as { from: string; reply_to: string; to: string; text: string; subject: string };
  assert.equal(mail.from, FROM);
  assert.equal(mail.from, "Chief Janitorial Support <support@chiefjanitorial.com>");
  assert.equal(mail.reply_to, REPLY_TO);
  assert.equal(mail.reply_to, "admin@chiefjanitorial.com");
  assert.equal(mail.to, TO);
  assert.match(mail.text, new RegExp("sign-in code is " + CODE));
  assert.match(mail.text, /15 minutes/);
  assert.match(mail.text, /did not ask for this/);
  assert.equal(mail.text, signInCodeText(CODE));
  assert.deepEqual(t.recorded[0], mail);
  assert.equal(t.logs.join(" "), "recorded");
  assert.equal(JSON.stringify(t.logs).includes(CODE), false);
  assert.equal(JSON.stringify(out.body).includes("RESEND_API_KEY"), false);
});

test("a bad kind or a short code is refused and not recorded", async () => {
  const t = harness();
  const kind = await handle({ kind: "welcome", company: "cj", code: CODE }, t.deps, false);
  assert.equal(kind.status, 400);
  const digits = await handle({ kind: "signin_code", company: "cj", code: "12ab" }, t.deps, false);
  assert.equal(digits.status, 400);
  assert.equal(t.calls.length, 0);
  assert.equal(t.recorded.length, 0);
  assert.equal(JSON.stringify(digits.body).includes("12ab"), false);
});

test("a blank key is still mock", async () => {
  const t = harness({ RESEND_API_KEY: "   " });
  const out = await handle(signin, t.deps, false);
  assert.equal(out.body.mock, true);
  assert.equal(t.calls.length, 0);
});

test("?store=mock records and does not send even when a fake key is present", async () => {
  const t = harness({ RESEND_API_KEY: FAKE_KEY });
  const out = await handle({ ...signin, store: "mock" }, t.deps, false);
  assert.equal(out.body.mock, true);
  assert.equal(t.calls.length, 0);
  const forced = await handle(signin, t.deps, true);
  assert.equal(forced.body.mock, true);
  assert.equal(t.calls.length, 0);
  assert.equal(JSON.stringify(t.logs).includes(FAKE_KEY), false);
  assert.equal(JSON.stringify(t.recorded).includes(FAKE_KEY), false);
});

test("other companies are refused and nothing is recorded", async () => {
  const cases: { caller: string; asked?: string }[] = [
    { caller: "us", asked: "us" },
    { caller: "us", asked: "cj" },
    { caller: "", asked: "cj" },
    { caller: "cj-main", asked: "cj" },
    { caller: "cj", asked: "us" },
  ];
  for (const row of cases) {
    const h = harness({}, async () => ({ email: "other@example.com", company: row.caller }));
    const out = await handle({ kind: "signin_code", company: row.asked, code: CODE }, h.deps, false);
    assert.equal(out.status, 403, row.caller + "/" + row.asked);
    assert.equal(h.calls.length, 0);
    assert.equal(h.recorded.length, 0);
    assert.equal(JSON.stringify(out.body).includes(CODE), false);
  }
  const missing = harness({}, async () => null);
  const signedOut = await handle(signin, missing.deps, false);
  assert.equal(signedOut.status, 401);
  assert.equal(missing.calls.length, 0);
  const normalized = harness({}, async () => ({ email: TO, company: "CJ" }));
  const ok = await handle({ kind: "signin_code", company: "cj", code: CODE }, normalized.deps, false);
  assert.equal(ok.body.mock, true);
  assert.equal((ok.body.recorded as { to: string }).to, TO);
});

test("app company wins over sign-up metadata, and a different recipient is refused", async () => {
  assert.equal(companyOf({ app_metadata: { company: "us" }, user_metadata: { company: "cj" } }), "us");
  assert.equal(companyOf({ user_metadata: { company: "cj" } }), "cj");
  assert.equal(companyOf({ app_metadata: { app: "cj" } }), "cj");
  assert.equal(companyOf(null), "");
  assert.equal(emailOf({ email: "Person@Example.com" }), TO);
  const blocked = harness({}, async () => ({ email: TO, company: companyOf({ app_metadata: { company: "us" }, user_metadata: { company: "cj" } }) }));
  const no = await handle(signin, blocked.deps, false);
  assert.equal(no.status, 403);
  assert.equal(blocked.calls.length, 0);
  const mismatch = harness();
  const bad = await handle({ ...signin, to: "elsewhere@example.com" }, mismatch.deps, false);
  assert.equal(bad.status, 403);
  assert.equal(mismatch.calls.length, 0);
  assert.equal(mismatch.recorded.length, 0);
});

test("a fake key posts once to Resend and the key is not logged", async () => {
  const t = harness({ RESEND_API_KEY: FAKE_KEY });
  const out = await handle(signin, t.deps, false);
  assert.equal(out.status, 200);
  assert.equal(out.body.mock, false);
  assert.equal(out.body.id, "email_test_fake");
  assert.equal(t.calls.length, 1);
  assert.equal(t.calls[0].url, RESEND_URL);
  assert.equal(t.calls[0].init.method, "POST");
  assert.equal(t.calls[0].init.headers?.Authorization, "Bearer " + FAKE_KEY);
  const body = JSON.parse(String(t.calls[0].init.body));
  assert.equal(body.from, "Chief Janitorial Support <support@chiefjanitorial.com>");
  assert.deepEqual(body.to, [TO]);
  assert.equal(body.reply_to, "admin@chiefjanitorial.com");
  assert.equal(body.subject, "Your Chief Janitorial sign-in code");
  assert.equal(body.text, signInCodeText(CODE));
  assert.equal(body.html, undefined);
  assert.equal(t.logs.join(" "), "sent");
  assert.equal(JSON.stringify(t.logs).includes(FAKE_KEY), false);
  assert.equal(JSON.stringify(t.logs).includes(CODE), false);
  assert.equal(JSON.stringify(out.body).includes(CODE), false);
  assert.equal(JSON.stringify(out.body).includes(FAKE_KEY), false);
});

test("a failed post does not echo the upstream body", async () => {
  const t = harness({ RESEND_API_KEY: FAKE_KEY });
  t.deps.fetch = (async () => new Response(JSON.stringify({ message: FAKE_KEY }), { status: 422 })) as Deps["fetch"];
  const out = await handle(signin, t.deps, false);
  assert.equal(out.status, 502);
  assert.equal(JSON.stringify(out.body).includes(FAKE_KEY), false);
  assert.equal(out.body.error, "Email was not sent.");
});

test("source does not hard-code a key and does not touch Auth or SMTP", () => {
  const dir = path.dirname(new URL(import.meta.url).pathname);
  const src = ["logic.ts", "index.ts"].map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
  assert.equal(/re_[A-Za-z0-9]{10,}/.test(src), false);
  assert.match(src, /RESEND_API_KEY/);
  assert.match(src, /https:\/\/api\.resend\.com\/emails/);
  assert.doesNotMatch(src, /smtp\.gmail|nodemailer|mailer_autoconfirm|GOTRUE_SMTP|external_email_enabled/i);
  assert.match(src, /Chief Janitorial Support <support@chiefjanitorial\.com>/);
  const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
  assert.match(readme, /chiefjanitorial\.com/);
  assert.match(readme, /RESEND_API_KEY/);
  assert.match(readme, /Rollback/);
  assert.match(readme, /Confirm email/);
  assert.doesNotMatch(readme, /re_[A-Za-z0-9]{20,}/);
});
