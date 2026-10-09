import Link from "next/link";
import type { ReactNode } from "react";
import type { JobStatus, OrderStatus } from "@/lib/db/schema";

/*
 * Shared pieces of the admin area. Everything here is a server component except the
 * client helpers in _client.tsx; the admin area is the owner's cockpit, so it favours
 * density and legibility over the marketing site's air.
 */

/* ------------------------------------------------------------------ formatting */

const dateTime = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "UTC",
});

/** Fixed UTC, so a timestamp reads the same in Vercel logs, Stripe and this page. */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  return `${dateTime.format(date)} UTC`;
}

/** "3m ago", "2h ago", "5d ago"; falls back to the date past a week. */
export function ago(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  if (Number.isNaN(diff)) return "—";
  const s = Math.max(0, Math.round(diff / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const days = Math.round(h / 24);
  if (days < 8) return `${days}d ago`;
  return fmtDate(date);
}

export function fmtMoney(cents: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** `job_k3v9abcd…` → `k3v9abcd` for dense tables; the full id sits in the title attribute. */
export function shortId(id: string): string {
  return id.replace(/^[a-z]+_/, "").slice(0, 8);
}

/* ------------------------------------------------------------------ tags */

export type Tone = "neutral" | "ok" | "bad" | "accent" | "muse";

const TONE_CLASS: Record<Tone, string> = {
  neutral: "tag",
  ok: "tag tag-ok",
  bad: "tag tag-bad",
  accent: "tag tag-accent",
  muse: "tag tag-muse",
};

export function Tag({ tone = "neutral", children, title }: { tone?: Tone; children: ReactNode; title?: string }) {
  return (
    <span className={TONE_CLASS[tone]} title={title}>
      {children}
    </span>
  );
}

export const JOB_STATUSES: readonly JobStatus[] = ["draft", "awaiting_engine", "queued", "running", "succeeded", "failed", "expired", "cancelled"];

export function jobTone(status: JobStatus): Tone {
  switch (status) {
    case "succeeded":
      return "ok";
    case "failed":
    case "expired":
      return "bad";
    case "queued":
    case "running":
      return "accent";
    case "awaiting_engine":
      return "muse";
    default:
      return "neutral";
  }
}

export function JobStatusTag({ status }: { status: JobStatus }) {
  return <Tag tone={jobTone(status)}>{status.replace("_", " ")}</Tag>;
}

export function orderTone(status: OrderStatus | string): Tone {
  if (status === "paid") return "ok";
  if (status === "refunded") return "neutral";
  if (status === "disputed") return "bad";
  return "neutral";
}

export function subscriptionTone(status: string): Tone {
  if (status === "active" || status === "trialing") return "ok";
  if (status === "past_due" || status === "unpaid" || status === "incomplete") return "bad";
  return "neutral";
}

/** pass / fail / softfail / none verdicts from Authentication-Results. */
export function verdictTone(v: string | null | undefined): Tone {
  if (!v) return "neutral";
  const s = v.toLowerCase();
  if (s === "pass") return "ok";
  if (s === "none" || s === "neutral") return "neutral";
  return "bad";
}

/* ------------------------------------------------------------------ page scaffolding */

export function AdminTitle({ title, lede, actions, count }: { title: ReactNode; lede?: ReactNode; actions?: ReactNode; count?: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="headline flex flex-wrap items-baseline gap-x-3 text-[1.7rem] text-ink sm:text-[2rem]">
          {title}
          {typeof count === "number" ? <span className="font-sans text-[1rem] font-medium tabular-nums text-ink-4">{fmtInt(count)}</span> : null}
        </h1>
        {lede ? <p className="mt-1 max-w-2xl text-[0.92rem] leading-relaxed text-ink-3">{lede}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** A labelled value inside a pane (diagnostics, system panel). */
export function KeyValue({ rows }: { rows: { label: ReactNode; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-[var(--line)]">
      {rows.map((r, i) => (
        <div key={i} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <dt className="shrink-0 text-[0.86rem] text-ink-3 sm:w-56">{r.label}</dt>
          <dd className="min-w-0 break-words text-[0.92rem] text-ink sm:text-right">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ responsive table */

export interface Column<T> {
  key: string;
  label: ReactNode;
  render: (row: T) => ReactNode;
  /** Tailwind classes on both the header and the cell. */
  className?: string;
  /** Primary cell: shown as the card title on phones (no label). */
  primary?: boolean;
  /** Row actions: rendered at the bottom of the card on phones. */
  actions?: boolean;
}

/**
 * One table that is a real <table> from 640px up and a stack of cards below: each cell
 * carries its column label, so nothing scrolls sideways at 390px.
 */
export function AdminTable<T>({
  columns,
  rows,
  keyOf,
  empty,
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  keyOf: (row: T) => string;
  empty: ReactNode;
  dense?: boolean;
}) {
  if (rows.length === 0) {
    return <div className="pane-inset px-5 py-8 text-center text-[0.95rem] text-ink-3">{empty}</div>;
  }
  const cellPad = dense ? "sm:px-3 sm:py-2" : "sm:px-4 sm:py-3";
  return (
    <div className="pane overflow-hidden">
      <table className="block w-full text-left text-[0.9rem] sm:table">
        <thead className="hidden sm:table-header-group">
          <tr className="border-b border-line text-[0.78rem] uppercase tracking-[0.08em] text-ink-4">
            {columns.map((c) => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-4 py-3 font-semibold ${c.className ?? ""}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="block divide-y divide-[var(--line)] sm:table-row-group">
          {rows.map((row) => (
            <tr key={keyOf(row)} className="block px-4 py-4 sm:table-row sm:p-0">
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`block min-w-0 ${c.primary ? "mb-1" : c.actions ? "mt-3" : "py-0.5"} sm:table-cell sm:align-top ${cellPad} ${c.className ?? ""}`}
                >
                  {c.primary || c.actions ? (
                    c.render(row)
                  ) : (
                    <div className="flex items-baseline justify-between gap-4 sm:block">
                      <span className="shrink-0 text-[0.78rem] text-ink-4 sm:hidden">{c.label}</span>
                      <span className="min-w-0 break-words text-right sm:text-left">{c.render(row)}</span>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ small links */

export function UserLink({ id, email }: { id: string; email: string | null | undefined }) {
  return (
    <Link href={`/admin/users?q=${encodeURIComponent(email ?? id)}`} className="break-all text-accent-text underline-offset-2 hover:underline" title={id}>
      {email ?? shortId(id)}
    </Link>
  );
}

export function Mono({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <code className="break-all rounded-md bg-pane-2 px-1.5 py-0.5 font-mono text-[0.8rem] text-ink-2" title={title}>
      {children}
    </code>
  );
}

/** Skeleton for a table-shaped page: title bar + N shimmering rows. */
export function TableSkeleton({ rows = 6, filters = false }: { rows?: number; filters?: boolean }) {
  return (
    <div aria-busy="true" aria-live="polite">
      <div className="skeleton h-9 w-48" />
      <div className="skeleton mt-3 h-4 w-80 max-w-full" />
      {filters ? (
        <div className="mt-5 flex gap-2">
          <div className="skeleton h-10 w-40" />
          <div className="skeleton h-10 w-28" />
        </div>
      ) : null}
      <div className="pane mt-5 divide-y divide-[var(--line)]">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-4">
            <div className="skeleton h-4 w-20 shrink-0" />
            <div className="skeleton h-4 flex-1" />
            <div className="skeleton hidden h-4 w-24 sm:block" />
            <div className="skeleton hidden h-4 w-16 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
