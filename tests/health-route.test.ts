import { beforeEach, describe, expect, it, vi } from "vitest";

// /api/health with its dependencies faked: only the database and required config decide the status.
const state = { unresolved: 2, dbFails: false, missing: [] as string[] };

vi.mock("@/lib/admin", () => ({ bearerMatches: () => false }));
vi.mock("@/lib/stripe", () => ({ stripeMode: () => "live" }));
vi.mock("@/lib/errors", () => ({ captureError: async () => {}, HEALTH_SOURCES: ["server", "edge", "worker", "cron"] }));
vi.mock("@/lib/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: async () => {
          if (state.dbFails) throw new Error("connect ECONNREFUSED");
          return [{ n: state.unresolved }];
        },
      }),
    }),
  },
}));
vi.mock("@/lib/env", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/lib/env")>()), missingEnv: () => state.missing }));

const { GET } = await import("@/app/api/health/route");
const call = async () => {
  const res = await GET(new Request("https://windowmuse.com/api/health"));
  return { status: res.status, body: await res.json() };
};

describe("/api/health semantics", () => {
  beforeEach(() => Object.assign(state, { unresolved: 2, dbFails: false, missing: [] }));

  it("answers 200 with unresolved errors open, and still reports their count", async () => {
    const { status, body } = await call();
    expect(status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.errors).toEqual({ unresolvedSevere: 2 });
    expect(body.db.ok).toBe(true);
  });

  it("answers 503 when the database is unreachable", async () => {
    state.dbFails = true;
    const { status, body } = await call();
    expect(status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.db.ok).toBe(false);
    expect(body.db.error).toBeUndefined();
  });

  it("answers 503 when a required variable is missing, without naming it publicly", async () => {
    state.missing = ["STRIPE_SECRET_KEY"];
    const { status, body } = await call();
    expect(status).toBe(503);
    expect(body.config.missingCount).toBe(1);
    expect(body.config.missing).toBeUndefined();
  });
});
