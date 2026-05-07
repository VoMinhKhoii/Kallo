import { convertCookedToRaw } from '../constants';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  NutritionAdjustment,
  PipelineResult,
  UnmatchedIngredient,
} from '../types';

// ---------------------------------------------------------------------------
// Thresholds (exported for test assertions)
// ---------------------------------------------------------------------------

export const THRESHOLDS = {
  /** No ingredient can exceed pure fat energy density */
  MAX_KCAL_PER_100G: 900,
  /** Spec §1.4 — per-100g macro caps; high bound triggers the envelope. */
  DENSITY_PROTEIN_PER_100G_MAX: 100,
  DENSITY_CARB_PER_100G_MAX: 100,
  DENSITY_FAT_PER_100G_MAX: 100,
  /** Spec §1.3 — kcal identity tolerance; denominator is reportedKcal. */
  MACRO_KCAL_IDENTITY_TOLERANCE: 0.2,
  /** Single meal item calorie cap */
  MAX_MEAL_ITEM_KCAL: 1500,
  /** Flag if LLM mid kcal deviates > this ratio from DB-scaled value */
  DB_DEVIATION_RATIO: 0.5,
  /** Flag if individual ingredient exceeds this weight */
  MAX_INGREDIENT_GRAMS: 500,
  /** Plausible total meal calorie range */
  MIN_TOTAL_KCAL: 50,
  MAX_TOTAL_KCAL: 3000,
  /** Flag if > this fraction of ingredients are unmatched */
  UNMATCHED_RATIO: 0.5,
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnomalyType =
  | 'calorie_density'
  | 'meal_item_cap'
  | 'weight_implausible'
  | 'db_deviation'
  | 'total_calories'
  | 'unmatched_ratio'
  | 'density_envelope'
  | 'macro_inconsistent'
  | 'implausible_grams';

export interface ValidationAnomaly {
  type: AnomalyType;
  message: string;
  severity: 'warning' | 'error';
  /**
   * Run-scoped compact ingredient ID (§0.1). Set when the anomaly is attributed
   * to a specific ingredient row. Anomalies that span a meal item or the
   * whole pipeline (e.g., `meal_item_cap`, `total_calories`,
   * `unmatched_ratio`) leave this undefined.
   */
  ingredientId?: string;
  /** Run-scoped compact meal-item ID (§0.1) when applicable. */
  mealItemId?: string;
}

const ingredientDisplayName = (
  ing: DecomposedMealItem['ingredients'][number]
): string => ing.rawName ?? ing.name ?? ing.canonicalName ?? '';

const ingredientGrams = (
  ing: DecomposedMealItem['ingredients'][number]
): number => ing.grams ?? ing.estimatedGrams ?? 0;

const ingredientCookingMethod = (
  mealItem: DecomposedMealItem,
  ing: DecomposedMealItem['ingredients'][number]
): string | null => mealItem.cookingMethod ?? ing.cookingMethod ?? null;

// ---------------------------------------------------------------------------
// Pre-assembly validation (Section 3.2 — after LLM Call 2, before assembly)
// ---------------------------------------------------------------------------

export function validateDecompositionOutput(
  decomposition: DecomposedMealItem[]
): ValidationAnomaly[] {
  const anomalies: ValidationAnomaly[] = [];

  for (const mealItem of decomposition) {
    for (const ing of mealItem.ingredients) {
      const grams = ingredientGrams(ing);
      if (grams <= 0) {
        anomalies.push({
          type: 'implausible_grams',
          message: `${ingredientDisplayName(ing)}: ${grams}g must be > 0`,
          severity: 'warning',
          ingredientId: ing.ingredientId,
          mealItemId: mealItem.mealItemId,
        });
      }
    }
  }

  return anomalies;
}

/**
 * Validate LLM nutrition output for implausible values.
 * Returns anomalies for logging — does NOT block the pipeline.
 */
export function validateNutritionOutput(
  nutrition: NutritionAdjustment,
  matched: MatchedIngredient[],
  decomposition: DecomposedMealItem[]
): ValidationAnomaly[] {
  const anomalies: ValidationAnomaly[] = [];
  // §0.1 — id-keyed lookups. When two dishes share an ingredient display
  // name (e.g., 'nước dùng'), name-keying silently overwrites; id-keying
  // attributes anomalies to the correct ingredient row.
  const matchedLookup = new Map<string, MatchedIngredient>();
  for (const m of matched) {
    if (m.ingredientId) matchedLookup.set(m.ingredientId, m);
  }

  // Build a lookup for decomposition grams + cooking method per ingredient
  const decomposedLookup = new Map<
    string,
    { grams: number; cookingMethod: string | null }
  >();
  for (const mi of decomposition) {
    for (const ing of mi.ingredients) {
      if (!ing.ingredientId) continue;
      decomposedLookup.set(ing.ingredientId, {
        grams: ingredientGrams(ing),
        cookingMethod: ingredientCookingMethod(mi, ing),
      });
    }
  }

  for (const mealItem of nutrition.mealItems) {
    let mealItemMidKcal = 0;

    for (const ing of mealItem.ingredients) {
      const midKcal = ing.caloriesKcal.mid;
      mealItemMidKcal += midKcal;

      const ingredientId = ing.ingredientId;
      const decomposed = ingredientId
        ? decomposedLookup.get(ingredientId)
        : undefined;
      const matchInfo = ingredientId
        ? matchedLookup.get(ingredientId)
        : undefined;
      if (matchInfo) {
        const dbKcalPer100g = matchInfo.nutritionPer100g.caloriesKcal;

        // Calorie density: does DB value itself exceed pure fat?
        if (
          dbKcalPer100g != null &&
          dbKcalPer100g > THRESHOLDS.MAX_KCAL_PER_100G
        ) {
          anomalies.push({
            type: 'calorie_density',
            message: `${ing.ingredientName}: DB ${dbKcalPer100g} kcal/100g > ${THRESHOLDS.MAX_KCAL_PER_100G}`,
            severity: 'warning',
            ingredientId,
            mealItemId: mealItem.mealItemId,
          });
        }

        // DB-anchor deviation: compare LLM mid kcal vs DB-scaled value
        if (dbKcalPer100g != null && dbKcalPer100g > 0 && midKcal > 0) {
          if (decomposed) {
            const rawGrams = convertCookedToRaw(
              decomposed.grams,
              decomposed.cookingMethod
            );
            const dbScaledKcal = (rawGrams / 100) * dbKcalPer100g;
            const deviation = Math.abs(midKcal - dbScaledKcal) / dbScaledKcal;
            if (deviation > THRESHOLDS.DB_DEVIATION_RATIO) {
              anomalies.push({
                type: 'db_deviation',
                message: `${ing.ingredientName} in ${mealItem.mealItemName}: LLM ${midKcal.toFixed(0)} vs DB-scaled ${dbScaledKcal.toFixed(0)} kcal (${(deviation * 100).toFixed(0)}% deviation)`,
                severity: 'warning',
                ingredientId,
                mealItemId: mealItem.mealItemId,
              });
            }
          }
        }
      }

      // §1.4 — density envelope (matched + unmatched)
      const grams = decomposed?.grams ?? null;
      if (grams && grams > 0) {
        const density = (val: number) => (val / grams) * 100;
        const breaches: string[] = [];

        const kcalDensity = density(ing.caloriesKcal.high);
        if (
          ing.caloriesKcal.high > 0 &&
          kcalDensity > THRESHOLDS.MAX_KCAL_PER_100G
        ) {
          breaches.push(
            `kcal density ${kcalDensity.toFixed(0)}/100g > ${THRESHOLDS.MAX_KCAL_PER_100G}`
          );
        }

        const proteinDensity = density(ing.proteinG.high);
        if (
          ing.proteinG.high > 0 &&
          proteinDensity > THRESHOLDS.DENSITY_PROTEIN_PER_100G_MAX
        ) {
          breaches.push(`protein density ${proteinDensity.toFixed(0)}/100g`);
        }

        const carbDensity = density(ing.carbohydrateG.high);
        if (
          ing.carbohydrateG.high > 0 &&
          carbDensity > THRESHOLDS.DENSITY_CARB_PER_100G_MAX
        ) {
          breaches.push(`carb density ${carbDensity.toFixed(0)}/100g`);
        }

        const fatDensity = density(ing.fatG.high);
        if (
          ing.fatG.high > 0 &&
          fatDensity > THRESHOLDS.DENSITY_FAT_PER_100G_MAX
        ) {
          breaches.push(`fat density ${fatDensity.toFixed(0)}/100g`);
        }

        if (
          ing.caloriesKcal.low < 0 ||
          ing.proteinG.low < 0 ||
          ing.carbohydrateG.low < 0 ||
          ing.fatG.low < 0
        ) {
          breaches.push('negative low bound');
        }

        if (breaches.length > 0) {
          anomalies.push({
            type: 'density_envelope',
            message: `${ing.ingredientName}: ${breaches.join('; ')}`,
            severity: 'warning',
            ingredientId,
            mealItemId: mealItem.mealItemId,
          });
        }
      }

      // §1.3 — macro consistency (matched + unmatched). Denominator is
      // reportedKcal (max 1) so over-reporting and under-reporting are symmetric.
      for (const channel of ['low', 'mid', 'high'] as const) {
        const kcalFromMacros =
          4 * ing.proteinG[channel] +
          4 * ing.carbohydrateG[channel] +
          9 * ing.fatG[channel];
        const reportedKcal = ing.caloriesKcal[channel];
        const denom = Math.max(reportedKcal, 1);
        const deviation = Math.abs(reportedKcal - kcalFromMacros) / denom;

        if (deviation > THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE) {
          anomalies.push({
            type: 'macro_inconsistent',
            message: `${ing.ingredientName} ${channel}: kcal ${reportedKcal.toFixed(0)} vs 4P+4C+9F=${kcalFromMacros.toFixed(0)} (${(deviation * 100).toFixed(0)}% > ${(THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE * 100).toFixed(0)}%)`,
            severity: 'warning',
            ingredientId,
            mealItemId: mealItem.mealItemId,
          });
          break;
        }
      }
    }

    // Meal item calorie cap
    if (mealItemMidKcal > THRESHOLDS.MAX_MEAL_ITEM_KCAL) {
      anomalies.push({
        type: 'meal_item_cap',
        message: `${mealItem.mealItemName}: ${mealItemMidKcal.toFixed(0)} kcal > ${THRESHOLDS.MAX_MEAL_ITEM_KCAL}`,
        severity: 'warning',
        mealItemId: mealItem.mealItemId,
      });
    }
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Post-assembly anomaly detection (Section 5.2)
// ---------------------------------------------------------------------------

/**
 * Lightweight anomaly detection on the assembled pipeline result.
 * Flags logged for monitoring — does NOT block the response.
 */
export function detectAnomalies(
  result: PipelineResult,
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[]
): ValidationAnomaly[] {
  const anomalies: ValidationAnomaly[] = [];

  // Total calories range check
  const totalMidKcal = result.boundedNutrition.caloriesKcal?.mid ?? 0;
  if (totalMidKcal < THRESHOLDS.MIN_TOTAL_KCAL) {
    anomalies.push({
      type: 'total_calories',
      message:
        totalMidKcal === 0
          ? 'Total 0 kcal — likely LLM failure'
          : `Total ${totalMidKcal.toFixed(0)} kcal < ${THRESHOLDS.MIN_TOTAL_KCAL} — suspiciously low`,
      severity: totalMidKcal === 0 ? 'error' : 'warning',
    });
  }
  if (totalMidKcal > THRESHOLDS.MAX_TOTAL_KCAL) {
    anomalies.push({
      type: 'total_calories',
      message: `Total ${totalMidKcal.toFixed(0)} kcal > ${THRESHOLDS.MAX_TOTAL_KCAL} — suspiciously high`,
      severity: 'warning',
    });
  }

  // Individual ingredient weight check
  for (const mealItem of result.mealItems) {
    for (const ing of mealItem.ingredients) {
      if (ing.estimatedGrams > THRESHOLDS.MAX_INGREDIENT_GRAMS) {
        anomalies.push({
          type: 'weight_implausible',
          message: `${ing.ingredientName}: ${ing.estimatedGrams}g > ${THRESHOLDS.MAX_INGREDIENT_GRAMS}g`,
          severity: 'warning',
        });
      }
    }
  }

  // Unmatched ratio check
  const total = matched.length + unmatched.length;
  if (total > 0 && unmatched.length / total > THRESHOLDS.UNMATCHED_RATIO) {
    anomalies.push({
      type: 'unmatched_ratio',
      message: `${unmatched.length}/${total} unmatched (>${(THRESHOLDS.UNMATCHED_RATIO * 100).toFixed(0)}%)`,
      severity: 'warning',
    });
  }

  return anomalies;
}

// ---------------------------------------------------------------------------
// Three-state anomaly classification (Stream D — D7)
// ---------------------------------------------------------------------------

export type AnomalyDecision =
  | 'proceed'
  | 'flag_and_proceed'
  | 'retry_step2'
  | 'reject';

/**
 * Classify a list of anomalies into an action decision.
 *
 * This function only CLASSIFIES — actual retry orchestration stays in the
 * orchestrator which will call this after Stream A merges.
 *
 * Decision logic:
 * - No anomalies → `proceed`
 * - All warnings with some valid data → `flag_and_proceed`
 * - Zero total calories or negative values (severity=error) → `retry_step2`
 * - Multiple errors with no recoverable data → `reject`
 */
export function classifyAnomalies(
  anomalies: ValidationAnomaly[]
): AnomalyDecision {
  if (anomalies.length === 0) return 'proceed';

  const errors = anomalies.filter((a) => a.severity === 'error');
  const warnings = anomalies.filter((a) => a.severity === 'warning');

  // Multiple severe errors with no warnings → likely unrecoverable
  if (errors.length >= 2 && warnings.length === 0) {
    return 'reject';
  }

  // Any error (zero calories, LLM failure) → worth a retry
  if (errors.length > 0) {
    return 'retry_step2';
  }

  // Only warnings — data is present but suspicious
  return 'flag_and_proceed';
}
