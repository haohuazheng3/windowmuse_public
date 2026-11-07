import { describe, expect, it } from "vitest";
import { afterSendFailure, alertEmail, decide, HEALTHY, parseState, REMINDER_EVERY_MS, type HealthState } from "../infra/workers/mail/src/alerting";

const MIN = 60_000;
const PROBE = 30 * MIN;

/** Run a sequence of probe results through the state machine, collecting the emails it would send. */
function simulate(results: boolean[], start: HealthState = HEALTHY, t0 = 1_000_000_000_000) {
  let state = start;
  const emails: { at: number; action: string }[] = [];
  results.forEach((ok, i) => {
    const now = t0 + i * PROBE;
    const { action, next } = decide(state, ok, now);
    if (action !== "none") emails.push({ at: i, action });
    state = next;
  });
  return { state, emails };
}

describe("health alert state machine (mail worker cron)", () => {
  it("stays silent while healthy", () => {
    expect(simulate(Array(100).fill(true)).emails).toEqual([]);
  });

  it("ignores a single failed probe", () => {
    expect(simulate([true, false, true, true, false, true]).emails).toEqual([]);
  });

  it("emails DOWN after 2 consecutive failures, then nothing until recovery", () => {
    const { emails } = simulate([true, false, false, false, false, false, false, true, true]);
    expect(emails).toEqual([
      { at: 2, action: "down" },
      { at: 7, action: "recovered" },
    ]);
  });

  it("sends at most one reminder per 24 h during a long outage", () => {
    const probesPerDay = REMINDER_EVERY_MS / PROBE; // 48
    const results = [...Array(Math.round(probesPerDay * 3)).fill(false), true];
    const { emails } = simulate(results);
    expect(emails.map((e) => e.action)).toEqual(["down", "reminder", "reminder", "recovered"]);
    expect(emails[1].at - emails[0].at).toBe(probesPerDay);
  });

  it("an unreadable or legacy stored state counts as healthy", () => {
    expect(parseState(null)).toEqual(HEALTHY);
    expect(parseState("garbage")).toEqual(HEALTHY);
    expect(parseState({ failing: true, lastAlertAt: 5, since: 9 })).toEqual({ ...HEALTHY, since: 9 });
  });

  it("retries the same email on the next probe when sending failed", () => {
    const now = 2_000_000_000_000;
    const one = decide(HEALTHY, false, now).next;
    const two = decide(one, false, now + PROBE);
    expect(two.action).toBe("down");
    const kept = afterSendFailure("down", one, two.next);
    expect(decide(kept, false, now + 2 * PROBE).action).toBe("down");

    const down: HealthState = { down: true, failures: 5, since: now, lastEmailAt: now };
    const rec = decide(down, true, now + 10 * PROBE);
    expect(rec.action).toBe("recovered");
    expect(decide(afterSendFailure("recovered", down, rec.next), true, now + 11 * PROBE).action).toBe("recovered");
  });

  it("writes emails that say what failed and where to look", () => {
    const now = 2_000_000_000_000;
    const state: HealthState = { down: true, failures: 2, since: now - PROBE, lastEmailAt: now };
    const links = { health: "https://windowmuse.com/api/health", errors: "https://windowmuse.com/admin/errors" };
    const down = alertEmail("down", "windowmuse.com", state, now, "HTTP 503\n{}", links);
    expect(down.subject).toContain("windowmuse.com");
    expect(down.text).toContain("2 probes in a row");
    expect(down.text).toContain(links.errors);
    expect(alertEmail("recovered", "windowmuse.com", state, now, "HTTP 200", links).subject).toMatch(/^Recovered/);
  });
});
