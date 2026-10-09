/*
 * Photo upload rules, pure and shared by the browser (instant feedback before any request)
 * and the upload routes. 1–8 photos per product; jpeg/png/webp; ≤ 20 MB; 300–6000 px.
 */

export const UPLOAD_RULES = {
  maxPhotos: 8,
  maxBytes: 20 * 1024 * 1024,
  minPx: 300,
  maxPx: 6000,
  types: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export type UploadType = (typeof UPLOAD_RULES.types)[number];
export type UploadRejection = "type" | "size" | "small" | "large" | "count" | "empty";

export function isUploadType(t: string): t is UploadType {
  return (UPLOAD_RULES.types as readonly string[]).includes(t);
}

/** Checks that need only the file header (type and size). */
export function checkFile(file: { type: string; size: number }): UploadRejection | null {
  if (!isUploadType(file.type)) return "type";
  if (file.size <= 0) return "empty";
  if (file.size > UPLOAD_RULES.maxBytes) return "size";
  return null;
}

/** Checks that need the decoded image. */
export function checkDimensions(d: { width: number; height: number }): UploadRejection | null {
  const lo = Math.min(d.width, d.height);
  const hi = Math.max(d.width, d.height);
  if (lo < UPLOAD_RULES.minPx) return "small";
  if (hi > UPLOAD_RULES.maxPx) return "large";
  return null;
}

/** How many more photos a product can take. */
export function remainingSlots(current: number): number {
  return Math.max(0, UPLOAD_RULES.maxPhotos - current);
}

export function rejectionText(r: UploadRejection): string {
  switch (r) {
    case "type":
      return "Only JPEG, PNG or WebP photos.";
    case "size":
      return `Larger than ${formatBytes(UPLOAD_RULES.maxBytes)}.`;
    case "small":
      return `Smaller than ${UPLOAD_RULES.minPx} px on its short side; the presenter would hold a blurry product.`;
    case "large":
      return `Longer than ${UPLOAD_RULES.maxPx} px on its long side; export a smaller copy.`;
    case "count":
      return `A product takes up to ${UPLOAD_RULES.maxPhotos} photos.`;
    case "empty":
      return "The file is empty.";
  }
}

export function extFor(type: UploadType): "jpg" | "png" | "webp" {
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  return "webp";
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  const mb = n / (1024 * 1024);
  return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
}
