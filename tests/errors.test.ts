import { describe, expect, it } from "vitest";
import { clientSeverity, effectiveSeverity, fingerprintOf, firstFrame } from "@/lib/errors";

describe("error fingerprinting", () => {
  it("strips line/column numbers and build hashes so deploys don't split groups", () => {
    const a = firstFrame("Error: x\n    at handler (/var/task/.next/server/chunks/8a7f3c2d9e1b.js:12:345)");
    const b = firstFrame("Error: x\n    at handler (/var/task/.next/server/chunks/1b2c3d4e5f6a.js:99:1)");
    expect(a).toBe(b);
    expect(a).toContain("at handler");
  });
  it("groups by name + frame + route", () => {
    const f = firstFrame("TypeError: y\n    at go (file.js:1:2)");
    expect(fingerprintOf("TypeError", f, "/a", "y")).toBe(fingerprintOf("TypeError", f, "/a", "different message"));
    expect(fingerprintOf("TypeError", f, "/a", "y")).not.toBe(fingerprintOf("TypeError", f, "/b", "y"));
  });
  it("falls back to the message when there is no stack", () => {
    expect(fingerprintOf("Error", "", "/a", "boom 1")).toBe(fingerprintOf("Error", "", "/a", "boom 2"));
    expect(fingerprintOf("Error", "", "/a", "boom")).not.toBe(fingerprintOf("Error", "", "/a", "other"));
  });
});

describe("severity classification", () => {
  const hydration = "Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message";
  it("keeps browser hydration mismatches out of the severe bucket", () => {
    expect(effectiveSeverity("client", "error", hydration)).toBe("warn");
    expect(effectiveSeverity("client", "error", "Hydration failed because the server rendered HTML didn't match the client.")).toBe("warn");
  });
  it("leaves other client errors and all server errors alone", () => {
    expect(effectiveSeverity("client", "error", "TypeError: x is undefined")).toBe("error");
    expect(effectiveSeverity("server", "error", hydration)).toBe("error");
    expect(effectiveSeverity("client", "warn", "anything")).toBe("warn");
  });
});

describe("client-reported severity", () => {
  const ours = "TypeError: x\n    at render (https://windowmuse.com/_next/static/chunks/app/page-8a7f3c2d.js:1:200)";
  it("keeps \"error\" only for a stack that runs through our own bundle", () => {
    expect(clientSeverity("error", ours)).toBe("error");
  });
  it("downgrades anything else: no stack, a foreign script, an extension frame, or a plain warn", () => {
    expect(clientSeverity("error", undefined)).toBe("warn");
    expect(clientSeverity("error", "Error: y\n    at https://cdn.example.com/widget.js:1:1")).toBe("warn");
    expect(clientSeverity("error", `${ours}\n    at chrome-extension://abc/content.js:1:1`)).toBe("warn");
    expect(clientSeverity("warn", ours)).toBe("warn");
  });
});
