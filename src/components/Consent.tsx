"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

declare global {
  interface Window {
    fw?: (...args: unknown[]) => void;
    __wmAnalyticsLoaded?: boolean;
  }
}

const FW_KEY = process.env.NEXT_PUBLIC_FLOWGLANCE_KEY;
const COOKIE = "wm_consent";
const OPEN_EVENT = "wm:open-consent";
export const ANALYTICS_LOADED_EVENT = "wm:analytics-loaded";

type Consent = "all" | "essential";
type Mode = "hidden" | "optin" | "notice";

function readConsent(): Consent | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|;\s*)wm_consent=([^;]+)/);
  if (!m) return null;
  return m[1] === "essential" ? "essential" : "all";
}

function writeConsent(v: Consent) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${COOKIE}=${v}; Path=/; Max-Age=${60 * 60 * 24 * 180}; SameSite=Lax${secure}`;
}

/** Inject the FlowGlance snippet once (the only analytics on this site). */
export function loadFlowGlance(): void {
  if (!FW_KEY || typeof document === "undefined" || window.__wmAnalyticsLoaded) return;
  window.__wmAnalyticsLoaded = true;
  const s = document.createElement("script");
  s.defer = true;
  s.src = "https://flowglance.com/fw.js";
  s.setAttribute("data-site", FW_KEY);
  s.onload = () => window.dispatchEvent(new Event(ANALYTICS_LOADED_EVENT));
  document.head.appendChild(s);
}

/** Fire a FlowGlance business event; queued until the snippet is ready, a no-op if analytics are off. */
export function track(name: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  const send = () => {
    try {
      window.fw?.("event", name, props ?? {});
    } catch (e) {
      console.warn("[analytics] event failed", name, e);
    }
  };
  if (window.fw) return send();
  if (!window.__wmAnalyticsLoaded) return;
  window.addEventListener(ANALYTICS_LOADED_EVENT, send, { once: true });
}

/**
 * Region-aware consent. Visitors in the EU/EEA, UK and Switzerland (or anywhere we
 * can't place) must opt in before FlowGlance loads. Everywhere else it loads by
 * default with a clear notice and a one-tap opt-out. The choice is remembered for
 * 180 days and can be changed from the footer at any time.
 */
export function ConsentManager() {
  const [mode, setMode] = useState<Mode>("hidden");

  useEffect(() => {
    const existing = readConsent();
    if (existing === "all") {
      loadFlowGlance();
      return;
    }
    if (existing === "essential") return;
    let cancelled = false;
    fetch("/api/geo", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { consentRequired: true }))
      .catch(() => ({ consentRequired: true }))
      .then((g: { consentRequired?: boolean }) => {
        if (cancelled) return;
        if (g.consentRequired === false) {
          loadFlowGlance();
          setMode("notice");
        } else {
          setMode("optin");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const open = () => setMode(window.__wmAnalyticsLoaded ? "notice" : "optin");
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  const accept = useCallback(() => {
    writeConsent("all");
    loadFlowGlance();
    setMode("hidden");
  }, []);

  const essentialOnly = useCallback(() => {
    writeConsent("essential");
    setMode("hidden");
  }, []);

  if (mode === "hidden") return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-[420px]" role="region" aria-label="Cookie choices">
      <div className="pane animate-rise p-5">
        <p className="font-display text-[1.08rem] font-semibold text-ink" style={{ fontVariationSettings: '"SOFT" 100, "opsz" 24' }}>
          {mode === "optin" ? "Can we count your visit?" : "A quick note on analytics"}
        </p>
        {/* Short blocks: the banner appears after hydration and must never become the page's LCP element. */}
        <p className="mt-2 text-[0.88rem] leading-relaxed text-ink-3">
          {mode === "optin"
            ? "We’d like to use FlowGlance, our only analytics tool, to see which pages help sellers."
            : "We use FlowGlance, our only analytics tool, to see which pages help sellers."}
        </p>
        <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-3">
          {mode === "optin"
            ? "It records page activity, including text you submit in forms and images you upload. Essential cookies for sign-in and checkout are always on."
            : "It records page activity, including text you submit in forms and images you upload. You can opt out any time."}{" "}
          <Link href="/cookie-policy" className="underline underline-offset-4 hover:text-ink">
            Details
          </Link>
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" className="btn btn-primary btn-sm flex-1" onClick={accept}>
            {mode === "optin" ? "Accept analytics" : "OK"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm flex-1" onClick={essentialOnly}>
            {mode === "optin" ? "Essential only" : "Opt out"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="min-h-[36px] rounded-full px-3 text-[0.85rem] text-ink-3 underline-offset-4 hover:text-ink hover:underline"
    >
      Cookie settings
    </button>
  );
}
