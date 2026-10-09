"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

/*
 * Client-side helpers for the admin area: the nav needs the current path to highlight
 * itself, and action buttons need the form's pending state so they react on press.
 */

export const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/jobs", label: "Jobs" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/errors", label: "Errors" },
  { href: "/admin/messages", label: "Messages" },
  { href: "/admin/inbox", label: "Test inbox" },
  { href: "/admin/diagnostics", label: "Diagnostics" },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Side column from 1024px up, a horizontally scrolling pill row below. */
export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24">
      <ul className="-mx-3 flex gap-1.5 overflow-x-auto px-3 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
        {ADMIN_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[40px] items-center rounded-full px-3.5 text-[0.9rem] font-semibold transition-colors lg:rounded-2xl lg:px-3 ${
                  active ? "bg-accent-soft text-accent-text" : "text-ink-3 hover:bg-pane-2 hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A submit button that flips to its pending label the moment it is pressed. Use inside a
 * <form action={serverAction}>; the row re-renders from the server once the action returns.
 */
export function SubmitButton({
  children,
  pendingLabel = "Working…",
  className = "btn btn-ghost btn-sm",
  disabled = false,
  title,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  disabled?: boolean;
  title?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={disabled || pending} aria-busy={pending} title={title} name={name} value={value}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
