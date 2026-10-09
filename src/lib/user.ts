import "server-only";
import { auth, currentUser } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { subscriptions, users, type UserRow } from "./db/schema";
import { grantTrial } from "./credits";
import { captureError } from "./errors";
import { clientIp, ipHash, rateLimit } from "./ratelimit";
import { isPlanSku, PLANS, TRIAL_LIMITS, type Sku } from "@/content/plans";

/*
 * Who is asking. Clerk owns identity (email-code sign-in); the local `users` row is keyed
 * by the Clerk user id and carries only what billing needs (email, Stripe customer).
 */

export interface SessionUser {
  userId: string;
  email: string;
}

export interface PlanView {
  sku: Sku | "trial";
  maxParallel: number;
  allow1080p: boolean;
}

/**
 * Signed-in email as Clerk knows it, or null when signed out. Only a verified address counts:
 * sign-in is by email code, so the primary address is verified by construction; an account
 * whose addresses are all unverified (a half-finished sign-up) is treated as signed out.
 */
async function sessionEmail(): Promise<string | null> {
  const u = await currentUser();
  if (!u) return null;
  const verified = (e: { verification: { status: string | null } | null } | null | undefined) => e?.verification?.status === "verified";
  const primary = verified(u.primaryEmailAddress) ? u.primaryEmailAddress : u.emailAddresses.find(verified);
  const address = primary?.emailAddress ?? null;
  return address ? address.trim().toLowerCase() : null;
}

/** Server components and actions: the signed-in user, or a redirect to /sign-in that comes back here. */
export async function requireUser(): Promise<SessionUser> {
  const a = await auth();
  if (!a.userId) {
    return a.redirectToSignIn() as never;
  }
  const email = await sessionEmail();
  if (!email) redirect("/sign-in");
  return { userId: a.userId, email };
}

/** Route handlers: the signed-in user, or a ready-made 401 response. */
export async function requireUserApi(): Promise<SessionUser | Response> {
  const a = await auth();
  if (!a.userId) {
    return Response.json({ error: "sign_in_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const email = await sessionEmail();
  if (!email) return Response.json({ error: "sign_in_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return { userId: a.userId, email };
}

export function isResponse(v: unknown): v is Response {
  return v instanceof Response;
}

/**
 * Mail domains that hand out throwaway inboxes. A sign-up from one still works (the account
 * exists, packs and plans can be bought); it just does not receive the free trial, which is
 * what a throwaway address would be for.
 */
export const DISPOSABLE_EMAIL_DOMAINS: readonly string[] = [
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "10minutemail.com",
  "10minutemail.net",
  "tempmail.com",
  "temp-mail.org",
  "temp-mail.io",
  "tempr.email",
  "yopmail.com",
  "yopmail.fr",
  "trashmail.com",
  "trashmail.me",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "throwawaymail.com",
  "fakeinbox.com",
  "mohmal.com",
  "emailondeck.com",
  "mintemail.com",
  "discard.email",
  "spamgourmet.com",
  "33mail.com",
  "mailnesia.com",
  "mailcatch.com",
  "tempinbox.com",
  "burnermail.io",
  "inboxkitten.com",
  "mail7.io",
  "harakirimail.com",
  "crazymailing.com",
  "tmpmail.org",
  "tmpmail.net",
  "moakt.com",
  "cuvox.de",
  "dayrep.com",
  "einrot.com",
  "fleckens.hu",
  "gustr.com",
  "jourrapide.com",
  "rhyta.com",
  "superrito.com",
  "teleworm.us",
  "armyspy.com",
];

export function isDisposableEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  return domain !== "" && DISPOSABLE_EMAIL_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`));
}

/** New trial grants per IP address per day: a handful of households share one, a sign-up farm does not. */
const TRIALS_PER_IP_PER_DAY = 3;

/**
 * Whether a brand-new account receives the free trial. Trial credits spend real engine money,
 * so a throwaway mailbox or a burst of sign-ups from one address gets an account without them.
 * Returns the reason when it is withheld (recorded as a warning so the pattern is visible).
 */
async function trialAllowed(userId: string, email: string): Promise<{ ok: true } | { ok: false; reason: string }> {
  if (isDisposableEmail(email)) return { ok: false, reason: "disposable-email" };
  let ip = "0.0.0.0";
  try {
    ip = clientIp(await headers());
  } catch {
    // Outside a request (a script, a test): no address to limit on; the email rule above still applies.
    return { ok: true };
  }
  const rl = await rateLimit(`trial:ip:${ipHash(ip)}`, TRIALS_PER_IP_PER_DAY, 86400);
  if (!rl.ok) {
    await captureError(new Error("trial withheld: too many new accounts from one address"), {
      route: "user/ensureUser",
      severity: "warn",
      context: { userId, count: rl.count, limit: rl.limit },
    });
    return { ok: false, reason: "ip-limit" };
  }
  return { ok: true };
}

/**
 * Upserts the local row from the session and grants the free trial the first time a user
 * shows up. Call once per request on the (app) layout, not in every handler.
 */
export async function ensureUser(session?: SessionUser): Promise<UserRow & { isNew: boolean }> {
  const s = session ?? (await requireUser());
  const rows = await db
    .insert(users)
    .values({ id: s.userId, email: s.email })
    .onConflictDoUpdate({ target: users.id, set: { email: s.email, lastSeenAt: sql`now()` } })
    .returning({
      id: users.id,
      email: users.email,
      stripeCustomerId: users.stripeCustomerId,
      createdAt: users.createdAt,
      lastSeenAt: users.lastSeenAt,
      isNew: sql<boolean>`(xmax = 0)`,
    });
  const r = rows[0];
  if (!r) throw new Error("user row was not persisted");
  // Idempotent on `trial:<userId>`, so a crash between the two statements is repaired by the next visit.
  if (r.isNew) {
    const allowed = await trialAllowed(s.userId, s.email);
    if (allowed.ok) await grantTrial(s.userId);
    else console.info(`[user] trial withheld for ${s.userId}: ${allowed.reason}`);
  }
  return r;
}

export async function getUserRow(userId: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

export async function setStripeCustomerId(userId: string, stripeCustomerId: string): Promise<void> {
  await db.update(users).set({ stripeCustomerId }).where(eq(users.id, userId));
}

const TIER: Record<string, number> = { starter: 1, growth: 2, pro: 3 };

/** Subscription statuses that still entitle the user to plan limits (Stripe keeps `past_due` subscriptions active for retries). */
export const ENTITLED_STATUSES = ["active", "trialing", "past_due"] as const;

/** The plan whose limits apply: the highest active subscription, or trial limits when there is none. */
export async function currentPlan(userId: string): Promise<PlanView> {
  const rows = await db
    .select({ sku: subscriptions.sku, status: subscriptions.status })
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, [...ENTITLED_STATUSES])));
  let best: Sku | null = null;
  for (const r of rows) {
    if (!isPlanSku(r.sku)) continue;
    if (!best || TIER[r.sku] > TIER[best]) best = r.sku;
  }
  if (best && isPlanSku(best)) {
    const plan = PLANS[best];
    return { sku: best, maxParallel: plan.maxParallel, allow1080p: plan.allow1080p };
  }
  return { sku: "trial", ...TRIAL_LIMITS };
}
