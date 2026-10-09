/**
 * Single source of truth for prices, credits and plan limits. Pure and client-safe:
 * the pricing page, the studio, the credit math and the Stripe bootstrap script all read
 * from here, so a number only ever changes in one place.
 */

import { PRESENTERS } from "@/content/presenters";

export type PlanSku = "starter" | "growth" | "pro";
export type PackSku = "pack10" | "pack50";
export type Sku = PlanSku | PackSku;

export type Resolution = "480p" | "720p" | "1080p";
export const RESOLUTIONS: readonly Resolution[] = ["480p", "720p", "1080p"];

export type DurationSec = 10 | 15 | 20 | 30;
export const DURATIONS: readonly DurationSec[] = [10, 15, 20, 30];

export interface Offer {
  sku: Sku;
  name: string;
  /** Whole US dollars. */
  priceUsd: number;
  credits: number;
  /** Monthly subscription, or null for a one-time pack. */
  interval: "month" | null;
  /** Benefit copy shown on the pricing page, in display order. */
  features: string[];
  /** Jobs that may be queued or running at once. Packs do not change the limit of the plan you are on. */
  maxParallel: number;
  allow1080p: boolean;
  /**
   * Plans: days the credits of a billing period stay usable after that period ends
   * (0 = they expire with the period). Packs: days the credits stay usable after purchase.
   */
  rolloverDays: number;
  /** Environment variable that holds the Stripe price id. */
  priceEnv: string;
  /** One-line summary under the name. */
  blurb: string;
}

export const PLANS: Record<PlanSku, Offer> = {
  starter: {
    sku: "starter",
    name: "Starter",
    priceUsd: 39,
    credits: 10,
    interval: "month",
    blurb: "For a shop testing its first presenter videos.",
    features: [
      "10 credits a month: ten videos up to 15 seconds, or five up to 30 seconds",
      "720p vertical MP4, no watermark",
      `All ${PRESENTERS.length} presenters, every tone and angle`,
      "Scripts written in 11 languages",
      "One video generating at a time",
      "Credits expire at the end of each billing month",
    ],
    maxParallel: 1,
    allow1080p: false,
    rolloverDays: 0,
    priceEnv: "STRIPE_PRICE_STARTER",
  },
  growth: {
    sku: "growth",
    name: "Growth",
    priceUsd: 99,
    credits: 30,
    interval: "month",
    blurb: "For sellers posting several times a week.",
    features: [
      "30 credits a month: thirty videos up to 15 seconds",
      "1080p exports as soon as the engine supports it (720p today)",
      "Three videos generating at once",
      "Unused credits roll over for one extra month",
      `All ${PRESENTERS.length} presenters, every tone and angle`,
      "Scripts written in 11 languages",
    ],
    maxParallel: 3,
    allow1080p: true,
    rolloverDays: 30,
    priceEnv: "STRIPE_PRICE_GROWTH",
  },
  pro: {
    sku: "pro",
    name: "Pro",
    priceUsd: 299,
    credits: 100,
    interval: "month",
    blurb: "For catalogs that need a video per listing.",
    features: [
      "100 credits a month: a hundred videos up to 15 seconds",
      "1080p exports as soon as the engine supports it (720p today)",
      "Three videos generating at once",
      "Unused credits roll over for one extra month",
      `All ${PRESENTERS.length} presenters, every tone and angle`,
      "Scripts written in 11 languages",
    ],
    maxParallel: 3,
    allow1080p: true,
    rolloverDays: 30,
    priceEnv: "STRIPE_PRICE_PRO",
  },
};

export const PACKS: Record<PackSku, Offer> = {
  pack10: {
    sku: "pack10",
    name: "10 credits",
    priceUsd: 35,
    credits: 10,
    interval: null,
    blurb: "A one-time top-up, no subscription.",
    features: ["10 credits, valid for 90 days", "Uses the limits of the plan you are on", "Pay once, no renewal"],
    maxParallel: 1,
    allow1080p: false,
    rolloverDays: 90,
    priceEnv: "STRIPE_PRICE_PACK_10",
  },
  pack50: {
    sku: "pack50",
    name: "50 credits",
    priceUsd: 150,
    credits: 50,
    interval: null,
    blurb: "The best per-video price without a subscription.",
    features: ["50 credits, valid for 90 days", "Uses the limits of the plan you are on", "Pay once, no renewal"],
    maxParallel: 1,
    allow1080p: false,
    rolloverDays: 90,
    priceEnv: "STRIPE_PRICE_PACK_50",
  },
};

