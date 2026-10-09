CREATE TABLE "app_state" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"kind" text DEFAULT 'image' NOT NULL,
	"object_key" text NOT NULL,
	"content_type" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"width" integer,
	"height" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"message" text NOT NULL,
	"user_id" text,
	"ip_hash" text,
	"user_agent" text,
	"status" text DEFAULT 'new' NOT NULL,
	"notified" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_events" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"lot_id" text NOT NULL,
	"job_id" text,
	"kind" text NOT NULL,
	"amount" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "credit_lots" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"total" integer NOT NULL,
	"remaining" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"source_key" text NOT NULL,
	"order_id" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "error_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"fingerprint" text NOT NULL,
	"name" text NOT NULL,
	"message" text NOT NULL,
	"route" text,
	"source" text NOT NULL,
	"severity" text DEFAULT 'error' NOT NULL,
	"first_frame" text,
	"stack" text,
	"context" jsonb,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"notified_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "gsc_daily" (
	"day" date NOT NULL,
	"page" text NOT NULL,
	"query" text NOT NULL,
	"clicks" integer DEFAULT 0 NOT NULL,
	"impressions" integer DEFAULT 0 NOT NULL,
	"ctr" double precision DEFAULT 0 NOT NULL,
	"position" double precision DEFAULT 0 NOT NULL,
	CONSTRAINT "gsc_daily_day_page_query_pk" PRIMARY KEY("day","page","query")
);
--> statement-breakpoint
CREATE TABLE "inbox_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"to_addr" text NOT NULL,
	"from_addr" text NOT NULL,
	"subject" text,
	"text_body" text,
	"html_body" text,
	"spf" text,
	"dkim" text,
	"dmarc" text,
	"auth_results" text,
	"headers" jsonb,
	"raw_size" integer DEFAULT 0 NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"script_id" text NOT NULL,
	"presenter_id" text NOT NULL,
	"provider" text NOT NULL,
	"provider_task_id" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"resolution" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"credits" integer NOT NULL,
	"prompt" text,
	"params" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"sku" text NOT NULL,
	"stripe_session_id" text NOT NULL,
	"stripe_subscription_id" text,
	"stripe_payment_intent" text,
	"stripe_invoice_id" text,
	"amount_total" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'usd' NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"promo_code" text,
	"email" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"brand" text,
	"category" text NOT NULL,
	"selling_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audience" text,
	"price_text" text,
	"shop_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scripts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"language" text NOT NULL,
	"tone" text NOT NULL,
	"angle" text NOT NULL,
	"duration_sec" integer NOT NULL,
	"hook" text NOT NULL,
	"body" text NOT NULL,
	"cta" text NOT NULL,
	"full_text" text NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"error" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"sku" text NOT NULL,
	"status" text NOT NULL,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"stripe_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" text PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"user_id" text NOT NULL,
	"object_key" text NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"duration_sec" integer,
	"width" integer,
	"height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "assets_product_idx" ON "assets" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE INDEX "assets_user_idx" ON "assets" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "assets_object_key_uq" ON "assets" USING btree ("object_key");--> statement-breakpoint
CREATE INDEX "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_events_job_lot_kind_uq" ON "credit_events" USING btree ("job_id","lot_id","kind") WHERE job_id is not null;--> statement-breakpoint
CREATE INDEX "credit_events_user_idx" ON "credit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "credit_events_lot_idx" ON "credit_events" USING btree ("lot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "credit_lots_source_uq" ON "credit_lots" USING btree ("source_key");--> statement-breakpoint
CREATE INDEX "credit_lots_user_idx" ON "credit_lots" USING btree ("user_id","status","expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "error_groups_fingerprint_uq" ON "error_groups" USING btree ("fingerprint");--> statement-breakpoint
CREATE INDEX "error_groups_resolved_idx" ON "error_groups" USING btree ("resolved_at");--> statement-breakpoint
CREATE INDEX "inbox_messages_to_idx" ON "inbox_messages" USING btree ("to_addr","received_at");--> statement-breakpoint
CREATE INDEX "jobs_user_idx" ON "jobs" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "jobs_status_idx" ON "jobs" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "jobs_provider_task_idx" ON "jobs" USING btree ("provider_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_session_uq" ON "orders" USING btree ("stripe_session_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_pi_idx" ON "orders" USING btree ("stripe_payment_intent");--> statement-breakpoint
CREATE INDEX "orders_subscription_idx" ON "orders" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "products_user_idx" ON "products" USING btree ("user_id","deleted_at","updated_at");--> statement-breakpoint
CREATE INDEX "scripts_product_idx" ON "scripts" USING btree ("product_id","created_at");--> statement-breakpoint
CREATE INDEX "scripts_user_idx" ON "scripts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscriptions_stripe_uq" ON "subscriptions" USING btree ("stripe_subscription_id");--> statement-breakpoint
CREATE INDEX "subscriptions_user_idx" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_stripe_customer_idx" ON "users" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "videos_job_uq" ON "videos" USING btree ("job_id");--> statement-breakpoint
CREATE INDEX "videos_user_idx" ON "videos" USING btree ("user_id","created_at");