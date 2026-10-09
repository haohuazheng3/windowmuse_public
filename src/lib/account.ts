import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { orders, subscriptions, type OrderRow, type SubscriptionRow } from "./db/schema";
import { ENTITLED_STATUSES } from "./user";
import { isPlanSku } from "@/content/plans";

/*
 * Read-only account views for the billing page. Writes to orders and subscriptions happen
 * only in the Stripe webhook / success-page / reconcile code.
 */

const TIER: Record<string, number> = { starter: 1, growth: 2, pro: 3 };

/** The subscription whose limits apply right now (the highest entitled one), or null. Mirrors `currentPlan`. */
export async function getActiveSubscription(userId: string): Promise<SubscriptionRow | null> {
  const rows = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), inArray(subscriptions.status, [...ENTITLED_STATUSES])));
  let best: SubscriptionRow | null = null;
  for (const r of rows) {
    if (!isPlanSku(r.sku)) continue;
    if (!best || TIER[r.sku] > TIER[best.sku]) best = r;
  }
  return best;
}

/** Paid, refunded and disputed orders, newest first. */
export async function listOrders(userId: string, limit = 50): Promise<OrderRow[]> {
  return db.select().from(orders).where(eq(orders.userId, userId)).orderBy(desc(orders.createdAt)).limit(limit);
}

/** Who a recorded Checkout Session belongs to, or null when the session has not been recorded yet. */
export async function orderOwner(stripeSessionId: string): Promise<string | null> {
  const rows = await db.select({ userId: orders.userId }).from(orders).where(eq(orders.stripeSessionId, stripeSessionId)).limit(1);
  return rows[0]?.userId ?? null;
}
