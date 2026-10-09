import "server-only";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "./db";
import { assets } from "./db/schema";
import { captureError } from "./errors";
import { deleteObject } from "./files";

/** A pending upload older than this never had its /complete call: the row and any object go. */
export const ABANDONED_UPLOAD_MS = 60 * 60 * 1000;

/**
 * Removes uploads that were signed but never completed (closed tab, lost connection, or a
 * client that only ever signs). Runs from the jobs cron tick; the signed PUT link has long
 * expired by the time a row qualifies, so nothing can land in a deleted slot afterwards.
 */
export async function sweepAbandonedUploads(limit = 100): Promise<{ removed: number; failed: number }> {
  const stale = await db
    .select({ id: assets.id, objectKey: assets.objectKey })
    .from(assets)
    .where(and(eq(assets.status, "pending"), lt(assets.createdAt, sql`now() - make_interval(secs => ${ABANDONED_UPLOAD_MS / 1000})`)))
    .limit(limit);
  let removed = 0;
  let failed = 0;
  for (const row of stale) {
    try {
      await deleteObject(row.objectKey);
      await db.delete(assets).where(and(eq(assets.id, row.id), eq(assets.status, "pending")));
      removed++;
    } catch (err) {
      failed++;
      await captureError(err, { route: "uploads/sweep", source: "cron", severity: "warn", context: { assetId: row.id } });
    }
  }
  return { removed, failed };
}
