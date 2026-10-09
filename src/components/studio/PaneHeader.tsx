import type { ReactNode } from "react";

/** Numbered pane title with a one-line summary; the number turns green once the step is done. */
export function PaneHeader({
  step,
  id,
  title,
  summary,
  done,
  action,
  disabled = false,
}: {
  /** Omitted outside the numbered flow (the product page). */
  step?: number;
  id: string;
  title: string;
  summary: ReactNode;
  done: boolean;
  action?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[0.85rem] font-semibold tabular-nums ${
            done ? "bg-ok-soft text-ok" : disabled ? "bg-pane-2 text-ink-4" : "bg-accent-soft text-accent-text"
          }`}
          aria-hidden="true"
        >
          {done ? "✓" : (step ?? "·")}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="headline text-[1.25rem] text-ink">
            <span className="sr-only">{done ? "Done: " : disabled ? "Locked: " : step !== undefined ? `Step ${step}: ` : ""}</span>
            {title}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-[0.88rem] text-ink-3">{summary}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
