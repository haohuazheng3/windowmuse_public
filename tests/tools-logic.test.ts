import { describe, expect, it } from "vitest";
import { pickVariants } from "@/components/tools/Generator";
import { runCalculator } from "@/components/tools/Calculator";
import { readingGrade, runChecker, sentenceCount } from "@/components/tools/Checker";
import { scoreQuiz } from "@/components/tools/Quiz";
import { briefMarkdown, buildBrief } from "@/components/tools/Brief";
import { checklistText } from "@/components/tools/Checklist";
import { formulaScope, initialValues, missingRequired, templateValues, whenMatches } from "@/components/tools/shared";
import type { CalculatorTool, CheckerTool, QuizTool } from "@/content/tools/types";
import { FIXTURES } from "./fixtures/tools";

describe("shared value conversions", () => {
  const g = FIXTURES.generator;
  it("initial values follow the input types and defaults", () => {
    expect(initialValues(g.inputs)).toEqual({ product: "", points: "", angle: "problem", seconds: "15", bold: false });
    expect(initialValues(FIXTURES.calculator.inputs)).toEqual({ price: 25, cost: 9, fee: "6" });
  });
  it("templates see option labels and yes/no; formulas see numbers", () => {
    const values = { ...initialValues(g.inputs), product: "Bottle", bold: true };
    expect(templateValues(g.inputs, values)).toMatchObject({ product: "Bottle", angle: "Problem → solution", seconds: "15 s", bold: true });
    expect(formulaScope(FIXTURES.calculator.inputs, { price: 25, cost: null, fee: "8" })).toEqual({ price: 25, cost: NaN, fee: 8 });
    expect(formulaScope([{ id: "on", type: "toggle", label: "x" }], { on: true })).toEqual({ on: 1 });
  });
  it("evaluates when-conditions against values", () => {
    expect(whenMatches({ input: "angle", is: "problem" }, { angle: "problem" })).toBe(true);
    expect(whenMatches({ input: "angle", is: ["demo", "unboxing"] }, { angle: "problem" })).toBe(false);
    expect(whenMatches({ input: "angle", not: "problem" }, { angle: "problem" })).toBe(false);
    expect(whenMatches({ input: "bold", is: "true" }, { bold: true })).toBe(true);
    expect(whenMatches({ input: "tags", is: "b" }, { tags: ["a", "b"] })).toBe(true);
    expect(whenMatches(undefined, {})).toBe(true);
    // A list of conditions: every one must hold.
    expect(whenMatches([{ input: "angle", is: "demo" }, { input: "seconds", is: ["10", "15"] }], { angle: "demo", seconds: "15" })).toBe(true);
    expect(whenMatches([{ input: "angle", is: "demo" }, { input: "seconds", is: ["10", "15"] }], { angle: "demo", seconds: "30" })).toBe(false);
  });
  it("lists required inputs that are empty", () => {
    expect(missingRequired(g.inputs, initialValues(g.inputs)).map((i) => i.id)).toEqual(["product", "points"]);
    expect(missingRequired(g.inputs, { ...initialValues(g.inputs), product: "x", points: "y" })).toEqual([]);
  });
});

describe("generator", () => {
  const g = FIXTURES.generator;
  it("picks variants deterministically, spread across the groups that apply", () => {
    const values = { ...initialValues(g.inputs), product: "Bottle", points: "keeps ice" };
    const a = pickVariants(g, values, 1);
    expect(a).toEqual(pickVariants(g, values, 1));
    expect(a.length).toBe(3);
    expect(new Set(a.map((v) => v.group))).toEqual(new Set(["Question", "Contrast"]));
    // The contrast group only applies to the problem angle.
    const demo = pickVariants(g, { ...values, angle: "demo" }, 1);
    expect(demo.length).toBe(2);
    expect(demo.every((v) => v.group === "Question")).toBe(true);
    // A bigger pool: different seeds pick different subsets, the same seed always the same one.
    const big = { ...g, count: 3, variants: [{ label: "Only", templates: Array.from({ length: 12 }, (_, i) => `Template ${i} for {{product}}`) }] };
    const s1 = pickVariants(big, values, 1).map((v) => v.key);
    const s2 = pickVariants(big, values, 2).map((v) => v.key);
    expect(s1).toEqual(pickVariants(big, values, 1).map((v) => v.key));
    expect(s1).not.toEqual(s2);
    expect(s1.length).toBe(3);
  });
});

