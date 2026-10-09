import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, asc, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import { assets, jobs, products, scripts, videos, type JobRow, type JobStatus, type Resolution, type VideoRow } from "@/lib/db/schema";
import { costFor, jobsHoldingCredits, onlyTrialCredits, release, reserve, settle } from "@/lib/credits";
import { requireEnv } from "@/lib/env";
import { captureError } from "@/lib/errors";
import { headObject, putObject, signedReadUrl, videoKey } from "@/lib/files";
import { newId, shortRef } from "@/lib/ids";
import { SITE } from "@/lib/site";
import { currentPlan } from "@/lib/user";
import { presenterById } from "@/content/presenters";
import { TRIAL } from "@/content/plans";
import { hasFatal, lintScript } from "@/lib/scripts/lint";
import { isAngle, isLanguage, isTone } from "@/lib/scripts/types";
import { buildPrompt, MAX_REFERENCE_IMAGES } from "./prompt";
import { getProvider, isVideoEngine, type GenerateInput, type VideoProvider } from "./provider";

/*
 * The only module that changes `jobs.status`, and the only caller of reserve/settle/release
 * for generations. Lifecycle:
 *
 *   createJob  → reserve credits → insert (draft) → dispatch: none → awaiting_engine,
 *                otherwise provider.create → queued
 *   advanceJob → awaiting_engine: dispatch when an engine is configured
 *                queued/running: poll → running | complete (download → bucket → videos →
 *                settle → succeeded) | fail (release) | expire after 2 h (release)
 *
 * Every transition is a conditional UPDATE on the previous status, so the callback and the
 * cron can run at the same moment without double-downloading or double-settling.
 *
 * Operator levers (admin area) go through cancelJob / markJobFailed / requeueJob below, so
 * this stays the only module that writes jobs.status.
 */

export const JOB_TTL_MS = 2 * 60 * 60 * 1000;
/** A "saving" claim older than this is considered abandoned (function died mid-download) and retried. */
const SAVING_STALE_MS = 10 * 60 * 1000;
/** The job page polls every 5 s; a GET only re-polls the provider this often. */
const POLL_MIN_INTERVAL_MS = 8_000;
export const ACTIVE_STATUSES: JobStatus[] = ["awaiting_engine", "queued", "running"];
const REFERENCE_URL_TTL_SECONDS = 24 * 60 * 60;

export type JobStage = "waiting_for_engine" | "queued" | "generating" | "saving" | "done" | "failed" | "expired" | "cancelled";

export interface JobVideo {
  url: string;
  downloadUrl: string;
  bytes: number;
  durationSec: number;
  width: number | null;
  height: number | null;
}

export interface JobView {
  id: string;
  status: JobStatus;
  /** Short machine stage for the job page ("queued" → "generating" → "saving" → "done"). */
  stage: JobStage;
  resolution: Resolution;
  durationSec: number;
  credits: number;
  presenterId: string;
  productId: string;
  scriptId: string;
  createdAt: Date;
  finishedAt: Date | null;
  /** Seller-safe explanation when the job did not succeed. */
  error?: string;
  video?: JobVideo;
}

export type JobErrorCode =
  | "product_not_found"
  | "script_not_found"
  | "presenter_not_found"
  | "no_photos"
  | "invalid_options"
  | "resolution_not_allowed"
  | "trial_resolution"
  | "engine_resolution"
  | "parallel_limit"
  | "script_noncompliant"
  | "insufficient_credits";

/** A refusal the seller can act on; the route turns it into a 4xx with the message as is. */
export class JobError extends Error {
  readonly code: JobErrorCode;
  readonly status: number;
  readonly detail: Record<string, number | string> | undefined;
  constructor(code: JobErrorCode, message: string, status: number, detail?: Record<string, number | string>) {
    super(message);
    this.name = "JobError";
    this.code = code;
    this.status = status;
    this.detail = detail;
  }
}

/* ------------------------------------------------------------------ views */

const FRAME: Record<Resolution, { width: number; height: number }> = {
  "480p": { width: 480, height: 864 },
  "720p": { width: 720, height: 1280 },
  "1080p": { width: 1080, height: 1920 },
};