export const OFFERS: Record<Sku, Offer> = { ...PLANS, ...PACKS };
export const SKUS: readonly Sku[] = ["starter", "growth", "pro", "pack10", "pack50"];
export const PLAN_SKUS: readonly PlanSku[] = ["starter", "growth", "pro"];
export const PACK_SKUS: readonly PackSku[] = ["pack10", "pack50"];

export function isSku(v: unknown): v is Sku {
  return typeof v === "string" && (SKUS as readonly string[]).includes(v);
}
export function isPlanSku(v: unknown): v is PlanSku {
  return typeof v === "string" && (PLAN_SKUS as readonly string[]).includes(v);
}

/** Free trial granted on first sign-in. */
export const TRIAL = {
  credits: 2,
  expiryDays: 30,
  resolution: "480p" as const satisfies Resolution,
  maxParallel: 1,
} as const;

/** Limits that apply when the user has no active subscription (trial credits or packs only). */
export const TRIAL_LIMITS = { maxParallel: TRIAL.maxParallel, allow1080p: false } as const;

/**
 * Credit cost of one video. 1 credit = ≤15 s at 720p (480p costs the same); 16–30 s = 2;
 * 1080p doubles. Pure, so the studio shows the price live while the seller changes options.
 */
export function costFor(input: { durationSec: number; resolution: Resolution }): number {
  const base = input.durationSec <= 15 ? 1 : 2;
  return input.resolution === "1080p" ? base * 2 : base;
}

/** "$39" for whole dollars, "$3.50" otherwise. */
export function formatPrice(usd: number): string {
  const whole = Number.isInteger(usd);
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

/** Price per credit, for the pricing comparison line ("$3.90 per video"). */
export function perCreditUsd(offer: Offer): number {
  return Math.round((offer.priceUsd / offer.credits) * 100) / 100;
}

export const CREDIT_RULES = {
  /** The rules in reading order, for FAQ, pricing and billing pages. */
  lines: [
    "1 credit = one video up to 15 seconds at 720p (480p costs the same).",
    "A 20- or 30-second video costs 2 credits.",
    "1080p doubles the cost of any length.",
    "Credits are reserved when you press Generate and only charged when the video succeeds. A failed generation never costs credits.",
    "The free trial is 2 credits at 480p, valid for 30 days.",
    "Starter credits expire at the end of each billing month; Growth and Pro credits stay usable for one extra month. Pack credits last 90 days.",
  ] as readonly string[],

  /** "1 credit" / "2 credits". */
  credits(n: number): string {
    return `${n} ${n === 1 ? "credit" : "credits"}`;
  },

  /** Live cost line for the Generate pane, e.g. "20 s at 1080p: 4 credits". */
  describeCost(input: { durationSec: number; resolution: Resolution }): string {
    return `${input.durationSec} s at ${input.resolution}: ${CREDIT_RULES.credits(costFor(input))}`;
  },

  /**
   * Why a resolution is unavailable right now, or null when it is allowed. `trialOnly` means
   * every usable credit is a trial credit; `engineMax` is the sharpest output the video engine
   * delivers today (jobs above it are refused before any credit moves).
   */
  resolutionNote(resolution: Resolution, allow1080p: boolean, trialOnly: boolean, engineMax?: Resolution): string | null {
    if (resolution === "1080p" && !allow1080p) return "1080p is included with Growth and Pro.";
    if (trialOnly && resolution !== TRIAL.resolution) return `Trial credits render at ${TRIAL.resolution}. Any paid plan or pack unlocks 720p.`;
    if (engineMax && RESOLUTIONS.indexOf(resolution) > RESOLUTIONS.indexOf(engineMax)) {
      return `${resolution} is not available on the video engine yet; the sharpest it delivers today is ${engineMax}.`;
    }
    return null;
  },

  /** How long credits from a given offer stay usable, in plain words. */
  expiryNote(offer: Offer): string {
    if (offer.interval === null) return `Valid for ${offer.rolloverDays} days after purchase.`;
    if (offer.rolloverDays === 0) return "Expire at the end of each billing month.";
    return `Unused credits stay usable for ${offer.rolloverDays} days after the billing month ends.`;
  },
} as const;
