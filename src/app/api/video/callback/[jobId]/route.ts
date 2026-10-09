import { captureError } from "@/lib/errors";
import { rateLimit } from "@/lib/ratelimit";
import { handleCallback, verifyCallbackToken } from "@/lib/video/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BODY = 256 * 1024;

/**
 * Provider completion webhook: `?t=` is HMAC-SHA256(jobId, exp) under VIDEO_CALLBACK_SECRET and
 * `?exp=` its expiry, both minted when the job was dispatched. The body is only a hint; the
 * job is re-polled through the provider.
 */
export async function POST(req: Request, ctx: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await ctx.params;
  try {
    if (!/^job_[a-z0-9]{1,32}$/.test(jobId)) return Response.json({ error: "not found" }, { status: 404 });
    const query = new URL(req.url).searchParams;
    let valid = false;
    try {
      valid = verifyCallbackToken(jobId, query.get("t"), query.get("exp"));
    } catch (err) {
      // VIDEO_CALLBACK_SECRET missing: refuse (the cron still completes the job) and make it visible.
      await captureError(err, { route: "/api/video/callback", severity: "warn" });
      valid = false;
    }
    if (!valid) return Response.json({ error: "unauthorized" }, { status: 401 });

    const rl = await rateLimit(`vcb:${jobId}`, 30, 600);
    if (!rl.ok) return Response.json({ error: "too many callbacks" }, { status: 429, headers: { "Retry-After": String(rl.resetIn) } });

    const raw = await req.text().catch(() => "");
    let payload: unknown = null;
    if (raw && raw.length <= MAX_BODY) {
      try {
        payload = JSON.parse(raw);
      } catch {
        payload = null; // a non-JSON ping still triggers a re-poll
      }
    }
    const job = await handleCallback(jobId, payload);
    if (!job) return Response.json({ error: "not found" }, { status: 404 });
    return Response.json({ ok: true, status: job.status }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    await captureError(err, { route: "/api/video/callback", context: { jobId } });
    // 500 makes the provider retry its webhook, which is what we want for a transient failure.
    return Response.json({ error: "callback failed" }, { status: 500 });
  }
}
