import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
  doublePrecision,
  date,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ accounts */

/** A seller, keyed by the Clerk user id; upserted from the session on the first authenticated request. */
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    stripeCustomerId: text("stripe_customer_id"),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("users_email_idx").on(t.email), index("users_stripe_customer_idx").on(t.stripeCustomerId)],
);

/* ------------------------------------------------------------------ studio */

export const PRODUCT_CATEGORIES = [
  "beauty",
  "skincare",
  "fashion",
  "accessories",
  "home",
  "kitchen",
  "electronics",
  "phone-accessories",
  "health-wellness",
  "fitness",
  "baby-kids",
  "pets",
  "toys-games",
  "stationery",
  "food-drink",
  "other",
] as const;
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    category: text("category").$type<ProductCategory>().notNull(),
    sellingPoints: jsonb("selling_points").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    audience: text("audience"),
    priceText: text("price_text"),
    shopUrl: text("shop_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("products_user_idx").on(t.userId, t.deletedAt, t.updatedAt)],
);

export type AssetKind = "image" | "video";
export type AssetStatus = "pending" | "ready" | "rejected";

/** A file in the private bucket: product photos uploaded by the seller (images) or provider output (video). */
export const assets = pgTable(
  "assets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    kind: text("kind").$type<AssetKind>().notNull().default("image"),
    objectKey: text("object_key").notNull(),
    contentType: text("content_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    width: integer("width"),
    height: integer("height"),
    status: text("status").$type<AssetStatus>().notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("assets_product_idx").on(t.productId, t.status, t.createdAt),
    index("assets_user_idx").on(t.userId),
    uniqueIndex("assets_object_key_uq").on(t.objectKey),
  ],
);

export type ScriptSource = "ai" | "template" | "user";

export const scripts = pgTable(
  "scripts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    language: text("language").notNull(),
    tone: text("tone").notNull(),
    angle: text("angle").notNull(),
    durationSec: integer("duration_sec").notNull(),
    hook: text("hook").notNull(),
    body: text("body").notNull(),
    cta: text("cta").notNull(),
    fullText: text("full_text").notNull(),
    source: text("source").$type<ScriptSource>().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("scripts_product_idx").on(t.productId, t.createdAt), index("scripts_user_idx").on(t.userId)],
);

export type JobStatus = "draft" | "awaiting_engine" | "queued" | "running" | "succeeded" | "failed" | "expired" | "cancelled";
export type Resolution = "480p" | "720p" | "1080p";

/** One generation. Only src/lib/video/jobs.ts changes `status`; credits move only through src/lib/credits.ts. */
export const jobs = pgTable(
  "jobs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    scriptId: text("script_id").notNull(),
    presenterId: text("presenter_id").notNull(),
    provider: text("provider").notNull(), // replicate | mock | none
    providerTaskId: text("provider_task_id"),
    status: text("status").$type<JobStatus>().notNull().default("draft"),
    resolution: text("resolution").$type<Resolution>().notNull(),
    durationSec: integer("duration_sec").notNull(),
    credits: integer("credits").notNull(),
    prompt: text("prompt"),
    params: jsonb("params").$type<Record<string, unknown>>(),
    error: text("error"),
    createdAt: createdAt(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
  },
  (t) => [
    index("jobs_user_idx").on(t.userId, t.createdAt),
    index("jobs_status_idx").on(t.status, t.createdAt),
    index("jobs_provider_task_idx").on(t.providerTaskId),
  ],
);

export const videos = pgTable(
  "videos",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    userId: text("user_id").notNull(),
    objectKey: text("object_key").notNull(),
    bytes: integer("bytes").notNull().default(0),
    durationSec: integer("duration_sec"),
    width: integer("width"),
    height: integer("height"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("videos_job_uq").on(t.jobId), index("videos_user_idx").on(t.userId, t.createdAt)],
);

/* ------------------------------------------------------------------ credits */

export type LotKind = "trial" | "subscription" | "pack" | "adjust";
export type LotStatus = "active" | "revoked";

/**
 * A batch of credits with one expiry. `remaining` = total − reserved − debited (+ released):
 * it is decremented when a job reserves, and restored only by a release. Idempotent on
 * `source_key` (checkout session id, `subscriptionId:periodStart`, `trial:<userId>`).
 */
export const creditLots = pgTable(
  "credit_lots",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<LotKind>().notNull(),
    total: integer("total").notNull(),
    remaining: integer("remaining").notNull(),
    status: text("status").$type<LotStatus>().notNull().default("active"),
    sourceKey: text("source_key").notNull(),
    orderId: text("order_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("credit_lots_source_uq").on(t.sourceKey), index("credit_lots_user_idx").on(t.userId, t.status, t.expiresAt)],
);

export type CreditEventKind = "reserve" | "debit" | "release" | "grant" | "revoke";

/** Append-only ledger. A job touches each lot at most once per kind (unique index), which makes reserve/settle/release replay-safe. */
export const creditEvents = pgTable(
  "credit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    lotId: text("lot_id").notNull(),
    jobId: text("job_id"),
    kind: text("kind").$type<CreditEventKind>().notNull(),
    amount: integer("amount").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("credit_events_job_lot_kind_uq").on(t.jobId, t.lotId, t.kind).where(sql`job_id is not null`),
    index("credit_events_user_idx").on(t.userId, t.createdAt),
    index("credit_events_lot_idx").on(t.lotId),
  ],
);

