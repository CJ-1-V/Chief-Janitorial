// reg-help-chat logic (pure, injectable, testable). PROPOSED – NOT DEPLOYED.
import { SYSTEM, SUMMARY } from "./prompt.ts";
export type Msg = { role: "user" | "assistant"; content: string };
export type Chat = { id: string; ip: string; msgs: Msg[]; created: number; last: number; ended?: boolean; summary?: string; end_reason?: string };
export type Deps = {
  env: (k: string) => string | undefined;
  now: () => number;
  claude: (system: string, msgs: Msg[], maxTokens: number) => Promise<{ text: string; inTok: number; outTok: number }>;
  load: (id: string) => Promise<Chat | null>;
  save: (c: Chat) => Promise<void>;
  sendMail: (m: { to: string; subject: string; text: string }) => Promise<string>;
  sendText?: (to: string, text: string) => Promise<void>;
  log: (m: string, x?: Record<string, unknown>) => void;
  newId: () => string;
};
export const LIMITS = { maxChars: 600, maxTurns: 12, perIpPerHour: 40, perIpChatsPerDay: 15, idleMs: 5 * 60_000, maxTokens: 700 };
const hits = new Map<string, number[]>();
export function rateOk(key: string, max: number, windowMs: number, now: number) {
  const a = (hits.get(key) ?? []).filter((t) => now - t < windowMs); if (a.length >= max) { hits.set(key, a); return false; }
  a.push(now); hits.set(key, a); return true;
}
// Mask anything that looks like a password/code before storing or summarising.
// Normalise North American phones to +1XXXXXXXXXX (any typing: 705 650 0024, 1-705..., +1(705)...).
export function normPhone(s: string) { const d = s.replace(/\D/g, ""); if (d.length === 10) return "+1" + d; if (d.length === 11 && d[0] === "1") return "+" + d; return null; }
export function fixPhones(s: string) { return s.replace(/(\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, (m) => normPhone(m) ?? m); }
export function scrub(s: string) {
  const ok = /^(not|no|never|wrong|reset|sent|coming|arriving|working|link|text|email|again|expired|the|a|my)$/i;
  return s.replace(/\b(pass(?:word|code)?|pw|pwd|otp|pin|code|ਪਾਸਵਰਡ|पासवर्ड)(\s*(?:is|:|=)\s*)([^\s,.;!?]+)/gi, (m, k, sep, v) => ok.test(v) ? m : k + sep + "[removed]");
}
const clean = (s: unknown) => String(s ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim();
const flag = (d: Deps, k: string) => (d.env(k) ?? "").toLowerCase() === "true";

export async function handle(body: Record<string, unknown>, ip: string, d: Deps): Promise<{ status: number; [k: string]: unknown }> {
  const now = d.now(); const action = String(body.action ?? "");
  if (action === "start") {
    if (!rateOk("c:" + ip, LIMITS.perIpChatsPerDay, 86_400_000, now)) return { status: 429, error: "Too many chats today. Please call or text 902-200-4888." };
    const c: Chat = { id: d.newId(), ip, msgs: [], created: now, last: now }; await d.save(c);
    return { status: 200, id: c.id, greeting: "Hi! I can help with signing in, forgot password and sign-up. What do you need? You can write in English, French, Punjabi or Hindi." };
  }
  const id = clean(body.id); if (!/^[a-f0-9-]{20,40}$/.test(id)) return { status: 400, error: "Bad chat." };
  const c = await d.load(id); if (!c || c.ip !== ip && c.ip !== "*") return { status: 404, error: "Chat not found. Please reopen." };
  if (action === "end") { await finish(c, clean(body.reason) || "closed", d); return { status: 200, ok: true }; }
  if (action !== "send") return { status: 400, error: "Bad request." };
  if (c.ended) return { status: 409, error: "This chat has ended. Open a new one if you need more help." };
  if (now - c.last > LIMITS.idleMs) { await finish(c, "idle", d); return { status: 409, error: "This chat timed out. Open a new one if you need more help." }; }
  if (!rateOk("m:" + ip, LIMITS.perIpPerHour, 3_600_000, now)) return { status: 429, error: "Too many messages. Please call or text 902-200-4888." };
  const text = clean(body.text); if (!text) return { status: 400, error: "Type a message." };
  if (text.length > LIMITS.maxChars) return { status: 413, error: `Please keep it under ${LIMITS.maxChars} letters.` };
  c.msgs.push({ role: "user", content: scrub(text) });
  const r = await d.claude(SYSTEM, c.msgs.slice(-LIMITS.maxTurns * 2), LIMITS.maxTokens);
  c.msgs.push({ role: "assistant", content: r.text }); c.last = now;
  d.log("turn", { id, inTok: r.inTok, outTok: r.outTok });
  const turns = c.msgs.filter((m) => m.role === "user").length;
  if (turns >= LIMITS.maxTurns) { await finish(c, "max_turns", d); return { status: 200, reply: r.text + "\n\n(This chat has reached its limit. For more help call or text 902-200-4888.)", ended: true }; }
  await d.save(c); return { status: 200, reply: r.text, turnsLeft: LIMITS.maxTurns - turns };
}

export async function finish(c: Chat, reason: string, d: Deps) {
  if (c.ended) return; c.ended = true; c.end_reason = reason.slice(0, 20);
  if (!c.msgs.some((m) => m.role === "user")) { await d.save(c); return; }
  const transcript = c.msgs.map((m) => (m.role === "user" ? "Visitor: " : "Bot: ") + m.content).join("\n");
  const s = await d.claude(SUMMARY, [{ role: "user", content: transcript }], 300);
  c.summary = fixPhones(scrub(s.text.trim())); await d.save(c);
  d.log("summary", { id: c.id, reason, summary: c.summary, inTok: s.inTok, outTok: s.outTok });
  const body = `${c.summary}\n\nEnded: ${reason}. Chat id ${c.id}.\nFull chat is in table reg_help_chats.`;
  if (flag(d, "CHAT_SUMMARY_SEND_ENABLED")) {
    try { await d.sendMail({ to: d.env("CHAT_SUMMARY_TO") ?? "admin@unscramble.ca", subject: "Sign-in help chat summary", text: body }); } catch (e) { d.log("mail_fail", { e: String(e) }); }
  } else d.log("mail_off_would_send", { to: "admin@unscramble.ca", body });
  if (flag(d, "CHAT_SUMMARY_TEXT_ENABLED") && d.sendText) {
    try { await d.sendText(d.env("CHAT_SUMMARY_TEXT_TO") ?? "+17056500024", "Help chat: " + c.summary.slice(0, 300)); } catch (e) { d.log("text_fail", { e: String(e) }); }
  }
}

export async function anthropic(key: string, model: string, system: string, msgs: Msg[], maxTokens: number, f = fetch) {
  const r = await f("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: msgs }) });
  const j = await r.json(); if (!r.ok) throw new Error("AI error " + r.status + " " + (j?.error?.message ?? ""));
  return { text: (j.content ?? []).filter((b: { type: string }) => b.type === "text").map((b: { text: string }) => b.text).join("").trim(), inTok: j.usage?.input_tokens ?? 0, outTok: j.usage?.output_tokens ?? 0 };
}
