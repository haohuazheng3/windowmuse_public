"use client";

import { useEffect } from "react";

/** Last-resort boundary: replaces the root layout, so it carries its own minimal styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    try {
      const body = JSON.stringify({
        name: error.name,
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        source: "global-error",
        route: location.pathname,
        severity: "error",
      });
      if (!navigator.sendBeacon?.("/api/errors", new Blob([body], { type: "application/json" }))) {
        fetch("/api/errors", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch((e: unknown) => {
          console.warn("[errors] report failed", e);
        });
      }
    } catch (e) {
      console.warn("[errors] report failed", e);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          background: "#F3EFE7",
          color: "#15110E",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          style={{
            maxWidth: 440,
            textAlign: "center",
            background: "#FFFFFF",
            borderRadius: 28,
            padding: "40px 28px",
            boxShadow: "0 0 0 1px rgba(21,17,14,.08), 0 30px 60px -32px rgba(21,17,14,.3)",
          }}
        >
          <svg viewBox="0 0 32 32" width="40" height="40" aria-hidden="true">
            <path d="M6 30V15a10 10 0 0 1 20 0v15Z M11 30V16a5 5 0 0 1 10 0v14Z" fillRule="evenodd" fill="#15110E" />
            <circle cx="16" cy="10" r="2" fill="#6B5BFF" />
          </svg>
          <p style={{ fontSize: 12, letterSpacing: ".16em", textTransform: "uppercase", color: "#6B625A", margin: "12px 0 0" }}>WindowMuse</p>
          <h1 style={{ fontSize: 28, margin: "14px 0 8px", fontFamily: "Georgia, serif", fontWeight: 600 }}>Something went wrong.</h1>
          <p style={{ color: "#4A423B", lineHeight: 1.6, margin: 0 }}>The error has been logged and nothing was charged. Please try again.</p>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              marginTop: 24,
              minHeight: 48,
              padding: "0 22px",
              borderRadius: 999,
              border: 0,
              background: "#E8562A",
              color: "#FFF7F3",
              fontWeight: 600,
              fontSize: 16,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
