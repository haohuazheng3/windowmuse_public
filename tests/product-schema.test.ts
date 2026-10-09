import { describe, expect, it } from "vitest";
import { CATEGORY_VALUES, firstIssue, productInputSchema } from "@/lib/product-schema";

describe("product form schema", () => {
  it("accepts a minimal product and turns empty optionals into undefined", () => {
    const r = productInputSchema.safeParse({ name: "  Lunch box ", category: "kitchen", sellingPoints: ["Folds flat"], brand: "   ", shopUrl: "" });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.name).toBe("Lunch box");
    expect(r.data.brand).toBeUndefined();
    expect(r.data.shopUrl).toBeUndefined();
  });

  it("rejects more than five selling points, empty ones, and non-http shop links", () => {
    const six = productInputSchema.safeParse({ name: "x", category: "home", sellingPoints: ["1", "2", "3", "4", "5", "6"] });
    expect(six.success).toBe(false);
    const empty = productInputSchema.safeParse({ name: "x", category: "home", sellingPoints: [] });
    expect(empty.success).toBe(false);
    if (!empty.success) expect(firstIssue(empty.error)).toMatch(/at least one selling point/i);
    const bad = productInputSchema.safeParse({ name: "x", category: "home", sellingPoints: ["ok"], shopUrl: "tiktok.com/shop" });
    expect(bad.success).toBe(false);
    if (!bad.success) expect(firstIssue(bad.error)).toMatch(/https:\/\//);
    const good = productInputSchema.safeParse({ name: "x", category: "home", sellingPoints: ["ok"], shopUrl: "https://www.tiktok.com/shop/x" });
    expect(good.success).toBe(true);
  });

  it("only knows the categories the database knows", () => {
    expect(CATEGORY_VALUES).toContain("other");
    const r = productInputSchema.safeParse({ name: "x", category: "weapons", sellingPoints: ["ok"] });
    expect(r.success).toBe(false);
  });
});
