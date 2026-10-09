import "server-only";
import { and, count, desc, eq, gt, inArray, isNull, or, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  appState,
  contactMessages,
  creditEvents,
  creditLots,
  errorGroups,
  inboxMessages,
  jobs,
  orders,
  subscriptions,
  users,
  type JobStatus,
} from "@/lib/db/schema";
import { ENTITLED_STATUSES } from "@/lib/user";
import { isPlanSku, type PlanSku } from "@/content/plans";

/*
 * Read-only aggregates for the admin pages. Credits are never moved from here: the
 * ledger is only *read* (the same formulas as src/lib/credits.ts, across all users).
 */

export const JOB_STATUS_ORDER: readonly JobStatus[] = ["draft", "awaiting_engine", "queued", "running", "succeeded", "failed", "expired", "cancelled"];

export async function jobsByStatus(): Promise<Record<JobStatus, number>> {
  const rows = await db.select({ status: jobs.status, n: count() }).from(jobs).groupBy(jobs.status);
  const out = Object.fromEntries(JOB_STATUS_ORDER.map((s) => [s, 0])) as Record<JobStatus, number>;
  for (const r of rows) out[r.status] = Number(r.n);
  return out;
}

export interface CreditTotals {
  /** Credits held by jobs still generating (reserve − debit − release over the whole ledger). */
  reserved: number;
  /** Credits users can still spend: Σ remaining over active, unexpired lots. Our liability. */
  outstanding: number;
  /** Credits spent on successful videos, all time. */
  debited: number;
  /** Credits ever granted (trial + purchases + adjustments). */
  granted: number;
}

export async function creditTotals(): Promise<CreditTotals> {
  const [held, lots, kinds] = await Promise.all([
    db
      .select({
        reserved: sql<number>`coalesce(sum(case when ${creditEvents.kind} = 'reserve' then ${creditEvents.amount} when ${creditEvents.kind} in ('debit','release') then -${creditEvents.amount} else 0 end), 0)::int`,
      })
      .from(creditEvents)
      .where(sql`${creditEvents.jobId} is not null`),
    db
      .select({ outstanding: sql<number>`coalesce(sum(${creditLots.remaining}), 0)::int` })
      .from(creditLots)
      .where(and(eq(creditLots.status, "active"), or(isNull(creditLots.expiresAt), gt(creditLots.expiresAt, sql`now()`)))),
    db.select({ kind: creditEvents.kind, total: sql<number>`coalesce(sum(${creditEvents.amount}), 0)::int` }).from(creditEvents).groupBy(creditEvents.kind),
  ]);
  const byKind = Object.fromEntries(kinds.map((k) => [k.kind, Number(k.total)]));
  return {
    reserved: Math.max(0, Number(held[0]?.reserved ?? 0)),
    outstanding: Number(lots[0]?.outstanding ?? 0),
    debited: Number(byKind.debit ?? 0),
    granted: Number(byKind.grant ?? 0),
  };
}

export interface OrderTotals {
  paidCount: number;
  revenueCents: number;
  refundedCount: number;
  disputedCount: number;
}

export async function orderTotals(days: number): Promise<OrderTotals> {
  const since = sql`now() - make_interval(days => ${days})`;
  const rows = await db
    .select({ status: orders.status, n: count(), cents: sum(orders.amountTotal) })
    .from(orders)
    .where(gt(orders.createdAt, since))
    .groupBy(orders.status);
  const out: OrderTotals = { paidCount: 0, revenueCents: 0, refundedCount: 0, disputedCount: 0 };
  for (const r of rows) {
    if (r.status === "paid") {
      out.paidCount = Number(r.n);
      out.revenueCents = Number(r.cents ?? 0);
    } else if (r.status === "refunded") out.refundedCount = Number(r.n);
    else if (r.status === "disputed") out.disputedCount = Number(r.n);
  }
  return out;
}

