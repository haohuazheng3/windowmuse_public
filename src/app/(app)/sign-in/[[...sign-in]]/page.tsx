import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { TRIAL } from "@/content/plans";
import { PRESENTERS } from "@/content/presenters";
import { SITE } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Sign in",
  description: "Enter your email, get a code, and you are in the WindowMuse studio. No password, no separate sign-up.",
  robots: { index: false, follow: false },
};

/** Only same-site paths are accepted as the destination after sign-in (no open redirects, no loops). */
function safeRedirect(raw: unknown): string | undefined {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2000) return undefined;
  let path: string;
  try {
    const u = new URL(raw, SITE.url);
    const sameSite = u.origin === new URL(SITE.url).origin || u.hostname === "localhost" || u.hostname.endsWith(".vercel.app");
    if (!sameSite && !raw.startsWith("/")) return undefined;
    path = `${u.pathname}${u.search}`;
  } catch {
    return undefined;
  }
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/sign-in") || path.startsWith("/api/")) return undefined;
  return path;
}

const POINTS = [
  { title: `${TRIAL.credits} free videos`, body: `${TRIAL.credits} trial credits at ${TRIAL.resolution}, valid ${TRIAL.expiryDays} days. No card.` },
  { title: "One email, one code", body: "The code is the sign-in. New email? The same step creates your account." },
  { title: "Your product, a fictional host", body: `Upload photos, pick one of ${PRESENTERS.length} presenters, approve the script, download the vertical MP4.` },
];

export default async function SignInPage(props: PageProps<"/sign-in/[[...sign-in]]">) {
  const sp = await props.searchParams;
  const redirect = safeRedirect(sp.redirect_url) ?? "/studio";

  return (
    <div className="px-3 pt-8 sm:px-5 sm:pt-14">
      <div className="mx-auto grid max-w-[1000px] items-center gap-8 lg:grid-cols-[1fr_440px] lg:gap-14">
        <div className="order-2 min-w-0 lg:order-1">
          <p className="eyebrow eyebrow-accent">Sign in or create your studio</p>
          <h1 className="display mt-4 text-[2.3rem] text-ink sm:text-[3.2rem]">
            Your shop window, <em>with a voice.</em>
          </h1>
          <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-ink-3">
            Enter your email. We&rsquo;ll send a code. That&rsquo;s the whole sign-in &mdash; no password, no separate sign-up.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {POINTS.map((p) => (
              <li key={p.title} className="pane-inset px-4 py-3.5">
                <p className="text-[0.95rem] font-semibold text-ink">{p.title}</p>
                <p className="mt-1 text-[0.86rem] leading-snug text-ink-3">{p.body}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="order-1 min-w-0 lg:order-2">
          <div className="pane-ink p-5 sm:p-8">
            <div className="mb-5 flex items-center gap-2">
              <LogoMark size={24} tone="light" />
              <span className="font-sans text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-[#FF9A78]">Studio</span>
            </div>
            <SignIn withSignUp routing="path" path="/sign-in" fallbackRedirectUrl={redirect} signUpFallbackRedirectUrl={redirect} />
            <p className="mt-5 text-[0.8rem] leading-relaxed text-[#A89E92]">
              By continuing you agree to the{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-[#F3EEE6]">
                Terms
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-[#F3EEE6]">
                Privacy policy
              </Link>
              . Codes come from Clerk, our sign-in provider; we never see or store a password.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
