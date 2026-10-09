import Link from "next/link";
import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { jobs, orders } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { features, missingEnv, VERCEL_ENV } from "@/lib/env";
import { stripeMode, stripeContext } from "@/lib/stripe";
import { OFFERS, isSku } from "@/content/plans";
import { presenterById } from "@/content/presenters";
import { StatPane } from "@/components/ui";
import { APP_STATE_KEYS, appStateEntry, counts, creditTotals, emailsForUsers, jobsByStatus, JOB_STATUS_ORDER, orderTotals } from "./_data";
import { AdminTitle, JobStatusTag, Tag, ago, fmtInt, fmtMoney, orderTone, shortId } from "./_ui";

export const dynamic = "force-dynamic";

/** Same source as /api/health: the deployment's commit, or "local" outside Vercel. */
function commitHash(): string {
  return (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 12);
}

interface ReconcileReport {
  ranAt?: string;
  repaired?: unknown[];
  failed?: unknown[];
  checked?: number;
}

function asReport(v: unknown): ReconcileReport | null {
  if (!v || typeof v !== "object") return null;
  return v as ReconcileReport;
}

export default async function AdminOverview() {
  await requireAdmin();
  const [c, byStatus, credits, last30, recentJobs, recentOrders, reconcile] = await Promise.all([
    counts(),
    jobsByStatus(),
    creditTotals(),
    orderTotals(30),
    db.select().from(jobs).orderBy(desc(jobs.createdAt)).limit(8),
    db.select().from(orders).orderBy(desc(orders.createdAt)).limit(6),
    appStateEntry(APP_STATE_KEYS.reconcile),
  ]);
  const emails = await emailsForUsers([...new Set([...recentJobs.map((j) => j.userId), ...recentOrders.map((o) => o.userId)])]);
  const f = features();
  const missing = missingEnv();
  const inFlight = byStatus.queued + byStatus.running;
  const report = asReport(reconcile?.value);

  return (
    <div className="space-y-8">
      <AdminTitle title="Overview" lede="What the business and the pipeline look like right now. Every number is live from the database." />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatPane label="Users" value={fmtInt(c.users)} hint={`${fmtInt(c.activeSubscriptions)} on a plan`} />
        <StatPane label="Videos delivered" value={fmtInt(byStatus.succeeded)} hint={`${fmtInt(inFlight)} generating now`} tone={inFlight > 0 ? "accent" : "default"} />
        <StatPane label="Revenue, 30 days" value={fmtMoney(last30.revenueCents)} hint={`${fmtInt(last30.paidCount)} paid orders`} />
        <StatPane
          label="Credits outstanding"
          value={fmtInt(credits.outstanding)}
          hint={`${fmtInt(credits.reserved)} reserved by running jobs`}
          tone="muse"
        />
        <Link href="/admin/errors" className="block min-w-0 rounded-[var(--radius-pane)]">
          <StatPane label="Unresolved errors" value={fmtInt(c.unresolvedErrors)} hint={`${fmtInt(c.unresolvedWarnings)} warnings`} tone={c.unresolvedErrors > 0 ? "accent" : "default"} className="h-full pane-hover" />
        </Link>
        <Link href="/admin/messages" className="block min-w-0 rounded-[var(--radius-pane)]">
          <StatPane label="New messages" value={fmtInt(c.newMessages)} hint="Contact form, unanswered" className="h-full pane-hover" />
        </Link>
        <Link href="/admin/inbox" className="block min-w-0 rounded-[var(--radius-pane)]">
          <StatPane label="Test inbox" value={fmtInt(c.inbox)} hint="Mail caught by the worker" className="h-full pane-hover" />
        </Link>
        <StatPane
          label="Refunds / disputes"
          value={`${fmtInt(last30.refundedCount)} / ${fmtInt(last30.disputedCount)}`}
          hint="Last 30 days"
          tone={last30.disputedCount > 0 ? "accent" : "default"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="pane p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Jobs by status</p>
            <Link href="/admin/jobs" className="text-[0.85rem] font-semibold text-accent-text">
              All jobs →
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
            {JOB_STATUS_ORDER.map((s) => (
              <li key={s} className="flex items-baseline justify-between gap-2 border-b border-line py-1.5 text-[0.9rem]">
                <Link href={`/admin/jobs?status=${s}`} className="text-ink-3 hover:text-ink">
                  {s.replace("_", " ")}
                </Link>
                <span className="font-semibold tabular-nums text-ink">{fmtInt(byStatus[s])}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[0.82rem] leading-relaxed text-ink-4">
            Credits: {fmtInt(credits.granted)} granted all time, {fmtInt(credits.debited)} spent on delivered videos. Failed, expired and cancelled jobs
            release their reservation, so they never appear in the spent figure.
          </p>
        </section>

        <section className="pane p-5 sm:p-6">
          <p className="eyebrow">System</p>
          <ul className="mt-4 space-y-2 text-[0.9rem] text-ink-2">
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-3">Deployment</span>
              <span>
                <Tag>{VERCEL_ENV}</Tag> <code className="font-mono text-[0.82rem]">{commitHash()}</code>
              </span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-3">Video engine</span>
              <Tag tone={f.videoEngine === "replicate" ? "ok" : f.videoEngine === "mock" ? "muse" : "bad"}>{f.videoEngine}</Tag>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-3">Script writer</span>
              <Tag tone={f.aiWriter ? "ok" : "neutral"}>{f.aiWriter ? "Claude" : "template"}</Tag>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-ink-3">Stripe</span>
              <span>
                <Tag tone={stripeMode() === "live" ? "ok" : stripeMode() === "test" ? "muse" : "bad"}>{stripeMode()}</Tag>{" "}
                {stripeContext() ? <Tag>context set</Tag> : null}
              </span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-ink-3">Missing env</span>
              <span className="text-right">{missing.length ? <span className="break-words text-bad">{missing.join(", ")}</span> : <Tag tone="ok">none</Tag>}</span>
            </li>
            <li className="flex items-start justify-between gap-3">
              <span className="shrink-0 text-ink-3">Last reconcile</span>
              <span className="text-right">
                {report?.ranAt
                  ? `${ago(report.ranAt)} · repaired ${report.repaired?.length ?? 0} · failed ${report.failed?.length ?? 0}`
                  : reconcile
                    ? ago(reconcile.updatedAt)
                    : "never"}
              </span>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <a href="/api/health" className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
              /api/health
            </a>
            <Link href="/admin/diagnostics" className="btn btn-quiet btn-sm">
              Diagnostics
            </Link>
          </div>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="pane p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Recent jobs</p>
            <Link href="/admin/jobs" className="text-[0.85rem] font-semibold text-accent-text">
              All →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {recentJobs.length === 0 ? <li className="py-3 text-[0.9rem] text-ink-4">No jobs yet.</li> : null}
            {recentJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.88rem]">
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    <code className="font-mono text-[0.8rem]" title={j.id}>
                      {shortId(j.id)}
                    </code>{" "}
                    · {presenterById(j.presenterId)?.name ?? j.presenterId} · {j.durationSec}s {j.resolution}
                  </p>
                  <p className="truncate text-ink-4">
                    {emails.get(j.userId) ?? j.userId} · {ago(j.createdAt)}
                  </p>
                </div>
                <JobStatusTag status={j.status} />
              </li>
            ))}
          </ul>
        </section>

        <section className="pane p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <p className="eyebrow">Recent orders</p>
            <Link href="/admin/orders" className="text-[0.85rem] font-semibold text-accent-text">
              All →
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-[var(--line)]">
            {recentOrders.length === 0 ? <li className="py-3 text-[0.9rem] text-ink-4">No orders yet.</li> : null}
            {recentOrders.map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-3 py-2.5 text-[0.88rem]">
                <div className="min-w-0">
                  <p className="truncate text-ink">
                    {isSku(o.sku) ? OFFERS[o.sku].name : o.sku} · {fmtMoney(o.amountTotal, o.currency)}
                    {o.promoCode ? <span className="text-ink-4"> · {o.promoCode}</span> : null}
                  </p>
                  <p className="truncate text-ink-4">
                    {o.email ?? emails.get(o.userId) ?? o.userId} · {ago(o.createdAt)}
                  </p>
                </div>
                <Tag tone={orderTone(o.status)}>{o.status}</Tag>
              </li>
            ))}
          </ul>
        </section>
      </div>

    </div>
  );
}
