import { describe, expect, it } from "vitest";
import { listTools } from "@/content/tools";
import type { GeneratorTool, InputDef } from "@/content/tools/types";
import { countWords, renderTemplate } from "@/components/tools/templating";
import { templateValues, whenMatches, type Values } from "@/components/tools/shared";
import { lintScript } from "@/lib/scripts/lint";

/*
 * Every real definition in content/tools/*.json must load (the loader validates each file
 * against the schema and throws with the file name), and every generator template must
 * render cleanly from the tool's own placeholder text: no empty slots, no fatal compliance
 * finding, and, where the tool has a length budget, no script far over it.
 */

const sample = (inp: InputDef): Values[string] => {
  switch (inp.type) {
    case "text":
    case "textarea":
      return (inp.placeholder ?? inp.default ?? "sample").replace(/^e\.g\.\s*/i, "");
    case "select":
      return inp.default ?? inp.options[0].value;
    case "multiselect":
      return inp.default ?? [inp.options[0].value];
    case "number":
      return inp.default ?? 1;
    case "toggle":
      return inp.default ?? false;
  }
};

describe("content/tools", () => {
  const tools = listTools();

  it("every tool definition validates", () => {
    expect(tools.length).toBeGreaterThan(0);
    for (const t of tools) expect(t.id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });

  const generators = tools.filter((t): t is GeneratorTool => t.kind === "generator");
  for (const tool of generators) {
    it(`${tool.id}: every template renders without gaps or fatal findings`, () => {
      const base: Values = Object.fromEntries(tool.inputs.map((i) => [i.id, sample(i)]));
      const problems: string[] = [];
      tool.variants.forEach((group, gi) => {
        // Satisfy the group's own conditions so each template is rendered in the context it is written for.
        const values: Values = { ...base };
        for (const w of group.when ? (Array.isArray(group.when) ? group.when : [group.when]) : []) {
          if (w.is !== undefined) values[w.input] = Array.isArray(w.is) ? w.is[0] : w.is;
        }
        if (!whenMatches(group.when, values)) problems.push(`${group.label}: conditions cannot be satisfied`);
        const tv = templateValues(tool.inputs, values);
        group.templates.forEach((tpl, ti) => {
          const r = renderTemplate(tpl, tv, { seed: 7 });
          const where = `${group.label} #${gi}.${ti}`;
          if (r.missing.length) problems.push(`${where}: empty ${r.missing.join(", ")}`);
          if (tool.postProcess === "scriptLint") {
            const { fatal } = lintScript(r.text);
            if (fatal.length) problems.push(`${where}: fatal ${fatal.map((f) => f.rule).join(", ")} in "${r.text}"`);
          }
          if (tool.lengthBudget) {
            const seconds = Number(values[tool.lengthBudget.secondsInputId]);
            const budget = Math.round(seconds * tool.lengthBudget.wordsPerSecond);
            const words = countWords(r.text);
            if (words > Math.ceil(budget * 1.15)) problems.push(`${where}: ${words} words for a ${budget}-word budget`);
          }
        });
      });
      expect(problems).toEqual([]);
    });
  }
});
