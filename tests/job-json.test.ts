import { describe, expect, it } from "vitest";
import { LIVE_STATUSES, isLive, toJobJson } from "@/lib/job-json";

describe("job JSON view", () => {
  it("serialises dates to ISO strings and keeps the video block only when present", () => {
    const createdAt = new Date("2026-10-09T10:00:00Z");
    const json = toJobJson({
      id: "job_1",
      status: "succeeded",
      stage: "done",
      resolution: "720p",
      durationSec: 15,
      credits: 1,
      presenterId: "maya",
      productId: "prd_1",
      scriptId: "scr_1",
      createdAt,
      finishedAt: new Date("2026-10-09T10:03:00Z"),
      video: { url: "https://files.example.com/d/v?sig=1", downloadUrl: "https://files.example.com/d/v?disp=attachment", bytes: 1234, durationSec: 15, width: 1080, height: 1920 },
    });
    expect(json.createdAt).toBe("2026-10-09T10:00:00.000Z");
    expect(json.finishedAt).toBe("2026-10-09T10:03:00.000Z");
    expect(json.video?.bytes).toBe(1234);
    expect("error" in json).toBe(false);
  });

  it("knows which statuses still need polling", () => {
    expect(LIVE_STATUSES).toContain("awaiting_engine");
    expect(isLive("running")).toBe(true);
    expect(isLive("failed")).toBe(false);
  });
});
