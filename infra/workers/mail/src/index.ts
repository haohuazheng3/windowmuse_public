/**
 * WindowMuse mail worker.
 *
 * email()     Cloudflare Email Routing hands over mail for test@windowmuse.com and every
 *             unrouted address. We parse it and POST it to the app's test inbox, keeping the
 *             receiving server's SPF / DKIM / DMARC verdicts. Never rejects: a broken app must
 *             not bounce mail back to a sender.
 * fetch()     POST /notify (Bearer NOTIFY_TOKEN) emails the owner through the send_email
 *             binding. GET /health answers 200.
 * scheduled() Every 30 minutes: probe https://windowmuse.com/api/health (200 = database up and
 *             required config present; open errors never fail it). Alerts on state change only:
 *             DOWN after 2 consecutive failed probes, one reminder per 24 h while down, one
 *             RECOVERED when it passes again (src/alerting.ts). State lives in KV (HEALTH_KV).
 */
import PostalMime from "postal-mime";
import { EmailMessage } from "cloudflare:email";
import { afterSendFailure, alertEmail, decide, parseState, sameState, type HealthState } from "./alerting";

export interface Env {
  APP_URL: string;
  OWNER_EMAIL: string;
  INBOX_INGEST_SECRET: string;
  NOTIFY_TOKEN: string;
  OWNER_MAIL: { send(message: EmailMessage): Promise<void> };
  /** Probe state (key STATE_KEY). The Cache API used before does not persist on workers.dev / cron, which re-sent the alert every run. */
  HEALTH_KV: KVNamespace;
}

interface IncomingEmail {
  readonly from: string;
  readonly to: string;
  readonly headers: Headers;
  readonly raw: ReadableStream<Uint8Array>;
  readonly rawSize: number;
}

const FROM_ADDRESS = "alerts@windowmuse.com";
const FROM_DISPLAY = "WindowMuse Alerts";
const MAX_BODY_CHARS = 200_000;
const STATE_KEY = "health-state";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
}

function bearerMatches(req: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!presented) return false;
  const a = new TextEncoder().encode(presented);
  const b = new TextEncoder().encode(secret);
  if (a.byteLength !== b.byteLength) return false;
  let diff = 0;
  for (let i = 0; i < a.byteLength; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function truncate(s: string | undefined | null, max: number): string | undefined {
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max)}\n[truncated]` : s;
}

/* ---------- outbound: a plain-text RFC 5322 message, built by hand ---------- */

function base64Utf8(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function wrap76(s: string): string {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += 76) out.push(s.slice(i, i + 76));
  return out.join("\r\n");
}

function headerWord(s: string): string {
  return /^[\x20-\x7e]*$/.test(s) ? s : `=?utf-8?B?${base64Utf8(s)}?=`;
}

function buildMime(to: string, subject: string, text: string, replyTo?: string): string {
  const headers = [
    `From: ${FROM_DISPLAY} <${FROM_ADDRESS}>`,
    `To: <${to}>`,
    ...(replyTo && /^[^\s<>@]+@[^\s<>@]+$/.test(replyTo) ? [`Reply-To: <${replyTo}>`] : []),
    `Subject: ${headerWord(subject.replace(/[\r\n]+/g, " ").slice(0, 900))}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@windowmuse.com>`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "Content-Transfer-Encoding: base64",
    "X-Mailer: windowmuse-mail",
  ];
  return `${headers.join("\r\n")}\r\n\r\n${wrap76(base64Utf8(text))}\r\n`;
}

async function sendToOwner(env: Env, subject: string, text: string, replyTo?: string): Promise<void> {
  await env.OWNER_MAIL.send(new EmailMessage(FROM_ADDRESS, env.OWNER_EMAIL, buildMime(env.OWNER_EMAIL, subject, text, replyTo)));
}

/* ---------- inbound ---------- */

function verdict(auth: string, mech: "spf" | "dkim" | "dmarc"): string | undefined {
  const m = new RegExp(`\\b${mech}=([a-z]+)`, "i").exec(auth);
  return m ? m[1].toLowerCase() : undefined;
}

async function ingest(message: IncomingEmail, env: Env): Promise<void> {
  const parsed = await PostalMime.parse(message.raw);
  const headers: Record<string, string> = {};
  for (const h of parsed.headers) {
    const key = h.key.toLowerCase();
    if (!["authentication-results", "arc-authentication-results", "received-spf", "dkim-signature", "from", "to", "subject", "date", "message-id", "return-path"].includes(key)) continue;
    headers[key] = key in headers ? `${headers[key]}\n${h.value}` : h.value;
  }
  for (const key of ["authentication-results", "arc-authentication-results", "received-spf"]) {
    const v = message.headers.get(key);
    if (v && !headers[key]) headers[key] = v;
  }
  const auth = [headers["authentication-results"], headers["arc-authentication-results"]].filter(Boolean).join("\n");

  const res = await fetch(`${env.APP_URL.replace(/\/$/, "")}/api/inbox/ingest`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${env.INBOX_INGEST_SECRET}`, "user-agent": "windowmuse-mail/1.0" },
    body: JSON.stringify({
      to: message.to,
      from: message.from,
      subject: parsed.subject?.slice(0, 998),
      text: truncate(parsed.text, MAX_BODY_CHARS),
      html: truncate(parsed.html, MAX_BODY_CHARS),
      spf: verdict(auth, "spf"),
      dkim: verdict(auth, "dkim"),
      dmarc: verdict(auth, "dmarc"),
      authResults: auth.slice(0, 4000) || undefined,
      headers,
      rawSize: message.rawSize,
    }),
  });
  if (!res.ok) throw new Error(`ingest responded ${res.status}: ${(await res.text().catch(() => "")).slice(0, 300)}`);
}

