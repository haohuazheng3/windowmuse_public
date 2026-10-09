import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, scripts } from "@/lib/db/schema";
import { withErrorCapture } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { hasFatal, lintScript } from "@/lib/scripts/lint";
import { ANGLES, countWords, joinScript, LANGUAGES, MAX_HOOK_WORDS, TONES, wordBudget } from "@/lib/scripts/types";
import { isResponse, requireUserApi } from "@/lib/user";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  productId: z.string().trim().min(1).max(64),
  hook: z.string().trim().min(1, "Write a hook.").max(400),
  body: z.string().trim().min(1, "Write the body.").max(2000),
  cta: z.string().trim().min(1, "Write a call to action.").max(400),
  language: z.enum(LANGUAGES),
  tone: z.enum(TONES),
  angle: z.enum(ANGLES),
  durationSec: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
});

const NO_STORE = { "Cache-Control": "private, no-store" };

/** Saves the script as the seller edited it; the saved row is what a job is generated from. */
export const POST = withErrorCapture("/api/scripts", async (req: Request) => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  const rl = await rateLimit(`scriptsave:${session.userId}`, 120, 600);
  if (!rl.ok) return tooMany(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Please check the script." }, { status: 400, headers: NO_STORE });
  }
  const d = parsed.data;

  const owned = await db
    .select({ id: products.id })
    .from(products)
    .where(and(eq(products.id, d.productId), eq(products.userId, session.userId), isNull(products.deletedAt)))
    .limit(1);
  if (!owned[0]) return Response.json({ error: "That product no longer exists." }, { status: 404, headers: NO_STORE });

  const fullText = joinScript(d);
  const lint = lintScript(fullText, { language: d.language });
  if (hasFatal(lint)) {
    return Response.json({ error: "Fix the compliance issues before generating.", lint }, { status: 422, headers: NO_STORE });
  }
  const budget = wordBudget(d.durationSec);
  const words = countWords(fullText);
  if (words > budget * 1.3) {
    return Response.json(
      { error: `${words} words is too many for ${d.durationSec} seconds (budget ${budget}). Shorten the script or choose a longer video.`, lint },
      { status: 422, headers: NO_STORE },
    );
  }

  const id = newId("scr");
  await db.insert(scripts).values({
    id,
    userId: session.userId,
    productId: d.productId,
    language: d.language,
    tone: d.tone,
    angle: d.angle,
    durationSec: d.durationSec,
    hook: d.hook,
    body: d.body,
    cta: d.cta,
    fullText,
    source: "user",
  });
  return Response.json(
    { script: { id, lint, wordCount: words, wordBudget: budget, hookWords: countWords(d.hook), maxHookWords: MAX_HOOK_WORDS } },
    { headers: NO_STORE },
  );
});
