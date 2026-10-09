/**
 * Blog taxonomy. /blog is a navigation hub; every article lives under
 * /blog/<category>/<slug>, and each category page is a hub that can rank on its own
 * (own title, description, intro, breadcrumbs, paginated archive).
 */

export interface Category {
  slug: string;
  /** Short name for navigation and chips. */
  name: string;
  /** The hub page's <title>. */
  title: string;
  /** The hub page's meta description. */
  description: string;
  /** Opening paragraph of the hub page. */
  intro: string;
}

export const CATEGORIES: Category[] = [
  {
    slug: "tiktok-shop",
    name: "TikTok Shop Growth",
    title: "TikTok Shop growth: listings, affiliate videos, and what actually moves sales",
    description:
      "Practical guides for TikTok Shop sellers in the US: setting up a shop, product cards and shoppable videos, working with affiliates, pricing rules, and reading the numbers that matter.",
    intro:
      "TikTok Shop rewards sellers who post often, link every video to a product card and keep the listing honest. These guides cover the mechanics: shop setup, shoppable video formats, affiliate programs, promotions that pass review, and the handful of metrics worth watching every week.",
  },
  {
    slug: "ai-video",
    name: "AI Video for Sellers",
    title: "AI video for sellers: how presenter videos are made, priced and used well",
    description:
      "How AI presenter videos work for e-commerce: what the models can and cannot do, what photos and scripts produce good results, costs per video, and where AI video fits next to real creators.",
    intro:
      "AI presenter video is new enough that most advice is either hype or fear. This hub is the practical middle: what today's video models do well with a real product in hand, what they get wrong, how to brief them, and how to use the output without misleading anyone.",
  },
  {
    slug: "product-videos",
    name: "Product Video Playbook",
    title: "Product video playbook: scripts, hooks, angles and the first three seconds",
    description:
      "The craft of short product videos: hooks that stop the scroll, scripts that fit 15 seconds, demo and unboxing structures, which product angles to show, and how to end with a clear call to action.",
    intro:
      "A product video has about three seconds to earn the next ten. These guides are about structure: the hook, the one benefit you prove on camera, the angle that shows the product honestly, and the ending that tells people what to tap, in the time a vertical video actually gets.",
  },
  {
    slug: "compliance",
    name: "Labels, Rules & Trust",
    title: "AI labels, disclosures and claims: the rules for AI product videos on TikTok",
    description:
      "What TikTok, TikTok Shop and the FTC require of AI-generated product videos: the AI-generated content label, commercial disclosures, banned claims, fictional presenters, and how to stay on the right side of all of it.",
    intro:
      "TikTok requires realistic AI-generated video to be labeled, the FTC requires endorsements to be truthful and disclosed, and TikTok Shop has its own rules on claims and product footage. This hub explains each rule in plain language and what it means for a seller posting presenter videos.",
  },
  {
    slug: "creators",
    name: "Creators & UGC",
    title: "Creators and UGC: working with affiliates, briefs, and when AI fills the gap",
    description:
      "Working with TikTok creators and UGC: finding affiliates, writing briefs that get usable videos, paying fairly, judging samples, and where AI presenter videos fit alongside real creators.",
    intro:
      "Real creators bring trust and reach; AI presenters bring speed and volume. Most shops end up with both. These guides cover finding and briefing affiliates, what good UGC looks like, and how to use AI videos for the long tail without replacing the people who sell for you.",
  },
];

export function categoryBySlug(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}
