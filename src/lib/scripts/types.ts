/**
 * Shared, client-safe vocabulary of the script writer: languages, tones, angles, lengths,
 * the word budget and the draft shape. The studio's Script pane, the writers (template
 * and AI), the linter and the prompt builder all read from here.
 */
import { LANGUAGE_NAMES, type LanguageCode } from "@/content/presenters";
import { DURATIONS, type DurationSec } from "@/content/plans";

export type { LanguageCode };
export { LANGUAGE_NAMES };

export const LANGUAGES: readonly LanguageCode[] = ["en", "zh", "es", "id", "ms", "th", "ar", "pt", "vi", "ja", "ko"];

export const TONES = ["friendly", "energetic", "calm-expert", "playful"] as const;
export type Tone = (typeof TONES)[number];

export const ANGLES = ["demo", "unboxing", "problem-solution", "three-reasons"] as const;
export type Angle = (typeof ANGLES)[number];

export { DURATIONS };
export type { DurationSec };

export const TONE_LABELS: Record<Tone, string> = {
  friendly: "Friendly",
  energetic: "Energetic",
  "calm-expert": "Calm expert",
  playful: "Playful",
};

export const ANGLE_LABELS: Record<Angle, string> = {
  demo: "Demo",
  unboxing: "Unboxing",
  "problem-solution": "Problem → solution",
  "three-reasons": "Three reasons",
};

/** Spoken words per second the presenters are paced at; the budget the UI counts against. */
export const WORDS_PER_SECOND = 2.5;

/** The hook must land before the viewer swipes: at most this many words. */
export const MAX_HOOK_WORDS = 12;

export interface ScriptProduct {
  name: string;
  brand?: string | null;
  category: string;
  sellingPoints: string[];
  audience?: string | null;
  priceText?: string | null;
}

export interface ScriptInput {
  product: ScriptProduct;
  language: LanguageCode;
  tone: Tone;
  angle: Angle;
  durationSec: number;
}

export type ScriptSource = "ai" | "template" | "user";

export interface ScriptDraft {
  hook: string;
  body: string;
  cta: string;
  fullText: string;
  source: ScriptSource;
  /** A line the UI shows under the draft, e.g. that the lines are in English and spoken in another language. */
  note?: string;
}

export function wordBudget(durationSec: number): number {
  return Math.floor(durationSec * WORDS_PER_SECOND);
}

const CJK = /[぀-ヿ㐀-䶿一-鿿豈-﫿가-힯฀-๿]/g;

/**
 * Spoken-word count. Space-delimited languages count whitespace tokens that carry a letter
 * or digit; Chinese, Japanese, Korean and Thai have no spaces, so their characters are
 * converted at roughly 1.6 syllables per English-paced word.
 */
export function countWords(text: string): number {
  const cjk = text.match(CJK)?.length ?? 0;
  const rest = text.replace(CJK, " ");
  const tokens = rest.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
  return tokens + Math.round(cjk / 1.6);
}

export function joinScript(parts: { hook: string; body: string; cta: string }): string {
  return [parts.hook, parts.body, parts.cta]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ");
}

/** Splits prose into sentences, keeping terminal punctuation. */
export function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Trims a draft to the word budget by dropping body sentences from the end (never the hook
 * or the call to action). Returns the same object when it already fits.
 */
export function fitToBudget<T extends { hook: string; body: string; cta: string }>(draft: T, budget: number): T {
  const total = () => countWords(joinScript(draft));
  if (total() <= budget) return draft;
  const body = sentences(draft.body);
  let out = { ...draft };
  while (body.length > 1 && countWords(joinScript(out)) > budget) {
    body.pop();
    out = { ...out, body: body.join(" ") };
  }
  return out;
}

export function languageName(code: string): string {
  return (LANGUAGE_NAMES as Record<string, string>)[code] ?? code;
}

export function isLanguage(v: unknown): v is LanguageCode {
  return typeof v === "string" && (LANGUAGES as readonly string[]).includes(v);
}
export function isTone(v: unknown): v is Tone {
  return typeof v === "string" && (TONES as readonly string[]).includes(v);
}
export function isAngle(v: unknown): v is Angle {
  return typeof v === "string" && (ANGLES as readonly string[]).includes(v);
}
