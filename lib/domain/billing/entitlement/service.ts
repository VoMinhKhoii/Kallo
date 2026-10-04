import { and, eq } from 'drizzle-orm';
import {
  FEATURES,
  type FeatureKey,
  type FeatureRule,
} from '@/lib/domain/billing/entitlement/features';
import {
  type BillingEnvironment,
  getBillingEnvironment,
  getBillingEnvironmentForUser,
} from '@/lib/domain/billing/revenuecat/identity';
import { type AppDb, db as appDb } from '@/lib/infra/db/client';
import { entitlementGrants } from '@/lib/infra/db/schema';

export type Tier = 'free' | 'premium';

export type FeatureAccessReason = 'entitled' | 'not_entitled';

export interface FeatureAccess {
  allowed: boolean;
  reason: FeatureAccessReason;
}

export interface EntitlementState {
  tier: Tier;
  reconciliationRequired: boolean;
  isLifetime: boolean;
  expiresAt: Date | null;
  willRenew: boolean;
  source: string | null;
  // RC's lowercased event.store on the winning grant (app_store, play_store,
  // paddle, ...) — drives the settings "manage subscription" deep link. null
  // when there is no active grant or the grant carried no store.
  store: string | null;
  managementUrl: string | null;
  managementStore: string | null;
  hasActiveSubscription: boolean;
  features: Record<FeatureKey, FeatureAccess>;
}

export interface EntitlementDeps {
  db?: AppDb;
  now?: () => Date;
  billingEnvironment?: BillingEnvironment;
}

export interface EntitlementInput {
  userId: string;
}

// A grant only counts when it is BOTH marked active AND still within its
// window against the clock — never trust `status` alone against `expiresAt`
// (a webhook may lag reality). Lifetime = expiresAt null (never expires).
function grantIsActive(
  grant: { status: string; startsAt: Date; expiresAt: Date | null },
  now: Date
): boolean {
  if (grant.status !== 'active') return false;
  if (grant.startsAt.getTime() > now.getTime()) return false;
  return grant.expiresAt === null || grant.expiresAt.getTime() > now.getTime();
}

type GrantRow = typeof entitlementGrants.$inferSelect;
const revenueCatFreshnessWindowMs = 24 * 60 * 60 * 1000;

// A provider refresh is useful only when our last authoritative RevenueCat
// projection has expired locally but still says the subscription will renew.
// This is the signature of a delayed/missed renewal webhook (including
// accelerated TestFlight sandbox renewals). Canceled subscriptions have
// willRenew=false and must simply expire without contacting the provider.
function grantNeedsReconciliation(grant: GrantRow, now: Date): boolean {
  return (
    grant.source === 'revenuecat' &&
    grant.status === 'active' &&
    grant.willRenew &&
    grant.expiresAt !== null &&
    grant.expiresAt.getTime() <= now.getTime() &&
    (grant.entitlementKey === 'premium' ||
      grant.entitlementKey === 'billing_subscription')
  );
}

function revenueCatProjectionIsStale(
  grant: GrantRow | null,
  now: Date
): boolean {
  if (grant?.source !== 'revenuecat') return false;
  if (grant.providerSyncedAt === null) return true;
  return (
    now.getTime() - grant.providerSyncedAt.getTime() >=
    revenueCatFreshnessWindowMs
  );
}

// Winning grant: a lifetime grant (expiresAt null) beats all; otherwise the
// grant with the furthest-out expiresAt wins.
function pickWinningGrant(grants: GrantRow[]): GrantRow | null {
  let winner: GrantRow | null = null;
  for (const grant of grants) {
    if (winner === null) {
      winner = grant;
      continue;
    }
    if (grant.expiresAt === null) return grant;
    if (winner.expiresAt === null) continue;
    if (grant.expiresAt.getTime() > winner.expiresAt.getTime()) {
      winner = grant;
    }
  }
  return winner;
}

function evaluateFeature(rule: FeatureRule, tier: Tier): FeatureAccess {
  return tier === rule.required
    ? { allowed: true, reason: 'entitled' }
    : { allowed: false, reason: 'not_entitled' };
}

export async function getEntitlementState(
  input: EntitlementInput,
  deps?: EntitlementDeps
): Promise<EntitlementState> {
  const database = deps?.db ?? appDb;
  const now = deps?.now?.() ?? new Date();
  const billingEnvironment = deps?.billingEnvironment
    ? getBillingEnvironment(deps.billingEnvironment)
    : getBillingEnvironmentForUser(input.userId);

  const rows = await database
    .select()
    .from(entitlementGrants)
    .where(
      and(
        eq(entitlementGrants.userId, input.userId),
        eq(entitlementGrants.environment, billingEnvironment)
      )
    );

  const activeGrants = rows.filter(
    (grant) => grant.entitlementKey === 'premium' && grantIsActive(grant, now)
  );
  const activeSubscriptions = rows.filter(
    (grant) =>
      grant.entitlementKey === 'billing_subscription' &&
      grantIsActive(grant, now)
  );
  const winner = pickWinningGrant(activeGrants);
  const managementGrant = pickWinningGrant(activeSubscriptions);

  const tier: Tier = winner ? 'premium' : 'free';
  // The winner decides ACCESS, but a complimentary (promo) grant can outlast
  // a renewing store subscription. Reporting the promo's end date and
  // willRenew=false would tell a paying user their Premium "ends" while the
  // store keeps charging them, so a renewing subscription owns the lifecycle
  // fields. A lifetime winner still reads as lifetime.
  const renewing =
    winner && winner.expiresAt !== null && managementGrant?.willRenew
      ? managementGrant
      : null;

  const features = {} as Record<FeatureKey, FeatureAccess>;
  for (const key of Object.keys(FEATURES) as FeatureKey[]) {
    features[key] = evaluateFeature(FEATURES[key], tier);
  }

  return {
    tier,
    reconciliationRequired:
      revenueCatProjectionIsStale(winner, now) ||
      // A promo can win access while a subscription owns the lifecycle
      // fields; that subscription still needs its 24h freshness check, or a
      // missed refund or cancellation would sit until the period ends.
      revenueCatProjectionIsStale(managementGrant, now) ||
      rows.some((grant) => grantNeedsReconciliation(grant, now)),
    isLifetime: winner?.expiresAt === null && winner !== null,
    expiresAt: renewing?.expiresAt ?? winner?.expiresAt ?? null,
    willRenew: renewing !== null || (winner?.willRenew ?? false),
    source: winner?.source ?? null,
    store: winner?.store ?? null,
    managementUrl:
      managementGrant?.managementUrl ?? winner?.managementUrl ?? null,
    managementStore: managementGrant?.store ?? null,
    hasActiveSubscription: managementGrant !== null,
    features,
  };
}

export type FeatureAccessResult =
  | { allowed: true }
  | { allowed: false; reason: 'not_entitled' };

/**
 * Thin wrapper over getEntitlementState for a single feature.
 *
 * NOTE: the BILLING_ENFORCEMENT_ENABLED kill-switch is intentionally NOT
 * applied here — the route layer (Phase E) applies it so this module stays a
 * pure gating computation.
 */
export async function checkFeatureAccess(
  input: EntitlementInput,
  feature: FeatureKey,
  deps?: EntitlementDeps
): Promise<FeatureAccessResult> {
  const state = await getEntitlementState(input, deps);
  return state.features[feature].allowed
    ? { allowed: true }
    : { allowed: false, reason: 'not_entitled' };
}
