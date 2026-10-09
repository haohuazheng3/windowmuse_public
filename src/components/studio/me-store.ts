"use client";

import { useSyncExternalStore } from "react";
import { RESOLUTIONS, type Resolution, type Sku } from "@/content/plans";
import type { Features, VideoEngine } from "@/lib/env";

/*
 * The signed-in seller as GET /api/me describes them: plan limits, credit balance, which
 * optional engines are on. One module-level store feeds the header badge and every pane
 * of the create flow, so a reservation made in one place shows everywhere at once.
 * A session-storage copy makes the numbers appear before the first fetch answers; the
 * server is still the truth and overwrites it on every load.
 */

export interface Me {
  email: string;
  plan: { sku: Sku | "trial"; maxParallel: number; allow1080p: boolean };
  balance: { available: number; reserved: number };
  /** Every usable credit is a trial credit: videos render at 480p until a plan or pack is bought. */
  onlyTrialCredits: boolean;
  features: Features;
  /** The engine /api/jobs will send to and the sharpest output it delivers today. */
  engine: { name: VideoEngine; configured: boolean; maxResolution: Resolution };
}

export type MeStatus = "idle" | "loading" | "ready" | "error" | "signed-out";

export interface MeState {
  me: Me | null;
  status: MeStatus;
  /** Epoch ms of the last successful fetch. */
  fetchedAt: number;
}

const CACHE_KEY = "wm_me_v2";
const FRESH_MS = 30 * 1000;
const SERVER_STATE: MeState = { me: null, status: "idle", fetchedAt: 0 };

let state: MeState = SERVER_STATE;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function set(next: MeState) {
  state = next;
  emit();
}

function isMe(v: unknown): v is Me {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  const plan = o.plan as Record<string, unknown> | undefined;
  const balance = o.balance as Record<string, unknown> | undefined;
  const engine = o.engine as Record<string, unknown> | undefined;
  return (
    typeof o.email === "string" &&
    !!plan &&
    typeof plan.sku === "string" &&
    typeof plan.maxParallel === "number" &&
    typeof plan.allow1080p === "boolean" &&
    !!balance &&
    typeof balance.available === "number" &&
    typeof balance.reserved === "number" &&
    typeof o.onlyTrialCredits === "boolean" &&
    typeof o.features === "object" &&
    o.features !== null &&
    !!engine &&
    typeof engine.name === "string" &&
    typeof engine.configured === "boolean" &&
    (RESOLUTIONS as readonly string[]).includes(String(engine.maxResolution))
  );
}

function readCache(): Me | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isMe(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeCache(me: Me | null) {
  try {
    if (me) sessionStorage.setItem(CACHE_KEY, JSON.stringify(me));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* private mode or quota: the fetch still rendered */
  }
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): MeState {
  return state;
}

export function getServerSnapshot(): MeState {
  return SERVER_STATE;
}

/** Fetches /api/me unless a fresh answer is already in hand; concurrent callers share one request. */
export function loadMe(opts: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  if (!opts.force && state.status === "ready" && Date.now() - state.fetchedAt < FRESH_MS) return Promise.resolve();
  if (state.status === "idle") {
    const cached = readCache();
    if (cached) set({ me: cached, status: "loading", fetchedAt: 0 });
    else set({ ...state, status: "loading" });
  } else {
    set({ ...state, status: "loading" });
  }
  inFlight = (async () => {
    try {
      const res = await fetch("/api/me", { cache: "no-store", headers: { accept: "application/json" } });
      if (res.status === 401) {
        writeCache(null);
        set({ me: null, status: "signed-out", fetchedAt: Date.now() });
        return;
      }
      if (!res.ok) throw new Error(`/api/me answered ${res.status}`);
      const body: unknown = await res.json();
      if (!isMe(body)) throw new Error("/api/me answered an unexpected shape");
      writeCache(body);
      set({ me: body, status: "ready", fetchedAt: Date.now() });
    } catch (e) {
      console.warn("[me] load failed", e);
      // Keep whatever we showed (cached or previous) so the UI never blanks out on a flaky connection.
      set({ ...state, status: "error" });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Optimistic balance change the moment a reservation is made (negative) or a job is released (positive). */
export function adjustCredits(delta: number): void {
  if (!state.me) return;
  const available = Math.max(0, state.me.balance.available + delta);
  const reserved = Math.max(0, state.me.balance.reserved - delta);
  const me: Me = { ...state.me, balance: { available, reserved } };
  writeCache(me);
  set({ ...state, me });
}

export function useMe(): MeState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Plan name for the UI ("Free trial", "Growth"). */
export function planLabel(sku: Sku | "trial"): string {
  switch (sku) {
    case "trial":
      return "Free trial";
    case "starter":
      return "Starter";
    case "growth":
      return "Growth";
    case "pro":
      return "Pro";
    case "pack10":
      return "10-credit pack";
    case "pack50":
      return "50-credit pack";
  }
}
