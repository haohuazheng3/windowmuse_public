/**
 * Interactive tools for tool-first guides: one JSON file per tool at content/tools/<id>.json
 * (the file name must equal the tool's `id`). The blog page that embeds a tool names it in
 * its frontmatter (`tool: <id>`); the server validates every file with the zod schema at
 * build time and hands exactly one tool to the client renderer as plain data.
 *
 * This file is the whole contract. The TypeScript interfaces document every field; the zod
 * schema below enforces them (unknown keys are rejected, so a typo fails the build instead
 * of silently doing nothing) and adds the cross-field rules listed under each kind.
 *
 * ── Fields shared by every tool ─────────────────────────────────────────────────────────
 *   id          lower-case letters, digits and hyphens; equals the file name
 *   kind        generator | calculator | converter | checker | quiz | decision | checklist | brief
 *   title       H2 at the top of the tool pane (the article title stays the page's H1)
 *   lede        one sentence under the title: what the tool does and for whom
 *   ctaLabel?   button text of the studio call to action, default "Turn this into a presenter video"
 *   ctaHref?    default "/sign-in?redirect_url=/studio/new"
 *   ctaNote?    one line under the call to action (e.g. "2 free videos at 480p, no card needed")
 *   schemaName? WebApplication name in the page's JSON-LD, default `title`
 *
 * ── Inputs (generator, brief, and the numeric subset for calculator/converter) ──────────
 *   id must be a formula/template identifier: a letter, then letters, digits or underscores.
 *   text        single line            textarea  several lines (list filters read the lines)
 *   select      one option             multiselect  several options
 *   number      numeric with unit      toggle    yes / no
 *   In templates a select prints its option *label*; in formulas it is Number(option value);
 *   a toggle prints "yes"/"no" in templates and is 1/0 in formulas.
 *
 * ── Conditions (`when`) on generator variant groups and brief sections ─────────────────
 *   { input: "<id>", is: "value" | ["v1","v2"] }   the group/section is used only when the
 *   { input: "<id>", not: "value" | [...] }        input's value matches (a toggle's value is
 *                                                  "true"/"false"; a multiselect matches when
 *                                                  it includes the value).
 */

import { z } from "zod";
import { compileFormula, FormulaError, type OutputFormat } from "@/components/tools/formulas";
import { invalidRanges, placeholderIds, unknownFilters } from "@/components/tools/templating";

export const TOOL_KINDS = ["generator", "calculator", "converter", "checker", "quiz", "decision", "checklist", "brief"] as const;
export type ToolKind = (typeof TOOL_KINDS)[number];

export const DEFAULT_CTA_HREF = "/sign-in?redirect_url=/studio/new";
export const DEFAULT_CTA_LABEL = "Turn this into a presenter video";
export const DEFAULT_VARIANT_COUNT = 5;
export const DEFAULT_WORDS_PER_SECOND = 2.5;

/* ─────────────────────────── shared pieces ─────────────────────────── */

export interface Cta {
  label: string;
  /** Site path ("/pricing") or https URL. */
  href: string;
}

export interface SelectOption {
  /** Stable key; what `when` conditions compare against and what formulas read as a number. */
  value: string;
  /** What the seller sees, and what templates print. */
  label: string;
}

interface InputBase {
  id: string;
  label: string;
  /** One line under the label. */
  help?: string;
}

export interface TextInput extends InputBase {
  type: "text";
  placeholder?: string;
  default?: string;
  maxLength?: number;
  /** Generator/brief: output waits until this input has a value. */
  required?: boolean;
}

export interface TextareaInput extends InputBase {
  type: "textarea";
  placeholder?: string;
  default?: string;
  maxLength?: number;
  /** Visible rows, default 4. */
  rows?: number;
  required?: boolean;
}

export interface SelectInput extends InputBase {
  type: "select";
  options: SelectOption[];
  /** Option value; default = the first option. */
  default?: string;
  /** Render as chips (default when ≤ 5 options) or a dropdown. */
  display?: "chips" | "dropdown";
}

