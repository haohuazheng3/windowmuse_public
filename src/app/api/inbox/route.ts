import { and, desc, eq, gt, ilike } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboxMessages } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { bearerMatches } from "@/lib/admin";
import { captureError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Protected read access to the test inbox, for automated sign-in tests:
 * GET /api/inbox?to=test@windowmuse.com&since=ISO → latest messages, with the
 * six-digit code (if any) pulled out and the SPF/DKIM/DMARC verdicts.
 */
export async function GET(req: Request) {
  if (!bearerMatches(req, env("INBOX_READ_TOKEN"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const url = new URL(req.url);
    const to = url.searchParams.get("to");
    const since = url.searchParams.get("since");
    const conds = [];
    if (to) conds.push(ilike(inboxMessages.toAddr, to.toLowerCase()));
    if (since && !Number.isNaN(Date.parse(since))) conds.push(gt(inboxMessages.receivedAt, new Date(since)));
    const rows = await db
      .select()
      .from(inboxMessages)
      .where(conds.length ? and(...conds) : undefined)
      .orderBy(desc(inboxMessages.receivedAt))
      .limit(Math.min(20, Number(url.searchParams.get("limit") ?? 5) || 5));
    const messages = rows.map((m) => {
      const code = /\b(\d{6})\b/.exec(`${m.subject ?? ""}\n${m.textBody ?? ""}`)?.[1] ?? null;
      return {
        id: m.id,
        to: m.toAddr,
        from: m.fromAddr,
        subject: m.subject,
        code,
        spf: m.spf,
        dkim: m.dkim,
        dmarc: m.dmarc,
        authResults: m.authResults,
        receivedAt: m.receivedAt,
        text: (m.textBody ?? "").slice(0, 2000),
      };
    });
    return Response.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    await captureError(err, { route: "/api/inbox" });
    return Response.json({ error: "inbox unavailable" }, { status: 500 });
  }
}

/** Clear one message (used by tests to keep the inbox tidy). */
export async function DELETE(req: Request) {
  if (!bearerMatches(req, env("INBOX_READ_TOKEN"))) return Response.json({ error: "unauthorized" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  try {
    await db.delete(inboxMessages).where(eq(inboxMessages.id, id));
    return Response.json({ ok: true });
  } catch (err) {
    await captureError(err, { route: "/api/inbox" });
    return Response.json({ error: "delete failed" }, { status: 500 });
  }
}
