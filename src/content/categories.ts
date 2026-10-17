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
    title: "TikTok Shop Seller Tools: Fees, ROAS, Listings and Posting",
    description:
      "Free TikTok Shop tools and guides for US sellers: fee and ROAS calculators, listing copy, captions, hashtags, posting plans and affiliate marketing.",
    intro:
      "TikTok Shop rewards sellers who post often, link every video to a product card and keep the listing honest. This hub collects free tools for the numbers (fees, break-even ROAS, ROAS), the listing (titles, descriptions, bullet points), the post (captions, hashtags, a posting plan, a shoppable checklist) and the affiliates who sell for you.",
  },
  {
    slug: "ai-video",
    name: "AI Video for Sellers",
    title: "AI Product Video Guides: Inputs, Scripts and Tools",
    description:
      "How AI presenter videos work for e-commerce: what inputs they need, how to check a script, when AI UGC fits, and how to choose an AI video tool.",
    intro:
      "AI presenter video is new enough that most advice is either hype or fear. This hub is the practical middle: what a generator needs from you, how to check a script before you spend a credit, when AI UGC suits a product and when it does not, and how to pick the right kind of tool.",
  },
  {
    slug: "product-videos",
    name: "Product Video Playbook",
    title: "Product Video Tools: Scripts, Hooks, Timing and Specs",
    description:
      "Free tools for short product videos: script, hook and CTA generators, timers, speaking-rate and size calculators, safe zones, shot lists and a teleprompter.",
    intro:
      "A product video has about three seconds to earn the next ten. This hub holds the tools for each step: generators for scripts, hooks, calls to action and titles; timers and calculators for words, seconds, sizes and bitrates; and production helpers such as a shot list, a safe zone overlay and a teleprompter.",
  },
  {
    slug: "compliance",
    name: "Labels, Rules & Trust",
    title: "AI Labels and FTC Rules for Product Videos on TikTok",
    description:
      "What TikTok, TikTok Shop and the FTC require of product videos: AI labels, commercial disclosures, banned claims and fake reviews, with free checklists.",
    intro:
      "TikTok requires realistic AI-generated video to be labelled, the FTC requires endorsements to be truthful and disclosed, and TikTok Shop has its own rules on claims and product footage. This hub explains each rule in plain language and gives you an AI disclosure generator and an FTC checklist to apply them.",
  },
  {
    slug: "creators",
    name: "Creators & UGC",
    title: "UGC and Creator Tools: Briefs, Scripts and Ad Examples",
    description:
      "Working with TikTok creators and UGC: creative briefs, UGC ad scripts, script checks, faceless formats, real TikTok ad examples and where AI fits.",
    intro:
      "Real creators bring trust and reach; AI presenters bring speed and volume. Most shops end up with both. This hub covers where UGC comes from, how to brief creators so their videos are usable, scripts that leave room for an honest opinion, faceless formats, and real TikTok campaigns broken down.",
  },
];

export function categoryBySlug(slug: string): Category | null {
  return CATEGORIES.find((c) => c.slug === slug) ?? null;
}
