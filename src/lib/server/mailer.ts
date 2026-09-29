import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP_HOST must be set in production so login codes can be delivered.");
    }
    transporter = null;
    return transporter;
  }
  const port = Number(process.env.SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465 || process.env.SMTP_SECURE === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return transporter;
}

export async function sendOtpEmail(email: string, code: string, ttlMinutes: number) {
  const mailer = getTransporter();
  if (!mailer) {
    console.log(`\n  [dev] SMTP not configured. Login code for ${email}: ${code}\n`);
    return;
  }

  await mailer.sendMail({
    from: process.env.SMTP_FROM || "Omniia Tracker <no-reply@sdlccorp.com>",
    to: email,
    subject: `${code} is your Omniia Tracker login code`,
    text: [
      `Sign in to Omniia Tracker`,
      ``,
      `Your login code is: ${code}`,
      ``,
      `It expires in ${ttlMinutes} minutes and can only be used once.`,
      ``,
      `Didn't try to sign in? You can safely ignore this email. Never share this code with anyone.`,
    ].join("\n"),
    html: otpEmailHtml(code, ttlMinutes),
  });
}

/**
 * Table layout with inline styles: the only markup Outlook, Gmail and mobile
 * clients all render consistently.
 */
function otpEmailHtml(code: string, ttlMinutes: number): string {
  const font = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>Your Omniia Tracker login code</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Your login code is ${code}. It expires in ${ttlMinutes} minutes.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5">
  <tr><td align="center" style="padding:40px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px">
      <tr><td style="padding:0 4px 20px">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td width="32" height="32" style="background:#18181b;border-radius:8px;color:#ffffff;font-family:${font};font-size:15px;font-weight:700;text-align:center">O</td>
          <td style="padding-left:10px;font-family:${font};line-height:1.25">
            <div style="font-size:15px;font-weight:600;color:#18181b">Omniia Tracker</div>
            <div style="font-size:12px;color:#71717a">SDLC Corp</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;padding:32px;font-family:${font}">
        <h1 style="margin:0 0 8px;font-size:20px;font-weight:600;color:#18181b">Sign in to Omniia Tracker</h1>
        <p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#52525b">Enter this code on the sign-in page to continue.</p>
        <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:10px;padding:18px 12px;text-align:center;font-family:'SF Mono',Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#18181b">${code}</div>
        <p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#52525b">This code expires in <strong style="color:#18181b">${ttlMinutes} minutes</strong> and can only be used once.</p>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0">
        <p style="margin:0;font-size:12px;line-height:1.5;color:#71717a">Didn't try to sign in? You can safely ignore this email. Nobody can get into your account without this code, so never share it with anyone.</p>
      </td></tr>
      <tr><td style="padding:20px 4px 0;text-align:center;font-family:${font};font-size:12px;color:#a1a1aa">Automated message from Omniia Tracker &middot; Please don't reply</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
