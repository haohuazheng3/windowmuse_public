import { describe, expect, it } from "vitest";
import { FILTERS, countWords, createRng, hashString, invalidRanges, placeholderIds, renderTemplate, seededShuffle, splitLines, tidy, unknownFilters } from "@/components/tools/templating";

describe("seeded randomness", () => {
  it("is deterministic per seed and differs between seeds", () => {
    const a = createRng(42);
    const b = createRng(42);
    const c = createRng(43);
    const sa = [a(), a(), a()];
    expect(sa).toEqual([b(), b(), b()]);
    expect(sa).not.toEqual([c(), c(), c()]);
    for (const v of sa) expect(v >= 0 && v < 1).toBe(true);
  });

  it("hashes strings stably", () => {
    expect(hashString("bottle")).toBe(hashString("bottle"));
    expect(hashString("bottle")).not.toBe(hashString("Bottle"));
    expect(hashString("")).toBe(0x811c9dc5);
  });

  it("shuffles without mutating and reproducibly", () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const s1 = seededShuffle(items, 7);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(seededShuffle(items, 7)).toEqual(s1);
    expect([...s1].sort((x, y) => x - y)).toEqual(items);
    expect(seededShuffle(items, 8)).not.toEqual(s1);
  });
});

describe("placeholders", () => {
  const values = { product: " Insulated bottle ", points: "- keeps ice 24 h\n- one-hand lid\n\n3. dishwasher safe", audience: ["Hikers", "Parents"], count: 3, pro: true, empty: "" };

  it("substitutes values and trims", () => {
    expect(renderTemplate("Meet the {{product}}.", values).text).toBe("Meet the Insulated bottle.");
    expect(renderTemplate("For {{audience}}: {{count}} reasons, pro {{pro}}", values).text).toBe("For Hikers, Parents: 3 reasons, pro yes");
  });

  it("applies filters left to right", () => {
    expect(renderTemplate("{{product|lower}}", values).text).toBe("insulated bottle");
    expect(renderTemplate("{{product|upper}}", values).text).toBe("INSULATED BOTTLE");
    expect(renderTemplate("{{points|first|cap}}", values).text).toBe("Keeps ice 24 h");
    expect(renderTemplate("{{points|second}} / {{points|third}} / {{points|last}}", values).text).toBe("one-hand lid / dishwasher safe / dishwasher safe");
    expect(renderTemplate("{{points|count}} points: {{points|list}}", values).text).toBe("3 points: keeps ice 24 h, one-hand lid and dishwasher safe");
    expect(renderTemplate("{{audience|list}}", values).text).toBe("Hikers and Parents");
    expect(renderTemplate("{{points|bullets}}", values).text).toBe("- keeps ice 24 h\n- one-hand lid\n- dishwasher safe");
    expect(FILTERS.cap("")).toBe("");
  });

  it("reports empty and unknown inputs as missing", () => {
    const r = renderTemplate("{{product}} {{empty}} {{nope}}", values);
    expect(r.text).toBe("Insulated bottle");
    expect(r.missing).toEqual(["empty", "nope"]);
  });

  it("picks literals and numbers deterministically from the seed", () => {
    const t = "{{pick:Still|Tired of|Done with}} warm water? {{n:1-5}} reasons.";
    const a = renderTemplate(t, values, { seed: 3 }).text;
    expect(a).toBe(renderTemplate(t, values, { seed: 3 }).text);
    expect(a).toMatch(/^(Still|Tired of|Done with) warm water\? [1-5] reasons\.$/);
    const seen = new Set<string>();
    for (let s = 1; s <= 40; s++) seen.add(renderTemplate(t, values, { seed: s }).text);
    expect(seen.size).toBeGreaterThan(3);
  });

  it("tidies spacing and punctuation after substitution", () => {
    expect(tidy("Hello ,  world .. Done ( ) !")).toBe("Hello, world. Done!");
    expect(renderTemplate("{{empty}} , it works {{empty}}.", values).text).toBe(", it works.");
    expect(tidy("a\n\n\n\nb")).toBe("a\n\nb");
  });

  it("lists the input ids a template reads and the filters it does not know", () => {
    expect(placeholderIds("{{a|lower}} {{pick:x|y}} {{n:1-3}} {{b}} {{a}}")).toEqual(["a", "b"]);
    expect(unknownFilters("{{a|lower|shout}} {{b|first}}")).toEqual(["shout"]);
    expect(invalidRanges("{{n:1-5}} {{n:5-1}} {{n:x}}")).toEqual(["{{n:5-1}}", "{{n:x}}"]);
  });

  it("splits textarea lines and strips bullets", () => {
    expect(splitLines("- a\n* b\n• c\n1. d\n2) e\n\n  f  ")).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(splitLines(null)).toEqual([]);
    expect(splitLines(["x", " ", "y"])).toEqual(["x", "y"]);
    expect(splitLines(4)).toEqual(["4"]);
  });

  it("counts words the way the studio does", () => {
    expect(countWords("Still drinking warm water by lunch?")).toBe(6);
    expect(countWords("  --  ")).toBe(0);
  });
});
