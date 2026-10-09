import { asc, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { errorGroups } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { AdminTitle, Tag, ago, fmtDate, fmtInt } from "../_ui";
import { SubmitButton } from "../_client";
import { resolveAllErrors, setErrorResolved } from "../actions";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  await requireAdmin();
  // Open errors first, then open warnings, then resolved; newest activity on top within each band.
  const rows = await db
    .select()
    .from(errorGroups)
    .orderBy(sql`${errorGroups.resolvedAt} is not null`, asc(sql`${errorGroups.severity} = 'warn'`), desc(errorGroups.lastSeen))
    .limit(200);
  const open = rows.filter((e) => !e.resolvedAt);
  const openErrors = open.filter((e) => e.severity === "error").length;

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Error inbox"
        count={open.length}
        lede="Grouped by error name, first stack frame and route. A resolved group that recurs reopens by itself. Open errors (not warnings) turn /api/health red."
        actions={
          open.length > 0 ? (
            <form action={resolveAllErrors}>
              <SubmitButton pendingLabel="Resolving…">Resolve all open ({fmtInt(open.length)})</SubmitButton>
            </form>
          ) : null
        }
      />
      {openErrors > 0 ? (
        <p role="status" className="pane-inset px-4 py-3 text-[0.9rem] text-bad">
          {fmtInt(openErrors)} unresolved {openErrors === 1 ? "error keeps" : "errors keep"} /api/health at 503 until resolved.
        </p>
      ) : null}
      <ul className="space-y-3">
        {rows.length === 0 ? <li className="pane-inset px-5 py-8 text-center text-[0.95rem] text-ink-3">Nothing recorded. The pipeline is proven from Diagnostics.</li> : null}
        {rows.map((e) => (
          <li key={e.id} className={`pane p-5 ${e.resolvedAt ? "opacity-60" : ""}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Tag tone={e.severity === "error" ? "bad" : "neutral"}>{e.severity}</Tag>
                  <Tag>{e.source}</Tag>
                  {e.resolvedAt ? <Tag tone="ok">resolved {ago(e.resolvedAt)}</Tag> : null}
                  <span className="text-[0.82rem] text-ink-4">
                    ×{fmtInt(e.count)} · last <span title={fmtDate(e.lastSeen)}>{ago(e.lastSeen)}</span> · first <span title={fmtDate(e.firstSeen)}>{ago(e.firstSeen)}</span>
                  </span>
                </p>
                <p className="mt-2 break-words font-semibold text-ink">
                  {e.name}: {e.message}
                </p>
                <p className="mt-1 break-all text-[0.82rem] text-ink-3">
                  {e.route ?? "no route"} · {e.firstFrame ?? "no frame"}
                </p>
                {e.stack || e.context ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[0.82rem] text-ink-3">Stack and context</summary>
                    {e.context ? (
                      <pre className="mt-2 max-h-40 overflow-auto rounded-xl bg-pane-2 p-3 text-[0.75rem] text-ink-3">{JSON.stringify(e.context, null, 2)}</pre>
                    ) : null}
                    {e.stack ? <pre className="mt-2 max-h-64 overflow-auto rounded-xl bg-pane-2 p-3 text-[0.75rem] text-ink-3">{e.stack}</pre> : null}
                  </details>
                ) : null}
              </div>
              <form action={setErrorResolved} className="shrink-0">
                <input type="hidden" name="id" value={e.id} />
                <input type="hidden" name="resolve" value={e.resolvedAt ? "0" : "1"} />
                <SubmitButton className={`btn btn-sm ${e.resolvedAt ? "btn-quiet" : "btn-primary"}`} pendingLabel={e.resolvedAt ? "Reopening…" : "Resolving…"}>
                  {e.resolvedAt ? "Reopen" : "Mark resolved"}
                </SubmitButton>
              </form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
