import Link from "next/link";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LogoMark } from "@/components/Logo";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="px-3 pt-16 sm:px-5 sm:pt-24">
        <div className="pane mx-auto max-w-2xl px-6 py-14 text-center sm:px-12">
          <div className="mx-auto w-fit animate-float">
            <LogoMark size={64} />
          </div>
          <p className="eyebrow mt-6">404 · nothing in this window</p>
          <h1 className="display mt-4 text-[2.4rem] text-ink sm:text-[3rem]">This page isn’t on display.</h1>
          <p className="mx-auto mt-4 max-w-md text-[1.02rem] leading-relaxed text-ink-3">
            The link may be old or mistyped. Your studio, the presenters and the pricing are all one tap away.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="btn btn-primary">
              Go home
            </Link>
            <Link href="/studio" prefetch={false} className="btn btn-ghost">
              Open studio
            </Link>
            <Link href="/presenters" className="btn btn-quiet">
              Presenters
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
