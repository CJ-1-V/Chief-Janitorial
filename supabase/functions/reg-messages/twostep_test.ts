// twostep1 server tests. The fake below mirrors 027i (cooldown 60 s, 5 codes/hour, 10 min, 5 tries, 30-day devices).
import { assert, assertEquals } from "jsr:@std/assert@1";
import { handle, mfaHash, type Deps } from "./logic.ts";
function mk(env: Record<string, string> = {}, who: Record<string, unknown> = {}) {
  let now = 1_800_000_000_000; const mails: any[] = [], sms: any[] = [], logs: any[] = [];
  const st = { user_id: "u1", session_id: "s1", name: "Office Owner", email: "owner@unscramble.ca", phone: "", required: true, verified: false, ...who };
  const db: any = { code: null, sessions: new Set<string>(), devices: new Map<string, number>() };
  const d: Deps = {
    env: (k) => env[k], fetch: (async (_u: string) => { sms.push(_u); return new Response(JSON.stringify({ data: { id: "m1" }, sid: "SM1" }), { status: 200 }); }) as any,
    userRpc: async (fn) => { if (fn === "reg_mfa_status") return { ...st, verified: db.sessions.has(st.session_id) || st.verified }; return null; },
    adminRpc: async (fn, a: any) => {
      if (fn === "reg_msg_log") { logs.push(a); return null; }
      if (fn === "reg_sms_is_opted_out") return false;
      if (fn === "reg_mfa_code_put") { const c = db.code;
        if (c && c.last > now - 60_000) return "wait:" + Math.ceil((c.last + 60_000 - now) / 1000);
        if (c && c.win > now - 3_600_000 && c.sends >= 5) return "limit";
        const keep = c && c.win > now - 3_600_000; db.code = { h: a.p_hash, tries: 0, last: now, exp: now + 600_000, sends: keep ? c.sends + 1 : 1, win: keep ? c.win : now }; return "ok"; }
      if (fn === "reg_mfa_code_use") { const c = db.code; if (!c) return "expired"; if (c.exp < now) { db.code = null; return "expired"; } if (c.tries >= 5) return "locked";
        if (c.h !== a.p_hash) { c.tries++; return c.tries >= 5 ? "locked" : "wrong:" + (5 - c.tries); }
        db.code = null; db.sessions.add(a.p_session); if (a.p_trust_hash) db.devices.set(a.p_trust_hash, now + 30 * 86_400_000); return "ok"; }
      if (fn === "reg_mfa_trust_use") { const e = db.devices.get(a.p_hash); if (!e || e < now) return false; db.sessions.add(a.p_session); return true; }
      return null; },
    setPassword: async () => {}, sendMail: async (m) => { mails.push(m); return "e1"; }, random: (n) => new Uint32Array(n).fill(7),
  };
  return { d, mails, sms, logs, db, st, tick: (ms: number) => { now += ms; } };
}
const LIVE = { MESSAGES_SEND_ENABLED: "true" };
const code = "100007"; // genSix with random fill(7)
const DEV = "dev_abcdefghijklmnopqrstuvwxyz0123456789";

Deno.test("needs sign-in", async () => { const t = mk(); const r = await handle({ action: "mfa_send" }, t.d, false); assertEquals(r.status, 401); });
Deno.test("not required → verified straight away, nothing sent", async () => { const t = mk(LIVE, { required: false });
  const r: any = await handle({ action: "mfa_check" }, t.d, true); assert(r.verified); assertEquals(t.mails.length, 0); });
Deno.test("code by email from the company address, then right code signs in", async () => { const t = mk(LIVE);
  const c: any = await handle({ action: "mfa_check" }, t.d, true); assertEquals(c.verified, false); assertEquals(c.to, "o•••@unscramble.ca");
  const s: any = await handle({ action: "mfa_send" }, t.d, true); assert(s.ok); assertEquals(s.channel, "email"); assertEquals(t.mails.length, 1);
  assert(t.mails[0].text.includes(code)); assert(/sign-in code/.test(t.mails[0].subject));
  const v: any = await handle({ action: "mfa_verify", code }, t.d, true); assert(v.ok && v.verified);
  const again: any = await handle({ action: "mfa_check" }, t.d, true); assert(again.verified); });
