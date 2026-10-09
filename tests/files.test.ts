import { beforeAll, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";

beforeAll(() => {
  process.env.FILES_SIGNING_SECRET = "test-secret";
  process.env.FILES_BASE_URL = "https://files.example.com";
});

describe("signed file URLs", () => {
  it("signs reads exactly as the worker verifies them (key, exp, disp, name)", async () => {
    const { signReadPayload, signedReadUrl } = await import("@/lib/files");
    const expected = createHmac("sha256", "test-secret").update(["uploads/a b.jpg", "100", "inline", "x.jpg"].join("\n")).digest("hex");
    expect(signReadPayload("uploads/a b.jpg", 100, "inline", "x.jpg")).toBe(expected);
    const url = new URL(signedReadUrl("videos/u1/job_1.mp4", { disposition: "attachment", filename: "clip.mp4", ttlSeconds: 60 }));
    expect(url.origin).toBe("https://files.example.com");
    expect(url.pathname).toBe("/d/videos/u1/job_1.mp4");
    expect(url.searchParams.get("disp")).toBe("attachment");
    expect(url.searchParams.get("sig")).toHaveLength(64);
  });

  it("signs uploads with the 'upload' prefix, content type and byte cap", async () => {
    const { signUploadPayload, signedUploadUrl } = await import("@/lib/files");
    const expected = createHmac("sha256", "test-secret").update(["upload", "uploads/u/p/a.png", "100", "image/png", "20971520"].join("\n")).digest("hex");
    expect(signUploadPayload("uploads/u/p/a.png", 100, "image/png", 20971520)).toBe(expected);
    const url = new URL(signedUploadUrl("uploads/u/p/a.png", { contentType: "image/png", maxBytes: 20971520 }));
    expect(url.pathname).toBe("/u/uploads/u/p/a.png");
    expect(url.searchParams.get("ct")).toBe("image/png");
    expect(url.searchParams.get("max")).toBe("20971520");
  });

  it("builds object keys only from safe ids", async () => {
    const { uploadKey, videoKey } = await import("@/lib/files");
    expect(uploadKey("user_2abc", "prd_x1", "ast_y2", ".JPG")).toBe("uploads/user_2abc/prd_x1/ast_y2.jpg");
    expect(videoKey("user_2abc", "job_z3")).toBe("videos/user_2abc/job_z3.mp4");
    expect(() => uploadKey("../etc", "p", "a", "jpg")).toThrow();
    expect(() => uploadKey("u", "p", "a", "php/x")).toThrow();
  });
});
