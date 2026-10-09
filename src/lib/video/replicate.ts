import "server-only";
import { env, requireEnv } from "@/lib/env";
import { captureError } from "@/lib/errors";
import type { GenerateInput, Resolution, TaskState, TaskStatus, VideoProvider } from "./provider";

/*
 * Replicate-hosted Seedance 2.5 (`bytedance/seedance-2.5`).
 *
 * Mapping of our GenerateInput to the model's input, recorded from the model's OpenAPI
 * schema (GET https://replicate.com/bytedance/seedance-2.5/api/schema, read 2026-10-09):
 *
 *   prompt              ← input.prompt, with our @ImageN references rewritten to [ImageN]
 *                         (Replicate's schema: "Reference them in your prompt as [Image1],
 *                         [Image2], etc."; dialogue in double quotes drives the audio)
 *   reference_images    ← input.referenceImageUrls (array of URIs, up to 30; we send ≤ 8;
 *                         cannot be combined with `image`/`last_frame_image`, which we never set)
 *   duration            ← input.durationSec (integer, -1 … 30; -1 = model picks; we always set it)
 *   aspect_ratio        ← "9:16" (enum: 16:9, 4:3, 1:1, 3:4, 9:16, 21:9, adaptive)
 *   resolution          ← input.resolution clamped to the enum. The schema lists only
 *                         "480p" and "720p" today (no 1080p on this host), so the provider
 *                         reports maxResolution = "720p" and jobs.ts refuses 1080p before
 *                         any credit moves instead of silently delivering 720p.
 *   generate_audio      ← true (dialogue, sound effects; default true)
 *   seed                ← input.seed when set (integer, nullable; reproducibility not guaranteed)
 *   watermark           ← input.watermark (boolean, default false)
 *   output_format       ← "mp4" (enum: mp4, mov)
 *   not used            → image, last_frame_image, reference_videos, reference_audios
 *
 * At runtime the current schema is fetched once per hour through the authenticated model
 * endpoint (GET https://api.replicate.com/v1/models/bytedance/seedance-2.5 →
 * latest_version.openapi_schema.components.schemas.Input). Keys the live schema no longer
 * lists are dropped (and reported), enum values are clamped. If the schema call fails the
 * mapping above is used as recorded.
 *
 * Prediction lifecycle: POST /v1/models/bytedance/seedance-2.5/predictions with
 * `webhook` + `webhook_events_filter: ["completed"]`; GET /v1/predictions/{id} answers
 * status ∈ starting | processing | succeeded | failed | canceled and `output` (a URI, or an
 * array whose first entry is the URI). The token is only ever sent as a header and never logged.
 */

const API = "https://api.replicate.com/v1";
const MODEL = "bytedance/seedance-2.5";
const SCHEMA_TTL_MS = 60 * 60 * 1000;

export interface ReplicateInput {
  prompt: string;
  reference_images: string[];
  duration: number;
  aspect_ratio: "9:16";
  resolution: "480p" | "720p" | "1080p";
  generate_audio: boolean;
  watermark: boolean;
  output_format: "mp4";
  seed?: number;
}

/** The input schema as recorded above; used when the live schema cannot be read. */
export const RECORDED_SCHEMA: Record<string, { enum?: string[] }> = {
  prompt: {},
  reference_images: {},
  duration: {},
  aspect_ratio: { enum: ["16:9", "4:3", "1:1", "3:4", "9:16", "21:9", "adaptive"] },
  resolution: { enum: ["480p", "720p"] },
  generate_audio: {},
  watermark: {},
  output_format: { enum: ["mp4", "mov"] },
  seed: {},
};

const RESOLUTION_ORDER: Resolution[] = ["480p", "720p", "1080p"];

/** Our prompt addresses photos as @ImageN; Replicate's Seedance expects [ImageN]. */
export function toReplicatePrompt(prompt: string): string {
  return prompt.replace(/@Image(\d+)/g, "[Image$1]");
}

/** Highest of our resolutions that the schema's enum allows, never above the requested one. */
export function clampResolution(requested: Resolution, allowed: string[] | undefined): Resolution {
  const list = allowed && allowed.length ? allowed : RECORDED_SCHEMA.resolution!.enum!;
  const wanted = RESOLUTION_ORDER.indexOf(requested);
  for (let i = wanted; i >= 0; i--) {
    const r = RESOLUTION_ORDER[i]!;
    if (list.includes(r)) return r;
  }
  return "480p";
}

