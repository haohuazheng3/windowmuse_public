import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db";
import { appState, errorGroups } from "./db/schema";
import { IS_PRODUCTION_DEPLOY } from "./env";
import { notifyOwner } from "./notify";
import { SITE } from "./site";
import { formatDigest, utcDay } from "./error-digest-format";

/** app_state row that remembers the UTC day of the last digest, so a day never gets two. */
export const DIGEST_STATE_KEY = "digest:errors:last";
const TOP_ITEMS = 10;

export type DigestResult = { sent: boolean; reason: "sent" | "no-open-errors" | "already-sent-today" | "not-production" | "notify-failed"; open: number };

/**
 * Daily digest of open errors (severity "error", unresolved), at most one email per UTC day and
 * none when the inbox is clear. Called from the daily reconcile cron (Vercel Cron 03:17 UTC, and
 * the GitHub Actions run later the same day finds the day already claimed). Read-only on
 * error_groups: nothing is resolved or modified here.
 */
export async function sendErrorDigest(now: Date = new Date()): Promise<DigestResult> {
  if (!IS_PRODUCTION_DEPLOY) return { sent: false, reason: "not-production", open: 0 };
  const open = and(isNull(errorGroups.resolvedAt), eq(errorGroups.severity, "error"));
  const [errs, warns, top] = await Promise.all([
    db.select({ n: count() }).from(errorGroups).where(open),
    db.select({ n: count() }).from(errorGroups).where(and(isNull(errorGroups.resolvedAt), eq(errorGroups.severity, "warn"))),
    db
      .select({
        name: errorGroups.name,
        message: errorGroups.message,
        source: errorGroups.source,
        route: errorGroups.route,
        count: errorGroups.count,
        firstSeen: errorGroups.firstSeen,
        lastSeen: errorGroups.lastSeen,
      })
      .from(errorGroups)
      .where(open)
      .orderBy(desc(errorGroups.lastSeen))
      .limit(TOP_ITEMS),
  ]);
  const openErrors = Number(errs[0]?.n ?? 0);
  if (openErrors === 0) return { sent: false, reason: "no-open-errors", open: 0 };

  // Claim today in one statement (no interactive transactions on Neon HTTP): the upsert only
  // writes, and only returns a row, when the stored day differs from today.
  const day = utcDay(now);
  const claimed = await db
    .insert(appState)
    .values({ key: DIGEST_STATE_KEY, value: { day } })
    .onConflictDoUpdate({
      target: appState.key,
      set: { value: { day }, updatedAt: sql`now()` },
      setWhere: sql`${appState.value}->>'day' is distinct from ${day}`,
    })
    .returning({ key: appState.key });
  if (claimed.length === 0) return { sent: false, reason: "already-sent-today", open: openErrors };

  const { subject, text } = formatDigest({ day, openErrors, openWarnings: Number(warns[0]?.n ?? 0), items: top, inboxUrl: `${SITE.url}/admin/errors` });
  const ok = await notifyOwner({ subject, text });
  if (!ok) {
    // Give the day back so the next cron run today (GitHub Actions) tries again.
    await db.update(appState).set({ value: { day: `failed:${day}` }, updatedAt: sql`now()` }).where(eq(appState.key, DIGEST_STATE_KEY));
    return { sent: false, reason: "notify-failed", open: openErrors };
  }
  return { sent: true, reason: "sent", open: openErrors };
}
