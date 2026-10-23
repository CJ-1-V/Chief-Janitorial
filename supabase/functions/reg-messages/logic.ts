// reg-messages – PROPOSED, NOT DEPLOYED (DB hold + owner OK). ONE server function for every text/email the app sends:
//   reset_request / reset_confirm  – forgot-password code by text or email (works for phone-only accounts)
//   office_invite (send|resend)     – office "Send invite" to a farm contact            (was reg-farm-invite)
//   farm_invite / farm_resend       – a farm owner invites its own manager / supervisor
// Rules: codes are made on the server, only SHA-256 fingerprints are stored; reset codes last 10 min, 5 tries,
// 3 requests/hour/account + 10/hour/IP-less login string (SQL); STOP list honoured; US numbers blocked unless SMS_ALLOW_US=true.
// MESSAGES_SEND_ENABLED must be exactly "true" or every send is a dry run (nothing leaves the server).
// Provider: SMS_PROVIDER = quo (default) | telnyx | twilio (providers.ts). Email: admin@unscramble.ca via Gmail SMTP (Vault secret).
import { sendSms, providerName, type Env } from "./providers.ts";
import * as T from "./text.ts";
export const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CA_AREA = new Set("204 226 236 249 250 257 263 289 306 343 354 365 367 368 382 387 403 416 418 428 431 437 438 450 460 468 474 506 514 519 548 579 581 584 587 600 604 613 622 639 647 672 683 705 709 742 753 778 780 782 807 819 825 867 873 879 902 905 942".split(" "));
export interface Deps {
  env: Env; fetch: typeof fetch;
  userRpc: (fn: string, a: Record<string, unknown>) => Promise<unknown>;   // as the signed-in caller (null when anonymous)
  adminRpc: (fn: string, a: Record<string, unknown>) => Promise<unknown>;  // service role, server only
  setPassword: (userId: string, pw: string) => Promise<void>;               // GoTrue admin, server only
  sendMail: (m: { to: string; subject: string; text: string; html: string }) => Promise<string>;
  random: (n: number) => Uint32Array; log?: (m: string, x?: Record<string, unknown>) => void;
}
export const toE164 = (p: string) => { let d = String(p ?? "").replace(/\D/g, ""); if (d.length === 11 && d[0] === "1") d = d.slice(1); return d.length === 10 ? "+1" + d : ""; };
export const maskPhone = (e: string) => (e ? "(•••) •••-" + e.slice(-4) : "");
export const maskEmail = (e: string) => { const a = String(e ?? "").split("@"); return a.length === 2 ? a[0].slice(0, 1) + "•••@" + a[1] : ""; };
const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(e ?? "").trim());
export function genInvite(r: (n: number) => Uint32Array) { const a = r(8); let s = ""; for (let i = 0; i < 8; i++) s += ALPHA[a[i] % ALPHA.length]; return s.slice(0, 4) + "-" + s.slice(4); }
export const genSix = (r: (n: number) => Uint32Array) => String(100000 + (r(1)[0] % 900000));
export async function sha(s: string) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join(""); }
export const inviteHash = (code: string) => sha("unscramble-invite:" + code.replace("-", ""));     // same as clCodeHash in the app
export const mfaHash = (userId: string, code: string) => sha("reg-mfa:" + userId + ":" + code);
export const mfaDevHash = (userId: string, dev: string) => sha("reg-mfa-dev:" + userId + ":" + dev);
export const resetHash = (userId: string, code: string) => sha("reg-reset:" + userId + ":" + code); // salted with the account id

