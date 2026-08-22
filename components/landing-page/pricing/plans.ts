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
 * There is no billing-period state. Premium quotes the annual rate per month
 * and the fine print carries the rest — what is billed up front, and what the
 * monthly alternative costs — which says more than a toggle did and holds
 * still while you read it.
 *
 * Note this describes the plan Kallo is launching with, not what the code
 * enforces: `lib/billing/entitlement/features.ts` gates exactly one feature,
 * `ai_analysis`. The section carries a beta note saying prices apply when beta
 * ends, so nothing here claims a paywall that is live.
 */
export type PlanId = 'free' | 'premium' | 'lifetime';

/**
 * The plans the page shows, in order.
 *
 * Lifetime is held back for now — it keeps its copy, its features and its place
 * in the type, so putting it back is adding one string to this array. Removing
 * the rest would throw away a tier that is only paused, and the section already
 * says prices apply when beta ends.
 */
export const PLAN_IDS = ['free', 'premium'] as const;

/** Feature keys per tier, resolved against `landing.pricing.features`. */
export const PLAN_FEATURES: Record<PlanId, readonly string[]> = {
  free: [
    'barcode',
    'manualLogging',
    'joinGroups',
    'friends',
    'macros',
    'micros',
  ],
  premium: [
    'textLogging',
    'visualEdit',
    'relog',
    'cheatMeal',
    'copySplit',
    'unlimitedCircle',
  ],
  lifetime: ['payOnce', 'futureUpdates'],
};
