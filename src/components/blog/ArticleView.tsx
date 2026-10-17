import Link from "next/link";
import Image from "next/image";
import { Breadcrumbs, Container, CtaPane, FaqList } from "@/components/ui";
import { JsonLd } from "@/components/JsonLd";
import { LogoMark } from "@/components/Logo";
import { articleComponents } from "@/components/blog/Blocks";
import { ToolCtaStrip } from "@/components/tools/ToolCta";
import { ToolRunner } from "@/components/tools/ToolRunner";
import { categoryBySlug } from "@/content/categories";
import { getTool } from "@/content/tools";
import { autolinkTerms, postUrl, relatedPosts, toolRoutes, type Post, type PostHeading } from "@/lib/blog";
import { renderMdx } from "@/lib/mdx";
import { absoluteUrl, articleLd, faqLd, webApplicationLd } from "@/lib/seo";
import { SITE } from "@/lib/site";

export function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function Toc({ headings, className = "" }: { headings: PostHeading[]; className?: string }) {
  return (
    <nav aria-label="On this page" className={className}>
      <p className="eyebrow">On this page</p>
      <ol className="mt-3 space-y-1 text-[0.92rem]">
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} className="block rounded-lg px-2 py-1 text-ink-3 hover:bg-pane-2 hover:text-ink">
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Meta({ post }: { post: Post }) {
  return (
    <p className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[0.86rem] text-ink-4">
      <span>
        By{" "}
        <Link href="/about" className="text-ink-3 hover:text-ink">
          {SITE.name}
        </Link>
      </span>
      <span>
        Published <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
      </span>
      {post.updatedAt !== post.publishedAt ? (
        <span>
          Updated <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
        </span>
      ) : null}
      <span>{post.readingMinutes} min read</span>
    </p>
  );
}

/**
 * The article template: breadcrumbs, header with visible dates, optional cover, table of
 * contents (inline on phones, sticky on desktop), the MDX body in one pane, FAQ, the studio
 * call to action and related guides. Article + FAQPage JSON-LD only on public renders.
 *
 * Tool-first pages (frontmatter `tool: <id>`): the interactive tool sits in its own pane
 * right under the title, followed by the studio strip, then the article; the cover image is
 * skipped (use `<Figure n={1} />` in the body) and WebApplication JSON-LD is added.
 */
export async function ArticleView({ post, preview = false }: { post: Post; preview?: boolean }) {
  const cat = categoryBySlug(post.category);
  const url = postUrl(post);
  const tool = getTool(post.tool);
  if (post.tool && !tool) throw new Error(`${url}: frontmatter names tool "${post.tool}" but content/tools/${post.tool}.json does not exist`);
  const body = await renderMdx(post.body, {
    format: post.format,
    components: articleComponents({ images: post.images, toolRoutes: toolRoutes({ includeDrafts: preview }) }),
    autolink: autolinkTerms(),
    self: url,
  });
  const related = relatedPosts(post, 3);
  const showToc = post.headings.length >= 3;
  const ld = [
    articleLd(post, url),
    ...(tool ? [webApplicationLd({ name: tool.schemaName ?? tool.title, description: tool.lede, url })] : []),
    ...(post.faq.length ? [faqLd(post.faq)] : []),
  ];

  return (
    <>
      {!preview ? <JsonLd data={ld} /> : null}
      <Container className="pt-8 sm:pt-12">
        {preview ? (
          <p className="mb-4 flex flex-wrap items-center gap-2 text-[0.86rem] text-ink-3">
            <span className="tag tag-accent">Preview</span>
            <span>{post.draft ? "Draft: never public until draft is removed from the frontmatter." : `Scheduled: goes public on ${formatDate(post.publishedAt)}.`}</span>
          </p>
        ) : null}
        <Breadcrumbs
          compact={Boolean(tool)}
          items={[
            { name: "Blog", path: "/blog" },
            ...(cat ? [{ name: cat.name, path: `/blog/${cat.slug}` }] : []),
            { name: post.title, path: url },
          ]}
        />
        <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px]">
          <article className="min-w-0">
            <header className="max-w-3xl">
              {cat ? (
                <Link href={`/blog/${cat.slug}`} className="eyebrow eyebrow-accent hover:underline">
                  {cat.name}
                </Link>
              ) : null}
              <h1 className={`display mt-4 text-ink ${tool ? "text-[2rem] sm:text-[2.7rem]" : "text-[2.2rem] sm:text-[3.1rem]"}`}>{post.title}</h1>
              {post.description ? <p className="dek mt-4 text-[1.18rem] leading-snug">{post.description}</p> : null}
              <Meta post={post} />
            </header>

            {tool ? (
              <>
                <div className="pane mt-8 px-5 py-6 sm:px-8 sm:py-8">
                  <ToolRunner tool={tool} pageUrl={absoluteUrl(url)} />
                </div>
                <div className="mt-6">
                  <ToolCtaStrip tool={tool} />
                </div>
              </>
            ) : post.image ? (
              <figure className="pane mt-8 overflow-hidden p-2">
                <Image
                  src={post.image.src}
                  alt={post.image.alt}
                  width={post.image.width ?? 1600}
                  height={post.image.height ?? 1000}
                  priority
                  sizes="(max-width: 1024px) 100vw, 780px"
                  className="h-auto w-full rounded-[22px]"
                />
                {post.image.credit ? (
                  <figcaption className="px-3 pb-1 pt-2 text-[0.78rem] text-ink-4">
                    Photo:{" "}
                    {post.image.creditUrl ? (
                      <a href={post.image.creditUrl} rel="nofollow noopener" target="_blank" className="underline">
                        {post.image.credit}
                      </a>
                    ) : (
                      post.image.credit
                    )}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}

            {showToc ? <Toc headings={post.headings} className="pane-inset mt-8 p-5 lg:hidden" /> : null}

            <div className="pane mt-8 px-5 py-8 sm:px-10 sm:py-12">
              <div className="prose-wm">{body}</div>
            </div>

            {post.faq.length ? (
              <section className="mt-10" aria-labelledby="faq">
                <h2 id="faq" className="headline mb-5 text-[1.7rem] text-ink">
                  Questions sellers ask
                </h2>
                <FaqList faqs={post.faq} />
              </section>
            ) : null}

            <div className="mt-10">
              <CtaPane />
            </div>

            {related.length ? (
              <section className="mt-10" aria-labelledby="related">
                <h2 id="related" className="eyebrow">
                  Keep reading
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {related.map((r) => (
                    <Link key={postUrl(r)} href={postUrl(r)} className="pane pane-hover flex min-w-0 flex-col p-5">
                      <span className="text-[0.78rem] font-semibold text-accent-text">{categoryBySlug(r.category)?.name}</span>
                      <span className="mt-2 block text-[1.02rem] font-semibold leading-snug text-ink">{r.title}</span>
                      <span className="mt-auto block pt-3 text-[0.8rem] text-ink-4">{r.readingMinutes} min read</span>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-28 space-y-4">
              {showToc ? <Toc headings={post.headings} className="pane p-5" /> : null}
              <div className="pane p-5">
                <LogoMark size={28} />
                <p className="mt-3 text-[0.98rem] font-semibold text-ink">Make this video for your product</p>
                <p className="mt-1 text-[0.86rem] leading-relaxed text-ink-3">Photos in, a presenter video out. Two free videos at 480p, no card needed.</p>
                <Link href="/sign-in" prefetch={false} className="btn btn-primary btn-sm btn-block mt-4">
                  Start free
                </Link>
                <Link href="/how-it-works" className="btn btn-quiet btn-sm btn-block mt-2">
                  See how it works
                </Link>
              </div>
            </div>
          </aside>
        </div>
      </Container>
    </>
  );
}
