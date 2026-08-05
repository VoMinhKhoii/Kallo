/**
 * The pricing matrix.
 *
 * Ids and tiering live here; every visible string is a message key under
 * `landing.pricing`, including the prices — each locale carries its own
 * currency, so no component has to branch on locale to format money.
 *
 * Only Free is tabulated. Premium and Lifetime include everything, so drawing
 * two more columns of identical ticks said nothing twenty times; what they add
 * is one sentence under the list. That also makes this table the answer to a
 * single question — what do you get without paying — instead of a grid the
 * reader has to cross-reference.
 *
 * Note this describes the plan Kallo is launching with, not what the code
 * enforces: `lib/entitlements/features.ts` gates exactly one feature,
 * `ai_analysis`. The section carries a beta note saying prices apply when beta
 * ends, so nothing here claims a paywall that is live.
 */
export type PlanId = 'free' | 'premium' | 'lifetime';
export type BillingPeriod = 'monthly' | 'yearly';
export type FeatureGroup = 'logging' | 'circle';

export interface PricingFeature {
  id: string;
  group: FeatureGroup;
  /**
   * `true` — included on Free. `false` — not on Free; rendered as a dash with
   * the label struck through. `'value'` — Free gets a qualified amount, read
   * from `landing.pricing.features.<id>.free`.
   */
  free: boolean | 'value';
}

export const PLAN_IDS = ['free', 'premium', 'lifetime'] as const;
export const FEATURE_GROUPS = ['logging', 'circle'] as const;

export const PRICING_FEATURES: readonly PricingFeature[] = [
  { id: 'textLogging', group: 'logging', free: false },
  { id: 'manualLogging', group: 'logging', free: false },
  { id: 'visualEdit', group: 'logging', free: false },
  { id: 'relog', group: 'logging', free: false },
  { id: 'barcode', group: 'logging', free: true },
  { id: 'cheatMeal', group: 'logging', free: false },
  { id: 'joinGroups', group: 'circle', free: 'value' },
  { id: 'friendFeed', group: 'circle', free: true },
  { id: 'copySplit', group: 'circle', free: false },
  { id: 'groupSize', group: 'circle', free: 'value' },
];
