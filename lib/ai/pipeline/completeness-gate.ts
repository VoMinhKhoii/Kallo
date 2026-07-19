/**
 * v2 completeness gate — decides whether an analyzed meal may persist or must
 * surface an `unresolved` payload (clarify / retryable error) instead.
 *
 * Phase 1 contract: an unresolved ingredient must never silently persist as
 * an under-weighted meal. The route consumes `PipelineUnresolved` and emits a
 * precise clarify (or a retryable error for transient chunk failures).
 */

import type { PipelineUnresolved } from '../types';
import type { V2AnomalySummary } from './anomaly-v2';
import type { PlausibilityPerIngredient } from './bridge';

/**
 * From the bridge's per-ingredient plausibility trail, build the `unresolved`
 * payload for the FIRST unresolved ingredient in decomposition order —
 * deterministic; the grams-weighted "most impactful" policy lands in a later
 * phase (we intentionally have no grams for unresolved items yet). Returns
 * `undefined` when every ingredient resolved.
 */
export function buildUnresolvedFromPlausibility(
  plausibility: PlausibilityPerIngredient[]
): PipelineUnresolved | undefined {
  const unresolved = plausibility.filter(
    (p) => p.state === 'unresolved_estimate'
  );
  if (unresolved.length === 0) return undefined;
  const primary = unresolved[0];
  return {
    mealItemName: primary.mealItemName,
    ingredientName: primary.ingredientName,
    reason: primary.unresolvedReason ?? 'unresolved_portion',
    unresolvedCount: unresolved.length,
  };
}

/**
 * Full gate, in precedence order:
 * 1. Chunk failure (transient infra) → processing_incomplete, so the route
 *    emits a RETRYABLE error — not a clarify question about a portion the
 *    user already stated (failed items' ingredients also appear as
 *    plausibility-unresolved, which would otherwise win and mislead).
 * 2. Plausibility-unresolved ingredient → precise clarify (Phase 1).
 * 3. Anomaly route_clarify (unmatched interval too wide to trust) — the
 *    recorded action actually routes instead of only telemetering.
 */
export function resolveCompletenessGate(args: {
  failedMealItemNames: string[];
  plausibility: PlausibilityPerIngredient[];
  anomalySummary: V2AnomalySummary;
}): PipelineUnresolved | undefined {
  if (args.failedMealItemNames.length > 0) {
    return {
      mealItemName: args.failedMealItemNames[0],
      ingredientName: args.failedMealItemNames[0],
      reason: 'processing_incomplete',
      unresolvedCount: args.failedMealItemNames.length,
    };
  }
  const fromPlausibility = buildUnresolvedFromPlausibility(args.plausibility);
  if (fromPlausibility) return fromPlausibility;
  if (args.anomalySummary.firstClarifyAnomaly) {
    return {
      mealItemName: args.anomalySummary.firstClarifyAnomaly.mealItemName,
      ingredientName: args.anomalySummary.firstClarifyAnomaly.ingredientName,
      reason: 'unresolved_portion',
      unresolvedCount: 1,
    };
  }
  return undefined;
}