type Params = Record<string, unknown>;

function paramsOf(job: JobRow): Params {
  return job.params && typeof job.params === "object" ? job.params : {};
}

export function stageOf(job: Pick<JobRow, "status" | "params">): JobStage {
  switch (job.status) {
    case "awaiting_engine":
      return "waiting_for_engine";
    case "queued":
      return "queued";
    case "running":
      return (job.params as Params | null)?.stage === "saving" ? "saving" : "generating";
    case "succeeded":
      return "done";
    case "failed":
      return "failed";
    case "expired":
      return "expired";
    case "cancelled":
      return "cancelled";
    default:
      return "queued";
  }
}

function videoView(job: JobRow, v: VideoRow | null): JobVideo | undefined {
  if (!v) return undefined;
  const name = `windowmuse-${shortRef(job.id).toLowerCase()}.mp4`;
  return {
    url: signedReadUrl(v.objectKey, { disposition: "inline", filename: name, ttlSeconds: 3600 }),
    downloadUrl: signedReadUrl(v.objectKey, { disposition: "attachment", filename: name, ttlSeconds: 3600 }),
    bytes: v.bytes,
    durationSec: v.durationSec ?? job.durationSec,
    width: v.width,
    height: v.height,
  };
}

export function toView(job: JobRow, video: VideoRow | null): JobView {
  return {
    id: job.id,
    status: job.status,
    stage: stageOf(job),
    resolution: job.resolution,
    durationSec: job.durationSec,
    credits: job.credits,
    presenterId: job.presenterId,
    productId: job.productId,
    scriptId: job.scriptId,
    createdAt: job.createdAt,
    finishedAt: job.finishedAt,
    ...(job.error ? { error: job.error } : {}),
    ...(job.status === "succeeded" ? { video: videoView(job, video) } : {}),
  };
}

/* ------------------------------------------------------------------ reads */

async function loadJob(jobId: string): Promise<JobRow | null> {
  const rows = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return rows[0] ?? null;
}

async function loadVideo(jobId: string): Promise<VideoRow | null> {
  const rows = await db.select().from(videos).where(eq(videos.jobId, jobId)).limit(1);
  return rows[0] ?? null;
}

export async function getJob(userId: string, jobId: string): Promise<JobView | null> {
  const rows = await db
    .select({ job: jobs, video: videos })
    .from(jobs)
    .leftJoin(videos, eq(videos.jobId, jobs.id))
    .where(and(eq(jobs.id, jobId), eq(jobs.userId, userId)))
    .limit(1);
  const r = rows[0];
  return r ? toView(r.job, r.video) : null;
}

export async function listJobs(userId: string, limit = 50): Promise<JobView[]> {
  const rows = await db
    .select({ job: jobs, video: videos })
    .from(jobs)
    .leftJoin(videos, eq(videos.jobId, jobs.id))
    .where(eq(jobs.userId, userId))
    .orderBy(desc(jobs.createdAt))
    .limit(Math.min(200, Math.max(1, limit)));
  return rows.map((r) => toView(r.job, r.video));
}

/* ------------------------------------------------------------------ callback token */

/** The callback link outlives the job's 2-hour deadline by a margin, then stops working. */
const CALLBACK_TTL_MS = JOB_TTL_MS + 60 * 60 * 1000;

/** HMAC-SHA256 over the job id and the link's expiry, keyed by VIDEO_CALLBACK_SECRET. */
export function callbackToken(jobId: string, exp: number): string {
  return createHmac("sha256", requireEnv("VIDEO_CALLBACK_SECRET")).update(`${jobId}\n${exp}`).digest("hex");
}

