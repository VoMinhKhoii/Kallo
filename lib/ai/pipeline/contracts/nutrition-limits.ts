/**
 * Physical envelopes both pipeline paths agree on.
 *
 * These are facts about food, not tuning knobs — they live in contracts/ so the
 * validator and the clamp that enforce them can never drift apart.
 */

/**
 * Physical kcal-per-100g ceiling for any food. Pure fat is ~900 kcal/100g — no
 * real ingredient exceeds it. Used by `pipeline/legacy/validation.ts` as an
 * anomaly envelope AND by `pipeline/resolve/macro-resolution.ts` as a hard clamp
 * for unmatched ingredients.
 */
export const MAX_KCAL_PER_100G = 900;
