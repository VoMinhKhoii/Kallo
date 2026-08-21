// Entitlement + feature catalog. This is the ONLY place a gated feature is
// declared: adding a feature is exactly one entry in FEATURES below. Adding a
// tier is one member on the EntitlementKey union.

// Tier keys stored in `entitlement_grants.entitlement_key`. A union ready to
// grow — new paid tiers add members here (and a grant writer in the webhook).
export type EntitlementKey = 'premium';

export interface FeatureRule {
  // The entitlement a user must hold for this feature (outside of trial).
  required: EntitlementKey;
  // Whether the app-level trial grants access to this feature.
  trialCovered: boolean;
}

export const FEATURES = {
  ai_analysis: { required: 'premium', trialCovered: true },
  label_scan: { required: 'premium', trialCovered: true },
  micronutrients: { required: 'premium', trialCovered: true },
  relog: { required: 'premium', trialCovered: true },
  cheat_meal: { required: 'premium', trialCovered: true },
  copy_split: { required: 'premium', trialCovered: true },
  unlimited_circle: { required: 'premium', trialCovered: true },
} as const satisfies Record<string, FeatureRule>;

export type FeatureKey = keyof typeof FEATURES;
