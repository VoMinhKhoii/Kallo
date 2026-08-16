/**
 * Stage 2 of the v2 pipeline: turn a decomposition into everything Call 2
 * needs — top-K DB candidates per ingredient, server-resolved portions
 * (Phase-3 ladder), and the Call-2 payload. Pure orchestration glue with no
 * streaming or telemetry entanglement beyond the matching stage log.
 */

import { withDeadline } from '@/lib/async/with-deadline';
import type { AppDb } from '@/lib/db';
import type { GeminiClient } from '../gemini';
import {
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '../matching/top-k-cascade';
import { resolvePortionsForCallTwo } from '../portion/ingredient-portion';
import type { PortionResolution } from '../portion/types';
import {
  resolveVesselEnvelope,
  type VesselEnvelope,
} from '../portion/vessel-envelope';
import type { MealItemWithCandidates } from '../prompts/grounded-estimation';
import type { StreamEvent } from '../streaming/types';
import type { UserContext } from '../types';
import { MATCHING_TIMEOUT_MS } from './config/stage-timeouts';
import { buildCallTwoPayload, withStageLogV2 } from './grounded-support';
import type { AnalyzeMealTraceContext } from './orchestrator';
import type { MealDecompositionV2 } from './schemas-v2';

export interface GroundingPreparation {
  matchResults: IngredientV2MatchResult[];
  portionResolutions: PortionResolution[];
  resolvedGramsAnchors: Array<number | null>;
  vesselEnvelopes: Array<VesselEnvelope | null>;
  mealItemsWithCandidates: MealItemWithCandidates[];
}

export async function prepareGrounding(args: {
  decomposition: MealDecompositionV2;
  userContext: UserContext;
  db: AppDb;
  gemini: GeminiClient;
  traceContext: AnalyzeMealTraceContext | undefined;
  emit: (event: StreamEvent) => void;
  topK: number;
  matchConcurrency: number;
  vesselEnabled: boolean;
}): Promise<GroundingPreparation> {
  const { decomposition, traceContext, emit } = args;
  const flatIngredients = decomposition.mealItems.flatMap((mi) =>
    mi.ingredients.map((ing) => ({
      ingredient: ing,
      dishCookingMethod: mi.cookingMethod,
    }))
  );
  const matchResults: IngredientV2MatchResult[] = await withStageLogV2(
    traceContext,
    'matching',
    2,
    { ingredientCount: flatIngredients.length, topK: args.topK },
    async (_ctx) => {
      emit({ type: 'stage', stage: 'matching' });
      return withDeadline(
        matchTopKPerIngredient(
          flatIngredients.map((f) => f.ingredient),
          flatIngredients.map((f) => f.dishCookingMethod),
          args.db,
          args.gemini,
          { k: args.topK, concurrency: args.matchConcurrency }
        ),
        MATCHING_TIMEOUT_MS
      );
    }
  );

  // Portion resolver (Phase 3): a grounded weight becomes a Call-2 ANCHOR;
  // null → LLM estimates; unresolved → Phase-1 clarify. See `resolver.ts`.
  const { resolutions: portionResolutions, anchors: resolvedGramsAnchors } =
    resolvePortionsForCallTwo(flatIngredients, args.userContext.inputLanguage);

  const vesselEnvelopes = decomposition.mealItems.map((mealItem) =>
    args.vesselEnabled ? resolveVesselEnvelope(mealItem) : null
  );
  const mealItemsWithCandidates: MealItemWithCandidates[] = buildCallTwoPayload(
    decomposition,
    matchResults,
    resolvedGramsAnchors,
    vesselEnvelopes
  );
  return {
    matchResults,
    portionResolutions,
    resolvedGramsAnchors,
    vesselEnvelopes,
    mealItemsWithCandidates,
  };
}
