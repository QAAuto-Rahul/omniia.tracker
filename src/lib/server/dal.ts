import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isAllowedEmail } from "@/lib/auth-domain";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { col } from "./mongo";

export type CurrentUser = { id: number; email: string };

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await (await col("users")).findOne({ _id: session.uid });
  if (!user || user.email !== session.email || !isAllowedEmail(user.email)) return null;
  return { id: user._id, email: user.email };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/session-reset");
  return user;
}
