import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import {
  benignGrantReason,
  invoicePeriod,
  invoiceSku,
  packLotKey,
  priceMap,
  skuForPriceId,
  subscriptionLotKey,
  subscriptionPeriod,
  subscriptionSku,
  validateInvoice,
  validateSession,
} from "@/lib/billing";
import { OFFERS, PACKS, PLANS } from "@/content/plans";

/* ------------------------------------------------------------------ fixtures */

const baseSession = {
  id: "cs_test_1",
  mode: "subscription",
  status: "complete",
  payment_status: "paid",
  client_reference_id: "user_abc",
  metadata: { site: "windowmuse", env: "production", userId: "user_abc", sku: "growth" },
} as unknown as Stripe.Checkout.Session;

const session = (patch: Record<string, unknown>) => ({ ...baseSession, ...patch }) as unknown as Stripe.Checkout.Session;
const withMeta = (meta: Record<string, string | undefined>) => session({ metadata: { ...baseSession.metadata, ...meta } });

// Fake price ids are assembled at runtime so the repository never contains id-shaped literals.
const PRICE = Object.fromEntries(Object.keys(OFFERS).map((sku) => [sku, ["price", sku, "x"].join("_")])) as Record<string, string>;
const fakeEnv = (name: string) => {
  const sku = Object.values(OFFERS).find((o) => o.priceEnv === name)?.sku;
  return sku ? PRICE[sku] : undefined;
};
const map = priceMap(fakeEnv);

const line = (start: number, end: number, opts: { proration?: boolean; price?: string; subscription?: boolean } = {}) =>
  ({
    period: { start, end },
    parent: opts.subscription === false ? { type: "invoice_item_details", subscription_item_details: null } : { type: "subscription_item_details", subscription_item_details: { proration: opts.proration ?? false } },
    subscription: opts.subscription === false ? null : "sub_1",
    pricing: opts.price ? { type: "price_details", price_details: { price: opts.price, product: "prod_1" } } : null,
  }) as unknown as Stripe.InvoiceLineItem;

const invoice = (patch: Record<string, unknown> = {}) =>
  ({
    id: "in_1",
    status: "paid",
    billing_reason: "subscription_cycle",
    period_start: 1_000,
    period_end: 1_000,
    metadata: {},
    parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { site: "windowmuse", env: "production", userId: "user_abc", sku: "growth" } } },
    lines: { data: [line(2_000, 4_000, { price: PRICE.growth })] },
    ...patch,
  }) as unknown as Stripe.Invoice;

/* ------------------------------------------------------------------ validateSession */

describe("validateSession", () => {
  it("accepts a paid plan checkout for this site and names the buyer and sku", () => {
    expect(validateSession(baseSession, "production")).toEqual({ ok: true, userId: "user_abc", sku: "growth", kind: "subscription" });
  });
  it("accepts a paid pack checkout in payment mode", () => {
    const s = withMeta({ sku: "pack10" });
    expect(validateSession({ ...s, mode: "payment" } as Stripe.Checkout.Session, "production")).toEqual({ ok: true, userId: "user_abc", sku: "pack10", kind: "pack" });
  });
  it("accepts a 100%-off checkout (no payment required)", () => {
    expect(validateSession(session({ payment_status: "no_payment_required" }), "production").ok).toBe(true);
  });
  it("ignores sessions from other sites and other environments", () => {
    expect(validateSession(withMeta({ site: "stillgravity" }), "production")).toEqual({ ok: false, reason: "other-site" });
    expect(validateSession(baseSession, "preview")).toEqual({ ok: false, reason: "other-env" });
    expect(validateSession(withMeta({ env: undefined }), "production").ok).toBe(true); // missing env tag = production
  });
  it("refuses open, expired and unpaid sessions", () => {
    expect(validateSession(session({ status: "open" }), "production")).toEqual({ ok: false, reason: "status-open" });
    expect(validateSession(session({ status: "expired" }), "production")).toEqual({ ok: false, reason: "status-expired" });
    expect(validateSession(session({ payment_status: "unpaid" }), "production")).toEqual({ ok: false, reason: "payment-unpaid" });
  });
  it("refuses setup-mode sessions and offers in the wrong mode", () => {
    expect(validateSession(session({ mode: "setup" }), "production")).toEqual({ ok: false, reason: "mode-setup" });
    expect(validateSession(session({ mode: "payment" }), "production")).toEqual({ ok: false, reason: "plan-not-subscription-mode" });
    expect(validateSession(withMeta({ sku: "pack50" }), "production")).toEqual({ ok: false, reason: "pack-not-payment-mode" });
  });
  it("requires a buyer and a known sku, and refuses a user id that disagrees with the metadata", () => {
    expect(validateSession(session({ client_reference_id: null, metadata: { site: "windowmuse", env: "production", sku: "growth" } }), "production")).toEqual({ ok: false, reason: "no-user" });
    expect(validateSession(session({ client_reference_id: null }), "production").ok).toBe(true); // metadata.userId alone is enough
    expect(validateSession(withMeta({ sku: "enterprise" }), "production")).toEqual({ ok: false, reason: "unknown-sku" });
    expect(validateSession(withMeta({ userId: "user_other" }), "production")).toEqual({ ok: false, reason: "user-mismatch" });
  });
});