export interface MultiselectInput extends InputBase {
  type: "multiselect";
  options: SelectOption[];
  /** Option values selected at first render. */
  default?: string[];
  /** Upper bound on selected options. */
  max?: number;
}

export interface NumberInput extends InputBase {
  type: "number";
  /** Shown after the field: "$", "%", "s", "words". */
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Empty when omitted (formulas then see NaN and print "—"). */
  default?: number;
  placeholder?: string;
}

export interface ToggleInput extends InputBase {
  type: "toggle";
  default?: boolean;
  /** Labels on the switch, default "Yes" / "No". */
  onLabel?: string;
  offLabel?: string;
}

export type InputDef = TextInput | TextareaInput | SelectInput | MultiselectInput | NumberInput | ToggleInput;
/** The inputs a formula can read. */
export type NumericInputDef = NumberInput | SelectInput | ToggleInput;

export interface When {
  input: string;
  is?: string | string[];
  not?: string | string[];
}

interface ToolBase {
  id: string;
  title: string;
  lede: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaNote?: string;
  schemaName?: string;
}

/* ─────────────────────────── generator ─────────────────────────── */

export interface VariantGroup {
  /** Shown as a tag on each output from this group, e.g. "Question hook". */
  label: string;
  /** Templates (see templating.ts for the placeholder syntax). */
  templates: string[];
  /** Use this group only when an input has (or lacks) a value; a list means every condition must hold. */
  when?: When | When[];
}

/**
 * Inputs → N text variants. Templates come from the variant groups that apply; the N shown
 * are chosen by a seed the seller can reshuffle ("Generate again"), spread across groups,
 * and rendered with the inputs. Rules: every `{{id}}` must name an input; filters must exist;
 * `lengthBudget.secondsInputId` must be a number or select input.
 */
export interface GeneratorTool extends ToolBase {
  kind: "generator";
  inputs: InputDef[];
  variants: VariantGroup[];
  /** Variants shown at once, 1–12, default 5. */
  count?: number;
  /** Run the studio's compliance check on every variant and show findings inline. */
  postProcess?: "scriptLint";
  /** Show words vs. the spoken budget (seconds input × words per second) on every variant. */
  lengthBudget?: { wordsPerSecond: number; secondsInputId: string };
  /** Button labels, default "Generate" / "Generate again". */
  generateLabel?: string;
  againLabel?: string;
}

/* ─────────────────────────── calculator ─────────────────────────── */

export interface CalcOutput {
  /** Identifier later outputs and the table may read. */
  id: string;
  label: string;
  /** Expression over input ids and earlier output ids (grammar in formulas.ts). */
  formula: string;
  format: OutputFormat;
  /** One line under the value: what it assumes. */
  note?: string;
  /** Shown large; default = the first output. */
  primary?: boolean;
}

export interface CalcTable {
  /** Heading above the table. */
  label?: string;
  /** Identifier the row's value is bound to inside column formulas. */
  rowVar: string;
  /** The row values, e.g. [10, 15, 20, 30, 45, 60]. */
  rows: number[];
  /** Header of the row column, e.g. "Seconds". */
  rowLabel: string;
  rowFormat: OutputFormat;
  columns: { label: string; formula: string; format: OutputFormat }[];
}

/**
 * Numeric inputs → outputs, recomputed on every keystroke. Rules: output ids are unique and
 * distinct from input ids; every formula parses; an output may only read inputs and outputs
 * listed before it; table column formulas may read inputs, every output and `rowVar`.
 */
export interface CalculatorTool extends ToolBase {
  kind: "calculator";
  inputs: NumericInputDef[];
  outputs: CalcOutput[];
  table?: CalcTable;
  /** Small print under the results: sources, assumptions. */
  note?: string;
}

/* ─────────────────────────── converter ─────────────────────────── */

