"use client";

import { useEffect } from "react";
import { forgetCheckout } from "./CheckoutButton";
import { ANALYTICS_LOADED_EVENT } from "./Consent";
import { isSku } from "@/content/plans";

/**
 * Fires the FlowGlance `purchase` event once per Checkout Session (deduped across reloads
 * through localStorage) and forgets the finished attempt, so the next purchase of the same
 * offer mints a fresh nonce instead of reopening this session. Renders nothing.
 */
export function PurchaseEvents({ sessionId, sku, amount, currency }: { sessionId: string; sku: string; amount: number; currency: string }) {
  useEffect(() => {
    // The attempt is over: the next purchase of the same offer must mint a fresh nonce and session.
    if (isSku(sku)) forgetCheckout(sku);
    const key = `wm_purchase_${sessionId}`;
    try {
      if (localStorage.getItem(key)) return;
    } catch (e) {
      // Private mode or blocked storage: worst case the event fires twice and FlowGlance dedupes on id.
      console.warn("[analytics] purchase dedupe unavailable", e);
    }
    const send = () => {
      try {
        window.fw?.("event", "purchase", { amount: amount / 100, currency: currency.toUpperCase(), item: sku, id: sessionId });
        try {
          localStorage.setItem(key, "1");
        } catch (e) {
          console.warn("[analytics] purchase dedupe not stored", e);
        }
      } catch (e) {
        console.warn("[analytics] purchase event failed", e);
      }
    };
    if (window.fw) {
      send();
      return;
    }
    window.addEventListener(ANALYTICS_LOADED_EVENT, send, { once: true });
    return () => window.removeEventListener(ANALYTICS_LOADED_EVENT, send);
  }, [sessionId, sku, amount, currency]);
  return null;
}
