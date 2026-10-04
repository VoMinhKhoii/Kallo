// Entitlement + feature catalog. This is the ONLY place a gated feature is
// declared: adding a feature is exactly one entry in FEATURES below. Adding a
// tier is one member on the EntitlementKey union.

// Tier keys stored in `entitlement_grants.entitlement_key`. A union ready to
// grow — new paid tiers add members here (and a grant writer in the webhook).
export type EntitlementKey = 'premium';

export interface FeatureRule {
  // The entitlement a user must hold for this feature.
  required: EntitlementKey;
}

export const FEATURES = {
  ai_analysis: { required: 'premium' },
  label_scan: { required: 'premium' },
  micronutrients: { required: 'premium' },
  relog: { required: 'premium' },
  cheat_meal: { required: 'premium' },
  // Charged to whoever INITIATES the copy/split (sending an offer, or pulling a
  // copy off the feed). Responding to an offer is deliberately ungated — see
  // lib/actions/meal-sharing/invite-response.ts.
  copy_split: { required: 'premium' },
  unlimited_circle: { required: 'premium' },
} as const satisfies Record<string, FeatureRule>;

export type FeatureKey = keyof typeof FEATURES;
