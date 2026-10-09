import { bearerMatches } from "@/lib/admin";
import { APP_STATE_KEYS, setAppState } from "@/lib/app-state";
import { env } from "@/lib/env";
import { captureError } from "@/lib/errors";
import { notifyOwner } from "@/lib/notify";
import { needsAttention, reconcile } from "@/lib/reconcile";
import { stripeMode } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" } as const;

/**
 * Daily (Vercel Cron / GitHub Actions, Bearer CRON_SECRET) or on demand: Stripe paid vs
 * database granted over the last `?days=` (default 7, max 90), with repairs. The last
 * report is kept in app_state for the admin diagnostics page.
 */
async function run(req: Request): Promise<Response> {
  if (!bearerMatches(req, env("CRON_SECRET"))) return Response.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
  if (stripeMode() === "missing") return Response.json({ error: "Stripe is not configured" }, { status: 503, headers: NO_STORE });
  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") ?? 7) || 7));
  const startedAt = Date.now();
  try {
    const report = await reconcile(days);
    const failed = [...report.sessions.failed, ...report.invoices.failed, ...report.subscriptions.failed];
    const repaired = [...report.sessions.repaired, ...report.invoices.repaired];
    // The full report for the diagnostics page, plus the one-line run summary the overview shows.
    await setAppState(APP_STATE_KEYS.reconcile, report);
    await setAppState(APP_STATE_KEYS.cronReconcile, {
      ranAt: report.ranAt,
      tookMs: Date.now() - startedAt,
      days,
      checked: report.sessions.scanned + report.invoices.scanned + report.subscriptions.scanned,
      repaired,
      failed,
    });
    if (needsAttention(report)) {
      await notifyOwner({ subject: "Reconcile found differences", text: JSON.stringify(report, null, 2) });
    }
    return Response.json(report, { status: failed.length ? 409 : 200, headers: NO_STORE });
  } catch (err) {
    await captureError(err, { route: "/api/cron/reconcile", source: "cron" });
    try {
      await setAppState(APP_STATE_KEYS.cronReconcile, { ranAt: new Date(startedAt).toISOString(), tookMs: Date.now() - startedAt, error: err instanceof Error ? err.message : String(err) });
    } catch (stateErr) {
      await captureError(stateErr, { route: "/api/cron/reconcile", source: "cron", severity: "warn" });
    }
    return Response.json({ error: "reconcile failed" }, { status: 500, headers: NO_STORE });
  }
}

export const POST = run;
/** Vercel Cron calls with GET; same auth, same job. */
export const GET = run;
