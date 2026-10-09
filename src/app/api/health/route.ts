import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { bearerMatches } from "@/lib/admin";
import { db } from "@/lib/db";
import { errorGroups } from "@/lib/db/schema";
import { env, features, missingEnv, REQUIRED_ENV, VERCEL_ENV } from "@/lib/env";
import { captureError, HEALTH_SOURCES } from "@/lib/errors";
import { stripeMode } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Self-diagnosis. Non-200 when the database is unreachable, a required variable is missing,
 * or the error inbox holds unresolved errors of severity "error" raised by our own code
 * (server, edge, worker, cron; anonymous browser reports never count). Optional features
 * (video engine, AI writer) are reported, not required.
 *
 * The public answer carries booleans and counts only. Names of missing variables, the
 * commit and the database error text are returned only to a caller that presents
 * `Authorization: Bearer CRON_SECRET` (the admin page shows the same detail signed in).
 */
export async function GET(req: Request) {
  const started = Date.now();
  const detailed = bearerMatches(req, env("CRON_SECRET"));
  let dbOk = false;
  let dbMs = 0;
  let unresolved = -1;
  let dbError: string | undefined;
  try {
    const t = Date.now();
    const rows = await db
      .select({ n: count() })
      .from(errorGroups)
      .where(and(isNull(errorGroups.resolvedAt), eq(errorGroups.severity, "error"), inArray(errorGroups.source, [...HEALTH_SOURCES])));
    dbMs = Date.now() - t;
    dbOk = true;
    unresolved = Number(rows[0]?.n ?? 0);
  } catch (e) {
    dbError = e instanceof Error ? e.message.slice(0, 200) : "unknown";
    // The inbox lives in the same database, so this lands in the platform logs (and in the inbox once it is back).
    await captureError(e, { route: "/api/health", severity: "warn", context: { stage: "db" } });
  }

  const missing = missingEnv();
  const f = features();
  const ok = dbOk && missing.length === 0 && unresolved === 0;
  const body = {
    ok,
    env: VERCEL_ENV,
    time: new Date().toISOString(),
    db: { ok: dbOk, ms: dbMs, ...(detailed && dbError ? { error: dbError } : {}) },
    config: { required: REQUIRED_ENV.length, missingCount: missing.length, ...(detailed ? { missing } : {}) },
    stripe: { mode: stripeMode() },
    features: { videoEngine: f.videoEngine, aiWriter: f.aiWriter ? "claude" : "template" },
    errors: { unresolvedSevere: unresolved },
    ...(detailed ? { commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12) } : {}),
    tookMs: Date.now() - started,
  };
  return Response.json(body, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" } });
}
