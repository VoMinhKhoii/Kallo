import { handleRouteError } from '@/lib/api/respond';
import { requireAuthAndProfile } from '@/lib/auth';
import {
  fetchRevenueCatSnapshot,
  getBillingEnvironmentForUser,
  isBillingSandboxUser,
} from '@/lib/billing/revenuecat';
import { getBillingConfig } from '@/lib/entitlements/config';
import { reconcileRevenueCatGrants } from '@/lib/entitlements/grants';
import { getEntitlementState } from '@/lib/entitlements/service';
import { Errors } from '@/lib/errors';
import { checkAnalysisGuards } from '@/lib/rate-limit/analysis-guards';

export const runtime = 'nodejs';

/**
 * Authenticated recovery path for delayed/missed webhooks. Clients call this
 * after purchase/restore and before offering another purchase; it never trusts
 * client purchase data and projects RevenueCat's current CustomerInfo only.
 */
export async function POST() {
  let releaseGuard: (() => Promise<void> | void) | undefined;
  try {
    const { profile } = await requireAuthAndProfile();
    const guard = await checkAnalysisGuards({
      userId: profile.userId,
      route: 'billing-entitlements-reconcile',
      limits: {
        perUserMinute: 3,
        perUserHour: 20,
        perUserDay: 100,
        concurrentUser: 1,
        concurrentRetryAfterSeconds: 5,
      },
    });
    if (!guard.allowed) {
      return Response.json(Errors.rateLimited().toJSON(), {
        status: guard.status,
        headers: { 'Retry-After': String(guard.retryAfterSeconds) },
      });
    }
    releaseGuard = guard.release;

    const billingEnvironment = getBillingEnvironmentForUser(profile.userId);
    const snapshot = await fetchRevenueCatSnapshot(profile.userId, {
      billingEnvironment,
    });
    await reconcileRevenueCatGrants(profile.userId, snapshot);
    const state = await getEntitlementState(
      {
        userId: profile.userId,
        profileCreatedAt: profile.createdAt,
      },
      { billingEnvironment }
    );
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
  } finally {
    await releaseGuard?.();
  }
}