/** Constant-time check of a callback's `t` (token) and `exp` (unix seconds) query parameters. */
export function verifyCallbackToken(jobId: string, token: string | null | undefined, exp: string | null | undefined, now = Date.now()): boolean {
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return false;
  if (!exp || !/^\d{1,12}$/.test(exp)) return false;
  const expiry = Number(exp);
  if (expiry * 1000 < now) return false;
  const expected = Buffer.from(callbackToken(jobId, expiry), "hex");
  const given = Buffer.from(token, "hex");
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function callbackUrl(jobId: string, now = Date.now()): string {
  const exp = Math.floor((now + CALLBACK_TTL_MS) / 1000);
  return `${SITE.url}/api/video/callback/${encodeURIComponent(jobId)}?exp=${exp}&t=${callbackToken(jobId, exp)}`;
}

/* ------------------------------------------------------------------ transitions (conditional updates) */

async function transition(jobId: string, from: JobStatus[], set: PgUpdateSetSource<typeof jobs>): Promise<JobRow | null> {
  const rows = await db
    .update(jobs)
    .set(set)
    .where(and(eq(jobs.id, jobId), inArray(jobs.status, from)))
    .returning();
  return rows[0] ?? null;
}

/** Merges keys into `params` atomically (jsonb concatenation), without touching status. */
async function mergeParams(jobId: string, patch: Params): Promise<void> {
  await db
    .update(jobs)
    .set({ params: sql`coalesce(${jobs.params}, '{}'::jsonb) || ${JSON.stringify(patch)}::jsonb` })
    .where(eq(jobs.id, jobId));
}

const USER_SAFE = {
  engineRejected: "The video engine did not accept this job. Your credits were not charged; please try again in a few minutes.",
  engineFailed: "The engine could not finish this video. Your credits were released; try again, or pick different photos if it keeps happening.",
  expired: "This generation took longer than two hours and was stopped. Your credits were released.",
  saveFailed: "The video was generated but could not be saved. Your credits were released; please generate again.",
} as const;

/**
 * The engine a job talks to. A job keeps the provider it was created with (an admin's mock
 * drill is polled against mock even when the deployment's engine is replicate); jobs parked
 * without an engine take whatever the environment configures when they are dispatched.
 */
function providerFor(job: Pick<JobRow, "provider" | "status">): VideoProvider {
  if (job.status === "awaiting_engine" || !isVideoEngine(job.provider) || job.provider === "none") return getProvider();
  return getProvider(job.provider);
}

async function failJob(job: JobRow, userMessage: string, providerError?: string): Promise<JobRow> {
  await release(job.id);
  const row = await transition(job.id, ACTIVE_STATUSES.concat("draft"), {
    status: "failed",
    error: userMessage,
    finishedAt: sql`now()`,
    params: sql`coalesce(${jobs.params}, '{}'::jsonb) || ${JSON.stringify({ providerError: providerError?.slice(0, 1000) ?? null, stage: null })}::jsonb`,
  });
  return row ?? (await loadJob(job.id)) ?? job;
}

/**
 * Closes a job past its deadline. The update is conditional on the row not being mid-save
 * (a concurrent completion that claimed the download after we read our snapshot wins), and
 * the reservation is released only once the row has actually flipped, so a video that lands
 * in the bucket is never paired with an "expired" job and refunded credits.
 */
async function expireJob(job: JobRow): Promise<JobRow> {
  const rows = await db
    .update(jobs)
    .set({ status: "expired", error: USER_SAFE.expired, finishedAt: sql`now()` })
    .where(
      and(
        eq(jobs.id, job.id),
        inArray(jobs.status, ACTIVE_STATUSES.concat("draft")),
        sql`(coalesce(${jobs.params}->>'stage', '') <> 'saving' or coalesce((${jobs.params}->>'savingAt')::bigint, 0) < ${Date.now() - SAVING_STALE_MS})`,
      ),
    )
    .returning();
  const row = rows[0];
  if (row) await release(job.id);
  return row ?? (await loadJob(job.id)) ?? job;
}

/* ------------------------------------------------------------------ create */

export interface CreateJobInput {
  userId: string;
  productId: string;
  scriptId: string;
  presenterId: string;
  resolution: Resolution;
  durationSec: number;
  /**
   * Admin diagnostics only (never reachable from /api/jobs): run this job on the mock engine
   * whatever VIDEO_PROVIDER says. Only "mock" is accepted, so a drill can never spend on a
   * real model and a seller can never pick an engine.
   */
  engineOverride?: "mock";
}

export async function createJob(input: CreateJobInput): Promise<JobView> {
  const { userId } = input;
  if (input.engineOverride !== undefined && input.engineOverride !== "mock") {
    throw new JobError("invalid_options", "Only the mock engine can be forced.", 400);
  }

  const productRows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.userId, userId), isNull(products.deletedAt)))
    .limit(1);
  const product = productRows[0];
  if (!product) throw new JobError("product_not_found", "That product no longer exists.", 404);

  const scriptRows = await db
    .select()
    .from(scripts)
    .where(and(eq(scripts.id, input.scriptId), eq(scripts.userId, userId), eq(scripts.productId, product.id)))
    .limit(1);
  const script = scriptRows[0];
  if (!script) throw new JobError("script_not_found", "Save the script first, then generate.", 404);
  if (!isLanguage(script.language) || !isTone(script.tone) || !isAngle(script.angle)) {
    throw new JobError("invalid_options", "This script has options we no longer support; write it again.", 400);
  }
  // The compliance gate runs here as well as in the browser and on save: a saved row is not a licence.
  const lint = lintScript(script.fullText, { language: script.language });
  if (hasFatal(lint)) {
    throw new JobError("script_noncompliant", "This script has lines the compliance check blocks. Fix them in the Script pane and save again.", 422, {
      fatal: lint.fatal.length,
    });
  }

  const presenter = presenterById(input.presenterId);
  if (!presenter) throw new JobError("presenter_not_found", "Pick a presenter from the catalog.", 404);

  const photos = await db
    .select()
    .from(assets)
    .where(and(eq(assets.userId, userId), eq(assets.productId, product.id), eq(assets.kind, "image"), eq(assets.status, "ready")))
    .orderBy(asc(assets.createdAt))
    .limit(MAX_REFERENCE_IMAGES);
  if (photos.length === 0) throw new JobError("no_photos", "Upload at least one product photo before generating.", 400);

  const provider = input.engineOverride ? getProvider(input.engineOverride) : getProvider();
  const [plan, trialOnly, holding] = await Promise.all([currentPlan(userId), onlyTrialCredits(userId), jobsHoldingCredits(userId)]);
  if (input.resolution === "1080p" && !plan.allow1080p) {
    throw new JobError("resolution_not_allowed", "1080p is included with Growth and Pro. Choose 720p, or upgrade on the billing page.", 403);
  }
  if (trialOnly && input.resolution !== TRIAL.resolution) {
    throw new JobError("trial_resolution", `Trial credits render at ${TRIAL.resolution}. Any paid plan or pack unlocks 720p.`, 403);
  }
  if (provider.configured() && !resolutionWithin(input.resolution, provider.maxResolution)) {
    throw new JobError(
      "engine_resolution",
      `${input.resolution} is not available on the video engine yet; the sharpest it delivers today is ${provider.maxResolution}. Your credits were not charged.`,
      409,
    );
  }
  if (holding.length >= plan.maxParallel) {
    throw new JobError(
      "parallel_limit",
      plan.maxParallel === 1
        ? "One video can generate at a time on your plan. Wait for the current one to finish, or upgrade for three at once."
        : `Up to ${plan.maxParallel} videos can generate at once on your plan. Wait for one to finish.`,
      409,
      { maxParallel: plan.maxParallel, active: holding.length },
    );
  }

  const credits = costFor({ durationSec: input.durationSec, resolution: input.resolution });
  const jobId = newId("job");
  const held = await reserve({ userId, jobId, amount: credits });
  if (!held.ok) {
    throw new JobError("insufficient_credits", `This video needs ${credits} ${credits === 1 ? "credit" : "credits"} and you have ${held.available}.`, 402, {
      needed: credits,
      available: held.available,
    });
  }

  const prompt = buildPrompt({
    presenter,
    product: { name: product.name, brand: product.brand, category: product.category },
    script: { hook: script.hook, body: script.body, cta: script.cta },
    language: script.language,
    tone: script.tone,
    angle: script.angle,
    durationSec: input.durationSec,
    imageCount: photos.length,
  });

  let row: JobRow;
  try {
    const inserted = await db
      .insert(jobs)
      .values({
        id: jobId,
        userId,
        productId: product.id,
        scriptId: script.id,
        presenterId: presenter.id,
        provider: provider.name,
        status: "draft",
        resolution: input.resolution,
        durationSec: input.durationSec,
        credits,
        prompt,
        params: { language: script.language, tone: script.tone, angle: script.angle, assetIds: photos.map((p) => p.id), stage: null },
        expiresAt: new Date(Date.now() + JOB_TTL_MS),
      })
      .returning();
    row = inserted[0]!;
  } catch (err) {
    await release(jobId);
    throw err;
  }

  // The parallel check above raced with nothing but itself: two requests can both pass it. Now
  // that this job holds a reservation, count again and keep only the oldest `maxParallel` holders.
  const overflow = await exceedsParallelLimit(userId, jobId, plan.maxParallel);
  if (overflow) {
    await transition(jobId, ["draft"], { status: "cancelled", error: "Cancelled: another video of yours was already generating.", finishedAt: sql`now()` });
    await release(jobId);
    throw new JobError(
      "parallel_limit",
      plan.maxParallel === 1
        ? "One video can generate at a time on your plan. Wait for the current one to finish, or upgrade for three at once."
        : `Up to ${plan.maxParallel} videos can generate at once on your plan. Wait for one to finish.`,
      409,
      { maxParallel: plan.maxParallel, active: overflow.active },
    );
  }

  const dispatched = await dispatch(row, provider, photos);
  return toView(dispatched, null);
}