export interface ConverterSide {
  id: string;
  label: string;
  unit?: string;
  format: OutputFormat;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Two fields that convert into each other; editing either side recomputes the other.
 * `aToB` reads `a.id` plus params; `bToA` reads `b.id` plus params.
 */
export interface ConverterTool extends ToolBase {
  kind: "converter";
  a: ConverterSide;
  b: ConverterSide;
  /** Shared settings, e.g. a "pace" select with option values "2", "2.5", "3". */
  params?: NumericInputDef[];
  aToB: string;
  bToA: string;
  note?: string;
}

/* ─────────────────────────── checker ─────────────────────────── */

export type Severity = "fatal" | "warn" | "info";

export interface CheckerRule {
  id: string;
  label: string;
  severity: Severity;
  /** Regular-expression source, tested globally against the text. */
  pattern: string;
  /** Subset of "imsu"; "i" is the usual choice. */
  flags?: string;
  /** What is wrong. */
  message: string;
  /** How to say it instead. */
  suggestion?: string;
}

/** "seconds@2.5" = spoken length at 2.5 words per second. */
/** "seconds@2.5" = spoken length at 2.5 words per second; "read@238" = silent reading time at 238 words per minute. */
export type CheckerStat = "words" | "sentences" | "characters" | "readingLevel" | `seconds@${number}` | `read@${number}`;

/**
 * Textarea → findings grouped by severity with the matches highlighted. "scriptLint" adds
 * the studio's compliance rules (src/lib/scripts/lint.ts); custom rules are regexes.
 */
export interface CheckerTool extends ToolBase {
  kind: "checker";
  input: { label: string; placeholder?: string; maxLength?: number; default?: string; rows?: number };
  ruleSets: ("scriptLint" | CheckerRule)[];
  stats?: CheckerStat[];
  /** Heading of the all-clear state, default "No issues found". */
  successText?: string;
}

/* ─────────────────────────── quiz ─────────────────────────── */

export interface QuizOption {
  label: string;
  /** Points mode: added up, the total picks a result by `range`. */
  points?: number;
  /** Bucket mode: the most frequent bucket picks the result with that `bucket`. */
  bucket?: string;
}

export interface QuizQuestion {
  q: string;
  help?: string;
  options: QuizOption[];
}

export interface QuizResult {
  bucket?: string;
  /** Inclusive total-points range. */
  range?: [number, number];
  title: string;
  body: string;
  cta?: Cta;
}

/**
 * One question at a time with a progress bar, then a result pane with copy/share. Every
 * option must use the same mode (all `points` or all `bucket`); in points mode the ranges
 * must cover every reachable total without overlapping; in bucket mode every bucket named
 * by an option needs a result.
 */
export interface QuizTool extends ToolBase {
  kind: "quiz";
  questions: QuizQuestion[];
  results: QuizResult[];
  /** How the result is worked out, shown under it. */
  method?: string;
}

/* ─────────────────────────── decision ─────────────────────────── */

export interface DecisionNode {
  question: string;
  help?: string;
  /** `next` is a node id or a leaf id. */
  options: { label: string; next: string }[];
}

export interface DecisionLeaf {
  title: string;
  body: string;
  cta?: Cta;
}

/**
 * A tree walked one question at a time with a back button. Rules: `start` (default: the
 * first node) exists; every `next` names a node or a leaf; node and leaf ids do not overlap;
 * every node and leaf is reachable from the start.
 */
export interface DecisionTool extends ToolBase {
  kind: "decision";
  start?: string;
  nodes: Record<string, DecisionNode>;
  leaves: Record<string, DecisionLeaf>;
}

/* ─────────────────────────── checklist ─────────────────────────── */

export interface ChecklistItem {
  text: string;
  /** Small print under the item. */
  note?: string;
}

/** Sections of checkboxes; ticks persist in the browser (localStorage) per tool id. */
export interface ChecklistTool extends ToolBase {
  kind: "checklist";
  sections: { title: string; items: ChecklistItem[] }[];
}

/* ─────────────────────────── brief ─────────────────────────── */

export interface BriefSection {
  heading: string;
  /** Multi-line template; blank lines separate paragraphs, "- " starts a bullet. */
  template: string;
  /** A list means every condition must hold. */
  when?: When | When[];
}

/** Inputs → a structured document (headed sections) with "Copy as Markdown". Same template rules as the generator. */
export interface BriefTool extends ToolBase {
  kind: "brief";
  inputs: InputDef[];
  /** Template for the document title, default `title`. */
  docTitle?: string;
  sections: BriefSection[];
}

export type Tool = GeneratorTool | CalculatorTool | ConverterTool | CheckerTool | QuizTool | DecisionTool | ChecklistTool | BriefTool;

/* ═══════════════════════════ zod schema ═══════════════════════════ */

const ID = /^[a-z][A-Za-z0-9_]*$/;
const TOOL_ID = /^[a-z0-9][a-z0-9-]*$/;
const OUTPUT_FORMATS = ["usd", "pct", "int", "seconds", "words", "number", "precise", "yesno", "ratio"] as const;

const href = z.string().min(1).refine((h) => h.startsWith("/") || h.startsWith("https://"), "must be a site path (/…) or an https URL");
const cta = z.strictObject({ label: z.string().min(1), href });
const selectOption = z.strictObject({ value: z.string().min(1), label: z.string().min(1) });
const inputId = z.string().regex(ID, "input id: a letter, then letters, digits or underscores");
const whenOne = z.strictObject({
  input: inputId,
  is: z.union([z.string(), z.array(z.string())]).optional(),
  not: z.union([z.string(), z.array(z.string())]).optional(),
});
/** One condition, or a list of conditions that must all hold. */
const when = z.union([whenOne, z.array(whenOne).min(1).max(4)]);

const base = {
  id: inputId,
  label: z.string().min(1),
  help: z.string().optional(),
};
const textInput = z.strictObject({ ...base, type: z.literal("text"), placeholder: z.string().optional(), default: z.string().optional(), maxLength: z.number().int().positive().optional(), required: z.boolean().optional() });
const textareaInput = z.strictObject({
  ...base,
  type: z.literal("textarea"),
  placeholder: z.string().optional(),
  default: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
  rows: z.number().int().min(2).max(20).optional(),
  required: z.boolean().optional(),
});
const selectInput = z.strictObject({ ...base, type: z.literal("select"), options: z.array(selectOption).min(2), default: z.string().optional(), display: z.enum(["chips", "dropdown"]).optional() });
const multiselectInput = z.strictObject({ ...base, type: z.literal("multiselect"), options: z.array(selectOption).min(2), default: z.array(z.string()).optional(), max: z.number().int().positive().optional() });
const numberInput = z.strictObject({
  ...base,
  type: z.literal("number"),
  unit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  default: z.number().optional(),
  placeholder: z.string().optional(),
});
const toggleInput = z.strictObject({ ...base, type: z.literal("toggle"), default: z.boolean().optional(), onLabel: z.string().optional(), offLabel: z.string().optional() });

const inputDef = z.discriminatedUnion("type", [textInput, textareaInput, selectInput, multiselectInput, numberInput, toggleInput]);
const numericInputDef = z.discriminatedUnion("type", [numberInput, selectInput, toggleInput]);

const toolBase = {
  id: z.string().regex(TOOL_ID, "tool id: lower-case letters, digits and hyphens"),
  title: z.string().min(1).max(90),
  lede: z.string().min(1).max(240),
  ctaLabel: z.string().min(1).max(60).optional(),
  ctaHref: href.optional(),
  ctaNote: z.string().max(160).optional(),
  schemaName: z.string().min(1).max(90).optional(),
};

const outputFormat = z.enum(OUTPUT_FORMATS);

const generatorSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("generator"),
  inputs: z.array(inputDef).min(1),
  variants: z.array(z.strictObject({ label: z.string().min(1), templates: z.array(z.string().min(1)).min(1), when: when.optional() })).min(1),
  count: z.number().int().min(1).max(12).optional(),
  postProcess: z.literal("scriptLint").optional(),
  lengthBudget: z.strictObject({ wordsPerSecond: z.number().positive(), secondsInputId: inputId }).optional(),
  generateLabel: z.string().min(1).max(40).optional(),
  againLabel: z.string().min(1).max(40).optional(),
});

