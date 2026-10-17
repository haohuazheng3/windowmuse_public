"use client";

import Link from "next/link";
import { track } from "@/components/Consent";
import { LogoMark } from "@/components/Logo";
import { toolCta, type Tool } from "@/content/tools/types";

/**
 * The strip between the tool and the article on a tool-first guide: the one place that
 * turns what the seller just made into a presenter video. Always dark, like every primary
 * call to action on the site; the click is a `tool_cta` event.
 */
export function ToolCtaStrip({ tool }: { tool: Pick<Tool, "id" | "kind" | "ctaLabel" | "ctaHref" | "ctaNote"> }) {
  const cta = toolCta(tool as Tool);
  return (
    <aside className="pane-ink flex flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:px-8" aria-label="Make a video from this">
      <div className="shrink-0">
        <LogoMark size={36} tone="light" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#FF9A78]">Next step</p>
        <p className="mt-1 text-[1.08rem] font-semibold leading-snug text-[#F3EEE6]">Upload your product photos, pick a presenter, paste the script.</p>
        <p className="mt-1 text-[0.86rem] leading-relaxed text-[#A89E92]">{cta.note ?? "2 free videos at 480p, no card needed. Presenters are fictional."}</p>
      </div>
      <Link href={cta.href} prefetch={false} className="btn btn-primary shrink-0" onClick={() => track("tool_cta", { tool: tool.id, kind: tool.kind, href: cta.href })}>
        {cta.label}
      </Link>
    </aside>
  );
}
