import { afterEach, describe, expect, it, vi } from "vitest";
import { CHECKOUT_BRAND, checkoutMetadata, stripeEnvTag } from "@/lib/stripe";

afterEach(() => vi.unstubAllEnvs());

/*
 * Everything a buyer reads before paying must say WindowMuse, and the card statement must
 * fit Stripe's 22-character limit once the account's own prefix is in front of it.
 */
describe("Checkout brand", () => {
  it("fits the card statement: 10-character prefix + '* ' + suffix ≤ 22, Latin letters, no reserved characters", () => {
    const suffix = CHECKOUT_BRAND.statementSuffix;
    expect(suffix).toBe("WINDOWMUSE");
    expect(suffix.length).toBe(10);
    expect(10 + "* ".length + suffix.length).toBeLessThanOrEqual(22);
    expect(suffix).toMatch(/^[\x20-\x7E]+$/);
    expect(suffix).toMatch(/[A-Za-z]/);
    expect(suffix).not.toMatch(/[<>\\'"*]/);
  });

  it("shows the brand name as text with a small icon, never a logo image", () => {
    expect(CHECKOUT_BRAND.displayName).toBe("WindowMuse");
    expect(CHECKOUT_BRAND.iconUrl).toMatch(/\/brand\/logo-512\.png$/);
    expect(CHECKOUT_BRAND).not.toHaveProperty("logoUrl");
    expect(CHECKOUT_BRAND).not.toHaveProperty("logo");
  });

  it("names the brand in the note under the pay button and uses the site accent on the button", () => {
    expect(CHECKOUT_BRAND.submitNote).toContain("WindowMuse");
    expect(CHECKOUT_BRAND.submitNote.length).toBeLessThanOrEqual(500); // Stripe's custom_text limit
    expect(CHECKOUT_BRAND.buttonColor).toBe("#E8562A");
    expect(CHECKOUT_BRAND.site).toBe("windowmuse");
  });

  it("stamps every session, subscription and payment intent with site, env, user and sku", () => {
    const meta = checkoutMetadata("user_abc", "growth");
    expect(meta).toEqual({ site: "windowmuse", env: stripeEnvTag(), userId: "user_abc", sku: "growth" });
    // Stripe metadata values are strings of at most 500 characters.
    for (const v of Object.values(meta)) {
      expect(typeof v).toBe("string");
      expect(v.length).toBeLessThanOrEqual(500);
    }
  });
});
