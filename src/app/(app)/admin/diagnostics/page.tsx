import { requireAdmin } from "@/lib/admin";
import { env, features, missingEnv, REQUIRED_ENV, VERCEL_ENV } from "@/lib/env";
import { stripeContext, stripeMode } from "@/lib/stripe";
import { SITE } from "@/lib/site";
import { allAppState, APP_STATE_KEYS, appStateEntry } from "../_data";
import { AdminTitle, KeyValue, Tag, ago, fmtDate } from "../_ui";
import { DiagnosticsButtons } from "./DiagnosticsButtons";

export const dynamic = "force-dynamic";

/** Optional variables worth seeing at a glance; names only, never values. */
const OPTIONAL_ENV = [
  "VIDEO_PROVIDER",
  "REPLICATE_API_TOKEN",
  "ANTHROPIC_API_KEY",
  "STRIPE_CONTEXT",
  "NEXT_PUBLIC_SITE_URL",
  "SITE_INDEXABLE",
  "ALLOW_LIVE_CHECKOUT_NONPROD",
  "DATABASE_URL_UNPOOLED",
  "VERCEL_GIT_COMMIT_SHA",
] as const;

interface CronReport {
  ranAt?: string;
  tookMs?: number;
  polled?: number;
  dispatched?: number;
  completed?: number;
  failed?: number | unknown[];
  expired?: number;
  repaired?: unknown[];
  checked?: number;
  error?: string;
}

function asReport(v: unknown): CronReport | null {
  return v && typeof v === "object" ? (v as CronReport) : null;
}

function countOf(v: number | unknown[] | undefined): string {
  if (Array.isArray(v)) return String(v.length);
  return typeof v === "number" ? String(v) : "—";
}

function Presence({ name }: { name: string }) {
  const present = Boolean(env(name));
  return (
    <li className="flex items-center justify-between gap-3 py-1.5">
      <code className="break-all font-mono text-[0.82rem] text-ink-2">{name}</code>
      <Tag tone={present ? "ok" : "neutral"}>{present ? "set" : "unset"}</Tag>
    </li>
  );
}

