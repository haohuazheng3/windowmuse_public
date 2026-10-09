import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/admin";
import { VERCEL_ENV } from "@/lib/env";
import { AdminNav } from "./_client";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false, follow: false, nocache: true } };

/**
 * The owner's cockpit. The proxy already answers 404 to anyone who is not a verified
 * ADMIN_EMAILS address; `requireAdmin` repeats the check here and in every action.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { email } = await requireAdmin();
  return (
    <div className="mx-auto w-full max-w-[1200px] px-3 pb-20 pt-6 sm:px-5 sm:pt-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-baseline gap-3">
          <p className="eyebrow eyebrow-accent">Admin</p>
          <span className="tag">{VERCEL_ENV}</span>
        </div>
        <p className="truncate text-[0.85rem] text-ink-4">{email}</p>
      </div>
      <div className="mt-5 grid gap-6 lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <AdminNav />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
