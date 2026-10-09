"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { CONTACT_TOPICS, CONTACT_TOPIC_VALUES, type ContactTopic } from "@/content/contact";
import { SITE } from "@/lib/site";
import { track } from "./Consent";

type State = { status: "idle" } | { status: "sending" } | { status: "sent"; email: string } | { status: "error"; message: string };

function isTopic(v: string | null): v is ContactTopic {
  return v !== null && (CONTACT_TOPIC_VALUES as readonly string[]).includes(v);
}

/**
 * Posts to /api/contact; the topic list is shared with the API so both validate the same
 * values. A failed job page links here with `?topic=video&ref=<job ref>`, which preselects
 * the topic and starts the message with the reference support will ask for. Reads the query
 * string on the client, so the page wraps it in Suspense.
 */
export function ContactForm({ defaultTopic = "video" }: { defaultTopic?: ContactTopic }) {
  const params = useSearchParams();
  const topicParam = params.get("topic");
  const ref = (params.get("ref") ?? "").replace(/[^A-Za-z0-9]/g, "").slice(0, 12).toUpperCase();
  const topic: ContactTopic = isTopic(topicParam) ? topicParam : defaultTopic;
  const [state, setState] = useState<State>({ status: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.status === "sending") return;
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    setState({ status: "sending" }); // instant feedback, before the network
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setState({
          status: "error",
          message: body.error ?? (res.status === 429 ? "That is a lot of messages in a row. Please wait a few minutes and try again." : "Something went wrong. Please try again."),
        });
        return;
      }
      track("contact_submit", { topic: data.topic });
      setState({ status: "sent", email: data.email });
      form.reset();
    } catch {
      setState({ status: "error", message: `We couldn’t reach the server. Check your connection, or email ${SITE.email} directly.` });
    }
  }

  if (state.status === "sent") {
    return (
      <div className="pane animate-rise p-7 sm:p-9" role="status">
        <p className="tag tag-ok">Message received</p>
        <p className="headline mt-4 text-[1.6rem] text-ink">Thanks, it is in our inbox.</p>
        <p className="mt-2 text-[1rem] leading-relaxed text-ink-3">
          We reply to <strong className="text-ink">{state.email}</strong> within two business days. For billing questions, writing from the
          email you sign in with lets us find your account and your Stripe receipts straight away.
        </p>
        <button type="button" className="btn btn-ghost btn-sm mt-6" onClick={() => setState({ status: "idle" })}>
          Send another message
        </button>
      </div>
    );
  }

  const sending = state.status === "sending";
  return (
    <form onSubmit={onSubmit} className="pane p-6 sm:p-9">
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="field-label">
            Name <span className="font-normal text-ink-4">(optional)</span>
          </label>
          <input id="c-name" name="name" autoComplete="name" maxLength={120} className="input" placeholder="Your name or shop name" />
        </div>
        <div>
          <label htmlFor="c-email" className="field-label">
            Email
          </label>
          <input id="c-email" name="email" type="email" required autoComplete="email" maxLength={254} className="input" placeholder="you@example.com" />
        </div>
      </div>
      <div className="mt-5">
        <label htmlFor="c-topic" className="field-label">
          Topic
        </label>
        <select id="c-topic" name="topic" className="select" defaultValue={topic}>
          {CONTACT_TOPICS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>
      <div className="mt-5">
        <label htmlFor="c-message" className="field-label">
          Message
        </label>
        <textarea
          id="c-message"
          name="message"
          required
          minLength={10}
          maxLength={5000}
          className="input"
          defaultValue={ref ? `Video ref ${ref}: ` : undefined}
          placeholder="What happened, or what you need. For a video problem, the reference shown on the video's page helps."
        />
      </div>
      {/* honeypot: real people never see or fill this */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      {state.status === "error" ? (
        <p role="alert" className="mt-5 rounded-2xl bg-bad-soft px-4 py-3 text-[0.95rem] text-bad">
          {state.message}
        </p>
      ) : null}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[0.85rem] leading-snug text-ink-4">
          {SITE.replyTime} Messages are stored as described in the{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-ink-2">
            privacy policy
          </Link>
          .
        </p>
        <button type="submit" className="btn btn-primary btn-lg shrink-0" aria-disabled={sending} disabled={sending}>
          {sending ? (
            <>
              <span className="spinner" aria-hidden /> Sending…
            </>
          ) : (
            "Send message"
          )}
        </button>
      </div>
    </form>
  );
}
