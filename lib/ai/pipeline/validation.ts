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
  | 'unmatched_ratio';

export interface ValidationAnomaly {
  type: AnomalyType;
  message: string;
  severity: 'warning' | 'error';
}

// ---------------------------------------------------------------------------
// Pre-assembly validation (Section 3.2 — after LLM Call 2, before assembly)
// ---------------------------------------------------------------------------

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
  const matchedLookup = new Map(matched.map((m) => [m.ingredientName, m]));

  // Build a lookup for decomposition grams + cooking method per ingredient
  const decomposedLookup = new Map<
    string,
    { estimatedGrams: number; cookingMethod: string | null }
  >();
  for (const mi of decomposition) {
    for (const ing of mi.ingredients) {
      decomposedLookup.set(ing.name, {
        estimatedGrams: ing.estimatedGrams,
        cookingMethod: ing.cookingMethod,
      });
    }
  }

  for (const mealItem of nutrition.mealItems) {
    let mealItemMidKcal = 0;

    for (const ing of mealItem.ingredients) {
      const midKcal = ing.caloriesKcal.mid;
      mealItemMidKcal += midKcal;

      const matchInfo = matchedLookup.get(ing.ingredientName);
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
          });
        }

        // DB-anchor deviation: compare LLM mid kcal vs DB-scaled value
        if (dbKcalPer100g != null && dbKcalPer100g > 0 && midKcal > 0) {
          const decomposed = decomposedLookup.get(ing.ingredientName);
          if (decomposed) {
            const rawGrams = convertCookedToRaw(
              decomposed.estimatedGrams,
              decomposed.cookingMethod
            );
            const dbScaledKcal = (rawGrams / 100) * dbKcalPer100g;
            const deviation = Math.abs(midKcal - dbScaledKcal) / dbScaledKcal;
            if (deviation > THRESHOLDS.DB_DEVIATION_RATIO) {
              anomalies.push({
                type: 'db_deviation',
                message: `${ing.ingredientName} in ${mealItem.mealItemName}: LLM ${midKcal.toFixed(0)} vs DB-scaled ${dbScaledKcal.toFixed(0)} kcal (${(deviation * 100).toFixed(0)}% deviation)`,
                severity: 'warning',
              });
            }
          }
        }
      }
    }

    // Meal item calorie cap
    if (mealItemMidKcal > THRESHOLDS.MAX_MEAL_ITEM_KCAL) {
      anomalies.push({
        type: 'meal_item_cap',
        message: `${mealItem.mealItemName}: ${mealItemMidKcal.toFixed(0)} kcal > ${THRESHOLDS.MAX_MEAL_ITEM_KCAL}`,
        severity: 'warning',
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
