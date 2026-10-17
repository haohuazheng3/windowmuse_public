"use client";

import { useId, useMemo, useState } from "react";
import type { ConverterSide, ConverterTool } from "@/content/tools/types";
import { compileFormula, formatValue, type Scope } from "./formulas";
import { InputGrid, formulaScope, initialValues, useToolEvents, type Values } from "./shared";

/** "38 words" and "15.2 s" already name their unit; "$39" or a plain number gets the side's unit or label after it. */
function selfDescribing(side: ConverterSide): boolean {
  return side.format === "words" || side.format === "seconds" || side.format === "pct" || side.format === "usd";
}

/** The derived side is shown as a plain number the seller can keep editing; precision follows the format. */
function toField(v: number, format: ConverterSide["format"]): string {
  if (!Number.isFinite(v)) return "";
  if (format === "int" || format === "words") return String(Math.round(v));
  return String(Math.round(v * 100) / 100);
}

function SideField({ side, value, onChange, derived }: { side: ConverterSide; value: string; onChange: (v: string) => void; derived: boolean }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="field-label">
        {side.label}
        {derived ? <span className="ml-1 font-normal text-ink-4">(calculated)</span> : null}
      </label>
      <span className="flex items-center gap-2">
        <input id={id} className="input !text-[1.25rem] font-semibold tabular-nums" type="number" inputMode="decimal" min={side.min} max={side.max} step={side.step ?? "any"} value={value} onChange={(e) => onChange(e.target.value)} />
        {side.unit ? <span className="shrink-0 text-[0.9rem] text-ink-4">{side.unit}</span> : null}
      </span>
    </div>
  );
}

export function ConverterView({ tool }: { tool: ConverterTool }) {
  const params = useMemo(() => tool.params ?? [], [tool.params]);
  const [paramValues, setParamValues] = useState<Values>(() => initialValues(params));
  const [edited, setEdited] = useState<{ side: "a" | "b"; text: string }>({ side: "a", text: tool.a.default !== undefined ? String(tool.a.default) : "" });
  const events = useToolEvents(tool);
  const fns = useMemo(() => ({ aToB: compileFormula(tool.aToB), bToA: compileFormula(tool.bToA) }), [tool.aToB, tool.bToA]);

  const scope = useMemo(() => formulaScope(params, paramValues), [params, paramValues]);
  const typed = edited.text.trim() === "" ? NaN : Number(edited.text);
  let a = NaN;
  let b = NaN;
  try {
    if (edited.side === "a") {
      a = typed;
      b = fns.aToB.evaluate({ ...scope, [tool.a.id]: a } as Scope);
    } else {
      b = typed;
      a = fns.bToA.evaluate({ ...scope, [tool.b.id]: b } as Scope);
    }
  } catch (e) {
    console.warn("[tool] converter formula failed", e);
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-end">
        <SideField
          side={tool.a}
          derived={edited.side === "b"}
          value={edited.side === "a" ? edited.text : toField(a, tool.a.format)}
          onChange={(text) => {
            events.result({ side: "a" });
            setEdited({ side: "a", text });
          }}
        />
        <span aria-hidden className="hidden pb-3 text-[1.4rem] text-ink-4 sm:block">
          ⇄
        </span>
        <SideField
          side={tool.b}
          derived={edited.side === "a"}
          value={edited.side === "b" ? edited.text : toField(b, tool.b.format)}
          onChange={(text) => {
            events.result({ side: "b" });
            setEdited({ side: "b", text });
          }}
        />
      </div>
      {params.length ? (
        <div className="mt-4">
          <InputGrid
            inputs={params}
            values={paramValues}
            onChange={(id, v) => {
              events.used();
              setParamValues((prev) => ({ ...prev, [id]: v }));
            }}
          />
        </div>
      ) : null}
      <p className="mt-4 text-[1rem] text-ink-2" aria-live="polite">
        <span className="font-semibold tabular-nums text-ink">{formatValue(a, tool.a.format)}</span>
        {selfDescribing(tool.a) ? "" : ` ${tool.a.unit ?? tool.a.label.toLowerCase()}`} ={" "}
        <span className="font-semibold tabular-nums text-ink">{formatValue(b, tool.b.format)}</span>
        {selfDescribing(tool.b) ? "" : ` ${tool.b.unit ?? tool.b.label.toLowerCase()}`}
      </p>
      {tool.note ? <p className="mt-2 text-[0.84rem] leading-relaxed text-ink-4">{tool.note}</p> : null}
    </div>
  );
}
