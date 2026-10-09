import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, StatPane } from "@/components/ui";
import { VideoCard } from "@/components/studio/VideoCard";
import { planLabel } from "@/components/studio/me-store";
import { PLANS, TRIAL, isPlanSku } from "@/content/plans";
import { getBalance } from "@/lib/credits";
import { toJobJson } from "@/lib/job-json";
import { listProducts } from "@/lib/products";
import { currentPlan, requireUser } from "@/lib/user";
import { listJobs } from "@/lib/video/jobs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Studio" };

const STEPS = ["Describe the product", "Add 1–8 photos", "Pick a presenter", "Approve the script", "Generate"];

function shortDate(d: Date | null): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function StudioHome() {
  const { userId } = await requireUser();
  const [balance, plan, jobs, products] = await Promise.all([getBalance(userId), currentPlan(userId), listJobs(userId), listProducts(userId)]);
  const names = new Map(products.map((p) => [p.id, p.name]));
  const recent = jobs.slice(0, 6).map(toJobJson);
  const finished = jobs.filter((j) => j.status === "succeeded").length;
  const inFlight = jobs.filter((j) => j.status === "queued" || j.status === "running" || j.status === "awaiting_engine" || j.status === "draft").length;
  const soonest = balance.lots.filter((l) => l.expiresAt && l.remaining > 0).sort((a, b) => (a.expiresAt?.getTime() ?? 0) - (b.expiresAt?.getTime() ?? 0))[0];
  const isTrial = plan.sku === "trial";
  const planName = planLabel(plan.sku);
  const planHint = isPlanSku(plan.sku)
    ? `${PLANS[plan.sku].credits} credits a month · ${plan.allow1080p ? "up to 1080p" : "720p"} · ${plan.maxParallel} at a time`
    : `${TRIAL.resolution} renders · 1 at a time · packs welcome`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow eyebrow-accent">Studio</p>
          <h1 className="display mt-2 text-[2.2rem] text-ink sm:text-[2.8rem]">
            {jobs.length === 0 ? (
              <>
                Your first video is <em>one credit</em> away.
              </>
            ) : (
              <>
                What are we <em>showing</em> today?
              </>
            )}
          </h1>
        </div>
        <Link href="/studio/new" prefetch={false} className="btn btn-primary btn-lg">
          New video
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatPane
          label="Credits"
          value={balance.available}
          tone={balance.available === 0 ? "accent" : "default"}
          hint={
            balance.available === 0 ? (
              <Link href="/pricing#packs" prefetch={false} className="underline underline-offset-2">
                Top up with a pack
              </Link>
            ) : (
              <>
                {balance.reserved > 0 ? `${balance.reserved} reserved by running videos · ` : null}
                {soonest?.expiresAt ? `${soonest.remaining} expire ${shortDate(soonest.expiresAt)}` : "1 credit = one 15 s video"}
              </>
            )
          }
        />
        <StatPane
          label="Plan"
          value={planName}
          tone={isTrial ? "muse" : "default"}
          hint={
            <>
              {planHint} ·{" "}
              <Link href="/studio/billing" prefetch={false} className="underline underline-offset-2">
                Billing
              </Link>
            </>
          }
        />
        <StatPane label="Videos" value={finished} hint={inFlight > 0 ? `${inFlight} generating now` : finished === 0 ? "Finished videos land here" : "Ready to download and post"} />
      </div>

      {jobs.length === 0 ? (
        <div className="pane p-6 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_minmax(0,380px)]">
            <div>
              <p className="eyebrow">How it goes</p>
              <ol className="mt-4 space-y-2.5">
                {STEPS.map((s, i) => (
                  <li key={s} className="flex items-center gap-3 text-[1rem] text-ink-2">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.85rem] font-semibold text-accent-text tabular-nums">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
              <p className="mt-5 max-w-lg text-[0.92rem] leading-relaxed text-ink-3">
                Your trial credits render at {TRIAL.resolution}, the same length and script quality as paid videos. Every finished video comes with the two TikTok
                switches you need to turn on before posting.
              </p>
              <Link href="/studio/new" prefetch={false} className="btn btn-primary btn-lg mt-6">
                Start the first one
              </Link>
            </div>
            <EmptyState title="No videos yet" body="The first one takes about ten minutes of your time: most of it is choosing which photos show the product best." />
          </div>
        </div>
      ) : (
        <section aria-labelledby="recent">
          <div className="mb-4 flex items-end justify-between">
            <h2 id="recent" className="headline text-[1.5rem] text-ink">
              Recent videos
            </h2>
            <Link href="/studio/videos" prefetch={false} className="text-[0.92rem] font-medium text-ink-3 hover:text-ink">
              All videos →
            </Link>
          </div>
          <div className="pane-grid">
            {recent.map((j) => (
              <VideoCard key={j.id} job={j} productName={names.get(j.productId) ?? null} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