export type Attempt = { channel: "sms" | "email"; status: "sent" | "failed" | "skipped" | "dry_run"; why?: string; msg_id?: string; to?: string; provider?: string };
type To = { phone?: string; email?: string };
/** Try text then email (or the order asked). Stops at the first success. */
export async function deliver(d: Deps, to: To, msg: { sms: string; email: { subject: string; text: string; html: string } }, via: "auto" | "sms" | "email"): Promise<Attempt[]> {
  const live = d.env("MESSAGES_SEND_ENABLED") === "true", out: Attempt[] = [], phone = toE164(to.phone ?? ""), email = String(to.email ?? "").trim();
  const order: ("sms" | "email")[] = via === "email" ? ["email", "sms"] : ["sms", "email"];
  for (const ch of order) {
    if (ch === "sms") {
      if (!phone) { out.push({ channel: ch, status: "skipped", why: "no mobile number" }); continue; }
      if (await d.adminRpc("reg_sms_is_opted_out", { p_e164: phone }) === true) { out.push({ channel: ch, status: "skipped", why: "number replied STOP" }); continue; }
      if (!CA_AREA.has(phone.slice(2, 5)) && d.env("SMS_ALLOW_US") !== "true") { out.push({ channel: ch, status: "skipped", why: "US texting is off" }); continue; }
      if (!live) { out.push({ channel: ch, status: "dry_run", to: maskPhone(phone), provider: providerName(d.env) }); break; }
      const r = await sendSms(d.env, d.fetch, phone, msg.sms);
      if (r.ok) { out.push({ channel: ch, status: "sent", msg_id: r.id, to: maskPhone(phone), provider: providerName(d.env) }); break; }
      out.push({ channel: ch, status: "failed", why: r.why, to: maskPhone(phone), provider: providerName(d.env) }); d.log?.("sms error", { status: r.status, to: maskPhone(phone) });
    } else {
      if (!emailOk(email)) { out.push({ channel: ch, status: "skipped", why: "no email" }); continue; }
      if (!live) { out.push({ channel: ch, status: "dry_run", to: maskEmail(email) }); break; }
      try { const id = await d.sendMail({ to: email, ...msg.email }); out.push({ channel: ch, status: "sent", msg_id: id, to: maskEmail(email) }); break; }
      catch (_e) { out.push({ channel: ch, status: "failed", why: "email error", to: maskEmail(email) }); }
    }
  }
  return out;
}
const summary = (a: Attempt[]) => { const ok = a.find((x) => x.status === "sent" || x.status === "dry_run");
  return ok ? (ok.status === "dry_run" ? "Dry run – nothing sent. Would send by " : "Sent by ") + (ok.channel === "sms" ? "text to " : "email to ") + ok.to : "Could not send: " + (a.map((x) => x.why).filter(Boolean).join(", ") || "no mobile or email"); };
const urlFor = (d: Deps, code: string) => (d.env("INVITE_URL_BASE") ?? "https://www.chiefjanitorial.com/shifts-secure/register/") + "#/signup/firm?invite=" + code;
const joinUrl = (d: Deps, code: string) => (d.env("INVITE_URL_BASE") ?? "https://www.chiefjanitorial.com/shifts-secure/register/") + "?join=" + String(code).replace(/[^A-Za-z0-9]/g, "") + "#/signup/worker";
async function logAll(d: Deps, kind: string, ref: string, a: Attempt[]) { for (const x of a) await d.adminRpc("reg_msg_log", { p_kind: kind, p_ref: ref, p_channel: x.channel, p_status: x.status, p_to_masked: x.to ?? null, p_msg_id: x.msg_id ?? null, p_why: x.why ?? null, p_provider: x.provider ?? null }); }
type Out = Record<string, unknown> & { ok: boolean; status: number; error?: string };
const NEUTRAL: Out = { ok: true, status: 200, summary: "If we find an account with that login, we sent a code." };

