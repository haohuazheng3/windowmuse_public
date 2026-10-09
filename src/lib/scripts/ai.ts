import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { captureError } from "@/lib/errors";
import { countWords, fitToBudget, joinScript, languageName, MAX_HOOK_WORDS, wordBudget, type ScriptDraft, type ScriptInput } from "./types";

/*
 * "Write it for me" with Claude. Runtime-only: never called from scripts or tests. The
 * model writes as WindowMuse's fictional brand presenter under the same compliance rules
 * the linter enforces; the route lints the result anyway and the seller edits it before it
 * is spoken. Any failure (no key, timeout, refusal, bad JSON) returns null and the caller
 * falls back to the template writer, so the seller always gets a draft.
 */

export const AI_MODEL = "claude-sonnet-5-5";
const MAX_OUTPUT_TOKENS = 800;
const TIMEOUT_MS = 20_000;

const Draft = z.object({
  hook: z.string().min(1).max(200),
  body: z.string().min(1).max(1200),
  cta: z.string().min(1).max(200),
});

export const SYSTEM_PROMPT = `You write the spoken lines for a short vertical TikTok Shop video. A fictional on-camera presenter, created by the brand WindowMuse, holds the seller's real product and says why it is worth buying. Your lines will be spoken aloud and lip-synced by a video model.

Voice and honesty rules (non-negotiable):
- Speak as the brand's presenter about the product. Never as a customer: no "I've been using", "I bought", "my skin", "my results", "in my experience", no invented personal stories.
- Use only facts given in the brief (name, brand, category, selling points, audience). Never invent ingredients, materials, numbers, awards, reviews, ratings, prices, discounts or shipping terms.
- No medical claims: nothing cures, treats, prevents, heals or eliminates a condition. No weight-loss, fat-burning or muscle-gain promises. No "instant", "overnight", "miracle", "guaranteed", "clinically proven", "the best", "#1".
- No professional persona: the presenter is never a doctor, dermatologist, nurse, pharmacist, lawyer, scientist or expert, and never says professionals recommend the product.
- If a result is described with a timeframe or a before/after, add "Individual results may vary."
- Address the viewer as "you". Natural spoken rhythm, short sentences, contractions welcome, no hashtags, no emojis, no stage directions, no quotation marks inside the lines.

Structure: a hook (at most ${MAX_HOOK_WORDS} words, lands before the viewer swipes), a body (the product in use, built from the selling points in the requested angle and tone), and a call to action pointing to the shop link under the video. Keep the whole thing within the word budget: at ${2.5} spoken words per second, that is the budget given in the brief. Write in the language named in the brief.`;

function brief(input: ScriptInput): string {
  const p = input.product;
  const budget = wordBudget(input.durationSec);
  return [
    `Product: ${p.name}`,
    p.brand ? `Brand: ${p.brand}` : null,
    `Category: ${p.category}`,
    `Selling points (the only facts you may use):`,
    ...p.sellingPoints.map((s, i) => `  ${i + 1}. ${s}`),
    p.audience ? `Audience: ${p.audience}` : null,
    `Angle: ${input.angle}`,
    `Tone: ${input.tone}`,
    `Language of the lines: ${languageName(input.language)}`,
    `Video length: ${input.durationSec} seconds → word budget ${budget} words in total (hook + body + cta).`,
    `Return the hook, body and cta as JSON.`,
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");
}

/** Null when the writer is not configured or anything goes wrong; the caller then uses the template. */
export async function writeAiScript(input: ScriptInput): Promise<ScriptDraft | null> {
  const apiKey = env("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
  try {
    const response = await client.messages.parse({
      model: AI_MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: brief(input) }],
      output_config: { format: zodOutputFormat(Draft), effort: "low" },
    });
    if (response.stop_reason === "refusal" || response.stop_reason === "max_tokens" || !response.parsed_output) {
      await captureError(new Error(`AI writer returned no draft (stop_reason=${response.stop_reason})`), {
        route: "scripts/ai",
        severity: "warn",
        context: { angle: input.angle, tone: input.tone, language: input.language },
      });
      return null;
    }
    const raw = Draft.parse(response.parsed_output);
    const budget = wordBudget(input.durationSec);
    const fitted = fitToBudget(
      { hook: raw.hook.replace(/\s+/g, " ").trim(), body: raw.body.replace(/\s+/g, " ").trim(), cta: raw.cta.replace(/\s+/g, " ").trim() },
      budget,
    );
    if (countWords(fitted.hook) > MAX_HOOK_WORDS * 2 || countWords(joinScript(fitted)) > budget * 1.5) {
      // Far outside the brief: not worth showing; the template is the safer draft.
      return null;
    }
    return { ...fitted, fullText: joinScript(fitted), source: "ai" };
  } catch (err) {
    // Timeouts, rate limits and invalid output all land here; the seller still gets the template.
    await captureError(err, { route: "scripts/ai", severity: "warn", context: { angle: input.angle, tone: input.tone, language: input.language } });
    return null;
  }
}
