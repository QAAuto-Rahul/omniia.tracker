"use server";

import crypto from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail, isValidEmail, normalizeEmail } from "@/lib/auth-domain";
import { SESSION_COOKIE, SESSION_HOURS, signSession } from "@/lib/session";
import { col, nextId } from "@/lib/server/mongo";
import { sendOtpEmail } from "@/lib/server/mailer";
import { clientIp, rateLimit } from "@/lib/server/rate-limit";

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RESEND_SECONDS = 60;
const IP_LIMIT = 30;
const IP_WINDOW_MS = 15 * 60 * 1000;

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const domainError = `Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in.`;

function hashOtp(email: string, code: string): string {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET ?? "").update(`${email}:${code}`).digest("hex");
}

async function ipAllowed(): Promise<boolean> {
  return rateLimit(`auth:${await clientIp()}`, IP_LIMIT, IP_WINDOW_MS);
}

export async function requestOtp(emailInput: string): Promise<Result<{ resendSeconds: number }>> {
  const email = normalizeEmail(emailInput);
  if (!isValidEmail(email)) return { ok: false, error: "Enter a valid email address." };
  if (!isAllowedEmail(email)) return { ok: false, error: domainError };
  if (!(await ipAllowed())) return { ok: false, error: "Too many attempts. Try again in a few minutes." };

  const otps = await col("otp_codes");
  const now = Date.now();
  const existing = await otps.findOne({ _id: email });
  const waitMs = existing ? existing.sent_at.getTime() + OTP_RESEND_SECONDS * 1000 - now : 0;
  if (waitMs > 0) {
    return { ok: false, error: `Please wait ${Math.ceil(waitMs / 1000)}s before requesting another code.` };
  }

  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");
  await otps.replaceOne(
    { _id: email },
    {
      code_hash: hashOtp(email, code),
      expires_at: new Date(now + OTP_TTL_MINUTES * 60 * 1000),
      attempts: 0,
      sent_at: new Date(now),
    },
    { upsert: true },
  );

  try {
    await sendOtpEmail(email, code, OTP_TTL_MINUTES);
  } catch (err) {
    await otps.deleteOne({ _id: email });
    console.error("[auth] Failed to send OTP email:", err);
    return { ok: false, error: "Could not send the code right now. Please try again shortly." };
  }

  return { ok: true, resendSeconds: OTP_RESEND_SECONDS };
}

export async function verifyOtp(emailInput: string, codeInput: string): Promise<Result> {
  const email = normalizeEmail(emailInput);
  const code = String(codeInput ?? "").trim();
  if (!isAllowedEmail(email)) return { ok: false, error: domainError };
  if (!/^\d{6}$/.test(code)) return { ok: false, error: "Enter the 6-digit code from your email." };
  if (!(await ipAllowed())) return { ok: false, error: "Too many attempts. Try again in a few minutes." };

  const otps = await col("otp_codes");
  const row = await otps.findOne({ _id: email });

  if (!row || row.expires_at.getTime() < Date.now()) {
    await otps.deleteOne({ _id: email });
    return { ok: false, error: "This code has expired. Request a new one." };
  }

  const matches = crypto.timingSafeEqual(Buffer.from(hashOtp(email, code), "hex"), Buffer.from(row.code_hash, "hex"));
  if (!matches) {
    const attempts = row.attempts + 1;
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await otps.deleteOne({ _id: email });
      return { ok: false, error: "Too many incorrect attempts. Request a new code." };
    }
    await otps.updateOne({ _id: email }, { $set: { attempts } });
    const left = OTP_MAX_ATTEMPTS - attempts;
    return { ok: false, error: `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` };
  }

  await otps.deleteOne({ _id: email });

  const users = await col("users");
  let user = await users.findOneAndUpdate({ email }, { $set: { last_login_at: new Date() } }, { returnDocument: "after" });
  if (!user) {
    const doc = { _id: await nextId("users"), email, created_at: new Date(), last_login_at: new Date() };
    try {
      await users.insertOne(doc);
      user = doc;
    } catch {
      user = await users.findOne({ email }); // created concurrently
    }
  }
  if (!user) return { ok: false, error: "Could not sign you in. Please try again." };

  (await cookies()).set(SESSION_COOKIE, await signSession({ uid: user._id, email: user.email }), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === "true" : process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });

  redirect("/env-pack");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
