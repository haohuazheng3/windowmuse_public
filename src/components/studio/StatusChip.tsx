import { STATUS_LABEL, type JobStatus } from "@/lib/job-json";

const TONE: Record<JobStatus, string> = {
  draft: "tag-muse",
  awaiting_engine: "tag-accent",
  queued: "tag-muse",
  running: "tag-muse",
  succeeded: "tag-ok",
  failed: "tag-bad",
  expired: "tag-bad",
  cancelled: "",
};

/** The job's state as a small pill; live states carry a pulsing dot. */
export function StatusChip({ status, className = "" }: { status: JobStatus; className?: string }) {
  const live = status === "queued" || status === "running" || status === "draft";
  return (
    <span className={`tag ${TONE[status]} ${className}`}>
      {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" aria-hidden="true" /> : null}
      {STATUS_LABEL[status]}
    </span>
  );
}