describe("calculator", () => {
  it("computes outputs in order, later ones reading earlier ones", () => {
    const out = runCalculator(FIXTURES.calculator as CalculatorTool, { price: 25, cost: 9, fee: 6 });
    expect(out.feeUsd).toBeCloseTo(1.5);
    expect(out.margin).toBeCloseTo(14.5);
    expect(out.marginPct).toBeCloseTo(58);
    expect(Number.isNaN(runCalculator(FIXTURES.calculator as CalculatorTool, { price: NaN, cost: 9, fee: 6 }).margin)).toBe(true);
  });
});

describe("checker", () => {
  const c = FIXTURES.checker as CheckerTool;
  it("merges the studio lint with custom rules, sorted by position", () => {
    const f = runChecker(c, "I've been using this SERUM daily. Guaranteed results.");
    expect(f.map((x) => x.rule)).toEqual(["testimony", "first-person", "all-caps", "guaranteed"]);
    expect(f.find((x) => x.rule === "all-caps")).toMatchObject({ severity: "info", match: "SERUM", suggestion: "Use normal case." });
    expect(f.find((x) => x.rule === "guaranteed")?.severity).toBe("fatal");
    expect(runChecker(c, "Three pockets, one zip, fits a 14-inch laptop.")).toEqual([]);
  });
  it("stats helpers", () => {
    expect(sentenceCount("One. Two! Three? Four")).toBe(4);
    expect(readingGrade("The cat sat on the mat.")).toBeLessThan(3);
    expect(readingGrade("Comprehensive multidimensional considerations necessitate extraordinary deliberation.")).toBeGreaterThan(12);
    expect(Number.isNaN(readingGrade(""))).toBe(true);
  });
});

describe("quiz", () => {
  const q = FIXTURES.quiz as QuizTool;
  it("sums points into a range", () => {
    expect(scoreQuiz(q, [0, 0])?.title).toBe("Ready");
    expect(scoreQuiz(q, [1, 0])?.title).toBe("Almost");
    expect(scoreQuiz(q, [2, 1])?.title).toBe("Not yet");
    expect(scoreQuiz(q, [0])).toBeNull();
  });
  it("counts buckets, ties going to the first listed result", () => {
    const b: QuizTool = {
      ...q,
      questions: [
        { q: "a", options: [{ label: "x", bucket: "demo" }, { label: "y", bucket: "unboxing" }] },
        { q: "b", options: [{ label: "x", bucket: "demo" }, { label: "y", bucket: "unboxing" }] },
      ],
      results: [{ bucket: "unboxing", title: "Unboxing", body: "u" }, { bucket: "demo", title: "Demo", body: "d" }],
    };
    expect(scoreQuiz(b, [0, 0])?.title).toBe("Demo");
    expect(scoreQuiz(b, [0, 1])?.title).toBe("Unboxing");
  });
});

describe("brief and checklist", () => {
  it("builds a document from the inputs and exports Markdown", () => {
    const b = FIXTURES.brief;
    const doc = buildBrief(b, { product: "Bottle", points: "- keeps ice\n- one-hand lid", paid: true });
    expect(doc.title).toBe("Brief: Bottle");
    expect(doc.sections.map((s) => s.heading)).toEqual(["What to show", "Disclosure"]);
    expect(doc.sections[0].blocks).toEqual([
      { kind: "p", text: "The Bottle in use." },
      { kind: "ul", items: ["keeps ice", "one-hand lid"] },
    ]);
    expect(buildBrief(b, { product: "Bottle", points: "x", paid: false }).sections.map((s) => s.heading)).toEqual(["What to show"]);
    expect(briefMarkdown(doc)).toBe("# Brief: Bottle\n\n## What to show\n\nThe Bottle in use.\n\n- keeps ice\n- one-hand lid\n\n## Disclosure\n\nTurn on the paid partnership label.");
  });
  it("exports the checklist with ticks", () => {
    expect(checklistText(FIXTURES.checklist, new Set(["0:1"]))).toBe("Before you post\n\nLabels\n- [ ] AI-generated content switch on\n- [x] Commercial content disclosure on");
  });
});
