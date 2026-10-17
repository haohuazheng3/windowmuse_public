"use client";

import type { Tool } from "@/content/tools/types";
import { BriefView } from "./Brief";
import { CalculatorView } from "./Calculator";
import { CheckerView } from "./Checker";
import { ChecklistView } from "./Checklist";
import { ConverterView } from "./Converter";
import { DecisionView } from "./Decision";
import { GeneratorView } from "./Generator";
import { QuizView } from "./Quiz";
import { useHydrated } from "./shared";

/*
 * The interactive tool at the top of a tool-first guide. The server passes one validated
 * tool definition (plain JSON) and the page URL; everything runs in the browser, nothing the
 * seller types is sent anywhere. Until React has hydrated, the pane shows a skeleton in the
 * tool's shape, so the article text around it is readable without JavaScript.
 */

function ToolSkeleton({ kind }: { kind: Tool["kind"] }) {
  const rows = kind === "quiz" || kind === "decision" ? 3 : kind === "checklist" ? 6 : 2;
  return (
    <div aria-hidden="true" className="space-y-3">
      {kind === "quiz" || kind === "decision" ? <div className="skeleton h-2 w-full" /> : null}
      <div className={`grid gap-3 ${kind === "checker" || kind === "quiz" || kind === "decision" || kind === "checklist" ? "" : "sm:grid-cols-2"}`}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className={`skeleton ${kind === "checker" ? "h-36" : "h-12"}`} />
        ))}
      </div>
      <div className="skeleton h-12 w-40 !rounded-full" />
    </div>
  );
}

export function ToolRunner({ tool, pageUrl }: { tool: Tool; pageUrl: string }) {
  const hydrated = useHydrated();
  return (
    <section aria-labelledby={`tool-${tool.id}`} className="min-w-0">
      <p className="eyebrow eyebrow-accent">Free tool · runs in your browser</p>
      <h2 id={`tool-${tool.id}`} className="headline mt-2 text-[1.55rem] text-ink sm:text-[1.8rem]">
        {tool.title}
      </h2>
      <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-3">{tool.lede}</p>
      <div className="mt-5">
        {!hydrated ? (
          <ToolSkeleton kind={tool.kind} />
        ) : tool.kind === "generator" ? (
          <GeneratorView tool={tool} />
        ) : tool.kind === "calculator" ? (
          <CalculatorView tool={tool} />
        ) : tool.kind === "converter" ? (
          <ConverterView tool={tool} />
        ) : tool.kind === "checker" ? (
          <CheckerView tool={tool} />
        ) : tool.kind === "quiz" ? (
          <QuizView tool={tool} pageUrl={pageUrl} />
        ) : tool.kind === "decision" ? (
          <DecisionView tool={tool} />
        ) : tool.kind === "checklist" ? (
          <ChecklistView tool={tool} />
        ) : (
          <BriefView tool={tool} />
        )}
      </div>
      <p className="mt-5 text-[0.8rem] leading-relaxed text-ink-4">Nothing you type here is uploaded or stored by WindowMuse; the tool runs entirely in your browser.</p>
    </section>
  );
}