const calcOutput = z.strictObject({ id: inputId, label: z.string().min(1), formula: z.string().min(1), format: outputFormat, note: z.string().optional(), primary: z.boolean().optional() });
const calcTable = z.strictObject({
  label: z.string().optional(),
  rowVar: inputId,
  rows: z.array(z.number()).min(1).max(40),
  rowLabel: z.string().min(1),
  rowFormat: outputFormat,
  columns: z.array(z.strictObject({ label: z.string().min(1), formula: z.string().min(1), format: outputFormat })).min(1).max(6),
});

const calculatorSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("calculator"),
  inputs: z.array(numericInputDef).min(1),
  outputs: z.array(calcOutput).min(1),
  table: calcTable.optional(),
  note: z.string().optional(),
});

const converterSide = z.strictObject({
  id: inputId,
  label: z.string().min(1),
  unit: z.string().optional(),
  format: outputFormat,
  default: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
});

const converterSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("converter"),
  a: converterSide,
  b: converterSide,
  params: z.array(numericInputDef).optional(),
  aToB: z.string().min(1),
  bToA: z.string().min(1),
  note: z.string().optional(),
});

const checkerRule = z.strictObject({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "rule id: lower-case letters, digits and hyphens"),
  label: z.string().min(1),
  severity: z.enum(["fatal", "warn", "info"]),
  pattern: z.string().min(1),
  flags: z.string().regex(/^[imsu]*$/, 'flags: any of "imsu"').optional(),
  message: z.string().min(1),
  suggestion: z.string().optional(),
});