Deno.test("dry run by default: nothing leaves", async () => { const t = mk(); const s: any = await handle({ action: "mfa_send" }, t.d, true); assert(s.ok); assertEquals(t.mails.length, 0); assert(/Dry run/.test(s.summary)); });
Deno.test("code never stored in clear and never in the log", async () => { const t = mk(LIVE); await handle({ action: "mfa_send" }, t.d, true);
  assertEquals(t.db.code.h, await mfaHash("u1", code)); assert(!JSON.stringify(t.logs).includes(code)); });
Deno.test("wrong code counts down, 5 wrong locks", async () => { const t = mk(LIVE); await handle({ action: "mfa_send" }, t.d, true);
  const w: any = await handle({ action: "mfa_verify", code: "999999" }, t.d, true); assertEquals(w.left, 4); assert(/4 tries left/.test(w.error));
  for (let i = 0; i < 4; i++) await handle({ action: "mfa_verify", code: "999999" }, t.d, true);
  const l: any = await handle({ action: "mfa_verify", code }, t.d, true); assert(l.locked); });
Deno.test("expires after 10 minutes", async () => { const t = mk(LIVE); await handle({ action: "mfa_send" }, t.d, true); t.tick(601_000);
  const r: any = await handle({ action: "mfa_verify", code }, t.d, true); assert(r.expired); });
Deno.test("resend cooldown 60 s, max 5 per hour", async () => { const t = mk(LIVE); await handle({ action: "mfa_send" }, t.d, true);
  const w: any = await handle({ action: "mfa_send" }, t.d, true); assertEquals(w.status, 429); assert(w.wait > 0 && w.wait <= 60);
  for (let i = 0; i < 4; i++) { t.tick(61_000); const ok: any = await handle({ action: "mfa_send" }, t.d, true); assert(ok.ok); }
  t.tick(61_000); const lim: any = await handle({ action: "mfa_send" }, t.d, true); assert(/Too many codes/.test(lim.error));
  t.tick(3_600_000); const back: any = await handle({ action: "mfa_send" }, t.d, true); assert(back.ok); });
Deno.test("remember this device: 30 days, then asks again", async () => { const t = mk(LIVE); await handle({ action: "mfa_send" }, t.d, true);
  const v: any = await handle({ action: "mfa_verify", code, remember: true, device: DEV }, t.d, true); assert(v.remembered);
  t.db.sessions.clear(); t.st.session_id = "s2";
  const c: any = await handle({ action: "mfa_check", device: DEV }, t.d, true); assert(c.verified); assertEquals(c.how, "trusted device");
  t.db.sessions.clear(); t.st.session_id = "s3"; t.tick(31 * 86_400_000);
  const c2: any = await handle({ action: "mfa_check", device: DEV }, t.d, true); assertEquals(c2.verified, false);
  const other: any = await handle({ action: "mfa_check", device: "dev_someoneelse_0123456789abcdefghijklmn" }, t.d, true); assertEquals(other.verified, false); });
Deno.test("no email: text fallback when an SMS provider is set", async () => { const t = mk({ ...LIVE, SMS_PROVIDER: "quo", QUO_API_KEY: "k", QUO_FROM: "+19022004888" }, { email: null, phone: "902 555 0142" });
  const s: any = await handle({ action: "mfa_send" }, t.d, true); assert(s.ok); assertEquals(s.channel, "sms"); assertEquals(t.mails.length, 0); assertEquals(t.sms.length, 1); });
Deno.test("no email and no texting: not locked out, flagged in the log", async () => { const t = mk(LIVE, { email: null, phone: "902 555 0142" });
  const c: any = await handle({ action: "mfa_check" }, t.d, true); assert(c.verified); assertEquals(c.skipped, "no email on file"); assert(t.logs.some((x) => x.p_why === "no email on file")); });
