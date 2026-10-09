import Link from "next/link";
import { LogoMark, Wordmark } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { CookieSettingsLink } from "./Consent";
import { SITE } from "@/lib/site";

const COLS = [
  {
    title: "Product",
    links: [
      { href: "/how-it-works", label: "How it works" },
      { href: "/presenters", label: "Presenters" },
      { href: "/pricing", label: "Pricing" },
      { href: "/faq", label: "FAQ" },
      { href: "/studio", label: "Open studio" },
    ],
  },
  {
    title: "Learn",
    links: [
      { href: "/blog", label: "Blog" },
      { href: "/blog/tiktok-shop", label: "TikTok Shop growth" },
      { href: "/blog/ai-video", label: "AI video for sellers" },
      { href: "/blog/product-videos", label: "Product video playbook" },
      { href: "/blog/compliance", label: "Labels, rules & trust" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/sign-in", label: "Sign in" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/acceptable-use", label: "Acceptable use" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/refund-policy", label: "Refund policy" },
      { href: "/cookie-policy", label: "Cookie policy" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="px-3 pb-6 pt-16 sm:px-5 sm:pt-24">
      <div className="pane mx-auto max-w-[1120px] px-6 py-10 sm:px-10 sm:py-12">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2.5" aria-label="WindowMuse, home">
              <LogoMark size={30} />
              <Wordmark className="text-[1.25rem]" />
            </Link>
            <p className="dek mt-3 text-[1.08rem]">{SITE.tagline}</p>
            <p className="mt-3 max-w-sm text-[0.96rem] leading-relaxed text-ink-3">
              Product photos in, a vertical presenter video out: a fictional host shows your real product and says why it is worth
              buying, ready to post on TikTok Shop.
            </p>
            <p className="mt-5 text-[0.95rem] text-ink-2">
              <a href={`mailto:${SITE.email}`} className="underline decoration-line-2 underline-offset-4 hover:text-ink">
                {SITE.email}
              </a>
            </p>
            <p className="mt-1 text-[0.85rem] text-ink-4">{SITE.replyTime}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {COLS.map((c) => (
              <div key={c.title} className="min-w-0">
                <p className="eyebrow">{c.title}</p>
                <ul className="mt-3 space-y-1">
                  {c.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        prefetch={l.href === "/studio" || l.href === "/sign-in" ? false : undefined}
                        className="inline-flex min-h-[36px] items-center text-[0.94rem] text-ink-2 transition-colors hover:text-ink"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <hr className="hairline my-8" />
        <p className="flex items-start gap-2 text-[0.88rem] leading-relaxed text-ink-3">
          <LogoMark size={16} mono className="mt-[3px] shrink-0 text-muse" />
          <span>
            Every video is AI-generated with a fictional presenter. Label it on TikTok: turn on “AI-generated content” and the
            commercial content disclosure when you post.{" "}
            <Link href="/blog/compliance" className="underline underline-offset-4 hover:text-ink">
              Why it matters
            </Link>
          </span>
        </p>
        <div className="mt-6 flex flex-col-reverse gap-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[0.85rem] text-ink-4">
            © {year} {SITE.name}. Presenters are fictional; sellers are responsible for the claims in their scripts. See our{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-ink-2">
              terms
            </Link>
            .
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <CookieSettingsLink />
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
