import "server-only";
import { createHmac } from "node:crypto";
import { requireEnv } from "./env";

/**
 * Private files live in the R2 bucket behind the `windowmuse-files` Cloudflare Worker
 * (files.windowmuse.com). The site never holds R2 credentials:
 *  - browsers read with short-lived HMAC-signed URLs (`GET /d/<key>?exp&disp&name&sig`,
 *    Range supported, so videos seek) and upload product photos straight to the worker
 *    with signed `PUT /u/<key>?exp&ct&max&sig` links;
 *  - the server reads and writes objects through the bearer-protected `/o/<key>`.
 */

export type Disposition = "inline" | "attachment";

function base(): string {
  return requireEnv("FILES_BASE_URL").replace(/\/$/, "");
}

function encodeKey(key: string): string {
  return key
    .split("/")
    .map((p) => encodeURIComponent(p))
    .join("/");
}

function hmac(payload: string): string {
  return createHmac("sha256", requireEnv("FILES_SIGNING_SECRET")).update(payload).digest("hex");
}

/* ---------- object keys (one place, so worker CORS rules and cleanups can rely on the layout) ---------- */

const SAFE_SEGMENT = /^[A-Za-z0-9_-]{1,64}$/;

function segment(v: string, what: string): string {
  if (!SAFE_SEGMENT.test(v)) throw new Error(`unsafe ${what} for an object key`);
  return v;
}

/** `uploads/<userId>/<productId>/<assetId>.<ext>`: a seller's product photo. */
export function uploadKey(userId: string, productId: string, assetId: string, ext: string): string {
  const cleanExt = ext.replace(/^\./, "").toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(cleanExt)) throw new Error("unsafe file extension for an object key");
  return `uploads/${segment(userId, "user id")}/${segment(productId, "product id")}/${segment(assetId, "asset id")}.${cleanExt}`;
}

/** `videos/<userId>/<jobId>.mp4`: a finished generation. */
export function videoKey(userId: string, jobId: string): string {
  return `videos/${segment(userId, "user id")}/${segment(jobId, "job id")}.mp4`;
}

/* ---------- signed browser links ---------- */

/** Exactly what the worker verifies for `/d/`: HMAC over key, exp, disposition and filename. */
export function signReadPayload(key: string, exp: number, disposition: Disposition, filename: string): string {
  return hmac([key, String(exp), disposition, filename].join("\n"));
}

/** Exactly what the worker verifies for `/u/`: HMAC over "upload", key, exp, content type and byte cap. */
export function signUploadPayload(key: string, exp: number, contentType: string, maxBytes: number): string {
  return hmac(["upload", key, String(exp), contentType, String(maxBytes)].join("\n"));
}

export function signedReadUrl(key: string, opts: { disposition: Disposition; filename: string; ttlSeconds?: number }): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 600);
  const sig = signReadPayload(key, exp, opts.disposition, opts.filename);
  const qs = new URLSearchParams({ exp: String(exp), disp: opts.disposition, name: opts.filename, sig });
  return `${base()}/d/${encodeKey(key)}?${qs.toString()}`;
}

export function signedUploadUrl(key: string, opts: { contentType: string; maxBytes: number; ttlSeconds?: number }): string {
  const exp = Math.floor(Date.now() / 1000) + (opts.ttlSeconds ?? 900);
  const max = Math.max(1, Math.floor(opts.maxBytes));
  const sig = signUploadPayload(key, exp, opts.contentType, max);
  const qs = new URLSearchParams({ exp: String(exp), ct: opts.contentType, max: String(max), sig });
  return `${base()}/u/${encodeKey(key)}?${qs.toString()}`;
}

/* ---------- server-to-server object API ---------- */

function authHeaders(): Record<string, string> {
  return { Authorization: `Bearer ${requireEnv("FILES_API_TOKEN")}` };
}

export interface ObjectHead {
  bytes: number;
  contentType: string;
}

export async function headObject(key: string): Promise<ObjectHead | null> {
  const res = await fetch(`${base()}/o/${encodeKey(key)}`, { method: "HEAD", headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`files worker HEAD ${key} answered ${res.status}`);
  return {
    bytes: Number(res.headers.get("content-length") ?? 0),
    contentType: res.headers.get("content-type") ?? "application/octet-stream",
  };
}

/** Streams an object from the bucket; the caller owns the response body. */
export async function getObject(key: string): Promise<Response | null> {
  const res = await fetch(`${base()}/o/${encodeKey(key)}`, { headers: authHeaders(), cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`files worker GET ${key} answered ${res.status}`);
  return res;
}

export async function readObject(key: string): Promise<Uint8Array | null> {
  const res = await getObject(key);
  if (!res) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * The first `bytes` of an object (a Range request; a worker that answers with the whole
 * object is read up to the same length and then cancelled). Null when the object is missing.
 */
export async function readObjectHead(key: string, bytes: number): Promise<Uint8Array | null> {
  const res = await fetch(`${base()}/o/${encodeKey(key)}`, { headers: { ...authHeaders(), Range: `bytes=0-${Math.max(0, bytes - 1)}` }, cache: "no-store" });
  if (res.status === 404) return null;
  if (!res.ok || !res.body) throw new Error(`files worker GET ${key} (range) answered ${res.status}`);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let have = 0;
  try {
    while (have < bytes) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      have += value.byteLength;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const out = new Uint8Array(Math.min(have, bytes));
  let at = 0;
  for (const c of chunks) {
    const take = Math.min(c.byteLength, out.length - at);
    if (take <= 0) break;
    out.set(c.subarray(0, take), at);
    at += take;
  }
  return out;
}

/**
 * Writes an object. A ReadableStream body is forwarded without buffering (provider video
 * URL → bucket), which keeps the completion step inside a function's memory limit.
 */
export async function putObject(key: string, body: Uint8Array | ReadableStream<Uint8Array>, contentType: string): Promise<{ bytes: number | null }> {
  const streaming = body instanceof ReadableStream;
  const init: RequestInit & { duplex?: "half" } = {
    method: "PUT",
    headers: { ...authHeaders(), "Content-Type": contentType },
    body: streaming ? body : Buffer.from(body),
    ...(streaming ? { duplex: "half" } : {}),
  };
  const res = await fetch(`${base()}/o/${encodeKey(key)}`, init);
  if (!res.ok) throw new Error(`files worker PUT ${key} answered ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json().catch(() => ({}))) as { size?: number | null };
  return { bytes: typeof data.size === "number" ? data.size : null };
}

export async function deleteObject(key: string): Promise<void> {
  const res = await fetch(`${base()}/o/${encodeKey(key)}`, { method: "DELETE", headers: authHeaders() });
  if (!res.ok && res.status !== 404) throw new Error(`files worker DELETE ${key} answered ${res.status}`);
}
