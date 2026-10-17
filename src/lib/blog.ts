import "server-only";
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import GithubSlugger from "github-slugger";
import { CATEGORIES, categoryBySlug } from "@/content/categories";

/*
 * Publishing pipeline: an article is one file, content/blog/<category>/<slug>.mdx (or .md),
 * with frontmatter (title, description, publishedAt, updatedAt, keywords[], featured?,
 * draft?, image?, faq?). Commit + push → Vercel builds → the article, its category hub,
 * the sitemap and llms.txt all update; scripts/indexnow.mjs pings search engines.
 * Drafts (draft: true) and future-dated posts never render publicly; the owner can
 * preview them at /admin/preview/<category>/<slug>.
 */

export interface PostImage {
  src: string;
  alt: string;
  credit?: string;
  creditUrl?: string;
  width?: number;
  height?: number;
}

export interface PostFaq {
  q: string;
  a: string;
}

export interface PostHeading {
  id: string;
  text: string;
}

export interface Post {
  slug: string;
  category: string;
  title: string;
  description: string;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  updatedAt: string;
  keywords: string[];
  featured: boolean;
  draft: boolean;
  faq: PostFaq[];
  /** Cover image (shown above the body on article pages without a tool; the share image everywhere). */
  image: PostImage | null;
  /** In-body photos, rendered by `<Figure n={1} />` (1-based) in the MDX. */
  images: PostImage[];
  /** Tool-first page: id of the interactive tool (content/tools/<id>.json) shown above the article. */
  tool: string | null;
  /** Page level from the keyword plan: A = tool-first (short body), B = article. Read by scripts/ops/seo-qa.mjs only. */
  level: "A" | "B";
  body: string;
  format: "md" | "mdx";
  wordCount: number;
  readingMinutes: number;
  headings: PostHeading[];
}

/** Articles per hub page. */
export const PAGE_SIZE = 10;

/** Average reading speed used for "n min read". */
const WORDS_PER_MINUTE = 230;

const ROOT = path.join(process.cwd(), "content", "blog");
let cache: Post[] | null = null;

function toIsoDate(v: unknown, fallback: string): string {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  return fallback;
}

function toImage(v: unknown): PostImage | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.src !== "string" || !o.src) return null;
  return {
    src: o.src,
    alt: typeof o.alt === "string" ? o.alt : "",
    ...(typeof o.credit === "string" ? { credit: o.credit } : {}),
    ...(typeof o.creditUrl === "string" ? { creditUrl: o.creditUrl } : {}),
    ...(typeof o.width === "number" ? { width: o.width } : {}),
    ...(typeof o.height === "number" ? { height: o.height } : {}),
  };
}

function toFaq(v: unknown): PostFaq[] {
  if (!Array.isArray(v)) return [];
  const out: PostFaq[] = [];
  for (const item of v) {
    if (!item || typeof item !== "object") continue;
    const { q, a } = item as Record<string, unknown>;
    if (typeof q === "string" && typeof a === "string" && q.trim() && a.trim()) out.push({ q: q.trim(), a: a.trim() });
  }
  return out;
}

