// reg-messages/providers.ts – PROPOSED. One SMS interface, three providers. Pick with the function secret SMS_PROVIDER
// = "quo" (default – recommended, existing number +1 902-200-4888) | "telnyx" | "twilio". Keys are function secrets, never in the browser.
//   quo:    QUO_API_KEY, QUO_FROM (default PN5pixOySo)                      POST https://api.openphone.com/v1/messages
//   telnyx: TELNYX_API_KEY, TELNYX_FROM (+1 E.164), TELNYX_PROFILE_ID (opt.) POST https://api.telnyx.com/v2/messages
//   twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+1 E.164)   POST https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json
export type SmsResult = { ok: boolean; id?: string; status: number; why?: string };
export type Env = (k: string) => string | undefined;
export const PROVIDERS = ["quo", "telnyx", "twilio"] as const;
export function providerName(env: Env): string { const p = (env("SMS_PROVIDER") ?? "quo").toLowerCase(); return (PROVIDERS as readonly string[]).includes(p) ? p : "quo"; }
export async function sendSms(env: Env, f: typeof fetch, to: string, text: string): Promise<SmsResult> {
  const p = providerName(env);
  const once = async (): Promise<Response> => {
    if (p === "telnyx") {
      const k = env("TELNYX_API_KEY"), from = env("TELNYX_FROM"); if (!k || !from) throw new Error("not configured");
      const body: Record<string, string> = { from, to, text }; const prof = env("TELNYX_PROFILE_ID"); if (prof) body.messaging_profile_id = prof;
      return f("https://api.telnyx.com/v2/messages", { method: "POST", headers: { Authorization: "Bearer " + k, "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    if (p === "twilio") {
      const sid = env("TWILIO_ACCOUNT_SID"), tok = env("TWILIO_AUTH_TOKEN"), from = env("TWILIO_FROM"); if (!sid || !tok || !from) throw new Error("not configured");
      return f(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: "POST", headers: { Authorization: "Basic " + btoa(sid + ":" + tok), "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ From: from, To: to, Body: text }).toString() });
    }
    const k = env("QUO_API_KEY"); if (!k) throw new Error("not configured");
    const base = (env("QUO_API_BASE") ?? "https://api.openphone.com").replace(/\/$/, "");
    return f(`${base}/v1/messages`, { method: "POST", headers: { Authorization: k, "Content-Type": "application/json" }, body: JSON.stringify({ content: text, from: env("QUO_FROM") ?? "PN5pixOySo", to: [to] }) });
  };
  let r: Response;
  try { r = await once(); if (r.status === 429 || r.status >= 500) r = await once(); } catch (e) { return { ok: false, status: 0, why: (e as Error).message === "not configured" ? "sms not configured" : "network error" }; }
  const j = await r.json().catch(() => ({})) as Record<string, any>;
  if (r.ok) return { ok: true, status: r.status, id: String(j?.data?.id ?? j?.sid ?? "") };
  return { ok: false, status: r.status, why: r.status === 402 ? "no prepaid SMS credit" : `${p} HTTP ${r.status}` };
}