/** After reserving: is this job outside the oldest `max` jobs that hold credits for the user? */
async function exceedsParallelLimit(userId: string, jobId: string, max: number): Promise<{ active: number } | null> {
  const holding = await jobsHoldingCredits(userId);
  if (holding.length <= max) return null;
  const ordered = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(and(eq(jobs.userId, userId), inArray(jobs.id, holding)))
    .orderBy(asc(jobs.createdAt), asc(jobs.id));
  const keep = new Set(ordered.slice(0, max).map((r) => r.id));
  return keep.has(jobId) ? null : { active: holding.length - 1 };
}

function resolutionWithin(requested: Resolution, max: Resolution): boolean {
  const order: Resolution[] = ["480p", "720p", "1080p"];
  return order.indexOf(requested) <= order.indexOf(max);
}

/* ------------------------------------------------------------------ dispatch */

type RefAsset = { objectKey: string; id: string; contentType: string };

/** Signed 24-hour read links the engine fetches the photos from, in prompt order (@Image1…). */
function signedReferenceUrls(photos: RefAsset[]): string[] {
  return photos.map((a) => {
    const ext = a.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    return signedReadUrl(a.objectKey, { disposition: "inline", filename: `${a.id}.${ext}`, ttlSeconds: REFERENCE_URL_TTL_SECONDS });
  });
}

