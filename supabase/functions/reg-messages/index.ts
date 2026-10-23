// Edge Function entry: reg-messages. PROPOSED – NOT DEPLOYED. Deploy with verify_jwt = false (forgot-password is used signed out);
// the function checks the caller's token itself for every invite action. Secrets by NAME only – see README in the report.
import nodemailer from "npm:nodemailer@9.1.1";
import { handle } from "./logic.ts";
const URL_ = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
function keySet(n: string): string[] { try { return Object.values(JSON.parse(Deno.env.get(n) ?? "") as Record<string, string>).filter(Boolean); } catch { return []; } }
const ADMIN = [...keySet("SUPABASE_SECRET_KEYS"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""].filter(Boolean)[0] ?? "";
const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://www.chiefjanitorial.com";
const CORS = { "Access-Control-Allow-Origin": ORIGIN, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
async function call(fn: string, args: unknown, key: string, bearer: string) {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { apikey: key, Authorization: bearer, "Content-Type": "application/json" }, body: JSON.stringify(args) });
  const t = await r.text(); if (!r.ok) { let m = "Not allowed."; try { m = JSON.parse(t).message ?? m; } catch { /* */ } throw new Error(m); } return t ? JSON.parse(t) : null;
}
async function signedIn(auth: string) { if (!auth.startsWith("Bearer ") || auth === "Bearer " + ANON) return false;
  const r = await fetch(`${URL_}/auth/v1/user`, { headers: { apikey: ANON, Authorization: auth } }); return r.ok; }
let PASS = "";
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const auth = req.headers.get("Authorization") ?? "";
  let body; try { body = await req.json(); } catch { return json({ error: "Bad request." }, 400); }
  try {
    const out = await handle(body, {
      env: (k) => Deno.env.get(k), fetch,
      userRpc: (fn, a) => call(fn, a, ANON, auth),
      adminRpc: (fn, a) => call(fn, a, ADMIN, "Bearer " + ADMIN),
      setPassword: async (id, pw) => { const r = await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "PUT", headers: { apikey: ADMIN, Authorization: "Bearer " + ADMIN, "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }); if (!r.ok) throw new Error("Password not saved – it may be too weak."); },
      random: (n) => crypto.getRandomValues(new Uint32Array(n)),
      sendMail: async (m) => {
        if (!PASS) { const p = await call("reg_welcome_smtp_secret", {}, ADMIN, "Bearer " + ADMIN); if (typeof p !== "string" || !p) throw new Error("mail not set up"); PASS = p.replace(/\s+/g, ""); }
        const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "admin@unscramble.ca", pass: PASS } });
        try { const i = await t.sendMail({ from: { name: "UnScramble", address: "admin@unscramble.ca" }, to: m.to, subject: m.subject, text: m.text, ...(m.html ? { html: m.html } : {}) }); return String(i.messageId ?? ""); } finally { try { t.close(); } catch { /* */ } }
      },
      log: (m, x) => console.log(JSON.stringify({ fn: "reg-messages", m, ...x })),
    }, await signedIn(auth));
    return json(out, out.status);
  } catch (e) { return json({ ok: false, error: String((e as Error).message || "Not sent.") }, 400); }
});
