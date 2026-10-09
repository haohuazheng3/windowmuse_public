import { describe, expect, it } from "vitest";
import { CREDIT_RULES, formatPrice, PACKS, perCreditUsd, PLANS, TRIAL } from "@/content/plans";
import { PRESENTERS } from "@/content/presenters";

describe("formatPrice", () => {
  it("prints whole dollars without cents", () => {
    expect(formatPrice(39)).toBe("$39");
    expect(formatPrice(299)).toBe("$299");
    expect(formatPrice(1500)).toBe("$1,500");
  });
  it("always shows two decimals for fractional amounts", () => {
    expect(formatPrice(3.5)).toBe("$3.50");
    expect(formatPrice(3.9)).toBe("$3.90");
    expect(formatPrice(2.99)).toBe("$2.99");
  });
  it("renders every per-credit price the pricing page shows", () => {
    expect(formatPrice(perCreditUsd(PACKS.pack10))).toBe("$3.50");
    expect(formatPrice(perCreditUsd(PLANS.starter))).toBe("$3.90");
    expect(formatPrice(perCreditUsd(PLANS.pro))).toBe("$2.99");
  });
});

describe("plan copy", () => {
  it("names the real presenter count instead of a literal", () => {
    for (const plan of Object.values(PLANS)) {
      expect(plan.features.some((f) => f.includes(`${PRESENTERS.length} presenters`))).toBe(true);
    }
  });
});

describe("CREDIT_RULES.resolutionNote", () => {
  it("allows everything on a 1080p plan with a capable engine", () => {
    expect(CREDIT_RULES.resolutionNote("480p", true, false, "1080p")).toBeNull();
    expect(CREDIT_RULES.resolutionNote("720p", true, false, "1080p")).toBeNull();
    expect(CREDIT_RULES.resolutionNote("1080p", true, false, "1080p")).toBeNull();
  });
  it("explains 1080p on plans without it", () => {
    expect(CREDIT_RULES.resolutionNote("1080p", false, false)).toMatch(/Growth and Pro/);
    expect(CREDIT_RULES.resolutionNote("720p", false, false)).toBeNull();
  });
  it("caps trial-only credits at the trial resolution", () => {
    expect(CREDIT_RULES.resolutionNote(TRIAL.resolution, false, true)).toBeNull();
    expect(CREDIT_RULES.resolutionNote("720p", false, true)).toMatch(/Trial credits/);
  });
  it("refuses what the engine cannot deliver yet, after the plan rules", () => {
    expect(CREDIT_RULES.resolutionNote("1080p", true, false, "720p")).toMatch(/video engine/);
    expect(CREDIT_RULES.resolutionNote("720p", true, false, "720p")).toBeNull();
    // The plan rule wins over the engine rule, so the seller hears about the upgrade first.
    expect(CREDIT_RULES.resolutionNote("1080p", false, false, "720p")).toMatch(/Growth and Pro/);
  });
  it("ignores an unknown engine ceiling", () => {
    expect(CREDIT_RULES.resolutionNote("1080p", true, false, undefined)).toBeNull();
  });
});
