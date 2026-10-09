"use client";

import { useEffect, useRef, useState } from "react";
import type { ProductCategory } from "@/lib/db/schema";
import { CATEGORY_LABELS, CATEGORY_VALUES, PRODUCT_LIMITS, firstIssue, productInputSchema, type ProductInput } from "@/lib/product-schema";
import type { ProductView } from "@/lib/products";

/*
 * The product form, for creating inside the flow and for editing on the product page.
 * Validation runs with the same zod schema the server action uses, so the first problem
 * shows inline, on the field it concerns, before any request. Submit state flips on press,
 * never on response. A new product's draft is kept in session storage while it is typed,
 * so a refresh or a dropped connection does not lose five selling points.
 */

const DRAFT_KEY = "wm_product_draft";

interface ProductDraft {
  name: string;
  brand: string;
  category: ProductCategory | "";
  points: string[];
  audience: string;
  priceText: string;
  shopUrl: string;
}

function readDraft(): ProductDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const d = v as Partial<ProductDraft>;
    const str = (x: unknown) => (typeof x === "string" ? x : "");
    return {
      name: str(d.name),
      brand: str(d.brand),
      category: (CATEGORY_VALUES as readonly string[]).includes(str(d.category)) ? (d.category as ProductCategory) : "",
      points: Array.isArray(d.points) && d.points.length > 0 ? d.points.map(str) : [""],
      audience: str(d.audience),
      priceText: str(d.priceText),
      shopUrl: str(d.shopUrl),
    };
  } catch {
    return null;
  }
}

function writeDraft(d: ProductDraft): void {
  try {
    const empty = !d.name && !d.brand && !d.category && d.points.every((p) => !p) && !d.audience && !d.priceText && !d.shopUrl;
    if (empty) sessionStorage.removeItem(DRAFT_KEY);
    else sessionStorage.setItem(DRAFT_KEY, JSON.stringify(d));
  } catch {
    /* private mode or quota: the form still works, it just does not survive a refresh */
  }
}

function clearDraft(): void {
  try {
    sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* fine */
  }
}

/** Which input a validation issue belongs to, by the zod path, so it can be marked and focused. */
function fieldIdFor(path: PropertyKey[]): string | null {
  const [head, index] = path;
  switch (head) {
    case "name":
      return "pf-name";
    case "brand":
      return "pf-brand";
    case "category":
      return "pf-category";
    case "sellingPoints":
      return typeof index === "number" ? `pf-point-${index}` : "pf-point-0";
    case "audience":
      return "pf-audience";
    case "priceText":
      return "pf-price";
    case "shopUrl":
      return "pf-url";
    default:
      return null;
  }
}

export interface ProductFormProps {
  initial?: ProductView | null;
  submitLabel: string;
  busyLabel: string;
  onSubmit: (input: ProductInput) => Promise<{ ok: true } | { ok: false; error: string }>;
  onCancel?: () => void;
  /** Shown as a small line after a successful save (edit mode). */
  savedNote?: string;
}

function initialPoints(p: ProductView | null | undefined): string[] {
  const pts = p?.sellingPoints ?? [];
  return pts.length > 0 ? [...pts] : [""];
}

