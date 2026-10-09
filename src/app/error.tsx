"use client";

import Link from "next/link";
import { useEffect } from "react";

/** Reports a rendering error to the self-hosted error inbox without depending on any other module. */
function report(error: Error & { digest?: string }) {
  try {
    const body = JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      source: "error-boundary",
      route: location.pathname,
      severity: "error",
      userAgent: navigator.userAgent,
    });
    if (!navigator.sendBeacon?.("/api/errors", new Blob([body], { type: "application/json" }))) {
      fetch("/api/errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch((e: unknown) => {
        console.warn("[errors] report failed", e);
      });
    }
  } catch (e) {
    console.warn("[errors] report failed", e);
  }
}

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    report(error);
  }, [error]);

  return (
    <main id="main" className="px-3 pt-24 sm:px-5">
      <div className="pane mx-auto max-w-xl px-6 py-12 text-center sm:px-10">
        <p className="eyebrow">Something broke</p>
        <h1 className="display mt-4 text-[2.2rem] text-ink">That one’s on us.</h1>
        <p className="mx-auto mt-4 max-w-sm text-[1rem] leading-relaxed text-ink-3">
          The error has been logged and we will look at it. Nothing was charged. Try again, or go back to the studio.
          {error.digest ? <span className="mt-2 block text-[0.8rem] text-ink-4">Reference: {error.digest}</span> : null}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button type="button" className="btn btn-primary" onClick={() => reset()}>
            Try again
          </button>
          <Link href="/studio" prefetch={false} className="btn btn-ghost">
            Studio
          </Link>
          <Link href="/" className="btn btn-quiet">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
