import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { CategoryView } from "@/components/blog/CategoryView";
import { CATEGORIES, categoryBySlug } from "@/content/categories";
import { postsInCategory } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";

export const dynamicParams = false;

export function generateStaticParams() {
  return CATEGORIES.map((c) => ({ category: c.slug }));
}

export async function generateMetadata(props: PageProps<"/blog/[category]">): Promise<Metadata> {
  const { category } = await props.params;
  const cat = categoryBySlug(category);
  if (!cat) return {};
  // An empty hub is thin content: keep it out of the index until it has articles.
  return pageMetadata({ title: cat.title, description: cat.description, path: `/blog/${cat.slug}`, noindex: postsInCategory(cat.slug).length === 0 });
}

export default async function CategoryPage(props: PageProps<"/blog/[category]">) {
  const { category } = await props.params;
  const cat = categoryBySlug(category);
  if (!cat) notFound();
  return <CategoryView cat={cat} posts={postsInCategory(cat.slug)} page={1} />;
}
