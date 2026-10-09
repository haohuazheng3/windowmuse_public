/**
 * Brand constants. Everything user-facing that names the brand reads from here, so the
 * entity stays consistent across pages, schema.org data and notifications.
 */

function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  // Preview deployments get their own origin so Clerk redirects and Stripe return URLs resolve.
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel && process.env.VERCEL_ENV !== "production") return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "https://windowmuse.com";
}

export const SITE = {
  name: "WindowMuse",
  legalName: "WindowMuse",
  domain: "windowmuse.com",
  url: siteUrl(),
  tagline: "Your shop window, with a voice.",
  description:
    "WindowMuse turns product photos into vertical presenter videos for TikTok Shop: a fictional on-camera host shows your real product and says why it is worth buying, ready to post with your shop link.",
  email: "contact@windowmuse.com",
  replyTime: "We reply to every message within two business days.",
  foundingYear: 2026,
  locale: "en_US",
} as const;

/** Pages that must never be indexed or listed in the sitemap. */
export const PRIVATE_PATHS = ["/studio", "/checkout", "/admin", "/sign-in", "/api/"] as const;

/** Last substantive edit of the evergreen pages (legal, FAQ, pricing); used as `dateModified`. */
export const CONTENT_UPDATED = "2026-10-09";
