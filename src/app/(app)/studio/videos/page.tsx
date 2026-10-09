import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { VideoCard } from "@/components/studio/VideoCard";
import { toJobJson } from "@/lib/job-json";
import { listProducts } from "@/lib/products";
import { requireUser } from "@/lib/user";
import { listJobs } from "@/lib/video/jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Videos" };

export default async function VideosPage() {
  const { userId } = await requireUser();
  const [jobs, products] = await Promise.all([listJobs(userId), listProducts(userId)]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const items = jobs.map(toJobJson);
  const live = items.filter((j) => j.status === "queued" || j.status === "running" || j.status === "awaiting_engine" || j.status === "draft").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow eyebrow-accent">Videos</p>
          <h1 className="display mt-2 text-[2.2rem] text-ink sm:text-[2.8rem]">Your library</h1>
          <p className="mt-2 text-[0.95rem] text-ink-3">
            {items.length === 0 ? "Every generation, finished or in progress, lands here." : `${items.length} ${items.length === 1 ? "video" : "videos"}${live ? ` · ${live} generating` : ""}`}
          </p>
        </div>
        <Link href="/studio/new" prefetch={false} className="btn btn-primary">
          New video
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Nothing here yet"
          body="Finished videos appear as playable cards; ones still generating show their stage and switch to the player on their own."
          action={
            <Link href="/studio/new" prefetch={false} className="btn btn-primary">
              Make the first one
            </Link>
          }
        />
      ) : (
        <div className="pane-grid">
          {items.map((j) => (
            <VideoCard key={j.id} job={j} productName={names.get(j.productId) ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
