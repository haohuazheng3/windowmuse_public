"use client";

import { useState } from "react";
import { CREDIT_RULES, DURATIONS, PACKS, PLANS, RESOLUTIONS, TRIAL, costFor, type DurationSec, type Resolution } from "@/content/plans";

/*
 * "What does my video cost?" Pure arithmetic from plans.ts, so the numbers here are the
 * numbers the studio charges. Chips change state on press; nothing waits on a network.
 */

const OFFERS = [PLANS.starter, PLANS.growth, PLANS.pro, PACKS.pack10, PACKS.pack50];

export function CreditCalculator() {
  const [durationSec, setDuration] = useState<DurationSec>(15);
  const [resolution, setResolution] = useState<Resolution>("720p");
  const credits = costFor({ durationSec, resolution });

  return (
    <div className="pane p-6 sm:p-8">
      <div className="grid gap-6 lg:grid-cols-[1fr_auto] lg:gap-10">
        <div className="min-w-0">
          <p className="eyebrow">Credit calculator</p>
          <p className="headline mt-2 text-[1.5rem] text-ink">What does one video cost?</p>

          <fieldset className="mt-5">
            <legend className="field-label">Length</legend>
            <div className="flex flex-wrap gap-2">
              {DURATIONS.map((d) => (
                <button key={d} type="button" className="chip" data-selected={d === durationSec} aria-pressed={d === durationSec} onClick={() => setDuration(d)}>
                  {d} s
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-4">
            <legend className="field-label">Resolution</legend>
            <div className="flex flex-wrap gap-2">
              {RESOLUTIONS.map((r) => (
                <button key={r} type="button" className="chip" data-selected={r === resolution} aria-pressed={r === resolution} onClick={() => setResolution(r)}>
                  {r}
                  {r === TRIAL.resolution ? <span className="text-[0.78rem] text-ink-4">trial</span> : null}
                  {r === "1080p" ? <span className="text-[0.78rem] text-ink-4">Growth · Pro</span> : null}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="pane-inset min-w-0 p-5 lg:w-[300px]" aria-live="polite">
          <p className="eyebrow">{CREDIT_RULES.describeCost({ durationSec, resolution })}</p>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-[3rem] font-semibold leading-none tabular-nums text-accent-text" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 72' }}>
              {credits}
            </span>
            <span className="text-[1rem] text-ink-2">{credits === 1 ? "credit" : "credits"} per video</span>
          </p>
          <ul className="mt-4 space-y-1.5 text-[0.9rem] text-ink-2">
            {OFFERS.map((o) => (
              <li key={o.sku} className="flex justify-between gap-3">
                <span className="text-ink-3">
                  {o.name}
                  {o.interval === "month" ? " / month" : " pack"}
                </span>
                <span className="tabular-nums text-ink">
                  {Math.floor(o.credits / credits)} {Math.floor(o.credits / credits) === 1 ? "video" : "videos"}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8rem] leading-snug text-ink-4">
            {resolution === "1080p"
              ? "1080p is included with Growth and Pro; packs follow the limits of the plan you are on."
              : resolution === TRIAL.resolution
                ? `${TRIAL.resolution} is the free-trial quality and costs the same as 720p on paid plans.`
                : "Failed generations never cost credits."}
          </p>
        </div>
      </div>
    </div>
  );
}
