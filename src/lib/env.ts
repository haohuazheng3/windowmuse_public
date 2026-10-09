/**
 * Environment helpers. Values are read lazily (never at import time) so a missing
 * optional variable degrades one feature instead of crashing the whole app.
 */

export function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : undefined;
}

export function requireEnv(name: string): string {
  const v = env(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

/**
 * Which deployment this is, as Vercel labels it. Off Vercel (a local `next build && next start`,
 * any other host) there is no production deployment: VERCEL_ENV falls back to "development",
 * so live-key checkout, the production env tag on Stripe sessions and indexing all stay off.
 */
export const VERCEL_ENV = process.env.VERCEL_ENV ?? "development";
export const IS_PRODUCTION_DEPLOY = process.env.VERCEL_ENV === "production";

/**
 * The site is indexable only on the production deployment AND once SITE_INDEXABLE=1.
 * Until launch every environment sends noindex at both the meta and header level.
 */
export function isIndexable(): boolean {
  return IS_PRODUCTION_DEPLOY && process.env.SITE_INDEXABLE === "1";
}

export function adminEmails(): string[] {
  return (env("ADMIN_EMAILS") ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return adminEmails().includes(email.trim().toLowerCase());
}

/** Variables the site needs to be fully functional; /api/health reports which are missing (names only). */
export const REQUIRED_ENV = [
  "DATABASE_URL",
  "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
  "CLERK_SECRET_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_STARTER",
  "STRIPE_PRICE_GROWTH",
  "STRIPE_PRICE_PRO",
  "STRIPE_PRICE_PACK_10",
  "STRIPE_PRICE_PACK_50",
  "FILES_BASE_URL",
  "FILES_SIGNING_SECRET",
  "FILES_API_TOKEN",
  "MAIL_WORKER_URL",
  "MAIL_WORKER_TOKEN",
  "INBOX_INGEST_SECRET",
  "INBOX_READ_TOKEN",
  "CRON_SECRET",
  "VIDEO_CALLBACK_SECRET",
  "ADMIN_EMAILS",
  "NEXT_PUBLIC_FLOWGLANCE_KEY",
] as const;

export function missingEnv(): string[] {
  const missing: string[] = REQUIRED_ENV.filter((n) => !env(n));
  // An organization key only works with the target account named in STRIPE_CONTEXT.
  if (env("STRIPE_SECRET_KEY")?.startsWith("sk_org") && !env("STRIPE_CONTEXT")) missing.push("STRIPE_CONTEXT");
  // The real engine needs its token; without it the provider silently falls back to "none".
  if (env("VIDEO_PROVIDER") === "replicate" && !env("REPLICATE_API_TOKEN")) missing.push("REPLICATE_API_TOKEN");
  // A production build that does not know its deployment runs with every production-only feature off.
  if (process.env.NODE_ENV === "production" && !env("VERCEL_ENV")) missing.push("VERCEL_ENV");
  return missing;
}

export type VideoEngine = "replicate" | "mock" | "none";

export interface Features {
  /** Which video provider answers `getProvider()`; "none" parks jobs in `awaiting_engine`. */
  videoEngine: VideoEngine;
  /** Whether "Write it for me" uses Claude (true) or the deterministic template writer (false). */
  aiWriter: boolean;
}

/**
 * Optional capabilities, resolved from the environment at call time. Everything else on
 * the site keeps working when a feature is off: the UI says so instead of failing.
 */
export function features(): Features {
  const requested = env("VIDEO_PROVIDER");
  let videoEngine: VideoEngine = "none";
  if (requested === "mock") videoEngine = "mock";
  else if (requested === "replicate" && env("REPLICATE_API_TOKEN")) videoEngine = "replicate";
  return { videoEngine, aiWriter: Boolean(env("ANTHROPIC_API_KEY")) };
}
