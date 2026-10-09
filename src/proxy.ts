import { clerkClient, clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

/*
 * Runs only on the personal area and the APIs (see `config.matcher`); marketing and blog
 * pages never pass through here and are served straight from the CDN cache.
 *
 *  - /studio, /checkout and the signed-in APIs require a session (pages → /sign-in with a
 *    return URL, APIs → 401 JSON);
 *  - /admin requires a verified email from ADMIN_EMAILS and is a real 404 for everyone else;
 *  - public APIs (health, errors, geo, contact, webhooks, cron, callbacks…) pass through.
 */

const isPersonalPage = createRouteMatcher(["/studio(.*)", "/checkout(.*)"]);
const isAdminArea = createRouteMatcher(["/admin(.*)", "/api/admin(.*)"]);
const isPersonalApi = createRouteMatcher([
  "/api/me(.*)",
  "/api/uploads(.*)",
  "/api/scripts(.*)",
  "/api/jobs(.*)",
  "/api/products(.*)",
  "/api/checkout(.*)",
  "/api/stripe/portal(.*)",
]);

function needsSession(req: NextRequest): boolean {
  return isPersonalPage(req) || isAdminArea(req) || isPersonalApi(req);
}

function isApi(req: NextRequest): boolean {
  return req.nextUrl.pathname.startsWith("/api/");
}

/** Positive and negative verdicts from a successful Clerk lookup, keyed by user and by the current allow-list. */
const adminCache = new Map<string, { ok: boolean; at: number }>();
const ADMIN_CACHE_MS = 5 * 60 * 1000;

async function isAdminUser(userId: string): Promise<boolean> {
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const key = `${userId}|${allowed.join(",")}`;
  const hit = adminCache.get(key);
  if (hit && Date.now() - hit.at < ADMIN_CACHE_MS) return hit.ok;
  try {
    const client = await clerkClient();
    const u = await client.users.getUser(userId);
    const ok = u.emailAddresses.some((e) => e.verification?.status === "verified" && allowed.includes(e.emailAddress.toLowerCase()));
    adminCache.set(key, { ok, at: Date.now() });
    return ok;
  } catch (e) {
    // A transient Clerk failure refuses this request only; it is never remembered as "not an admin".
    console.error("[proxy] admin lookup failed", e);
    return false;
  }
}

function notFound(req: NextRequest): NextResponse {
  // Rewrite to a path with no route: Next renders the 404 page with a real 404 status.
  return NextResponse.rewrite(new URL("/__not-found", req.url));
}

function signInUrl(req: NextRequest): URL {
  const url = new URL("/sign-in", req.url);
  const back = `${req.nextUrl.pathname}${req.nextUrl.search}`;
  url.searchParams.set("redirect_url", back);
  return url;
}

const withClerk = clerkMiddleware(async (auth, req) => {
  try {
    if (!needsSession(req)) return NextResponse.next();
    const { userId } = await auth();
    if (!userId) {
      if (isApi(req)) return NextResponse.json({ error: "sign_in_required" }, { status: 401, headers: { "Cache-Control": "no-store" } });
      if (isAdminArea(req)) return notFound(req); // don't reveal the admin area exists
      return NextResponse.redirect(signInUrl(req));
    }
    if (isAdminArea(req) && !(await isAdminUser(userId))) {
      if (isApi(req)) return NextResponse.json({ error: "not found" }, { status: 404 });
      return notFound(req);
    }
    const res = NextResponse.next();
    res.headers.set("Cache-Control", "private, no-store");
    return res;
  } catch (err) {
    // Auth could not be established: never let the request through. The admin area stays a 404
    // (its existence is not revealed), APIs get a retryable 503, pages a short plain-text 503.
    console.error("[proxy] failed", err);
    return unavailable(req);
  }
});

function unavailable(req: NextRequest): NextResponse {
  if (isAdminArea(req)) return isApi(req) ? NextResponse.json({ error: "not found" }, { status: 404, headers: { "Cache-Control": "no-store" } }) : notFound(req);
  if (isApi(req)) {
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Please try again in a moment." }, { status: 503, headers: { "Cache-Control": "no-store", "Retry-After": "30" } });
  }
  return new NextResponse("Sign-in is temporarily unavailable. Please try again in a moment.", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "30", "Cache-Control": "no-store" },
  });
}

/**
 * Degraded mode: without CLERK_SECRET_KEY everything public keeps working (marketing pages,
 * health, webhooks, contact…) and the personal area answers a clear 503 instead of crashing.
 */
export default function proxy(req: NextRequest, ev: NextFetchEvent) {
  if (!process.env.CLERK_SECRET_KEY) {
    if (needsSession(req) || req.nextUrl.pathname.startsWith("/sign-in")) {
      if (isApi(req)) {
        return NextResponse.json({ error: "Sign-in is being set up. Please try again in a few minutes." }, { status: 503, headers: { "Retry-After": "300" } });
      }
      return new NextResponse("Sign-in is being set up. Please try again in a few minutes.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8", "Retry-After": "300", "Cache-Control": "no-store" },
      });
    }
    return NextResponse.next();
  }
  return withClerk(req, ev);
}

export const config = {
  matcher: ["/studio/:path*", "/checkout/:path*", "/admin/:path*", "/sign-in/:path*", "/api/:path*"],
};
