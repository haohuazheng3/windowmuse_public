import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { LogoMark } from "@/components/Logo";
import type { PostImage } from "@/lib/blog";
import type { MdxComponents } from "@/lib/mdx";

/*
 * The article building blocks available inside content/blog/**.mdx. Every block is a
 * nested pane so an article reads like the rest of the site; all copy inside them comes
 * from the article file, never from here (except the fixed label reminder, which states
 * TikTok's two posting requirements and is deliberately the same on every page).
 */

type Tone = "note" | "tip" | "warn";

const TONE_BAR: Record<Tone, string> = {
  note: "before:bg-muse",
  tip: "before:bg-ok",
  warn: "before:bg-bad",
};

const TONE_LABEL: Record<Tone, string> = {
  note: "Note",
  tip: "Tip",
  warn: "Watch out",
};

/** Aside with a coloured hairline: note (muse), tip (green), warn (red). */
export function Callout({ title, tone = "note", children }: { title?: string; tone?: Tone; children: ReactNode }) {
  return (
    <aside
      className={`pane-inset relative my-7 overflow-hidden px-5 py-4 font-sans sm:px-6 sm:py-5 before:absolute before:inset-y-4 before:left-0 before:w-[3px] before:rounded-r-full ${TONE_BAR[tone]}`}
    >
      <p className="eyebrow">
        {TONE_LABEL[tone]}
        {title ? <span className="font-semibold normal-case tracking-normal text-ink-2">: {title}</span> : null}
      </p>
      <div className="mt-2 text-[0.98rem] leading-relaxed text-ink-2 [&_a]:text-accent-text [&_a]:underline [&_p+p]:mt-2 [&_strong]:text-ink">{children}</div>
    </aside>
  );
}

export interface StepItem {
  title: string;
  text: string;
}

