import { env, IS_PRODUCTION_DEPLOY } from "@/lib/env";
import { captureError } from "@/lib/errors";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { SITE } from "@/lib/site";
import { stripe, stripeMode } from "@/lib/stripe";
import { ensureUser, isResponse, requireUserApi } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" } as const;

/** POST /api/stripe/portal → {url}: the Stripe billing portal (plan changes, cancellation, invoices, card). */
export async function POST(req: Request) {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  try {
    const rl = await rateLimit(`portal:${session.userId}`, 10, 300);
    if (!rl.ok) return tooMany(rl);
    if (stripeMode() === "missing") return Response.json({ error: "Billing is not configured yet." }, { status: 503, headers: NO_STORE });

    const user = await ensureUser(session);
    if (!user.stripeCustomerId) {
      return Response.json({ error: "No billing history yet. The portal opens after your first purchase." }, { status: 409, headers: NO_STORE });
    }

    const origin = IS_PRODUCTION_DEPLOY ? SITE.url : new URL(req.url).origin;
    // The WindowMuse portal configuration (plan switching between our three plans, cancellation,
    // invoices, our name and policy links) is created by scripts/ops/stripe-bootstrap.mjs; without
    // the variable Stripe's account default applies, which cannot switch plans.
    const configuration = env("STRIPE_PORTAL_CONFIG");
    const portal = await stripe().billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${origin}/studio/billing`,
      ...(configuration ? { configuration } : {}),
    });
    return Response.json({ url: portal.url }, { headers: NO_STORE });
  } catch (err) {
    await captureError(err, { route: "/api/stripe/portal", context: { userId: session.userId } });
    return Response.json({ error: "We couldn’t open the billing portal. Please try again in a moment." }, { status: 500, headers: NO_STORE });
  }
}
