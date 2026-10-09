import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type Stripe from "stripe";
import { AutoRefresh } from "@/components/AutoRefresh";
import { PurchaseEvents } from "@/components/PurchaseEvents";
import { Container, StatPane } from "@/components/ui";
import { grantFromCheckoutSession } from "@/lib/billing";
import { getBalance } from "@/lib/credits";
import { captureError } from "@/lib/errors";
import { shortRef } from "@/lib/ids";
import { orderOwner } from "@/lib/account";
import { rateLimit } from "@/lib/ratelimit";
import { SITE } from "@/lib/site";
import { stripe } from "@/lib/stripe";
import { requireUser } from "@/lib/user";
import { CREDIT_RULES, OFFERS, formatPrice, isPlanSku } from "@/content/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Credits added", robots: { index: false, follow: false } };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <Container className="pb-16 pt-8 sm:pt-14">
      <div className="mx-auto max-w-3xl">{children}</div>
    </Container>
  );
}

function ContactLine() {
  return (
    <>
      email{" "}
      <a href={`mailto:${SITE.email}`} className="text-accent-text underline underline-offset-4">
        {SITE.email}
      </a>
    </>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/**
 * Primary grant path: verify the Checkout Session with Stripe right here, add the credits
 * on the spot (idempotent per session for packs, per invoice period for plans) and show the
 * new balance. The webhook and the daily reconcile job are the fallbacks.
 */
export default async function CheckoutSuccessPage(props: PageProps<"/checkout/success">) {
  const { userId } = await requireUser();
  const sp = await props.searchParams;
  const sessionId = typeof sp.session_id === "string" ? sp.session_id : "";
  if (!/^cs_(live|test)_[A-Za-z0-9]+$/.test(sessionId)) redirect("/pricing");

  // A session already recorded for another account is refused before Stripe is asked anything,
  // and one account may only confirm so many sessions per window: the page is not a Stripe proxy.
  const known = await orderOwner(sessionId);
  if (known && known !== userId) redirect("/pricing");
  const rl = await rateLimit(`success:${userId}`, 30, 600);
  if (!rl.ok) {
    return (
      <Shell>
        <div className="pane p-7 sm:p-10" role="alert">
          <h1 className="headline text-[1.8rem] text-ink">Too many checks in a row.</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-3">
            Please wait a few minutes and open this page again. If you paid, your credits still arrive: Stripe tells us about every payment and we check again every day.
          </p>
          <div className="mt-6">
            <Link href="/studio" prefetch={false} className="btn btn-primary">
              Open studio
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.retrieve(sessionId, {
      expand: ["subscription", "subscription.latest_invoice", "subscription.latest_invoice.payments", "payment_intent.latest_charge"],
    });
  } catch (err) {
    await captureError(err, { route: "/checkout/success", context: { sessionId, userId } });
    return (
      <Shell>
        <div className="pane p-7 sm:p-10" role="alert">
          <h1 className="headline text-[1.8rem] text-ink">We couldn’t confirm that checkout yet.</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-3">
            If you were charged, your credits will still arrive: Stripe tells us about every payment and we check again every day. Nothing in
            your studio after ten minutes? <ContactLine /> and we’ll sort it out right away.
          </p>
          <div className="mt-6">
            <Link href="/studio" prefetch={false} className="btn btn-primary">
              Open studio
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  // A session link is not a bearer token: only the account that started the checkout may claim it.
  if (session.client_reference_id !== userId) {
    await captureError(new Error("checkout session claimed by another account"), {
      route: "/checkout/success",
      severity: "warn",
      context: { sessionId, userId, owner: session.client_reference_id },
    });
    return (
      <Shell>
        <div className="pane p-7 sm:p-10" role="alert">
          <h1 className="headline text-[1.8rem] text-ink">This checkout belongs to a different account.</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-3">
            Credits go to the account that started the purchase. Sign in with the email you used at checkout, or <ContactLine /> if you
            think this is a mistake.
          </p>
          <div className="mt-6">
            <Link href="/studio" prefetch={false} className="btn btn-ghost">
              Back to studio
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  if (session.status === "open" || session.payment_status === "unpaid") {
    return (
      <Shell>
        <AutoRefresh seconds={4} max={20} />
        <div className="pane p-7 sm:p-10" role="status">
          <p className="tag tag-accent">Confirming payment</p>
          <h1 className="headline mt-4 text-[1.8rem] text-ink">Your bank is still confirming the payment.</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-3">
            This page checks again every few seconds. Some payment methods take a moment; your credits appear here the second it clears.
          </p>
          <div className="mt-5 space-y-2">
            <div className="skeleton h-3 w-full" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>
      </Shell>
    );
  }

  const grant = await grantFromCheckoutSession(session, "success_page");
  if (!grant.ok) {
    await captureError(new Error(`success page could not grant: ${grant.reason}`), { route: "/checkout/success", context: { sessionId, userId, reason: grant.reason } });
    return (
      <Shell>
        <div className="pane p-7 sm:p-10" role="alert">
          <h1 className="headline text-[1.8rem] text-ink">Something doesn’t add up with this checkout.</h1>
          <p className="mt-3 text-[1rem] leading-relaxed text-ink-3">
            We’ve been alerted and will check it now. If you paid, you won’t lose anything: <ContactLine /> and we’ll reply quickly.
          </p>
          <div className="mt-6">
            <Link href="/studio" prefetch={false} className="btn btn-ghost">
              Back to studio
            </Link>
          </div>
        </div>
      </Shell>
    );
  }

  const balance = await getBalance(userId);
  const offer = OFFERS[grant.sku];
  const plan = isPlanSku(grant.sku);
  const paid = grant.amountTotal > 0 ? `${formatPrice(grant.amountTotal / 100)} ${grant.currency.toUpperCase()}` : "Promo code, nothing charged";

  return (
    <Shell>
      <PurchaseEvents sessionId={session.id} sku={grant.sku} amount={grant.amountTotal} currency={grant.currency} />
      <div className="pane p-6 sm:p-10">
        <p className="tag tag-ok">Paid · ref {shortRef(grant.orderId ?? session.id)}</p>
        <h1 className="display mt-4 text-[2.3rem] text-ink sm:text-[2.8rem]">
          Credits are in. <em>Go make something.</em>
        </h1>
        <p className="mt-3 max-w-xl text-[1.02rem] leading-relaxed text-ink-3">
          {plan
            ? `Your ${offer.name} plan is live: ${offer.credits} credits now, and ${offer.credits} more at the start of every billing month.`
            : `Your ${offer.name} pack is in your studio and ready to spend.`}
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <StatPane label="Credits added" value={grant.credits} tone="accent" hint={`Usable until ${dateFmt.format(grant.expiresAt)}`} />
          <StatPane
            label="Balance now"
            value={balance.available}
            hint={balance.reserved > 0 ? `${CREDIT_RULES.credits(balance.reserved)} held by videos still generating` : "Ready for your next video"}
          />
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/studio/new" prefetch={false} className="btn btn-primary btn-lg">
            Make a video
          </Link>
          <Link href="/studio" prefetch={false} className="btn btn-ghost btn-lg">
            Open studio
          </Link>
        </div>

        <div className="pane-inset mt-6 p-4 text-[0.9rem] leading-relaxed text-ink-3">
          <p>
            <strong className="text-ink">{paid}.</strong> Stripe emails your receipt to the address you used at checkout.{" "}
            {plan ? (
              <>
                {offer.allow1080p ? "1080p exports and three parallel videos are unlocked. " : "720p exports are unlocked. "}
                Change or cancel the plan any time from{" "}
                <Link href="/studio/billing" prefetch={false} className="underline underline-offset-4">
                  Billing
                </Link>
                .
              </>
            ) : (
              "Pack credits use the limits of the plan you are on; without a plan that is 720p and one video at a time."
            )}
          </p>
          <p className="mt-2">{CREDIT_RULES.lines[3]}</p>
        </div>
      </div>
    </Shell>
  );
}
