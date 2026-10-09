/**
 * Builds the generation prompt for one job. Pure and unit-tested: given the presenter, the
 * product, the script and the options, it returns the text the provider sends to Seedance.
 *
 * Conventions (docs/research/seedance-2.5-api-brief.md):
 *  - reference images are addressed as @Image1 … @ImageN (BytePlus form; the Replicate
 *    provider rewrites them to [ImageN], its own form, when it maps the input);
 *  - spoken lines go in double quotes with the language named first so the model voices
 *    them natively and lip-syncs; BytePlus also accepts {…} for dialogue;
 *  - the product is only ever the seller's photos, never redrawn.
 */
import { promptDescription, type Presenter } from "@/content/presenters";
import { languageName, type Angle, type LanguageCode, type Tone } from "@/lib/scripts/types";

export interface PromptProduct {
  name: string;
  brand?: string | null;
  category: string;
}

export interface PromptScript {
  hook: string;
  body: string;
  cta: string;
}

export interface PromptInput {
  presenter: Presenter;
  product: PromptProduct;
  script: PromptScript;
  language: LanguageCode;
  tone: Tone;
  angle: Angle;
  durationSec: number;
  /** How many reference photos are attached, in order; the prompt names each one. */
  imageCount: number;
}

export const MAX_REFERENCE_IMAGES = 8;

/** "@Image1" … "@ImageN" (at least one, at most MAX_REFERENCE_IMAGES). */
export function imageRefs(count: number): string[] {
  const n = Math.max(1, Math.min(MAX_REFERENCE_IMAGES, Math.floor(count)));
  return Array.from({ length: n }, (_, i) => `@Image${i + 1}`);
}

function listRefs(refs: string[]): string {
  if (refs.length === 1) return refs[0]!;
  if (refs.length === 2) return `${refs[0]} and ${refs[1]}`;
  return `${refs.slice(0, -1).join(", ")} and ${refs[refs.length - 1]}`;
}

const TONE_DIRECTION: Record<Tone, string> = {
  friendly: "warm and unhurried, like showing a friend something good; easy smile, relaxed shoulders",
  energetic: "bright and quick, upbeat without shouting; leans in slightly, crisp gestures",
  "calm-expert": "composed and precise, measured pace, small deliberate gestures, confident eye contact",
  playful: "light and amused, a raised eyebrow, quick reactions, enjoys the moment",
};

const ANGLE_BEATS: Record<Angle, string> = {
  demo: "opens on the presenter holding the product, then uses or handles it exactly as it is meant to be used, turning it so the camera sees the key details named in the lines",
  unboxing: "opens on the closed package in hand, opens it on camera, lifts the product out and turns it toward the lens as each feature is mentioned",
  "problem-solution": "opens with the presenter speaking straight to the lens about the problem, then lifts the product into frame as the solution and shows the relevant detail",
  "three-reasons": "the presenter counts the three reasons on their fingers and brings the product closer to the lens for each one",
};

/** Cleans a spoken line for the prompt: one paragraph, no inner double quotes, no stage directions. */
export function cleanLine(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/["“”]/g, "'")
    .replace(/\[[^\]]*\]|\([^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** The dialogue block: language named explicitly, lines in double quotes. */
export function spokenLines(presenterName: string, language: LanguageCode, script: PromptScript): string {
  const text = [script.hook, script.body, script.cta].map(cleanLine).filter(Boolean).join(" ");
  const delivery = language === "en" ? "" : `, delivering the lines in ${languageName(language)} even where they are written in English`;
  return `${presenterName} speaks in ${languageName(language)}${delivery}, lip-synced, natural pace, no other voices: "${text}"`;
}

export function buildPrompt(input: PromptInput): string {
  const { presenter, product, script, language, tone, angle, durationSec } = input;
  const refs = imageRefs(input.imageCount);
  const brand = product.brand && !product.name.toLowerCase().includes(product.brand.toLowerCase()) ? ` by ${product.brand}` : "";
  const lines = [
    `Vertical 9:16 short video, ${durationSec} seconds, one continuous handheld take, realistic UGC phone footage, natural daylight.`,
    `Presenter: ${promptDescription(presenter)}`,
    `Product: ${product.name}${brand} (${product.category}). The presenter holds and shows the product in ${listRefs(refs)} exactly as photographed: same packaging, colours, label, logo and proportions. The product is never redrawn, resized, recoloured or replaced; use the photos for the product's appearance only, not for their background.`,
    `Setting: ${presenter.setting}`,
    `Camera: vertical phone framing, chest-up, the presenter looks into the lens, slight natural handheld movement, the product brought close to the lens when it is mentioned, shallow depth of field.`,
    `Performance: ${TONE_DIRECTION[tone]}. Action: ${ANGLE_BEATS[angle]}.`,
    spokenLines(presenter.name, language, script),
    `No on-screen text, no subtitles, no captions, no music, no sound effects other than natural room tone, no other people, no logos other than the product's own, no brand names that are not on the product.`,
  ];
  return lines.join("\n");
}
