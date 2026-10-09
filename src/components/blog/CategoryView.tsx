import Link from "next/link";
import { Breadcrumbs, Container, CtaPane, EmptyState, Section } from "@/components/ui";
import { JsonLd } from "@/components/JsonLd";
import { CATEGORIES, type Category } from "@/content/categories";
import { PAGE_SIZE, categoriesWithCounts, postUrl, type Post } from "@/lib/blog";
import { absoluteUrl } from "@/lib/seo";
import { formatDate } from "./ArticleView";

export function PostCard({ post, showCategory = false }: { post: Post; showCategory?: boolean }) {
  const cat = showCategory ? CATEGORIES.find((c) => c.slug === post.category) : null;
  return (
    <Link href={postUrl(post)} className="pane pane-hover flex min-w-0 flex-col p-6 sm:p-7">
      {cat ? <span className="text-[0.78rem] font-semibold text-accent-text">{cat.name}</span> : null}
      <span className={`headline block text-[1.3rem] text-ink ${cat ? "mt-2" : ""}`}>{post.title}</span>
      <span className="mt-3 block text-[0.96rem] leading-relaxed text-ink-3">{post.description}</span>
      <span className="mt-auto block pt-5 text-[0.82rem] text-ink-4">
        {post.readingMinutes} min read · <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
      </span>
    </Link>
  );
}

/** One category hub page (page 1 at /blog/<category>, later pages at /blog/<category>/page/<n>). */
export function CategoryView({ cat, posts, page }: { cat: Category; posts: Post[]; page: number }) {
  const totalPages = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  const slice = posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const base = `/blog/${cat.slug}`;
  const pageHref = (n: number) => (n === 1 ? base : `${base}/page/${n}`);
  // Only hubs that have articles are linked: empty hubs are noindex and stay out of the link graph.
  const others = categoriesWithCounts().filter((c) => c.slug !== cat.slug && c.count > 0);

  return (
    <>
      {slice.length ? (
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: cat.title,
            description: cat.description,
            url: absoluteUrl(pageHref(page)),
            inLanguage: "en",
            mainEntity: {
              "@type": "ItemList",
              itemListElement: slice.map((p, i) => ({
                "@type": "ListItem",
                position: (page - 1) * PAGE_SIZE + i + 1,
                url: absoluteUrl(postUrl(p)),
                name: p.title,
              })),
            },
          }}
        />
      ) : null}
      <Container className="pt-8 sm:pt-12">
        <Breadcrumbs
          items={[
            { name: "Blog", path: "/blog" },
            { name: cat.name, path: base },
            ...(page > 1 ? [{ name: `Page ${page}`, path: pageHref(page) }] : []),
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">{cat.name}</p>
          <h1 className="display mt-4 text-[2.2rem] text-ink sm:text-[3.1rem]">{cat.title}</h1>
          <p className="mt-5 text-[1.1rem] leading-relaxed text-ink-3">{cat.intro}</p>
        </div>
      </Container>

      <Section className="!pt-10 sm:!pt-12">
        {slice.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {slice.map((p) => (
              <PostCard key={postUrl(p)} post={p} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Guides for this topic are being written"
            body="New articles appear here as they are published. Until then, the product pages answer the practical questions."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/how-it-works" className="btn btn-ghost btn-sm">
                  How WindowMuse works
                </Link>
                <Link href="/faq" className="btn btn-quiet btn-sm">
                  Read the FAQ
                </Link>
              </div>
            }
          />
        )}

        {totalPages > 1 ? (
          <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-2">
            {page > 1 ? (
              <Link href={pageHref(page - 1)} className="btn btn-ghost btn-sm" rel="prev">
                ← Newer
              </Link>
            ) : null}
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
              <Link
                key={n}
                href={pageHref(n)}
                aria-current={n === page ? "page" : undefined}
                className={`grid h-10 w-10 place-items-center rounded-full text-[0.92rem] font-semibold tabular-nums ${
                  n === page ? "bg-ink text-void" : "bg-pane-2 text-ink-3 hover:text-ink"
                }`}
              >
                {n}
              </Link>
            ))}
            {page < totalPages ? (
              <Link href={pageHref(page + 1)} className="btn btn-ghost btn-sm" rel="next">
                Older →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Section>

      {others.length ? (
        <Section className="!pt-14">
          <p className="eyebrow">Other topics</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {others.map((c) => (
              <li key={c.slug}>
                <Link href={`/blog/${c.slug}`} className="chip">
                  {c.name}
                  <span className="tag">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section className="pb-20 sm:pb-28">
        <CtaPane />
      </Section>
    </>
  );
}