/** Sends a draft/awaiting job to the engine, or parks it when there is none. */
async function dispatch(job: JobRow, provider: VideoProvider, photos: RefAsset[]): Promise<JobRow> {
  if (!provider.configured()) {
    const parked = await transition(job.id, ["draft", "awaiting_engine"], { status: "awaiting_engine", provider: provider.name });
    return parked ?? job;
  }
  const urls = signedReferenceUrls(photos);
  const input: GenerateInput = {
    jobId: job.id,
    prompt: job.prompt ?? "",
    referenceImageUrls: urls,
    durationSec: job.durationSec,
    aspect: "9:16",
    resolution: job.resolution,
    generateAudio: true,
    watermark: false,
    callbackUrl: callbackUrl(job.id),
  };
  try {
    const { taskId } = await provider.create(input);
    const queued = await transition(job.id, ["draft", "awaiting_engine"], {
      status: "queued",
      provider: provider.name,
      providerTaskId: taskId,
      startedAt: sql`now()`,
      expiresAt: new Date(Date.now() + JOB_TTL_MS),
    });
    return queued ?? (await loadJob(job.id)) ?? job;
  } catch (err) {
    await captureError(err, { route: "video/dispatch", context: { jobId: job.id, provider: provider.name } });
    return failJob(job, USER_SAFE.engineRejected, err instanceof Error ? err.message : String(err));
  }
}

