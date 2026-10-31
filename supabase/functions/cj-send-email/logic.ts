// CJ-only email sender. PROPOSED – NOT DEPLOYED.
// Sends through the Resend REST API. The key is RESEND_API_KEY and is never logged.
// Mock (records the email, does not call Resend) when that key is unset, or when store=mock.
// Does not change Supabase Auth or SMTP. UnScramble (any company other than cj) is refused.

export const FROM = "Chief Janitorial Support <support@chiefjanitorial.com>";
export const REPLY_TO = "admin@chiefjanitorial.com";
export const RESEND_URL = "https://api.resend.com/emails";
export const SUBJECT = "Your Chief Janitorial sign-in code";

export type Caller = { email: string; company: string };

export interface MailUser {
  email?: string;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
}

export interface RecordedMail {
  from: string;
  reply_to: string;
  to: string;
  subject: string;
  text: string;
  mock: true;
}

export interface Deps {
  env: (name: string) => string | undefined;
  fetch: typeof fetch;
  caller: () => Promise<Caller | null>;
  record?: (mail: RecordedMail) => void;
  log?: (msg: string) => void;
}

export interface In {
  kind?: unknown;
  company?: unknown;
  code?: unknown;
  to?: unknown;
  store?: unknown;
}

export interface Out {
  status: number;
  body: Record<string, unknown>;
}

const pick = (bag: Record<string, unknown> | undefined, keys: string[]) => {
  for (const k of keys) {
    const v = bag?.[k];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  return "";
};

/** app_metadata wins. Sign-up metadata is used only when the app has not set a company. */
export function companyOf(user: MailUser | null): string {
  if (!user) return "";
  return pick(user.app_metadata, ["company", "app"]) || pick(user.user_metadata, ["company", "app"]);
}

export function emailOf(user: MailUser | null): string {
  if (!user) return "";
  const direct = String(user.email || "").trim().toLowerCase();
  if (direct) return direct;
  return pick(user.user_metadata, ["contact_email", "email"]);
}

export function signInCodeText(code: string): string {
  return "Your Chief Janitorial sign-in code is " + code + ".\n\nThis code expires in 15 minutes.\n\nIf you did not ask for this, you can ignore this email.";
}

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export async function handle(input: In, deps: Deps, storeMock: boolean): Promise<Out> {
  const note = (m: string) => { try { deps.log?.(m); } catch { /* never log the code or the key */ } };
  const caller = await deps.caller();
  if (!caller) return { status: 401, body: { ok: false, error: "Sign in first." } };
  const company = String(caller.company || "").trim().toLowerCase();
  const asked = input.company == null || input.company === "" ? company : String(input.company).trim().toLowerCase();
  if (company !== "cj" || asked !== "cj") {
    note("refused");
    return { status: 403, body: { ok: false, error: "This email is only sent for Chief Janitorial." } };
  }
  if (String(input.kind || "") !== "signin_code") {
    note("refused");
    return { status: 400, body: { ok: false, error: "Bad request." } };
  }
  const code = String(input.code || "").trim();
  if (!/^\d{6}$/.test(code)) {
    note("refused");
    return { status: 400, body: { ok: false, error: "The code must be 6 digits." } };
  }
  const to = String(caller.email || "").trim().toLowerCase();
  if (!emailOk(to)) {
    note("refused");
    return { status: 400, body: { ok: false, error: "This account has no email." } };
  }
  if (input.to != null && String(input.to).trim() !== "" && String(input.to).trim().toLowerCase() !== to) {
    note("refused");
    return { status: 403, body: { ok: false, error: "The email can only be sent to this account." } };
  }
  const text = signInCodeText(code);
  const mail: RecordedMail = { from: FROM, reply_to: REPLY_TO, to, subject: SUBJECT, text, mock: true };
  const key = String(deps.env("RESEND_API_KEY") || "").trim();
  const mock = storeMock || String(input.store || "") === "mock" || !key;
  if (mock) {
    try { deps.record?.(mail); } catch { /* the response still carries the record */ }
    note("recorded");
    return { status: 200, body: { ok: true, mock: true, recorded: mail } };
  }
  let res: Response;
  try {
    res = await deps.fetch(RESEND_URL, {
      method: "POST",
      headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], reply_to: REPLY_TO, subject: SUBJECT, text }),
    });
  } catch {
    note("not-sent");
    return { status: 502, body: { ok: false, error: "Email was not sent." } };
  }
  if (!res.ok) {
    note("not-sent");
    return { status: 502, body: { ok: false, error: "Email was not sent." } };
  }
  let id = "";
  try { id = String((await res.json() as { id?: string }).id || ""); } catch { id = ""; }
  note("sent");
  return { status: 200, body: { ok: true, mock: false, id } };
}
