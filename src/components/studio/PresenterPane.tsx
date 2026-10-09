"use client";

import { useCallback, useMemo, useState } from "react";
import { PresenterAvatar } from "@/components/PresenterAvatar";
import {
  LANGUAGE_NAMES,
  PRESENTERS,
  SCENE_LABELS,
  VIBE_LABELS,
  languageName,
  presenterById,
  type Gender,
  type LanguageCode,
  type PresenterCategory,
  type Scene,
  type Vibe,
} from "@/content/presenters";
import type { ProductCategory } from "@/lib/db/schema";
import { PaneHeader } from "./PaneHeader";

/*
 * Pane 3: the presenter. The catalog's fictional hosts, filtered by gender, vibe and setting;
 * the ones whose "best for" list covers the product's category float to the top.
 */

/** Product categories (the form's vocabulary) → presenter "best for" tags (the catalog's). */
const FIT: Record<ProductCategory, PresenterCategory[]> = {
  beauty: ["beauty", "skincare"],
  skincare: ["skincare", "beauty", "wellness"],
  fashion: ["fashion", "shoes", "bags"],
  accessories: ["jewelry", "bags", "phone-accessories", "fashion"],
  home: ["home", "cleaning", "crafts"],
  kitchen: ["kitchen", "food", "home"],
  electronics: ["tech", "gaming", "office"],
  "phone-accessories": ["phone-accessories", "tech"],
  "health-wellness": ["wellness", "fitness"],
  fitness: ["fitness", "outdoors", "wellness"],
  "baby-kids": ["baby", "toys"],
  pets: ["pets"],
  "toys-games": ["toys", "gaming"],
  stationery: ["stationery", "office", "crafts"],
  "food-drink": ["food", "kitchen"],
  other: [],
};

const GENDERS: { value: Gender | "all"; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "woman", label: "Women" },
  { value: "man", label: "Men" },
];

export function PresenterPane({
  selectedId,
  onSelect,
  productCategory,
  language,
  disabled = false,
}: {
  selectedId: string | null;
  onSelect: (id: string) => void;
  productCategory: ProductCategory | null;
  language: LanguageCode;
  disabled?: boolean;
}) {
  const [gender, setGender] = useState<Gender | "all">("all");
  const [vibe, setVibe] = useState<Vibe | "all">("all");
  const [scene, setScene] = useState<Scene | "all">("all");

  const fits = useMemo(() => new Set<PresenterCategory>(productCategory ? FIT[productCategory] : []), [productCategory]);
  const isFit = useCallback((p: (typeof PRESENTERS)[number]) => p.bestFor.some((c) => fits.has(c)), [fits]);

  const shown = useMemo(() => {
    const list = PRESENTERS.filter((p) => (gender === "all" || p.gender === gender) && (vibe === "all" || p.vibe === vibe) && (scene === "all" || p.scene === scene));
    return list.sort((a, b) => Number(isFit(b)) - Number(isFit(a)));
  }, [gender, vibe, scene, isFit]);

  const selected = selectedId ? presenterById(selectedId) : null;
  const speaks = selected ? selected.languages.includes(language) : true;

  return (
    <section className={`pane p-5 sm:p-6 ${disabled ? "opacity-60" : ""}`} aria-labelledby="pane-presenter">
      <PaneHeader
        step={3}
        id="pane-presenter"
        title="Presenter"
        done={!!selected}
        disabled={disabled}
        summary={selected ? `${selected.name} · ${VIBE_LABELS[selected.vibe]} · ${SCENE_LABELS[selected.scene]}` : "A fictional host; never a real person"}
      />

      <div className="mt-5 flex flex-wrap gap-2">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Presenter gender">
          {GENDERS.map((g) => (
            <button key={g.value} type="button" role="radio" aria-checked={gender === g.value} className="chip" data-selected={gender === g.value} onClick={() => setGender(g.value)}>
              {g.label}
            </button>
          ))}
        </div>
        <span className="hidden w-px bg-[var(--line-2)] sm:block" aria-hidden="true" />
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Vibe">
          <button type="button" role="radio" aria-checked={vibe === "all"} className="chip" data-selected={vibe === "all"} onClick={() => setVibe("all")}>
            Any vibe
          </button>
          {(Object.keys(VIBE_LABELS) as Vibe[]).map((v) => (
            <button key={v} type="button" role="radio" aria-checked={vibe === v} className="chip" data-selected={vibe === v} onClick={() => setVibe(v)}>
              {VIBE_LABELS[v]}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Setting">
        <button type="button" role="radio" aria-checked={scene === "all"} className="chip" data-selected={scene === "all"} onClick={() => setScene("all")}>
          Any setting
        </button>
        {(Object.keys(SCENE_LABELS) as Scene[]).map((s) => (
          <button key={s} type="button" role="radio" aria-checked={scene === s} className="chip" data-selected={scene === s} onClick={() => setScene(s)}>
            {SCENE_LABELS[s]}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-5 text-[0.95rem] text-ink-3">No presenter matches all three filters. Loosen one.</p>
      ) : (
        <div className="pane-grid mt-5">
          {shown.map((p) => {
            const sel = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                disabled={disabled}
                aria-pressed={sel}
                onClick={() => onSelect(p.id)}
                className={`min-w-0 rounded-[20px] p-2 text-left transition-[box-shadow,transform] active:scale-[0.985] ${
                  sel ? "bg-accent-soft shadow-[inset_0_0_0_2px_var(--accent)]" : "bg-pane-2 shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--line-2)]"
                }`}
              >
                <div className="relative overflow-hidden rounded-[14px]">
                  <PresenterAvatar presenter={p} size={200} decorative className="h-auto w-full" />
                  {isFit(p) ? <span className="tag tag-ok absolute left-1.5 top-1.5 !text-[0.66rem]">Good fit</span> : null}
                </div>
                <p className="mt-2 truncate px-1 text-[0.95rem] font-semibold text-ink">{p.name}</p>
                <p className="truncate px-1 text-[0.78rem] text-ink-4">
                  {p.ageBand} · {VIBE_LABELS[p.vibe]} · {SCENE_LABELS[p.scene]}
                </p>
                <p className="truncate px-1 pb-0.5 text-[0.74rem] text-ink-4">{p.languages.map((l) => LANGUAGE_NAMES[l].replace(/ \(.*\)$/, "")).join(", ")}</p>
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <div className="pane-inset mt-5 grid gap-3 px-4 py-4 sm:grid-cols-[96px_1fr]">
          <PresenterAvatar presenter={selected} size={96} decorative className="h-auto w-24 rounded-[14px]" />
          <div className="min-w-0 text-[0.9rem] leading-relaxed text-ink-3">
            <p className="text-[1rem] font-semibold text-ink">{selected.name}</p>
            <p className="mt-1">{selected.look}</p>
            <p className="mt-1">{selected.setting}</p>
            <p className="mt-1">
              <span className="font-semibold text-ink-2">Voice:</span> {selected.voice}
            </p>
            {!speaks ? (
              <p className="mt-2 rounded-xl bg-accent-soft px-3 py-2 text-[0.85rem] text-accent-text">
                {selected.name} is written as a {selected.languages.map((l) => LANGUAGE_NAMES[l]).join(" / ")} speaker. The video will still be spoken in {languageName(language)}; a presenter listed for it
                will sound more natural.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
