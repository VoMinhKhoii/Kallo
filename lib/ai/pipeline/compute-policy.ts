/**
 * @file pickComputePolicy -- pure routing for adaptive compute (spec §4.2).
 *
 * Principle B contract: MealFactsForComputePolicy contains facts about THIS
 * meal, never user-shaped data. To add a field, add it to the interface and
 * MEAL_FACTS_KEYS together, and justify why it is a fact about the meal.
 */
import type { ModelProfile } from './model-profile';
import type { AnomalyType } from './validation';

/**
 * Narrow-by-design input to {@link pickComputePolicy}.
 *
 * Principle B guard: this type intentionally contains only facts about the
 * current meal. Do not add user, region, goal, clock, env, or raw-input fields.
 */
export interface MealFactsForComputePolicy {
  ingredientCount: number;
  matchedCount: number;
  unmatchedCount: number;
  anomalyTypes: ReadonlyArray<AnomalyType>;
  parseRetryCount: number;
  candidateConfidenceSummary: {
    high: number;
    medium: number;
    low: number;
    ambiguous: number;
  };
}

export interface ComputePolicyDecision {
  call2Model: string;
  /** When true, an anomaly retry should re-run Call 2 against escalation. */
  escalateOnRetry: boolean;
}

export const MEAL_FACTS_KEYS = [
  'ingredientCount',
  'matchedCount',
  'unmatchedCount',
  'anomalyTypes',
  'parseRetryCount',
  'candidateConfidenceSummary',
] as const satisfies ReadonlyArray<keyof MealFactsForComputePolicy>;

type AssertTrue<T extends true> = T;
type _AssertExhaustiveMealFactKeys = AssertTrue<
  Exclude<
    keyof MealFactsForComputePolicy,
    (typeof MEAL_FACTS_KEYS)[number]
  > extends never
    ? true
    : false
>;

const UNMATCHED_RATIO_ESCALATION_THRESHOLD = 0.5;

export function pickComputePolicy(
  facts: MealFactsForComputePolicy,
  profile: ModelProfile
): ComputePolicyDecision {
  const escalationModel = profile.escalationModel;
  const unmatchedRatio =
    facts.ingredientCount > 0
      ? facts.unmatchedCount / facts.ingredientCount
      : 0;
  const upfrontEscalate =
    escalationModel !== null &&
    unmatchedRatio > UNMATCHED_RATIO_ESCALATION_THRESHOLD;
  const anomalyPresent = facts.anomalyTypes.length > 0;

  return {
    call2Model: upfrontEscalate ? escalationModel : profile.nutritionModel,
    escalateOnRetry:
      escalationModel !== null && (anomalyPresent || upfrontEscalate),
  };
}

export function summarizeCandidateConfidence(
  matchResults: ReadonlyArray<{ matchConfidence: number | null }>
): MealFactsForComputePolicy['candidateConfidenceSummary'] {
  const summary = { high: 0, medium: 0, low: 0, ambiguous: 0 };

  for (const result of matchResults) {
    const confidence = result.matchConfidence;
    if (confidence === null) {
      summary.ambiguous += 1;
    } else if (confidence >= 0.85) {
      summary.high += 1;
    } else if (confidence >= 0.65) {
      summary.medium += 1;
    } else if (confidence >= 0.4) {
      summary.low += 1;
    } else {
      summary.ambiguous += 1;
    }
  }

  return summary;
}
