/**
 * The pricing matrix.
 *
 * Ids and tiering live here; every visible string is a message key under
 * `landing.pricing`, including the prices — each locale carries its own
 * currency, so no component has to branch on locale to format money.
 *
 * Premium and Lifetime share a single `paid` column on purpose. They differ
 * only in term, and giving them one source of truth means a new row cannot
 * accidentally make them disagree.
 *
 * Note this describes the plan Kallo is launching with, not what the code
 * enforces today: `lib/entitlements/features.ts` gates exactly one feature,
 * `ai_analysis`. The section carries a beta note saying prices apply when beta
 * ends, so nothing here claims a paywall that is live.
 */
export type PlanId = 'free' | 'premium' | 'lifetime';
export type BillingPeriod = 'monthly' | 'yearly';
export type FeatureGroup = 'logging' | 'circle';

/**
 * `true` — included. `false` — not on this plan; rendered as a dash and struck
 * through. `'value'` — not a yes/no; the plan's own wording is read from
 * `landing.pricing.features.<id>.<free|paid>`.
 */
type Availability = boolean | 'value';

export interface PricingFeature {
  id: string;
  group: FeatureGroup;
  free: Availability;
  paid: Availability;
}

export const PLAN_IDS = ['free', 'premium', 'lifetime'] as const;
export const FEATURE_GROUPS = ['logging', 'circle'] as const;

export const PRICING_FEATURES: readonly PricingFeature[] = [
  { id: 'textLogging', group: 'logging', free: false, paid: true },
  { id: 'manualLogging', group: 'logging', free: false, paid: true },
  { id: 'visualEdit', group: 'logging', free: false, paid: true },
  { id: 'relog', group: 'logging', free: false, paid: true },
  { id: 'barcode', group: 'logging', free: true, paid: true },
  { id: 'cheatMeal', group: 'logging', free: false, paid: true },
  { id: 'joinGroups', group: 'circle', free: 'value', paid: 'value' },
  { id: 'friendFeed', group: 'circle', free: true, paid: true },
  { id: 'copySplit', group: 'circle', free: false, paid: true },
  { id: 'groupSize', group: 'circle', free: 'value', paid: 'value' },
];

/** What this feature does on this plan. Everything paid reads one column. */
export function availabilityFor(
  feature: PricingFeature,
  plan: PlanId
): Availability {
  return plan === 'free' ? feature.free : feature.paid;
}

/** Message suffix for a `'value'` feature — free has its own, paid is shared. */
export function valueKeyFor(plan: PlanId): 'free' | 'paid' {
  return plan === 'free' ? 'free' : 'paid';
}
