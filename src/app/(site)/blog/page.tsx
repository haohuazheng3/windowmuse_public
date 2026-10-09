import Link from "next/link";
import type { Metadata } from "next";
import { Breadcrumbs, Container, CtaPane, EmptyState, Section } from "@/components/ui";
import { PostCard } from "@/components/blog/CategoryView";
import { categoriesWithCounts, postUrl, publishedPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

const hasPosts = publishedPosts().length > 0;

export const metadata: Metadata = pageMetadata({
  title: "Blog: TikTok Shop growth, AI presenter video and the rules for both",
  description:
    "Practical guides for TikTok Shop sellers: shoppable videos and affiliates, how AI presenter videos are made and priced, scripts and hooks that fit 15 seconds, and the AI-label and disclosure rules that keep a shop safe.",
  path: "/blog",
  // A hub with nothing in it is thin content: noindex until the first article is live.
  noindex: !hasPosts,
});

/** The blog hub: topic navigation first, then featured and latest articles once they exist. */
export default function BlogHub() {
  const cats = categoriesWithCounts();
  const posts = publishedPosts();
  const featured = posts.filter((p) => p.featured).slice(0, 3);
  const latest = posts.slice(0, 6);

  return (
    <>
      <Container className="pt-8 sm:pt-12">
        <Breadcrumbs
          items={[
            { name: "Home", path: "/" },
            { name: "Blog", path: "/blog" },
          ]}
        />
        <div className="mt-6 max-w-3xl">
          <p className="eyebrow eyebrow-accent">Guides for sellers</p>
          <h1 className="display mt-4 text-[2.5rem] text-ink sm:text-[3.6rem]">
            What works on TikTok Shop, <em>and what the rules say.</em>
          </h1>
          <p className="mt-5 max-w-2xl text-[1.12rem] leading-relaxed text-ink-3">
            Short, specific guides in five topics: growing a shop, making AI presenter videos well, writing product scripts that fit the time a
            vertical video gets, the AI-label and disclosure rules, and working with real creators. Written by WindowMuse, the team building the
            studio.
          </p>
        </div>
      </Container>

      {featured.length ? (
        <Section className="!pt-12 sm:!pt-14">
          <h2 className="eyebrow">Start here</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {featured.map((p) => (
              <PostCard key={postUrl(p)} post={p} showCategory />
            ))}
          </div>
        </Section>
      ) : null}

      <Section className="!pt-12 sm:!pt-14">
        <h2 className="eyebrow">Browse by topic</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cats.map((c) => {
            const inner = (
              <>
                <span className="flex items-center justify-between gap-3">
                  <span className="headline text-[1.2rem] text-ink">{c.name}</span>
                  <span className={`tag ${c.count ? "tag-accent" : ""}`}>{c.count ? `${c.count} guide${c.count === 1 ? "" : "s"}` : "Coming"}</span>
                </span>
                <span className="mt-3 block text-[0.94rem] leading-relaxed text-ink-3">{c.description}</span>
              </>
            );
            // Empty topics stay visible but are not links: their hub pages are noindex and out of the sitemap.
            return c.count ? (
              <Link key={c.slug} href={`/blog/${c.slug}`} className="pane pane-hover flex min-w-0 flex-col p-6">
                {inner}
              </Link>
            ) : (
              <div key={c.slug} className="pane-inset flex min-w-0 flex-col p-6">
                {inner}
              </div>
            );
          })}
        </div>
      </Section>

      <Section className="!pt-12 sm:!pt-14">
        {latest.length ? (
          <>
            <h2 className="eyebrow">Latest</h2>
            <ul className="pane mt-4 divide-y divide-[var(--line)] px-2">
              {latest.map((p) => (
                <li key={postUrl(p)}>
                  <Link
                    href={postUrl(p)}
                    className="flex flex-col gap-1 rounded-2xl px-4 py-4 hover:bg-pane-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <span className="text-[1.02rem] font-semibold leading-snug text-ink">{p.title}</span>
                    <span className="shrink-0 text-[0.85rem] text-ink-4">{cats.find((c) => c.slug === p.category)?.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            title="The first guides are being written"
            body="Articles land here as they are published. The product pages already answer the practical questions: how a video is made, what it costs, and which labels TikTok requires."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/how-it-works" className="btn btn-ghost btn-sm">
                  How it works
                </Link>
                <Link href="/pricing" className="btn btn-quiet btn-sm">
                  Pricing
                </Link>
                <Link href="/faq" className="btn btn-quiet btn-sm">
                  FAQ
                </Link>
              </div>
            }
          />
        )}
      </Section>

      <Section className="pb-20 sm:pb-28">
        <CtaPane />
      </Section>
    </>
  );
}
