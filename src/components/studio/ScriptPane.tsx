"use client";

import { useEffect, useState } from "react";
import { track } from "@/components/Consent";
import { DURATIONS } from "@/content/plans";
import { LANGUAGE_NAMES, type LanguageCode } from "@/content/presenters";
import { countWords, joinScript, wordBudget } from "@/lib/scripts/types";
import { ANGLE_CHIPS, TONE_CHIPS, type Draft, type GeneratedScript, type ScriptOptions } from "./flow-types";
import { PaneHeader } from "./PaneHeader";

/*
 * Pane 4: the script. Options as chips, "Write it for me" (the UI says whether Claude or
 * the template writer answered), three editable fields with a live word count against
 * the 2.5 words-per-second budget, and the compliance panel fed by `lintScript`.
 */

export interface LintView {
  fatal: unknown[];
  warn: unknown[];
}

/** A finding, whatever the linter calls its fields. */
export function findingText(f: unknown): string {
  if (typeof f === "string") return f;
  if (typeof f === "object" && f !== null) {
    const o = f as Record<string, unknown>;
    for (const k of ["message", "reason", "text", "title", "rule"]) {
      const v = o[k];
      if (typeof v === "string" && v.trim()) {
        const match = typeof o.match === "string" && o.match.trim() ? ` ("${o.match.trim()}")` : "";
        return `${v}${match}`;
      }
    }
  }
  return "Flagged phrase";
}

type BudgetState = "under" | "fit" | "tight" | "over";

/** How the count sits against the budget: under 60 % reads thin, over 110 % will not fit at a natural pace. */
function budgetState(words: number, budget: number): BudgetState {
  if (budget <= 0) return "fit";
  const r = words / budget;
  if (r > 1.1) return "over";
  if (r > 1) return "tight";
  if (r < 0.6) return "under";
  return "fit";
}

const SOURCE_LINE: Record<NonNullable<Draft["source"]>, string> = {
  ai: "Written by the AI writer from your selling points. Edit anything; it is your script.",
  template: "Written by the template writer: the AI writer isn't connected on this deployment, so the lines follow a fixed pattern. Edit anything.",
  user: "Your edit.",
};