/** H2 headings (outside code fences) with GitHub-style ids: the same ids rehype-slug assigns. */
export function extractHeadings(body: string): PostHeading[] {
  const slugger = new GithubSlugger();
  const out: PostHeading[] = [];
  let inFence = false;
  for (const raw of body.split("\n")) {
    const line = raw.trimEnd();
    if (/^(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) continue;
    const m = /^##\s+(.+?)\s*#*$/.exec(line);
    if (m) {
      const text = m[1].replace(/[*_`]/g, "").trim();
      out.push({ id: slugger.slug(text), text });
    }
  }
  return out;
}

/**
 * Words the reader actually sees: JSX tags, their attribute payloads, import/export lines,
 * fenced code and markdown punctuation are stripped first, then whitespace-separated tokens
 * with at least one letter or digit are counted.
 */
export function countWords(body: string): number {
  const text = body
    .replace(/^(import|export)\s[^\n]*$/gm, " ")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[A-Za-z][^>]*?\/>/g, " ")
    .replace(/<\/?[A-Za-z][^>]*>/g, " ")
    .replace(/\{[^{}]*\}/g, " ")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]/g, " ");
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** One article file → Post (exported for tests; the loader calls it per file). */
export function parsePost(category: string, slug: string, format: "md" | "mdx", raw: string): Post {
  const { data, content } = matter(raw);
  const published = toIsoDate(data.publishedAt, "2099-01-01");
  const words = countWords(content);
  const images = Array.isArray(data.images) ? data.images.map(toImage).filter((i): i is PostImage => i !== null) : [];
  return {
    slug,
    category,
    title: typeof data.title === "string" && data.title.trim() ? data.title.trim() : slug,
    description: typeof data.description === "string" ? data.description.trim() : "",
    publishedAt: published,
    updatedAt: toIsoDate(data.updatedAt, published),
    keywords: Array.isArray(data.keywords) ? data.keywords.map((k: unknown) => String(k).trim()).filter(Boolean) : [],
    featured: data.featured === true,
    draft: data.draft === true,
    faq: toFaq(data.faq),
    image: toImage(data.image),
    images,
    tool: typeof data.tool === "string" && data.tool.trim() ? data.tool.trim() : null,
    level: data.level === "A" ? "A" : "B",
    body: content,
    format,
    wordCount: words,
    readingMinutes: Math.max(1, Math.round(words / WORDS_PER_MINUTE)),
    headings: extractHeadings(content),
  };
}

function load(): Post[] {
  if (cache) return cache;
  const posts: Post[] = [];
  if (fs.existsSync(ROOT)) {
    for (const cat of fs.readdirSync(ROOT, { withFileTypes: true })) {
      if (!cat.isDirectory() || !categoryBySlug(cat.name)) continue;
      const dir = path.join(ROOT, cat.name);
      for (const f of fs.readdirSync(dir)) {
        // Only <slug>.md|mdx with a URL-safe slug; anything else (drafts named _x, notes) is ignored.
        const m = /^([a-z0-9][a-z0-9-]*)\.(mdx?)$/.exec(f);
        if (!m) continue;
        const raw = fs.readFileSync(path.join(dir, f), "utf8");
        posts.push(parsePost(cat.name, m[1], m[2] === "md" ? "md" : "mdx", raw));
      }
    }
  }
  posts.sort((a, b) => (a.publishedAt === b.publishedAt ? a.slug.localeCompare(b.slug) : a.publishedAt < b.publishedAt ? 1 : -1));
  // The content folder is read once per process: at build for static pages, per cold start for dynamic ones.
  cache = posts;
  return posts;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Public = not a draft and not dated in the future. */
export function isLive(p: Pick<Post, "draft" | "publishedAt">, now: string = today()): boolean {
  return !p.draft && p.publishedAt <= now;
}

/** Public articles, newest first. */
export function publishedPosts(): Post[] {
  return load().filter((p) => isLive(p));
}

/** Everything in the folder, including drafts and scheduled posts (admin preview only). */
export function allPostsIncludingDrafts(): Post[] {
  return load();
}

export function postsInCategory(category: string): Post[] {
  return publishedPosts().filter((p) => p.category === category);
}

export function getPost(category: string, slug: string, opts: { includeDrafts?: boolean } = {}): Post | null {
  const p = load().find((x) => x.category === category && x.slug === slug);
  if (!p) return null;
  if (!opts.includeDrafts && !isLive(p)) return null;
  return p;
}

export function postUrl(post: Pick<Post, "category" | "slug">): string {
  return `/blog/${post.category}/${post.slug}`;
}

/**
 * tool id → URL of the public page that hosts it, for `<ToolLink id="…">` in article bodies.
 * Drafts and scheduled pages are included only when `includeDrafts` is set (admin preview).
 */
export function toolRoutes(opts: { includeDrafts?: boolean } = {}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const p of opts.includeDrafts ? load() : publishedPosts()) {
    if (p.tool && !(p.tool in out)) out[p.tool] = postUrl(p);
  }
  return out;
}

/** Number of hub pages a category needs (at least 1, so the hub itself always exists). */
export function hubPageCount(category: string): number {
  return Math.max(1, Math.ceil(postsInCategory(category).length / PAGE_SIZE));
}

/** Same category first, then shared keywords; never the post itself. */
export function relatedPosts(post: Pick<Post, "category" | "slug" | "keywords">, n = 3): Post[] {
  const kw = new Set(post.keywords.map((k) => k.toLowerCase()));
  return publishedPosts()
    .filter((p) => !(p.category === post.category && p.slug === post.slug))
    .map((p) => {
      let score = p.category === post.category ? 3 : 0;
      for (const k of p.keywords) if (kw.has(k.toLowerCase())) score += 2;
      return { p, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.p);
}

export function categoriesWithCounts() {
  const live = publishedPosts();
  return CATEGORIES.map((c) => ({ ...c, count: live.filter((p) => p.category === c.slug).length }));
}

export interface AutolinkTerm {
  phrase: string;
  href: string;
}

/** Evergreen phrases that always point at a product page (hubs are added only once they have articles). */
const SITE_TERMS: AutolinkTerm[] = [
  { phrase: "presenter catalog", href: "/presenters" },
  { phrase: "fictional presenters", href: "/presenters" },
  { phrase: "free trial", href: "/pricing" },
  { phrase: "credit packs", href: "/pricing" },
  { phrase: "compliance check", href: "/how-it-works" },
  { phrase: "how WindowMuse works", href: "/how-it-works" },
];

/** Phrases the article renderer turns into internal links (first occurrence only, see src/lib/autolink.ts). */
export function autolinkTerms(): AutolinkTerm[] {
  const terms: AutolinkTerm[] = [];
  for (const p of publishedPosts()) {
    for (const k of p.keywords.slice(0, 3)) {
      if (k.length >= 8) terms.push({ phrase: k, href: postUrl(p) });
    }
  }
  for (const c of categoriesWithCounts()) {
    if (c.count > 0) terms.push({ phrase: c.name, href: `/blog/${c.slug}` });
  }
  terms.push(...SITE_TERMS);
  return terms;
}
