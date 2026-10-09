import { describe, expect, it } from "vitest";
import { costFor, CREDIT_RULES, PACKS, PLANS, TRIAL } from "@/content/plans";
import { isUsable, lotExpiryFor, orderForDebit, planReservation, remainingFromEvents, sumAvailable, trialExpiry } from "@/lib/credits";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-09T12:00:00Z");
const lot = (id: string, remaining: number, expiresInDays: number | null, createdDaysAgo = 0, status = "active") => ({
  id,
  remaining,
  total: remaining,
  expiresAt: expiresInDays === null ? null : new Date(now.getTime() + expiresInDays * DAY),
  createdAt: new Date(now.getTime() - createdDaysAgo * DAY),
  status,
});

describe("credit cost", () => {
  it("charges 1 credit for ≤15 s at 720p and 480p, 2 for 16–30 s", () => {
    expect(costFor({ durationSec: 10, resolution: "720p" })).toBe(1);
    expect(costFor({ durationSec: 15, resolution: "720p" })).toBe(1);
    expect(costFor({ durationSec: 15, resolution: "480p" })).toBe(1);
    expect(costFor({ durationSec: 20, resolution: "720p" })).toBe(2);
    expect(costFor({ durationSec: 30, resolution: "480p" })).toBe(2);
  });
  it("doubles for 1080p", () => {
    expect(costFor({ durationSec: 15, resolution: "1080p" })).toBe(2);
    expect(costFor({ durationSec: 30, resolution: "1080p" })).toBe(4);
  });
  it("describes the cost in words", () => {
    expect(CREDIT_RULES.describeCost({ durationSec: 15, resolution: "720p" })).toBe("15 s at 720p: 1 credit");
    expect(CREDIT_RULES.describeCost({ durationSec: 30, resolution: "1080p" })).toBe("30 s at 1080p: 4 credits");
  });
  it("keeps the published prices", () => {
    expect([PLANS.starter.priceUsd, PLANS.starter.credits]).toEqual([39, 10]);
    expect([PLANS.growth.priceUsd, PLANS.growth.credits]).toEqual([99, 30]);
    expect([PLANS.pro.priceUsd, PLANS.pro.credits]).toEqual([299, 100]);
    expect([PACKS.pack10.priceUsd, PACKS.pack10.credits]).toEqual([35, 10]);
    expect([PACKS.pack50.priceUsd, PACKS.pack50.credits]).toEqual([150, 50]);
    expect(TRIAL).toMatchObject({ credits: 2, expiryDays: 30, resolution: "480p" });
  });
});

describe("lot selection (FIFO by expiry)", () => {
  it("ignores expired, empty and revoked lots", () => {
    const lots = [lot("expired", 5, -1), lot("empty", 0, 10), lot("revoked", 5, 10, 0, "revoked"), lot("ok", 3, 10)];
    expect(lots.filter((l) => isUsable(l, now)).map((l) => l.id)).toEqual(["ok"]);
    expect(sumAvailable(lots, now)).toBe(3);
  });
  it("takes from the earliest-expiring lot first, never-expiring lots last", () => {
    const lots = [lot("forever", 10, null), lot("late", 10, 60), lot("soon", 10, 5)];
    expect(orderForDebit(lots, now).map((l) => l.id)).toEqual(["soon", "late", "forever"]);
  });
  it("breaks expiry ties by age", () => {
    const lots = [lot("newer", 1, 30, 1), lot("older", 1, 30, 10)];
    expect(orderForDebit(lots, now).map((l) => l.id)).toEqual(["older", "newer"]);
  });
  it("splits a reservation across lots and refuses when short", () => {
    const lots = [lot("a", 1, 5), lot("b", 2, 20), lot("c", 5, null)];
    expect(planReservation(lots, 1, now)).toEqual([{ lotId: "a", take: 1 }]);
    expect(planReservation(lots, 4, now)).toEqual([
      { lotId: "a", take: 1 },
      { lotId: "b", take: 2 },
      { lotId: "c", take: 1 },
    ]);
    expect(planReservation(lots, 8, now)).toEqual([
      { lotId: "a", take: 1 },
      { lotId: "b", take: 2 },
      { lotId: "c", take: 5 },
    ]);
    expect(planReservation(lots, 9, now)).toBeNull();
    expect(planReservation(lots, 0, now)).toBeNull();
    expect(planReservation(lots, 1.5, now)).toBeNull();
  });
});

describe("ledger arithmetic", () => {
  it("rebuilds remaining from reserve/release only; debits move nothing", () => {
    expect(remainingFromEvents(10, [])).toBe(10);
    expect(remainingFromEvents(10, [{ kind: "reserve", amount: 3 }])).toBe(7);
    expect(remainingFromEvents(10, [{ kind: "reserve", amount: 3 }, { kind: "debit", amount: 3 }])).toBe(7);
    expect(remainingFromEvents(10, [{ kind: "reserve", amount: 3 }, { kind: "release", amount: 3 }])).toBe(10);
    expect(remainingFromEvents(10, [{ kind: "grant", amount: 10 }, { kind: "revoke", amount: 10 }])).toBe(10);
  });
  it("never goes below zero or above the total", () => {
    expect(remainingFromEvents(2, [{ kind: "reserve", amount: 5 }])).toBe(0);
    expect(remainingFromEvents(2, [{ kind: "release", amount: 5 }])).toBe(2);
  });
});

describe("lot expiry", () => {
  const periodEnd = new Date("2026-11-09T00:00:00Z");
  it("Starter credits expire with the billing period", () => {
    expect(lotExpiryFor("starter", { periodEnd }).toISOString()).toBe(periodEnd.toISOString());
  });
  it("Growth and Pro credits roll over 30 days past the period", () => {
    expect(lotExpiryFor("growth", { periodEnd }).getTime()).toBe(periodEnd.getTime() + 30 * DAY);
    expect(lotExpiryFor("pro", { periodEnd }).getTime()).toBe(periodEnd.getTime() + 30 * DAY);
  });
  it("packs last 90 days from purchase", () => {
    expect(lotExpiryFor("pack10", { purchasedAt: now }).getTime()).toBe(now.getTime() + 90 * DAY);
    expect(lotExpiryFor("pack50", { purchasedAt: now }).getTime()).toBe(now.getTime() + 90 * DAY);
  });
  it("a plan without a period end is a programming error", () => {
    expect(() => lotExpiryFor("starter", {})).toThrow();
  });
  it("the trial lasts 30 days", () => {
    expect(trialExpiry(now).getTime()).toBe(now.getTime() + 30 * DAY);
  });
});
