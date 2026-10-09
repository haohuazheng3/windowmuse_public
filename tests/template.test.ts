import { describe, expect, it } from "vitest";
import { lintScript } from "@/lib/scripts/lint";
import { writeTemplateScript } from "@/lib/scripts/template";
import { ANGLES, countWords, fitToBudget, MAX_HOOK_WORDS, TONES, wordBudget, type ScriptInput } from "@/lib/scripts/types";
import { DURATIONS } from "@/content/plans";

const base: ScriptInput = {
  product: {
    name: "Cloud Mug",
    brand: "Nimbus",
    category: "kitchen",
    sellingPoints: ["Double-walled ceramic keeps coffee hot for 40 minutes", "Fits every cup holder", "Dishwasher safe, no coating to peel", "Matte glaze in four colours"],
    audience: "people who drink their coffee slowly",
  },
  language: "en",
  tone: "friendly",
  angle: "demo",
  durationSec: 15,
};

describe("writeTemplateScript", () => {
  it("fits the 2.5 words-per-second budget for every angle, tone and length", () => {
    for (const angle of ANGLES) {
      for (const tone of TONES) {
        for (const durationSec of DURATIONS) {
          const draft = writeTemplateScript({ ...base, angle, tone, durationSec });
          expect(countWords(draft.fullText), `${angle}/${tone}/${durationSec}`).toBeLessThanOrEqual(wordBudget(durationSec));
          expect(countWords(draft.hook), `${angle}/${tone} hook`).toBeLessThanOrEqual(MAX_HOOK_WORDS);
          expect(draft.hook).not.toBe("");
          expect(draft.cta).not.toBe("");
          expect(draft.source).toBe("template");
        }
      }
    }
  });

  it("passes its own compliance check with no fatal findings and no first-person warning", () => {
    for (const angle of ANGLES) {
      for (const tone of TONES) {
        const draft = writeTemplateScript({ ...base, angle, tone, durationSec: 30 });
        const lint = lintScript(draft.fullText);
        expect(lint.fatal, `${angle}/${tone}: ${draft.fullText}`).toEqual([]);
        expect(lint.warn.map((w) => w.rule), `${angle}/${tone}: ${draft.fullText}`).not.toContain("first-person");
      }
    }
  });

  it("only speaks from the seller's selling points", () => {
    const draft = writeTemplateScript({ ...base, angle: "three-reasons", durationSec: 30 });
    expect(draft.body).toContain("40 minutes");
    expect(draft.body).toContain("cup holder");
    expect(draft.fullText).not.toMatch(/\bI\b/);
  });

  it("is deterministic and varies between products", () => {
    const a = writeTemplateScript(base);
    const b = writeTemplateScript(base);
    expect(a).toEqual(b);
    const other = writeTemplateScript({ ...base, product: { ...base.product, name: "Trail Lamp", category: "outdoors-not-a-category" } });
    expect(other.hook).not.toBe(a.hook);
  });

  it("counts in the hook only the reasons that are actually spoken", () => {
    const two = writeTemplateScript({ ...base, product: { ...base.product, sellingPoints: base.product.sellingPoints.slice(0, 2) }, angle: "three-reasons", tone: "friendly", durationSec: 30 });
    expect(two.hook).toMatch(/two/i);
    expect(two.body).toContain("Reason two");
    const tight = writeTemplateScript({ ...base, angle: "three-reasons", tone: "calm-expert", durationSec: 10 });
    const spoken = (tight.body.match(/Reason (one|two|three)/g) ?? []).length;
    expect(tight.hook.toLowerCase()).toContain(["", "one", "two", "three"][spoken]!);
  });

  it("writes English with a note for other languages", () => {
    const es = writeTemplateScript({ ...base, language: "es" });
    expect(es.note).toContain("Spanish");
    expect(writeTemplateScript(base).note).toBeUndefined();
  });

  it("never claims personal experience in the unboxing or problem angles", () => {
    for (const angle of ["unboxing", "problem-solution"] as const) {
      const d = writeTemplateScript({ ...base, angle, tone: "playful", durationSec: 20 });
      expect(d.fullText).not.toMatch(/\b(I've|I bought|my skin|my experience)\b/i);
    }
  });
});

describe("word helpers", () => {
  it("counts spoken words and converts CJK characters", () => {
    expect(countWords("Three pockets, one zip.")).toBe(4);
    expect(countWords("  ")).toBe(0);
    expect(countWords("这个杯子保温四十分钟")).toBe(Math.round(10 / 1.6));
  });
  it("trims body sentences from the end to meet a budget, keeping hook and cta", () => {
    const d = { hook: "Look at this.", body: "First sentence here. Second sentence here. Third sentence here.", cta: "Tap the link." };
    const fitted = fitToBudget(d, 10);
    expect(fitted.hook).toBe(d.hook);
    expect(fitted.cta).toBe(d.cta);
    expect(fitted.body).toBe("First sentence here.");
    expect(fitToBudget(d, 100)).toBe(d);
  });
});
