import type { PipelineVessel } from '@/lib/ai/portion/vessel/types';
import type { MealSlot } from '@/lib/ai/types/decomposition';
import type { PipelineError } from '@/lib/ai/types/errors';
import type { UnmatchedIngredient } from '@/lib/ai/types/matching';
import type {
  BoundedNutrition,
  NutritionValues,
} from '@/lib/ai/types/nutrition-values';

// Pipeline result (returned to caller).

/** Confidence level for overall meal analysis */
export type MealConfidence = 'high' | 'medium' | 'low';

/** Final processed ingredient in the pipeline result */
export interface ProcessedIngredient {
  ingredientName: string;
  foodCompositionId: string | null;
  /** Authoritative DB food-group taxonomy; absent on legacy/unmatched rows. */
  foodGroupEn?: string;
  estimatedGrams: number;
  /**
   * Grams used internally for DB-row nutrition scaling. Equals
   * `estimatedGrams` when the matched DB row is cooked. Equals
   * the legacy cooked-to-raw fallback when the row is raw or dbState is
   * 'unknown'. Display layers should use `estimatedGrams`.
   *
   * @deprecated Field name is misleading post-Chunk 3. Rename to
   * `dbScalingGrams` in a follow-up once spec §1.5 retirement gate trips and
   * the legacy fallback is removed entirely.
   */
  rawEquivalentGrams: number;
  cookingMethod: string | null;
  userFacingUnit: string | null;
  matchConfidence: number | null;
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
}

/** Final processed meal item in the pipeline result */
export interface PipelineMealItem {
  name: string;
  ingredients: ProcessedIngredient[];
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
  vessel?: PipelineVessel;
}

/** Full pipeline result for a successful analysis */
export interface PipelineResult {
  mealItems: PipelineMealItem[];
  mealSlot: MealSlot | null;
  confidenceOverall: MealConfidence;
  boundedNutrition: BoundedNutrition;
  displayedNutrition: NutritionValues;
  unmatchedIngredients: UnmatchedIngredient[];
}

/**
 * A Call-2 chunk failed after retries, so part of the meal was never analyzed.
 * The route emits a retryable error INSTEAD of persisting a partial meal.
 * Present only on the v2 grounded path; v1 never sets it.
 *
 * There is no portion ask-back: an ingredient whose portion looked shaky ships
 * on its best estimate and the user corrects it with the visual portion picker.
 */
export interface PipelineUnresolved {
  /** Owning meal-item name of the failed chunk. */
  mealItemName: string;
  /** Display name for the failed item. */
  ingredientName: string;
  /**
   * 'processing_incomplete' — transient infra failure (a Call-2 chunk failed
   * after retries), NOT a gap in the user's input.
   * 'no_macro_data' — the bridge withheld an ingredient that had no usable
   * macro source, so the meal's totals would silently under-count real food.
   */
  reason: 'processing_incomplete' | 'no_macro_data';
  /** Count of meal items whose chunk failed, or ingredients withheld. */
  unresolvedCount: number;
  /** Withheld names for the coverage log; see `emitPartialFailure`. */
  carvedOutNames?: string[];
}

/** Discriminated union result type */
export type PipelineResponse =
  | {
      success: true;
      data: PipelineResult;
      /** Set when ≥1 ingredient couldn't be resolved (see PipelineUnresolved). */
      unresolved?: PipelineUnresolved;
      __telemetry?: import('@/lib/ai/pipeline/telemetry/run-telemetry').PipelineRunRow;
      __telemetryRunId?: string;
      /** Resolves once the pipeline_runs row insert has committed.
       * Consumers that need the row to exist before referencing it via FK
       * (e.g. pipeline_shadow_runs.primary_run_id) must await this. */
      __telemetryRunPersisted?: Promise<void>;
    }
  | {
      success: false;
      error: PipelineError;
      __telemetry?: import('@/lib/ai/pipeline/telemetry/run-telemetry').PipelineRunRow;
      __telemetryRunId?: string;
      __telemetryRunPersisted?: Promise<void>;
    };
