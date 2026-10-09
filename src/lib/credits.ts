import "server-only";
import { and, asc, desc, eq, gt, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "./db";
import { creditEvents, creditLots, type CreditEventKind, type CreditLotRow, type LotKind } from "./db/schema";
import { newId } from "./ids";
import { costFor, OFFERS, TRIAL, type Sku } from "@/content/plans";

export { costFor };

/*
 * The ONLY module that touches credit_lots / credit_events. This is money, so the rules
 * are spelled out here and nowhere else:
 *
 *  - A lot is a batch of credits with one expiry. `remaining` is decremented the moment a
 *    job reserves and restored only by a release; a debit changes nothing on the lot (the
 *    reservation already took the credits), it is the ledger entry that says "spent".
 *  - Reservations take from the earliest-expiring active lot first (FIFO by expires_at).
 *  - Every movement is an append-only credit_events row. A job touches each lot at most
 *    once per kind (unique index on job_id+lot_id+kind), so reserve/settle/release can be
 *    replayed by a retry, a callback and the cron at the same time without double counting.
 *  - Neon HTTP has no interactive transactions. Lot updates are conditional UPDATEs
 *    (`remaining >= take`) so two concurrent reservations can never overdraw a lot; a
 *    reservation that cannot be completed is unwound.
 *  - Grants are idempotent on `source_key`. Failed generations never cost credits.
 */

export interface Lot {
  id: string;
  kind: LotKind;
  total: number;
  remaining: number;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface Balance {
  /** Credits a new job can reserve right now. */
  available: number;
  /** Credits held by jobs still generating. */
  reserved: number;
  lots: Lot[];
}

export type ReserveResult = { ok: true; amount: number } | { ok: false; reason: "insufficient" | "invalid-amount"; available: number; needed: number };

/* ------------------------------------------------------------------ pure helpers (unit-tested) */

export function isUsable(lot: Pick<Lot, "remaining" | "expiresAt"> & { status?: string }, now: Date = new Date()): boolean {
  if (lot.status && lot.status !== "active") return false;
  if (lot.remaining <= 0) return false;
  if (lot.expiresAt && lot.expiresAt.getTime() <= now.getTime()) return false;
  return true;
}

/** Lots a reservation may draw from, earliest expiry first (never-expiring lots last), then oldest first. */
export function orderForDebit<T extends Pick<Lot, "remaining" | "expiresAt" | "createdAt"> & { status?: string }>(lots: T[], now: Date = new Date()): T[] {
  return lots
    .filter((l) => isUsable(l, now))
    .sort((a, b) => {
      const ea = a.expiresAt ? a.expiresAt.getTime() : Number.POSITIVE_INFINITY;
      const eb = b.expiresAt ? b.expiresAt.getTime() : Number.POSITIVE_INFINITY;
      if (ea !== eb) return ea - eb;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
}

export function sumAvailable(lots: (Pick<Lot, "remaining" | "expiresAt"> & { status?: string })[], now: Date = new Date()): number {
  return lots.reduce((n, l) => (isUsable(l, now) ? n + l.remaining : n), 0);
}

/** How a reservation of `amount` is split across lots, or null when the lots cannot cover it. */
export function planReservation<T extends Pick<Lot, "id" | "remaining" | "expiresAt" | "createdAt"> & { status?: string }>(
  lots: T[],
  amount: number,
  now: Date = new Date(),
): { lotId: string; take: number }[] | null {
  if (!Number.isInteger(amount) || amount <= 0) return null;
  const plan: { lotId: string; take: number }[] = [];
  let needed = amount;
  for (const lot of orderForDebit(lots, now)) {
    if (needed === 0) break;
    const take = Math.min(lot.remaining, needed);
    plan.push({ lotId: lot.id, take });
    needed -= take;
  }
  return needed === 0 ? plan : null;
}

/** `remaining` rebuilt from the ledger: total − reserved + released (debits mirror reserves and move nothing). */
export function remainingFromEvents(total: number, events: { kind: CreditEventKind; amount: number }[]): number {
  let remaining = total;
  for (const e of events) {
    if (e.kind === "reserve") remaining -= e.amount;
    else if (e.kind === "release") remaining += e.amount;
  }
  return Math.max(0, Math.min(total, remaining));
}

/** When credits bought under `sku` stop being usable. Plans: period end (+ rollover); packs: purchase + validity. */
export function lotExpiryFor(sku: Sku, input: { periodEnd?: Date; purchasedAt?: Date }): Date {
  const offer = OFFERS[sku];
  const DAY = 24 * 60 * 60 * 1000;
  if (offer.interval === "month") {
    if (!input.periodEnd) throw new Error(`periodEnd is required for the ${sku} plan`);
    return new Date(input.periodEnd.getTime() + offer.rolloverDays * DAY);
  }
  const bought = input.purchasedAt ?? new Date();
  return new Date(bought.getTime() + offer.rolloverDays * DAY);
}

export function trialExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + TRIAL.expiryDays * 24 * 60 * 60 * 1000);
}

export function trialSourceKey(userId: string): string {
  return `trial:${userId}`;
}

/* ------------------------------------------------------------------ reads */

function toLot(r: CreditLotRow): Lot {
  return { id: r.id, kind: r.kind, total: r.total, remaining: r.remaining, expiresAt: r.expiresAt, createdAt: r.createdAt };
}

async function activeLots(userId: string): Promise<CreditLotRow[]> {
  return db
    .select()
    .from(creditLots)
    .where(and(eq(creditLots.userId, userId), eq(creditLots.status, "active"), or(isNull(creditLots.expiresAt), gt(creditLots.expiresAt, sql`now()`))))
    .orderBy(asc(creditLots.expiresAt), asc(creditLots.createdAt));
}

export async function getBalance(userId: string): Promise<Balance> {
  const [lots, held] = await Promise.all([
    activeLots(userId),
    db
      .select({
        reserved: sql<number>`coalesce(sum(case when ${creditEvents.kind} = 'reserve' then ${creditEvents.amount} when ${creditEvents.kind} in ('debit','release') then -${creditEvents.amount} else 0 end), 0)::int`,
      })
      .from(creditEvents)
      .where(eq(creditEvents.userId, userId)),
  ]);
  const usable = lots.map(toLot);
  return { available: sumAvailable(usable), reserved: Math.max(0, Number(held[0]?.reserved ?? 0)), lots: usable };
}

/** Every lot the user ever had, newest first, for the billing page. */
export async function listLots(userId: string): Promise<(Lot & { status: string; sourceKey: string })[]> {
  const rows = await db.select().from(creditLots).where(eq(creditLots.userId, userId)).orderBy(desc(creditLots.createdAt)).limit(100);
  return rows.map((r) => ({ ...toLot(r), status: r.status, sourceKey: r.sourceKey }));
}

export async function listEvents(userId: string, limit = 50) {
  return db.select().from(creditEvents).where(eq(creditEvents.userId, userId)).orderBy(desc(creditEvents.createdAt)).limit(limit);
}

async function eventsForJob(jobId: string) {
  return db.select().from(creditEvents).where(eq(creditEvents.jobId, jobId));
}

/* ------------------------------------------------------------------ writes */

async function insertEvent(input: { userId: string; lotId: string; jobId: string | null; kind: CreditEventKind; amount: number }): Promise<boolean> {
  const rows = await db
    .insert(creditEvents)
    .values({ id: newId("cev"), ...input })
    .onConflictDoNothing()
    .returning({ id: creditEvents.id });
  return rows.length > 0;
}

/** Conditional decrement: succeeds only if the lot is still active, unexpired and holds `take`. */
async function takeFromLot(lotId: string, take: number): Promise<boolean> {
  const rows = await db
    .update(creditLots)
    .set({ remaining: sql`${creditLots.remaining} - ${take}` })
    .where(
      and(
        eq(creditLots.id, lotId),
        eq(creditLots.status, "active"),
        sql`${creditLots.remaining} >= ${take}`,
        or(isNull(creditLots.expiresAt), gt(creditLots.expiresAt, sql`now()`)),
      ),
    )
    .returning({ id: creditLots.id });
  return rows.length > 0;
}

/** How long a lot that expired while a job held its credits stays usable after the release. */
export const RELEASE_GRACE_DAYS = 7;

/**
 * Puts credits back, never above the lot's total (a revoked lot stays at 0). A lot that
 * expired while the job was running comes back holding exactly the released credits, usable
 * for a grace period: "failed generations never cost credits" must hold at the end of a
 * billing period too. Whatever else was left in the expired lot stays expired.
 */
async function giveBackToLot(lotId: string, amount: number): Promise<void> {
  const expired = sql`${creditLots.expiresAt} is not null and ${creditLots.expiresAt} <= now()`;
  await db
    .update(creditLots)
    .set({
      remaining: sql`least(${creditLots.total}, case when ${expired} then ${amount} else ${creditLots.remaining} + ${amount} end)`,
      expiresAt: sql`case when ${expired} then now() + make_interval(days => ${RELEASE_GRACE_DAYS}) else ${creditLots.expiresAt} end`,
    })
    .where(and(eq(creditLots.id, lotId), eq(creditLots.status, "active")));
}

/**
 * Holds `amount` credits for a job. Idempotent per job: a second call with the same jobId
 * returns ok without taking anything more. On a shortfall nothing is held.
 */
export async function reserve(input: { userId: string; jobId: string; amount: number }): Promise<ReserveResult> {
  const { userId, jobId, amount } = input;
  if (!Number.isInteger(amount) || amount <= 0) return { ok: false, reason: "invalid-amount", available: 0, needed: amount };

  const existing = await eventsForJob(jobId);
  const already = existing.filter((e) => e.kind === "reserve").reduce((n, e) => n + e.amount, 0);
  if (already > 0) return { ok: true, amount: already };

  // Up to three passes: a concurrent reservation may drain a lot between planning and taking.
  for (let attempt = 0; attempt < 3; attempt++) {
    const lots = (await activeLots(userId)).map(toLot);
    const plan = planReservation(lots, amount);
    if (!plan) return { ok: false, reason: "insufficient", available: sumAvailable(lots), needed: amount };

    const taken: { lotId: string; take: number }[] = [];
    let complete = true;
    for (const step of plan) {
      const ok = await takeFromLot(step.lotId, step.take);
      if (!ok) {
        complete = false;
        break;
      }
      const recorded = await insertEvent({ userId, lotId: step.lotId, jobId, kind: "reserve", amount: step.take });
      if (!recorded) {
        // Another call reserved this job on this lot a moment ago: give our take back and let it win.
        await giveBackToLot(step.lotId, step.take);
        complete = false;
        break;
      }
      taken.push(step);
    }
    if (complete) return { ok: true, amount };

    // Unwind the partial hold, then look again.
    for (const step of taken) {
      await db.delete(creditEvents).where(and(eq(creditEvents.jobId, jobId), eq(creditEvents.lotId, step.lotId), eq(creditEvents.kind, "reserve")));
      await giveBackToLot(step.lotId, step.take);
    }
    const retry = await eventsForJob(jobId);
    const other = retry.filter((e) => e.kind === "reserve").reduce((n, e) => n + e.amount, 0);
    if (other > 0) return { ok: true, amount: other };
  }
  const lots = (await activeLots(userId)).map(toLot);
  return { ok: false, reason: "insufficient", available: sumAvailable(lots), needed: amount };
}

/** The job succeeded: turn its reservation into a debit. Idempotent; a no-op without a reservation. */
export async function settle(jobId: string): Promise<{ debited: number }> {
  const events = await eventsForJob(jobId);
  if (events.some((e) => e.kind === "release")) return { debited: 0 };
  let debited = 0;
  for (const r of events.filter((e) => e.kind === "reserve")) {
    const inserted = await insertEvent({ userId: r.userId, lotId: r.lotId, jobId, kind: "debit", amount: r.amount });
    if (inserted) debited += r.amount;
  }
  return { debited };
}

/** The job failed, expired or was cancelled: give the reservation back. Idempotent; never after a debit. */
export async function release(jobId: string): Promise<{ released: number }> {
  const events = await eventsForJob(jobId);
  if (events.some((e) => e.kind === "debit")) return { released: 0 };
  let released = 0;
  for (const r of events.filter((e) => e.kind === "reserve")) {
    const inserted = await insertEvent({ userId: r.userId, lotId: r.lotId, jobId, kind: "release", amount: r.amount });
    if (!inserted) continue;
    await giveBackToLot(r.lotId, r.amount);
    released += r.amount;
  }
  return { released };
}

export interface GrantInput {
  userId: string;
  kind: LotKind;
  total: number;
  /** Idempotency key: checkout session id, `subscriptionId:periodStart`, `trial:<userId>`, `adjust:<reason>`. */
  sourceKey: string;
  expiresAt: Date | null;
  orderId?: string | null;
}

/** Creates a lot once per sourceKey. Returns the lot and whether this call created it. */
export async function grantLot(input: GrantInput): Promise<{ lot: Lot; created: boolean }> {
  if (!Number.isInteger(input.total) || input.total <= 0) throw new Error("a credit grant must be a positive whole number");
  const id = newId("lot");
  const inserted = await db
    .insert(creditLots)
    .values({
      id,
      userId: input.userId,
      kind: input.kind,
      total: input.total,
      remaining: input.total,
      status: "active",
      sourceKey: input.sourceKey,
      orderId: input.orderId ?? null,
      expiresAt: input.expiresAt,
    })
    .onConflictDoNothing({ target: creditLots.sourceKey })
    .returning();
  if (inserted[0]) {
    await insertEvent({ userId: input.userId, lotId: id, jobId: null, kind: "grant", amount: input.total });
    return { lot: toLot(inserted[0]), created: true };
  }
  const rows = await db.select().from(creditLots).where(eq(creditLots.sourceKey, input.sourceKey)).limit(1);
  const existing = rows[0];
  if (!existing) throw new Error(`credit lot ${input.sourceKey} was not persisted`);
  if (existing.userId !== input.userId) throw new Error(`credit lot ${input.sourceKey} belongs to another user`);
  // The invoice webhook may land before the checkout session is recorded: link the lot to its order now.
  if (input.orderId && !existing.orderId) {
    await db.update(creditLots).set({ orderId: input.orderId }).where(and(eq(creditLots.id, existing.id), isNull(creditLots.orderId)));
  }
  return { lot: toLot(existing), created: false };
}

/** Refund or open dispute: the lot's unspent credits are gone. Jobs already generating keep their hold. */
export async function revokeLot(sourceKey: string): Promise<{ revoked: number } | null> {
  const rows = await db
    .update(creditLots)
    .set({ status: "revoked", remaining: 0 })
    .where(and(eq(creditLots.sourceKey, sourceKey), eq(creditLots.status, "active")))
    .returning({ id: creditLots.id, userId: creditLots.userId, total: creditLots.total });
  const row = rows[0];
  if (!row) return null;
  // The amount lost is what the ledger says was still unspent (RETURNING shows the post-update row).
  const events = await db.select({ kind: creditEvents.kind, amount: creditEvents.amount }).from(creditEvents).where(eq(creditEvents.lotId, row.id));
  const remaining = remainingFromEvents(row.total, events);
  await insertEvent({ userId: row.userId, lotId: row.id, jobId: null, kind: "revoke", amount: remaining });
  return { revoked: remaining };
}

/** Dispute won: the lot comes back with whatever the ledger says is still unspent. */
export async function restoreLot(sourceKey: string): Promise<{ restored: number } | null> {
  const rows = await db.select().from(creditLots).where(and(eq(creditLots.sourceKey, sourceKey), eq(creditLots.status, "revoked"))).limit(1);
  const lot = rows[0];
  if (!lot) return null;
  const events = await db.select({ kind: creditEvents.kind, amount: creditEvents.amount }).from(creditEvents).where(eq(creditEvents.lotId, lot.id));
  const remaining = remainingFromEvents(lot.total, events);
  await db.update(creditLots).set({ status: "active", remaining }).where(and(eq(creditLots.id, lot.id), eq(creditLots.status, "revoked")));
  await insertEvent({ userId: lot.userId, lotId: lot.id, jobId: null, kind: "grant", amount: remaining });
  return { restored: remaining };
}

/** Two 480p credits on the first sign-in, valid 30 days. Idempotent per user. */
export async function grantTrial(userId: string): Promise<{ lot: Lot; created: boolean }> {
  return grantLot({ userId, kind: "trial", total: TRIAL.credits, sourceKey: trialSourceKey(userId), expiresAt: trialExpiry() });
}

/** True when every credit the user holds comes from the trial lot (used to cap resolution at 480p). */
export async function onlyTrialCredits(userId: string): Promise<boolean> {
  const lots = await activeLots(userId);
  const usable = lots.filter((l) => isUsable(l));
  return usable.length > 0 && usable.every((l) => l.kind === "trial");
}

/** Jobs in flight for the parallel-jobs limit: counted from the ledger so it cannot drift from job status. */
export async function jobsHoldingCredits(userId: string): Promise<string[]> {
  const rows = await db
    .select({ jobId: creditEvents.jobId, kind: creditEvents.kind })
    .from(creditEvents)
    .where(and(eq(creditEvents.userId, userId), inArray(creditEvents.kind, ["reserve", "debit", "release"])));
  const open = new Set<string>();
  const closed = new Set<string>();
  for (const r of rows) {
    if (!r.jobId) continue;
    if (r.kind === "reserve") open.add(r.jobId);
    else closed.add(r.jobId);
  }
  return [...open].filter((id) => !closed.has(id));
}
