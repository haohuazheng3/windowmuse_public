"use client";

import { useMemo, useState } from "react";
import { PresenterAvatar } from "./PresenterAvatar";
import { EmptyState } from "./ui";
import {
  LANGUAGE_NAMES,
  PRESENTERS,
  SCENE_LABELS,
  VIBE_LABELS,
  type Gender,
  type Presenter,
  type Scene,
  type Vibe,
} from "@/content/presenters";

/*
 * The public catalog with the same three filters the studio uses (gender, vibe, setting).
 * Filtering is local and instant; the list never waits on a network.
 */

const GENDERS: { value: Gender; label: string }[] = [
  { value: "woman", label: "Women" },
  { value: "man", label: "Men" },
];
const VIBES = Object.keys(VIBE_LABELS) as Vibe[];
const SCENES = Object.keys(SCENE_LABELS) as Scene[];

function categoryLabel(c: string): string {
  return c.replace(/-/g, " ");
}

function PresenterCard({ p }: { p: Presenter }) {
  return (
    <li className="pane flex min-w-0 flex-col p-4 sm:p-5">
      <div className="mx-auto w-full max-w-[150px]">
        <PresenterAvatar presenter={p} size={150} className="h-auto w-full" decorative />
      </div>
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-2">
        <h3 className="text-[1.15rem] font-semibold text-ink">{p.name}</h3>
        <span className="text-[0.82rem] text-ink-4">
          {p.gender === "woman" ? "Woman" : "Man"} · {p.ageBand}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="tag tag-accent">{VIBE_LABELS[p.vibe]}</span>
        <span className="tag">{SCENE_LABELS[p.scene]}</span>
      </div>
      <p className="mt-3 text-[0.9rem] leading-relaxed text-ink-3">{p.setting}</p>
      <p className="mt-2 text-[0.9rem] leading-relaxed text-ink-3">
        <span className="font-semibold text-ink-2">Voice:</span> {p.voice}
      </p>
      <dl className="mt-auto pt-4 text-[0.84rem] leading-relaxed text-ink-3">
        <div className="flex gap-2">
          <dt className="shrink-0 font-semibold text-ink-2">Best for</dt>
          <dd className="min-w-0 capitalize">{p.bestFor.map(categoryLabel).join(", ")}</dd>
        </div>
        <div className="mt-1 flex gap-2">
          <dt className="shrink-0 font-semibold text-ink-2">Speaks</dt>
          <dd className="min-w-0">{p.languages.map((l) => LANGUAGE_NAMES[l]).join(", ")}</dd>
        </div>
      </dl>
    </li>
  );
}

export function PresenterCatalog() {
  const [gender, setGender] = useState<Gender | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [scene, setScene] = useState<Scene | null>(null);

  const shown = useMemo(
    () => PRESENTERS.filter((p) => (!gender || p.gender === gender) && (!vibe || p.vibe === vibe) && (!scene || p.scene === scene)),
    [gender, vibe, scene],
  );
  const filtered = gender !== null || vibe !== null || scene !== null;

  function reset() {
    setGender(null);
    setVibe(null);
    setScene(null);
  }

  return (
    <div>
      <div className="pane p-4 sm:p-5">
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          <fieldset className="min-w-0">
            <legend className="field-label">Gender</legend>
            <div className="flex flex-wrap gap-2">
              {GENDERS.map((g) => (
                <button
                  key={g.value}
                  type="button"
                  className="chip"
                  data-selected={gender === g.value}
                  aria-pressed={gender === g.value}
                  onClick={() => setGender(gender === g.value ? null : g.value)}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0">
            <legend className="field-label">Vibe</legend>
            <div className="flex flex-wrap gap-2">
              {VIBES.map((v) => (
                <button key={v} type="button" className="chip" data-selected={vibe === v} aria-pressed={vibe === v} onClick={() => setVibe(vibe === v ? null : v)}>
                  {VIBE_LABELS[v]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="min-w-0 lg:col-span-2">
            <legend className="field-label">Setting</legend>
            <div className="flex flex-wrap gap-2">
              {SCENES.map((s) => (
                <button key={s} type="button" className="chip" data-selected={scene === s} aria-pressed={scene === s} onClick={() => setScene(scene === s ? null : s)}>
                  {SCENE_LABELS[s]}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
        <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.88rem] text-ink-4" aria-live="polite">
          <span>
            {shown.length} of {PRESENTERS.length} presenters
          </span>
          {filtered ? (
            <button type="button" onClick={reset} className="underline underline-offset-4 hover:text-ink-2">
              Clear filters
            </button>
          ) : null}
        </p>
      </div>

      {shown.length ? (
        <ul className="pane-grid mt-6 !grid-cols-1 sm:!grid-cols-2 lg:!grid-cols-3">
          {shown.map((p) => (
            <PresenterCard key={p.id} p={p} />
          ))}
        </ul>
      ) : (
        <EmptyState
          className="mt-6"
          title="No presenter matches all three."
          body="Every combination of gender and vibe exists, but not in every setting. Loosen one filter."
          action={
            <button type="button" className="btn btn-ghost" onClick={reset}>
              Clear filters
            </button>
          }
        />
      )}
    </div>
  );
}
