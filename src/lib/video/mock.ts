import "server-only";
import { SITE } from "@/lib/site";
import type { TaskStatus, VideoProvider } from "./provider";

/*
 * Zero-cost pipeline test for admins and local development (VIDEO_PROVIDER=mock): the task
 * "succeeds" 20 seconds after creation with the sample clip in public/samples/, which then
 * travels through exactly the same completion path as a real render (download → bucket →
 * videos row → credit settle).
 */

export const MOCK_DELAY_MS = 20_000;
export const MOCK_SAMPLE_PATH = "/samples/mock-presenter.mp4";

/** `mock_<jobId>_<createdAtMs>`: the creation time rides in the id so status() needs no storage. */
export function mockTaskId(jobId: string, now = Date.now()): string {
  return `mock_${jobId}_${now}`;
}

export function parseMockTaskId(taskId: string): { jobId: string; createdAt: number } | null {
  const m = /^mock_(.+)_(\d{10,16})$/.exec(taskId);
  if (!m) return null;
  return { jobId: m[1]!, createdAt: Number(m[2]) };
}

export function mockStatusAt(taskId: string, now = Date.now()): TaskStatus {
  const parsed = parseMockTaskId(taskId);
  if (!parsed) return { state: "failed", error: "unrecognised mock task id" };
  const elapsed = now - parsed.createdAt;
  if (elapsed >= MOCK_DELAY_MS) return { state: "succeeded", videoUrl: `${SITE.url}${MOCK_SAMPLE_PATH}` };
  if (elapsed >= MOCK_DELAY_MS / 4) return { state: "running" };
  return { state: "queued" };
}

export const mockProvider: VideoProvider = {
  name: "mock",
  maxResolution: "1080p",
  configured: () => true,
  // The sample clip is served by this very site.
  acceptsOutputUrl: (url) => url.origin === new URL(SITE.url).origin && url.pathname === MOCK_SAMPLE_PATH,
  async create(input) {
    return { taskId: mockTaskId(input.jobId) };
  },
  async status(taskId) {
    return mockStatusAt(taskId);
  },
  parseCallback(payload) {
    if (typeof payload !== "object" || payload === null) return null;
    const id = (payload as { taskId?: unknown }).taskId;
    return typeof id === "string" ? { taskId: id } : null;
  },
};
