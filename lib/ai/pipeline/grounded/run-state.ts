import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { PortionResolution } from '@/lib/ai/portion/types';

/**
 * The pipeline state after Call 2: decomposition, match results, portion
 * resolutions and estimates, index-aligned by flat ingredient.
 */
export interface RunState {
  decomposition: MealDecompositionV2;
  matchResults: IngredientV2MatchResult[];
  portionResolutions: PortionResolution[];
  grounded: GroundedEstimation;
}