export async function counts() {
  const [u, errs, warns, msgs, inbox, activeSubs] = await Promise.all([
    db.select({ n: count() }).from(users),
    db.select({ n: count() }).from(errorGroups).where(and(isNull(errorGroups.resolvedAt), eq(errorGroups.severity, "error"))),
    db.select({ n: count() }).from(errorGroups).where(and(isNull(errorGroups.resolvedAt), eq(errorGroups.severity, "warn"))),
    db.select({ n: count() }).from(contactMessages).where(eq(contactMessages.status, "new")),
    db.select({ n: count() }).from(inboxMessages),
    db.select({ n: count() }).from(subscriptions).where(inArray(subscriptions.status, [...ENTITLED_STATUSES])),
  ]);
  return {
    users: Number(u[0]?.n ?? 0),
    unresolvedErrors: Number(errs[0]?.n ?? 0),
    unresolvedWarnings: Number(warns[0]?.n ?? 0),
    newMessages: Number(msgs[0]?.n ?? 0),
    inbox: Number(inbox[0]?.n ?? 0),
    activeSubscriptions: Number(activeSubs[0]?.n ?? 0),
  };
}

/** Highest entitled plan per user, for the users and jobs tables. */
export async function plansForUsers(userIds: string[]): Promise<Map<string, PlanSku>> {
  const out = new Map<string, PlanSku>();
  if (userIds.length === 0) return out;
  const tier: Record<PlanSku, number> = { starter: 1, growth: 2, pro: 3 };
  const rows = await db
    .select({ userId: subscriptions.userId, sku: subscriptions.sku })
    .from(subscriptions)
    .where(and(inArray(subscriptions.userId, userIds), inArray(subscriptions.status, [...ENTITLED_STATUSES])));
  for (const r of rows) {
    if (!isPlanSku(r.sku)) continue;
    const cur = out.get(r.userId);
    if (!cur || tier[r.sku] > tier[cur]) out.set(r.userId, r.sku);
  }
  return out;
}

/** Spendable credits per user (same rule as getBalance, in one query for a page of users). */
export async function balancesForUsers(userIds: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({ userId: creditLots.userId, available: sql<number>`coalesce(sum(${creditLots.remaining}), 0)::int` })
    .from(creditLots)
    .where(and(inArray(creditLots.userId, userIds), eq(creditLots.status, "active"), or(isNull(creditLots.expiresAt), gt(creditLots.expiresAt, sql`now()`))))
    .groupBy(creditLots.userId);
  for (const r of rows) out.set(r.userId, Number(r.available));
  return out;
}

export async function jobCountsForUsers(userIds: string[]): Promise<Map<string, { total: number; succeeded: number }>> {
  const out = new Map<string, { total: number; succeeded: number }>();
  if (userIds.length === 0) return out;
  const rows = await db
    .select({
      userId: jobs.userId,
      total: count(),
      succeeded: sql<number>`coalesce(sum(case when ${jobs.status} = 'succeeded' then 1 else 0 end), 0)::int`,
    })
    .from(jobs)
    .where(inArray(jobs.userId, userIds))
    .groupBy(jobs.userId);
  for (const r of rows) out.set(r.userId, { total: Number(r.total), succeeded: Number(r.succeeded) });
  return out;
}

export interface JobLedger {
  reserved: number;
  debited: number;
  released: number;
  /** Credits are still held by this job (reserved, neither debited nor released). */
  holding: boolean;
}

/** Where each job's credits stand, from the ledger (the source of truth for retry/release decisions). */
export async function ledgerForJobs(jobIds: string[]): Promise<Map<string, JobLedger>> {
  const out = new Map<string, JobLedger>();
  if (jobIds.length === 0) return out;
  const rows = await db
    .select({ jobId: creditEvents.jobId, kind: creditEvents.kind, amount: creditEvents.amount })
    .from(creditEvents)
    .where(inArray(creditEvents.jobId, jobIds));
  for (const r of rows) {
    if (!r.jobId) continue;
    const l = out.get(r.jobId) ?? { reserved: 0, debited: 0, released: 0, holding: false };
    if (r.kind === "reserve") l.reserved += r.amount;
    else if (r.kind === "debit") l.debited += r.amount;
    else if (r.kind === "release") l.released += r.amount;
    out.set(r.jobId, l);
  }
  for (const l of out.values()) l.holding = l.reserved > 0 && l.debited === 0 && l.released === 0;
  return out;
}

export async function emailsForUsers(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (userIds.length === 0) return out;
  const rows = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, userIds));
  for (const r of rows) out.set(r.id, r.email);
  return out;
}

/** The operational keys live with their writers in src/lib/app-state.ts; re-exported for the admin pages. */
export { APP_STATE_KEYS, getAppState as appStateEntry } from "@/lib/app-state";

export async function allAppState(): Promise<{ key: string; value: unknown; updatedAt: Date }[]> {
  return db.select().from(appState).orderBy(desc(appState.updatedAt)).limit(50);
}
