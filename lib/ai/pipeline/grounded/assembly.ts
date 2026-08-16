/**
 * Stage 4 of the grounded run: Call-2 output → the final `PipelineResult`.
 *
 * Bridges the v2 shapes onto the v1 inputs the shared resolver expects,
 * reconciles ingredient ids, assembles displayed totals, and — when the portion
 * vessel flag is on — re-attaches each meal item's vessel envelope. Runs inside
 * ONE `assembly` stage log so the admin timeline shows a single row for the
 * whole bridge → reconcile → assemble hop.
 */
import type { IngredientV2MatchResult } from '@/lib/ai/matching/top-k-cascade';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { assembleResult } from '@/lib/ai/pipeline/assemble/assemble';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { reconcileNutritionIds } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { bridgeV2ToV1 } from '@/lib/ai/pipeline/resolve/resolve';
import type { PortionResolution } from '@/lib/ai/portion/types';
import {
  attachVesselToMealItems,
  type VesselEnvelope,
} from '@/lib/ai/portion/vessel-envelope';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types';
import { withStageLogV2 } from './stage-log';

export type AssemblyStageResult = ReturnType<typeof assembleResult> & {
  bridged: ReturnType<typeof bridgeV2ToV1>;
};

export function runAssemblyStage(args: {
  traceContext: AnalyzeMealTraceContext | undefined;
  emit: (event: StreamEvent) => void;
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  grounded: GroundedEstimation;
  portionResolutions: PortionResolution[];
  streamedMealItemIds: Map<string, string>;
  vesselEnvelopes: Array<VesselEnvelope | null>;
  vesselEnabled: boolean;
  rawInput: string;
  userContext: UserContext;
}): Promise<AssemblyStageResult> {
  const {
    traceContext,
    emit,
    decomposition,
    matchResults,
    grounded,
    portionResolutions,
    streamedMealItemIds,
    vesselEnvelopes,
    vesselEnabled,
    rawInput,
    userContext,
  } = args;
  return withStageLogV2(
    traceContext,
    'assembly',
    4,
    { ingredientCount: matchResults.length },
    async (_ctx) => {
      emit({ type: 'stage', stage: 'assembling' });
      const bridged = bridgeV2ToV1({
        v2: decomposition,
        matches: matchResults,
        grounded,
        mealContext: rawInput,
        preMintedMealItemIds: streamedMealItemIds,
        portionResolutions,
      });
      const reconciled = reconcileNutritionIds(
        bridged.rawNutrition,
        bridged.decomposition,
        bridged.matched
      );
      const assembled = assembleResult(
        bridged.decomposition,
        reconciled,
        bridged.matched,
        bridged.unmatched,
        userContext
      );
      if (vesselEnabled) {
        attachVesselToMealItems(
          assembled.result.mealItems,
          decomposition.mealItems,
          vesselEnvelopes
        );
      }
      return {
        bridged,
        ...assembled,
      };
    }
  );
}
