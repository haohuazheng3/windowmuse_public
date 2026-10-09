import { z } from "zod";
import type { ProductCategory } from "@/lib/db/schema";

/*
 * The product form, shared by the create flow (client) and the server actions. Pure and
 * client-safe: only a type is imported from the database schema. The label map is keyed
 * by ProductCategory, so adding or removing a category in the schema fails type-checking
 * here until the labels follow.
 */

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  beauty: "Beauty & makeup",
  skincare: "Skincare",
  fashion: "Fashion & apparel",
  accessories: "Accessories & jewelry",
  home: "Home & decor",
  kitchen: "Kitchen",
  electronics: "Electronics",
  "phone-accessories": "Phone accessories",
  "health-wellness": "Health & wellness",
  fitness: "Fitness & sports",
  "baby-kids": "Baby & kids",
  pets: "Pets",
  "toys-games": "Toys & games",
  stationery: "Stationery & office",
  "food-drink": "Food & drink",
  other: "Something else",
};

export const CATEGORY_VALUES = Object.keys(CATEGORY_LABELS) as [ProductCategory, ...ProductCategory[]];

export function categoryLabel(c: string): string {
  return (CATEGORY_LABELS as Record<string, string>)[c] ?? c;
}

export const PRODUCT_LIMITS = {
  name: 80,
  brand: 60,
  sellingPoint: 120,
  sellingPointsMin: 1,
  sellingPointsMax: 5,
  audience: 120,
  priceText: 40,
  shopUrl: 500,
} as const;

/** Optional free-text field: whitespace-only becomes undefined, so the database stores NULL instead of "". */
function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined));
}

function isHttpUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const productInputSchema = z.object({
  name: z.string().trim().min(1, "Give the product a name.").max(PRODUCT_LIMITS.name, `Keep the name under ${PRODUCT_LIMITS.name} characters.`),
  brand: optionalText(PRODUCT_LIMITS.brand),
  category: z.enum(CATEGORY_VALUES, { error: "Pick a category." }),
  sellingPoints: z
    .array(z.string().trim().min(1, "Empty selling point.").max(PRODUCT_LIMITS.sellingPoint, `Each selling point stays under ${PRODUCT_LIMITS.sellingPoint} characters.`))
    .min(PRODUCT_LIMITS.sellingPointsMin, "Add at least one selling point.")
    .max(PRODUCT_LIMITS.sellingPointsMax, `Up to ${PRODUCT_LIMITS.sellingPointsMax} selling points.`),
  audience: optionalText(PRODUCT_LIMITS.audience),
  priceText: optionalText(PRODUCT_LIMITS.priceText),
  shopUrl: optionalText(PRODUCT_LIMITS.shopUrl).refine((v) => v === undefined || isHttpUrl(v), "The shop link must start with https://"),
});

export type ProductInput = z.input<typeof productInputSchema>;
export type ProductParsed = z.output<typeof productInputSchema>;

/** First human-readable problem of a failed parse, for the inline form message. */
export function firstIssue(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "Please check the form.";
}
