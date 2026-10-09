import { SITE } from "@/lib/site";
import { PACKS, PLANS, TRIAL, formatPrice } from "@/content/plans";
import { LANGUAGE_NAMES, PRESENTERS, VIBE_LABELS } from "@/content/presenters";
import { categoriesWithCounts, postUrl, publishedPosts } from "@/lib/blog";

export const dynamic = "force-static";

/** llms.txt: a plain-text map of the site for language models and answer engines. */
export function GET() {
  const posts = publishedPosts();
  const plans = [PLANS.starter, PLANS.growth, PLANS.pro];
  const packs = [PACKS.pack10, PACKS.pack50];
  const lines = [
    `# ${SITE.name}`,
    "",
    `> ${SITE.description}`,
    "",
    `${SITE.name} is a web app for TikTok Shop sellers. A seller uploads 1–8 photos of a real product, picks one of ${PRESENTERS.length} fictional presenters, approves a short spoken script (AI-written or template, with a compliance check), and receives a vertical 9:16 MP4 of the presenter holding and talking about the product, 10–30 seconds long, at 480p, 720p or 1080p. The product is always the seller's real photographs; the presenter is never a real person. Every export reminds the seller to turn on TikTok's "AI-generated content" label and the commercial content disclosure. Live-stream use is not offered.`,
    "",
    "## Key pages",
    `- [How it works](${SITE.url}/how-it-works): the five-step create flow (product, photos, presenter, script, generate).`,
    `- [Presenters](${SITE.url}/presenters): the catalog of ${PRESENTERS.length} fictional on-camera hosts.`,
    `- [Pricing](${SITE.url}/pricing): plans, packs and how credits work.`,
    `- [FAQ](${SITE.url}/faq) · [About](${SITE.url}/about) · [Contact](${SITE.url}/contact)`,
    `- [Terms](${SITE.url}/terms) · [Acceptable use](${SITE.url}/acceptable-use) · [Privacy](${SITE.url}/privacy) · [Refund policy](${SITE.url}/refund-policy) · [Cookie policy](${SITE.url}/cookie-policy)`,
    "",
    "## Pricing (USD)",
    `- Free trial: ${TRIAL.credits} credits on first sign-in, ${TRIAL.resolution} only, valid ${TRIAL.expiryDays} days, no card.`,
    ...plans.map((p) => `- ${p.name}: ${formatPrice(p.priceUsd)}/month for ${p.credits} credits. ${p.features.join("; ")}.`),
    ...packs.map((p) => `- ${p.name}: ${formatPrice(p.priceUsd)} one-time for ${p.credits} credits. ${p.features.join("; ")}.`),
    "- 1 credit = one video up to 15 seconds at 720p (480p costs the same); 16–30 seconds = 2 credits; 1080p doubles the cost. Failed generations are never charged.",
    "",
    "## Presenters (all fictional)",
    ...PRESENTERS.map(
      (p) =>
        `- ${p.name}: ${p.gender}, ${p.ageBand}, ${VIBE_LABELS[p.vibe].toLowerCase()}; best for ${p.bestFor.join(", ")}; speaks ${p.languages.map((l) => LANGUAGE_NAMES[l]).join(", ")}.`,
    ),
    "",
    "## Script languages",
    Object.values(LANGUAGE_NAMES).join(", ") + ". The site itself is English-only.",
    "",
    "## Rules the product enforces",
    "- Presenters are fictional personas; uploads showing people are not accepted.",
    "- Scripts speak as a brand presenter about verifiable product facts, never as a customer giving testimony.",
    "- No medical cure/treat/prevent claims, no \"guaranteed\", no doctor or expert personas; \"instant\" and before/after language is flagged.",
    "- Product footage is the seller's own photos; the model never invents or alters the product.",
    "",
    "## Blog topics",
    // Hubs with articles are linked; empty hubs are listed by name only (they are noindex until their first article).
    ...categoriesWithCounts().map((c) =>
      c.count ? `- [${c.name}](${SITE.url}/blog/${c.slug}) (${c.count} article${c.count === 1 ? "" : "s"}): ${c.description}` : `- ${c.name} (articles coming): ${c.description}`,
    ),
    ...(posts.length
      ? ["", "## Articles", ...posts.map((p) => `- [${p.title}](${SITE.url}${postUrl(p)}) (updated ${p.updatedAt}): ${p.description}`)]
      : []),
    "",
    `Contact: ${SITE.email}`,
    "",
  ];
  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
