import { assert, assertEquals } from "jsr:@std/assert@1";
import { handle, resetHash, type Deps } from "./logic.ts";
function mk(env: Record<string, string> = {}, over: Partial<Deps> = {}) {
  const calls: any[] = [], rpc: any[] = [], mails: any[] = []; const store: Record<string, string> = {};
  const d: Deps = { env: (k) => env[k], fetch: (async (u: string, i: any) => { calls.push({ u, i }); return new Response(JSON.stringify({ data: { id: "m1" }, sid: "SM1" }), { status: env.__status ? +env.__status : 200 }); }) as any,
    userRpc: async (fn, a) => { rpc.push(fn); if (fn === "reg_farm_team_invite_for_send") return { invite_id: "finv1", name: "Sam Rivera", contact: "902 555 0177", role: "supervisor", farm: "Test Farm A", expires: "2026-11-05" }; return { expires: "2026-11-05" }; },
    adminRpc: async (fn, a: any) => { rpc.push(fn); if (fn === "reg_reset_find") return a.p_login === "nobody" ? null : { user_id: "u1", name: "Carla D", phone: "902 555 0142", email: "" };
      if (fn === "reg_reset_code_put") { store.h = a.p_hash; return null; } if (fn === "reg_reset_code_use") return a.p_hash === store.h ? "ok" : "wrong"; if (fn === "reg_sms_is_opted_out") return a.p_e164 === "+19025550199"; return null; },
    setPassword: async () => { rpc.push("setPassword"); }, sendMail: async (m) => { mails.push(m); return "e1"; }, random: (n) => new Uint32Array(n).fill(7), ...over };
  return { d, calls, rpc, mails, store };
}
Deno.test("reset by text, dry run by default: nothing leaves, neutral answer", async () => { const t = mk(); const r = await handle({ action: "reset_request", login: "9025550142", via: "sms" }, t.d, false);
  assertEquals(r.summary, "If we find an account with that login, we sent a code."); assertEquals(t.calls.length, 0); assert(t.rpc.includes("reg_msg_log")); assert(t.store.h.length === 64); });
Deno.test("unknown login gets the same answer", async () => { const t = mk(); const r = await handle({ action: "reset_request", login: "nobody" }, t.d, false); assertEquals(r.summary, "If we find an account with that login, we sent a code."); assert(!t.rpc.includes("reg_reset_code_put")); });
Deno.test("reset confirm: right code sets password, wrong code refused", async () => { const t = mk(); t.store.h = await resetHash("u1", "107007");
  assertEquals((await handle({ action: "reset_confirm", login: "x", code: "123456", password: "Garden-Tomato-77" }, t.d, false)).ok, false);
  assertEquals((await handle({ action: "reset_confirm", login: "x", code: "107007", password: "Garden-Tomato-77" }, t.d, false)).ok, true); assert(t.rpc.includes("setPassword")); });
for (const [p, url] of [["quo", "api.openphone.com/v1/messages"], ["telnyx", "api.telnyx.com/v2/messages"], ["twilio", "api.twilio.com/2010-04-01/Accounts/AC1/Messages.json"]]) {
  Deno.test(`live send via ${p}`, async () => { const t = mk({ MESSAGES_SEND_ENABLED: "true", SMS_PROVIDER: p, QUO_API_KEY: "k", TELNYX_API_KEY: "k", TELNYX_FROM: "+19025550000", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_FROM: "+19025550000" });
    await handle({ action: "reset_request", login: "9025550142", via: "sms" }, t.d, false); assertEquals(t.calls.length, 1); assert(t.calls[0].u.includes(url)); assert(String(t.calls[0].i.body).includes("password+reset+code") || String(t.calls[0].i.body).includes("password reset code")); });
}
Deno.test("no SMS credit (402) falls back to email for office invite", async () => { const t = mk({ MESSAGES_SEND_ENABLED: "true", QUO_API_KEY: "k", __status: "402" });
  const r: any = await handle({ action: "office_invite", client_id: "c1", name: "Pat", phone: "902 555 0101", email: "pat@farm.test", consent: true }, t.d, true);
  assertEquals(r.attempts.map((a: any) => a.status), ["failed", "sent"]); assertEquals(t.mails.length, 1); });
Deno.test("STOP number never texted", async () => { const t = mk({ MESSAGES_SEND_ENABLED: "true", QUO_API_KEY: "k" });
  const r: any = await handle({ action: "office_invite", client_id: "c1", name: "Pat", phone: "902 555 0199", email: "pat@farm.ca", via: "sms", consent: true }, t.d, true); assertEquals(t.calls.length, 0); assertEquals(r.attempts[0].why, "number replied STOP"); });
Deno.test("farm invite: needs sign-in; dry run text with role", async () => { const t = mk();
  assertEquals((await handle({ action: "farm_invite", code: "ABCD-EFGH", consent: true }, t.d, false)).status, 401);
  const r: any = await handle({ action: "farm_invite", code: "ABCD-EFGH", consent: true }, t.d, true); assertEquals(r.attempts[0].status, "dry_run"); assert(r.summary.startsWith("Dry run")); });
Deno.test("US number blocked without SMS_ALLOW_US", async () => { const t = mk({ MESSAGES_SEND_ENABLED: "true", QUO_API_KEY: "k" });
  const r: any = await handle({ action: "office_invite", client_id: "c1", name: "Pat", phone: "212 555 0101", email: "pat@farm.ca", via: "sms", consent: true }, t.d, true); assertEquals(r.attempts[0].why, "US texting is off"); assertEquals(t.calls.length, 0); });
Deno.test("sub invites a worker by email: join link, company name from the code, dry run by default", async () => {
  const t = mk({}, { userRpc: async (fn: string) => fn === "reg_sub_join_code" ? "E494KEJW" : fn === "reg_sub_by_code" ? { id: "s1", name: "Chief Janitorial inc." } : null });
  const r = await handle({ action: "sub_worker_invite", name: "Raj Kumar", email: "raj@example.com", consent: true }, t.d, true);
  assert(r.ok); assert((r as any).attempts.some((x: any) => x.channel === "email" && x.status === "dry_run")); assertEquals(t.mails.length, 0);
  const no = await handle({ action: "sub_worker_invite", name: "Raj" , consent: true }, t.d, true); assert(!no.ok);
  const out = await handle({ action: "sub_worker_invite", name: "Raj", email: "raj@example.com" }, t.d, false); assertEquals(out.status, 401);
});
Deno.test("sub invite sends from company email when switched on", async () => {
  const t = mk({ MESSAGES_SEND_ENABLED: "true" }, { userRpc: async (fn: string) => fn === "reg_sub_join_code" ? "E494KEJW" : { id: "s1", name: "Chief Janitorial inc." } });
  const r = await handle({ action: "sub_worker_invite", name: "Raj Kumar", email: "raj@example.com", consent: true, via: "email" }, t.d, true);
  assert(r.ok); assertEquals(t.mails.length, 1); assert(/\?join=E494KEJW#\/signup\/worker/.test(t.mails[0].text)); assert(/Chief Janitorial inc\. invited you/.test(t.mails[0].subject));
});
Deno.test("farm invite without email is refused (farmemail1)", async () => { const t = mk();
  const r: any = await handle({ action: "office_invite", client_id: "c1", name: "Pat", phone: "902 555 0199", consent: true }, t.d, true); assert(!r.ok); assert(/email is required/.test(r.error)); });
