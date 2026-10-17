import "server-only";
import Stripe from "stripe";
import { env, IS_PRODUCTION_DEPLOY, VERCEL_ENV } from "./env";
import { SITE } from "./site";
import { OFFERS, type Sku } from "@/content/plans";

let client: Stripe | null = null;

/** An organization API key (`sk_org…`) works for every account in the organization. */
function isOrgKey(key: string): boolean {
  return key.startsWith("sk_org");
}

/**
 * The account every request acts on. Required with an organization key, which Stripe
 * only accepts together with a `Stripe-Context` header naming the target account.
 */
export function stripeContext(): string | undefined {
  return env("STRIPE_CONTEXT");
}

export function stripe(): Stripe {
  if (!client) {
    const key = env("STRIPE_SECRET_KEY");
    if (!key) throw new Error("STRIPE_SECRET_KEY is not configured");
    const context = stripeContext();
    if (isOrgKey(key) && !context) throw new Error("STRIPE_CONTEXT (acct_…) is required with an organization key");
    client = new Stripe(key, {
      typescript: true,
      maxNetworkRetries: 2,
      appInfo: { name: SITE.domain },
      ...(context ? { stripeContext: context } : {}),
    });
  }
  return client;
}

/** Test-mode keys carry `_test_` in their prefix; live and organization keys are treated as live. */
export function stripeMode(): "live" | "test" | "missing" {
  const key = env("STRIPE_SECRET_KEY") ?? "";
  if (!key) return "missing";
  return key.includes("_test_") ? "test" : "live";
}

/**
 * When Stripe refused a call because the API key lacks a permission (HTTP 403, the SDK's
 * `StripePermissionError`; with an organization key, each account's permissions are granted
 * separately), the short reason to record, e.g. "invoice_read (Invoices Read)". Null for every
 * other error, which stays a real failure.
 */
export function stripePermissionProblem(err: unknown): string | null {
  if (typeof err !== "object" || err === null) return null;
  const e = err as { type?: unknown; statusCode?: unknown; code?: unknown; message?: unknown };
  const message = typeof e.message === "string" ? e.message : "";
  const denied =
    e.type === "StripePermissionError" ||
    e.statusCode === 403 ||
    e.code === "permission_denied" ||
    /does not have the required permissions|^Permission denied\b/i.test(message);
  if (!denied) return null;
  // "… Enabling Invoices Read ('invoice_read') permissions on this key would allow this request to continue."
  const m = /Enabling (.+?) \('([a-z0-9_]+)'\) permissions?/i.exec(message);
  if (m) return `${m[2]} (${m[1].trim()})`;
  return message.slice(0, 200) || "permission denied";
}

/** Tag written into every session's metadata; the webhook ignores sessions from other environments. */
export function stripeEnvTag(): string {
  return VERCEL_ENV;
}

/** Stripe price id for an offer, from the environment variable the offer names. */
export function priceIdFor(sku: Sku): string | undefined {
  return env(OFFERS[sku].priceEnv);
}

/**
 * Live keys only take money on the production deployment. Preview/dev deployments
 * refuse to open a live Checkout unless explicitly allowed for a supervised test.
 */
export function paymentsEnabled(sku?: Sku): { ok: true } | { ok: false; reason: string } {
  const mode = stripeMode();
  if (mode === "missing") return { ok: false, reason: "Payments are not configured yet." };
  if (sku && !priceIdFor(sku)) return { ok: false, reason: `The ${OFFERS[sku].name} price is not configured yet.` };
  if (mode === "live" && !IS_PRODUCTION_DEPLOY && process.env.ALLOW_LIVE_CHECKOUT_NONPROD !== "1") {
    return { ok: false, reason: `Checkout is only open on ${SITE.domain}.` };
  }
  return { ok: true };
}

/**
 * Brand shown on Stripe Checkout. This is a server-side whitelist: the browser can
 * never choose which name appears on the payment page or the card statement.
 */
export const CHECKOUT_BRAND = {
  /** `metadata.site` on every product, price, session and subscription we create. */
  site: "windowmuse",
  displayName: "WindowMuse",
  buttonColor: "#E8562A",
  /** Square brand mark next to the name at the top of Checkout (Stripe fetches it from our own domain). */
  iconUrl: `${SITE.url}/brand/logo-512.png`,
  /**
   * Our name on card statements after the account's fixed prefix: "<PREFIX>* WINDOWMUSE".
   * Stripe allows 22 characters in total; a 10-character prefix + "* " leaves exactly 10.
   */
  statementSuffix: "WINDOWMUSE",
  /** Line under the pay button. */
  submitNote: "Credits land in your WindowMuse studio the moment payment completes.",
} as const;

/** Metadata stamped on sessions, subscriptions and payment intents so every webhook can attribute them. */
export function checkoutMetadata(userId: string, sku: Sku): Record<string, string> {
  return { site: CHECKOUT_BRAND.site, env: stripeEnvTag(), userId, sku };
}
