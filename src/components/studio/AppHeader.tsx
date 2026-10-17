"use client";

import { UserButton, useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark, Wordmark } from "@/components/Logo";
import { useHydrated } from "@/components/use-hydrated";
import { useMe } from "./me-store";

/*
 * The slim studio header: logo back to the studio home, four sections, the credit badge
 * (optimistic, from the shared /api/me store) and Clerk's account button. On the sign-in
 * page nothing personal is known, so it collapses to the logo and a way back to the site.
 */

const NAV = [
  { href: "/studio", label: "Studio", exact: true },
  { href: "/studio/products", label: "Products", exact: false },
  { href: "/studio/videos", label: "Videos", exact: false },
  { href: "/studio/billing", label: "Billing", exact: false },
];

function CreditsBadge() {
  const { me, status } = useMe();
  if (!me) {
    if (status === "signed-out" || status === "error") return null;
    return <span className="skeleton inline-block h-8 w-[88px] rounded-full" aria-hidden="true" />;
  }
  const n = me.balance.available;
  const held = me.balance.reserved;
  const low = n === 0;
  return (
    <Link
      href="/studio/billing"
      prefetch={false}
      className={`chip !px-3 !text-[0.84rem] tabular-nums ${low ? "!bg-accent-soft !text-ink" : ""}`}
      aria-label={`${n} ${n === 1 ? "credit" : "credits"} available${held > 0 ? `, ${held} held by videos still generating` : ""}. Billing`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-muse" aria-hidden="true" />
      {n} {n === 1 ? "credit" : "credits"}
      {held > 0 ? <span className="text-ink-4">· {held} held</span> : low ? <span className="hidden sm:inline">· Top up</span> : null}
    </Link>
  );
}

export function AppHeader() {
  const pathname = usePathname();
  const { isLoaded: clerkLoaded, isSignedIn } = useAuth();
  // Clerk may already be loaded from cache when React hydrates; until hydration is done we
  // render exactly what the server rendered (the "not loaded" state) to avoid a mismatch.
  const hydrated = useHydrated();
  const isLoaded = hydrated && clerkLoaded;
  const signedIn = isLoaded && isSignedIn;

  const isActive = (href: string, exact: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="pill mx-auto flex h-[60px] max-w-[1120px] items-center justify-between gap-2 pl-4 pr-2 sm:pl-5">
        <Link
          href={signedIn ? "/studio" : "/"}
          prefetch={false}
          aria-label={signedIn ? "WindowMuse studio" : "WindowMuse, home"}
          className="group inline-flex min-h-[44px] items-center gap-2 rounded-full pr-1"
        >
          <LogoMark size={26} className="transition-transform duration-500 group-hover:-translate-y-[1px]" />
          <Wordmark className="text-[1.12rem] leading-none" />
          {signedIn ? <span className="ml-1 hidden text-[0.78rem] font-semibold uppercase tracking-[0.14em] text-ink-4 sm:inline">Studio</span> : null}
        </Link>

        {signedIn ? (
          <nav aria-label="Studio" className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                prefetch={false}
                aria-current={isActive(n.href, n.exact) ? "page" : undefined}
                className={`rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition-colors ${
                  isActive(n.href, n.exact) ? "bg-pane-2 text-ink" : "text-ink-3 hover:text-ink"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-2">
          {signedIn ? (
            <>
              <CreditsBadge />
              <Link href="/studio/new" prefetch={false} className="btn btn-primary btn-sm hidden sm:inline-flex">
                New video
              </Link>
              <span className="grid h-10 w-10 place-items-center">
                <UserButton />
              </span>
            </>
          ) : isLoaded ? (
            <Link href="/" className="btn btn-quiet btn-sm">
              Back to site
            </Link>
          ) : (
            <span className="skeleton h-9 w-9 rounded-full" aria-hidden="true" />
          )}
        </div>
      </div>

      {signedIn ? (
        <nav aria-label="Studio sections" className="mx-auto mt-2 flex max-w-[1120px] gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] md:hidden">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              prefetch={false}
              aria-current={isActive(n.href, n.exact) ? "page" : undefined}
              className={`chip shrink-0 !text-[0.9rem] ${isActive(n.href, n.exact) ? "" : "!bg-transparent !shadow-none"}`}
              data-selected={isActive(n.href, n.exact) ? "true" : undefined}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </header>
  );
}