/* ------------------------------------------------------------------ advance */

/**
 * Moves one job forward by one step. Safe to call from the callback, the cron and the
 * job page at the same time: every write is conditional on the status it expects.
 */
export async function advanceJob(jobId: string, opts: { force?: boolean } = {}): Promise<JobView | null> {
  const job = await loadJob(jobId);
  if (!job) return null;
  if (!ACTIVE_STATUSES.includes(job.status)) return toView(job, await loadVideo(job.id));

  const params = paramsOf(job);
  const lastPoll = typeof params.lastPollAt === "number" ? params.lastPollAt : 0;
  if (!opts.force && Date.now() - lastPoll < POLL_MIN_INTERVAL_MS) return toView(job, null);

  if (job.expiresAt && job.expiresAt.getTime() < Date.now() && params.stage !== "saving") {
    return toView(await expireJob(job), null);
  }

  const provider = providerFor(job);

  if (job.status === "awaiting_engine") {
    if (!provider.configured()) return toView(job, null);
    const assetIds = Array.isArray(params.assetIds) ? params.assetIds.filter((v): v is string => typeof v === "string") : [];
    const rows = assetIds.length
      ? await db
          .select()
          .from(assets)
          .where(and(eq(assets.userId, job.userId), inArray(assets.id, assetIds), eq(assets.status, "ready")))
          .orderBy(asc(assets.createdAt))
      : [];
    if (rows.length === 0) return toView(await failJob(job, "The product photos for this job are gone. Upload photos and generate again."), null);
    return toView(await dispatch(job, provider, rows), null);
  }

  // queued | running
  if (!job.providerTaskId) return toView(await failJob(job, USER_SAFE.engineRejected, "no provider task id"), null);
  await mergeParams(job.id, { lastPollAt: Date.now() });

  let status;
  try {
    status = await provider.status(job.providerTaskId);
  } catch (err) {
    // A flaky poll is not a failed job: log it and let the next tick retry.
    await captureError(err, { route: "video/poll", severity: "warn", context: { jobId: job.id, provider: provider.name } });
    return toView(job, null);
  }

  switch (status.state) {
    case "queued":
      return toView(job, null);
    case "running": {
      const running = job.status === "queued" ? await transition(job.id, ["queued"], { status: "running" }) : null;
      return toView(running ?? job, null);
    }
    case "failed":
      return toView(await failJob(job, USER_SAFE.engineFailed, status.error), null);
    case "expired":
      return toView(await expireJob(job), null);
    case "succeeded":
      return completeJob(job, status.videoUrl ?? "");
  }
}

/* ------------------------------------------------------------------ completion */

/** The largest result the completion step will stream into the bucket. */
const MAX_VIDEO_BYTES = 512 * 1024 * 1024;

