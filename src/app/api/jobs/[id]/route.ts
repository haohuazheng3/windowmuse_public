import { withErrorCapture } from "@/lib/errors";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { isResponse, requireUserApi } from "@/lib/user";
import { pollJob } from "@/lib/video/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * The job page polls this every 5 s. Besides answering, it nudges an active job forward
 * (throttled inside advanceJob), so development without the Vercel cron still completes jobs.
 */
export const GET = withErrorCapture("/api/jobs/[id]", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  const rl = await rateLimit(`jobpoll:${session.userId}`, 600, 600);
  if (!rl.ok) return tooMany(rl);

  const { id } = await ctx.params;
  if (!/^job_[a-z0-9]{1,32}$/.test(id)) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  const job = await pollJob(session.userId, id);
  if (!job) return Response.json({ error: "not found" }, { status: 404, headers: NO_STORE });
  return Response.json({ job }, { headers: NO_STORE });
});
