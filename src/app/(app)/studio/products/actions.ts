"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, products } from "@/lib/db/schema";
import { captureError } from "@/lib/errors";
import { deleteObject } from "@/lib/files";
import { newId } from "@/lib/ids";
import { firstIssue, productInputSchema, type ProductInput } from "@/lib/product-schema";
import { requireUser } from "@/lib/user";

/*
 * Product writes. Every action re-checks the session and scopes its query by user_id.
 * Results are returned, never thrown: Next masks thrown messages from server actions in
 * production, and the form needs the real reason to show it inline.
 */

export type ActionResult<T extends object = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

const GENERIC = "Something went wrong on our side. Please try again.";

export async function createProduct(input: ProductInput): Promise<ActionResult<{ id: string }>> {
  const { userId } = await requireUser();
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  const id = newId("prd");
  try {
    await db.insert(products).values({
      id,
      userId,
      name: v.name,
      brand: v.brand ?? null,
      category: v.category,
      sellingPoints: v.sellingPoints,
      audience: v.audience ?? null,
      priceText: v.priceText ?? null,
      shopUrl: v.shopUrl ?? null,
    });
  } catch (err) {
    await captureError(err, { route: "action:createProduct", source: "server", context: { userId } });
    return { ok: false, error: GENERIC };
  }
  revalidatePath("/studio/products");
  return { ok: true, id };
}

export async function updateProduct(id: string, input: ProductInput): Promise<ActionResult> {
  const { userId } = await requireUser();
  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };
  const v = parsed.data;
  try {
    const rows = await db
      .update(products)
      .set({
        name: v.name,
        brand: v.brand ?? null,
        category: v.category,
        sellingPoints: v.sellingPoints,
        audience: v.audience ?? null,
        priceText: v.priceText ?? null,
        shopUrl: v.shopUrl ?? null,
        updatedAt: sql`now()`,
      })
      .where(and(eq(products.id, id), eq(products.userId, userId), isNull(products.deletedAt)))
      .returning({ id: products.id });
    if (rows.length === 0) return { ok: false, error: "This product no longer exists." };
  } catch (err) {
    await captureError(err, { route: "action:updateProduct", source: "server", context: { userId, id } });
    return { ok: false, error: GENERIC };
  }
  revalidatePath("/studio/products");
  revalidatePath(`/studio/products/${id}`);
  return { ok: true };
}

/**
 * Deletes a product: the row is soft-deleted (job records keep pointing at it), its photos are
 * removed from storage right away (what the privacy policy promises), scripts stay attached to
 * the videos made from them, and finished videos follow the video retention period.
 */
export async function deleteProduct(id: string): Promise<ActionResult> {
  const { userId } = await requireUser();
  let photos: { id: string; objectKey: string }[] = [];
  try {
    const rows = await db
      .update(products)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(and(eq(products.id, id), eq(products.userId, userId), isNull(products.deletedAt)))
      .returning({ id: products.id });
    if (rows.length === 0) return { ok: false, error: "This product no longer exists." };
    photos = await db
      .delete(assets)
      .where(and(eq(assets.productId, id), eq(assets.userId, userId), eq(assets.kind, "image")))
      .returning({ id: assets.id, objectKey: assets.objectKey });
  } catch (err) {
    await captureError(err, { route: "action:deleteProduct", source: "server", context: { userId, id } });
    return { ok: false, error: GENERIC };
  }
  for (const p of photos) {
    try {
      await deleteObject(p.objectKey);
    } catch (err) {
      // The rows are gone, so nothing shows the photo; an orphaned object is a storage cost, picked up by an operator.
      await captureError(err, { route: "action:deleteProduct:object", source: "server", severity: "warn", context: { userId, id, assetId: p.id, objectKey: p.objectKey } });
    }
  }
  revalidatePath("/studio/products");
  return { ok: true };
}

/** Removes one photo: the row goes first (the seller's intent), the object is cleaned up best-effort. */
export async function removeAsset(assetId: string): Promise<ActionResult> {
  const { userId } = await requireUser();
  let objectKey: string | null = null;
  try {
    const rows = await db
      .delete(assets)
      .where(and(eq(assets.id, assetId), eq(assets.userId, userId), eq(assets.kind, "image")))
      .returning({ objectKey: assets.objectKey, productId: assets.productId });
    const row = rows[0];
    if (!row) return { ok: false, error: "This photo was already removed." };
    objectKey = row.objectKey;
    revalidatePath(`/studio/products/${row.productId}`);
  } catch (err) {
    await captureError(err, { route: "action:removeAsset", source: "server", context: { userId, assetId } });
    return { ok: false, error: GENERIC };
  }
  try {
    await deleteObject(objectKey);
  } catch (err) {
    // The row is gone, so the studio no longer shows the photo; an orphaned object is a storage cost, not a user-facing bug.
    await captureError(err, { route: "action:removeAsset:object", source: "server", severity: "warn", context: { userId, assetId, objectKey } });
  }
  return { ok: true };
}
