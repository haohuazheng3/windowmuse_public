import { describe, expect, it } from "vitest";
import { OFFERS, PACKS, PLANS, SKUS } from "@/content/plans";
import { STRIPE_OFFERS, stripeProductCopy, WEBHOOK_EVENTS } from "../scripts/ops/stripe-offers.mjs";

/*
 * scripts/ops/stripe-bootstrap.mjs runs as plain Node and cannot import plans.ts, so it carries a
 * mirror of the catalog in stripe-offers.mjs. This test is the lock between the two: a price,
 * credit count, name or interval changed in one place and not the other fails the suite.
 */
describe("Stripe catalog mirror", () => {
  it("lists exactly the skus in plans.ts, in the same order", () => {
    expect(STRIPE_OFFERS.map((o) => o.sku)).toEqual([...SKUS]);
  });

  it("agrees with plans.ts on price, credits, interval, name and env variable for every offer", () => {
    for (const mirror of STRIPE_OFFERS) {
      const offer = OFFERS[mirror.sku as keyof typeof OFFERS];
      expect(offer, `plans.ts has no offer ${mirror.sku}`).toBeDefined();
      expect({ sku: mirror.sku, name: mirror.name, priceUsd: mirror.priceUsd, credits: mirror.credits, interval: mirror.interval, priceEnv: mirror.priceEnv }).toEqual({
        sku: offer.sku,
        name: offer.name,
        priceUsd: offer.priceUsd,
        credits: offer.credits,
        interval: offer.interval,
        priceEnv: offer.priceEnv,
      });
    }
  });

  it("has three monthly plans and two one-time packs", () => {
    expect(STRIPE_OFFERS.filter((o) => o.interval === "month").map((o) => o.sku)).toEqual(Object.keys(PLANS));
    expect(STRIPE_OFFERS.filter((o) => o.interval === null).map((o) => o.sku)).toEqual(Object.keys(PACKS));
  });

  it("names every Stripe product after the brand and states the credits and validity", () => {
    for (const mirror of STRIPE_OFFERS) {
      const copy = stripeProductCopy(mirror);
      expect(copy.name.startsWith("WindowMuse ")).toBe(true);
      expect(copy.description).toContain(`${mirror.credits} credits`);
      expect(copy.description).toContain(mirror.interval === "month" ? "every month" : "90 days");
      expect(copy.description.length).toBeLessThanOrEqual(300);
    }
  });

  it("subscribes the webhook to the ten events the route handles", () => {
    expect(WEBHOOK_EVENTS).toEqual([
      "checkout.session.completed",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
      "invoice.paid",
      "invoice.payment_failed",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "charge.refunded",
      "charge.dispute.created",
      "charge.dispute.closed",
    ]);
  });
});
