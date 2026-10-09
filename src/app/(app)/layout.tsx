import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import Link from "next/link";
import { CookieSettingsLink } from "@/components/Consent";
import { IdentifyUser } from "@/components/IdentifyUser";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppHeader } from "@/components/studio/AppHeader";
import { MeLoader } from "@/components/studio/MeLoader";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { SITE } from "@/lib/site";

/*
 * The personal area: sign-in, the studio, checkout and admin. Clerk's JS loads only here,
 * nothing is indexed, nothing is cached. Each page is force-dynamic and owns a loading.tsx.
 */

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } };

const FOOT = [
  { href: "/pricing", label: "Pricing" },
  { href: "/faq", label: "FAQ" },
  { href: "/contact", label: "Contact" },
  { href: "/terms", label: "Terms" },
  { href: "/privacy", label: "Privacy" },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider
      appearance={clerkAppearance}
      signInUrl="/sign-in"
      signUpUrl="/sign-in"
      signInFallbackRedirectUrl="/studio"
      signUpFallbackRedirectUrl="/studio"
      afterSignOutUrl="/"
    >
      <IdentifyUser />
      <MeLoader />
      <AppHeader />
      <main id="main" className="min-h-[70vh] pb-16">
        {children}
      </main>
      <footer className="mx-auto flex w-full max-w-[1120px] flex-col gap-3 px-3 pb-10 pt-6 text-[0.84rem] text-ink-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <p>
          © {new Date().getFullYear()} {SITE.name}. Presenters are fictional; label every video as AI-generated when you post it.
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {FOOT.map((f) => (
            <Link key={f.href} href={f.href} className="hover:text-ink-2">
              {f.label}
            </Link>
          ))}
          <CookieSettingsLink />
          <ThemeToggle />
        </div>
      </footer>
    </ClerkProvider>
  );
}
