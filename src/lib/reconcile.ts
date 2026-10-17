import "server-only";
import type Stripe from "stripe";
import { and, eq, gte, isNotNull } from "drizzle-orm";
import { db } from "./db";
import { orders } from "./db/schema";
import { benignGrantReason, grantFromCheckoutSession, grantFromInvoice, revokeByPaymentIntent, syncSubscription, validateInvoice, validateSession } from "./billing";
import { CHECKOUT_BRAND, stripe, stripeEnvTag, stripePermissionProblem } from "./stripe";

export interface ReconcileReport {
  ranAt: string;
  days: number;
  sessions: {
    scanned: number;
    ours: number;
    alreadyGranted: number;
    repaired: { sessionId: string; userId: string; sku: string; credits: number }[];
    failed: { sessionId: string; reason: string }[];
  };
  invoices: {
    scanned: number;
    ours: number;
    alreadyGranted: number;
    repaired: { invoiceId: string; userId: string; sku: string; credits: number; sourceKey: string }[];
    failed: { invoiceId: string; reason: string }[];
  };
  subscriptions: { scanned: number; ours: number; synced: number; failed: { subscriptionId: string; reason: string }[] };
  /** Order ids whose payment Stripe shows as fully refunded while we still had them as paid. */
  refundsApplied: string[];
  /**
   * Steps Stripe refused for lack of a key permission (e.g. an organization key without
   * "Invoices Read"). The step is skipped, the others still run, and the run is not a failure:
   * granting the permission on the key is the fix, nothing in the ledger is wrong.
   */
  skipped: { step: ReconcileStep; reason: string }[];
}

export type ReconcileStep = "sessions" | "invoices" | "subscriptions" | "refunds";

/** Grant reasons that mean "nothing to repair" rather than "something is wrong". */
const benign = benignGrantReason;

/** Records a permission-denied step once per run (the same reason repeats per item otherwise). */
function skip(report: ReconcileReport, step: ReconcileStep, reason: string): void {
  if (!report.skipped.some((s) => s.step === step && s.reason === reason)) report.skipped.push({ step, reason });
}

/**
 * Runs one reconcile step. A Stripe permission error (the key cannot list invoices, sessions…)
 * records the step as skipped and lets the next step run; any other error is a real failure
 * and still aborts the run.
 */
async function runStep(report: ReconcileReport, step: ReconcileStep, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    const denied = stripePermissionProblem(err);
    if (!denied) throw err;
    skip(report, step, denied);
  }
}

/**
 * Compares what Stripe says was paid in the last `days` with what the database granted, and
 * repairs the difference: sessions and invoices without their credit lot, subscriptions whose
 * mirror drifted, and full refunds we never heard about. Every step is idempotent, so the
 * job can run daily and on demand without side effects on a healthy ledger.
 */