/* ------------------------------------------------------------------ lot keys */

describe("credit lot source keys", () => {
  it("keys a pack by its Checkout Session id", () => {
    expect(packLotKey("cs_test_1")).toBe("cs_test_1");
  });
  it("keys a subscription period by subscriptionId:periodStart, so one invoice always yields one key", () => {
    expect(subscriptionLotKey("sub_1", 1_700_000_000)).toBe("sub_1:1700000000");
    const inv = invoice();
    const period = invoicePeriod(inv);
    expect(subscriptionLotKey("sub_1", period.start)).toBe("sub_1:2000");
    expect(subscriptionLotKey("sub_1", invoicePeriod(inv).start)).toBe(subscriptionLotKey("sub_1", period.start));
  });
  it("reads the period from the regular subscription line, skipping prorations and one-off items", () => {
    const inv = invoice({
      lines: { data: [line(1_500, 1_900, { proration: true }), line(2_000, 4_000), line(9_000, 9_900, { subscription: false })] },
    });
    expect(invoicePeriod(inv)).toEqual({ start: 2_000, end: 4_000 });
  });
  it("uses a proration line only when there is no regular line, and the invoice period as a last resort", () => {
    expect(invoicePeriod(invoice({ lines: { data: [line(1_500, 1_900, { proration: true })] } }))).toEqual({ start: 1_500, end: 1_900 });
    expect(invoicePeriod(invoice({ lines: { data: [] }, period_start: 50, period_end: 60 }))).toEqual({ start: 50, end: 60 });
  });
  it("keys the first period from the subscription the same way the invoice does", () => {
    const sub = { items: { data: [{ current_period_start: 2_000, current_period_end: 4_000 }] } } as unknown as Stripe.Subscription;
    expect(subscriptionPeriod(sub)).toEqual({ start: 2_000, end: 4_000 });
    expect(subscriptionLotKey("sub_1", subscriptionPeriod(sub)!.start)).toBe(subscriptionLotKey("sub_1", invoicePeriod(invoice()).start));
    expect(subscriptionPeriod({ items: { data: [] } } as unknown as Stripe.Subscription)).toBeNull();
  });
});

/* ------------------------------------------------------------------ plan ↔ price mapping */

describe("plan ↔ price mapping", () => {
  it("maps every configured STRIPE_PRICE_* id back to its sku", () => {
    for (const offer of [...Object.values(PLANS), ...Object.values(PACKS)]) {
      expect(skuForPriceId(PRICE[offer.sku], map)).toBe(offer.sku);
    }
    expect(skuForPriceId(["price", "unknown"].join("_"), map)).toBeNull();
    expect(skuForPriceId(null, map)).toBeNull();
  });
  it("leaves unset price variables out of the map", () => {
    const partial = priceMap((name) => (name === "STRIPE_PRICE_PRO" ? PRICE.pro : undefined));
    expect(Object.keys(partial)).toEqual([PRICE.pro]);
  });
  it("reads an invoice's plan from the line price, falling back to the snapshotted metadata", () => {
    expect(invoiceSku(invoice(), map)).toBe("growth");
    expect(invoiceSku(invoice({ lines: { data: [line(2_000, 4_000, { price: PRICE.pro })] } }), map)).toBe("pro");
    expect(invoiceSku(invoice({ lines: { data: [line(2_000, 4_000)] } }), map)).toBe("growth"); // metadata.sku
    // a pack price on a subscription line is nonsense and never becomes a plan
    expect(invoiceSku(invoice({ lines: { data: [line(2_000, 4_000, { price: PRICE.pack10 })] }, parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: {} } } }), map)).toBeNull();
  });
  it("reads a subscription's plan from its item price, falling back to its metadata", () => {
    const sub = (price: string | null, sku?: string) =>
      ({ items: { data: price ? [{ price: { id: price } }] : [] }, metadata: sku ? { sku } : {} }) as unknown as Stripe.Subscription;
    expect(subscriptionSku(sub(PRICE.starter), map)).toBe("starter");
    expect(subscriptionSku(sub(null, "pro"), map)).toBe("pro");
    expect(subscriptionSku(sub(null, "pack50"), map)).toBeNull();
    expect(subscriptionSku(sub(null), map)).toBeNull();
  });
});

