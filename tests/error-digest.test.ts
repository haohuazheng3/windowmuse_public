import { describe, expect, it } from "vitest";
import { formatDigest, utcDay, type DigestItem } from "@/lib/error-digest-format";

const item = (over: Partial<DigestItem> = {}): DigestItem => ({
  name: "Error",
  message: "Permission denied for this endpoint",
  source: "server",
  route: "/api/stripe/webhook",
  count: 253,
  firstSeen: new Date("2026-11-01T22:42:40Z"),
  lastSeen: new Date("2026-11-07T00:36:38Z"),
  ...over,
});

describe("daily error digest", () => {
  it("uses the UTC calendar day", () => {
    expect(utcDay(new Date("2026-11-06T23:59:59-05:00"))).toBe("2026-11-07");
  });

  it("summarises the count and the top items with a link to the inbox", () => {
    const { subject, text } = formatDigest({ day: "2026-11-07", openErrors: 3, openWarnings: 5, items: [item(), item({ route: null, message: "multi\nline   message" })], inboxUrl: "https://windowmuse.com/admin/errors" });
    expect(subject).toBe("Daily error digest: 3 open errors");
    expect(text).toContain("1. Error: Permission denied for this endpoint");
    expect(text).toContain("server · /api/stripe/webhook · ×253 · first 2026-11-01 22:42 UTC · last 2026-11-07 00:36 UTC");
    expect(text).toContain("2. Error: multi line message");
    expect(text).toContain("no route");
    expect(text).toContain("…and 1 more.");
    expect(text).toContain("Also open: 5 warnings");
    expect(text).toContain("Review and resolve: https://windowmuse.com/admin/errors");
  });

  it("keeps long messages to one short line", () => {
    const { text } = formatDigest({ day: "2026-11-07", openErrors: 1, openWarnings: 0, items: [item({ message: "x".repeat(1000) })], inboxUrl: "u" });
    const line = text.split("\n").find((l) => l.startsWith("1. "))!;
    expect(line.length).toBeLessThanOrEqual(224);
    expect(text).not.toContain("warning");
  });
});
