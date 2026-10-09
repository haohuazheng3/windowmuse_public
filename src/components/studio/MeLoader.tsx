"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect } from "react";
import { loadMe } from "./me-store";

/** Loads /api/me once the session is known and refreshes it when the tab comes back into focus. */
export function MeLoader() {
  const { isLoaded, isSignedIn } = useAuth();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void loadMe();
    const onFocus = () => {
      if (document.visibilityState === "visible") void loadMe();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [isLoaded, isSignedIn]);

  return null;
}
