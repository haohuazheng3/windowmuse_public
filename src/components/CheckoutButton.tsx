"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { track } from "./Consent";
import { formatPrice, OFFERS, type Sku } from "@/content/plans";

/*
 * The one way to open Stripe Checkout, shared by the pricing page and the billing page.
 * Pressing a button flips it to a pending state before any network call, then POSTs
 * /api/checkout {sku, nonce} and sends the browser to Stripe.
 *
 *  - The nonce is the server's idempotency key: a refresh or a double tap within 20 minutes
 *    reuses the same attempt (and the Checkout URL it produced) instead of opening a second
 *    Checkout Session. `forgetCheckout(sku)` ends the attempt (after a purchase, or before a
 *    retry from an error).
 *  - 401 (guest): go to /sign-in with redirect_url=/pricing?buy=<sku>; the pricing page then
 *    loads with ?buy=<sku> and the matching OfferBuyButton resumes the purchase once. Only a
 *    page load that this very tab marked before leaving for sign-in resumes: a ?buy= link
 *    pasted from elsewhere never sends anyone to Stripe without a press.
 *  - 409 with `portal`: the seller already has a plan; the message links to Billing.
 *  - 409 with `stale`: the attempt's idempotency key clashed; the attempt is forgotten so the
 *    next press starts fresh.
 *  - 503: sign-in or payments are still being set up; the message says so.
 */

const ATTEMPT_MS = 20 * 60 * 1000;