/** Pure mapping, tested without the network. `schema` is the live `Input.properties` or the recorded one. */
export function mapInput(input: GenerateInput, schema: Record<string, { enum?: string[] }> = RECORDED_SCHEMA): { input: Record<string, unknown>; dropped: string[] } {
  const full: ReplicateInput = {
    prompt: toReplicatePrompt(input.prompt),
    reference_images: input.referenceImageUrls.slice(0, 30),
    duration: Math.max(4, Math.min(30, Math.round(input.durationSec))),
    aspect_ratio: "9:16",
    resolution: clampResolution(input.resolution, schema.resolution?.enum),
    generate_audio: input.generateAudio,
    watermark: input.watermark,
    output_format: "mp4",
    ...(typeof input.seed === "number" ? { seed: Math.floor(input.seed) } : {}),
  };
  const out: Record<string, unknown> = {};
  const dropped: string[] = [];
  for (const [k, v] of Object.entries(full)) {
    if (k in schema) out[k] = v;
    else dropped.push(k);
  }
  return { input: out, dropped };
}

function headers(): Record<string, string> {
  return { Authorization: `Bearer ${requireEnv("REPLICATE_API_TOKEN")}`, "Content-Type": "application/json" };
}

let schemaCache: { at: number; props: Record<string, { enum?: string[] }>; maxResolution: Resolution } | null = null;

interface ModelMeta {
  latest_version?: { openapi_schema?: { components?: { schemas?: { Input?: { properties?: Record<string, { enum?: string[] }> } } } } };
}

/** The live input schema (cached an hour); the recorded mapping when the request fails. */
export async function liveSchema(): Promise<{ props: Record<string, { enum?: string[] }>; live: boolean }> {
  if (schemaCache && Date.now() - schemaCache.at < SCHEMA_TTL_MS) return { props: schemaCache.props, live: true };
  try {
    const res = await fetch(`${API}/models/${MODEL}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`replicate model metadata answered ${res.status}`);
    const meta = (await res.json()) as ModelMeta;
    const props = meta.latest_version?.openapi_schema?.components?.schemas?.Input?.properties;
    if (!props || typeof props !== "object" || !("prompt" in props)) throw new Error("replicate model metadata has no Input schema");
    schemaCache = { at: Date.now(), props, maxResolution: clampResolution("1080p", props.resolution?.enum) };
    return { props, live: true };
  } catch (err) {
    await captureError(err, { route: "video/replicate", severity: "warn", context: { step: "schema" } });
    return { props: RECORDED_SCHEMA, live: false };
  }
}

interface Prediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[] | null;
  error?: string | null;
}

export function toTaskStatus(p: Prediction): TaskStatus {
  const state: TaskState =
    p.status === "succeeded" ? "succeeded" : p.status === "failed" ? "failed" : p.status === "canceled" ? "expired" : p.status === "processing" ? "running" : "queued";
  if (state === "succeeded") {
    const url = Array.isArray(p.output) ? p.output[0] : p.output;
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return { state: "failed", error: "prediction succeeded without an output URL" };
    return { state, videoUrl: url };
  }
  if (state === "failed" || state === "expired") return { state, error: (p.error ?? "").toString().slice(0, 500) || "prediction did not complete" };
  return { state };
}

/** Replicate serves prediction output from replicate.delivery (and its subdomains). */
export function isReplicateOutputHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return h === "replicate.delivery" || h.endsWith(".replicate.delivery");
}

export const replicateProvider: VideoProvider = {
  name: "replicate",
  acceptsOutputUrl: (url) => url.protocol === "https:" && isReplicateOutputHost(url.hostname),
  // 720p is what the host's schema allows today (see the mapping notes above); refreshed from the live schema.
  get maxResolution(): Resolution {
    return schemaCache?.maxResolution ?? clampResolution("1080p", RECORDED_SCHEMA.resolution!.enum);
  },
  configured: () => Boolean(env("REPLICATE_API_TOKEN")),

  async create(input) {
    const { props } = await liveSchema();
    const mapped = mapInput(input, props);
    if (mapped.dropped.length) {
      await captureError(new Error(`replicate schema no longer lists: ${mapped.dropped.join(", ")}`), { route: "video/replicate", severity: "warn" });
    }
    const res = await fetch(`${API}/models/${MODEL}/predictions`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ input: mapped.input, webhook: input.callbackUrl, webhook_events_filter: ["completed"] }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 500);
      throw new Error(`replicate create answered ${res.status}: ${detail}`);
    }
    const p = (await res.json()) as Prediction;
    if (!p.id) throw new Error("replicate create returned no prediction id");
    return { taskId: p.id };
  },

  async status(taskId) {
    const res = await fetch(`${API}/predictions/${encodeURIComponent(taskId)}`, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (res.status === 404) return { state: "failed", error: "prediction not found" };
    if (!res.ok) throw new Error(`replicate status answered ${res.status}`);
    return toTaskStatus((await res.json()) as Prediction);
  },

  parseCallback(payload) {
    if (typeof payload !== "object" || payload === null) return null;
    const p = payload as Partial<Prediction>;
    if (typeof p.id !== "string") return null;
    return { taskId: p.id, state: p.status ? toTaskStatus({ id: p.id, status: p.status, output: p.output, error: p.error }).state : undefined };
  },
};
