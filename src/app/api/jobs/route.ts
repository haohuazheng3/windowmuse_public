import { z } from "zod";
import { withErrorCapture } from "@/lib/errors";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { isResponse, requireUserApi } from "@/lib/user";
import { createJob, JobError, listJobs } from "@/lib/video/jobs";
import { RESOLUTIONS } from "@/content/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const Body = z.object({
  productId: z.string().trim().min(1).max(64),
  scriptId: z.string().trim().min(1).max(64),
  presenterId: z.string().trim().min(1).max(64),
  resolution: z.enum(RESOLUTIONS),
  durationSec: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
});

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Reserves credits and sends the job to the engine (or parks it when none is configured). */
export const POST = withErrorCapture("/api/jobs", async (req: Request) => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  const rl = await rateLimit(`jobs:${session.userId}`, 30, 3600);
  if (!rl.ok) return tooMany(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a product, script, presenter, resolution and length." }, { status: 400, headers: NO_STORE });

  try {
    const job = await createJob({ userId: session.userId, ...parsed.data });
    return Response.json({ job }, { status: 201, headers: NO_STORE });
  } catch (err) {
    if (err instanceof JobError) {
      return Response.json({ error: err.message, code: err.code, ...(err.detail ?? {}) }, { status: err.status, headers: NO_STORE });
    }
    throw err;
  }
});

/** The seller's generations, newest first. */
export const GET = withErrorCapture("/api/jobs", async () => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;
  const jobs = await listJobs(session.userId);
  return Response.json({ jobs }, { headers: NO_STORE });
});
