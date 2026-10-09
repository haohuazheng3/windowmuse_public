import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { jobs, products, type JobRow, type JobStatus } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { presenterById } from "@/content/presenters";
import { emailsForUsers, ledgerForJobs } from "../_data";
import { AdminTable, AdminTitle, JOB_STATUSES, JobStatusTag, Mono, Tag, UserLink, ago, fmtDate, fmtInt, type Column } from "../_ui";
import { SubmitButton } from "../_client";
import { OPEN_STATUSES, RETRYABLE_STATUSES } from "@/lib/video/jobs";
import { markJobFailed, releaseJobCredits, retryJob, type JobNotice } from "../actions";

export const dynamic = "force-dynamic";

const Query = z.object({
  status: z.enum(JOB_STATUSES as [JobStatus, ...JobStatus[]]).optional(),
  user: z.string().regex(/^[A-Za-z0-9_-]{1,64}$/).optional(),
  notice: z.string().max(40).optional(),
});

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE = 150;

const NOTICES: Record<JobNotice, { tone: "ok" | "bad" | "neutral"; text: string }> = {
  "retry-queued": { tone: "ok", text: "Job re-dispatched with its original reservation. With an engine configured it is queued now; otherwise it waits in awaiting engine until one is." },
  "retry-refused-status": { tone: "bad", text: "Only failed, expired or still-open jobs can be retried. A delivered or cancelled job needs a new generation." },
  "retry-refused-credits": {
    tone: "bad",
    text: "This job no longer holds its credits (they were released or already charged), so it cannot be re-run. The seller can start a new job.",
  },
  released: { tone: "ok", text: "Reservation released and the job cancelled. The seller's balance is restored." },
  "release-noop": { tone: "neutral", text: "Nothing to release: the job is closed and holds no credits." },
  failed: { tone: "ok", text: "Job marked failed and its credits released." },
  "fail-noop": { tone: "neutral", text: "The job is already closed; nothing changed." },
  "not-found": { tone: "bad", text: "That job no longer exists." },
  invalid: { tone: "bad", text: "The request was malformed; nothing changed." },
};

function isNotice(v: string | undefined): v is JobNotice {
  return typeof v === "string" && v in NOTICES;
}

// The same sets the operator levers in src/lib/video/jobs.ts accept, so a button never shows for a refused action.
const RETRYABLE: readonly JobStatus[] = RETRYABLE_STATUSES;
const OPEN: readonly JobStatus[] = OPEN_STATUSES;

