"use client";

import Link from "next/link";
import { useState } from "react";

/*
 * Drill buttons. Each one calls POST /api/admin/diagnostics?action=… (admin-only: the proxy
 * 404s everyone else and the route re-checks). Buttons flip to their busy state on press and
 * append a line to the log when the server answers.
 */

type Action = "throw" | "resolve-drills" | "mock-job" | "client-error-instructions";

interface LogLine {
  at: string;
  tone: "ok" | "bad" | "neutral";
  text: string;
  href?: string;
  hrefLabel?: string;
}

interface DiagnosticsResponse {
  ok?: boolean;
  error?: string;
  resolved?: number;
  job?: { id: string; status: string; provider: string };
  steps?: string[];
}

function now(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false });
}

export function DiagnosticsButtons({ mockEnabled }: { mockEnabled: boolean }) {
  const [busy, setBusy] = useState<Action | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);

  const push = (line: Omit<LogLine, "at">) => setLog((l) => [{ at: now(), ...line }, ...l].slice(0, 12));

  async function call(action: Action): Promise<DiagnosticsResponse & { status: number }> {
    const res = await fetch(`/api/admin/diagnostics?action=${action}`, { method: "POST", headers: { Accept: "application/json" }, cache: "no-store" });
    let body: DiagnosticsResponse = {};
    try {
      body = (await res.json()) as DiagnosticsResponse;
    } catch {
      body = { error: `HTTP ${res.status} with no JSON body` };
    }
    return { ...body, status: res.status };
  }

  async function run(action: Action) {
    if (busy) return;
    setBusy(action);
    try {
      const r = await call(action);
      if (action === "throw") {
        push(
          r.status === 500
            ? { tone: "ok", text: "Server threw and the route answered 500: the error is in the inbox and /api/health is red until you resolve it.", href: "/admin/errors", hrefLabel: "Open error inbox" }
            : { tone: "bad", text: `Expected a 500, got ${r.status}${r.error ? `: ${r.error}` : ""}.` },
        );
      } else if (action === "resolve-drills") {
        push(r.ok ? { tone: "ok", text: `Resolved ${r.resolved ?? 0} drill error${r.resolved === 1 ? "" : "s"}. /api/health is green again if nothing else is open.` } : { tone: "bad", text: r.error ?? `Failed with ${r.status}.` });
      } else if (action === "mock-job") {
        push(
          r.ok && r.job
            ? { tone: "ok", text: `Mock job ${r.job.id} created (${r.job.status}). It completes about 20 seconds after dispatch; watch the stage change.`, href: `/studio/videos/${r.job.id}`, hrefLabel: "Open the job page" }
            : { tone: "bad", text: r.error ?? `Failed with ${r.status}.` },
        );
      } else if (action === "client-error-instructions") {
        push(r.ok && r.steps ? { tone: "neutral", text: r.steps.join(" ") } : { tone: "bad", text: r.error ?? `Failed with ${r.status}.` });
      }
    } catch (err) {
      push({ tone: "bad", text: `Request failed: ${err instanceof Error ? err.message : String(err)}` });
    } finally {
      setBusy(null);
    }
  }

  function throwClientError() {
    push({ tone: "ok", text: "Client error thrown. instrumentation-client reports it to /api/errors; it shows up in the inbox as a client error within a few seconds.", href: "/admin/errors", hrefLabel: "Open error inbox" });
    window.setTimeout(() => {
      throw new Error(`Diagnostics: deliberate client error at ${new Date().toISOString()}`);
    }, 0);
    // The server-side checklist for this drill, so the log says what to look for.
    void run("client-error-instructions");
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Drill
          title="Throw a server error"
          body="A route handler throws. Expect: error inbox entry (source server), /api/health 503, one alert email."
          button="Throw a server error"
          busy={busy === "throw"}
          busyLabel="Throwing…"
          disabled={busy !== null}
          onClick={() => run("throw")}
          primary
        />
        <Drill
          title="Throw a client error"
          body="This tab throws an uncaught error. Expect: an inbox entry with source client and this page's route."
          button="Throw a client error"
          busy={false}
          busyLabel=""
          disabled={busy !== null}
          onClick={throwClientError}
        />
        <Drill
          title="Run a mock video job"
          body={
            mockEnabled
              ? "Creates a real job for your account pinned to the mock engine, whatever VIDEO_PROVIDER says (zero cost to us; 1 credit reserved and charged like any job). Exercises credits, the job runner, the files worker and the player."
              : "Needs the files worker (FILES_BASE_URL, FILES_API_TOKEN, FILES_SIGNING_SECRET): the drill uploads a photo and saves the sample clip through it."
          }
          button="Create mock job"
          busy={busy === "mock-job"}
          busyLabel="Creating…"
          disabled={busy !== null || !mockEnabled}
          onClick={() => run("mock-job")}
        />
        <Drill
          title="Resolve drill errors"
          body="Marks every open error whose message starts with “Diagnostics:” resolved, so /api/health turns green again."
          button="Resolve drills"
          busy={busy === "resolve-drills"}
          busyLabel="Resolving…"
          disabled={busy !== null}
          onClick={() => run("resolve-drills")}
        />
      </div>

      <div className="pane-inset px-4 py-3">
        <p className="eyebrow">Drill log</p>
        {log.length === 0 ? (
          <p className="mt-2 text-[0.88rem] text-ink-4">Nothing run yet in this tab.</p>
        ) : (
          <ul className="mt-2 space-y-1.5 text-[0.88rem]" aria-live="polite">
            {log.map((l, i) => (
              <li key={`${l.at}-${i}`} className={l.tone === "ok" ? "text-ok" : l.tone === "bad" ? "text-bad" : "text-ink-2"}>
                <span className="font-mono text-[0.78rem] text-ink-4">{l.at}</span> {l.text}
                {l.href ? (
                  <>
                    {" "}
                    <Link href={l.href} className="underline underline-offset-2">
                      {l.hrefLabel ?? l.href}
                    </Link>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Drill({
  title,
  body,
  button,
  busy,
  busyLabel,
  disabled,
  onClick,
  primary = false,
}: {
  title: string;
  body: string;
  button: string;
  busy: boolean;
  busyLabel: string;
  disabled: boolean;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <div className="pane flex flex-col justify-between gap-4 p-5">
      <div>
        <p className="font-semibold text-ink">{title}</p>
        <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-3">{body}</p>
      </div>
      <button type="button" className={`btn btn-sm w-full sm:w-auto ${primary ? "btn-primary" : "btn-ghost"}`} disabled={disabled} aria-busy={busy} onClick={onClick}>
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {busyLabel}
          </>
        ) : (
          button
        )}
      </button>
    </div>
  );
}
