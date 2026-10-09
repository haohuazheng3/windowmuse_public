import type { Resolution } from "@/content/plans";
import type { LanguageCode } from "@/content/presenters";
import { ANGLE_LABELS, TONE_LABELS, type Angle, type Tone } from "@/lib/scripts/types";

/*
 * Client-side state of the create flow. The product id lives in the URL (?product=); the
 * rest of a half-finished video (presenter, script, options) is stashed per product in
 * session storage so a refresh never loses work.
 */

export type { Angle, Tone };

/** Tone chips with the one-line hint shown under the group for the selected chip; values and labels come from the shared script vocabulary. */
export const TONE_CHIPS: { value: Tone; label: string; hint: string }[] = [
  { value: "friendly", label: TONE_LABELS.friendly, hint: "Warm, neighbourly, unhurried" },
  { value: "energetic", label: TONE_LABELS.energetic, hint: "Quick, bright, lots of movement" },
  { value: "calm-expert", label: TONE_LABELS["calm-expert"], hint: "Measured, specific, trustworthy" },
  { value: "playful", label: TONE_LABELS.playful, hint: "Light, a little cheeky" },
];

export const ANGLE_CHIPS: { value: Angle; label: string; hint: string }[] = [
  { value: "demo", label: ANGLE_LABELS.demo, hint: "Show it working, point by point" },
  { value: "unboxing", label: ANGLE_LABELS.unboxing, hint: "First look, what is in the box" },
  { value: "problem-solution", label: ANGLE_LABELS["problem-solution"], hint: "Name the annoyance, show the fix" },
  { value: "three-reasons", label: ANGLE_LABELS["three-reasons"], hint: "Three quick points, one ask" },
];

export interface ScriptOptions {
  language: LanguageCode;
  tone: Tone;
  angle: Angle;
  durationSec: 10 | 15 | 20 | 30;
}

export const DEFAULT_OPTIONS: ScriptOptions = { language: "en", tone: "friendly", angle: "demo", durationSec: 15 };

export type DraftSource = "ai" | "template" | "user";

export interface Draft {
  hook: string;
  body: string;
  cta: string;
  /** Who wrote the current text; null until something is written. */
  source: DraftSource | null;
  /** Id of the saved script row that matches the text and options, or null when unsaved/dirty. */
  savedId: string | null;
  /** A line the writer wants shown under the draft (e.g. the lines are in English, spoken in Thai). */
  note?: string;
}

export const EMPTY_DRAFT: Draft = { hook: "", body: "", cta: "", source: null, savedId: null };

/** The JSON shape of POST /api/scripts/generate's `script`. `id` is null when the draft is blocked by the compliance check (not saved). */
export interface GeneratedScript {
  id: string | null;
  hook: string;
  body: string;
  cta: string;
  fullText: string;
  source: DraftSource;
  note?: string;
  lint?: unknown;
}

export interface FlowStash {
  presenterId: string | null;
  options: ScriptOptions;
  draft: Draft;
  confirmed: boolean;
  resolution: Resolution;
}

function stashKey(productId: string): string {
  return `wm_flow_${productId}`;
}

export function readStash(productId: string): Partial<FlowStash> | null {
  try {
    const raw = sessionStorage.getItem(stashKey(productId));
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return typeof v === "object" && v !== null ? (v as Partial<FlowStash>) : null;
  } catch {
    return null;
  }
}

export function writeStash(productId: string, s: FlowStash): void {
  try {
    sessionStorage.setItem(stashKey(productId), JSON.stringify(s));
  } catch {
    /* private mode or quota: the URL still keeps the product */
  }
}

export function clearStash(productId: string): void {
  try {
    sessionStorage.removeItem(stashKey(productId));
  } catch {
    /* fine */
  }
}
