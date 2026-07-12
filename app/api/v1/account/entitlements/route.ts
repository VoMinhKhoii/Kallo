import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import { getEntitlementState } from '@/lib/entitlements/service';

export const runtime = 'nodejs';

/** Derived entitlement/trial view for the authenticated user. */
export async function GET() {
  try {
    const { profile } = await requireAuthAndProfile();
    const state = await getEntitlementState({
      userId: profile.userId,
      profileCreatedAt: profile.createdAt,
    });

    return Response.json({
      tier: state.tier,
      isLifetime: state.isLifetime,
      expiresAt: state.expiresAt?.toISOString() ?? null,
      willRenew: state.willRenew,
      source: state.source,
      trial: {
        active: state.trial.active,
        endsAt: state.trial.endsAt?.toISOString() ?? null,
        daysRemaining: state.trial.daysRemaining,
      },
      features: state.features,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