const checkerStat = z.union([
  z.literal("words"),
  z.literal("sentences"),
  z.literal("characters"),
  z.literal("readingLevel"),
  z.custom<`seconds@${number}` | `read@${number}`>(
    (v) => typeof v === "string" && /^(?:seconds|read)@\d+(\.\d+)?$/.test(v),
    'stat: "words", "sentences", "characters", "readingLevel", "seconds@<words per second>" or "read@<words per minute>"',
  ),
]);

const checkerSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("checker"),
  input: z.strictObject({ label: z.string().min(1), placeholder: z.string().optional(), maxLength: z.number().int().positive().optional(), default: z.string().optional(), rows: z.number().int().min(2).max(30).optional() }),
  ruleSets: z.array(z.union([z.literal("scriptLint"), checkerRule])).min(1),
  stats: z.array(checkerStat).optional(),
  successText: z.string().optional(),
});

const quizSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("quiz"),
  questions: z
    .array(
      z.strictObject({
        q: z.string().min(1),
        help: z.string().optional(),
        options: z.array(z.strictObject({ label: z.string().min(1), points: z.number().optional(), bucket: z.string().min(1).optional() })).min(2),
      }),
    )
    .min(1),
  results: z
    .array(
      z.strictObject({
        bucket: z.string().min(1).optional(),
        range: z.tuple([z.number(), z.number()]).optional(),
        title: z.string().min(1),
        body: z.string().min(1),
        cta: cta.optional(),
      }),
    )
    .min(1),
  method: z.string().optional(),
});

const decisionSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("decision"),
  start: z.string().optional(),
  nodes: z.record(z.string().min(1), z.strictObject({ question: z.string().min(1), help: z.string().optional(), options: z.array(z.strictObject({ label: z.string().min(1), next: z.string().min(1) })).min(1) })),
  leaves: z.record(z.string().min(1), z.strictObject({ title: z.string().min(1), body: z.string().min(1), cta: cta.optional() })),
});

const checklistSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("checklist"),
  sections: z.array(z.strictObject({ title: z.string().min(1), items: z.array(z.strictObject({ text: z.string().min(1), note: z.string().optional() })).min(1) })).min(1),
});

const briefSchema = z.strictObject({
  ...toolBase,
  kind: z.literal("brief"),
  inputs: z.array(inputDef).min(1),
  docTitle: z.string().optional(),
  sections: z.array(z.strictObject({ heading: z.string().min(1), template: z.string().min(1), when: when.optional() })).min(1),
});

/* ─────────────────────────── cross-field rules ─────────────────────────── */

