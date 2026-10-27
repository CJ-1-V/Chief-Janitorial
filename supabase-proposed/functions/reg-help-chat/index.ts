// Edge Function entry: reg-help-chat. Deploy with verify_jwt = false (used signed out).
// Secrets by NAME: ANTHROPIC_API_KEY, (opt) HELP_CHAT_MODEL, CHAT_SUMMARY_SEND_ENABLED (default off), CHAT_SUMMARY_TEXT_ENABLED (default off), QUO_API_KEY (only if text on).
import nodemailer from "npm:nodemailer@9.1.1";
import { anthropic, handle, type Chat } from "./logic.ts";
const URL_ = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
function keySet(n: string): string[] { try { return Object.values(JSON.parse(Deno.env.get(n) ?? "") as Record<string, string>).filter(Boolean); } catch { return []; } }
const ADMIN = [...keySet("SUPABASE_SECRET_KEYS"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""].filter(Boolean)[0] ?? "";
const ALLOWED = ["https://www.chiefjanitorial.com", "https://chiefjanitorial.com", "https://app.unscramble.ca"];
const H = { apikey: ADMIN, Authorization: "Bearer " + ADMIN, "Content-Type": "application/json" };
const rest = (p: string, init: RequestInit = {}) => fetch(`${URL_}/rest/v1/${p}`, { ...init, headers: { ...H, ...(init.headers ?? {}) } });
async function rpc(fn: string, a: unknown) { const r = await rest(`rpc/${fn}`, { method: "POST", body: JSON.stringify(a) }); const t = await r.text(); if (!r.ok) throw new Error("rpc"); return t ? JSON.parse(t) : null; }
async function ipHash(ip: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("rhc:" + ip)); return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join(""); }
let PASS = "";
// owner add-on: split the summary lines into columns (status keeps its DB default 'new').
const FIELDS: Record<string, string> = { "name": "name", "phone": "phone", "email": "email", "role": "role", "farm": "farm", "screen/error": "screen", "needed": "needed", "solved": "solved", "follow-up": "follow_up" };
function fields(sum?: string): Record<string, string | null> { const o: Record<string, string | null> = {}; if (!sum) return o;
  for (const line of sum.split("\n")) { const m = /^\s*([A-Za-z\/-]+)\s*:\s*(.*)$/.exec(line); const k = m && FIELDS[m[1].toLowerCase()]; if (k) { const v = m![2].trim(); o[k] = v && v !== "-" ? v.slice(0, 500) : null; } }
  return o; }
Deno.serve(async (req) => {
  const o = req.headers.get("Origin") ?? "";
  const cors = { "Access-Control-Allow-Origin": ALLOWED.includes(o) ? o : ALLOWED[2], Vary: "Origin", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (x: unknown, s = 200) => new Response(JSON.stringify(x), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
  if (!ALLOWED.includes(o)) return json({ error: "Not allowed." }, 403);
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
  const raw = await req.text(); if (raw.length > 4000) return json({ error: "Too long." }, 413);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: "Bad request." }, 400); }
  const ip = await ipHash((req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown");
  const KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? ""; const MODEL = Deno.env.get("HELP_CHAT_MODEL") ?? "claude-sonnet-5-5";
  try {
    const out = await handle(body, ip, {
      env: (k) => Deno.env.get(k), now: () => Date.now(), newId: () => crypto.randomUUID(),
      claude: (s, m, n) => anthropic(KEY, MODEL, s, m, n),
      load: async (id) => { const r = await rest(`reg_help_chats?id=eq.${id}&select=*`); const a = await r.json(); const x = a?.[0]; return x ? { id: x.id, ip: x.ip_hash, msgs: x.messages, created: Date.parse(x.created_at), last: Date.parse(x.last_at), ended: !!x.ended_at, summary: x.summary } as Chat : null; },
      save: async (c) => { await rest("reg_help_chats", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" }, body: JSON.stringify({ id: c.id, ip_hash: c.ip, messages: c.msgs, created_at: new Date(c.created).toISOString(), last_at: new Date(c.last).toISOString(), ended_at: c.ended ? new Date().toISOString() : null, end_reason: c.end_reason ?? null, summary: c.summary ?? null, ...fields(c.summary) }) }); },
      // Same mail path as reg-messages: admin@unscramble.ca Gmail SMTP, app password read via reg_welcome_smtp_secret RPC.
      sendMail: async (m) => {
        if (!PASS) { const p = await rpc("reg_welcome_smtp_secret", {}); if (typeof p !== "string" || !p) throw new Error("mail not set up"); PASS = p.replace(/\s+/g, ""); }
        const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: "admin@unscramble.ca", pass: PASS } });
        try { const i = await t.sendMail({ from: { name: "UnScramble", address: "admin@unscramble.ca" }, to: m.to, subject: m.subject, text: m.text }); return String(i.messageId ?? ""); } finally { try { t.close(); } catch { /* */ } }
      },
      // Optional Quo text (off by default). Quo API: POST /v1/messages from the 902 inbox number.
      sendText: async (to, text) => { const k = Deno.env.get("QUO_API_KEY"); if (!k) throw new Error("no quo key");
        const r = await fetch("https://api.openphone.com/v1/messages", { method: "POST", headers: { Authorization: k, "Content-Type": "application/json" }, body: JSON.stringify({ from: "PN5pixOySo", to: [to], content: text }) }); if (!r.ok) throw new Error("quo " + r.status); },
      log: (m, x) => console.log(JSON.stringify({ fn: "reg-help-chat", m, ...x })),
    });
    const { status, ...rest_ } = out; return json(rest_, status);
  } catch (e) { console.log(JSON.stringify({ fn: "reg-help-chat", m: "err", e: String(e) })); return json({ error: "Sorry, help chat is not working right now. Call or text 902-200-4888." }, 500); }
});