/* ---------- health probe ---------- */

async function readState(env: Env): Promise<HealthState> {
  try {
    return parseState(await env.HEALTH_KV.get(STATE_KEY, "json"));
  } catch (e) {
    console.error("[windowmuse-mail] health state read failed", e instanceof Error ? e.message : String(e));
    return parseState(null);
  }
}

async function writeState(env: Env, s: HealthState): Promise<void> {
  await env.HEALTH_KV.put(STATE_KEY, JSON.stringify(s));
}

async function check(env: Env): Promise<{ ok: boolean; detail: string; healthUrl: string }> {
  const healthUrl = `${env.APP_URL.replace(/\/$/, "")}/api/health`;
  try {
    const res = await fetch(`${healthUrl}?probe=${Date.now()}`, { headers: { "user-agent": "windowmuse-health-probe/1.0" }, signal: AbortSignal.timeout(20000) });
    const body = await res.text();
    return { ok: res.status === 200, detail: `HTTP ${res.status}\n${body.slice(0, 1500)}`, healthUrl };
  } catch (e) {
    return { ok: false, detail: `request failed: ${e instanceof Error ? e.message : String(e)}`, healthUrl };
  }
}

/** One probe. `dry` computes the decision without emailing or writing state. */
async function probe(env: Env, dry = false) {
  const { ok, detail, healthUrl } = await check(env);
  const now = Date.now();
  const prev = await readState(env);
  const { action, next } = decide(prev, ok, now);
  let stored = next;
  let sent = false;
  if (!dry && action !== "none") {
    const host = new URL(healthUrl).host;
    const mail = alertEmail(action, host, action === "recovered" ? prev : next, now, detail, { health: healthUrl, errors: `${env.APP_URL.replace(/\/$/, "")}/admin/errors` });
    try {
      await sendToOwner(env, mail.subject, mail.text);
      sent = true;
    } catch (e) {
      console.error("[windowmuse-mail] health alert send failed", action, e instanceof Error ? e.message : String(e));
      stored = afterSendFailure(action, prev, next);
    }
  }
  if (!dry && !sameState(prev, stored)) await writeState(env, stored);
  return { ok, action, sent, dry, prev, next: dry ? next : stored, detail: detail.slice(0, 300) };
}

export default {
  async email(message: IncomingEmail, env: Env): Promise<void> {
    try {
      await ingest(message, env);
    } catch (e) {
      console.error("[windowmuse-mail] ingest failed", { to: message.to, from: message.from, error: e instanceof Error ? e.message : String(e) });
    }
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method === "GET" && url.pathname === "/health") return json({ ok: true, service: "windowmuse-mail", at: new Date().toISOString() });
    if (url.pathname === "/notify") {
      if (req.method !== "POST") return json({ error: "method not allowed" }, 405);
      if (!bearerMatches(req, env.NOTIFY_TOKEN)) return json({ error: "unauthorized" }, 401);
      type NotifyBody = { subject?: unknown; text?: unknown; replyTo?: unknown } | null;
      let b: NotifyBody;
      try {
        b = (await req.json()) as NotifyBody;
      } catch {
        return json({ error: "body must be JSON" }, 400);
      }
      const subject = typeof b?.subject === "string" ? b.subject.trim() : "";
      const text = typeof b?.text === "string" ? b.text : "";
      const replyTo = typeof b?.replyTo === "string" ? b.replyTo : undefined;
      if (!subject || !text) return json({ error: "subject and text are required" }, 400);
      if (text.length > MAX_BODY_CHARS) return json({ error: "text too long" }, 413);
      try {
        await sendToOwner(env, subject, text, replyTo);
        return json({ ok: true });
      } catch (e) {
        console.error("[windowmuse-mail] notify failed", e instanceof Error ? e.message : String(e));
        return json({ error: "send failed" }, 500);
      }
    }
    if (url.pathname === "/probe" && req.method === "POST") {
      if (!bearerMatches(req, env.NOTIFY_TOKEN)) return json({ error: "unauthorized" }, 401);
      // ?dry=1: report what the probe would do (no email, no state write).
      return json(await probe(env, url.searchParams.get("dry") === "1"));
    }
    return json({ error: "not found" }, 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      probe(env).then(
        (r) => console.log("[windowmuse-mail] probe", { ok: r.ok, action: r.action, sent: r.sent, failures: r.next.failures }),
        (e) => console.error("[windowmuse-mail] probe failed", e instanceof Error ? e.message : String(e)),
      ),
    );
  },
};