type Ctx = z.RefinementCtx;
const issue = (ctx: Ctx, message: string, path: (string | number)[] = []) => ctx.addIssue({ code: "custom", message, path });

function checkInputs(inputs: InputDef[], ctx: Ctx, path: string): Set<string> {
  const ids = new Set<string>();
  inputs.forEach((inp, i) => {
    if (ids.has(inp.id)) issue(ctx, `duplicate input id "${inp.id}"`, [path, i, "id"]);
    ids.add(inp.id);
    if (inp.type === "select" || inp.type === "multiselect") {
      const values = inp.options.map((o) => o.value);
      if (new Set(values).size !== values.length) issue(ctx, "option values must be unique", [path, i, "options"]);
      if (inp.type === "select" && inp.default !== undefined && !values.includes(inp.default)) issue(ctx, `default "${inp.default}" is not an option value`, [path, i, "default"]);
      if (inp.type === "multiselect") for (const d of inp.default ?? []) if (!values.includes(d)) issue(ctx, `default "${d}" is not an option value`, [path, i, "default"]);
    }
    if (inp.type === "number" && inp.min !== undefined && inp.max !== undefined && inp.min > inp.max) issue(ctx, "min is greater than max", [path, i, "min"]);
  });
  return ids;
}

function checkTemplate(template: string, ids: Set<string>, ctx: Ctx, path: (string | number)[]) {
  for (const id of placeholderIds(template)) if (!ids.has(id)) issue(ctx, `template reads "{{${id}}}" but there is no input "${id}"`, path);
  for (const f of unknownFilters(template)) issue(ctx, `unknown filter "|${f}"`, path);
  for (const r of invalidRanges(template)) issue(ctx, `malformed range ${r} (use {{n:1-5}})`, path);
}

function checkWhen(w: When | When[] | undefined, ids: Set<string>, ctx: Ctx, path: (string | number)[]) {
  if (!w) return;
  if (Array.isArray(w)) {
    w.forEach((one, i) => checkWhen(one, ids, ctx, [...path, i]));
    return;
  }
  if (!ids.has(w.input)) issue(ctx, `condition reads input "${w.input}" which does not exist`, [...path, "input"]);
  if (w.is === undefined && w.not === undefined) issue(ctx, 'condition needs "is" or "not"', path);
}

function checkFormula(src: string, allowed: Set<string>, ctx: Ctx, path: (string | number)[]) {
  try {
    const c = compileFormula(src);
    for (const name of c.identifiers) if (!allowed.has(name)) issue(ctx, `formula reads "${name}", which is not an input${allowed.size ? ` (known: ${[...allowed].join(", ")})` : ""}`, path);
  } catch (e) {
    issue(ctx, e instanceof FormulaError ? `${e.message} at character ${e.position + 1} of "${src}"` : String(e), path);
  }
}

function refineGenerator(t: z.infer<typeof generatorSchema>, ctx: Ctx) {
  const ids = checkInputs(t.inputs, ctx, "inputs");
  t.variants.forEach((g, gi) => {
    g.templates.forEach((tpl, ti) => checkTemplate(tpl, ids, ctx, ["variants", gi, "templates", ti]));
    checkWhen(g.when, ids, ctx, ["variants", gi, "when"]);
  });
  if (t.lengthBudget) {
    const inp = t.inputs.find((i) => i.id === t.lengthBudget!.secondsInputId);
    if (!inp) issue(ctx, `secondsInputId "${t.lengthBudget.secondsInputId}" is not an input`, ["lengthBudget", "secondsInputId"]);
    else if (inp.type !== "number" && inp.type !== "select") issue(ctx, "secondsInputId must be a number or select input", ["lengthBudget", "secondsInputId"]);
  }
}

