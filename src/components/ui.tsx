import Link from "next/link";
import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";
import type { Faq } from "@/content/faq";
import { breadcrumbLd } from "@/lib/seo";
import { JsonLd } from "./JsonLd";
import { LogoMark } from "./Logo";

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1120px] px-3 sm:px-5 ${className}`}>{children}</div>;
}

export function Section({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`scroll-mt-24 pt-20 sm:pt-28 ${className}`}>
      <Container>{children}</Container>
    </section>
  );
}

/** Section heading: lives in the field, deliberately quiet, so the panes below carry the weight. */
export function SectionHead({
  eyebrow,
  title,
  lede,
  align = "left",
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
}) {
  return (
    <div className={`mb-8 sm:mb-10 ${align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl"}`}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2 className="headline mt-3 text-[1.9rem] text-ink sm:text-[2.4rem]">{title}</h2>
      {lede ? <p className="mt-3 text-[1.04rem] leading-relaxed text-ink-3">{lede}</p> : null}
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Container className="pt-12 sm:pt-20">
      <div className="max-w-3xl">
        {eyebrow ? <p className="eyebrow eyebrow-accent">{eyebrow}</p> : null}
        <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">{title}</h1>
        {lede ? <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">{lede}</p> : null}
        {children}
      </div>
    </Container>
  );
}

export type Crumb = { name: string; path: string };

export function Breadcrumbs({ items, compact = false }: { items: Crumb[]; compact?: boolean }) {
  return (
    <>
      <nav aria-label="Breadcrumb" className="text-[0.85rem] text-ink-4">
        <ol className="flex flex-wrap items-center gap-1.5">
          {items.map((it, i) => (
            <li key={it.path} className={`items-center gap-1.5 ${compact && i === items.length - 1 ? "hidden sm:flex" : "flex"}`}>
              {i > 0 ? <span aria-hidden>/</span> : null}
              {i < items.length - 1 ? (
                <Link href={it.path} className="hover:text-ink-2">
                  {it.name}
                </Link>
              ) : (
                <span aria-current="page" className="text-ink-3">
                  {it.name}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(items)} />
    </>
  );
}

export function FaqList({ faqs }: { faqs: Pick<Faq, "q" | "a">[] }) {
  return (
    <div className="pane divide-y divide-[var(--line)] px-2 sm:px-3">
      {faqs.map((f) => (
        <details key={f.q} className="group px-3 py-1 sm:px-4">
          <summary className="flex min-h-[64px] cursor-pointer list-none items-center justify-between gap-4 py-3 text-left text-[1.04rem] font-semibold text-ink [&::-webkit-details-marker]:hidden">
            {f.q}
            <span
              aria-hidden
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-pane-2 text-ink-3 transition-transform duration-200 group-open:rotate-45"
            >
              +
            </span>
          </summary>
          <p className="pb-5 pr-10 text-[0.99rem] leading-relaxed text-ink-3">{f.a}</p>
        </details>
      ))}
    </div>
  );
}

type PaneProps<T extends ElementType> = {
  as?: T;
  children: ReactNode;
  className?: string;
  /** Lift on hover, press on :active (for clickable cards). */
  hover?: boolean;
  /** Nested 20px pane. */
  inset?: boolean;
  /** Always-dark pane. */
  ink?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "children" | "className">;

/** The floating module. Renders a <div> unless `as` says otherwise; every other prop passes through. */
export function Pane<T extends ElementType = "div">({ as, children, className = "", hover = false, inset = false, ink = false, ...rest }: PaneProps<T>) {
  const Tag = (as ?? "div") as ElementType;
  const base = ink ? "pane-ink" : inset ? "pane-inset" : "pane";
  return (
    <Tag className={`${base} ${hover ? "pane-hover" : ""} ${className}`.trim()} {...rest}>
      {children}
    </Tag>
  );
}

/** Loading placeholder: `lines` shimmering bars of decreasing width. */
export function SkeletonLines({ lines = 3, className = "", widths }: { lines?: number; className?: string; widths?: string[] }) {
  const fallback = ["100%", "92%", "76%", "84%", "60%", "88%"];
  return (
    <div className={`space-y-2.5 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="skeleton h-4" style={{ width: widths?.[i] ?? fallback[i % fallback.length] }} />
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
  className = "",
}: {
  title: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`pane-inset px-6 py-10 text-center sm:px-10 sm:py-12 ${className}`}>
      <div className="mx-auto w-fit text-ink-4">{icon ?? <LogoMark size={40} mono />}</div>
      <p className="headline mt-4 text-[1.35rem] text-ink">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-md text-[0.98rem] leading-relaxed text-ink-3">{body}</p> : null}
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** One number with a label (credits, videos, plan). Numerals set in Geist with tabular figures. */
export function StatPane({
  label,
  value,
  hint,
  tone = "default",
  className = "",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "accent" | "muse";
  className?: string;
}) {
  const valueColor = tone === "accent" ? "text-accent-text" : tone === "muse" ? "text-muse" : "text-ink";
  return (
    <div className={`pane min-w-0 px-5 py-5 sm:px-6 ${className}`}>
      <p className="eyebrow">{label}</p>
      <p className={`mt-2 text-[2rem] font-semibold leading-none tabular-nums tracking-[-0.02em] ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-2 text-[0.86rem] leading-snug text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** The dark pane with the primary call to action; the last thing on most public pages. */
export function CtaPane({
  eyebrow = "Early access",
  title,
  body,
  primaryLabel = "Start free: 2 videos",
  primaryHref = "/sign-in",
  secondaryLabel = "See how it works",
  secondaryHref = "/how-it-works",
  footnote = "2 free videos at 480p, no card needed. Presenters are fictional and every export reminds you to label the video on TikTok.",
}: {
  eyebrow?: string;
  title?: ReactNode;
  body?: ReactNode;
  primaryLabel?: string;
  primaryHref?: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  footnote?: ReactNode;
}) {
  return (
    <div className="pane-ink overflow-hidden px-6 py-12 text-center sm:px-12 sm:py-16">
      <div className="mx-auto w-fit">
        <LogoMark size={36} tone="light" />
      </div>
      <p className="mt-4 font-sans text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#FF9A78]">{eyebrow}</p>
      <h2 className="display mx-auto mt-4 max-w-2xl text-[2.1rem] text-[#F3EEE6] sm:text-[3rem]">
        {title ?? (
          <>
            Your shop window, <em className="!text-[#B7ADFF]">with a voice.</em>
          </>
        )}
      </h2>
      <p className="mx-auto mt-4 max-w-xl text-[1.04rem] leading-relaxed text-[#CFC6BB]">
        {body ?? "Upload your product photos, pick a presenter, approve the script. A vertical video ready for TikTok Shop, in minutes."}
      </p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link href={primaryHref} prefetch={false} className="btn btn-primary btn-lg">
          {primaryLabel}
        </Link>
        <Link href={secondaryHref} className="btn btn-lg !bg-white/10 !text-[#F3EEE6] hover:!bg-white/15">
          {secondaryLabel}
        </Link>
      </div>
      {footnote ? <p className="mx-auto mt-6 max-w-lg text-[0.82rem] leading-relaxed text-[#A89E92]">{footnote}</p> : null}
    </div>
  );
}
