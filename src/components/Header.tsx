"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoLink } from "./Logo";

/*
 * The header renders in (site) without Clerk, so it never asks who is signed in:
 * "Sign in" goes to /sign-in and "Open studio" goes to /studio; the proxy sends a
 * signed-out visitor from /studio to /sign-in and a signed-in one straight through.
 */

const NAV = [
  { href: "/how-it-works", label: "How it works" },
  { href: "/presenters", label: "Presenters" },
  { href: "/pricing", label: "Pricing" },
  { href: "/blog", label: "Blog" },
];

const MOBILE_EXTRA = [
  { href: "/faq", label: "FAQ" },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Close the mobile menu on navigation (state adjusted during render, no effect needed).
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
      <div className="pill mx-auto flex h-[60px] max-w-[1120px] items-center justify-between gap-2 pl-4 pr-2 sm:pl-5">
        <LogoLink />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={`rounded-full px-3.5 py-2 text-[0.95rem] font-medium transition-colors ${
                isActive(n.href) ? "bg-pane-2 text-ink" : "text-ink-3 hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href="/sign-in"
            prefetch={false}
            className="hidden min-h-[40px] items-center rounded-full px-3.5 text-[0.95rem] font-medium text-ink-3 transition-colors hover:text-ink sm:inline-flex"
          >
            Sign in
          </Link>
          <Link href="/studio" prefetch={false} className="btn btn-primary btn-sm">
            Open studio
          </Link>
          <button
            type="button"
            className="btn btn-quiet btn-sm !px-3 md:hidden"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M3 6h14M3 10h14M3 14h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === dialogRef.current) setOpen(false);
        }}
        className="m-0 mt-3 w-[calc(100%-24px)] max-w-none translate-x-3 bg-transparent p-0 backdrop:bg-[rgba(21,17,14,0.45)] backdrop:backdrop-blur-sm"
      >
        <div className="pane animate-rise p-3">
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="eyebrow">Menu</span>
            <button type="button" className="btn btn-quiet btn-sm !px-3" aria-label="Close menu" onClick={() => setOpen(false)}>
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
                <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <nav aria-label="Mobile" className="flex flex-col">
            {[{ href: "/", label: "Home" }, ...NAV, ...MOBILE_EXTRA].map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className={`flex min-h-[52px] items-center justify-between rounded-2xl px-4 text-[1.08rem] font-medium active:bg-pane-3 ${
                  pathname === n.href ? "bg-pane-2 text-ink" : "text-ink-2"
                }`}
              >
                {n.label}
                <span aria-hidden className="text-ink-4">
                  →
                </span>
              </Link>
            ))}
          </nav>
          <div className="mt-3 grid gap-2">
            <Link href="/studio" prefetch={false} onClick={() => setOpen(false)} className="btn btn-primary btn-lg btn-block">
              Open studio
            </Link>
            <Link href="/sign-in" prefetch={false} onClick={() => setOpen(false)} className="btn btn-ghost btn-block">
              Sign in
            </Link>
          </div>
        </div>
      </dialog>
    </header>
  );
}
