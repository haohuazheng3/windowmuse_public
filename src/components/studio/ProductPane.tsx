"use client";

import { useState } from "react";
import { categoryLabel } from "@/lib/product-schema";
import type { ProductInput } from "@/lib/product-schema";
import type { ProductView } from "@/lib/products";
import { ProductForm } from "./ProductForm";
import { PaneHeader } from "./PaneHeader";

/*
 * Pane 1: which product. Pick one that exists (its photos come along) or describe a new
 * one inline. Selection shows instantly; the URL follows (?product=) so the flow resumes.
 */

export function ProductPane({
  products,
  selected,
  pendingId,
  onSelect,
  onCreate,
  initialMode,
}: {
  products: ProductView[];
  selected: ProductView | null;
  /** Product id a navigation is in flight for (optimistic highlight). */
  pendingId: string | null;
  onSelect: (id: string) => void;
  onCreate: (input: ProductInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  /** "create" when the page was opened from a "New product" button; otherwise the pane decides. */
  initialMode?: "pick" | "create";
}) {
  const [mode, setMode] = useState<"pick" | "create">(initialMode ?? (products.length === 0 && !selected ? "create" : "pick"));
  const [creating, setCreating] = useState<string | null>(null);

  const create = async (input: ProductInput) => {
    setCreating(input.name);
    const r = await onCreate(input);
    if (!r.ok) setCreating(null);
    return r;
  };

  return (
    <section className="pane p-5 sm:p-6" aria-labelledby="pane-product">
      <PaneHeader
        step={1}
        id="pane-product"
        title="Product"
        done={!!selected}
        summary={selected ? `${selected.name}${selected.brand ? ` · ${selected.brand}` : ""} · ${categoryLabel(selected.category)}` : "What the presenter will hold and talk about"}
        action={
          selected && mode === "pick" ? (
            <button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode("create")}>
              New product
            </button>
          ) : null
        }
      />

      {mode === "create" ? (
        <div className="mt-5">
          {creating ? (
            <div className="pane-inset flex items-center gap-3 px-4 py-3.5" role="status">
              <span className="spinner text-accent" aria-hidden="true" />
              <span className="text-[0.95rem] text-ink-2">
                Saving <span className="font-semibold text-ink">{creating}</span>…
              </span>
            </div>
          ) : (
            <ProductForm
              submitLabel="Save product and continue"
              busyLabel="Saving…"
              onSubmit={create}
              onCancel={products.length > 0 || selected ? () => setMode("pick") : undefined}
            />
          )}
        </div>
      ) : (
        <div className="mt-5">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((p) => {
              const isSel = selected?.id === p.id && !pendingId;
              const isPending = pendingId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id)}
                  aria-pressed={isSel || isPending}
                  disabled={isSel}
                  className={`min-w-0 rounded-[20px] px-4 py-3.5 text-left transition-[box-shadow,background-color] ${
                    isSel || isPending ? "bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--accent)]" : "bg-pane-2 shadow-[inset_0_0_0_1px_var(--line)] hover:bg-pane-3"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-[0.98rem] font-semibold text-ink">{p.name}</span>
                    {isPending ? <span className="spinner shrink-0 text-accent" aria-hidden="true" /> : null}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.82rem] text-ink-4">
                    {categoryLabel(p.category)} · {p.photoCount} {p.photoCount === 1 ? "photo" : "photos"}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={() => setMode("create")}
              className="min-w-0 rounded-[20px] border-2 border-dashed border-[var(--line-2)] px-4 py-3.5 text-left text-[0.95rem] font-semibold text-ink-3 hover:bg-pane-2 hover:text-ink"
            >
              + New product
              <span className="mt-0.5 block text-[0.82rem] font-normal text-ink-4">Name, category, selling points</span>
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