function refineCalculator(t: z.infer<typeof calculatorSchema>, ctx: Ctx) {
  const ids = checkInputs(t.inputs, ctx, "inputs");
  const known = new Set(ids);
  t.outputs.forEach((o, i) => {
    if (known.has(o.id)) issue(ctx, `output id "${o.id}" is already an input or an earlier output`, ["outputs", i, "id"]);
    checkFormula(o.formula, known, ctx, ["outputs", i, "formula"]);
    known.add(o.id);
  });
  if (t.table) {
    if (known.has(t.table.rowVar)) issue(ctx, `rowVar "${t.table.rowVar}" clashes with an input or output`, ["table", "rowVar"]);
    const rowScope = new Set([...known, t.table.rowVar]);
    t.table.columns.forEach((c, i) => checkFormula(c.formula, rowScope, ctx, ["table", "columns", i, "formula"]));
  }
}

function refineConverter(t: z.infer<typeof converterSchema>, ctx: Ctx) {
  const params = checkInputs(t.params ?? [], ctx, "params");
  if (t.a.id === t.b.id) issue(ctx, "a.id and b.id must differ", ["b", "id"]);
  if (params.has(t.a.id) || params.has(t.b.id)) issue(ctx, "a param id clashes with a side id", ["params"]);
  checkFormula(t.aToB, new Set([t.a.id, ...params]), ctx, ["aToB"]);
  checkFormula(t.bToA, new Set([t.b.id, ...params]), ctx, ["bToA"]);
}

function refineChecker(t: z.infer<typeof checkerSchema>, ctx: Ctx) {
  const ids = new Set<string>();
  t.ruleSets.forEach((r, i) => {
    if (r === "scriptLint") return;
    if (ids.has(r.id)) issue(ctx, `duplicate rule id "${r.id}"`, ["ruleSets", i, "id"]);
    ids.add(r.id);
    try {
      new RegExp(r.pattern, `g${r.flags ?? ""}`);
    } catch (e) {
      issue(ctx, `pattern does not compile: ${(e as Error).message}`, ["ruleSets", i, "pattern"]);
    }
  });
}

/** Every total a points quiz can reach (questions are few, so the set stays small). */
function reachableTotals(questions: QuizQuestion[]): number[] {
  let totals = new Set<number>([0]);
  for (const q of questions) {
    const next = new Set<number>();
    for (const t of totals) for (const o of q.options) next.add(t + (o.points ?? 0));
    totals = next;
  }
  return [...totals].sort((a, b) => a - b);
}

function refineQuiz(t: z.infer<typeof quizSchema>, ctx: Ctx) {
  const options = t.questions.flatMap((q) => q.options);
  const hasPoints = options.some((o) => o.points !== undefined);
  const hasBuckets = options.some((o) => o.bucket !== undefined);
  if (hasPoints && hasBuckets) return issue(ctx, 'mixing "points" and "bucket" options: use one mode for the whole quiz', ["questions"]);
  if (!hasPoints && !hasBuckets) return issue(ctx, 'every option needs "points" or "bucket"', ["questions"]);
  if (hasBuckets) {
    options.forEach((o) => {
      if (o.bucket === undefined) issue(ctx, 'bucket mode: every option needs a "bucket"', ["questions"]);
    });
    const buckets = new Set(options.map((o) => o.bucket).filter((b): b is string => b !== undefined));
    const covered = new Set<string>();
    t.results.forEach((r, i) => {
      if (!r.bucket) return issue(ctx, 'bucket mode: every result needs a "bucket"', ["results", i]);
      if (covered.has(r.bucket)) issue(ctx, `two results for bucket "${r.bucket}"`, ["results", i, "bucket"]);
      covered.add(r.bucket);
      if (!buckets.has(r.bucket)) issue(ctx, `no option uses bucket "${r.bucket}"`, ["results", i, "bucket"]);
    });
    for (const b of buckets) if (!covered.has(b)) issue(ctx, `bucket "${b}" has no result`, ["results"]);
    return;
  }
  options.forEach((o) => {
    if (o.points === undefined) issue(ctx, 'points mode: every option needs "points"', ["questions"]);
  });
  const ranges: [number, number][] = [];
  t.results.forEach((r, i) => {
    if (!r.range) return issue(ctx, 'points mode: every result needs a "range"', ["results", i]);
    if (r.range[0] > r.range[1]) issue(ctx, "range must be [low, high]", ["results", i, "range"]);
    for (const other of ranges) if (r.range[0] <= other[1] && other[0] <= r.range[1]) issue(ctx, `range [${r.range}] overlaps [${other}]`, ["results", i, "range"]);
    ranges.push(r.range);
  });
  for (const total of reachableTotals(t.questions)) {
    if (!ranges.some(([lo, hi]) => total >= lo && total <= hi)) issue(ctx, `a total of ${total} points matches no result range`, ["results"]);
  }
}

