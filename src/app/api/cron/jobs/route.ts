import { bearerMatches } from "@/lib/admin";
import { APP_STATE_KEYS, setAppState } from "@/lib/app-state";
import { env } from "@/lib/env";
import { captureError } from "@/lib/errors";
import { sweepAbandonedUploads } from "@/lib/uploads";
import { runJobsTick } from "@/lib/video/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Every minute (vercel.json crons, Vercel sends `Authorization: Bearer CRON_SECRET`):
 * expires jobs older than two hours, dispatches `awaiting_engine` jobs once an engine is
 * configured, polls every queued/running job and sweeps uploads that were signed but never
 * completed. Vercel Cron calls GET; POST is for ops.
 * The run summary is kept in app_state for the admin diagnostics page.
 */
async function tick(req: Request): Promise<Response> {
  if (!bearerMatches(req, env("CRON_SECRET"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const startedAt = Date.now();
  try {
    const report = await runJobsTick();
    const uploads = await sweepAbandonedUploads();
    await setAppState(APP_STATE_KEYS.cronJobs, {
      ranAt: new Date(startedAt).toISOString(),
      tookMs: Date.now() - startedAt,
      polled: report.advanced,
      expired: report.expired.length,
      failed: report.failed,
      uploadsSwept: uploads.removed,
    });
    return Response.json({ ...report, uploads }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    await captureError(err, { route: "/api/cron/jobs", source: "cron" });
    try {
      await setAppState(APP_STATE_KEYS.cronJobs, { ranAt: new Date(startedAt).toISOString(), tookMs: Date.now() - startedAt, error: err instanceof Error ? err.message : String(err) });
    } catch (stateErr) {
      await captureError(stateErr, { route: "/api/cron/jobs", source: "cron", severity: "warn" });
    }
    return Response.json({ error: "jobs tick failed" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return tick(req);
}

export async function POST(req: Request) {
  return tick(req);
}
