import type { Metadata } from "next";
import { SITE } from "./site";
import type { Offer } from "@/content/plans";

export function absoluteUrl(path: string): string {
  if (/^https?:\/\//.test(path)) return path;
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}

export function pageMetadata(input: {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
  type?: "website" | "article";
  absoluteTitle?: boolean;
}): Metadata {
  const url = absoluteUrl(input.path);
  // A page-level openGraph object replaces the inherited one, so every page names its image;
  // the root /opengraph-image is the default (segment-level opengraph-image files still win).
  const image = input.image ?? "/opengraph-image";
  return {
    title: input.absoluteTitle ? { absolute: input.title } : input.title,
    description: input.description,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE.name,
      type: input.type === "article" ? "article" : "website",
      locale: SITE.locale,
      images: [{ url: absoluteUrl(image), width: 1200, height: 630, alt: input.title }],
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
      images: [absoluteUrl(image)],
    },
    ...(input.noindex ? { robots: { index: false, follow: false } } : {}),
  };
}

const ORG_ID = `${SITE.url}/#organization`;
const SITE_ID = `${SITE.url}/#website`;
const APP_ID = `${SITE.url}/#app`;

export function organizationLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: SITE.name,
    url: SITE.url,
    logo: { "@type": "ImageObject", url: absoluteUrl("/brand/logo-512.png"), width: 512, height: 512 },
    email: SITE.email,
    description: SITE.description,
    foundingDate: String(SITE.foundingYear),
    contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SITE.email, availableLanguage: ["English"] }],
  };
}

export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SITE_ID,
    name: SITE.name,
    url: SITE.url,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

/** The product itself, with one Offer per plan and pack. No ratings: we never publish ones we didn't collect. */
export function softwareApplicationLd(offers: Offer[]) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": APP_ID,
    name: SITE.name,
    url: SITE.url,
    description: SITE.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
    offers: offers.map((o) => ({
      "@type": "Offer",
      name: o.interval === "month" ? `${o.name} plan` : `${o.name} pack`,
      sku: o.sku,
      price: o.priceUsd.toFixed(2),
      priceCurrency: "USD",
      url: absoluteUrl("/pricing"),
      availability: "https://schema.org/InStock",
      category: o.interval === "month" ? "subscription" : "one-time",
      seller: { "@id": ORG_ID },
      ...(o.interval === "month"
        ? {
            priceSpecification: {
              "@type": "UnitPriceSpecification",
              price: o.priceUsd.toFixed(2),
              priceCurrency: "USD",
              billingDuration: 1,
              billingIncrement: 1,
              unitCode: "MON",
            },
          }
        : {}),
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** The fields an article needs for schema.org; the blog's Post type satisfies it structurally. */
export interface ArticleInput {
  title: string;
  description: string;
  publishedAt: string;
  updatedAt: string;
  keywords: string[];
  wordCount?: number;
  image?: { src: string } | null;
  category: string;
  slug: string;
}

export function articleLd(post: ArticleInput, url: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(url) },
    url: absoluteUrl(url),
    image: absoluteUrl(post.image?.src ?? `/og/post/${post.category}/${post.slug}`),
    author: { "@type": "Organization", "@id": ORG_ID, name: SITE.name, url: SITE.url },
    publisher: { "@id": ORG_ID },
    inLanguage: "en",
    ...(post.wordCount ? { wordCount: post.wordCount } : {}),
    keywords: post.keywords.join(", ") || undefined,
    isPartOf: { "@id": SITE_ID },
  };
}

/**
 * The interactive tool on a tool-first guide. Free, in the browser, published by the
 * organization; `url` is the article page the tool lives on.
 */
export function webApplicationLd(input: { name: string; description: string; url: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.url),
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    inLanguage: "en",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": ORG_ID },
    isPartOf: { "@id": SITE_ID },
  };
}

export interface HowToStep {
  name: string;
  text: string;
  path?: string;
}

/** /how-it-works: the five panes of the create flow as HowTo steps. */
export function howToLd(input: { name: string; description: string; path: string; steps: HowToStep[]; totalTime?: string }) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: input.name,
    description: input.description,
    url: absoluteUrl(input.path),
    inLanguage: "en",
    ...(input.totalTime ? { totalTime: input.totalTime } : {}),
    tool: [{ "@type": "HowToTool", name: "Product photos (your own, no people in them)" }],
    step: input.steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
      url: absoluteUrl(s.path ?? `${input.path}#step-${i + 1}`),
    })),
    publisher: { "@id": ORG_ID },
  };
}

export function serializeLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
