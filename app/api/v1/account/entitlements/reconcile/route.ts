import { handleRouteError } from '@/lib/api/respond';
import {
  fetchRevenueCatSnapshot,
  getBillingConfig,
  getBillingEnvironmentForUser,
  getEntitlementState,
  isBillingSandboxUser,
  reconcileRevenueCatGrants,
} from '@/lib/domain/billing/billing';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import {
  acquireRateLimit,
  type RateLimitLease,
} from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * Authenticated recovery path for delayed/missed webhooks. Clients call this
 * after purchase/restore and before offering another purchase; it never trusts
 * client purchase data and projects RevenueCat's current CustomerInfo only.
 */
export async function POST() {
  let lease: RateLimitLease | undefined;
  try {
    const { profile } = await requireAuthAndProfile();
    // A refusal throws the RATE_LIMITED 429 + Retry-After the apps parse.
    lease = await acquireRateLimit('entitlementsReconcile', {
      kind: 'user',
      value: profile.userId,
    });

    const billingEnvironment = getBillingEnvironmentForUser(profile.userId);
    const snapshot = await fetchRevenueCatSnapshot(profile.userId, {
      billingEnvironment,
    });
    await reconcileRevenueCatGrants(profile.userId, snapshot);
    const state = await getEntitlementState(
      {
        userId: profile.userId,
      },
      { billingEnvironment }
    );
    const purchasesEnabled =
      getBillingConfig().purchasesEnabled ||
      isBillingSandboxUser(profile.userId);

    return Response.json({
      userId: profile.userId,
      purchasesEnabled,
      enforcementEnabled: getBillingConfig().enforcementEnabled,
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
      complimentary: state.complimentary,
      features: state.features,
    });
  } catch (error) {
    return handleRouteError(error);
  } finally {
    await lease?.release();
  }
}
