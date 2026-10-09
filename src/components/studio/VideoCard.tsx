import Link from "next/link";
import { PresenterAvatar } from "@/components/PresenterAvatar";
import { presenterById } from "@/content/presenters";
import { STATUS_LABEL, type JobJson } from "@/lib/job-json";
import { StatusChip } from "./StatusChip";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
}

/**
 * One job in the library grid: the presenter's portrait on their colour with the state on
 * top. No player here on purpose: a grid of fifty cards would open fifty signed streams at
 * once (and go dark when the links expire); the video loads on the job page.
 */
export function VideoCard({ job, productName }: { job: JobJson; productName: string | null }) {
  const presenter = presenterById(job.presenterId);
  const live = job.status === "queued" || job.status === "running" || job.status === "draft";
  return (
    <Link href={`/studio/videos/${job.id}`} prefetch={false} className="pane pane-hover block min-w-0 overflow-hidden p-2" aria-label={`${productName ?? "Video"}, ${STATUS_LABEL[job.status]}`}>
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-[20px] bg-pane-2">
        <div className="grid h-full w-full place-items-center" style={presenter ? { background: presenter.palette.bg } : undefined}>
          {presenter ? <PresenterAvatar presenter={presenter} size={96} decorative className="opacity-90" /> : null}
          {live ? <div className="skeleton absolute inset-x-3 bottom-3 h-2 rounded-full" aria-hidden="true" /> : null}
          {job.status === "succeeded" ? (
            <span className="absolute inset-x-3 bottom-3 rounded-full bg-black/45 px-3 py-1.5 text-center text-[0.78rem] font-semibold text-white backdrop-blur-sm">Open to play</span>
          ) : null}
        </div>
        <div className="absolute left-2 top-2">
          <StatusChip status={job.status} />
        </div>
      </div>
      <div className="px-2 pb-1 pt-2.5">
        <p className="truncate text-[0.95rem] font-semibold text-ink">{productName ?? "Product"}</p>
        <p className="mt-0.5 truncate text-[0.8rem] text-ink-4">
          {presenter?.name ?? "Presenter"} · {job.durationSec} s · {job.resolution} · {formatDate(job.createdAt)}
        </p>
      </div>
    </Link>
  );
}
