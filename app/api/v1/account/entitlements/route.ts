import { handleRouteError } from '@/lib/api/respond';
import {
  getBillingConfig,
  getEntitlementState,
  isBillingSandboxUser,
} from '@/lib/domain/billing/billing';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';

export const runtime = 'nodejs';

/** Derived entitlement/trial view for the authenticated user. */
export async function GET() {
  try {
    const { profile } = await requireAuthAndProfile();
    const state = await getEntitlementState({
      userId: profile.userId,
      profileCreatedAt: profile.createdAt,
    });
    const purchasesEnabled =
      getBillingConfig().purchasesEnabled ||
      isBillingSandboxUser(profile.userId);

    return Response.json({
      userId: profile.userId,
      purchasesEnabled,
      tier: state.tier,
      reconciliationRequired: state.reconciliationRequired,
      isLifetime: state.isLifetime,
      expiresAt: state.expiresAt?.toISOString() ?? null,
      willRenew: state.willRenew,
      source: state.source,
      store: state.store,
      managementUrl: state.managementUrl,
      managementStore: state.managementStore,
      hasActiveSubscription: state.hasActiveSubscription,
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