/* ------------------------------------------------------------------ validateInvoice */

describe("validateInvoice", () => {
  it("accepts a paid WindowMuse subscription invoice and extracts everything a grant needs", () => {
    expect(validateInvoice(invoice(), "production", map)).toEqual({ ok: true, subscriptionId: "sub_1", userId: "user_abc", sku: "growth", period: { start: 2_000, end: 4_000 } });
  });
  it("ignores one-off invoices, other sites, other environments and unpaid invoices", () => {
    expect(validateInvoice(invoice({ parent: null }), "production", map)).toEqual({ ok: false, reason: "not-subscription" });
    expect(validateInvoice(invoice({ parent: { type: "subscription_details", subscription_details: { subscription: "sub_1", metadata: { site: "other" } } } }), "production", map)).toEqual({ ok: false, reason: "other-site" });
    expect(validateInvoice(invoice(), "preview", map)).toEqual({ ok: false, reason: "other-env" });
    expect(validateInvoice(invoice({ status: "open" }), "production", map)).toEqual({ ok: false, reason: "status-open" });
  });
  it("grants only for invoices that pay for a period: creation and renewal, never a plan-change proration", () => {
    expect(validateInvoice(invoice({ billing_reason: "subscription_create" }), "production", map).ok).toBe(true);
    expect(validateInvoice(invoice({ billing_reason: "subscription_cycle" }), "production", map).ok).toBe(true);
    for (const reason of ["subscription_update", "subscription_threshold", "manual", "upcoming", "automatic_pending_invoice_item_invoice", "quote_accept"]) {
      expect(validateInvoice(invoice({ billing_reason: reason }), "production", map)).toEqual({ ok: false, reason: `billing-${reason}` });
    }
    expect(validateInvoice(invoice({ billing_reason: null }), "production", map)).toEqual({ ok: false, reason: "billing-unknown" });
  });
  it("accepts an expanded subscription object in the parent", () => {
    const inv = invoice({ parent: { type: "subscription_details", subscription_details: { subscription: { id: "sub_9" }, metadata: { site: "windowmuse", env: "production", userId: "user_abc", sku: "pro" } } } });
    const r = validateInvoice(inv, "production", map);
    expect(r.ok && r.subscriptionId).toBe("sub_9");
  });
});

/* ------------------------------------------------------------------ benign refusals */

describe("benignGrantReason", () => {
  it("treats other sites/envs, closed orders, pending payments and non-period invoices as nothing to do", () => {
    for (const r of ["other-site", "other-env", "order-refunded", "order-disputed", "payment-unpaid", "billing-subscription_update", "billing-unknown"]) {
      expect(benignGrantReason(r)).toBe(true);
    }
  });
  it("sees through the prefixes the checkout grant adds", () => {
    expect(benignGrantReason("invoice-billing-subscription_update")).toBe(true);
    expect(benignGrantReason("subscription-other-site")).toBe(true);
    expect(benignGrantReason("invoice-subscription-other-env")).toBe(true);
  });
  it("keeps real problems visible", () => {
    for (const r of ["no-user", "unknown-sku", "user-mismatch", "invoice-status-open", "invoice-unknown-plan", "subscription-no-user", "order-not-persisted"]) {
      // order-not-persisted starts with "order-" and is deliberately benign for the webhook (the session grant retries); everything else must surface.
      expect(benignGrantReason(r)).toBe(r === "order-not-persisted");
    }
  });
});