/** Result URL as the engine reported it, accepted only on the hosts that engine delivers from. */
function outputUrl(providerUrl: string, provider: VideoProvider): URL | null {
  let url: URL;
  try {
    url = new URL(providerUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  return provider.acceptsOutputUrl(url) ? url : null;
}

async function completeJob(job: JobRow, providerUrl: string): Promise<JobView> {
  // Already saved by a concurrent run? Then only the bookkeeping may be missing.
  const existing = await loadVideo(job.id);
  if (existing) return finishSucceeded(job, existing);

  const source = outputUrl(providerUrl, providerFor(job));
  if (!source) {
    await captureError(new Error("provider result URL refused"), { route: "video/complete", severity: "warn", context: { jobId: job.id, host: providerUrl.slice(0, 120) } });
    return toView(await failJob(job, USER_SAFE.engineFailed, "succeeded without an acceptable output URL"), null);
  }

  // Claim the download. Another runner holding a fresh claim wins; a stale claim is taken over.
  const now = Date.now();
  const claimed = await db
    .update(jobs)
    .set({
      status: "running",
      params: sql`coalesce(${jobs.params}, '{}'::jsonb) || ${JSON.stringify({ stage: "saving", savingAt: now })}::jsonb`,
    })
    .where(
      and(
        eq(jobs.id, job.id),
        inArray(jobs.status, ["queued", "running"]),
        sql`(coalesce(${jobs.params}->>'stage', '') <> 'saving' or coalesce((${jobs.params}->>'savingAt')::bigint, 0) < ${now - SAVING_STALE_MS})`,
      ),
    )
    .returning();
  const claimedRow = claimed[0];
  if (!claimedRow) return toView((await loadJob(job.id)) ?? job, null);

  const key = videoKey(job.userId, job.id);
  try {
    const res = await fetch(source, { signal: AbortSignal.timeout(240_000) });
    if (!res.ok || !res.body) throw new Error(`provider video answered ${res.status}`);
    // A redirect may only land on the engine's own delivery hosts as well.
    if (res.url && res.url !== source.href && !outputUrl(res.url, providerFor(job))) throw new Error("provider video redirected off the engine's delivery host");
    const type = (res.headers.get("content-type") ?? "").toLowerCase();
    if (!type.startsWith("video/") && !type.startsWith("application/octet-stream")) throw new Error(`provider video has content-type ${type || "(none)"}`);
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_VIDEO_BYTES) throw new Error(`provider video is ${length} bytes, above the ${MAX_VIDEO_BYTES} limit`);
    const put = await putObject(key, res.body, "video/mp4");
    const bytes = put.bytes ?? (await headObject(key))?.bytes ?? 0;
    const frame = FRAME[job.resolution];
    const inserted = await db
      .insert(videos)
      .values({
        id: newId("vid"),
        jobId: job.id,
        userId: job.userId,
        objectKey: key,
        bytes,
        durationSec: job.durationSec,
        width: frame.width,
        height: frame.height,
      })
      .onConflictDoNothing({ target: videos.jobId })
      .returning();
    const video = inserted[0] ?? (await loadVideo(job.id));
    if (!video) throw new Error("video row was not persisted");
    return finishSucceeded(claimedRow, video);
  } catch (err) {
    await captureError(err, { route: "video/complete", context: { jobId: job.id, key } });
    return toView(await failJob(claimedRow, USER_SAFE.saveFailed, err instanceof Error ? err.message : String(err)), null);
  }
}

async function finishSucceeded(job: JobRow, video: VideoRow): Promise<JobView> {
  await settle(job.id);
  const done = await transition(job.id, ["queued", "running"], {
    status: "succeeded",
    finishedAt: sql`now()`,
    error: null,
    params: sql`coalesce(${jobs.params}, '{}'::jsonb) || '{"stage": null}'::jsonb`,
  });
  return toView(done ?? (await loadJob(job.id)) ?? job, video);
}

/* ------------------------------------------------------------------ operator levers */

export const OPEN_STATUSES: JobStatus[] = ["draft", ...ACTIVE_STATUSES];
export const RETRYABLE_STATUSES: JobStatus[] = ["failed", "expired", ...ACTIVE_STATUSES];

/**
 * Cancel an open job and give its reservation back. Idempotent: a job that is already closed
 * keeps its status, and release() is a no-op once the credits were debited or released.
 * Returns false when nothing was open (the credits are still released if a reservation lingers).
 */
export async function cancelJob(jobId: string, reason = "Cancelled by the operator"): Promise<boolean> {
  const row = await transition(jobId, OPEN_STATUSES, {
    status: "cancelled",
    finishedAt: sql`now()`,
    error: reason,
    params: sql`coalesce(${jobs.params}, '{}'::jsonb) || '{"stage": null}'::jsonb`,
  });
  await release(jobId);
  return row !== null;
}

/** Mark an open job failed (for example the provider lost it); its credits are released. */
export async function markJobFailed(jobId: string, reason = "Marked failed by the operator"): Promise<boolean> {
  const row = await transition(jobId, OPEN_STATUSES, {
    status: "failed",
    finishedAt: sql`now()`,
    error: reason,
    params: sql`coalesce(${jobs.params}, '{}'::jsonb) || '{"stage": null}'::jsonb`,
  });
  await release(jobId);
  return row !== null;
}

/**
 * Put a failed, expired or stuck job back in the queue and dispatch it now. The reservation
 * must still be held (the caller checks the ledger): a job whose credits were released or
 * debited needs a new job, not a retry. `assetIds` in params stays so the reference images
 * can be rebuilt; the retry count and the reason it was retried are recorded.
 */
export async function requeueJob(jobId: string): Promise<JobView | null> {
  const job = await loadJob(jobId);
  if (!job || !RETRYABLE_STATUSES.includes(job.status)) return null;
  const attempts = Number(paramsOf(job).retries ?? 0) + 1;
  const reset = await transition(jobId, RETRYABLE_STATUSES, {
    status: "awaiting_engine",
    providerTaskId: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    expiresAt: new Date(Date.now() + JOB_TTL_MS),
    params: sql`coalesce(${jobs.params}, '{}'::jsonb) || ${JSON.stringify({
      stage: null,
      lastPollAt: 0,
      retries: attempts,
      lastRetryAt: new Date().toISOString(),
      lastRetryReason: job.error ?? job.status,
    })}::jsonb`,
  });
  if (!reset) return null; // changed under us
  try {
    return (await advanceJob(jobId, { force: true })) ?? toView(reset, null);
  } catch (err) {
    // Dispatch failed right now; the job is queued and the cron tries again on its next tick.
    await captureError(err, { route: "video/requeue", context: { jobId } });
    return toView((await loadJob(jobId)) ?? reset, null);
  }
}

/* ------------------------------------------------------------------ callbacks & cron */

/** Provider webhook: the payload is a hint only; the job is re-polled through the provider API. */
export async function handleCallback(jobId: string, payload: unknown): Promise<JobView | null> {
  const job = await loadJob(jobId);
  if (!job) return null;
  const provider = providerFor(job);
  const hint = provider.parseCallback?.(payload) ?? null;
  await mergeParams(jobId, { lastCallbackAt: Date.now(), lastCallbackState: hint?.state ?? null });
  if (hint?.taskId && job.providerTaskId && hint.taskId !== job.providerTaskId) {
    await captureError(new Error("callback task id does not match the job"), { route: "video/callback", severity: "warn", context: { jobId } });
    return toView(job, await loadVideo(jobId));
  }
  return advanceJob(jobId, { force: true });
}

/** Releases every active job past its deadline (2 h after creation/dispatch). */
export async function expireStaleJobs(): Promise<string[]> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(inArray(jobs.status, ACTIVE_STATUSES.concat("draft")), lt(jobs.expiresAt, sql`now()`)))
    .limit(100);
  const expired: string[] = [];
  for (const job of rows) {
    if (paramsOf(job).stage === "saving" && Date.now() - Number(paramsOf(job).savingAt ?? 0) < SAVING_STALE_MS) continue;
    await expireJob(job);
    expired.push(job.id);
  }
  return expired;
}

