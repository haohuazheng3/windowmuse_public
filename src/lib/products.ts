import "server-only";
import { and, asc, desc, eq, isNull, inArray, sql } from "drizzle-orm";
import { db } from "./db";
import { assets, products, type AssetRow, type ProductRow } from "./db/schema";
import { signedReadUrl } from "./files";

/*
 * Reads for the studio. Every query is scoped by user_id; writes live in the server actions
 * next to the pages (src/app/(app)/studio/products/actions.ts) and in the upload routes.
 */

export interface ProductView {
  id: string;
  name: string;
  brand: string | null;
  category: ProductRow["category"];
  sellingPoints: string[];
  audience: string | null;
  priceText: string | null;
  shopUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** Ready photos, for the card thumbnail count. */
  photoCount: number;
}

export interface AssetView {
  id: string;
  productId: string;
  kind: AssetRow["kind"];
  status: AssetRow["status"];
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: Date;
  /** Signed inline URL (10 min) for thumbnails and the provider's reference images. */
  url: string;
}

/** Short-lived signed link; the file name is only a hint for the browser. */
function thumbnailUrl(a: AssetRow, ttlSeconds: number): string {
  const ext = a.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "bin";
  return signedReadUrl(a.objectKey, { disposition: "inline", filename: `${a.id}.${ext}`, ttlSeconds });
}

function toProduct(p: ProductRow, photoCount: number): ProductView {
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category,
    sellingPoints: p.sellingPoints,
    audience: p.audience,
    priceText: p.priceText,
    shopUrl: p.shopUrl,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    photoCount,
  };
}

export async function listProducts(userId: string): Promise<ProductView[]> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.userId, userId), isNull(products.deletedAt)))
    .orderBy(desc(products.updatedAt))
    .limit(200);
  if (rows.length === 0) return [];
  const counts = await db
    .select({ productId: assets.productId, n: sql<number>`count(*)::int` })
    .from(assets)
    .where(
      and(
        eq(assets.userId, userId),
        eq(assets.status, "ready"),
        eq(assets.kind, "image"),
        inArray(
          assets.productId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .groupBy(assets.productId);
  const byProduct = new Map(counts.map((c) => [c.productId, Number(c.n)]));
  return rows.map((p) => toProduct(p, byProduct.get(p.id) ?? 0));
}

export async function getProduct(userId: string, id: string): Promise<ProductView | null> {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, userId), isNull(products.deletedAt)))
    .limit(1);
  const p = rows[0];
  if (!p) return null;
  const counts = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(assets)
    .where(and(eq(assets.productId, p.id), eq(assets.userId, userId), eq(assets.status, "ready"), eq(assets.kind, "image")));
  return toProduct(p, Number(counts[0]?.n ?? 0));
}

/** Ready photos of a product, oldest first, each with a signed thumbnail link. */
export async function listAssets(
  userId: string,
  productId: string,
  opts: { status?: AssetRow["status"] | "any"; ttlSeconds?: number } = {},
): Promise<AssetView[]> {
  const status = opts.status ?? "ready";
  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.userId, userId), eq(assets.productId, productId), ...(status === "any" ? [] : [eq(assets.status, status)])))
    .orderBy(asc(assets.createdAt))
    .limit(50);
  const ttl = opts.ttlSeconds ?? 600;
  return rows.map((a) => ({
    id: a.id,
    productId: a.productId,
    kind: a.kind,
    status: a.status,
    contentType: a.contentType,
    bytes: a.bytes,
    width: a.width,
    height: a.height,
    createdAt: a.createdAt,
    url: thumbnailUrl(a, ttl),
  }));
}

export async function getAsset(userId: string, assetId: string): Promise<AssetRow | null> {
  const rows = await db.select().from(assets).where(and(eq(assets.id, assetId), eq(assets.userId, userId))).limit(1);
  return rows[0] ?? null;
}
