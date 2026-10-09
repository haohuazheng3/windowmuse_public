import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { inboxMessages } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { SITE } from "@/lib/site";
import { AdminTitle, Tag, ago, fmtDate, fmtInt, verdictTone } from "../_ui";

export const dynamic = "force-dynamic";

/** The six-digit code Clerk (or any sender) put in the mail, for sign-in drills; same rule as GET /api/inbox. */
function extractCode(subject: string | null, text: string | null): string | null {
  return /\b(\d{6})\b/.exec(`${subject ?? ""}\n${text ?? ""}`)?.[1] ?? null;
}

function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export default async function InboxPage() {
  await requireAdmin();
  const rows = await db.select().from(inboxMessages).orderBy(desc(inboxMessages.receivedAt)).limit(100);

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Test inbox"
        count={rows.length}
        lede={`Mail to test@${SITE.domain} and every unrouted address on the domain, delivered by Cloudflare Email Routing to the mail worker. SPF, DKIM and DMARC verdicts come from Cloudflare's Authentication-Results header; a six-digit code is pulled out for sign-in tests.`}
      />
      <ul className="space-y-3">
        {rows.length === 0 ? (
          <li className="pane-inset px-5 py-8 text-center text-[0.95rem] text-ink-3">Empty. Send anything to test@{SITE.domain} and it appears here within a minute.</li>
        ) : null}
        {rows.map((m) => {
          const code = extractCode(m.subject, m.textBody);
          return (
            <li key={m.id} className="pane p-5">
              <p className="flex flex-wrap items-center gap-2 text-[0.82rem] text-ink-3">
                <Tag tone={verdictTone(m.spf)}>SPF {m.spf ?? "?"}</Tag>
                <Tag tone={verdictTone(m.dkim)}>DKIM {m.dkim ?? "?"}</Tag>
                <Tag tone={verdictTone(m.dmarc)}>DMARC {m.dmarc ?? "?"}</Tag>
                {code ? (
                  <Tag tone="muse" title="Six-digit code found in the subject or body">
                    code {code}
                  </Tag>
                ) : null}
                <span title={fmtDate(m.receivedAt)}>{ago(m.receivedAt)}</span>
                <span>· {fmtBytes(m.rawSize)}</span>
              </p>
              <p className="mt-2 break-words font-semibold text-ink">{m.subject ?? "(no subject)"}</p>
              <p className="break-all text-[0.85rem] text-ink-3">
                {m.fromAddr} → {m.toAddr}
              </p>
              {m.textBody ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[0.82rem] text-ink-3">Text body</summary>
                  <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl bg-pane-2 p-3 text-[0.78rem] text-ink-3">{m.textBody}</pre>
                </details>
              ) : null}
              {m.headers && Object.keys(m.headers).length > 0 ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-[0.82rem] text-ink-3">Headers ({fmtInt(Object.keys(m.headers).length)})</summary>
                  <dl className="mt-2 max-h-72 overflow-auto rounded-xl bg-pane-2 p-3 text-[0.75rem] text-ink-3">
                    {Object.entries(m.headers).map(([k, v]) => (
                      <div key={k} className="break-all">
                        <dt className="inline font-semibold text-ink-2">{k}: </dt>
                        <dd className="inline">{v}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
              {m.authResults ? <p className="mt-2 break-all text-[0.72rem] text-ink-4">{m.authResults}</p> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
