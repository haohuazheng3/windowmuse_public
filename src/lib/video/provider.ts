import "server-only";
import { features, type VideoEngine } from "@/lib/env";
import type { Resolution } from "@/content/plans";
import { mockProvider } from "./mock";
import { noneProvider } from "./none";
import { replicateProvider } from "./replicate";

/*
 * The pluggable video engine. Only src/lib/video/jobs.ts talks to a provider; everything
 * a provider needs is in GenerateInput, and everything the job runner needs back is in
 * TaskStatus. Providers never touch the database or credits.
 */

export type { Resolution };

export interface GenerateInput {
  jobId: string;
  prompt: string;
  /** Signed, short-lived (24 h) read URLs of the seller's product photos, in prompt order (@Image1…). */
  referenceImageUrls: string[];
  durationSec: number;
  aspect: "9:16";
  resolution: Resolution;
  generateAudio: true;
  seed?: number;
  watermark: boolean;
  /** Where the provider should POST when the task finishes; carries the job's HMAC token. */
  callbackUrl: string;
}

export type TaskState = "queued" | "running" | "succeeded" | "failed" | "expired";

export interface TaskStatus {
  state: TaskState;
  /** Provider-hosted result, valid for a limited time; streamed into our bucket, never shown to users. */
  videoUrl?: string;
  /** Provider's own wording; stored for admins, never shown verbatim to sellers. */
  error?: string;
}

export interface CallbackHint {
  taskId?: string;
  state?: TaskState;
}

export interface VideoProvider {
  readonly name: VideoEngine;
  configured(): boolean;
  /** The sharpest output this engine can deliver today; jobs above it are refused before credits move. */
  readonly maxResolution: Resolution;
  create(input: GenerateInput): Promise<{ taskId: string }>;
  status(taskId: string): Promise<TaskStatus>;
  /** Reads a completion webhook body. The result is a hint only: the runner re-polls `status()`. */
  parseCallback?(payload: unknown): CallbackHint | null;
  /**
   * Whether a result URL may be downloaded server-side. Each engine names the hosts it
   * delivers from; anything else (a tampered response, an internal address) is refused
   * before a byte is fetched.
   */
  acceptsOutputUrl(url: URL): boolean;
}

/** The provider for an engine name; without one, the engine the environment selects. */
export function getProvider(engine: VideoEngine = features().videoEngine): VideoProvider {
  switch (engine) {
    case "replicate":
      return replicateProvider;
    case "mock":
      return mockProvider;
    default:
      return noneProvider;
  }
}

export function isVideoEngine(v: unknown): v is VideoEngine {
  return v === "replicate" || v === "mock" || v === "none";
}
