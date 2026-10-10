/**
 * One rescue mini-meal: the same Call 1 → matching → Call 2 stages the main
 * run uses, on a one-dish text, with no client events and no stage traces.
 * Returns the single foods it found, each with its candidates and estimate.
 */
import type { ModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import type { EstimatorAttemptUsage } from '@/lib/ai/pipeline/estimator/types';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';
import { runCallTwoStage } from '../call-two/call-two';
import { runGroundedDecomposition } from '../decomposition';
import { prepareGrounding } from '../grounding';
import type { RescuePart } from './splice';

export interface SubMealDeps {
  userContext: UserContext;
  promptCtx: PromptPersonalizationContext;
  db: AppDb;
  gemini: GeminiClient;
  profile: ModelProfile;
  topK: number;
  matchConcurrency: number;
  vesselEnabled: boolean;
  temperature: number;
  decompositionRecorder: (usage: EstimatorAttemptUsage) => void;
  nutritionRecorder: (usage: EstimatorAttemptUsage) => void;
}

const silent = () => {};

export async function runRescueSubMeal(
  text: string,
  deps: SubMealDeps
): Promise<RescuePart[] | null> {
  const stage1 = await runGroundedDecomposition({
    rawInput: text,
    userContext: deps.userContext,
    db: deps.db,
    gemini: deps.gemini,
    traceContext: undefined,
    emit: silent,
    promptCtx: deps.promptCtx,
    profile: deps.profile,
    onAttemptComplete: deps.decompositionRecorder,
  });
  if (stage1.nonFood) return null;
  const { decomposition } = stage1;
  const prep = await prepareGrounding({
    decomposition,
    userContext: deps.userContext,
    db: deps.db,
    gemini: deps.gemini,
    traceContext: undefined,
    emit: silent,
    topK: deps.topK,
    matchConcurrency: deps.matchConcurrency,
    vesselEnabled: deps.vesselEnabled,
  });
  const { grounded } = await runCallTwoStage({
    traceContext: undefined,
    emit: silent,
    gemini: deps.gemini,
    profile: deps.profile,
    estimatorOverride: undefined,
    decomposition,
    matchResults: prep.matchResults,
    mealItemsWithCandidates: prep.mealItemsWithCandidates,
    streamedMealItemIds: new Map(),
    rawInput: text,
    promptCtx: deps.promptCtx,
    temperature: deps.temperature,
    userContext: deps.userContext,
    onAttemptComplete: deps.nutritionRecorder,
    onChunkTick: silent,
  });
  // A part inherits its mini-dish's cooking method, which the main dish's
  // method would otherwise replace.
  return pairIngredientsWithGrounded(decomposition, grounded).flatMap(
    ({ ingredient, dishCookingMethod, ground }, f) =>
      ground
        ? [
            {
              ingredient:
                ingredient.cookingMethod || !dishCookingMethod
                  ? ingredient
                  : { ...ingredient, cookingMethod: dishCookingMethod },
              match: prep.matchResults[f],
              estimate: ground,
            },
          ]
        : []
  );
}