function refineDecision(t: z.infer<typeof decisionSchema>, ctx: Ctx) {
  const nodeIds = Object.keys(t.nodes);
  const leafIds = Object.keys(t.leaves);
  if (!nodeIds.length) return issue(ctx, "at least one node is required", ["nodes"]);
  for (const id of leafIds) if (id in t.nodes) issue(ctx, `"${id}" is both a node and a leaf`, ["leaves", id]);
  const start = t.start ?? nodeIds[0];
  if (!(start in t.nodes)) issue(ctx, `start "${start}" is not a node`, ["start"]);
  const seen = new Set<string>();
  const stack = start in t.nodes ? [start] : [];
  while (stack.length) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const node = t.nodes[id];
    if (!node) continue;
    node.options.forEach((o, oi) => {
      if (!(o.next in t.nodes) && !(o.next in t.leaves)) issue(ctx, `"${o.next}" is neither a node nor a leaf`, ["nodes", id, "options", oi, "next"]);
      else stack.push(o.next);
    });
  }
  for (const id of [...nodeIds, ...leafIds]) if (!seen.has(id)) issue(ctx, `"${id}" can never be reached from "${start}"`, [id in t.nodes ? "nodes" : "leaves", id]);
}

function refineBrief(t: z.infer<typeof briefSchema>, ctx: Ctx) {
  const ids = checkInputs(t.inputs, ctx, "inputs");
  if (t.docTitle) checkTemplate(t.docTitle, ids, ctx, ["docTitle"]);
  t.sections.forEach((s, i) => {
    checkTemplate(s.heading, ids, ctx, ["sections", i, "heading"]);
    checkTemplate(s.template, ids, ctx, ["sections", i, "template"]);
    checkWhen(s.when, ids, ctx, ["sections", i, "when"]);
  });
}

export const ToolSchema = z
  .discriminatedUnion("kind", [generatorSchema, calculatorSchema, converterSchema, checkerSchema, quizSchema, decisionSchema, checklistSchema, briefSchema])
  .superRefine((t, ctx) => {
    switch (t.kind) {
      case "generator":
        return refineGenerator(t, ctx);
      case "calculator":
        return refineCalculator(t, ctx);
      case "converter":
        return refineConverter(t, ctx);
      case "checker":
        return refineChecker(t, ctx);
      case "quiz":
        return refineQuiz(t, ctx);
      case "decision":
        return refineDecision(t, ctx);
      case "brief":
        return refineBrief(t, ctx);
      default:
        return;
    }
  });

/* The interfaces above are the documentation; this line fails to compile if they drift from the schema. */
type Equals<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const TOOL_TYPES_MATCH_SCHEMA: Equals<Tool, z.infer<typeof ToolSchema>> = true;

/**
 * Validates one parsed JSON document. Returns the typed tool or throws an Error whose
 * message lists every problem with its path, prefixed with `file` when given.
 */
export function validateTool(data: unknown, file?: string): Tool {
  const r = ToolSchema.safeParse(data);
  if (r.success) return r.data;
  const lines = r.error.issues.map((i) => `  ${i.path.length ? i.path.join(".") : "(root)"}: ${i.message}`);
  throw new Error(`${file ? `${file}: ` : ""}invalid tool definition\n${lines.join("\n")}`);
}

/** Effective call to action for a tool (defaults applied). */
export function toolCta(tool: Tool): { label: string; href: string; note?: string } {
  return { label: tool.ctaLabel ?? DEFAULT_CTA_LABEL, href: tool.ctaHref ?? DEFAULT_CTA_HREF, ...(tool.ctaNote ? { note: tool.ctaNote } : {}) };
}
