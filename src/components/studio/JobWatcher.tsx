"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { track } from "@/components/Consent";
import { CREDIT_RULES } from "@/content/plans";
import { shortRef } from "@/lib/refs";
import { formatBytes } from "@/lib/upload-rules";
import { isLive, stageLabel, type JobJson } from "@/lib/job-json";
import { PostItRight } from "./PostItRight";
import { StatusChip } from "./StatusChip";

/*
 * The job page's live half. Polls GET /api/jobs/[id] every 5 s while the job is in flight,
 * shows the stage as a three-step rail, then flips to the player the moment the video is
 * saved. Signed URLs are short-lived: if the player fails, the job is refetched for a
 * fresh link. Fires `unlock` once, on the first view of a finished video.
 */

const POLL_MS = 5000;
const RAIL = [
  { key: "queued", label: "Queued" },
  { key: "generating", label: "Generating" },
  { key: "saving", label: "Saving" },
] as const;

function railIndex(job: JobJson): number {
  const s = job.stage.toLowerCase();
  if (s.includes("sav") || s.includes("upload")) return 2;
  if (s.includes("generat") || s.includes("render") || job.status === "running") return 1;
  return 0;
}

function elapsedText(fromIso: string, now: number): string {
  const s = Math.max(0, Math.floor((now - new Date(fromIso).getTime()) / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${s % 60} s`;
}

export function JobWatcher({ initial, presenterName, productName }: { initial: JobJson; presenterName: string; productName: string }) {
  const [job, setJob] = useState<JobJson>(initial);
  const [failures, setFailures] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const unlocked = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs/${initial.id}`, { cache: "no-store", headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`/api/jobs/${initial.id} answered ${res.status}`);
      const body = (await res.json()) as { job: JobJson };
      setJob(body.job);
      setFailures(0);
    } catch (e) {
      console.warn("[job] poll failed", e);
      setFailures((n) => n + 1);
    }
  }, [initial.id]);

  // Poll while the job is alive; skip ticks while the tab is hidden and catch up on return.
  useEffect(() => {
    if (!isLive(job.status)) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [job.status, refresh]);

  // A clock for the elapsed-time line.
  useEffect(() => {
    if (!isLive(job.status)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [job.status]);

  // `unlock`: once per finished video, on its first view.
  useEffect(() => {
    if (job.status !== "succeeded" || !job.video || unlocked.current) return;
    unlocked.current = true;
    const key = `wm_unlocked_${job.id}`;
    try {
      if (localStorage.getItem(key)) return;
      localStorage.setItem(key, "1");
    } catch {
      /* fire anyway */
    }
    track("unlock", { jobId: job.id, resolution: job.resolution, durationSec: job.durationSec, credits: job.credits });
  }, [job]);

  const credits = CREDIT_RULES.credits(job.credits);
  const makeAnother = `/studio/new?product=${encodeURIComponent(job.productId)}`;
  /** What support asks for: the short reference of this job (the contact page prefills it). */
  const ref = shortRef(job.id);
  const contactHref = `/contact?topic=video&ref=${encodeURIComponent(ref)}`;

  if (job.status === "succeeded" && job.video) {
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start">
        <div className="pane p-3 sm:p-4">
          <div className="mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[20px] bg-ink-pane">
            <video
              key={job.video.url}
              controls
              playsInline
              preload="metadata"
              src={job.video.url}
              className="h-full w-full object-contain"
              onError={() => void refresh()}
            />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <a href={job.video.downloadUrl} download className="btn btn-primary btn-block">
              Download MP4
              <span className="text-[0.85em] opacity-80">{formatBytes(job.video.bytes)}</span>
            </a>
            <Link href={makeAnother} prefetch={false} className="btn btn-ghost btn-block">
              Make another
            </Link>
          </div>
          <p className="mt-3 text-center text-[0.82rem] text-ink-4">
            {job.resolution} · {job.video.durationSec || job.durationSec} s · {presenterName} · {credits} charged · ref {ref}
          </p>
        </div>
        <div className="min-w-0 space-y-5">
          <PostItRight jobId={job.id} />
          <div className="pane-inset px-5 py-4 text-[0.9rem] leading-relaxed text-ink-3">
            <span className="font-semibold text-ink">{productName}</span> is shown exactly as photographed; the presenter is a fictional host. Download links are signed and expire,
            so come back to this page for a fresh one rather than sharing the link itself.
          </div>
        </div>
      </div>
    );
  }

  if (job.status === "failed" || job.status === "expired" || job.status === "cancelled") {
    const reason =
      job.error ??
      (job.status === "expired"
        ? "The engine didn't return a video within two hours, so the job was closed."
        : job.status === "cancelled"
          ? "The job was cancelled."
          : "The engine didn't return a usable video.");
    return (
      <div className="pane p-6 sm:p-8">
        <StatusChip status={job.status} />
        <h2 className="headline mt-4 text-[1.5rem] text-ink">This one didn&rsquo;t render</h2>
        <p className="mt-2 max-w-xl text-[0.98rem] leading-relaxed text-ink-3">{reason}</p>
        <p className="mt-3 rounded-2xl bg-ok-soft px-4 py-3 text-[0.92rem] text-ok">
          The {credits} reserved for this video were released back to your balance. Failed generations never cost credits.
        </p>
        <p className="mt-3 text-[0.85rem] text-ink-4">
          Reference for support: <span className="font-semibold tabular-nums text-ink-2">{ref}</span>
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link href={makeAnother} prefetch={false} className="btn btn-primary">
            Try again with the same product
          </Link>
          <Link href={contactHref} className="btn btn-ghost">
            Tell us what happened
          </Link>
        </div>
      </div>
    );
  }

  const awaiting = job.status === "awaiting_engine";
  const idx = railIndex(job);
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr] lg:items-start">
      <div className="pane p-3 sm:p-4">
        <div className="relative mx-auto aspect-[9/16] w-full max-w-[360px] overflow-hidden rounded-[20px]">
          <div className="skeleton absolute inset-0 !rounded-[20px]" aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="rounded-2xl bg-pane/90 px-4 py-3 backdrop-blur">
              <p className="text-[0.92rem] font-semibold text-ink">{awaiting ? "Waiting for the video engine" : stageLabel(job.stage)}</p>
              <p className="mt-0.5 text-[0.8rem] text-ink-4">{awaiting ? "Job saved, credits reserved" : `Elapsed ${elapsedText(job.createdAt, now)}`}</p>
            </div>
          </div>
        </div>
        <p className="mt-3 text-center text-[0.82rem] text-ink-4">
          {job.resolution} · {job.durationSec} s · {presenterName} · {credits} reserved · ref {ref}
        </p>
      </div>

      <div className="min-w-0 space-y-5">
        <div className="pane p-5 sm:p-6" aria-live="polite">
          <StatusChip status={job.status} />
          {awaiting ? (
            <>
              <h2 className="headline mt-4 text-[1.4rem] text-ink">The video engine is being connected</h2>
              <p className="mt-2 text-[0.96rem] leading-relaxed text-ink-3">
                Your job is saved with everything it needs: the photos, {presenterName}, the approved script. It sits first in line and starts the moment the
                engine is live. The {credits} for it stay reserved, not charged; if the job is ever closed without a video, they come straight back.
              </p>
              <p className="mt-3 text-[0.9rem] text-ink-4">You can close this page. The video will be in your library when it is done.</p>
            </>
          ) : (
            <>
              <h2 className="headline mt-4 text-[1.4rem] text-ink">{productName}, presented by {presenterName}</h2>
              <ol className="mt-5 grid grid-cols-3 gap-2">
                {RAIL.map((r, i) => (
                  <li key={r.key} className="min-w-0">
                    <div className={`h-1.5 rounded-full ${i < idx ? "bg-ok" : i === idx ? "animate-pulse bg-accent" : "bg-pane-3"}`} aria-hidden="true" />
                    <p className={`mt-2 truncate text-[0.82rem] ${i === idx ? "font-semibold text-ink" : "text-ink-4"}`}>{r.label}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-5 text-[0.92rem] leading-relaxed text-ink-3">
                Most videos take a few minutes. This page checks every 5 seconds and switches to the player on its own; the finished file also lands in your
                library, so it is safe to leave.
              </p>
            </>
          )}
          {failures >= 2 ? <p className="mt-3 text-[0.85rem] text-accent-text">Reconnecting&hellip; the last {failures} checks didn&rsquo;t reach the server.</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href="/studio/videos" prefetch={false} className="btn btn-ghost">
            Go to my videos
          </Link>
          <Link href={makeAnother} prefetch={false} className="btn btn-quiet">
            Start another with this product
          </Link>
        </div>
      </div>
    </div>
  );
}
