import { getBalance, onlyTrialCredits } from "@/lib/credits";
import { features } from "@/lib/env";
import { withErrorCapture } from "@/lib/errors";
import { currentPlan, ensureUser, isResponse, requireUserApi } from "@/lib/user";
import { getProvider } from "@/lib/video/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The signed-in seller as the studio sees them: plan limits, credit balance, whether only
 * trial credits are left (480p cap), which optional features are on, and the sharpest output
 * the video engine delivers today, so the Generate pane offers exactly what /api/jobs accepts.
 */
export const GET = withErrorCapture("/api/me", async () => {
  const session = await requireUserApi();
  if (isResponse(session)) return session;
  await ensureUser(session);
  const [plan, balance, trialOnly] = await Promise.all([currentPlan(session.userId), getBalance(session.userId), onlyTrialCredits(session.userId)]);
  const provider = getProvider();
  return Response.json(
    {
      email: session.email,
      plan,
      balance: { available: balance.available, reserved: balance.reserved },
      onlyTrialCredits: trialOnly,
      features: features(),
      engine: { name: provider.name, configured: provider.configured(), maxResolution: provider.maxResolution },
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
});
