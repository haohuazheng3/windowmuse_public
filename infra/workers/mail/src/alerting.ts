/**
 * Health alert state machine for the mail worker's cron probe. Pure (no Workers APIs), so the
 * app's vitest suite covers it (tests/health-alert.test.ts).
 *
 * - DOWN email only after FAILURES_BEFORE_ALERT consecutive failed probes (one blip is silent).
 * - While still down: silence, except one reminder per REMINDER_EVERY_MS.
 * - One RECOVERED email when a probe passes after a DOWN email; a streak that never alerted
 *   recovers silently.
 * - If sending fails, the state is kept so the next probe tries the same email again.
 */

export interface HealthState {
  /** A DOWN email went out for the current incident. */
  down: boolean;
  /** Consecutive failed probes. */
  failures: number;
  /** First failed probe of the current streak (ms epoch), 0 while healthy. */
  since: number;
  /** Last DOWN or reminder email (ms epoch), 0 when none. */
  lastEmailAt: number;
}

export type AlertAction = "none" | "down" | "reminder" | "recovered";

export const FAILURES_BEFORE_ALERT = 2;
export const REMINDER_EVERY_MS = 24 * 60 * 60 * 1000;
export const HEALTHY: HealthState = { down: false, failures: 0, since: 0, lastEmailAt: 0 };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);

/** Tolerant read of whatever the store holds (missing, corrupt or an older shape → healthy). */
export function parseState(raw: unknown): HealthState {
  if (!raw || typeof raw !== "object") return { ...HEALTHY };
  const o = raw as Record<string, unknown>;
  return { down: o.down === true, failures: num(o.failures), since: num(o.since), lastEmailAt: num(o.lastEmailAt) };
}

export function decide(prev: HealthState, ok: boolean, now: number): { action: AlertAction; next: HealthState } {
  if (ok) return { action: prev.down ? "recovered" : "none", next: { ...HEALTHY } };
  const failures = prev.failures + 1;
  const since = prev.failures > 0 && prev.since ? prev.since : now;
  if (!prev.down) {
    if (failures >= FAILURES_BEFORE_ALERT) return { action: "down", next: { down: true, failures, since, lastEmailAt: now } };
    return { action: "none", next: { down: false, failures, since, lastEmailAt: 0 } };
  }
  if (now - prev.lastEmailAt >= REMINDER_EVERY_MS) return { action: "reminder", next: { down: true, failures, since, lastEmailAt: now } };
  return { action: "none", next: { ...prev, failures, since } };
}

/** The state to store when the email for `action` could not be sent: retry it on the next probe. */
export function afterSendFailure(action: AlertAction, prev: HealthState, next: HealthState): HealthState {
  if (action === "down") return { ...next, down: false, lastEmailAt: 0 };
  if (action === "reminder") return { ...next, lastEmailAt: prev.lastEmailAt };
  if (action === "recovered") return { ...prev };
  return next;
}

export function sameState(a: HealthState, b: HealthState): boolean {
  return a.down === b.down && a.failures === b.failures && a.since === b.since && a.lastEmailAt === b.lastEmailAt;
}

function duration(ms: number): string {
  const min = Math.max(0, Math.round(ms / 60000));
  if (min < 90) return `${min} min`;
  const h = Math.round(min / 6) / 10;
  return `${h} h`;
}

/** Subject and body for an alert email. `detail` is the last probe's HTTP status and body excerpt. */
export function alertEmail(action: Exclude<AlertAction, "none">, host: string, state: HealthState, now: number, detail: string, links: { health: string; errors: string }): { subject: string; text: string } {
  const since = state.since ? new Date(state.since).toISOString() : "unknown";
  if (action === "recovered") {
    return {
      subject: `Recovered: ${host} health check passing`,
      text: `${links.health} answers 200 again after ${duration(now - state.since)} (failing since ${since}).\n\n${detail}`,
    };
  }
  const lead =
    action === "down"
      ? `${links.health} failed ${state.failures} probes in a row (unreachable, timed out or non-200), failing since ${since}.`
      : `${links.health} is still failing: down for ${duration(now - state.since)} (since ${since}, ${state.failures} failed probes). Next reminder in 24 h unless it recovers.`;
  return {
    subject: action === "down" ? `ALERT: ${host} is down (health check failing)` : `Still down: ${host} health check failing for ${duration(now - state.since)}`,
    text: `${lead}\n\nHealth means the database answers and required configuration is present; open errors alone never fail it (they come in the daily digest).\n\nLast probe:\n${detail}\n\nError inbox: ${links.errors}\nYou will get one email when it recovers.`,
  };
}
