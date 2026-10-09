import "server-only";
import type { VideoProvider } from "./provider";

/** No engine configured: jobs are created, credits reserved, and they wait in `awaiting_engine`. */
export const noneProvider: VideoProvider = {
  name: "none",
  maxResolution: "1080p",
  configured: () => false,
  async create() {
    throw new Error("no video engine is configured (VIDEO_PROVIDER=none)");
  },
  async status() {
    return { state: "queued" as const };
  },
  acceptsOutputUrl: () => false,
};
