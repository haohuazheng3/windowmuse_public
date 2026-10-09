import { describe, expect, it } from "vitest";
import { UPLOAD_RULES, checkDimensions, checkFile, extFor, formatBytes, remainingSlots } from "@/lib/upload-rules";

describe("upload rules", () => {
  it("accepts jpeg/png/webp up to 20 MB and nothing else", () => {
    expect(checkFile({ type: "image/jpeg", size: 1024 })).toBeNull();
    expect(checkFile({ type: "image/webp", size: UPLOAD_RULES.maxBytes })).toBeNull();
    expect(checkFile({ type: "image/gif", size: 1024 })).toBe("type");
    expect(checkFile({ type: "image/png", size: UPLOAD_RULES.maxBytes + 1 })).toBe("size");
    expect(checkFile({ type: "image/png", size: 0 })).toBe("empty");
  });

  it("checks the short side against 300 px and the long side against 6000 px", () => {
    expect(checkDimensions({ width: 300, height: 6000 })).toBeNull();
    expect(checkDimensions({ width: 299, height: 1000 })).toBe("small");
    expect(checkDimensions({ width: 1000, height: 6001 })).toBe("large");
  });

  it("counts remaining slots out of eight and maps extensions", () => {
    expect(remainingSlots(0)).toBe(8);
    expect(remainingSlots(8)).toBe(0);
    expect(remainingSlots(9)).toBe(0);
    expect(extFor("image/jpeg")).toBe("jpg");
    expect(extFor("image/png")).toBe("png");
    expect(extFor("image/webp")).toBe("webp");
    expect(formatBytes(20 * 1024 * 1024)).toBe("20 MB");
    expect(formatBytes(1536)).toBe("2 KB");
  });
});
