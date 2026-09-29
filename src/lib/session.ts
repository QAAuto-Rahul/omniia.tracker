
import { SignJWT, jwtVerify } from "jose";
import { isAllowedEmail } from "@/lib/auth-domain";

export const SESSION_COOKIE = "omniia_session";
export const SESSION_HOURS = Number(process.env.SESSION_HOURS) || 12;

export type SessionPayload = { uid: number; email: string };

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET must be set to a random string of at least 32 characters.");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "number" || typeof payload.email !== "string") return null;
    if (!isAllowedEmail(payload.email)) return null;
    return { uid: payload.uid, email: payload.email };
  } catch {
    return null;
  }
}
