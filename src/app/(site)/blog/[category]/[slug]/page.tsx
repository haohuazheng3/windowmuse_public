import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArticleView } from "@/components/blog/ArticleView";
import { CATEGORIES } from "@/content/categories";
import { getPost, postUrl, publishedPosts } from "@/lib/blog";
import { pageMetadata } from "@/lib/seo";
import { SITE } from "@/lib/site";

export const dynamicParams = false;

export function generateStaticParams() {
  const posts = publishedPosts().map((p) => ({ category: p.category, slug: p.slug }));
  // The sentinel keeps the route buildable before the first article exists; it renders the 404.
  return posts.length ? posts : [{ category: CATEGORIES[0].slug, slug: "coming-soon" }];
}

export async function generateMetadata(props: PageProps<"/blog/[category]/[slug]">): Promise<Metadata> {
  const { category, slug } = await props.params;
  const post = getPost(category, slug);
  if (!post) return {};
  const meta = pageMetadata({
    title: post.title,
    description: post.description,
    path: postUrl(post),
    type: "article",
    image: post.image?.src ?? post.images[0]?.src ?? `/og/post/${post.category}/${post.slug}`,
  });
  return {
    ...meta,
    keywords: post.keywords,
    openGraph: { ...meta.openGraph, type: "article", publishedTime: post.publishedAt, modifiedTime: post.updatedAt, authors: [SITE.name] },
  };
}

export default async function ArticlePage(props: PageProps<"/blog/[category]/[slug]">) {
  const { category, slug } = await props.params;
  const post = getPost(category, slug);
  if (!post) notFound();
  return <ArticleView post={post} />;
}
