import { z } from "zod";
import { and, eq, gt, isNull, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { assets, products } from "@/lib/db/schema";
import { withErrorCapture } from "@/lib/errors";
import { signedUploadUrl, uploadKey } from "@/lib/files";
import { newId } from "@/lib/ids";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { isResponse, requireUserApi } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_PHOTOS_PER_PRODUCT = 8;
const UPLOAD_TTL_SECONDS = 15 * 60;
/** Per-user cap on signed links per window; each is a potential 20 MB object until completed or swept. */
const SIGNS_PER_WINDOW = 30;

const CONTENT_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

const Body = z.object({
  productId: z.string().trim().min(1).max(64),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES, "Each photo must be 20 MB or smaller."),
});

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Step one of a photo upload: a pending assets row and a 15-minute signed PUT link to the
 * files worker. The browser uploads straight to the worker, then calls /api/uploads/complete.
 */
export const POST = withErrorCapture("/api/uploads/sign", async (req: Request) => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  const rl = await rateLimit(`upsign:${session.userId}`, SIGNS_PER_WINDOW, 600);
  if (!rl.ok) return tooMany(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const msg = first?.path[0] === "contentType" ? "Photos must be JPEG, PNG or WebP." : (first?.message ?? "Please check the upload.");
    return Response.json({ error: msg }, { status: 400, headers: NO_STORE });
  }
  const d = parsed.data;

  const owned = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, d.productId), eq(products.userId, session.userId), isNull(products.deletedAt)))
    .limit(1);
  if (!owned[0]) return Response.json({ error: "That product no longer exists." }, { status: 404, headers: NO_STORE });

  // Slots are taken by ready photos and by uploads still inside their signed window, so a
  // seller cannot park an unbounded number of objects by never calling /complete.
  const taken = await db
    .select({ id: assets.id })
    .from(assets)
    .where(
      and(
        eq(assets.productId, d.productId),
        eq(assets.userId, session.userId),
        eq(assets.kind, "image"),
        or(eq(assets.status, "ready"), and(eq(assets.status, "pending"), gt(assets.createdAt, sql`now() - make_interval(secs => ${UPLOAD_TTL_SECONDS})`))),
      ),
    );
  if (taken.length >= MAX_PHOTOS_PER_PRODUCT) {
    return Response.json({ error: `A product can have up to ${MAX_PHOTOS_PER_PRODUCT} photos. Remove one to add another.` }, { status: 409, headers: NO_STORE });
  }

  const assetId = newId("ast");
  const key = uploadKey(session.userId, d.productId, assetId, CONTENT_TYPES[d.contentType]);
  await db.insert(assets).values({
    id: assetId,
    userId: session.userId,
    productId: d.productId,
    kind: "image",
    objectKey: key,
    contentType: d.contentType,
    bytes: d.bytes,
    status: "pending",
  });
  const uploadUrl = signedUploadUrl(key, { contentType: d.contentType, maxBytes: MAX_UPLOAD_BYTES, ttlSeconds: UPLOAD_TTL_SECONDS });
  return Response.json({ assetId, uploadUrl, key }, { headers: NO_STORE });
});