/** Fired on this window whenever an attempt is stashed or forgotten, so buttons can re-read the storage. */
const CHANGE_EVENT = "wm:checkout";
function announceChange(): void {
  try {
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    /* no window: nothing to tell */
  }
}
function subscribeChanges(cb: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(CHANGE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

const nonceKey = (sku: Sku) => `wm_checkout_nonce:${sku}`;
const urlKey = (sku: Sku) => `wm_checkout_url:${sku}`;
const resumeKey = (sku: Sku) => `wm_checkout_resume:${sku}`;

/** Set right before leaving for sign-in; the only thing that lets ?buy=<sku> start a checkout on its own. */
function markResume(sku: Sku): void {
  try {
    sessionStorage.setItem(resumeKey(sku), String(Date.now()));
  } catch {
    /* storage unavailable: after sign-in the seller presses the button once more */
  }
}

/** True once when this tab marked a resume for the offer within the attempt window; the mark is consumed. */
function takeResumeMark(sku: Sku): boolean {
  try {
    const raw = sessionStorage.getItem(resumeKey(sku));
    sessionStorage.removeItem(resumeKey(sku));
    const at = Number(raw);
    return Number.isFinite(at) && at > 0 && Date.now() - at < ATTEMPT_MS;
  } catch {
    return false;
  }
}

function attemptNonce(sku: Sku): string {
  try {
    const kept = sessionStorage.getItem(nonceKey(sku));
    if (kept) {
      const { value, at } = JSON.parse(kept) as { value?: unknown; at?: unknown };
      if (typeof value === "string" && typeof at === "number" && Date.now() - at < ATTEMPT_MS) return value;
    }
    const value = crypto.randomUUID();
    sessionStorage.setItem(nonceKey(sku), JSON.stringify({ value, at: Date.now() }));
    return value;
  } catch {
    // Storage unavailable (private mode, quota): the attempt simply is not reusable across a refresh.
    return crypto.randomUUID();
  }
}

function stashedUrl(sku: Sku): string | null {
  try {
    const raw = sessionStorage.getItem(urlKey(sku));
    if (!raw) return null;
    const { url, at } = JSON.parse(raw) as { url?: unknown; at?: unknown };
    return typeof url === "string" && typeof at === "number" && Date.now() - at < ATTEMPT_MS && url.startsWith("https://checkout.stripe.com/") ? url : null;
  } catch {
    return null;
  }
}

function stashUrl(sku: Sku, url: string): void {
  try {
    sessionStorage.setItem(urlKey(sku), JSON.stringify({ url, at: Date.now() }));
  } catch {
    /* storage unavailable: a refresh starts a new attempt, which the server dedupes by nonce */
  }
  announceChange();
}

/** Ends the current attempt for an offer: the next press mints a fresh nonce and a fresh session. */
export function forgetCheckout(sku: Sku): void {
  try {
    sessionStorage.removeItem(nonceKey(sku));
    sessionStorage.removeItem(urlKey(sku));
    sessionStorage.removeItem(resumeKey(sku));
  } catch {
    /* storage unavailable: nothing was kept */
  }
  announceChange();
}

/**
 * True once per page load when the URL carries ?buy=<sku> AND this tab asked for the resume
 * before sign-in; the param is removed so a later back-navigation does not resume again.
 */
function consumeResume(sku: Sku): boolean {
  try {
    const url = new URL(window.location.href);
    if (url.searchParams.get("buy") !== sku) return false;
    url.searchParams.delete("buy");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    return takeResumeMark(sku);
  } catch {
    return false;
  }
}

export type CheckoutPhase = "pending" | "redirecting";

export interface CheckoutState {
  /** The offer being opened right now, if any. */
  pending: Sku | null;
  phase: CheckoutPhase | null;
  error: string | null;
  /** The error came with a pointer to the billing portal (the seller already has a plan). */
  portal: boolean;
  start: (sku: Sku) => Promise<void>;
  reset: () => void;
}

/**
 * One checkout state for any number of buttons (they share the error line and block each
 * other while one is opening). With `resume`, a page load carrying ?buy=<that sku> starts
 * the purchase on its own, once (the proxy sends guests through sign-in with that URL).
 */
export function useCheckout(opts: { resume?: Sku } = {}): CheckoutState {
  const router = useRouter();
  const [pending, setPending] = useState<Sku | null>(null);
  const [phase, setPhase] = useState<CheckoutPhase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [portal, setPortal] = useState(false);
  const inFlight = useRef(false);
  /** null = not yet checked; true = this page load carried ?buy=<sku> and the purchase must resume once. */
  const resume = useRef<boolean | null>(null);

  const start = useCallback(
    async (sku: Sku) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setError(null);
      setPortal(false);
      setPending(sku);
      setPhase("pending"); // before the network, always
      const stashed = stashedUrl(sku);
      if (stashed) {
        setPhase("redirecting");
        window.location.assign(stashed);
        return;
      }
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify({ sku, nonce: attemptNonce(sku) }),
        });
        if (res.status === 401) {
          markResume(sku);
          setPhase("redirecting");
          router.push(`/sign-in?redirect_url=${encodeURIComponent(`/pricing?buy=${sku}`)}`);
          return;
        }
        const body = (await res.json().catch(() => ({}))) as { url?: string; error?: string; portal?: boolean; stale?: boolean };
        if (!res.ok || !body.url) {
          const fallback =
            res.status === 503
              ? "Checkout is being set up. Please try again in a few minutes."
              : "We couldn’t open checkout. Please try again, or email us if it keeps failing.";
          if (body.stale) forgetCheckout(sku);
          setPortal(body.portal === true);
          setError(body.error ?? fallback);
          setPending(null);
          setPhase(null);
          inFlight.current = false;
          return;
        }
        stashUrl(sku, body.url);
        track("checkout_start", { sku, priceUsd: OFFERS[sku].priceUsd });
        setPhase("redirecting");
        window.location.assign(body.url);
      } catch (e) {
        console.warn("[checkout] start failed", e);
        setError("We couldn’t reach the server. Check your connection and try again.");
        setPending(null);
        setPhase(null);
        inFlight.current = false;
      }
    },
    [router],
  );

  const reset = useCallback(() => {
    setError(null);
    setPortal(false);
    setPending(null);
    setPhase(null);
    inFlight.current = false;
  }, []);

  // Resume after sign-in: the pricing page is static, so the query string is read on the client.
  // The ref survives StrictMode's double effect run (the query param is consumed only once).
  const resumeSku = opts.resume;
  useEffect(() => {
    if (!resumeSku) return;
    if (resume.current === null) resume.current = consumeResume(resumeSku);
    if (!resume.current) return;
    const t = window.setTimeout(() => {
      resume.current = false;
      void start(resumeSku);
    }, 0);
    return () => window.clearTimeout(t);
  }, [resumeSku, start]);

  return { pending, phase, error, portal, start, reset };
}

