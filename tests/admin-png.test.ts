import { describe, expect, it } from "vitest";
import { inflateSync } from "node:zlib";
import { solidPng } from "@/app/api/admin/diagnostics/png";

function readChunks(png: Uint8Array): { type: string; data: Buffer }[] {
  const buf = Buffer.from(png);
  const chunks: { type: string; data: Buffer }[] = [];
  let off = 8;
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.subarray(off + 4, off + 8).toString("ascii");
    const data = buf.subarray(off + 8, off + 8 + len);
    chunks.push({ type, data });
    off += 12 + len;
  }
  return chunks;
}

describe("solidPng", () => {
  it("writes a well-formed RGB PNG of the requested size", () => {
    const png = solidPng(320, 320, [0xe8, 0x56, 0x2a]);
    expect(Buffer.from(png.subarray(0, 8)).toString("hex")).toBe("89504e470d0a1a0a");
    const chunks = readChunks(png);
    expect(chunks.map((c) => c.type)).toEqual(["IHDR", "IDAT", "IEND"]);
    const ihdr = chunks[0]!.data;
    expect(ihdr.readUInt32BE(0)).toBe(320);
    expect(ihdr.readUInt32BE(4)).toBe(320);
    expect(ihdr[8]).toBe(8); // bit depth
    expect(ihdr[9]).toBe(2); // RGB
    const raw = inflateSync(chunks[1]!.data);
    expect(raw.length).toBe(320 * (1 + 320 * 3));
    expect(raw[0]).toBe(0); // filter byte
    expect([raw[1], raw[2], raw[3]]).toEqual([0xe8, 0x56, 0x2a]);
  });

  it("is small enough to upload in one request", () => {
    expect(solidPng(320, 320, [255, 255, 255]).byteLength).toBeLessThan(4096);
  });
});
