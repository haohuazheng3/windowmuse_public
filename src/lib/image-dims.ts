/*
 * Reads the real pixel size of an uploaded photo from its first bytes, so the server never
 * trusts the dimensions a browser reports. Pure (no Node APIs), unit-tested, and enough for
 * the three formats the upload accepts: JPEG (SOF markers), PNG (IHDR) and WebP (VP8 /
 * VP8L / VP8X chunks). 64 KB from the start of the file covers every real-world header.
 */

export type ImageKind = "image/jpeg" | "image/png" | "image/webp";

export interface ImageInfo {
  type: ImageKind;
  width: number;
  height: number;
}

/** How many leading bytes to request from storage before calling `readImageInfo`. */
export const IMAGE_HEADER_BYTES = 64 * 1024;

function ascii(b: Uint8Array, at: number, len: number): string {
  let s = "";
  for (let i = at; i < at + len && i < b.length; i++) s += String.fromCharCode(b[i]!);
  return s;
}

function u16be(b: Uint8Array, at: number): number {
  return ((b[at] ?? 0) << 8) | (b[at + 1] ?? 0);
}
function u32be(b: Uint8Array, at: number): number {
  return (((b[at] ?? 0) << 24) >>> 0) + ((b[at + 1] ?? 0) << 16) + ((b[at + 2] ?? 0) << 8) + (b[at + 3] ?? 0);
}
function u16le(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8);
}
function u24le(b: Uint8Array, at: number): number {
  return (b[at] ?? 0) | ((b[at + 1] ?? 0) << 8) | ((b[at + 2] ?? 0) << 16);
}

function png(b: Uint8Array): ImageInfo | null {
  // 8-byte signature, then the IHDR chunk: length(4) "IHDR"(4) width(4) height(4)
  if (b.length < 24) return null;
  if (ascii(b, 12, 4) !== "IHDR") return null;
  const width = u32be(b, 16);
  const height = u32be(b, 20);
  return width > 0 && height > 0 ? { type: "image/png", width, height } : null;
}

function jpeg(b: Uint8Array): ImageInfo | null {
  // Walk the marker segments until a start-of-frame (SOF0…SOF15, except DHT/JPG/DAC).
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i++;
      continue;
    }
    const marker = b[i + 1] ?? 0;
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      i += 2; // standalone markers carry no length
      continue;
    }
    const length = u16be(b, i + 2);
    if (length < 2) return null;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      const height = u16be(b, i + 5);
      const width = u16be(b, i + 7);
      return width > 0 && height > 0 ? { type: "image/jpeg", width, height } : null;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // end of image / scan data before any frame header
    i += 2 + length;
  }
  return null;
}

function webp(b: Uint8Array): ImageInfo | null {
  // "RIFF" size "WEBP" then a chunk: "VP8 " (lossy), "VP8L" (lossless) or "VP8X" (extended).
  const chunk = ascii(b, 12, 4);
  if (chunk === "VP8X") {
    if (b.length < 30) return null;
    const width = u24le(b, 24) + 1;
    const height = u24le(b, 27) + 1;
    return { type: "image/webp", width, height };
  }
  if (chunk === "VP8L") {
    if (b.length < 25 || b[20] !== 0x2f) return null;
    const bits = (b[21] ?? 0) | ((b[22] ?? 0) << 8) | ((b[23] ?? 0) << 16) | ((b[24] ?? 0) << 24);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return { type: "image/webp", width, height };
  }
  if (chunk === "VP8 ") {
    // Frame tag (3 bytes), start code 9d 01 2a, then 14-bit width and height.
    if (b.length < 30 || b[23] !== 0x9d || b[24] !== 0x01 || b[25] !== 0x2a) return null;
    const width = u16le(b, 26) & 0x3fff;
    const height = u16le(b, 28) & 0x3fff;
    return width > 0 && height > 0 ? { type: "image/webp", width, height } : null;
  }
  return null;
}

/** The format the magic bytes say the file is, or null when it is none of the accepted three. */
export function sniffImageType(b: Uint8Array): ImageKind | null {
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && ascii(b, 1, 3) === "PNG" && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  return null;
}

/** Type and pixel size from the file header, or null when the bytes are not a readable JPEG, PNG or WebP. */
export function readImageInfo(b: Uint8Array): ImageInfo | null {
  const type = sniffImageType(b);
  if (type === "image/png") return png(b);
  if (type === "image/jpeg") return jpeg(b);
  if (type === "image/webp") return webp(b);
  return null;
}
