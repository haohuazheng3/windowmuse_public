import { ogCard } from "@/lib/og";
import { getPost, publishedPosts } from "@/lib/blog";
import { CATEGORIES, categoryBySlug } from "@/content/categories";
import { SITE } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  const posts = publishedPosts().map((p) => ({ category: p.category, slug: p.slug }));
  return posts.length ? posts : [{ category: CATEGORIES[0].slug, slug: "coming-soon" }];
}

/** Cuts at a word boundary and marks the cut, so the card never ends mid-word. */
function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const cut = head.lastIndexOf(" ");
  return `${(cut > max * 0.6 ? head.slice(0, cut) : head).replace(/[,;:.]+$/, "")}…`;
}

/** Stable per-article share image: /og/post/<category>/<slug> (the brand card with the article's title). */
export async function GET(_req: Request, ctx: RouteContext<"/og/post/[category]/[slug]">) {
  const { category, slug } = await ctx.params;
  const post = getPost(category, slug);
  const title = post?.title ?? SITE.tagline;
  return ogCard({
    eyebrow: categoryBySlug(category)?.name ?? `${SITE.name} blog`,
    title,
    subtitle: post?.description ? shorten(post.description, 120) : undefined,
    // Long titles need the full card width; the phone only fits beside short ones.
    withPhone: title.length <= 48,
  });
}
