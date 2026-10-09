import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { appState } from "@/lib/db/schema";

/*
 * Small key → JSON store for operational state (last cron run, last reconcile report…).
 * One upsert helper so every writer is idempotent and the admin pages read known keys.
 */

/** Keys the operational jobs write; the admin overview and diagnostics pages read them. */
export const APP_STATE_KEYS = {
  /** Full ReconcileReport of the last run (src/lib/reconcile.ts). */
  reconcile: "reconcile:last",
  /** {ranAt, tookMs, polled, expired, failed} of the last /api/cron/jobs tick. */
  cronJobs: "cron:jobs:last",
  /** {ranAt, tookMs, checked, repaired, failed} of the last /api/cron/reconcile run. */
  cronReconcile: "cron:reconcile:last",
} as const;

export type AppStateKey = (typeof APP_STATE_KEYS)[keyof typeof APP_STATE_KEYS];

export async function setAppState(key: AppStateKey, value: unknown): Promise<void> {
  await db
    .insert(appState)
    .values({ key, value })
    .onConflictDoUpdate({ target: appState.key, set: { value, updatedAt: sql`now()` } });
}

export async function getAppState(key: string): Promise<{ value: unknown; updatedAt: Date } | null> {
  const rows = await db.select({ value: appState.value, updatedAt: appState.updatedAt }).from(appState).where(eq(appState.key, key)).limit(1);
  return rows[0] ?? null;
}
