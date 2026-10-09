"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { createProduct } from "@/app/(app)/studio/products/actions";
import type { Resolution } from "@/content/plans";
import type { ProductInput } from "@/lib/product-schema";
import type { AssetView, ProductView } from "@/lib/products";
import { lintScript } from "@/lib/scripts/lint";
import { joinScript } from "@/lib/scripts/types";
import { DEFAULT_OPTIONS, EMPTY_DRAFT, clearStash, readStash, writeStash, type Draft, type ScriptOptions } from "./flow-types";
import { GeneratePane, type Readiness } from "./GeneratePane";
import { useMe } from "./me-store";
import { PhotosPane, itemsFromAssets, readyCount } from "./PhotosPane";
import { PresenterPane } from "./PresenterPane";
import { ProductPane } from "./ProductPane";
import { ScriptPane } from "./ScriptPane";

/*
 * The create flow: one page, five panes. The product id is the URL (?product=), so a
 * refresh or a shared link resumes on the same product; presenter, options and the
 * script draft are stashed per product in session storage. This component renders only
 * in the browser (see CreateFlowLoader), which is what lets it read the stash on first
 * render without a hydration mismatch.
 */

export function CreateFlow({
  products,
  product,
  assets,
  startWithNewProduct = false,
}: {
  products: ProductView[];
  product: ProductView | null;
  assets: AssetView[];
  /** The page was opened from a "New product" button: show the form, not the picker. */
  startWithNewProduct?: boolean;
}) {
  const router = useRouter();
  const { me } = useMe();
  const [, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [stash] = useState(() => (product ? readStash(product.id) : null));

  const [items, setItems] = useState(() => itemsFromAssets(assets));
  const [confirmed, setConfirmed] = useState<boolean>(() => stash?.confirmed ?? false);
  const [presenterId, setPresenterId] = useState<string | null>(() => stash?.presenterId ?? null);
  const [options, setOptions] = useState<ScriptOptions>(() => ({ ...DEFAULT_OPTIONS, ...(stash?.options ?? {}) }));
  const [draft, setDraft] = useState<Draft>(() => ({ ...EMPTY_DRAFT, ...(stash?.draft ?? {}) }));
  const [resolution, setResolution] = useState<Resolution | null>(() => stash?.resolution ?? null);

  // Keep the stash current so a refresh lands exactly here.
  useEffect(() => {
    if (!product) return;
    writeStash(product.id, { presenterId, options, draft, confirmed, resolution: resolution ?? "720p" });
  }, [product, presenterId, options, draft, confirmed, resolution]);

  const fullText = joinScript(draft);
  const lint = useMemo(() => (fullText ? lintScript(fullText, { language: options.language }) : { fatal: [], warn: [] }), [fullText, options.language]);

  const selectProduct = (id: string) => {
    if (product?.id === id) return;
    setPendingId(id);
    startTransition(() => router.push(`/studio/new?product=${encodeURIComponent(id)}`));
  };

  const create = async (input: ProductInput) => {
    const r = await createProduct(input);
    if (!r.ok) return r;
    startTransition(() => router.push(`/studio/new?product=${encodeURIComponent(r.id)}`));
    return { ok: true as const };
  };

  const changeOptions = (o: ScriptOptions) => {
    setOptions(o);
    // The saved row carries the options too, so a change means the script must be saved again.
    setDraft((d) => (d.savedId ? { ...d, savedId: null } : d));
  };

  const saveScript = useCallback(async (): Promise<string | null> => {
    if (!product) return null;
    if (draft.savedId) return draft.savedId;
    if (!fullText || lint.fatal.length > 0) return null;
    try {
      const res = await fetch("/api/scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          productId: product.id,
          hook: draft.hook,
          body: draft.body,
          cta: draft.cta,
          language: options.language,
          tone: options.tone,
          angle: options.angle,
          durationSec: options.durationSec,
        }),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { script?: { id: string } };
      const id = body.script?.id;
      if (!id) return null;
      setDraft((d) => ({ ...d, savedId: id }));
      return id;
    } catch (e) {
      console.warn("[script] save failed", e);
      return null;
    }
  }, [product, draft, fullText, lint.fatal.length, options]);

  const ready: Readiness = {
    product: !!product,
    photos: readyCount(items) > 0,
    confirmed,
    presenter: !!presenterId,
    script: fullText.length > 0,
    compliant: lint.fatal.length === 0,
  };
  const locked = !product;

  return (
    <div className="space-y-5">
      <ProductPane products={products} selected={product} pendingId={pendingId} onSelect={selectProduct} onCreate={create} initialMode={startWithNewProduct && !product ? "create" : undefined} />
      <PhotosPane productId={product?.id ?? null} items={items} setItems={setItems} confirmed={confirmed} onConfirmedChange={setConfirmed} showConfirm disabled={locked} />
      <PresenterPane selectedId={presenterId} onSelect={setPresenterId} productCategory={product?.category ?? null} language={options.language} disabled={locked} />
      <ScriptPane
        productId={product?.id ?? null}
        options={options}
        onOptionsChange={changeOptions}
        draft={draft}
        onDraftChange={setDraft}
        lint={lint}
        aiWriter={me ? me.features.aiWriter : null}
        onSave={saveScript}
        disabled={locked}
      />
      <GeneratePane
        productId={product?.id ?? null}
        presenterId={presenterId}
        durationSec={options.durationSec}
        resolution={resolution}
        onResolutionChange={setResolution}
        ready={ready}
        ensureScriptId={saveScript}
        onStarted={() => {
          if (product) clearStash(product.id);
        }}
      />
    </div>
  );
}