/** Numbered procedure. Each step has a short title and one or two sentences. */
export function Steps({ title, items }: { title?: string; items: StepItem[] }) {
  return (
    <section className="my-7 font-sans" aria-label={title ?? "Steps"}>
      {title ? <h3 className="text-[1.05rem] font-semibold text-ink">{title}</h3> : null}
      <ol className={`list-none space-y-3 pl-0 ${title ? "mt-3" : ""}`}>
        {items.map((it, i) => (
          <li key={it.title} className="pane-inset flex gap-4 px-4 py-4 sm:px-5">
            <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.9rem] font-semibold tabular-nums text-accent-text">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-semibold leading-snug text-ink">{it.title}</p>
              <p className="mt-1 text-[0.96rem] leading-relaxed text-ink-2 [overflow-wrap:anywhere]">{it.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Two columns, weak version beside the better one; `rows` are [left, right] pairs. */
export function Compare({ left, right, rows }: { left: string; right: string; rows: [string, string][] }) {
  return (
    <div className="my-7 overflow-hidden rounded-[20px] font-sans text-[0.94rem] shadow-[inset_0_0_0_1px_var(--line)]">
      <div className="grid grid-cols-2 bg-pane-2">
        <p className="min-w-0 px-3 py-3 font-semibold text-bad sm:px-4">{left}</p>
        <p className="min-w-0 px-3 py-3 font-semibold text-ok sm:px-4">{right}</p>
      </div>
      {rows.map(([a, b]) => (
        <div key={`${a}→${b}`} className="grid grid-cols-2 border-t border-line">
          <p className="min-w-0 px-3 py-3 leading-relaxed text-ink-3 sm:px-4">{a}</p>
          <p className="min-w-0 px-3 py-3 leading-relaxed text-ink-2 sm:px-4">{b}</p>
        </div>
      ))}
    </div>
  );
}

/** Data table; scrolls horizontally on phones instead of widening the page. */
export function Table({ head, rows, caption }: { head: string[]; rows: string[][]; caption?: string }) {
  return (
    <div className="my-7 overflow-x-auto rounded-[20px] shadow-[inset_0_0_0_1px_var(--line)]">
      <table className="w-full min-w-[30rem] font-sans text-[0.93rem]">
        {caption ? <caption className="px-4 pt-3 text-left text-[0.82rem] text-ink-4">{caption}</caption> : null}
        <thead className="bg-pane-2">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-3 text-left font-semibold text-ink">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.join("|")} className="border-t border-line align-top">
              {r.map((c, i) => (
                <td key={`${i}:${c}`} className={`px-4 py-3 ${i === 0 ? "font-semibold text-ink-2" : "text-ink-2"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export interface PointItem {
  lead?: string;
  text: string;
}

/** Bullet list with an optional bold lead-in per point. */
export function Points({ title, items }: { title?: string; items: PointItem[] }) {
  return (
    <div className="my-7 font-sans">
      {title ? <h3 className="text-[1.05rem] font-semibold text-ink">{title}</h3> : null}
      <ul className={`list-none space-y-2.5 pl-0 ${title ? "mt-3" : ""}`}>
        {items.map((it) => (
          <li key={it.text} className="flex gap-3 text-[0.98rem] leading-relaxed text-ink-2">
            <span aria-hidden className="mt-[0.62em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              {it.lead ? <strong className="text-ink">{it.lead} </strong> : null}
              {it.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden width="18" height="18" viewBox="0 0 18 18" className="mt-[0.3em] shrink-0 text-ok">
      <circle cx="9" cy="9" r="8" fill="currentColor" opacity="0.14" />
      <path d="M5.2 9.4l2.4 2.4 5.2-5.4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Static checklist (ticks are decoration, not inputs): things to verify before posting or ordering. */
export function Checklist({ title, items }: { title?: string; items: string[] }) {
  return (
    <section className="pane-inset my-7 px-5 py-4 font-sans sm:px-6 sm:py-5" aria-label={title ?? "Checklist"}>
      {title ? <p className="eyebrow">{title}</p> : null}
      <ul className={`list-none space-y-2 pl-0 ${title ? "mt-3" : ""}`}>
        {items.map((it) => (
          <li key={it} className="flex gap-3 text-[0.96rem] leading-relaxed text-ink-2">
            <CheckIcon />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The speaking budget the studio uses: 2.5 words per second. */
const WORDS_PER_SECOND = 2.5;

function words(s: string): number {
  return s.split(/\s+/).filter(Boolean).length;
}

/**
 * A spoken script laid out the way the studio edits it: hook, body, call to action, with the
 * word count against the length budget so readers see why 15 seconds is at most 38 words.
 */
export function ScriptExample({
  hook,
  body,
  cta,
  seconds = 15,
  language = "English",
  label,
}: {
  hook: string;
  body: string;
  cta: string;
  /** Target length: 10, 15, 20 or 30. */
  seconds?: number;
  language?: string;
  /** Optional caption, e.g. the product or angle the example is for. */
  label?: string;
}) {
  const total = words(hook) + words(body) + words(cta);
  const budget = Math.round(seconds * WORDS_PER_SECOND);
  const fits = total <= budget;
  const rows: [string, string][] = [
    ["Hook", hook],
    ["Body", body],
    ["CTA", cta],
  ];
  return (
    <figure className="pane my-7 overflow-hidden font-sans" aria-label={label ? `Script example: ${label}` : "Script example"}>
      <figcaption className="flex flex-wrap items-center justify-between gap-2 bg-pane-2 px-5 py-3 text-[0.8rem] text-ink-3">
        <span className="font-semibold uppercase tracking-[0.14em]">
          Script{label ? <span className="font-medium normal-case tracking-normal text-ink-3"> · {label}</span> : null}
        </span>
        <span>
          {language} · {seconds} s
        </span>
      </figcaption>
      <dl className="divide-y divide-[var(--line)]">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[4.2rem_minmax(0,1fr)] gap-3 px-5 py-4">
            <dt className="eyebrow pt-1">{k}</dt>
            <dd className="text-[1.02rem] leading-relaxed text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-[0.84rem] text-ink-3">
        <span className="tabular-nums">
          {total} words · budget {budget} at {WORDS_PER_SECOND} words/s
        </span>
        <span className={`tag ${fits ? "tag-ok" : "tag-bad"}`}>{fits ? `Fits ${seconds} s` : `Over by ${total - budget}`}</span>
      </p>
    </figure>
  );
}

/**
 * The AI-label box. Fixed wording, shown identically in articles and on every export page:
 * TikTok requires the AI-generated content label on realistic AI video, and TikTok Shop
 * requires the commercial content disclosure on product videos (see docs/research/tiktok-aigc-policy.md).
 */
export function LabelReminder({ children }: { children?: ReactNode }) {
  return (
    <aside className="pane-inset my-7 px-5 py-5 font-sans sm:px-6" aria-label="Before you post on TikTok">
      <p className="eyebrow eyebrow-accent">Before you post</p>
      <p className="mt-2 text-[0.98rem] leading-relaxed text-ink-2">
        A WindowMuse video is AI-generated. TikTok asks for two switches on every one of them, and both are in the posting screen:
      </p>
      <ol className="mt-3 list-none space-y-2.5 pl-0 text-[0.96rem] leading-relaxed text-ink-2">
        <li className="flex gap-3">
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.82rem] font-semibold text-accent-text">
            1
          </span>
          <span>
            <strong className="text-ink">AI-generated content.</strong> Tap <em>More options</em> and turn on <em>AI-generated content</em>. The post shows
            TikTok&rsquo;s &ldquo;creator labeled as AI-generated&rdquo; tag; the label does not reduce distribution, a missing one can.
          </span>
        </li>
        <li className="flex gap-3">
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent-soft text-[0.82rem] font-semibold text-accent-text">
            2
          </span>
          <span>
            <strong className="text-ink">Commercial content.</strong> Turn on <em>Content disclosure</em> and choose <em>Your brand</em> for your own shop (or
            <em> Paid partnership</em> when another brand pays you). Product demos count as commercial content on TikTok Shop.
          </span>
        </li>
      </ol>
      {children ? <div className="mt-3 text-[0.92rem] leading-relaxed text-ink-3 [&_a]:text-accent-text [&_a]:underline">{children}</div> : null}
    </aside>
  );
}

/** The article's call to action: an always-dark pane that sends the reader to the studio. */
export function StudioCTA({
  title = "Try it on your own product",
  body = "Upload the photos you already have, pick a presenter, approve the script. A vertical video ready for TikTok Shop, in minutes.",
  label = "Start free: 2 videos",
}: {
  title?: string;
  body?: string;
  label?: string;
}) {
  return (
    <aside className="pane-ink my-8 flex flex-col gap-5 px-6 py-7 font-sans sm:flex-row sm:items-center sm:px-8">
      <div className="shrink-0">
        <LogoMark size={40} tone="light" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#FF9A78]">WindowMuse</p>
        <p className="mt-1 text-[1.12rem] font-semibold leading-snug text-[#F3EEE6]">{title}</p>
        <p className="mt-1 text-[0.94rem] leading-relaxed text-[#CFC6BB]">{body}</p>
        <p className="mt-2 text-[0.8rem] text-[#A89E92]">2 free videos at 480p, no card needed. Presenters are fictional.</p>
      </div>
      {/* The article's prose styles colour and underline every <a>; the button opts out. */}
      <Link href="/sign-in" prefetch={false} className="btn btn-primary shrink-0 !text-accent-ink !no-underline">
        {label}
      </Link>
    </aside>
  );
}

/**
 * The answer-first block: the first sentence(s) of a section, set apart so a reader (and a
 * search snippet) gets the answer before the explanation. Use it right under an H2.
 */
export function Answer({ children }: { children: ReactNode }) {
  return (
    <div className="pane-inset relative my-6 overflow-hidden px-5 py-4 font-sans before:absolute before:inset-y-4 before:left-0 before:w-[3px] before:rounded-r-full before:bg-accent sm:px-6">
      <p className="eyebrow eyebrow-accent">In short</p>
      <div className="mt-1.5 text-[1.08rem] font-medium leading-relaxed text-ink [&_a]:text-accent-text [&_a]:underline [&_p+p]:mt-2">{children}</div>
    </div>
  );
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** An inline fact with its source: the sentence stays in the paragraph, the citation follows as a small link. */
export function DataPoint({ source, label, children }: { source: string; label?: string; children: ReactNode }) {
  return (
    <span className="font-medium text-ink">
      {children}
      <a href={source} rel="nofollow noopener" target="_blank" className="ml-1 align-baseline !text-[0.78rem] !font-semibold !text-ink-4 !no-underline hover:!text-accent-text">
        [{label ?? hostOf(source)}]
      </a>
    </span>
  );
}

const PEXELS_WIDTHS = [480, 768, 1080, 1440];

/** A Pexels CDN URL resized by Pexels itself (no Vercel image transformation is spent on it). */
function pexelsAt(src: string, width: number): string {
  const u = new URL(src);
  u.searchParams.set("auto", "compress");
  u.searchParams.set("cs", "tinysrgb");
  u.searchParams.set("w", String(width));
  u.searchParams.delete("h");
  u.searchParams.delete("dpr");
  return u.toString();
}

function isPexels(src: string): boolean {
  try {
    return new URL(src).hostname === "images.pexels.com";
  } catch {
    return false;
  }
}

/** The nth frontmatter image (1-based) as a figure with the Pexels credit line. Unknown n renders nothing. */
function makeFigure(images: PostImage[]) {
  return function Figure({ n = 1, caption }: { n?: number; caption?: string }) {
    const img = images[n - 1];
    if (!img) return null;
    const width = img.width ?? 1600;
    const height = img.height ?? 1067;
    const sizes = "(max-width: 1024px) 100vw, 720px";
    const cls = "h-auto w-full rounded-[20px] bg-pane-2";
    return (
      <figure className="my-8 font-sans">
        {isPexels(img.src) ? (
          // Pexels serves its own resized, compressed variants; a plain responsive <img> avoids paying
          // for Vercel image optimisation on stock photos. Width/height keep the layout from shifting.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pexelsAt(img.src, 1080)}
            srcSet={PEXELS_WIDTHS.map((w) => `${pexelsAt(img.src, w)} ${w}w`).join(", ")}
            sizes={sizes}
            alt={img.alt}
            width={width}
            height={height}
            loading="lazy"
            decoding="async"
            className={cls}
          />
        ) : (
          <Image src={img.src} alt={img.alt} width={width} height={height} sizes={sizes} className={cls} />
        )}
        {caption || img.credit ? (
          <figcaption className="mt-2 px-1 text-[0.82rem] text-ink-4">
            {caption ? <span>{caption} </span> : null}
            {img.credit ? (
              <span>
                Photo by{" "}
                {img.creditUrl ? (
                  <a href={img.creditUrl} rel="nofollow noopener" target="_blank" className="underline hover:text-ink-2">
                    {img.credit}
                  </a>
                ) : (
                  img.credit
                )}{" "}
                on Pexels
              </span>
            ) : null}
          </figcaption>
        ) : null}
      </figure>
    );
  };
}

/** A link to another tool-first page by tool id; renders plain text when no public page hosts that tool yet. */
function makeToolLink(routes: Record<string, string>) {
  return function ToolLink({ id, children }: { id: string; children: ReactNode }) {
    const href = routes[id];
    if (!href) return <span>{children}</span>;
    return <Link href={href}>{children}</Link>;
  };
}

const STATIC_COMPONENTS = {
  Callout,
  Steps,
  Compare,
  Table,
  Points,
  Checklist,
  ScriptExample,
  LabelReminder,
  StudioCTA,
  Answer,
  DataPoint,
} as unknown as MdxComponents;

export const BLOG_COMPONENTS = STATIC_COMPONENTS;

/** The block set for one article: the static blocks plus Figure (bound to its images) and ToolLink (bound to the tool index). */
export function articleComponents(ctx: { images: PostImage[]; toolRoutes: Record<string, string> }): MdxComponents {
  return { ...STATIC_COMPONENTS, Figure: makeFigure(ctx.images), ToolLink: makeToolLink(ctx.toolRoutes) } as unknown as MdxComponents;
}
