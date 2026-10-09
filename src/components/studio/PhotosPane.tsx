"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { removeAsset } from "@/app/(app)/studio/products/actions";
import { track } from "@/components/Consent";
import type { AssetView } from "@/lib/products";
import { UPLOAD_RULES, checkDimensions, checkFile, formatBytes, rejectionText, remainingSlots } from "@/lib/upload-rules";
import { PaneHeader } from "./PaneHeader";

/*
 * Pane 2: product photos. Files are checked in the browser first (type, size, pixel
 * dimensions), then go straight to the files worker with a signed URL from
 * POST /api/uploads/sign, and POST /api/uploads/complete turns the pending asset into a
 * ready one. Thumbnails come from object URLs the instant a file is chosen; progress is
 * the real byte count of the PUT. The item list is owned by the parent so it can gate
 * the rest of the flow on "at least one ready photo".
 */

export type PhotoStatus = "checking" | "signing" | "uploading" | "saving" | "ready" | "error";

export interface PhotoItem {
  key: string;
  assetId: string | null;
  name: string;
  bytes: number;
  url: string;
  objectUrl: boolean;
  width: number | null;
  height: number | null;
  status: PhotoStatus;
  /** 0–100 for the PUT; the other stages are indeterminate. */
  progress: number;
  error: string | null;
}

export function itemsFromAssets(assets: AssetView[]): PhotoItem[] {
  return assets
    .filter((a) => a.kind === "image" && a.status === "ready")
    .map((a) => ({
      key: a.id,
      assetId: a.id,
      name: a.id,
      bytes: a.bytes,
      url: a.url,
      objectUrl: false,
      width: a.width,
      height: a.height,
      status: "ready" as const,
      progress: 100,
      error: null,
    }));
}

export function readyCount(items: PhotoItem[]): number {
  return items.filter((i) => i.status === "ready").length;
}

function countsTowardLimit(i: PhotoItem): boolean {
  return i.status !== "error";
}

interface SignResponse {
  assetId: string;
  uploadUrl: string;
  key: string;
}

async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bmp = await createImageBitmap(file);
      const d = { width: bmp.width, height: bmp.height };
      bmp.close();
      return d;
    } catch {
      /* some browsers refuse certain encodings; the <img> path below still works */
    }
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("The image could not be decoded."));
    };
    img.src = url;
  });
}

function putWithProgress(url: string, file: File, onProgress: (ratio: number) => void, register: (xhr: XMLHttpRequest) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    register(xhr);
    xhr.open("PUT", url);
    // Exactly the type the server signed; the worker rejects anything else.
    xhr.setRequestHeader("Content-Type", file.type);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`The upload was refused (${xhr.status}).`)));
    xhr.onerror = () => reject(new Error("The upload didn't reach the server. Check your connection."));
    xhr.onabort = () => reject(new Error("aborted"));
    xhr.send(file);
  });
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error ?? fallback;
  } catch {
    return fallback;
  }
}

const PARALLEL = 3;

