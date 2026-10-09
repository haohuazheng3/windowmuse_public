import type { MetadataRoute } from "next";
import { CATEGORIES } from "@/content/categories";
import { PAGE_SIZE, postUrl, publishedPosts } from "@/lib/blog";
import { CONTENT_UPDATED, SITE } from "@/lib/site";

type Freq = MetadataRoute.Sitemap[number]["changeFrequency"];

const STATIC: { path: string; priority: number; changeFrequency: Freq }[] = [
  { path: "/", priority: 1, changeFrequency: "weekly" },
  { path: "/how-it-works", priority: 0.8, changeFrequency: "monthly" },
  { path: "/presenters", priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.8, changeFrequency: "monthly" },
  { path: "/faq", priority: 0.6, changeFrequency: "monthly" },
  { path: "/about", priority: 0.5, changeFrequency: "yearly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.2, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.2, changeFrequency: "yearly" },
  { path: "/acceptable-use", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund-policy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cookie-policy", priority: 0.2, changeFrequency: "yearly" },
];

/** Only indexable URLs go in: empty hubs and private pages never appear here. lastmod values are real. */
export default function sitemap(): MetadataRoute.Sitemap {
  const posts = publishedPosts();
  const out: MetadataRoute.Sitemap = STATIC.map((s) => ({
    url: `${SITE.url}${s.path === "/" ? "" : s.path}`,
    lastModified: CONTENT_UPDATED,
    changeFrequency: s.changeFrequency,
    priority: s.priority,
  }));

  if (posts.length) {
    const newest = posts.reduce((m, p) => (p.updatedAt > m ? p.updatedAt : m), posts[0].updatedAt);
    out.push({ url: `${SITE.url}/blog`, lastModified: newest, changeFrequency: "weekly", priority: 0.7 });
  }
  for (const c of CATEGORIES) {
    const inCat = posts.filter((p) => p.category === c.slug);
    if (!inCat.length) continue;
    const newest = inCat.reduce((m, p) => (p.updatedAt > m ? p.updatedAt : m), inCat[0].updatedAt);
    out.push({ url: `${SITE.url}/blog/${c.slug}`, lastModified: newest, changeFrequency: "weekly", priority: 0.7 });
    const pages = Math.ceil(inCat.length / PAGE_SIZE);
    for (let n = 2; n <= pages; n++) {
      out.push({ url: `${SITE.url}/blog/${c.slug}/page/${n}`, lastModified: newest, changeFrequency: "weekly", priority: 0.4 });
    }
  }
  for (const p of posts) {
    out.push({ url: `${SITE.url}${postUrl(p)}`, lastModified: p.updatedAt, changeFrequency: "monthly", priority: p.featured ? 0.8 : 0.6 });
  }
  return out;
}
