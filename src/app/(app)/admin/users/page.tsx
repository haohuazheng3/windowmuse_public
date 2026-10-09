import Link from "next/link";
import { desc, ilike } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, type UserRow } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { OFFERS } from "@/content/plans";
import { balancesForUsers, jobCountsForUsers, plansForUsers } from "../_data";
import { AdminTable, AdminTitle, Mono, Tag, ago, fmtDate, fmtInt, type Column } from "../_ui";

export const dynamic = "force-dynamic";

const Query = z.object({ q: z.string().trim().max(120).optional() });

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const PAGE = 100;

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const parsed = Query.safeParse({ q: typeof sp.q === "string" ? sp.q : undefined });
  const q = parsed.success ? (parsed.data.q ?? "") : "";

  // A search for a user id (from a job row) matches exactly; anything else is an email substring.
  const rows: UserRow[] = await db
    .select()
    .from(users)
    .where(q ? (q.startsWith("user_") ? ilike(users.id, q) : ilike(users.email, `%${q.replace(/[%_]/g, "\\$&")}%`)) : undefined)
    .orderBy(desc(users.createdAt))
    .limit(PAGE);
  const ids = rows.map((u) => u.id);
  const [plans, balances, jobCounts] = await Promise.all([plansForUsers(ids), balancesForUsers(ids), jobCountsForUsers(ids)]);

  const columns: Column<UserRow>[] = [
    {
      key: "email",
      label: "Email",
      primary: true,
      render: (u) => (
        <div className="min-w-0">
          <p className="break-all font-semibold text-ink">{u.email}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.78rem] text-ink-4">
            <Mono title={u.id}>{u.id}</Mono>
            {u.stripeCustomerId ? <Mono title="Stripe customer">{u.stripeCustomerId}</Mono> : null}
          </p>
        </div>
      ),
    },
    {
      key: "plan",
      label: "Plan",
      render: (u) => {
        const sku = plans.get(u.id);
        return sku ? <Tag tone="ok">{OFFERS[sku].name}</Tag> : <Tag>trial / packs</Tag>;
      },
    },
    {
      key: "balance",
      label: "Credits",
      className: "sm:text-right tabular-nums",
      render: (u) => <span className="font-semibold text-ink">{fmtInt(balances.get(u.id) ?? 0)}</span>,
    },
    {
      key: "jobs",
      label: "Jobs",
      className: "sm:text-right tabular-nums",
      render: (u) => {
        const j = jobCounts.get(u.id);
        return j && j.total > 0 ? (
          <Link href={`/admin/jobs?user=${encodeURIComponent(u.id)}`} className="text-accent-text underline-offset-2 hover:underline">
            {fmtInt(j.succeeded)} / {fmtInt(j.total)}
          </Link>
        ) : (
          <span className="text-ink-4">0</span>
        );
      },
    },
    { key: "seen", label: "Last seen", render: (u) => <span title={fmtDate(u.lastSeenAt)}>{ago(u.lastSeenAt)}</span> },
    { key: "joined", label: "Joined", render: (u) => <span title={fmtDate(u.createdAt)}>{ago(u.createdAt)}</span> },
  ];

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Users"
        count={rows.length}
        lede="One row per Clerk account that has opened the studio. Credits are what the user can spend right now; jobs show delivered / total."
      />
      <form action="/admin/users" method="get" className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor="q" className="sr-only">
          Search by email or user id
        </label>
        <input id="q" name="q" type="search" defaultValue={q} placeholder="Search email or user id" className="input sm:max-w-sm" autoComplete="off" />
        <div className="flex gap-2">
          <button type="submit" className="btn btn-ghost btn-sm">
            Search
          </button>
          {q ? (
            <Link href="/admin/users" className="btn btn-quiet btn-sm">
              Clear
            </Link>
          ) : null}
        </div>
      </form>
      <AdminTable
        columns={columns}
        rows={rows}
        keyOf={(u) => u.id}
        empty={q ? `No user matches “${q}”.` : "No one has signed in yet. The first sign-in creates the row and grants the 2-credit trial."}
      />
      {rows.length === PAGE ? <p className="text-[0.85rem] text-ink-4">Showing the newest {PAGE}. Narrow the search to see older accounts.</p> : null}
    </div>
  );
}