export async function reconcile(days = 7): Promise<ReconcileReport> {
  const s = stripe();
  const since = Math.floor(Date.now() / 1000) - days * 86400;
  const envTag = stripeEnvTag();
  const report: ReconcileReport = {
    ranAt: new Date().toISOString(),
    days,
    sessions: { scanned: 0, ours: 0, alreadyGranted: 0, repaired: [], failed: [] },
    invoices: { scanned: 0, ours: 0, alreadyGranted: 0, repaired: [], failed: [] },
    subscriptions: { scanned: 0, ours: 0, synced: 0, failed: [] },
    refundsApplied: [],
    skipped: [],
  };

  // 1. Completed Checkout Sessions → orders + (pack lot | subscription mirror + first-period lot).
  await runStep(report, "sessions", async () => {
    for await (const session of s.checkout.sessions.list({ created: { gte: since }, status: "complete", limit: 100 })) {
      report.sessions.scanned++;
      if (!validateSession(session, envTag).ok) continue;
      report.sessions.ours++;
      try {
        const full = await s.checkout.sessions.retrieve(session.id, {
          expand: ["subscription", "subscription.latest_invoice", "subscription.latest_invoice.payments", "payment_intent.latest_charge"],
        });
        const r = await grantFromCheckoutSession(full, "reconcile");
        if (!r.ok) {
          if (!benign(r.reason)) report.sessions.failed.push({ sessionId: session.id, reason: r.reason });
          continue;
        }
        if (r.lotCreated) report.sessions.repaired.push({ sessionId: session.id, userId: r.userId, sku: r.sku, credits: r.credits });
        else report.sessions.alreadyGranted++;
      } catch (err) {
        const denied = stripePermissionProblem(err);
        if (denied) skip(report, "sessions", denied);
        else report.sessions.failed.push({ sessionId: session.id, reason: err instanceof Error ? err.message.slice(0, 200) : String(err) });
      }
    }
  });

  // 2. Paid invoices → one lot per subscription period (renewals never pass through a session).
  await runStep(report, "invoices", async () => {
    for await (const invoice of s.invoices.list({ created: { gte: since }, status: "paid", limit: 100 })) {
      report.invoices.scanned++;
      if (!validateInvoice(invoice, envTag).ok) continue;
      report.invoices.ours++;
      try {
        const r = await grantFromInvoice(invoice, "reconcile");
        if (!r.ok) {
          if (!benign(r.reason)) report.invoices.failed.push({ invoiceId: invoice.id, reason: r.reason });
          continue;
        }
        if (r.lotCreated) report.invoices.repaired.push({ invoiceId: invoice.id, userId: r.userId, sku: r.sku, credits: r.credits, sourceKey: r.sourceKey });
        else report.invoices.alreadyGranted++;
      } catch (err) {
        const denied = stripePermissionProblem(err);
        if (denied) skip(report, "invoices", denied);
        else report.invoices.failed.push({ invoiceId: invoice.id, reason: err instanceof Error ? err.message.slice(0, 200) : String(err) });
      }
    }
  });

  // 3. Subscription mirrors: status, period and cancel flag as Stripe has them now.
  await runStep(report, "subscriptions", async () => {
    for await (const sub of s.subscriptions.list({ status: "all", limit: 100 })) {
      report.subscriptions.scanned++;
      if (sub.metadata?.site !== CHECKOUT_BRAND.site || (sub.metadata?.env ?? "production") !== envTag) continue;
      report.subscriptions.ours++;
      try {
        const r = await syncSubscription(sub);
        if (r.ok) report.subscriptions.synced++;
        else report.subscriptions.failed.push({ subscriptionId: sub.id, reason: r.reason });
      } catch (err) {
        const denied = stripePermissionProblem(err);
        if (denied) skip(report, "subscriptions", denied);
        else report.subscriptions.failed.push({ subscriptionId: sub.id, reason: err instanceof Error ? err.message.slice(0, 200) : String(err) });
      }
    }
  });

  // 4. Refunds Stripe knows about that we missed (a webhook outage): paid orders of the last 90 days.
  await runStep(report, "refunds", async () => {
    const recent = await db
      .select()
      .from(orders)
      .where(and(eq(orders.status, "paid"), isNotNull(orders.stripePaymentIntent), gte(orders.createdAt, new Date(Date.now() - 90 * 86400 * 1000))));
    for (const o of recent) {
      if (!o.stripePaymentIntent) continue;
      let pi: Stripe.PaymentIntent | null = null;
      try {
        pi = await s.paymentIntents.retrieve(o.stripePaymentIntent, { expand: ["latest_charge"] });
      } catch (err) {
        const denied = stripePermissionProblem(err);
        if (denied) skip(report, "refunds", denied);
        else report.sessions.failed.push({ sessionId: o.stripeSessionId, reason: `payment-intent: ${err instanceof Error ? err.message.slice(0, 160) : String(err)}` });
        continue;
      }
      const charge = pi.latest_charge && typeof pi.latest_charge !== "string" ? pi.latest_charge : null;
      if (charge?.refunded) {
        await revokeByPaymentIntent(o.stripePaymentIntent, "refunded");
        report.refundsApplied.push(o.id);
      }
    }
  });

  return report;
}

/**
 * True when the report shows anything the owner should look at. Skipped steps are not in here:
 * a missing key permission is a known, standing condition (it sits in the error inbox as a
 * warning), not a daily email.
 */
export function needsAttention(r: ReconcileReport): boolean {
  return (
    r.sessions.repaired.length > 0 ||
    r.sessions.failed.length > 0 ||
    r.invoices.repaired.length > 0 ||
    r.invoices.failed.length > 0 ||
    r.subscriptions.failed.length > 0 ||
    r.refundsApplied.length > 0
  );
}
