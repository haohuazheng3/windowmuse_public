import { z } from "zod";
import { ensureStripeCustomer } from "@/lib/billing";
import { IS_PRODUCTION_DEPLOY } from "@/lib/env";
import { captureError } from "@/lib/errors";
import { clientIp, ipHash, rateLimit, tooMany } from "@/lib/ratelimit";
import { SITE } from "@/lib/site";
import { CHECKOUT_BRAND, checkoutMetadata, paymentsEnabled, priceIdFor, stripe } from "@/lib/stripe";
import { currentPlan, ensureUser, isResponse, requireUserApi } from "@/lib/user";
import { isPlanSku, OFFERS, PLANS, SKUS } from "@/content/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * `nonce` is minted by the browser once per purchase attempt. Double taps, retries and a
 * refresh of the same attempt reuse one Checkout Session through Stripe's idempotency key.
 */
const Body = z.object({
  sku: z.enum(SKUS),
  nonce: z.string().regex(/^[A-Za-z0-9_-]{8,64}$/),
});

function isIdempotencyError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { type?: unknown }).type === "StripeIdempotencyError";
}

/** POST /api/checkout {sku, nonce} → {url}. Signed-in sellers only; one Stripe customer per user. */
export async function POST(req: Request) {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  try {
    const [byUser, byIp] = await Promise.all([
      rateLimit(`checkout:u:${session.userId}`, 10, 300),
      rateLimit(`checkout:ip:${ipHash(clientIp(req.headers))}`, 20, 300),
    ]);
    if (!byUser.ok) return tooMany(byUser);
    if (!byIp.ok) return tooMany(byIp);

    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return Response.json({ error: "Pick a plan or a pack to continue." }, { status: 400, headers: NO_STORE });
    const { sku, nonce } = parsed.data;

    const payments = paymentsEnabled(sku);
    if (!payments.ok) return Response.json({ error: payments.reason }, { status: 503, headers: NO_STORE });
    const price = priceIdFor(sku);
    if (!price) return Response.json({ error: `The ${OFFERS[sku].name} price is not configured yet.` }, { status: 503, headers: NO_STORE });

    const user = await ensureUser(session);

    // Plan changes go through the Stripe billing portal; a second Checkout would create a second subscription.
    if (isPlanSku(sku)) {
      const plan = await currentPlan(session.userId);
      if (plan.sku !== "trial") {
        const current = isPlanSku(plan.sku) ? PLANS[plan.sku].name : plan.sku;
        return Response.json(
          { error: `You are on the ${current} plan. Switch plans or cancel from the billing portal.`, portal: true },
          { status: 409, headers: NO_STORE },
        );
      }
    }

    const customer = await ensureStripeCustomer(user);
    const origin = IS_PRODUCTION_DEPLOY ? SITE.url : new URL(req.url).origin;
    const metadata = checkoutMetadata(session.userId, sku);
    const offer = OFFERS[sku];
    const isPlan = offer.interval === "month";

    const checkout = await stripe().checkout.sessions.create(
      {
        mode: isPlan ? "subscription" : "payment",
        customer,
        client_reference_id: session.userId,
        line_items: [{ price, quantity: 1 }],
        metadata,
        ...(isPlan
          ? { subscription_data: { metadata, description: `WindowMuse ${offer.name} plan` } }
          : {
              payment_intent_data: {
                metadata,
                description: `WindowMuse ${offer.name} credit pack`,
                statement_descriptor_suffix: CHECKOUT_BRAND.statementSuffix,
              },
            }),
        allow_promotion_codes: true,
        success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?checkout=cancelled`,
        // No `expires_at`: it would change every second and clash with the idempotency key below
        // (Stripe refuses a reused key with a different body). Sessions expire on Stripe's default.
        branding_settings: {
          display_name: CHECKOUT_BRAND.displayName,
          button_color: CHECKOUT_BRAND.buttonColor,
          border_style: "rounded",
          icon: { type: "url", url: CHECKOUT_BRAND.iconUrl },
        },
        custom_text: { submit: { message: CHECKOUT_BRAND.submitNote } },
      },
      // Same user + same offer + same attempt → the same open session, however many times the button is pressed.
      { idempotencyKey: `wm-co-${session.userId}-${sku}-${nonce}` },
    );

    if (!checkout.url) throw new Error("Stripe returned a Checkout Session without a URL");
    return Response.json({ url: checkout.url }, { headers: NO_STORE });
  } catch (err) {
    // The same attempt sent with a different body (a deploy changed the request shape mid-attempt):
    // tell the browser to start a fresh attempt instead of failing for the rest of the window.
    if (isIdempotencyError(err)) {
      return Response.json({ error: "That checkout attempt is stale. Please press the button again.", stale: true }, { status: 409, headers: NO_STORE });
    }
    await captureError(err, { route: "/api/checkout", context: { userId: session.userId } });
    return Response.json({ error: "We couldn’t open checkout. Please try again in a moment." }, { status: 500, headers: NO_STORE });
  }
}
