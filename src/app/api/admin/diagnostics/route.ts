import { and, isNull, like, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { errorGroups } from "@/lib/db/schema";
import { captureError } from "@/lib/errors";
import { createMockJob } from "./mock-job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/*
 * Admin drills behind the session (the proxy answers 404 to non-admins on /api/admin/*,
 * and requireAdmin repeats the check). The Bearer-token twin for scripts is /api/ops.
 *
 *  POST ?action=throw                      → a deliberate server error: captured, 500
 *  POST ?action=client-error-instructions  → the checklist for the client-error drill
 *  POST ?action=resolve-drills             → resolves every open "Diagnostics:" error
 *  POST ?action=mock-job                   → a real job for the admin, pinned to the mock engine
 */

const Action = z.enum(["throw", "client-error-instructions", "resolve-drills", "mock-job"]);

const NO_STORE = { "Cache-Control": "no-store" } as const;

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function POST(req: Request) {
  const { userId, email } = await requireAdmin();
  const parsed = Action.safeParse(new URL(req.url).searchParams.get("action"));
  if (!parsed.success) return json({ error: "Unknown action. Use throw, client-error-instructions, resolve-drills or mock-job." }, 400);
  const action = parsed.data;
  const route = `/api/admin/diagnostics?action=${action}`;

  try {
    switch (action) {
      case "throw":
        throw new Error(`Diagnostics: deliberate server error from the admin panel at ${new Date().toISOString()}`);

      case "client-error-instructions":
        return json({
          ok: true,
          steps: [
            "The browser threw an uncaught error on this page.",
            "instrumentation-client.ts reports it to POST /api/errors with sendBeacon.",
            "Within a few seconds the error inbox shows an entry named Error, source client, route /admin/diagnostics, severity error (our bundle threw it).",
            "Resolve it with “Resolve drills” when you are done.",
          ],
        });

      case "resolve-drills": {
        const rows = await db
          .update(errorGroups)
          .set({ resolvedAt: sql`now()` })
          .where(and(isNull(errorGroups.resolvedAt), like(errorGroups.message, "Diagnostics:%")))
          .returning({ id: errorGroups.id });
        return json({ ok: true, resolved: rows.length });
      }

      case "mock-job": {
        const job = await createMockJob(userId);
        return json({ ok: true, job: { id: job.id, status: job.status, provider: "mock", stage: job.stage } });
      }
    }
  } catch (err) {
    await captureError(err, { route, source: "server", context: { drill: action, admin: email } });
    const message = err instanceof Error ? err.message : "Unknown error";
    return json({ error: action === "throw" ? "Thrown and captured." : message }, 500);
  }
}
