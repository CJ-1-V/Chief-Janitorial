// Edge Function entry: cj-send-email. PROPOSED – NOT DEPLOYED.
// Do not deploy this from the repo task. Do not change Auth "Confirm email" or project SMTP.
// The Resend key is the secret RESEND_API_KEY. It is read here and never logged or written into a response.
import { companyOf, emailOf, handle, type Deps } from "./logic.ts";

const ORIGIN = Deno.env.get("APP_ORIGIN") ?? "https://www.chiefjanitorial.com";
const CORS = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function publishable(): string {
  const raw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "";
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    const v = Object.values(parsed).find((x) => typeof x === "string" && x);
    if (v) return v;
  } catch { /* use the legacy name below */ }
  return Deno.env.get("SUPABASE_ANON_KEY") ?? "";
}

async function callerOf(auth: string) {
  const url = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  const key = publishable();
  if (!url || !key || !auth.startsWith("Bearer ") || auth === "Bearer " + key) return null;
  const r = await fetch(url + "/auth/v1/user", { headers: { apikey: key, Authorization: auth } });
  if (!r.ok) return null;
  const u = await r.json();
  return { email: emailOf(u), company: companyOf(u) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json({ ok: false, error: "Bad request." }, 400); }
  const url = new URL(req.url);
  const storeMock = url.searchParams.get("store") === "mock";
  const auth = req.headers.get("Authorization") ?? "";
  const deps: Deps = {
    env: (k) => Deno.env.get(k) ?? undefined,
    fetch,
    caller: () => callerOf(auth),
    log: (m) => console.log(JSON.stringify({ fn: "cj-send-email", m })),
  };
  try {
    const out = await handle(body, deps, storeMock);
    return json(out.body, out.status);
  } catch {
    return json({ ok: false, error: "Email was not sent." }, 400);
  }
});
