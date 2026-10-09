import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, products, scripts } from "@/lib/db/schema";
import { newId } from "@/lib/ids";
import { putObject, uploadKey } from "@/lib/files";
import { writeTemplateScript } from "@/lib/scripts/template";
import { createJob, type JobView } from "@/lib/video/jobs";
import { PRESENTERS } from "@/content/presenters";
import { solidPng } from "./png";

/*
 * The "mock video job" drill: a real job for the admin's own account on the mock provider.
 * Everything is the normal pipeline (product, photo in the files worker, saved script, credit
 * reservation, cron/callback completion, video in the bucket), so a green run proves the
 * whole chain without spending on a model.
 */

export const DIAGNOSTICS_PRODUCT_NAME = "Diagnostics kit (WindowMuse pipeline test)";

const PHOTO_SIZE = 320;

/** The admin's diagnostics product, created on first use; one ready photo is guaranteed. */
async function ensureProduct(userId: string): Promise<string> {
  const existing = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.userId, userId), eq(products.name, DIAGNOSTICS_PRODUCT_NAME), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt))
    .limit(1);
  let productId = existing[0]?.id;
  if (!productId) {
    productId = newId("prd");
    await db.insert(products).values({
      id: productId,
      userId,
      name: DIAGNOSTICS_PRODUCT_NAME,
      brand: "WindowMuse",
      category: "other",
      sellingPoints: ["Exercises the whole generation pipeline", "Costs nothing on the mock provider", "Safe to delete from the studio at any time"],
      audience: "The WindowMuse operator",
      priceText: null,
      shopUrl: null,
    });
  }
  const ready = await db
    .select({ id: assets.id })
    .from(assets)
    .where(and(eq(assets.userId, userId), eq(assets.productId, productId), eq(assets.status, "ready"), eq(assets.kind, "image")))
    .limit(1);
  if (!ready[0]) {
    const assetId = newId("ast");
    const key = uploadKey(userId, productId, assetId, "png");
    const png = solidPng(PHOTO_SIZE, PHOTO_SIZE, [0xe8, 0x56, 0x2a]); // the accent coral
    await putObject(key, png, "image/png");
    await db.insert(assets).values({
      id: assetId,
      userId,
      productId,
      kind: "image",
      objectKey: key,
      contentType: "image/png",
      bytes: png.byteLength,
      width: PHOTO_SIZE,
      height: PHOTO_SIZE,
      status: "ready",
    });
  }
  return productId;
}

async function saveScript(userId: string, productId: string, durationSec: number): Promise<string> {
  const draft = writeTemplateScript({
    product: {
      name: DIAGNOSTICS_PRODUCT_NAME,
      brand: "WindowMuse",
      category: "other",
      sellingPoints: ["Exercises the whole generation pipeline", "Costs nothing on the mock provider", "Safe to delete from the studio at any time"],
      audience: "The WindowMuse operator",
    },
    language: "en",
    tone: "friendly",
    angle: "demo",
    durationSec,
  });
  const id = newId("scr");
  await db.insert(scripts).values({
    id,
    userId,
    productId,
    language: "en",
    tone: "friendly",
    angle: "demo",
    durationSec,
    hook: draft.hook,
    body: draft.body,
    cta: draft.cta,
    fullText: draft.fullText,
    source: draft.source,
  });
  return id;
}

/**
 * Creates the drill job for the signed-in admin. Reserves one credit like any 10 s / 480p job.
 * The job is pinned to the mock engine whatever VIDEO_PROVIDER says (jobs.ts polls it against
 * mock too), so the drill works on production and can never spend on a real model.
 */
export async function createMockJob(userId: string): Promise<JobView> {
  const durationSec = 10;
  const productId = await ensureProduct(userId);
  const scriptId = await saveScript(userId, productId, durationSec);
  const presenterId = PRESENTERS[0].id;
  return createJob({ userId, productId, scriptId, presenterId, resolution: "480p", durationSec, engineOverride: "mock" });
}
