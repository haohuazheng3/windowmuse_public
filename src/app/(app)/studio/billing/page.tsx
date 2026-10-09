import type { Metadata } from "next";
import Link from "next/link";
import { BillingPacks } from "@/components/studio/BillingPacks";
import { PortalButton } from "@/components/studio/PortalButton";
import { planLabel } from "@/components/studio/me-store";
import { StatPane } from "@/components/ui";
import { CREDIT_RULES, OFFERS, PLANS, formatPrice, isPlanSku, isSku } from "@/content/plans";
import { getActiveSubscription, listOrders } from "@/lib/account";
import { getBalance, listLots } from "@/lib/credits";
import { shortRef } from "@/lib/ids";
import { currentPlan, requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing" };

function day(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

const LOT_KIND: Record<string, string> = { trial: "Free trial", subscription: "Monthly plan", pack: "Credit pack", adjust: "Adjustment" };

type LotState = "Active" | "Revoked" | "Expired" | "Used up";

function lotState(l: { status: string; remaining: number; expiresAt: Date | null }): { state: LotState; expired: boolean } {
  const expired = !!l.expiresAt && l.expiresAt.getTime() <= Date.now();
  if (l.status === "revoked") return { state: "Revoked", expired };
  if (expired) return { state: "Expired", expired };
  if (l.remaining === 0) return { state: "Used up", expired };
  return { state: "Active", expired };
}

export default async function BillingPage() {
  const { userId, email } = await requireUser();
  const [plan, subscription, balance, lots, orders] = await Promise.all([
    currentPlan(userId),
    getActiveSubscription(userId),
    getBalance(userId),
    listLots(userId),
    listOrders(userId),
  ]);
  const offer = isPlanSku(plan.sku) ? PLANS[plan.sku] : null;

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow eyebrow-accent">Billing</p>
        <h1 className="display mt-2 text-[2.2rem] text-ink sm:text-[2.8rem]">Plan &amp; credits</h1>
        <p className="mt-2 text-[0.95rem] text-ink-3">Receipts go to {email} from Stripe. Credits land here the moment a payment completes.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <StatPane label="Available" value={balance.available} hint={balance.reserved > 0 ? `${balance.reserved} reserved by videos still generating` : "Reserved when you press Generate, charged only on success"} />
        <StatPane
          label="Plan"
          value={planLabel(plan.sku)}
          tone={offer ? "default" : "muse"}
          hint={
            offer
              ? `${formatPrice(offer.priceUsd)}/month · ${offer.credits} credits · ${plan.allow1080p ? "1080p" : "720p"} · ${plan.maxParallel} at a time`
              : "No subscription · packs use trial limits (720p, one at a time)"
          }
        />
      </div>

      <section className="pane p-5 sm:p-6" aria-labelledby="plan-heading">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 id="plan-heading" className="headline text-[1.35rem] text-ink">
              {offer ? `${offer.name} plan` : "No plan yet"}
            </h2>
            {subscription ? (
              <p className="mt-1.5 text-[0.92rem] text-ink-3">
                {subscription.cancelAtPeriodEnd
                  ? `Cancellation scheduled: credits for the current period stay usable; the plan ends ${day(subscription.currentPeriodEnd)}.`
                  : subscription.status === "past_due"
                    ? `Payment is past due. Stripe retries the card; update it in the portal to keep ${offer?.name ?? "the plan"} running.`
                    : `Renews ${day(subscription.currentPeriodEnd)} · ${offer ? CREDIT_RULES.expiryNote(offer) : ""}`}
              </p>
            ) : (
              <p className="mt-1.5 max-w-xl text-[0.92rem] leading-relaxed text-ink-3">
                Monthly plans add credits every billing month and unlock 720p for every video; Growth and Pro add 1080p and three videos at once. Packs are a one-time top-up.
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            {subscription ? (
              <>
                <PortalButton label="Change plan" className="btn btn-primary" />
                <PortalButton label={subscription.cancelAtPeriodEnd ? "Resume or manage" : "Cancel plan"} className="btn btn-ghost" />
              </>
            ) : (
              <Link href="/pricing" className="btn btn-primary">
                Choose a plan
              </Link>
            )}
          </div>
        </div>
      </section>

      <BillingPacks />

      <section className="pane p-5 sm:p-6" aria-labelledby="lots-heading">
        <h2 id="lots-heading" className="headline text-[1.35rem] text-ink">
          Credit lots
        </h2>
        <p className="mt-1 text-[0.88rem] text-ink-4">Each purchase or grant is a lot with its own expiry; videos draw from the lot that expires first.</p>
        {lots.length === 0 ? (
          <p className="mt-4 text-[0.95rem] text-ink-3">No credits yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {lots.map((l) => {
              const { state, expired } = lotState(l);
              const tone = state === "Active" ? "tag-ok" : state === "Revoked" ? "tag-bad" : "";
              return (
                <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                  <div className="min-w-0">
                    <p className="text-[0.95rem] font-semibold text-ink">{LOT_KIND[l.kind] ?? l.kind}</p>
                    <p className="text-[0.82rem] text-ink-4">
                      Granted {day(l.createdAt)}
                      {l.expiresAt ? ` · ${expired ? "expired" : "expires"} ${day(l.expiresAt)}` : " · no expiry"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[0.95rem] tabular-nums text-ink-2">
                      <span className="font-semibold text-ink">{l.remaining}</span> / {l.total}
                    </span>
                    <span className={`tag ${tone}`}>{state}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="pane p-5 sm:p-6" aria-labelledby="orders-heading">
        <h2 id="orders-heading" className="headline text-[1.35rem] text-ink">
          Order history
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-[0.95rem] text-ink-3">No orders yet. Your free trial credits were a gift, not an order.</p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--line)]">
            {orders.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3">
                <div className="min-w-0">
                  <p className="text-[0.95rem] font-semibold text-ink">
                    {isSku(o.sku) ? OFFERS[o.sku].name : o.sku}
                    {o.kind === "subscription" ? " plan" : ""}
                  </p>
                  <p className="text-[0.82rem] text-ink-4">
                    {day(o.createdAt)} · ref {shortRef(o.id)}
                    {o.promoCode ? ` · code ${o.promoCode}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[0.95rem] font-semibold tabular-nums text-ink">{money(o.amountTotal, o.currency)}</span>
                  <span className={`tag ${o.status === "paid" ? "tag-ok" : "tag-bad"}`}>{o.status === "paid" ? "Paid" : o.status === "refunded" ? "Refunded" : "Disputed"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-[0.82rem] text-ink-4">
          Invoices and card details live in the Stripe portal. Refunds follow the{" "}
          <Link href="/refund-policy" className="underline underline-offset-2">
            refund policy
          </Link>
          .
        </p>
      </section>

      <section className="pane-inset px-5 py-4">
        <p className="eyebrow">How credits work</p>
        <ul className="mt-2 space-y-1 text-[0.9rem] leading-relaxed text-ink-3">
          {CREDIT_RULES.lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
