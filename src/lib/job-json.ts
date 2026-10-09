import type { JobView } from "@/lib/video/jobs";
import type { JobStatus, Resolution } from "@/lib/db/schema";

/*
 * The job as the browser sees it: what GET /api/jobs/[id] returns and what server pages
 * hand to client components. Dates travel as ISO strings so the shape is identical on
 * both sides of the wire.
 */

export type { JobStatus };

export interface JobVideoJson {
  /** Signed inline URL for the player (short-lived). */
  url: string;
  /** Signed attachment URL for the download button. */
  downloadUrl: string;
  bytes: number;
  durationSec: number;
}

export interface JobJson {
  id: string;
  status: JobStatus;
  stage: string;
  resolution: Resolution;
  durationSec: number;
  credits: number;
  presenterId: string;
  productId: string;
  createdAt: string;
  finishedAt: string | null;
  error?: string;
  video?: JobVideoJson;
}

function iso(v: Date | string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function toJobJson(job: JobView): JobJson {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    resolution: job.resolution,
    durationSec: job.durationSec,
    credits: job.credits,
    presenterId: job.presenterId,
    productId: job.productId,
    createdAt: iso(job.createdAt) ?? new Date(0).toISOString(),
    finishedAt: iso(job.finishedAt),
    ...(job.error ? { error: job.error } : {}),
    ...(job.video
      ? { video: { url: job.video.url, downloadUrl: job.video.downloadUrl, bytes: job.video.bytes, durationSec: job.video.durationSec } }
      : {}),
  };
}

/** Statuses the job page keeps polling for. */
export const LIVE_STATUSES: readonly JobStatus[] = ["draft", "awaiting_engine", "queued", "running"];

export function isLive(status: JobStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

/** The machine stage (`JobView.stage`) in the seller's words. */
export const STAGE_LABEL: Record<string, string> = {
  waiting_for_engine: "Waiting for the video engine",
  queued: "Queued",
  generating: "Generating the video",
  saving: "Saving your video",
  done: "Done",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function stageLabel(stage: string): string {
  return STAGE_LABEL[stage] ?? stage;
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  draft: "Starting",
  awaiting_engine: "Waiting for engine",
  queued: "Queued",
  running: "Generating",
  succeeded: "Ready",
  failed: "Failed",
  expired: "Expired",
  cancelled: "Cancelled",
};
