import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JobWatcher } from "@/components/studio/JobWatcher";
import { presenterById } from "@/content/presenters";
import { toJobJson } from "@/lib/job-json";
import { getProduct } from "@/lib/products";
import { requireUser } from "@/lib/user";
import { getJob } from "@/lib/video/jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Video" };

export default async function JobPage(props: PageProps<"/studio/videos/[jobId]">) {
  const { jobId } = await props.params;
  const { userId } = await requireUser();
  const job = await getJob(userId, jobId);
  if (!job) notFound();
  const [product, presenter] = [await getProduct(userId, job.productId), presenterById(job.presenterId)];
  const productName = product?.name ?? "Your product";
  const presenterName = presenter?.name ?? "the presenter";

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-[0.85rem] text-ink-4">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/studio/videos" prefetch={false} className="hover:text-ink-2">
              Videos
            </Link>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-ink-3">
            {productName}
          </li>
        </ol>
      </nav>
      <div>
        <p className="eyebrow eyebrow-accent">{job.status === "succeeded" ? "Ready to post" : "Video"}</p>
        <h1 className="display mt-2 text-[2rem] text-ink sm:text-[2.6rem]">{productName}</h1>
        <p className="mt-2 text-[0.95rem] text-ink-3">
          Presented by {presenterName} · {job.durationSec} s · {job.resolution}
        </p>
      </div>
      <JobWatcher initial={toJobJson(job)} presenterName={presenterName} productName={productName} />
    </div>
  );
}
