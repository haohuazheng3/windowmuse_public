"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { track } from "@/components/Consent";
import { CREDIT_RULES, RESOLUTIONS, TRIAL, costFor, type Resolution } from "@/content/plans";
import type { JobJson } from "@/lib/job-json";
import { PaneHeader } from "./PaneHeader";
import { adjustCredits, useMe } from "./me-store";

/*
 * Pane 5: resolution, live cost, the button. Pressing Generate flips the button at once,
 * saves the script if needed, reserves credits through POST /api/jobs and moves to the
 * job page. A 402 turns into "You need N more credits" with the pack link.
 *
 * Resolution gating mirrors createJob exactly (/api/me carries the inputs): 1080p needs a
 * plan that allows it, trial-only credits render at 480p, and nothing above what the engine
 * delivers today is offered, so the server never has to refuse a choice the pane allowed.
 */

export interface Readiness {
  product: boolean;
  photos: boolean;
  confirmed: boolean;
  presenter: boolean;
  script: boolean;
  compliant: boolean;
}

const MISSING: { key: keyof Readiness; text: string }[] = [
  { key: "product", text: "Pick or create a product" },
  { key: "photos", text: "Upload at least one photo" },
  { key: "confirmed", text: "Confirm the photos are yours and show no people" },
  { key: "presenter", text: "Choose a presenter" },
  { key: "script", text: "Write or generate the script" },
  { key: "compliant", text: "Fix the lines the compliance check blocks" },
];

type Phase = "idle" | "starting" | "redirecting";

