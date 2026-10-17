import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TOOL_KINDS, ToolSchema, toolCta, validateTool } from "@/content/tools/types";
import { FIXTURES, type ToolByKind } from "./fixtures/tools";
import { getTool, listTools } from "@/content/tools";

describe("tool schema", () => {
  it("accepts one valid definition per kind", () => {
    for (const kind of TOOL_KINDS) {
      const t = FIXTURES[kind];
      expect(t.kind).toBe(kind);
      expect(() => validateTool(t, `${kind}.json`)).not.toThrow();
      expect(validateTool(t)).toEqual(t);
    }
  });

  it("applies the call-to-action defaults", () => {
    expect(toolCta(FIXTURES.checklist)).toEqual({ label: "Turn this into a presenter video", href: "/sign-in?redirect_url=/studio/new" });
    expect(toolCta({ ...FIXTURES.checklist, ctaLabel: "Make it", ctaHref: "/pricing", ctaNote: "No card" })).toEqual({ label: "Make it", href: "/pricing", note: "No card" });
  });

  it("rejects unknown keys, bad ids and missing fields with the file name and path", () => {
    expect(() => validateTool({ ...FIXTURES.checklist, extra: 1 }, "x.json")).toThrow(/x\.json: invalid tool definition/);
    expect(() => validateTool({ ...FIXTURES.checklist, id: "Bad_Id" })).toThrow(/id: tool id/);
    expect(() => validateTool({ ...FIXTURES.checklist, ctaHref: "pricing" })).toThrow(/ctaHref/);
    expect(() => validateTool({ ...FIXTURES.checklist, kind: "widget" })).toThrow();
    expect(() => validateTool({ ...FIXTURES.generator, inputs: [{ id: "has-dash", type: "text", label: "x" }] })).toThrow(/inputs\.0\.id/);
  });

  it("generator: every placeholder must be an input, filters must exist, the budget input must be numeric", () => {
    const g = FIXTURES.generator;
    expect(() => validateTool({ ...g, variants: [{ label: "x", templates: ["{{brand}}"] }] })).toThrow(/no input "brand"/);
    expect(() => validateTool({ ...g, variants: [{ label: "x", templates: ["{{product|shout}}"] }] })).toThrow(/unknown filter "\|shout"/);
    expect(() => validateTool({ ...g, variants: [{ label: "x", templates: ["{{n:9-1}}"] }] })).toThrow(/malformed range/);
    expect(() => validateTool({ ...g, variants: [{ label: "x", templates: ["{{product}}"], when: { input: "missing", is: "a" } }] })).toThrow(/condition reads input "missing"/);
    expect(() => validateTool({ ...g, lengthBudget: { wordsPerSecond: 2.5, secondsInputId: "product" } })).toThrow(/number or select/);
    expect(() => validateTool({ ...g, inputs: [...g.inputs, { id: "product", type: "text", label: "dup" }] })).toThrow(/duplicate input id/);
    expect(() => validateTool({ ...g, inputs: [{ id: "angle", type: "select", label: "x", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], default: "c" }], variants: [{ label: "x", templates: ["{{angle}}"] }] })).toThrow(/not an option value/);
  });

  it("calculator: formulas must parse and only read inputs or earlier outputs", () => {
    const c = FIXTURES.calculator;
    expect(() => validateTool({ ...c, outputs: [{ id: "x", label: "x", formula: "price +", format: "usd" }] })).toThrow(/Unexpected end of formula/);
    expect(() => validateTool({ ...c, outputs: [{ id: "x", label: "x", formula: "later * 2", format: "usd" }, { id: "later", label: "y", formula: "1", format: "int" }] })).toThrow(/reads "later"/);
    expect(() => validateTool({ ...c, outputs: [{ id: "price", label: "x", formula: "1", format: "usd" }] })).toThrow(/already an input/);
    expect(() => validateTool({ ...c, table: { ...c.table!, rowVar: "price" } })).toThrow(/clashes/);
    expect(() => validateTool({ ...c, table: { ...c.table!, columns: [{ label: "x", formula: "unknown * units", format: "usd" }] } })).toThrow(/reads "unknown"/);
  });

  it("converter: each direction reads its own side plus params", () => {
    const v = FIXTURES.converter;
    expect(() => validateTool({ ...v, aToB: "seconds / pace" })).toThrow(/aToB/);
    expect(() => validateTool({ ...v, b: { ...v.b, id: "words" } })).toThrow(/must differ/);
  });

  it("checker: regexes must compile, rule ids must be unique", () => {
    const c = FIXTURES.checker;
    expect(() => validateTool({ ...c, ruleSets: [{ id: "x", label: "x", severity: "warn", pattern: "(", message: "m" }] })).toThrow(/does not compile/);
    expect(() => validateTool({ ...c, ruleSets: [{ id: "x", label: "x", severity: "warn", pattern: "a", flags: "g", message: "m" }] })).toThrow(/flags/);
    expect(() => validateTool({ ...c, stats: ["seconds@fast"] })).toThrow(/stat/);
    const r = { id: "x", label: "x", severity: "info", pattern: "a", message: "m" } as const;
    expect(() => validateTool({ ...c, ruleSets: [r, r] })).toThrow(/duplicate rule id/);
  });

  it("quiz: one scoring mode, full range coverage, every bucket answered", () => {
    const q = FIXTURES.quiz;
    expect(() => validateTool({ ...q, results: q.results.slice(0, 2) })).toThrow(/total of 4 points matches no result/);
    expect(() => validateTool({ ...q, results: [...q.results, { range: [3, 4], title: "x", body: "y" }] })).toThrow(/overlaps/);
    expect(() => validateTool({ ...q, questions: [{ q: "x", options: [{ label: "a", points: 1 }, { label: "b", bucket: "z" }] }] })).toThrow(/mixing/);
    const bucketQuiz: ToolByKind["quiz"] = {
      ...q,
      questions: [{ q: "x", options: [{ label: "a", bucket: "demo" }, { label: "b", bucket: "unboxing" }] }],
      results: [{ bucket: "demo", title: "Demo", body: "d" }, { bucket: "unboxing", title: "Unboxing", body: "u" }],
    };
    expect(() => validateTool(bucketQuiz)).not.toThrow();
    expect(() => validateTool({ ...bucketQuiz, results: bucketQuiz.results.slice(0, 1) })).toThrow(/bucket "unboxing" has no result/);
  });

  it("decision: every next exists, ids do not overlap, everything is reachable", () => {
    const d = FIXTURES.decision;
    expect(() => validateTool({ ...d, nodes: { ...d.nodes, start: { question: "x", options: [{ label: "a", next: "nowhere" }] } } })).toThrow(/neither a node nor a leaf/);
    expect(() => validateTool({ ...d, leaves: { ...d.leaves, lost: { title: "x", body: "y" } } })).toThrow(/can never be reached/);
    expect(() => validateTool({ ...d, leaves: { ...d.leaves, size: { title: "x", body: "y" } } })).toThrow(/both a node and a leaf/);
    expect(() => validateTool({ ...d, start: "size" })).toThrow(/can never be reached/);
  });

  it("brief: templates follow the generator rules", () => {
    const b = FIXTURES.brief;
    expect(() => validateTool({ ...b, docTitle: "{{brand}}" })).toThrow(/no input "brand"/);
    expect(() => validateTool({ ...b, sections: [{ heading: "x", template: "y", when: { input: "paid" } }] })).toThrow(/needs "is" or "not"/);
  });

  it("the documented interfaces and the schema agree", () => {
    const parsed = ToolSchema.parse(FIXTURES.generator);
    expect(parsed.kind).toBe("generator");
  });
});

describe("content/tools", () => {
  const dir = path.join(process.cwd(), "content", "tools");
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];

  it("every definition on disk validates and is named after its id", () => {
    for (const f of files) {
      const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      const tool = validateTool(data, `content/tools/${f}`);
      expect(`${tool.id}.json`, f).toBe(f);
    }
  });

  it("the loader exposes exactly those tools", () => {
    const tools = listTools();
    expect(tools.length).toBe(files.length);
    for (const t of tools) expect(getTool(t.id)).toEqual(t);
    expect(getTool("does-not-exist")).toBeNull();
    expect(getTool(null)).toBeNull();
  });
});
