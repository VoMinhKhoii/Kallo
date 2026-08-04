/**
 * v2 completeness gate — decides whether an analyzed meal may persist or must
 * surface a retryable partial-failure error instead.
 *
 * There is NO portion ask-back any more. An ingredient whose portion looked
 * shaky ships on its best estimate and the user corrects it with the visual
 * portion picker; the plausibility trail survives as telemetry in
 * `pipeline_stage_logs.output_json`. What remains here is the one case that is
 * an infrastructure failure rather than a gap in the user's input: a Call-2
 * chunk that failed after retries. That is a retryable error, not a question.
 */

import type { PipelineUnresolved } from '../types';

/**
 * A transient Call-2 chunk failure means part of the meal was never analyzed.
 * The route maps this to a RETRYABLE error — asking the user about a portion
 * they already stated would be misleading. Returns `undefined` when every
 * chunk succeeded.
 */
export function resolveCompletenessGate(args: {
  failedMealItemNames: string[];
}): PipelineUnresolved | undefined {
  if (args.failedMealItemNames.length === 0) return undefined;
  return {
    mealItemName: args.failedMealItemNames[0],
    ingredientName: args.failedMealItemNames[0],
    reason: 'processing_incomplete',
    unresolvedCount: args.failedMealItemNames.length,
  };
}