export function GeneratePane({
  productId,
  presenterId,
  durationSec,
  resolution,
  onResolutionChange,
  ready,
  ensureScriptId,
  onStarted,
}: {
  productId: string | null;
  presenterId: string | null;
  durationSec: number;
  resolution: Resolution | null;
  onResolutionChange: (r: Resolution) => void;
  ready: Readiness;
  /** Saves the script when it is dirty and returns its id (null when it cannot be saved). */
  ensureScriptId: () => Promise<string | null>;
  onStarted: () => void;
}) {
  const router = useRouter();
  const { me } = useMe();
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [short, setShort] = useState<{ needed: number; available: number } | null>(null);

  const trialOnly = me ? me.onlyTrialCredits : false;
  const allow1080p = me ? me.plan.allow1080p : false;
  // Until the engine is configured, nothing is known about its ceiling: offer every resolution the plan allows.
  const engineMax: Resolution | undefined = me?.engine.configured ? me.engine.maxResolution : undefined;
  const noteFor = (r: Resolution) => CREDIT_RULES.resolutionNote(r, allow1080p, trialOnly, engineMax);
  const chosen: Resolution = resolution ?? (trialOnly ? TRIAL.resolution : "720p");
  // A choice remembered from before a plan change (or from before /api/me answered) falls back to the best allowed one.
  const effective: Resolution = noteFor(chosen) === null ? chosen : ([...RESOLUTIONS].reverse().find((r) => noteFor(r) === null) ?? TRIAL.resolution);
  const cost = costFor({ durationSec, resolution: effective });
  const available = me?.balance.available ?? null;
  const missing = MISSING.filter((m) => !ready[m.key]);
  const canPress = missing.length === 0 && phase === "idle" && !!productId && !!presenterId;
  const engine = me?.features.videoEngine ?? null;
  const effectiveNote = noteFor(effective);
  // When the pane had to pick for the seller, say why the others are off; otherwise explain the first blocked chip.
  const blockedNote = effectiveNote ?? RESOLUTIONS.map(noteFor).find((n): n is string => n !== null) ?? null;

  const run = async () => {
    if (!canPress || !productId || !presenterId) return;
    setPhase("starting");
    setError(null);
    setShort(null);
    try {
      const scriptId = await ensureScriptId();
      if (!scriptId) {
        setError("The script couldn't be saved. Check the compliance panel and try again.");
        setPhase("idle");
        return;
      }
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ productId, scriptId, presenterId, resolution: effective, durationSec }),
      });
      if (res.status === 402) {
        const body = (await res.json().catch(() => ({}))) as { needed?: number; available?: number };
        setShort({ needed: body.needed ?? cost, available: body.available ?? available ?? 0 });
        setPhase("idle");
        return;
      }
      const body = (await res.json().catch(() => ({}))) as { job?: JobJson; error?: string };
      if (!res.ok || !body.job) {
        setError(body.error ?? `The video couldn't be started (${res.status}).`);
        setPhase("idle");
        return;
      }
      adjustCredits(-body.job.credits);
      track("job_created", { jobId: body.job.id, productId, presenterId, resolution: effective, durationSec, credits: body.job.credits });
      onStarted();
      setPhase("redirecting");
      router.push(`/studio/videos/${body.job.id}`);
    } catch (e) {
      console.warn("[jobs] create failed", e);
      setError("We couldn't reach the server. Nothing was charged; try again.");
      setPhase("idle");
    }
  };

  return (
    <section className="pane-ink p-5 sm:p-6" aria-labelledby="pane-generate">
      <PaneHeader step={5} id="pane-generate" title="Generate" done={false} summary={<span className="text-[#A89E92]">{CREDIT_RULES.describeCost({ durationSec, resolution: effective })}</span>} />

      <div className="mt-5">
        <p id="resolution-label" className="text-[0.86rem] font-semibold text-[#CFC6BB]">
          Resolution
        </p>
        <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby="resolution-label" aria-describedby={me && blockedNote ? "resolution-note" : undefined}>
          {RESOLUTIONS.map((r) => {
            const note = noteFor(r);
            const blocked = note !== null;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={effective === r}
                className="chip !bg-white/10 !text-[#F3EEE6] !shadow-[inset_0_0_0_1px_rgba(243,238,230,0.14)] data-[selected=true]:!bg-[rgba(232,86,42,0.28)] data-[selected=true]:!shadow-[inset_0_0_0_1.5px_#FF7A4D]"
                data-selected={effective === r}
                disabled={blocked}
                onClick={() => onResolutionChange(r)}
              >
                {r}
                <span className="text-[0.78em] opacity-75">{CREDIT_RULES.credits(costFor({ durationSec, resolution: r }))}</span>
              </button>
            );
          })}
        </div>
        {me && blockedNote ? (
          <p id="resolution-note" className="mt-2 text-[0.82rem] text-[#A89E92]">
            {blockedNote}
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[0.95rem] text-[#CFC6BB]">
        <span>
          This video: <span className="font-semibold text-[#F3EEE6]">{CREDIT_RULES.credits(cost)}</span>
        </span>
        <span>
          You have: {available === null ? <span className="skeleton inline-block h-4 w-10 align-middle !bg-white/10" /> : <span className="font-semibold text-[#F3EEE6] tabular-nums">{available}</span>}
        </span>
        {available !== null && available < cost ? (
          <Link href="/pricing#packs" prefetch={false} className="font-semibold text-[#FF9A78] underline underline-offset-2">
            Get {cost - available} more
          </Link>
        ) : null}
      </div>

      {engine === "none" ? (
        <p className="mt-4 rounded-2xl bg-white/[0.07] px-4 py-3 text-[0.86rem] leading-relaxed text-[#CFC6BB]">
          The video engine is being connected. You can still press Generate: the job is saved with its credits reserved (not charged) and renders as soon as the engine is live.
        </p>
      ) : engine === "mock" ? (
        <p className="mt-4 rounded-2xl bg-white/[0.07] px-4 py-3 text-[0.86rem] text-[#CFC6BB]">Test engine on this deployment: Generate returns a sample clip for pipeline checks.</p>
      ) : null}

      <div className="mt-6">
        <button type="button" className="btn btn-primary btn-lg btn-block sm:w-auto" disabled={!canPress} aria-busy={phase !== "idle"} onClick={() => void run()}>
          {phase !== "idle" ? <span className="spinner" aria-hidden="true" /> : null}
          {phase === "starting" ? "Reserving credits…" : phase === "redirecting" ? "Opening your video…" : `Generate video · ${CREDIT_RULES.credits(cost)}`}
        </button>
        {missing.length > 0 ? (
          <ul className="mt-3 space-y-1 text-[0.85rem] text-[#A89E92]">
            {missing.map((m) => (
              <li key={m.key} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#FF9A78]" aria-hidden="true" />
                {m.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[0.82rem] text-[#A89E92]">Credits are reserved now and charged only when the video succeeds. A failed generation costs nothing.</p>
        )}
      </div>

      {short ? (
        <div role="alert" className="mt-4 rounded-2xl bg-[rgba(232,86,42,0.18)] px-4 py-3 text-[0.92rem] text-[#F3EEE6]">
          You need <span className="font-semibold">{Math.max(1, short.needed - short.available)} more {short.needed - short.available === 1 ? "credit" : "credits"}</span> for this video ({short.available} available,{" "}
          {short.needed} needed).{" "}
          <Link href="/pricing#packs" prefetch={false} className="font-semibold text-[#FF9A78] underline underline-offset-2">
            See the credit packs
          </Link>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 rounded-2xl bg-[rgba(255,138,91,0.16)] px-4 py-3 text-[0.9rem] text-[#FF9A78]">
          {error}
        </p>
      ) : null}
    </section>
  );
}