/** Ids of jobs the cron should advance this minute, oldest first. */
export async function listActiveJobIds(limit = 50): Promise<string[]> {
  const rows = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(inArray(jobs.status, ACTIVE_STATUSES))
    .orderBy(asc(jobs.createdAt))
    .limit(limit);
  return rows.map((r) => r.id);
}

/** Runs one cron tick: expiries first, then one step for every active job. */
export async function runJobsTick(): Promise<{ expired: string[]; advanced: number; failed: string[] }> {
  const expired = await expireStaleJobs();
  const ids = await listActiveJobIds();
  const failed: string[] = [];
  let advanced = 0;
  for (const id of ids) {
    try {
      await advanceJob(id, { force: true });
      advanced++;
    } catch (err) {
      failed.push(id);
      await captureError(err, { route: "/api/cron/jobs", source: "cron", context: { jobId: id } });
    }
  }
  return { expired, advanced, failed };
}

/** Job page polling: advances the job opportunistically (dev has no cron) and returns the view. */
export async function pollJob(userId: string, jobId: string): Promise<JobView | null> {
  const view = await getJob(userId, jobId);
  if (!view) return null;
  if (!ACTIVE_STATUSES.includes(view.status)) return view;
  try {
    return (await advanceJob(jobId)) ?? view;
  } catch (err) {
    await captureError(err, { route: "video/poll", severity: "warn", context: { jobId } });
    return view;
  }
}
