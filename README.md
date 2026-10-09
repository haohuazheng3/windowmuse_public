# WindowMuse

AI presenter videos for TikTok Shop sellers. Upload a product photo, pick a presenter and a style, and get a short vertical video ready to post or run as a Spark ad. Live at [windowmuse.com](https://windowmuse.com).

This repository is the complete web app: marketing site and blog, seller accounts, a credit-based generation pipeline, subscriptions and one-time credit packs, and private storage for uploads and finished videos.

## Stack

- **Next.js 16** (App Router, Turbopack, React 19) and **Tailwind CSS v4**
- **Neon Postgres** with **Drizzle ORM** (migrations in `drizzle/`)
- **Clerk** for seller sign-in and sessions
- **Stripe**: monthly subscriptions and one-time credit packs through Checkout; a signed webhook grants credits and a daily reconcile job compares Stripe with the database
- **Cloudflare**: R2 for product photos and generated videos behind a small Worker that serves short-lived signed links (with HTTP Range support for playback) and accepts signed browser uploads; an Email Worker for a test inbox and owner alerts
- **Video generation** behind a provider interface (`VIDEO_PROVIDER=none|mock|replicate`), so the whole app runs locally without a GPU or a paid API
- Self-hosted error inbox, health endpoint, Postgres rate limiting, and MDX articles with structured data

## Run it locally

```bash
cp .env.example .env.local   # then fill in the values for your own services
npm install
npm run db:migrate           # creates the tables in your Postgres database
npm run dev
```

Open http://localhost:3000. With `VIDEO_PROVIDER=mock` the generation flow completes end to end with placeholder output, which is enough to work on everything except the model itself.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm run dev` | Development server on http://localhost:3000 |
| `npm run build` | Applies migrations (if a database is configured), then builds |
| `npm run check` | Type check, lint and unit tests |
| `npm run db:generate` | Generates a SQL migration after a schema change |
| `npm run icons` | Regenerates every favicon and app icon from the logo mark |

## Deploy

The production setup is **Vercel** (the Next.js app) + **Neon** (Postgres) + **Cloudflare** (R2 bucket and the two Workers) + **Clerk** + **Stripe**.

1. Create a Neon project and put its pooled and direct connection strings in Vercel as `DATABASE_URL` and `DATABASE_URL_UNPOOLED`. `npm run build` applies the migrations before every deployment.
2. Create a Clerk application and a Stripe account; add their keys and the five Stripe price ids from `.env.example`.
3. Create an R2 bucket and deploy the two Workers (below). Point `FILES_BASE_URL` at the files Worker and `MAIL_WORKER_URL` at the mail Worker; generate your own values for the shared secrets.
4. Import the repository into Vercel. `vercel.json` sets the framework and an ignored-build step that skips documentation-only commits.

### Cloudflare Workers

The Workers live in `infra/workers` (`mail/` and `files/`). Each needs its own `wrangler.toml` (not included: it holds account-specific configuration). Bindings:

- **files**: an R2 bucket bound as `BUCKET`, a var `ALLOWED_ORIGINS` (comma-separated site origins allowed to upload and play videos from the browser), and the secrets `API_TOKEN` and `SIGNING_SECRET` (the same values as `FILES_API_TOKEN` and `FILES_SIGNING_SECRET` in the app).
- **mail**: a `send_email` binding named `OWNER_MAIL`, vars `APP_URL` and `OWNER_EMAIL`, a cron trigger (`*/30 * * * *` for the health probe), and the secrets `INBOX_INGEST_SECRET` and `NOTIFY_TOKEN` (the same values as `INBOX_INGEST_SECRET` and `MAIL_WORKER_TOKEN` in the app).

```bash
cd infra/workers
npm install
npm run typecheck
npx wrangler secret put API_TOKEN --config files/wrangler.toml
npx wrangler secret put SIGNING_SECRET --config files/wrangler.toml
npm run deploy:files
npx wrangler secret put INBOX_INGEST_SECRET --config mail/wrangler.toml
npx wrangler secret put NOTIFY_TOKEN --config mail/wrangler.toml
npm run deploy:mail
```

## Writing articles

Each article is one file at `content/blog/<category>/<slug>.mdx` with frontmatter. See `content/blog/<category>/article-template.mdx` for the fields. Category hubs, the sitemap and `llms.txt` update on the next build.

## License

The code is MIT-licensed; see `LICENSE`. The WindowMuse name and logo are not covered by that license.