/** The error line under a buy button; with `portal` it points at Billing instead of inviting a retry. */
export function CheckoutError({ checkout, className = "mt-3" }: { checkout: CheckoutState; className?: string }) {
  if (!checkout.error) return null;
  return (
    <p role="alert" className={`${className} rounded-2xl bg-bad-soft px-4 py-2.5 text-[0.9rem] leading-snug text-bad`}>
      {checkout.error}
      {checkout.portal ? (
        <>
          {" "}
          <Link href="/studio/billing" prefetch={false} className="font-semibold underline underline-offset-2">
            Open billing
          </Link>
        </>
      ) : null}
    </p>
  );
}

/** A buy button with instant pressed state; `checkout` comes from `useCheckout()` so several buttons share one error line. */
export function BuyButton({
  sku,
  checkout,
  className = "btn btn-primary",
  label,
  pendingLabel = "Opening checkout…",
}: {
  sku: Sku;
  checkout: CheckoutState;
  className?: string;
  label?: string;
  pendingLabel?: string;
}) {
  const offer = OFFERS[sku];
  const busy = checkout.pending === sku;
  const otherBusy = checkout.pending !== null && !busy;
  // An attempt from the last 20 minutes still has its Stripe page: say so instead of pretending to start over.
  // Read from storage on the client only (false while rendering on the server, so markup matches).
  const resumable = useSyncExternalStore(
    subscribeChanges,
    () => stashedUrl(sku) !== null,
    () => false,
  );
  const idle = label ?? `${offer.name} · ${formatPrice(offer.priceUsd)}${offer.interval ? "/mo" : ""}`;
  return (
    <button
      type="button"
      className={className}
      disabled={busy || otherBusy || checkout.portal}
      aria-busy={busy}
      aria-live="polite"
      onClick={() => {
        if (checkout.error) forgetCheckout(sku);
        void checkout.start(sku);
      }}
    >
      {busy ? <span className="spinner" aria-hidden="true" /> : null}
      {busy ? (checkout.phase === "redirecting" ? "Taking you to Stripe…" : pendingLabel) : checkout.error ? (checkout.portal ? idle : "Try again") : resumable ? "Resume checkout" : idle}
    </button>
  );
}

/**
 * Feedback after Stripe sends the seller back without paying (`?checkout=cancelled`): nothing
 * was charged, the attempt is kept for 20 minutes, and "Start over" forgets it. Reads the
 * query string on the client, so it lives inside a Suspense boundary on the static page.
 */
export function CheckoutNotice() {
  const params = useSearchParams();
  const router = useRouter();
  const cancelled = params.get("checkout") === "cancelled";
  const [dismissed, setDismissed] = useState(false);
  if (!cancelled || dismissed) return null;
  const startOver = () => {
    for (const sku of Object.keys(OFFERS) as Sku[]) forgetCheckout(sku);
    setDismissed(true);
    router.replace("/pricing");
  };
  return (
    <div role="status" className="pane mx-auto mt-6 flex max-w-2xl flex-col gap-3 px-5 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[0.95rem] leading-snug text-ink-2">
        <span className="font-semibold text-ink">Checkout closed, nothing was charged.</span> Your selection is kept for 20 minutes; the button below says “Resume checkout”.
      </p>
      <button type="button" className="btn btn-quiet btn-sm shrink-0" onClick={startOver}>
        Start over
      </button>
    </div>
  );
}

/** A self-contained button for one offer (the pricing page): its own state, its own error line, and ?buy=<sku> resume. */
export function OfferBuyButton({ sku, label, className = "" }: { sku: Sku; label: string; className?: string }) {
  const checkout = useCheckout({ resume: sku });
  return (
    <div className={className}>
      <BuyButton sku={sku} checkout={checkout} className="btn btn-primary btn-lg btn-block" label={label} />
      <CheckoutError checkout={checkout} />
    </div>
  );
}
