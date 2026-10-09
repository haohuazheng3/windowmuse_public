"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/** Re-renders the server page every `seconds`, at most `max` times (used while a payment clears). Renders nothing. */
export function AutoRefresh({ seconds, max }: { seconds: number; max: number }) {
  const router = useRouter();
  const count = useRef(0);
  useEffect(() => {
    const t = window.setInterval(() => {
      count.current += 1;
      if (count.current > max) {
        window.clearInterval(t);
        return;
      }
      router.refresh();
    }, seconds * 1000);
    return () => window.clearInterval(t);
  }, [router, seconds, max]);
  return null;
}
