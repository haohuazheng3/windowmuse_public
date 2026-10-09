"use client";

import { useState } from "react";

/** Opens Stripe's billing portal (plan changes, cancellation, invoices) in the same tab. */
export function PortalButton({ label, className = "btn btn-ghost" }: { label: string; className?: string }) {
  const [state, setState] = useState<"idle" | "opening" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const open = async () => {
    setState("opening");
    setMessage(null);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST", headers: { accept: "application/json" } });
      const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !body.url) {
        setMessage(body.error ?? "We couldn't open the billing portal. Please try again.");
        setState("error");
        return;
      }
      window.location.assign(body.url);
    } catch (e) {
      console.warn("[portal] open failed", e);
      setMessage("We couldn't reach the server. Check your connection and try again.");
      setState("error");
    }
  };

  return (
    <span className="inline-flex flex-col gap-2">
      <button type="button" className={className} disabled={state === "opening"} aria-busy={state === "opening"} onClick={() => void open()}>
        {state === "opening" ? <span className="spinner" aria-hidden="true" /> : null}
        {state === "opening" ? "Opening…" : label}
      </button>
      {message ? (
        <span role="alert" className="text-[0.85rem] text-bad">
          {message}
        </span>
      ) : null}
    </span>
  );
}