export async function handle(b: Record<string, any>, d: Deps, signedIn: boolean): Promise<Out> {
  const act = String(b?.action ?? "");
  // ---------------- (a) forgot password ----------------
  if (act === "reset_request") {
    const login = String(b.login ?? "").trim().slice(0, 120), via = b.via === "email" ? "email" : "sms"; if (!login) return { ok: false, status: 400, error: "Enter your login." };
    // SQL finds the account (username / email / any phone on file) and applies the rate limit; returns null when not found or limited.
    const acc = await d.adminRpc("reg_reset_find", { p_login: login }) as { user_id: string; name: string; phone?: string; email?: string } | null;
    if (!acc) return NEUTRAL;                                            // never reveal whether the account exists
    const code = genSix(d.random);
    await d.adminRpc("reg_reset_code_put", { p_user: acc.user_id, p_hash: await resetHash(acc.user_id, code), p_minutes: T.CODE_MIN, p_via: via });
    const a = await deliver(d, { phone: acc.phone, email: acc.email }, { sms: T.codeSms(code), email: T.codeEmail(acc.name, code) }, via);
    await logAll(d, "reset_code", acc.user_id, a);
    return NEUTRAL;                                                       // same answer whatever happened
  }
  if (act === "reset_confirm") {
    const login = String(b.login ?? "").trim().slice(0, 120), code = String(b.code ?? "").trim(), pw = String(b.password ?? "");
    if (!/^\d{6}$/.test(code)) return { ok: false, status: 400, error: "Enter the 6-digit code." };
    if (pw.length < 10) return { ok: false, status: 400, error: "Password needs at least 10 characters." };
    const acc = await d.adminRpc("reg_reset_find", { p_login: login, p_for_confirm: true }) as { user_id: string } | null;
    if (!acc) return { ok: false, status: 400, error: "That code is not valid or has expired." };
    // SQL compares the hash, counts tries (max 5), checks the 10-minute expiry and deletes the code when used.
    const ok = await d.adminRpc("reg_reset_code_use", { p_user: acc.user_id, p_hash: await resetHash(acc.user_id, code) }) as string;
    if (ok !== "ok") return { ok: false, status: 400, error: ok === "expired" ? "That code has expired. Please send a new one." : ok === "locked" ? "Too many wrong codes. Please send a new one." : "Wrong code." };
    await d.setPassword(acc.user_id, pw);
    await d.adminRpc("reg_reset_done", { p_user: acc.user_id });         // signs out other sessions, clears must-change, audit row
    return { ok: true, status: 200 };
  }
  if (!signedIn) return { ok: false, status: 401, error: "Sign in first." };
  // ---------------- (c) office invite ----------------
  if (act === "office_invite" || act === "send" || act === "resend") {
    const name = String(b.name ?? "").trim().slice(0, 80), phone = toE164(b.phone ?? ""), email = String(b.email ?? "").trim().slice(0, 120);
    const via = b.via === "sms" || b.via === "email" ? b.via : "auto", days = Math.min(30, Math.max(1, Math.floor(Number(b.days) || 14)));
    if (!b.client_id || !name) return { ok: false, status: 400, error: "Enter the contact name." };
    if (b.phone && !phone) return { ok: false, status: 400, error: "The mobile number needs 10 digits." };
    if (email && !emailOk(email)) return { ok: false, status: 400, error: "That email does not look right." };
    if (!email) return { ok: false, status: 400, error: "A business email is required for farms to join." };   // farmemail1 (owner Oct 22)
    if (!phone && !email) return { ok: false, status: 400, error: "Enter a mobile number or an email." };
    if (b.consent !== true) return { ok: false, status: 400, error: "Confirm the person expects this invite." };
    const code = genInvite(d.random), id = "inv_" + Date.now().toString(36) + code.slice(-4).toLowerCase();
    const made = await d.userRpc("reg_office_invite_send", { p_id: id, p_client: b.client_id, p_code_hash: await inviteHash(code), p_last4: code.slice(-4), p_days: days,
      p_send_to: { name, phone, email }, p_via: via, p_resend_of: b.resend_of ?? null }) as { expires?: string } | null;   // raises unless office
    const o = { name, url: urlFor(d, code), code, expires: made?.expires ?? "" };
    const a = await deliver(d, { phone, email }, { sms: T.officeSms(o), email: T.officeEmail(o) }, via);
    await logAll(d, "office_invite", id, a);
    return { ok: true, status: 200, invite_id: id, last4: code.slice(-4), code, url: o.url, expires: o.expires, attempts: a, summary: summary(a) };
  }
  // ---------------- (b) farm invites its own team ----------------
  if (act === "farm_invite" || act === "farm_resend") {
    let code: string, inv: { invite_id: string; name: string; contact: string; role: string; farm: string; expires: string } | null;
    if (act === "farm_invite") {           // the app already made the invite (reg_farm_team_invite); prove it by its code
      code = String(b.code ?? "").trim().toUpperCase(); if (!/^[A-Z2-9]{4}-[A-Z2-9]{4}$/.test(code)) return { ok: false, status: 400, error: "Bad code." };
      if (b.consent !== true) return { ok: false, status: 400, error: "Confirm the person expects this invite." };
      inv = await d.userRpc("reg_farm_team_invite_for_send", { p_code_hash: await inviteHash(code) }) as typeof inv;   // raises unless caller is that farm's owner
    } else {                                // new code, old one cancelled, done as the caller
      code = genInvite(d.random);
      inv = await d.userRpc("reg_farm_team_resend", { p_old: String(b.invite_id ?? ""), p_id: "finv_" + Date.now().toString(36), p_code_hash: await inviteHash(code), p_last4: code.slice(-4), p_days: 14 }) as typeof inv;
    }
    if (!inv) return { ok: false, status: 404, error: "Invite not found." };
    const role = inv.role === "supervisor" ? "Supervisor" : "Manager", ct = String(inv.contact ?? ""), o = { name: inv.name, farm: inv.farm, role, url: urlFor(d, code), code, expires: inv.expires };
    const a = await deliver(d, /@/.test(ct) ? { email: ct } : { phone: ct }, { sms: T.teamSms(o), email: T.teamEmail(o) }, "auto");
    await logAll(d, "farm_invite", inv.invite_id, a);
    return { ok: true, status: 200, invite_id: inv.invite_id, attempts: a, summary: summary(a) };
  }
  // ---------------- (d) subcontractor invites a worker (subinvite1) ----------------
  if (act === "sub_worker_invite") {
    const name = String(b.name ?? "").trim().slice(0, 80), phone = toE164(b.phone ?? ""), email = String(b.email ?? "").trim().slice(0, 120);
    if (!name) return { ok: false, status: 400, error: "Enter the worker's name." };
    if (b.phone && !phone) return { ok: false, status: 400, error: "The mobile number needs 10 digits." };
    if (email && !emailOk(email)) return { ok: false, status: 400, error: "That email does not look right." };
    if (!phone && !email) return { ok: false, status: 400, error: "Enter a mobile number or an email." };
    if (b.consent !== true) return { ok: false, status: 400, error: "Confirm the person expects this invite." };
    const code = await d.userRpc("reg_sub_join_code", { p_new: false }) as string;               // raises unless caller is an active subcontractor
    if (!code) return { ok: false, status: 400, error: "No join code yet." };
    const sub = await d.userRpc("reg_sub_by_code", { p_code: code }) as { id?: string; name?: string } | null;
    const company = String(sub?.name ?? "Your employer").slice(0, 80);
    const o = { name, company, url: joinUrl(d, code), code: String(code).replace(/^(.{4})(.{4})$/, "$1-$2") };
    const a = await deliver(d, { phone, email }, { sms: T.workerSms(o), email: T.workerEmail(o) }, b.via === "sms" || b.via === "email" ? b.via : "auto");
    await logAll(d, "sub_invite", String(sub?.id ?? "sub"), a);
    return { ok: true, status: 200, attempts: a, summary: summary(a) };
  }
  // ---------------- (e) 2-step sign-in (twostep1) ----------------
  if (act === "mfa_check" || act === "mfa_send" || act === "mfa_verify") {
    const st = await d.userRpc("reg_mfa_status", {}) as { user_id: string; session_id: string | null; name?: string; email?: string | null; phone?: string | null; required: boolean; verified: boolean } | null;
    if (!st || !st.user_id) return { ok: false, status: 401, error: "Sign in first." };
    const smsOn = !!(d.env("SMS_PROVIDER") || d.env("QUO_API_KEY")) && !!toE164(st.phone ?? "");
    const reach = emailOk(String(st.email ?? "")) || smsOn;
    const to = emailOk(String(st.email ?? "")) ? maskEmail(String(st.email)) : smsOn ? maskPhone(toE164(String(st.phone))) : "";
    if (!st.required || st.verified) return { ok: true, status: 200, required: !!st.required, verified: true, optional_on: !!(st as any).optional_on };
    if (!st.session_id) return { ok: false, status: 400, error: "Please sign in again." };
    // nobody gets locked out: no email on file and no texting → let them in, flag it (office sees it in the send log)
    if (!reach) { await logAll(d, "mfa_code", st.user_id, [{ channel: "email", status: "skipped", why: "no email on file" }]); return { ok: true, status: 200, required: true, verified: true, skipped: "no email on file" }; }
    if (act === "mfa_check") {
      const dev = String(b.device ?? "");
      if (/^[A-Za-z0-9_-]{32,128}$/.test(dev) && await d.adminRpc("reg_mfa_trust_use", { p_user: st.user_id, p_session: st.session_id, p_hash: await mfaDevHash(st.user_id, dev) }) === true)
        return { ok: true, status: 200, required: true, verified: true, how: "trusted device" };
      return { ok: true, status: 200, required: true, verified: false, to };
    }
    if (act === "mfa_send") {
      const code = genSix(d.random), via = emailOk(String(st.email ?? "")) ? "email" : "sms";
      const put = await d.adminRpc("reg_mfa_code_put", { p_user: st.user_id, p_hash: await mfaHash(st.user_id, code), p_via: via }) as string;
      if (/^wait:/.test(put)) return { ok: false, status: 429, error: "Please wait " + put.slice(5) + " seconds before asking for a new code.", wait: Number(put.slice(5)) || 60 };
      if (put === "limit") return { ok: false, status: 429, error: "Too many codes in the last hour. Please try again later, or call the office." };
      const a = await deliver(d, { email: st.email ?? "", phone: smsOn ? st.phone ?? "" : "" }, { sms: T.mfaSms(code), email: T.mfaEmail(st.name ?? "", code) }, "email");
      await logAll(d, "mfa_code", st.user_id, a);
      const good = a.find((x) => x.status === "sent" || x.status === "dry_run");
      return good ? { ok: true, status: 200, to: good.to, channel: good.channel, wait: 60, summary: summary(a) } : { ok: false, status: 502, error: "We could not send the code. Please try again, or call the office." };
    }
    const code = String(b.code ?? "").trim();
    if (!/^\d{6}$/.test(code)) return { ok: false, status: 400, error: "Enter the 6-digit code." };
    const dev = String(b.device ?? ""), trust = b.remember === true && /^[A-Za-z0-9_-]{32,128}$/.test(dev) ? await mfaDevHash(st.user_id, dev) : null;
    const r = await d.adminRpc("reg_mfa_code_use", { p_user: st.user_id, p_session: st.session_id, p_hash: await mfaHash(st.user_id, code), p_trust_hash: trust, p_label: String(b.label ?? "").slice(0, 60) }) as string;
    if (r === "ok") return { ok: true, status: 200, verified: true, remembered: !!trust };
    if (/^wrong:/.test(r)) return { ok: false, status: 400, error: "That code is not right. " + r.slice(6) + " tries left.", left: Number(r.slice(6)) };
    if (r === "locked") return { ok: false, status: 400, error: "Too many wrong codes. Please send a new code.", locked: true };
    return { ok: false, status: 400, error: "That code has expired. Please send a new code.", expired: true };
  }
  return { ok: false, status: 400, error: "Bad request." };
}