export function PhotosPane({
  productId,
  items,
  setItems,
  confirmed,
  onConfirmedChange,
  showConfirm,
  step = 2,
  disabled = false,
}: {
  productId: string | null;
  items: PhotoItem[];
  setItems: Dispatch<SetStateAction<PhotoItem[]>>;
  confirmed: boolean;
  onConfirmedChange: (v: boolean) => void;
  /** The "my photos, no people" checkbox (the create flow); off on the product page. */
  showConfirm: boolean;
  step?: number;
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrs = useRef(new Map<string, XMLHttpRequest>());
  /** Signed thumbnail links expire after an hour; one page refresh re-signs them (never a loop). */
  const refreshed = useRef(false);
  const queue = useRef<(() => Promise<void>)[]>([]);
  const active = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Every object URL this pane created, revoked when the pane goes away; in-flight uploads are aborted.
  const objectUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = objectUrls.current;
    const map = xhrs.current;
    return () => {
      for (const u of urls) URL.revokeObjectURL(u);
      urls.clear();
      for (const x of map.values()) x.abort();
    };
  }, []);

  const patch = (key: string, p: Partial<PhotoItem>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...p } : i)));

  const pump = () => {
    while (active.current < PARALLEL && queue.current.length > 0) {
      const job = queue.current.shift();
      if (!job) break;
      active.current++;
      void job().finally(() => {
        active.current--;
        pump();
      });
    }
  };

  const upload = async (file: File, key: string) => {
    if (!productId) return;
    try {
      const dims = await readDimensions(file);
      const bad = checkDimensions(dims);
      if (bad) {
        patch(key, { status: "error", error: rejectionText(bad), width: dims.width, height: dims.height });
        return;
      }
      patch(key, { status: "signing", width: dims.width, height: dims.height });
      const signRes = await fetch("/api/uploads/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ productId, contentType: file.type, bytes: file.size }),
      });
      if (!signRes.ok) {
        patch(key, { status: "error", error: await readError(signRes, `We couldn't prepare the upload (${signRes.status}).`) });
        return;
      }
      const signed = (await signRes.json()) as SignResponse;
      patch(key, { status: "uploading", progress: 0, assetId: signed.assetId });
      await putWithProgress(
        signed.uploadUrl,
        file,
        (r) => patch(key, { progress: Math.round(r * 100) }),
        (xhr) => xhrs.current.set(key, xhr),
      );
      xhrs.current.delete(key);
      patch(key, { status: "saving", progress: 100 });
      const doneRes = await fetch("/api/uploads/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({ assetId: signed.assetId, width: dims.width, height: dims.height }),
      });
      if (!doneRes.ok) {
        patch(key, { status: "error", error: await readError(doneRes, `The upload wasn't saved (${doneRes.status}).`) });
        return;
      }
      patch(key, { status: "ready" });
      track("upload", { productId, bytes: file.size, width: dims.width, height: dims.height, type: file.type });
    } catch (e) {
      xhrs.current.delete(key);
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      if (msg === "aborted") return;
      console.warn("[upload] failed", e);
      patch(key, { status: "error", error: msg });
    }
  };

  const addFiles = (files: FileList | File[]) => {
    if (!productId || disabled) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setNotice(null);
    const slots = remainingSlots(items.filter(countsTowardLimit).length);
    const accepted = list.slice(0, slots);
    if (list.length > slots) setNotice(slots === 0 ? rejectionText("count") : `${rejectionText("count")} The first ${slots} were added.`);
    const next: PhotoItem[] = [];
    for (const file of accepted) {
      const key = `local_${crypto.randomUUID()}`;
      const bad = checkFile(file);
      const url = URL.createObjectURL(file);
      objectUrls.current.add(url);
      const item: PhotoItem = {
        key,
        assetId: null,
        name: file.name,
        bytes: file.size,
        url,
        objectUrl: true,
        width: null,
        height: null,
        status: bad ? "error" : "checking",
        progress: 0,
        error: bad ? rejectionText(bad) : null,
      };
      next.push(item);
      if (!bad) queue.current.push(() => upload(file, key));
    }
    setItems((cur) => [...cur, ...next]);
    pump();
  };

  const remove = async (item: PhotoItem) => {
    const xhr = xhrs.current.get(item.key);
    if (xhr) xhr.abort();
    setItems((list) => list.filter((i) => i.key !== item.key));
    const release = () => {
      if (!item.objectUrl) return;
      URL.revokeObjectURL(item.url);
      objectUrls.current.delete(item.url);
    };
    if (!item.assetId || item.status === "error") {
      release();
      return;
    }
    const r = await removeAsset(item.assetId);
    if (!r.ok) {
      // Roll back; the thumbnail URL is still valid because nothing was released yet.
      setItems((list) => [...list, item]);
      setNotice(r.error);
      return;
    }
    release();
  };

  const ready = readyCount(items);
  const counted = items.filter(countsTowardLimit).length;
  const full = counted >= UPLOAD_RULES.maxPhotos;
  const inactive = disabled || !productId;
  const failed = items.filter((i) => i.status === "error");

  const onThumbnailError = (item: PhotoItem) => {
    if (item.objectUrl || item.status !== "ready" || refreshed.current) return;
    refreshed.current = true;
    router.refresh();
  };

  return (
    <section className={`pane p-5 sm:p-6 ${inactive ? "opacity-60" : ""}`} aria-labelledby="pane-photos">
      <PaneHeader
        step={step}
        id="pane-photos"
        title="Photos"
        done={ready > 0 && (!showConfirm || confirmed)}
        disabled={inactive}
        summary={
          inactive
            ? "Pick a product first"
            : ready === 0
              ? `1–${UPLOAD_RULES.maxPhotos} photos of the product itself: front, side, in use`
              : `${ready} ready${counted - ready > 0 ? `, ${counted - ready} uploading` : ""} · the presenter shows these exactly as photographed`
        }
      />

      <div
        className={`mt-5 grid gap-3 ${items.length > 0 ? "grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!inactive && !full) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!inactive && !full) addFiles(e.dataTransfer.files);
        }}
      >
        {items.map((i) => (
          <figure key={i.key} className="relative min-w-0">
            <div className={`relative aspect-[4/5] overflow-hidden rounded-[16px] bg-pane-2 ${i.status === "error" ? "ring-2 ring-bad" : ""}`}>
              {/* Thumbnails are object URLs or short-lived signed links; next/image cannot optimise either. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={i.url} alt="" onError={() => onThumbnailError(i)} className={`h-full w-full object-cover transition-opacity ${i.status === "ready" ? "opacity-100" : "opacity-70"}`} />
              {i.status !== "ready" && i.status !== "error" ? (
                <div className="absolute inset-x-2 bottom-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                    <div
                      className={`h-full rounded-full bg-accent transition-[width] duration-200 ${i.status === "uploading" ? "" : "animate-pulse"}`}
                      style={{ width: i.status === "uploading" ? `${Math.max(4, i.progress)}%` : i.status === "saving" ? "100%" : "30%" }}
                    />
                  </div>
                  <p className="mt-1 truncate text-[0.68rem] font-semibold text-white drop-shadow">
                    {i.status === "checking" ? "Checking" : i.status === "signing" ? "Preparing" : i.status === "uploading" ? `${i.progress}%` : "Saving"}
                  </p>
                </div>
              ) : null}
              {i.status === "ready" ? <span className="tag tag-ok absolute left-1.5 top-1.5 !text-[0.66rem]">Ready</span> : null}
              {/* 40 px touch target; the visible disc stays small so it does not cover the photo. */}
              <button
                type="button"
                className="absolute right-0 top-0 grid h-10 w-10 place-items-center text-white"
                aria-label={`Remove photo ${i.name}`}
                onClick={() => void remove(i)}
              >
                <span aria-hidden="true" className="grid h-7 w-7 place-items-center rounded-full bg-black/55 hover:bg-black/75">
                  ×
                </span>
              </button>
            </div>
            <figcaption className="mt-1 truncate text-[0.7rem] text-ink-4">
              {i.status === "error" ? <span className="text-bad">Not added</span> : i.width && i.height ? `${i.width}×${i.height} · ${formatBytes(i.bytes)}` : formatBytes(i.bytes)}
            </figcaption>
          </figure>
        ))}

        {!full ? (
          <button
            type="button"
            disabled={inactive}
            onClick={() => inputRef.current?.click()}
            className={`${items.length > 0 ? "aspect-[4/5] rounded-[16px]" : "min-h-[150px] w-full rounded-[20px] sm:col-span-full"} grid place-items-center border-2 border-dashed px-3 text-center transition-colors ${
              dragging ? "border-accent bg-accent-soft" : "border-[var(--line-2)] bg-pane-2 hover:bg-pane-3"
            }`}
          >
            <span className="text-[0.9rem] font-semibold text-ink-2">
              {items.length > 0 ? "+ Add" : "Drop photos here or tap to choose"}
              {items.length === 0 ? (
                <span className="mt-1 block text-[0.8rem] font-normal text-ink-4">
                  JPEG, PNG or WebP · up to {formatBytes(UPLOAD_RULES.maxBytes)} · {UPLOAD_RULES.minPx}–{UPLOAD_RULES.maxPx} px
                </span>
              ) : null}
            </span>
          </button>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={UPLOAD_RULES.types.join(",")}
        multiple
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          if (e.target.files) addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {notice ? (
        <p role="alert" className="mt-3 rounded-2xl bg-bad-soft px-4 py-2.5 text-[0.88rem] text-bad">
          {notice}
        </p>
      ) : null}

      {failed.length > 0 ? (
        <ul role="alert" className="mt-3 space-y-2 rounded-2xl bg-bad-soft px-4 py-3 text-[0.88rem] text-bad">
          {failed.map((i) => (
            <li key={i.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <span className="min-w-0 flex-1 break-words">
                <span className="font-semibold">{i.name}</span>: {i.error}
              </span>
              <button type="button" className="btn btn-quiet btn-sm shrink-0 !text-bad" onClick={() => void remove(i)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {showConfirm ? (
        <label className={`mt-5 flex cursor-pointer items-start gap-3 rounded-[20px] px-4 py-3.5 ${confirmed ? "bg-ok-soft" : "bg-pane-2"}`}>
          <input type="checkbox" checked={confirmed} disabled={inactive} onChange={(e) => onConfirmedChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-[0.95rem] leading-snug text-ink">
            These are my product photos and they show no people.
            <span className="mt-0.5 block text-[0.82rem] text-ink-4">The presenter is fictional; the product is never redrawn. Photos of real people are not accepted.</span>
          </span>
        </label>
      ) : null}
    </section>
  );
}