type Row = JobRow & { productName: string | null };

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const parsed = Query.safeParse({
    status: typeof sp.status === "string" ? sp.status : undefined,
    user: typeof sp.user === "string" ? sp.user : undefined,
    notice: typeof sp.notice === "string" ? sp.notice : undefined,
  });
  const q = parsed.success ? parsed.data : {};
  const back = new URLSearchParams();
  if (q.status) back.set("status", q.status);
  if (q.user) back.set("user", q.user);
  const backStr = back.toString();

  const conds = [];
  if (q.status) conds.push(eq(jobs.status, q.status));
  if (q.user) conds.push(eq(jobs.userId, q.user));
  const rows: Row[] = await db
    .select({
      id: jobs.id,
      userId: jobs.userId,
      productId: jobs.productId,
      scriptId: jobs.scriptId,
      presenterId: jobs.presenterId,
      provider: jobs.provider,
      providerTaskId: jobs.providerTaskId,
      status: jobs.status,
      resolution: jobs.resolution,
      durationSec: jobs.durationSec,
      credits: jobs.credits,
      prompt: jobs.prompt,
      params: jobs.params,
      error: jobs.error,
      createdAt: jobs.createdAt,
      startedAt: jobs.startedAt,
      finishedAt: jobs.finishedAt,
      expiresAt: jobs.expiresAt,
      productName: products.name,
    })
    .from(jobs)
    .leftJoin(products, eq(products.id, jobs.productId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(jobs.createdAt))
    .limit(PAGE);

  const [emails, ledger] = await Promise.all([emailsForUsers([...new Set(rows.map((j) => j.userId))]), ledgerForJobs(rows.map((j) => j.id))]);

  const columns: Column<Row>[] = [
    {
      key: "job",
      label: "Job",
      primary: true,
      render: (j) => {
        const p = presenterById(j.presenterId);
        const retries = Number((j.params as Record<string, unknown> | null)?.retries ?? 0);
        return (
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Mono title={j.id}>{j.id}</Mono>
              <JobStatusTag status={j.status} />
              {retries > 0 ? <Tag tone="muse">retry ×{retries}</Tag> : null}
            </p>
            <p className="mt-1 text-[0.86rem] text-ink-2">
              {p?.name ?? j.presenterId} · {j.durationSec}s · {j.resolution} · {fmtInt(j.credits)} {j.credits === 1 ? "credit" : "credits"}
              {j.productName ? <span className="text-ink-4"> · {j.productName}</span> : null}
            </p>
            {j.error ? <p className="mt-1 break-words text-[0.82rem] text-bad">{j.error}</p> : null}
          </div>
        );
      },
    },
    { key: "user", label: "User", render: (j) => <UserLink id={j.userId} email={emails.get(j.userId)} /> },
    {
      key: "provider",
      label: "Provider",
      render: (j) => (
        <span className="flex flex-col items-end gap-1 sm:items-start">
          <Tag>{j.provider}</Tag>
          {j.providerTaskId ? <Mono title="Provider task id">{j.providerTaskId}</Mono> : <span className="text-[0.8rem] text-ink-4">no task yet</span>}
        </span>
      ),
    },
    {
      key: "credits",
      label: "Ledger",
      render: (j) => {
        const l = ledger.get(j.id);
        if (!l) return <span className="text-ink-4">no events</span>;
        if (l.holding) return <Tag tone="accent">holding {l.reserved}</Tag>;
        if (l.debited > 0) return <Tag tone="ok">charged {l.debited}</Tag>;
        if (l.released > 0) return <Tag>released {l.released}</Tag>;
        return <span className="text-ink-4">—</span>;
      },
    },
    {
      key: "time",
      label: "Created / finished",
      render: (j) => (
        <span className="text-[0.86rem]">
          <span title={fmtDate(j.createdAt)}>{ago(j.createdAt)}</span>
          <span className="text-ink-4"> → </span>
          <span title={fmtDate(j.finishedAt)}>{j.finishedAt ? ago(j.finishedAt) : j.status === "running" || j.status === "queued" ? "in progress" : "—"}</span>
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      actions: true,
      render: (j) => {
        const l = ledger.get(j.id);
        const canRetry = RETRYABLE.includes(j.status) && Boolean(l?.holding);
        const canRelease = OPEN.includes(j.status) || Boolean(l?.holding);
        const canFail = OPEN.includes(j.status);
        if (!canRetry && !canRelease && !canFail) return <span className="text-[0.82rem] text-ink-4">closed</span>;
        return (
          <div className="flex flex-wrap gap-2">
            {canRetry ? (
              <form action={retryJob}>
                <input type="hidden" name="id" value={j.id} />
                <input type="hidden" name="back" value={backStr} />
                <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Queueing…" title="Return the job to the queue; its reservation stays">
                  Retry
                </SubmitButton>
              </form>
            ) : null}
            {canRelease ? (
              <form action={releaseJobCredits}>
                <input type="hidden" name="id" value={j.id} />
                <input type="hidden" name="back" value={backStr} />
                <SubmitButton pendingLabel="Releasing…" title="Give the credits back and cancel the job">
                  Release credits
                </SubmitButton>
              </form>
            ) : null}
            {canFail ? (
              <form action={markJobFailed}>
                <input type="hidden" name="id" value={j.id} />
                <input type="hidden" name="back" value={backStr} />
                <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="Marking…" title="Mark failed; credits are released">
                  Mark failed
                </SubmitButton>
              </form>
            ) : null}
          </div>
        );
      },
    },
  ];

  const notice = isNotice(q.notice) ? NOTICES[q.notice] : null;

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Jobs"
        count={rows.length}
        lede="Every generation, newest first. Retry keeps the reservation and re-dispatches; Release gives credits back and cancels; Mark failed closes a job the provider lost."
      />

      {notice ? (
        <div role="status" className={`pane-inset px-4 py-3 text-[0.9rem] ${notice.tone === "ok" ? "text-ok" : notice.tone === "bad" ? "text-bad" : "text-ink-2"}`}>
          {notice.text}{" "}
          <Link href={`/admin/jobs${backStr ? `?${backStr}` : ""}`} className="text-ink-4 underline-offset-2 hover:underline">
            Dismiss
          </Link>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={q.user ? `/admin/jobs?user=${q.user}` : "/admin/jobs"} className="chip" data-selected={!q.status ? "true" : "false"}>
          All
        </Link>
        {JOB_STATUSES.map((s) => {
          const p = new URLSearchParams();
          p.set("status", s);
          if (q.user) p.set("user", q.user);
          return (
            <Link key={s} href={`/admin/jobs?${p.toString()}`} className="chip" data-selected={q.status === s ? "true" : "false"}>
              {s.replace("_", " ")}
            </Link>
          );
        })}
      </div>

      {q.user ? (
        <p className="text-[0.88rem] text-ink-3">
          Showing jobs for <UserLink id={q.user} email={emails.get(q.user)} />.{" "}
          <Link href={q.status ? `/admin/jobs?status=${q.status}` : "/admin/jobs"} className="text-ink-4 underline-offset-2 hover:underline">
            Show everyone
          </Link>
        </p>
      ) : null}

      <AdminTable columns={columns} rows={rows} keyOf={(j) => j.id} empty={q.status || q.user ? "No jobs match this filter." : "No generations yet."} />
      {rows.length === PAGE ? <p className="text-[0.85rem] text-ink-4">Showing the newest {PAGE}. Filter by status or user to see older jobs.</p> : null}
    </div>
  );
}
