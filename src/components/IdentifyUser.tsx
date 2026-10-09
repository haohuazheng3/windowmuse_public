"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect } from "react";
import { ANALYTICS_LOADED_EVENT } from "./Consent";

/**
 * Ties FlowGlance sessions to the signed-in seller (Clerk id + email) so a support
 * conversation can be matched to what the person actually saw. Fires once the analytics
 * snippet is ready; a no-op while consent is withheld.
 */
export function IdentifyUser() {
  const { user, isSignedIn } = useUser();
  const userRef = user?.id ?? null;
  const email = user?.primaryEmailAddress?.emailAddress ?? null;

  useEffect(() => {
    if (!isSignedIn || !userRef) return;
    const send = () => {
      try {
        window.fw?.("identify", { userRef, email });
      } catch (e) {
        console.warn("[analytics] identify failed", e);
      }
    };
    if (window.fw) send();
    window.addEventListener(ANALYTICS_LOADED_EVENT, send);
    return () => window.removeEventListener(ANALYTICS_LOADED_EVENT, send);
  }, [isSignedIn, userRef, email]);

  return null;
}
