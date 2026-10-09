import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { captureError, withErrorCapture } from "@/lib/errors";
import { deleteObject, headObject, readObjectHead, signedReadUrl } from "@/lib/files";
import { IMAGE_HEADER_BYTES, readImageInfo } from "@/lib/image-dims";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { UPLOAD_RULES } from "@/lib/upload-rules";
import { isResponse, requireUserApi } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = UPLOAD_RULES.maxBytes;
const MIN_EDGE = UPLOAD_RULES.minPx;
const MAX_EDGE = UPLOAD_RULES.maxPx;
const MAX_PHOTOS_PER_PRODUCT = UPLOAD_RULES.maxPhotos;

const Body = z.object({
  assetId: z.string().trim().min(1).max(64),
  width: z.number().int().positive().max(100_000),
  height: z.number().int().positive().max(100_000),
});

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Step two of a photo upload: confirms the object exists in the bucket (HEAD through the
 * files worker), reads its real format and pixel size from the file header (the browser's
 * numbers are only used to echo a faster message), records them and marks the asset ready.
 * Anything that is not a JPEG/PNG/WebP in range is rejected and removed from the bucket.
 */
export const POST = withErrorCapture("/api/uploads/complete", async (req: Request) => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  const rl = await rateLimit(`upcomplete:${session.userId}`, 120, 600);
  if (!rl.ok) return tooMany(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Please check the upload." }, { status: 400, headers: NO_STORE });
  const d = parsed.data;

  const rows = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, d.assetId), eq(assets.userId, session.userId)))
    .limit(1);
  const asset = rows[0];
  if (!asset) return Response.json({ error: "That upload was not started here." }, { status: 404, headers: NO_STORE });

  const view = (a: typeof asset) => ({
    id: a.id,
    productId: a.productId,
    kind: a.kind,
    status: a.status,
    contentType: a.contentType,
    bytes: a.bytes,
    width: a.width,
    height: a.height,
    createdAt: a.createdAt,
    url: signedReadUrl(a.objectKey, { disposition: "inline", filename: `${a.id}.${a.contentType.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg"}`, ttlSeconds: 600 }),
  });

  if (asset.status === "ready") return Response.json({ asset: view(asset) }, { headers: NO_STORE });
  if (asset.status === "rejected") return Response.json({ error: "This photo was rejected. Please upload another one." }, { status: 409, headers: NO_STORE });

  const head = await headObject(asset.objectKey);
  if (!head) return Response.json({ error: "The photo has not finished uploading. Please try again." }, { status: 409, headers: NO_STORE });

  const reject = async (message: string, dims: { width: number; height: number } | null) => {
    await db
      .update(assets)
      .set({ status: "rejected", bytes: head.bytes, width: dims?.width ?? null, height: dims?.height ?? null })
      .where(eq(assets.id, asset.id));
    try {
      await deleteObject(asset.objectKey);
    } catch (err) {
      await captureError(err, { route: "/api/uploads/complete", severity: "warn", context: { assetId: asset.id, stage: "delete-rejected" } });
    }
    return Response.json({ error: message }, { status: 400, headers: NO_STORE });
  };

  if (head.bytes <= 0 || head.bytes > MAX_UPLOAD_BYTES) return reject("Each photo must be 20 MB or smaller.", null);

  // The content type on the object is what the browser declared; the bytes decide.
  const header = await readObjectHead(asset.objectKey, IMAGE_HEADER_BYTES);
  const info = header ? readImageInfo(header) : null;
  if (!info) return reject("The file is not a JPEG, PNG or WebP photo.", null);
  if (info.type !== asset.contentType) return reject("The file is a different format than it claims. Please export it again and retry.", null);
  const dims = { width: info.width, height: info.height };
  if (Math.min(dims.width, dims.height) < MIN_EDGE) return reject(`Photos need to be at least ${MIN_EDGE} px on each side.`, dims);
  if (Math.max(dims.width, dims.height) > MAX_EDGE) return reject(`Photos can be at most ${MAX_EDGE} px on each side.`, dims);

  // Ready only while the product has a free slot: the count is part of the UPDATE, so three
  // uploads finishing together cannot push the product past the limit.
  const updated = await db
    .update(assets)
    .set({ status: "ready", bytes: head.bytes, contentType: info.type, width: dims.width, height: dims.height })
    .where(
      and(
        eq(assets.id, asset.id),
        eq(assets.userId, session.userId),
        eq(assets.status, "pending"),
        sql`(select count(*) from ${assets} a where a.product_id = ${asset.productId} and a.user_id = ${session.userId} and a.kind = 'image' and a.status = 'ready') < ${MAX_PHOTOS_PER_PRODUCT}`,
      ),
    )
    .returning();
  const row = updated[0];
  if (!row) {
    const now = await db.select({ status: assets.status }).from(assets).where(eq(assets.id, asset.id)).limit(1);
    if (now[0]?.status === "ready") return Response.json({ asset: view({ ...asset, status: "ready", bytes: head.bytes, width: dims.width, height: dims.height }) }, { headers: NO_STORE });
    return reject(`A product can have up to ${MAX_PHOTOS_PER_PRODUCT} photos. Remove one to add another.`, dims);
  }
  return Response.json({ asset: view(row) }, { headers: NO_STORE });
});