/* ------------------------------------------------------------------ billing */

export type OrderKind = "pack" | "subscription";
export type OrderStatus = "paid" | "refunded" | "disputed";

export const orders = pgTable(
  "orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    kind: text("kind").$type<OrderKind>().notNull(),
    sku: text("sku").notNull(),
    stripeSessionId: text("stripe_session_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id"),
    stripePaymentIntent: text("stripe_payment_intent"),
    stripeInvoiceId: text("stripe_invoice_id"),
    amountTotal: integer("amount_total").notNull().default(0), // cents
    currency: text("currency").notNull().default("usd"),
    status: text("status").$type<OrderStatus>().notNull().default("paid"),
    promoCode: text("promo_code"),
    email: text("email"),
    source: text("source").notNull(), // success_page | webhook | reconcile
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_session_uq").on(t.stripeSessionId),
    index("orders_user_idx").on(t.userId, t.createdAt),
    index("orders_pi_idx").on(t.stripePaymentIntent),
    index("orders_subscription_idx").on(t.stripeSubscriptionId),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    stripeSubscriptionId: text("stripe_subscription_id").notNull(),
    sku: text("sku").notNull(),
    status: text("status").notNull(), // Stripe status: active | trialing | past_due | canceled | unpaid | incomplete | paused
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("subscriptions_stripe_uq").on(t.stripeSubscriptionId), index("subscriptions_user_idx").on(t.userId, t.status)],
);

/** Every Stripe event we accepted, keyed by event id: the webhook's idempotency ledger. */
export const stripeEvents = pgTable("stripe_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  status: text("status").notNull().default("received"), // received | processed | ignored | failed
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

/* ------------------------------------------------------------------ operations */

/** Self-hosted error inbox: one row per fingerprint (error name + first stack frame + route). */
export const errorGroups = pgTable(
  "error_groups",
  {
    id: text("id").primaryKey(),
    fingerprint: text("fingerprint").notNull(),
    name: text("name").notNull(),
    message: text("message").notNull(),
    route: text("route"),
    source: text("source").notNull(), // server | client | edge | worker | cron
    severity: text("severity").notNull().default("error"), // error | warn
    firstFrame: text("first_frame"),
    stack: text("stack"),
    context: jsonb("context").$type<Record<string, unknown>>(),
    count: integer("count").notNull().default(1),
    firstSeen: timestamp("first_seen", { withTimezone: true }).notNull().defaultNow(),
    lastSeen: timestamp("last_seen", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("error_groups_fingerprint_uq").on(t.fingerprint), index("error_groups_resolved_idx").on(t.resolvedAt)],
);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: text("id").primaryKey(),
    name: text("name"),
    email: text("email").notNull(),
    topic: text("topic").notNull(),
    message: text("message").notNull(),
    userId: text("user_id"),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    status: text("status").notNull().default("new"), // new | replied | archived
    notified: integer("notified").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("contact_messages_created_idx").on(t.createdAt)],
);

/** Test inbox: mail routed by Cloudflare Email Routing → Email Worker → /api/inbox/ingest. */
export const inboxMessages = pgTable(
  "inbox_messages",
  {
    id: text("id").primaryKey(),
    toAddr: text("to_addr").notNull(),
    fromAddr: text("from_addr").notNull(),
    subject: text("subject"),
    textBody: text("text_body"),
    htmlBody: text("html_body"),
    spf: text("spf"),
    dkim: text("dkim"),
    dmarc: text("dmarc"),
    authResults: text("auth_results"),
    headers: jsonb("headers").$type<Record<string, string>>(),
    rawSize: integer("raw_size").notNull().default(0),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("inbox_messages_to_idx").on(t.toAddr, t.receivedAt)],
);

/** Fixed-window rate limiter state. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  count: integer("count").notNull().default(0),
});

/** Daily Search Console rows pulled by the GSC job. */
export const gscDaily = pgTable(
  "gsc_daily",
  {
    day: date("day").notNull(),
    page: text("page").notNull(),
    query: text("query").notNull(),
    clicks: integer("clicks").notNull().default(0),
    impressions: integer("impressions").notNull().default(0),
    ctr: doublePrecision("ctr").notNull().default(0),
    position: doublePrecision("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.day, t.page, t.query] })],
);

/** Small key/value store for operational state (alert throttles, last reconcile run…). */
export const appState = pgTable("app_state", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>(),
  updatedAt: updatedAt(),
});

/* ------------------------------------------------------------------ row types */

export type UserRow = typeof users.$inferSelect;
export type ProductRow = typeof products.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type ScriptRow = typeof scripts.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
export type VideoRow = typeof videos.$inferSelect;
export type CreditLotRow = typeof creditLots.$inferSelect;
export type CreditEventRow = typeof creditEvents.$inferSelect;
export type OrderRow = typeof orders.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
