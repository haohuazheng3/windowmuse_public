import { afterEach, describe, expect, it, vi } from "vitest";
import { missingEnv } from "@/lib/env";
import { CHECKOUT_BRAND, paymentsEnabled, stripeMode } from "@/lib/stripe";

// Fake keys are assembled at runtime so the repository never contains key-shaped literals.
const key = (...parts: string[]) => parts.join("_");

afterEach(() => vi.unstubAllEnvs());

describe("Stripe keys", () => {
  it("reads the mode from the key prefix; organization keys count as live", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    expect(stripeMode()).toBe("missing");
    for (const k of [key("sk", "live", "x"), key("rk", "live", "x"), key("sk", "org", "x")]) {
      vi.stubEnv("STRIPE_SECRET_KEY", k);
      expect(stripeMode()).toBe("live");
    }
    for (const k of [key("sk", "test", "x"), key("rk", "test", "x")]) {
      vi.stubEnv("STRIPE_SECRET_KEY", k);
      expect(stripeMode()).toBe("test");
    }
  });

  it("asks for STRIPE_CONTEXT only when the key is an organization key", () => {
    vi.stubEnv("STRIPE_CONTEXT", "");
    vi.stubEnv("STRIPE_SECRET_KEY", key("rk", "live", "x"));
    expect(missingEnv()).not.toContain("STRIPE_CONTEXT");
    vi.stubEnv("STRIPE_SECRET_KEY", key("sk", "org", "x"));
    expect(missingEnv()).toContain("STRIPE_CONTEXT");
    vi.stubEnv("STRIPE_CONTEXT", "acct_123");
    expect(missingEnv()).not.toContain("STRIPE_CONTEXT");
  });

  it("refuses checkout for an offer whose price id is missing", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", key("sk", "test", "x"));
    vi.stubEnv("STRIPE_PRICE_GROWTH", "");
    expect(paymentsEnabled("growth").ok).toBe(false);
    vi.stubEnv("STRIPE_PRICE_GROWTH", "price_123");
    expect(paymentsEnabled("growth").ok).toBe(true);
  });
});

describe("Checkout brand", () => {
  it("fits the card statement: 10-character prefix + '* ' + suffix ≤ 22, Latin, no reserved characters", () => {
    const suffix = CHECKOUT_BRAND.statementSuffix;
    expect(10 + 2 + suffix.length).toBeLessThanOrEqual(22);
    expect(suffix).toMatch(/^[\x20-\x7E]+$/);
    expect(suffix).toMatch(/[A-Za-z]/);
    expect(suffix).not.toMatch(/[<>\\'"*]/);
  });

  it("shows the brand name as text, not a logo", () => {
    expect(CHECKOUT_BRAND.displayName).toBe("WindowMuse");
    expect(CHECKOUT_BRAND.site).toBe("windowmuse");
    expect(CHECKOUT_BRAND).not.toHaveProperty("logoUrl");
  });
});
