import { describe, expect, it } from "vitest";
import { costFor, DURATIONS, RESOLUTIONS, type DurationSec, type Resolution } from "@/content/plans";

/** The credit table every seller sees on the Generate pane; a change here is a pricing change. */
const TABLE: Record<Resolution, Record<DurationSec, number>> = {
  "480p": { 10: 1, 15: 1, 20: 2, 30: 2 },
  "720p": { 10: 1, 15: 1, 20: 2, 30: 2 },
  "1080p": { 10: 2, 15: 2, 20: 4, 30: 4 },
};

describe("costFor", () => {
  for (const resolution of RESOLUTIONS) {
    for (const durationSec of DURATIONS) {
      it(`${durationSec} s at ${resolution} costs ${TABLE[resolution][durationSec]}`, () => {
        expect(costFor({ durationSec, resolution })).toBe(TABLE[resolution][durationSec]);
      });
    }
  }
  it("treats 480p exactly like 720p", () => {
    for (const durationSec of DURATIONS) expect(costFor({ durationSec, resolution: "480p" })).toBe(costFor({ durationSec, resolution: "720p" }));
  });
  it("switches to 2 credits right after 15 seconds", () => {
    expect(costFor({ durationSec: 15, resolution: "720p" })).toBe(1);
    expect(costFor({ durationSec: 16, resolution: "720p" })).toBe(2);
  });
});
