"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { contactMessages, errorGroups, jobs } from "@/lib/db/schema";
import { captureError } from "@/lib/errors";
import { cancelJob, markJobFailed as failJob, OPEN_STATUSES, requeueJob, RETRYABLE_STATUSES } from "@/lib/video/jobs";
import { ledgerForJobs } from "./_data";

/*
 * Operator overrides for the admin area. Every action re-checks the admin session, validates
 * its input, and is idempotent: a double submit finds the row already in the target state and
 * does nothing. Credits move only through src/lib/credits.ts, and job status only through
 * src/lib/video/jobs.ts (cancelJob / markJobFailed / requeueJob are its operator levers).
 */

const JobForm = z.object({
  id: z.string().regex(/^job_[0-9a-z]{8,32}$/),
  back: z.string().max(200).optional(),
});

export type JobNotice =
  | "retry-queued"
  | "retry-refused-status"
  | "retry-refused-credits"
  | "released"
  | "release-noop"
  | "failed"
  | "fail-noop"
  | "not-found"
  | "invalid";

/** Which filter the admin was looking at, so the redirect lands back on the same list. */
function backQuery(raw: string | undefined): URLSearchParams {
  const out = new URLSearchParams();
  if (!raw) return out;
  const sp = new URLSearchParams(raw);
  for (const key of ["status", "user"]) {
    const v = sp.get(key);
    if (v && /^[A-Za-z0-9_-]{1,64}$/.test(v)) out.set(key, v);
  }
  return out;
}

function backTo(raw: string | undefined, notice: JobNotice): never {
  const q = backQuery(raw);
  q.set("notice", notice);
  revalidatePath("/admin/jobs");
  revalidatePath("/admin");
  redirect(`/admin/jobs?${q.toString()}`);
}

function parseJobForm(formData: FormData): z.infer<typeof JobForm> | null {
  const parsed = JobForm.safeParse({
    id: String(formData.get("id") ?? ""),
    back: typeof formData.get("back") === "string" ? String(formData.get("back")) : undefined,
  });
  return parsed.success ? parsed.data : null;
}

async function loadJob(id: string) {
  const rows = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
  return rows[0] ?? null;
}

/**
 * Re-dispatch a job that failed or got stuck. The reservation must still be held (a job
 * whose credits were released or debited cannot be re-run without a new reservation; the
 * user creates a new job for that). jobs.requeueJob puts it back in the queue and dispatches
 * it right away; if that dispatch fails the cron (`/api/cron/jobs`) retries on its next tick.
 */
export async function retryJob(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = parseJobForm(formData);
  if (!input) backTo(undefined, "invalid");
  const job = await loadJob(input.id);
  if (!job) backTo(input.back, "not-found");
  if (!RETRYABLE_STATUSES.includes(job.status)) backTo(input.back, "retry-refused-status");
  const ledger = (await ledgerForJobs([job.id])).get(job.id);
  if (!ledger?.holding) backTo(input.back, "retry-refused-credits");

  const queued = await requeueJob(job.id);
  if (!queued) backTo(input.back, "retry-refused-status"); // changed under us
  backTo(input.back, "retry-queued");
}

/** Give the reservation back and cancel the job. Safe to repeat: a released job stays released. */
export async function releaseJobCredits(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = parseJobForm(formData);
  if (!input) backTo(undefined, "invalid");
  const job = await loadJob(input.id);
  if (!job) backTo(input.back, "not-found");
  const ledger = (await ledgerForJobs([job.id])).get(job.id);
  if (!OPEN_STATUSES.includes(job.status) && !ledger?.holding) backTo(input.back, "release-noop");
  try {
    // Cancels when still open; otherwise only the lingering reservation is released.
    await cancelJob(job.id, job.error ?? "Cancelled by the operator");
  } catch (err) {
    await captureError(err, { route: "/admin/jobs#release", source: "server", context: { jobId: job.id } });
    throw err;
  }
  backTo(input.back, "released");
}

/** Mark an open job failed (for example the provider lost it); its credits are released. */
export async function markJobFailed(formData: FormData): Promise<void> {
  await requireAdmin();
  const input = parseJobForm(formData);
  if (!input) backTo(undefined, "invalid");
  const job = await loadJob(input.id);
  if (!job) backTo(input.back, "not-found");
  if (!OPEN_STATUSES.includes(job.status)) backTo(input.back, "fail-noop");
  try {
    await failJob(job.id);
  } catch (err) {
    await captureError(err, { route: "/admin/jobs#fail", source: "server", context: { jobId: job.id } });
    throw err;
  }
  backTo(input.back, "failed");
}

/* ------------------------------------------------------------------ errors */

const ErrorForm = z.object({ id: z.string().regex(/^err_[0-9a-z]{8,32}$/), resolve: z.enum(["0", "1"]) });

export async function setErrorResolved(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = ErrorForm.safeParse({ id: String(formData.get("id") ?? ""), resolve: String(formData.get("resolve") ?? "") });
  if (!parsed.success) return;
  await db
    .update(errorGroups)
    .set({ resolvedAt: parsed.data.resolve === "1" ? sql`now()` : null })
    .where(eq(errorGroups.id, parsed.data.id));
  revalidatePath("/admin/errors");
  revalidatePath("/admin");
}

export async function resolveAllErrors(): Promise<void> {
  await requireAdmin();
  await db
    .update(errorGroups)
    .set({ resolvedAt: sql`now()` })
    .where(sql`${errorGroups.resolvedAt} is null`);
  revalidatePath("/admin/errors");
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ contact messages */

const MessageForm = z.object({ id: z.string().regex(/^msg_[0-9a-z]{8,32}$/), status: z.enum(["new", "replied", "archived"]) });

export async function setMessageStatus(formData: FormData): Promise<void> {
  await requireAdmin();
  const parsed = MessageForm.safeParse({ id: String(formData.get("id") ?? ""), status: String(formData.get("status") ?? "") });
  if (!parsed.success) return;
  await db.update(contactMessages).set({ status: parsed.data.status }).where(eq(contactMessages.id, parsed.data.id));
  revalidatePath("/admin/messages");
  revalidatePath("/admin");
}
