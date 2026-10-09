import { ensureUser, requireUser } from "@/lib/user";

export const dynamic = "force-dynamic";

/**
 * Everything under /studio needs a session (the proxy already redirected guests). The
 * local user row is upserted once here, which also grants the free trial on first sign-in.
 */
export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await requireUser();
  await ensureUser(session);
  return <div className="mx-auto w-full max-w-[1120px] px-3 pt-6 sm:px-5 sm:pt-8">{children}</div>;
}
