import { desc } from "drizzle-orm";
import { db } from "@/lib/db";
import { contactMessages } from "@/lib/db/schema";
import { requireAdmin } from "@/lib/admin";
import { SITE } from "@/lib/site";
import { CONTACT_TOPICS } from "@/content/contact";
import { AdminTitle, Tag, UserLink, ago, fmtDate, fmtInt } from "../_ui";
import { SubmitButton } from "../_client";
import { setMessageStatus } from "../actions";

export const dynamic = "force-dynamic";

function topicLabel(value: string): string {
  return CONTACT_TOPICS.find((t) => t.value === value)?.label ?? value;
}

function replyHref(email: string, name: string | null): string {
  const subject = `Re: your message to ${SITE.name}`;
  const greeting = name ? `Hi ${name.split(/\s+/)[0]},` : "Hi,";
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${greeting}\n\n`)}`;
}

export default async function MessagesPage() {
  await requireAdmin();
  const rows = await db.select().from(contactMessages).orderBy(desc(contactMessages.createdAt)).limit(200);
  const unanswered = rows.filter((m) => m.status === "new").length;

  return (
    <div className="space-y-5">
      <AdminTitle
        title="Messages"
        count={unanswered}
        lede={`Contact-form submissions. Each one was also mailed to the owner inbox. Reply from your mail client, then mark it replied here. ${SITE.replyTime}`}
      />
      <ul className="space-y-3">
        {rows.length === 0 ? <li className="pane-inset px-5 py-8 text-center text-[0.95rem] text-ink-3">No messages yet.</li> : null}
        {rows.map((m) => (
          <li key={m.id} className={`pane p-5 ${m.status === "archived" ? "opacity-60" : ""}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-[0.82rem] text-ink-4">
                  <Tag tone={m.status === "new" ? "accent" : m.status === "replied" ? "ok" : "neutral"}>{m.status}</Tag>
                  <Tag>{topicLabel(m.topic)}</Tag>
                  <span title={fmtDate(m.createdAt)}>{ago(m.createdAt)}</span>
                  <span>· {m.notified ? "owner emailed" : "owner email failed"}</span>
                </p>
                <p className="mt-2 break-words font-semibold text-ink">
                  {m.name ? `${m.name} · ` : ""}
                  <a className="text-accent-text underline-offset-2 hover:underline" href={replyHref(m.email, m.name)}>
                    {m.email}
                  </a>
                  {m.userId ? (
                    <span className="ml-2 font-normal text-ink-4">
                      signed in as <UserLink id={m.userId} email={null} />
                    </span>
                  ) : null}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-[0.95rem] leading-relaxed text-ink-2">{m.message}</p>
                {m.userAgent ? <p className="mt-2 break-all text-[0.72rem] text-ink-4">{m.userAgent}</p> : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col">
                {m.status !== "replied" ? (
                  <form action={setMessageStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="replied" />
                    <SubmitButton className="btn btn-primary btn-sm" pendingLabel="Saving…">
                      Mark replied
                    </SubmitButton>
                  </form>
                ) : null}
                {m.status !== "archived" ? (
                  <form action={setMessageStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="archived" />
                    <SubmitButton pendingLabel="Saving…">Archive</SubmitButton>
                  </form>
                ) : (
                  <form action={setMessageStatus}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="status" value="new" />
                    <SubmitButton className="btn btn-quiet btn-sm" pendingLabel="Saving…">
                      Reopen
                    </SubmitButton>
                  </form>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
      {rows.length === 200 ? <p className="text-[0.85rem] text-ink-4">Showing the newest 200 of {fmtInt(rows.length)}+ messages.</p> : null}
    </div>
  );
}