export function ScriptPane({
  productId,
  options,
  onOptionsChange,
  draft,
  onDraftChange,
  lint,
  aiWriter,
  onSave,
  disabled = false,
}: {
  productId: string | null;
  options: ScriptOptions;
  onOptionsChange: (o: ScriptOptions) => void;
  draft: Draft;
  onDraftChange: (d: Draft) => void;
  lint: LintView;
  /** From /api/me; null while unknown. */
  aiWriter: boolean | null;
  onSave: () => Promise<string | null>;
  disabled?: boolean;
}) {
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The seller's own lines from before "Write it again", so one press can bring them back. */
  const [previous, setPrevious] = useState<Draft | null>(null);
  /** What the screen reader hears about compliance: updated when the counts change, not on every keystroke. */
  const [announcement, setAnnouncement] = useState("");

  const fullText = joinScript(draft);
  const words = countWords(fullText);
  const budget = wordBudget(options.durationSec);
  const state = budgetState(words, budget);
  const hasText = fullText.length > 0;
  const dirty = hasText && draft.savedId === null;

  const setOpt = <K extends keyof ScriptOptions>(k: K, v: ScriptOptions[K]) => {
    if (options[k] === v) return;
    onOptionsChange({ ...options, [k]: v });
  };

  const edit = (k: "hook" | "body" | "cta", v: string) => onDraftChange({ ...draft, [k]: v, source: "user", savedId: null, note: undefined });

  const write = async () => {
    if (!productId || writing) return;
    // Replacing text the seller typed or edited: keep it one press away.
    if (hasText && draft.source === "user") setPrevious(draft);
    setWriting(true);
    setError(null);
    try {
      const res = await fetch("/api/scripts/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ productId, language: options.language, tone: options.tone, angle: options.angle, durationSec: options.durationSec }),
      });
      const body = (await res.json().catch(() => ({}))) as { script?: GeneratedScript; error?: string };
      if (!res.ok || !body.script) {
        setError(body.error ?? `The writer didn't answer (${res.status}). Try again, or write the lines yourself.`);
        return;
      }
      const s = body.script;
      onDraftChange({ hook: s.hook, body: s.body, cta: s.cta, source: s.source, savedId: s.id ?? null, ...(s.note ? { note: s.note } : {}) });
      track("script_generated", { productId, source: s.source, language: options.language, tone: options.tone, angle: options.angle, durationSec: options.durationSec });
    } catch (e) {
      console.warn("[script] generate failed", e);
      setError("We couldn't reach the writer. Check your connection and try again.");
    } finally {
      setWriting(false);
    }
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const id = await onSave();
    setSaving(false);
    if (!id) setError("The script couldn't be saved. Please try again.");
  };

  const fatal = lint.fatal.length;
  const warn = lint.warn.length;
  const inactive = disabled || !productId;
  const toneHint = TONE_CHIPS.find((t) => t.value === options.tone)?.hint ?? "";
  const angleHint = ANGLE_CHIPS.find((a) => a.value === options.angle)?.hint ?? "";

  // One calm sentence for assistive tech, a moment after the counts settle.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setAnnouncement(
        !hasText
          ? ""
          : fatal > 0
            ? `Compliance: ${fatal} ${fatal === 1 ? "line blocks" : "lines block"} generation.`
            : warn > 0
              ? `Compliance: ${warn} ${warn === 1 ? "line" : "lines"} worth a second look.`
              : "Compliance: clear.",
      );
    }, 300);
    return () => window.clearTimeout(t);
  }, [hasText, fatal, warn]);

  const restore = () => {
    if (!previous) return;
    onDraftChange(previous);
    setPrevious(null);
  };

  return (
    <section className={`pane p-5 sm:p-6 ${inactive ? "opacity-60" : ""}`} aria-labelledby="pane-script">
      <PaneHeader
        step={4}
        id="pane-script"
        title="Script"
        done={hasText && fatal === 0 && !dirty}
        disabled={inactive}
        summary={
          !hasText
            ? `${options.durationSec} s in ${LANGUAGE_NAMES[options.language]}: about ${budget} words`
            : fatal > 0
              ? `${fatal} ${fatal === 1 ? "line blocks" : "lines block"} generation`
              : dirty
                ? "Edited, not saved yet"
                : `${words} words · saved`
        }
      />

      <div className="mt-5 grid gap-4">
        <div>
          <p id="sc-language-label" className="field-label">
            Language
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="sc-language-label">
            {(Object.keys(LANGUAGE_NAMES) as LanguageCode[]).map((l) => (
              <button
                key={l}
                type="button"
                role="radio"
                aria-checked={options.language === l}
                className="chip !text-[0.9rem]"
                data-selected={options.language === l}
                disabled={inactive}
                onClick={() => setOpt("language", l)}
              >
                {LANGUAGE_NAMES[l]}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p id="sc-tone-label" className="field-label">
              Tone
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="sc-tone-label" aria-describedby="sc-tone-hint">
              {TONE_CHIPS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  role="radio"
                  aria-checked={options.tone === t.value}
                  className="chip"
                  data-selected={options.tone === t.value}
                  disabled={inactive}
                  onClick={() => setOpt("tone", t.value)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p id="sc-tone-hint" className="field-hint">
              {toneHint}
            </p>
          </div>
          <div>
            <p id="sc-length-label" className="field-label">
              Length
            </p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="sc-length-label">
              {DURATIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={options.durationSec === d}
                  className="chip tabular-nums"
                  data-selected={options.durationSec === d}
                  disabled={inactive}
                  onClick={() => setOpt("durationSec", d)}
                >
                  {d} s
                </button>
              ))}
            </div>
          </div>
        </div>
        <div>
          <p id="sc-angle-label" className="field-label">
            Angle
          </p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="sc-angle-label" aria-describedby="sc-angle-hint">
            {ANGLE_CHIPS.map((a) => (
              <button
                key={a.value}
                type="button"
                role="radio"
                aria-checked={options.angle === a.value}
                className="chip"
                data-selected={options.angle === a.value}
                disabled={inactive}
                onClick={() => setOpt("angle", a.value)}
              >
                {a.label}
              </button>
            ))}
          </div>
          <p id="sc-angle-hint" className="field-hint">
            {angleHint}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="button" className="btn btn-primary" disabled={inactive || writing} aria-busy={writing} onClick={() => void write()}>
          {writing ? <span className="spinner" aria-hidden="true" /> : null}
          {writing ? "Writing…" : hasText ? (draft.source === "user" ? "Write it again (replaces your edit)" : "Write it again") : "Write it for me"}
        </button>
        <span className="text-[0.85rem] text-ink-4">
          {aiWriter === null ? "" : aiWriter ? "AI writer, from your selling points" : "Template writer on this deployment; the AI writer is not connected"}
        </span>
      </div>
      {previous && !writing ? (
        <p className="mt-2 flex flex-wrap items-center gap-2 text-[0.85rem] text-ink-3" role="status">
          Your earlier lines are kept.
          <button type="button" className="btn btn-quiet btn-sm" onClick={restore}>
            Undo: restore my edit
          </button>
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {writing ? (
          <div className="grid gap-3" aria-hidden="true">
            <div className="skeleton h-[52px]" />
            <div className="skeleton h-[120px]" />
            <div className="skeleton h-[52px]" />
          </div>
        ) : (
          <>
            <div>
              <label htmlFor="sc-hook" className="field-label">
                Hook <span className="font-normal text-ink-4">(the first two seconds)</span>
              </label>
              <textarea id="sc-hook" className="input !min-h-[56px]" rows={2} value={draft.hook} disabled={inactive} aria-describedby="sc-budget" onChange={(e) => edit("hook", e.target.value)} placeholder="Still packing lunch in a box that leaks?" />
            </div>
            <div>
              <label htmlFor="sc-body" className="field-label">
                Body
              </label>
              <textarea id="sc-body" className="input !min-h-[120px]" rows={4} value={draft.body} disabled={inactive} aria-describedby="sc-budget" onChange={(e) => edit("body", e.target.value)} placeholder="This one folds flat to three centimetres and the lid seals twice…" />
            </div>
            <div>
              <label htmlFor="sc-cta" className="field-label">
                Call to action
              </label>
              <textarea id="sc-cta" className="input !min-h-[56px]" rows={2} value={draft.cta} disabled={inactive} aria-describedby="sc-budget" onChange={(e) => edit("cta", e.target.value)} placeholder="Tap the orange cart to grab yours." />
            </div>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[0.85rem]">
        <p id="sc-budget" className={state === "over" ? "font-semibold text-bad" : state === "tight" ? "text-accent-text" : "text-ink-4"}>
          <span className="tabular-nums">
            {words} / {budget}
          </span>{" "}
          words for {options.durationSec} s
          {state === "over" ? " · too long to say at a natural pace, trim a line" : state === "tight" ? " · right at the limit" : state === "under" && hasText ? " · room for one more fact" : ""}
        </p>
        {draft.source ? <p className="text-ink-4">{SOURCE_LINE[draft.source]}</p> : null}
      </div>
      {draft.note ? <p className="mt-2 text-[0.85rem] text-ink-3">{draft.note}</p> : null}

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {hasText ? (
        <div className={`mt-4 rounded-[20px] px-4 py-3.5 ${fatal > 0 ? "bg-bad-soft" : warn > 0 ? "bg-accent-soft" : "bg-ok-soft"}`}>
          <p className={`text-[0.9rem] font-semibold ${fatal > 0 ? "text-bad" : warn > 0 ? "text-accent-text" : "text-ok"}`}>
            {fatal > 0 ? "Compliance: fix before generating" : warn > 0 ? "Compliance: worth a second look" : "Compliance: clear"}
          </p>
          {fatal === 0 && warn === 0 ? (
            <p className="mt-1 text-[0.85rem] text-ink-3">Speaks as a brand presenter about product facts. No cures, no guarantees, no fake customer testimony, no expert persona.</p>
          ) : (
            <ul className="mt-1.5 space-y-1 text-[0.85rem] text-ink-2">
              {lint.fatal.map((f, i) => (
                <li key={`f${i}`} className="flex gap-2">
                  <span className="tag tag-bad !px-1.5 !text-[0.62rem]">blocks</span>
                  <span>{findingText(f)}</span>
                </li>
              ))}
              {lint.warn.map((f, i) => (
                <li key={`w${i}`} className="flex gap-2">
                  <span className="tag tag-accent !px-1.5 !text-[0.62rem]">check</span>
                  <span>{findingText(f)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-3 rounded-2xl bg-bad-soft px-4 py-2.5 text-[0.88rem] text-bad">
          {error}
        </p>
      ) : null}

      {dirty ? (
        <div className="mt-4 flex items-center gap-3">
          <button type="button" className="btn btn-ghost btn-sm" disabled={saving || fatal > 0} aria-busy={saving} onClick={() => void save()}>
            {saving ? <span className="spinner" aria-hidden="true" /> : null}
            {saving ? "Saving…" : "Save script"}
          </button>
          <span className="text-[0.82rem] text-ink-4">Generate saves it too.</span>
        </div>
      ) : null}
    </section>
  );
}
