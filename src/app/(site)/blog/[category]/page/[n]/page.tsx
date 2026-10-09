import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryView } from "@/components/blog/CategoryView";
import { CATEGORIES, categoryBySlug } from "@/content/categories";
import { PAGE_SIZE, hubPageCount, postsInCategory } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  const out: { category: string; n: string }[] = [];
  for (const c of CATEGORIES) {
    for (let n = 2; n <= hubPageCount(c.slug); n++) out.push({ category: c.slug, n: String(n) });
  }
  // Next needs at least one entry to prerender; the sentinel 404s while every hub fits on one page.
  return out.length ? out : [{ category: CATEGORIES[0].slug, n: "2" }];
}

export async function generateMetadata(props: PageProps<"/blog/[category]/page/[n]">): Promise<Metadata> {
  const { category, n } = await props.params;
  const cat = categoryBySlug(category);
  if (!cat) return {};
  return pageMetadata({ title: `${cat.title} (page ${n})`, description: cat.description, path: `/blog/${cat.slug}/page/${n}` });
}

export default async function CategoryPaged(props: PageProps<"/blog/[category]/page/[n]">) {
  const { category, n } = await props.params;
  const cat = categoryBySlug(category);
  const page = Number(n);
  if (!cat || !Number.isInteger(page) || page < 2) notFound();
  const posts = postsInCategory(cat.slug);
  if ((page - 1) * PAGE_SIZE >= posts.length) notFound();
  return <CategoryView cat={cat} posts={posts} page={page} />;
}
