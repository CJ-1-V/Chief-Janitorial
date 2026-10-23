// reg-messages/text.ts – message texts. Keep in sync with js/v2-farminvite.js (fiSmsText/fiEmail) and js/v2-msgsend.js (msTexts).
export const CODE_MIN = 10;
const first = (n: string) => String(n ?? "").trim().split(/\s+/)[0] || "there";
const nice = (d: string) => new Date(d + "T12:00:00Z").toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "UTC" });
export const FROM_SMS_DISPLAY = "+1 902-200-4888";
export const codeSms = (code: string) => `UnScramble: your password reset code is ${code}. It expires in ${CODE_MIN} minutes. Didn't ask? Ignore this. Reply STOP to opt out.`;
export const codeEmail = (name: string, code: string) => ({ subject: "Your UnScramble password reset code",
  text: `Hello ${first(name)},\n\nYour UnScramble password reset code: ${code}\n\nEnter it on the reset screen within ${CODE_MIN} minutes, then choose a new password.\n\nIf you did not ask for this, ignore this email – your password stays the same.\n\nUnScramble – The HR Company Inc.`, html: "" });
export type Inv = { name: string; url: string; code: string; expires: string; farm?: string; role?: string };
export const officeSms = (o: Inv) => `UnScramble: Hi ${first(o.name)}, set up your farm's UnScramble app account: ${o.url} (code ${o.code}, expires ${nice(o.expires)}). Sent to you as our client contact. Reply STOP to opt out, HELP for help.`;
export const officeEmail = (o: Inv) => ({ subject: "You are invited to the UnScramble app",
  text: `Hello ${first(o.name)},\n\nUnScramble invites you to set up your farm's client account in the UnScramble app. There you can book crews, approve time sheets and see your invoices.\n\nSign up here: ${o.url}\nYour invite code: ${o.code} (single use, expires ${nice(o.expires)})\n\nDidn't expect this? Just ignore it – nothing happens without the code.\n\nUnScramble\nPlease do not reply to this email. Questions: call or text ${FROM_SMS_DISPLAY}.`, html: "" });
export const teamSms = (o: Inv) => `UnScramble: Hi ${first(o.name)}, ${o.farm} invited you to its UnScramble app as ${o.role}: ${o.url} (code ${o.code}, expires ${nice(o.expires)}). Reply STOP to opt out, HELP for help.`;
export const teamEmail = (o: Inv) => ({ subject: `${o.farm} invited you to the UnScramble app`,
  text: `Hello ${first(o.name)},\n\n${o.farm} invited you to its UnScramble app as ${o.role}. You will see crews, hours, time sheets and crew orders.\n\nSign up here: ${o.url}\nYour invite code: ${o.code} (single use, expires ${nice(o.expires)})\n\nUnScramble checks the sign-up, usually the same day.\n\nDidn't expect this? Ignore it – nothing happens without the code.\n\nUnScramble\nPlease do not reply to this email. Questions: call or text ${FROM_SMS_DISPLAY}.`, html: "" });
export type WInv = { name: string; company: string; url: string; code: string };
export const workerSms = (o: WInv) => `UnScramble: Hi ${first(o.name)}, ${o.company} invited you to sign up as a farm worker: ${o.url} (join code ${o.code}). Reply STOP to opt out, HELP for help.`;
export const workerEmail = (o: WInv) => ({ subject: `${o.company} invited you to the UnScramble app`,
  text: `Hello ${first(o.name)},\n\n${o.company} invited you to sign up in the UnScramble app as one of its farm workers. You will clock in and out, see your shifts and your hours there.\n\nSign up here: ${o.url}\nJoin code (filled in for you by the link): ${o.code}\n\nUnScramble checks the sign-up, usually the same day.\n\nDidn't expect this? Ignore it – nothing happens unless you sign up.\n\nUnScramble\nPlease do not reply to this email. Questions: call or text ${FROM_SMS_DISPLAY}.`, html: "" });
// twostep1: 2-step sign-in code
export const mfaSms = (code: string) => `UnScramble: your sign-in code is ${code}. It expires in ${CODE_MIN} minutes. Didn't try to sign in? Call the office. Reply STOP to opt out.`;
export const mfaEmail = (name: string, code: string) => ({ subject: `Your UnScramble sign-in code: ${code}`,
  text: `Hello ${first(name)},\n\nYour UnScramble sign-in code: ${code}\n\nEnter it on the sign-in screen within ${CODE_MIN} minutes.\n\nIf you did not just sign in, someone may know your password. Change it now and tell the office.\n\nUnScramble – The HR Company Inc.\nPlease do not reply to this email. Questions: call or text ${FROM_SMS_DISPLAY}.`, html: "" });
