import { describe, expect, it } from "vitest";
import { IMAGE_HEADER_BYTES, readImageInfo, sniffImageType } from "@/lib/image-dims";

function bytes(...parts: (number[] | string)[]): Uint8Array {
  const out: number[] = [];
  for (const p of parts) {
    if (typeof p === "string") for (const ch of p) out.push(ch.charCodeAt(0));
    else out.push(...p);
  }
  return new Uint8Array(out);
}
const be32 = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
const be16 = (n: number) => [(n >>> 8) & 0xff, n & 0xff];
const le16 = (n: number) => [n & 0xff, (n >>> 8) & 0xff];
const le24 = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff];

const png = (w: number, h: number) => bytes([0x89], "PNG", [0x0d, 0x0a, 0x1a, 0x0a], be32(13), "IHDR", be32(w), be32(h), [8, 2, 0, 0, 0]);

/** SOI, an APP0 segment, a DQT segment, then SOF0 with the frame size. */
const jpeg = (w: number, h: number) =>
  bytes(
    [0xff, 0xd8],
    [0xff, 0xe0],
    be16(16),
    "JFIF",
    [0, 1, 1, 0, 0, 1, 0, 1, 0, 0],
    [0xff, 0xdb],
    be16(4),
    [0, 0],
    [0xff, 0xc0],
    be16(17),
    [8],
    be16(h),
    be16(w),
    [3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1],
  );

const webpLossy = (w: number, h: number) => bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8 ", [0, 0, 0, 0], [0x10, 0x02, 0x00], [0x9d, 0x01, 0x2a], le16(w), le16(h), [0, 0]);
const webpLossless = (w: number, h: number) => {
  const bits = (w - 1) | ((h - 1) << 14);
  return bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8L", [0, 0, 0, 0], [0x2f], [bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff], [0, 0, 0, 0]);
};
const webpExtended = (w: number, h: number) => bytes("RIFF", [0, 0, 0, 0], "WEBP", "VP8X", [10, 0, 0, 0], [0, 0, 0, 0], le24(w - 1), le24(h - 1), [0, 0, 0, 0]);

describe("image header parsing", () => {
  it("recognises the three accepted formats by their magic bytes and nothing else", () => {
    expect(sniffImageType(png(1, 1))).toBe("image/png");
    expect(sniffImageType(jpeg(1, 1))).toBe("image/jpeg");
    expect(sniffImageType(webpLossy(1, 1))).toBe("image/webp");
    expect(sniffImageType(bytes("GIF89a", [0, 0]))).toBeNull();
    expect(sniffImageType(bytes("<svg xmlns=\"http://www.w3.org/2000/svg\"/>"))).toBeNull();
    expect(sniffImageType(bytes("RIFF", [0, 0, 0, 0], "WAVE"))).toBeNull();
    expect(sniffImageType(new Uint8Array(0))).toBeNull();
  });
  it("reads PNG dimensions from IHDR", () => {
    expect(readImageInfo(png(1200, 1600))).toEqual({ type: "image/png", width: 1200, height: 1600 });
    expect(readImageInfo(png(0, 10))).toBeNull();
  });
  it("reads JPEG dimensions from the first start-of-frame marker, past other segments", () => {
    expect(readImageInfo(jpeg(3024, 4032))).toEqual({ type: "image/jpeg", width: 3024, height: 4032 });
  });
  it("gives up on a JPEG whose scan data starts before any frame header", () => {
    const noFrame = bytes([0xff, 0xd8], [0xff, 0xda], be16(2), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(readImageInfo(noFrame)).toBeNull();
  });
  it("reads WebP dimensions for lossy, lossless and extended files", () => {
    expect(readImageInfo(webpLossy(640, 480))).toEqual({ type: "image/webp", width: 640, height: 480 });
    expect(readImageInfo(webpLossless(800, 1000))).toEqual({ type: "image/webp", width: 800, height: 1000 });
    expect(readImageInfo(webpExtended(5000, 6000))).toEqual({ type: "image/webp", width: 5000, height: 6000 });
  });
  it("refuses a lossy WebP without the VP8 start code", () => {
    const broken = webpLossy(10, 10);
    broken[23] = 0x00;
    expect(readImageInfo(broken)).toBeNull();
  });
  it("needs only the leading bytes of a file", () => {
    expect(IMAGE_HEADER_BYTES).toBe(64 * 1024);
    expect(readImageInfo(png(300, 300).subarray(0, 24))).toEqual({ type: "image/png", width: 300, height: 300 });
  });
});
