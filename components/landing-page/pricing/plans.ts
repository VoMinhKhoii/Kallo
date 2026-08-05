/**
 * The pricing matrix, as a stack rather than a grid.
 *
 * Each tier lists only what it adds to the one before it — Free names what it
 * has, Premium says "everything in Free, plus…", Lifetime the same again. A
 * three-column comparison would have repeated Free's whole list twice, because
 * Premium and Lifetime include all of it.
 *
 * Ids only. Every visible string is a message key under `landing.pricing`,
 * prices included, so each locale carries its own currency and no component
 * branches on locale to format money.
 *
 * Note this describes the plan Kallo is launching with, not what the code
 * enforces: `lib/entitlements/features.ts` gates exactly one feature,
 * `ai_analysis`. The section carries a beta note saying prices apply when beta
 * ends, so nothing here claims a paywall that is live.
 */
export type PlanId = 'free' | 'premium' | 'lifetime';
export type BillingPeriod = 'monthly' | 'yearly';

export const PLAN_IDS = ['free', 'premium', 'lifetime'] as const;

/** Feature keys per tier, resolved against `landing.pricing.features`. */
export const PLAN_FEATURES: Record<PlanId, readonly string[]> = {
  free: [
    'barcode',
    'friendFeed',
    'joinGroups',
    'groupSize',
    'dashboard',
    'weight',
    'heatmap',
    'nutrition',
    'goals',
    'export',
  ],
  premium: [
    'textLogging',
    'manualLogging',
    'visualEdit',
    'relog',
    'cheatMeal',
    'copySplit',
    'unlimitedCircle',
  ],
  lifetime: ['payOnce', 'futureUpdates'],
};