export function ProductForm({ initial, submitLabel, busyLabel, onSubmit, onCancel, savedNote }: ProductFormProps) {
  // Creating (no `initial`): start from the stashed draft when there is one. Editing: from the product.
  const [draft] = useState<ProductDraft | null>(() => (initial ? null : readDraft()));
  const [name, setName] = useState(initial?.name ?? draft?.name ?? "");
  const [brand, setBrand] = useState(initial?.brand ?? draft?.brand ?? "");
  const [category, setCategory] = useState<ProductCategory | "">(initial?.category ?? draft?.category ?? "");
  const [points, setPoints] = useState<string[]>(() => (initial ? initialPoints(initial) : (draft?.points ?? [""])));
  const [audience, setAudience] = useState(initial?.audience ?? draft?.audience ?? "");
  const [priceText, setPriceText] = useState(initial?.priceText ?? draft?.priceText ?? "");
  const [shopUrl, setShopUrl] = useState(initial?.shopUrl ?? draft?.shopUrl ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorField, setErrorField] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const stashing = useRef(!initial);

  useEffect(() => {
    if (!stashing.current) return;
    writeDraft({ name, brand, category, points, audience, priceText, shopUrl });
  }, [name, brand, category, points, audience, priceText, shopUrl]);

  const invalid = (id: string) => (errorField === id ? ({ "aria-invalid": true, "aria-describedby": "pf-error" } as const) : {});

  const fail = (message: string, path: PropertyKey[] = []) => {
    const id = fieldIdFor(path);
    setError(message);
    setErrorField(id);
    if (id) document.getElementById(id)?.focus();
  };

  const collect = (): ProductInput => ({
    name,
    brand: brand || undefined,
    category: category as ProductCategory,
    sellingPoints: points.map((p) => p.trim()).filter(Boolean),
    audience: audience || undefined,
    priceText: priceText || undefined,
    shopUrl: shopUrl || undefined,
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const input = collect();
    const parsed = productInputSchema.safeParse(input);
    if (!parsed.success) {
      fail(firstIssue(parsed.error), parsed.error.issues[0]?.path ?? []);
      return;
    }
    setError(null);
    setErrorField(null);
    setSaved(false);
    setBusy(true);
    const r = await onSubmit(parsed.data);
    setBusy(false);
    if (!r.ok) {
      fail(r.error);
      return;
    }
    if (stashing.current) {
      stashing.current = false;
      clearDraft();
    }
    setSaved(true);
  };

  const setPoint = (i: number, v: string) => setPoints((ps) => ps.map((p, j) => (j === i ? v : p)));
  const removePoint = (i: number) => setPoints((ps) => (ps.length === 1 ? [""] : ps.filter((_, j) => j !== i)));
  const addPoint = () => setPoints((ps) => (ps.length < PRODUCT_LIMITS.sellingPointsMax ? [...ps, ""] : ps));

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
        <div className="min-w-0">
          <label htmlFor="pf-name" className="field-label">
            Product name
          </label>
          <input
            id="pf-name"
            className="input"
            value={name}
            maxLength={PRODUCT_LIMITS.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Collapsible silicone lunch box, 1.2 L"
            autoComplete="off"
            required
            {...invalid("pf-name")}
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="pf-brand" className="field-label">
            Brand <span className="font-normal text-ink-4">(optional)</span>
          </label>
          <input id="pf-brand" className="input" value={brand} maxLength={PRODUCT_LIMITS.brand} onChange={(e) => setBrand(e.target.value)} placeholder="Your shop name" autoComplete="off" {...invalid("pf-brand")} />
        </div>
      </div>

      <div>
        <label htmlFor="pf-category" className="field-label">
          Category
        </label>
        <select id="pf-category" className="select" value={category} onChange={(e) => setCategory(e.target.value as ProductCategory | "")} required {...invalid("pf-category")}>
          <option value="" disabled>
            Pick one
          </option>
          {CATEGORY_VALUES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <span className="field-hint">Helps match a presenter and shapes the script&rsquo;s angle.</span>
      </div>

      <fieldset>
        <legend className="field-label">
          Selling points <span className="font-normal text-ink-4">(1–{PRODUCT_LIMITS.sellingPointsMax}, facts the presenter can say)</span>
        </legend>
        <div className="grid gap-2">
          {points.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                id={`pf-point-${i}`}
                className="input"
                value={p}
                maxLength={PRODUCT_LIMITS.sellingPoint}
                onChange={(e) => setPoint(i, e.target.value)}
                placeholder={i === 0 ? "Folds flat to 3 cm, fits a coat pocket" : i === 1 ? "Leak-proof lid, dishwasher safe" : "One more thing worth saying"}
                aria-label={`Selling point ${i + 1}`}
                {...invalid(`pf-point-${i}`)}
              />
              <button type="button" className="btn btn-quiet btn-sm !px-3" aria-label={`Remove selling point ${i + 1}`} onClick={() => removePoint(i)}>
                ×
              </button>
            </div>
          ))}
        </div>
        {points.length < PRODUCT_LIMITS.sellingPointsMax ? (
          <button type="button" className="btn btn-quiet btn-sm mt-2" onClick={addPoint}>
            + Add a selling point
          </button>
        ) : null}
        <span className="field-hint">Verifiable facts only: size, material, what it does. No cures, no guarantees, no &ldquo;customers say&rdquo;.</span>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="pf-audience" className="field-label">
            Who it is for <span className="font-normal text-ink-4">(optional)</span>
          </label>
          <input id="pf-audience" className="input" value={audience} maxLength={PRODUCT_LIMITS.audience} onChange={(e) => setAudience(e.target.value)} placeholder="Commuters who pack lunch" autoComplete="off" {...invalid("pf-audience")} />
        </div>
        <div className="min-w-0">
          <label htmlFor="pf-price" className="field-label">
            Price <span className="font-normal text-ink-4">(optional, as shown in your shop)</span>
          </label>
          <input id="pf-price" className="input" value={priceText} maxLength={PRODUCT_LIMITS.priceText} onChange={(e) => setPriceText(e.target.value)} placeholder="$18.90" autoComplete="off" inputMode="decimal" {...invalid("pf-price")} />
        </div>
      </div>

      <div>
        <label htmlFor="pf-url" className="field-label">
          TikTok Shop link <span className="font-normal text-ink-4">(optional)</span>
        </label>
        <input id="pf-url" className="input" value={shopUrl} maxLength={PRODUCT_LIMITS.shopUrl} onChange={(e) => setShopUrl(e.target.value)} placeholder="https://www.tiktok.com/shop/…" inputMode="url" autoComplete="off" {...invalid("pf-url")} />
      </div>

      {error ? (
        <p id="pf-error" role="alert" className="rounded-2xl bg-bad-soft px-4 py-3 text-[0.92rem] text-bad">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-primary" disabled={busy} aria-busy={busy}>
          {busy ? <span className="spinner" aria-hidden="true" /> : null}
          {busy ? busyLabel : submitLabel}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-quiet" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
        {saved && savedNote ? (
          <span className="text-[0.88rem] text-ok" role="status">
            {savedNote}
          </span>
        ) : null}
      </div>
    </form>
  );
}
