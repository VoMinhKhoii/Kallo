/**
 * Stage 2 of the v2 pipeline: turn a decomposition into everything Call 2
 * needs — top-K DB candidates per ingredient, server-resolved portions
 * (Phase-3 ladder), and the Call-2 payload. Pure orchestration glue with no
 * streaming or telemetry entanglement beyond the matching stage log.
 */

import {
  type IngredientV2MatchResult,
  matchTopKPerIngredient,
} from '@/lib/ai/matching/retrieve/top-k-cascade';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { MATCHING_TIMEOUT_MS } from '@/lib/ai/pipeline/config/stage-timeouts';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { resolvePortionsForCallTwo } from '@/lib/ai/portion/ingredient-portion';
import type { PortionResolution } from '@/lib/ai/portion/types';
import {
  resolveVesselEnvelope,
  type VesselEnvelope,
} from '@/lib/ai/portion/vessel/envelope';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types/user-context';
import { withDeadline } from '@/lib/core/async/with-deadline';
import type { AppDb } from '@/lib/infra/db';
import { withStageLogV2 } from './stage-log';

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

/** Build the per-meal-item payload for the grounded-estimation prompt.
 *
 * `matchResults` is built in flat-ingredient order by `matchTopKPerIngredient`
 * (one entry per ingredient with `ingredientIndex === position`), so direct
 * indexing is correct and avoids an O(N²) scan.
 */
export function buildCallTwoPayload(
  decomposition: MealDecompositionV2,
  matchResults: IngredientV2MatchResult[],
  /**
   * Server-resolved portion grams per flat ingredient (Phase 3). When present
   * and > 0, becomes the Call-2 ANCHOR so the LLM does not re-estimate weight.
   * Indexed in the same flat order as `matchResults`.
   */
  resolvedGramsByFlatIdx?: Array<number | null>,
  vesselEnvelopes?: Array<VesselEnvelope | null>
): MealItemWithCandidates[] {
  let flatIdx = 0;
  return decomposition.mealItems.map((mi, mealItemIndex) => ({
    mealItem: mi,
    vesselEnvelope: vesselEnvelopes?.[mealItemIndex] ?? null,
    ingredients: mi.ingredients.map((ing) => {
      const matchResult = matchResults[flatIdx];
      const anchor = resolvedGramsByFlatIdx?.[flatIdx] ?? null;
      flatIdx++;
      const candidates = (matchResult?.candidates ?? []).map((c, i) => ({
        id: `c${i + 1}`,
        similarity: c.info.similarity,
        dbName: c.info.matchedName,
        dbState: c.info.state,
        source: c.info.source ?? ('fao' as const),
        per100gKcal: c.nutrition?.caloriesKcal ?? null,
        per100gProteinG: c.nutrition?.proteinG ?? null,
        per100gCarbohydrateG: c.nutrition?.carbohydrateG ?? null,
        per100gFatG: c.nutrition?.fatG ?? null,
        inediblePct: c.inediblePct,
      }));
      return { ingredient: ing, candidates, resolvedGramsAnchor: anchor };
    }),
  }));
}
