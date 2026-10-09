import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, scripts } from "@/lib/db/schema";
import { features } from "@/lib/env";
import { withErrorCapture } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { rateLimit, tooMany } from "@/lib/ratelimit";
import { writeAiScript } from "@/lib/scripts/ai";
import { hasFatal, lintScript } from "@/lib/scripts/lint";
import { writeTemplateScript } from "@/lib/scripts/template";
import { ANGLES, countWords, LANGUAGES, MAX_HOOK_WORDS, TONES, wordBudget, type ScriptInput } from "@/lib/scripts/types";
import { isResponse, requireUserApi } from "@/lib/user";
import { DURATIONS } from "@/content/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const Body = z.object({
  productId: z.string().trim().min(1).max(64),
  language: z.enum(LANGUAGES),
  tone: z.enum(TONES),
  angle: z.enum(ANGLES),
  durationSec: z.union([z.literal(10), z.literal(15), z.literal(20), z.literal(30)]),
});

const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * "Write it for me": Claude when configured, the template writer otherwise; always linted. A
 * draft the compliance check blocks is returned for editing but not saved (id null): only
 * POST /api/scripts can turn it into a row, and that route refuses fatal findings too.
 */
export const POST = withErrorCapture("/api/scripts/generate", async (req: Request) => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;

  const rl = await rateLimit(`scriptgen:${session.userId}`, 40, 3600);
  if (!rl.ok) return tooMany(rl);

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pick a language, tone, angle and length first." }, { status: 400, headers: NO_STORE });
  const d = parsed.data;
  if (!DURATIONS.includes(d.durationSec)) return Response.json({ error: "Unsupported length." }, { status: 400, headers: NO_STORE });

  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, d.productId), eq(products.userId, session.userId), isNull(products.deletedAt)))
    .limit(1);
  const product = rows[0];
  if (!product) return Response.json({ error: "That product no longer exists." }, { status: 404, headers: NO_STORE });
  if (product.sellingPoints.length === 0) {
    return Response.json({ error: "Add at least one selling point to the product so there is something true to say." }, { status: 400, headers: NO_STORE });
  }

  const input: ScriptInput = {
    product: {
      name: product.name,
      brand: product.brand,
      category: product.category,
      sellingPoints: product.sellingPoints,
      audience: product.audience,
      priceText: product.priceText,
    },
    language: d.language,
    tone: d.tone,
    angle: d.angle,
    durationSec: d.durationSec,
  };

  const ai = features().aiWriter ? await writeAiScript(input) : null;
  const draft = ai ?? writeTemplateScript(input);
  const lint = lintScript(draft.fullText, { language: d.language });

  let id: string | null = null;
  if (!hasFatal(lint)) {
    id = newId("scr");
    await db.insert(scripts).values({
      id,
      userId: session.userId,
      productId: product.id,
      language: d.language,
      tone: d.tone,
      angle: d.angle,
      durationSec: d.durationSec,
      hook: draft.hook,
      body: draft.body,
      cta: draft.cta,
      fullText: draft.fullText,
      source: draft.source,
    });
  }

  return Response.json(
    {
      script: {
        id,
        ...draft,
        language: d.language,
        tone: d.tone,
        angle: d.angle,
        durationSec: d.durationSec,
        lint,
        wordCount: countWords(draft.fullText),
        wordBudget: wordBudget(d.durationSec),
        hookWords: countWords(draft.hook),
        maxHookWords: MAX_HOOK_WORDS,
        writer: draft.source === "ai" ? "ai" : "template",
      },
    },
    { headers: NO_STORE },
  );
});