export default async function DiagnosticsPage() {
  await requireAdmin();
  const [reconcile, cronJobs, cronReconcile, allState] = await Promise.all([
    appStateEntry(APP_STATE_KEYS.reconcile),
    appStateEntry(APP_STATE_KEYS.cronJobs),
    appStateEntry(APP_STATE_KEYS.cronReconcile),
    allAppState(),
  ]);
  const f = features();
  const missing = missingEnv();
  const mode = stripeMode();
  const requestedProvider = env("VIDEO_PROVIDER") ?? "unset";
  const flowglance = Boolean(env("NEXT_PUBLIC_FLOWGLANCE_KEY"));
  const filesReady = Boolean(env("FILES_BASE_URL") && env("FILES_API_TOKEN") && env("FILES_SIGNING_SECRET"));
  const rec = asReport(reconcile?.value);
  const jobsRun = asReport(cronJobs?.value);
  const recRun = asReport(cronReconcile?.value);
  const known = new Set<string>(Object.values(APP_STATE_KEYS));
  const otherState = allState.filter((s) => !known.has(s.key));

  return (
    <div className="space-y-8">
      <AdminTitle
        title="Diagnostics"
        lede="Prove the plumbing end to end. Drills are deliberate: each one names itself “Diagnostics:” so it can be resolved in one click afterwards."
      />

      <section className="space-y-3">
        <p className="eyebrow">Drills</p>
        <DiagnosticsButtons mockEnabled={filesReady} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="pane p-5 sm:p-6">
          <p className="eyebrow">Features</p>
          <div className="mt-2">
            <KeyValue
              rows={[
                { label: "Deployment", value: <Tag>{VERCEL_ENV}</Tag> },
                { label: "Site URL", value: <code className="font-mono text-[0.82rem]">{SITE.url}</code> },
                {
                  label: "Video engine",
                  value: (
                    <>
                      <Tag tone={f.videoEngine === "replicate" ? "ok" : f.videoEngine === "mock" ? "muse" : "bad"}>{f.videoEngine}</Tag>
                      <span className="ml-2 text-[0.82rem] text-ink-4">requested: {requestedProvider}</span>
                    </>
                  ),
                },
                { label: "Script writer", value: <Tag tone={f.aiWriter ? "ok" : "neutral"}>{f.aiWriter ? "Claude (ANTHROPIC_API_KEY set)" : "template writer"}</Tag> },
                {
                  label: "Stripe",
                  value: (
                    <>
                      <Tag tone={mode === "live" ? "ok" : mode === "test" ? "muse" : "bad"}>{mode}</Tag>
                      <span className="ml-2 text-[0.82rem] text-ink-4">{stripeContext() ? "Stripe-Context set" : "no Stripe-Context"}</span>
                    </>
                  ),
                },
                { label: "Files worker", value: <Tag tone={filesReady ? "ok" : "bad"}>{filesReady ? "configured" : "missing variables"}</Tag> },
                { label: "FlowGlance", value: <Tag tone={flowglance ? "ok" : "neutral"}>{flowglance ? "key set" : "no key: analytics off"}</Tag> },
                {
                  label: "Required env",
                  value: missing.length ? <span className="break-words text-bad">missing: {missing.join(", ")}</span> : <Tag tone="ok">all {REQUIRED_ENV.length} present</Tag>,
                },
              ]}
            />
          </div>
        </section>

        <section className="pane p-5 sm:p-6">
          <p className="eyebrow">Scheduled work</p>
          <div className="mt-2">
            <KeyValue
              rows={[
                {
                  label: "Jobs cron (every minute)",
                  value: jobsRun?.ranAt ? (
                    <span>
                      {ago(jobsRun.ranAt)} · polled {countOf(jobsRun.polled)} · dispatched {countOf(jobsRun.dispatched)} · completed {countOf(jobsRun.completed)} · failed{" "}
                      {countOf(jobsRun.failed)} · expired {countOf(jobsRun.expired)}
                    </span>
                  ) : cronJobs ? (
                    <span>{ago(cronJobs.updatedAt)} (unstructured report)</span>
                  ) : (
                    <span className="text-ink-4">never ran, or the cron does not write {APP_STATE_KEYS.cronJobs}</span>
                  ),
                },
                {
                  label: "Reconcile (daily)",
                  value: rec?.ranAt ? (
                    <span>
                      {ago(rec.ranAt)} · checked {countOf(rec.checked)} · repaired {countOf(rec.repaired)} · failed {countOf(rec.failed)}
                      {rec.error ? <span className="text-bad"> · {rec.error}</span> : null}
                    </span>
                  ) : recRun?.ranAt ? (
                    <span>
                      {ago(recRun.ranAt)} · repaired {countOf(recRun.repaired)} · failed {countOf(recRun.failed)}
                    </span>
                  ) : reconcile ? (
                    <span>{ago(reconcile.updatedAt)} (unstructured report)</span>
                  ) : (
                    <span className="text-ink-4">never ran, or the cron does not write {APP_STATE_KEYS.reconcile}</span>
                  ),
                },
                { label: "Health endpoint", value: <a href="/api/health" className="text-accent-text underline underline-offset-2" target="_blank" rel="noreferrer">/api/health</a> },
              ]}
            />
          </div>
          {rec ? (
            <details className="mt-3">
              <summary className="cursor-pointer text-[0.82rem] text-ink-3">Last reconcile report (raw)</summary>
              <pre className="mt-2 max-h-72 overflow-auto rounded-xl bg-pane-2 p-3 text-[0.75rem] text-ink-3">{JSON.stringify(rec, null, 2)}</pre>
            </details>
          ) : null}
        </section>

        <section className="pane p-5 sm:p-6">
          <p className="eyebrow">Required variables</p>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {REQUIRED_ENV.map((n) => (
              <Presence key={n} name={n} />
            ))}
          </ul>
        </section>

        <section className="pane p-5 sm:p-6">
          <p className="eyebrow">Optional variables</p>
          <ul className="mt-2 divide-y divide-[var(--line)]">
            {OPTIONAL_ENV.map((n) => (
              <Presence key={n} name={n} />
            ))}
          </ul>
          {otherState.length > 0 ? (
            <>
              <p className="eyebrow mt-6">Other app_state keys</p>
              <ul className="mt-2 divide-y divide-[var(--line)] text-[0.85rem]">
                {otherState.map((s) => (
                  <li key={s.key} className="py-2">
                    <div className="flex items-center justify-between gap-3">
                      <code className="break-all font-mono text-[0.8rem] text-ink-2">{s.key}</code>
                      <span className="shrink-0 text-ink-4" title={fmtDate(s.updatedAt)}>
                        {ago(s.updatedAt)}
                      </span>
                    </div>
                    <pre className="mt-1 max-h-32 overflow-auto rounded-xl bg-pane-2 p-2 text-[0.72rem] text-ink-3">{JSON.stringify(s.value, null, 1)}</pre>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>
      </div>
    </div>
  );
}
