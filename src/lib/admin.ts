import "server-only";
import { notFound } from "next/navigation";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { isAdminEmail } from "./env";

/** Defense in depth: the proxy already 404s non-admins; every admin page and action re-checks. */
export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const { userId } = await auth();
  if (!userId) notFound();
  const client = await clerkClient();
  const u = await client.users.getUser(userId);
  const email = u.emailAddresses.find((e) => e.verification?.status === "verified" && isAdminEmail(e.emailAddress))?.emailAddress;
  if (!email) notFound();
  return { userId, email };
}

/** Bearer-token check for operator endpoints (cron, ops, inbox); constant-time compare. */
export function bearerMatches(req: Request, secret: string | undefined): boolean {
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!secret || !got || got.length !== secret.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}
