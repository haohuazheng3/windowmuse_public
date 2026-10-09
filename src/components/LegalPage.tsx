import type { ReactNode } from "react";
import { Breadcrumbs, Container } from "./ui";

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Shell for the trust pages (privacy, terms, acceptable use, cookies, refunds): a quiet
 * title in the field, the "last updated" date, a one-paragraph plain-language summary,
 * then the full text inside one pane. Children are written with .prose-ui markup.
 */
export function LegalPage({
  title,
  path,
  updated,
  intro,
  aside,
  children,
}: {
  title: string;
  path: string;
  /** ISO date of the last substantive edit. */
  updated: string;
  /** The short version, in plain language. */
  intro?: ReactNode;
  /** Optional pane shown above the text (for example the list of cookies or the refund summary). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Container className="pt-10 sm:pt-14">
      <Breadcrumbs
        items={[
          { name: "Home", path: "/" },
          { name: title, path },
        ]}
      />
      <div className="mx-auto mt-6 max-w-3xl">
        <h1 className="display text-[2.4rem] text-ink sm:text-[3.2rem]">{title}</h1>
        <p className="mt-3 text-[0.9rem] text-ink-4">
          Last updated <time dateTime={updated}>{formatDate(updated)}</time>
        </p>
        {intro ? <p className="mt-5 text-[1.08rem] leading-relaxed text-ink-3">{intro}</p> : null}
        {aside ? <div className="mt-8">{aside}</div> : null}
        <div className="pane mt-8 px-6 py-8 sm:px-10 sm:py-10">
          <div className="prose-ui">{children}</div>
        </div>
      </div>
    </Container>
  );
}
