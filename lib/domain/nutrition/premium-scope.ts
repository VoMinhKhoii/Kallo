import type { PersistedMeal } from '@/lib/actions/meals/types';
import {
  NUTRITION_KEYS,
  type NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import { checkFeatureGate } from '@/lib/domain/billing/feature-gate';
import type { DaySeriesMetricKey, MacroKey, NutritionOverview } from './types';

/** Response-only projection. Stored nutrition must always remain complete. */
export function scopeNutritionForViewer(
  values: NutritionValues,
  locked: boolean
): NutritionValues {
  if (!locked) return values;
  const scoped = { ...values };
  for (const key of NUTRITION_KEYS) scoped[key] = null;
  scoped.caloriesKcal = values.caloriesKcal;
  scoped.proteinG = values.proteinG;
  scoped.carbohydrateG = values.carbohydrateG;
  scoped.fatG = values.fatG;
  return scoped;
}

export function scopePersistedMealForViewer(
  meal: PersistedMeal,
  locked: boolean
): PersistedMeal {
  if (!locked) return meal;
  return {
    ...meal,
    nutrition: scopeNutritionForViewer(meal.nutrition, locked),
    mealItemGroups: meal.mealItemGroups.map((group) => ({
      ...group,
      nutrition: scopeNutritionForViewer(group.nutrition, locked),
      ingredients: group.ingredients.map((ingredient) => ({
        ...ingredient,
        nutrition: scopeNutritionForViewer(ingredient.nutrition, locked),
      })),
    })),
  };
}

/** Resolve once alongside the operation, outside its transaction/pool slot. */
export async function scopeMealResponseForViewer<
  T extends { meal: PersistedMeal | null },
>(userId: string, response: Promise<T>): Promise<T> {
  const [gate, result] = await Promise.all([
    checkFeatureGate({ userId }, 'micronutrients').catch((error) => {
      // The write may already have committed. Preserve its success while
      // hiding paid figures when access cannot be established.
      console.error('Failed to resolve meal micronutrient access:', error);
      return { locked: true } as const;
    }),
    response,
  ]);
  return {
    ...result,
    meal: result.meal
      ? scopePersistedMealForViewer(result.meal, gate.locked)
      : null,
  };
}

/**
 * The macro/calorie metrics a non-entitled viewer keeps on the time axis —
 * the same four `bucket-detail.ts` charts as macros. Everything else in
 * `daySeries.series` is a micronutrient and is dropped.
 */
const MACRO_METRICS = new Set<DaySeriesMetricKey>([
  'calories',
  'protein',
  'carbohydrate',
  'fat',
] satisfies MacroKey[]);

/**
 * Remove every micronutrient figure from an overview and flag it as locked.
 *
 * This runs SERVER-SIDE, between building the DTO and returning it, so the
 * data a non-entitled viewer is not paying for never reaches their client at
 * all — the lock is not a client-side rendering choice that a devtools tab
 * could undo. Calories and macros stay: only the micronutrient half of
 * `/nutrition` is premium.
 *
 * Pure: the input overview is not mutated, and the arrays it owns are replaced
 * rather than emptied in place.
 */
export function stripMicronutrients(
  overview: NutritionOverview
): NutritionOverview {
  return {
    ...overview,
    summary: {
      ...overview.summary,
      mostConsistent: [],
      needsAttention: [],
      limitedDataCount: 0,
    },
    daySeries: {
      ...overview.daySeries,
      series: overview.daySeries.series.filter((series) =>
        MACRO_METRICS.has(series.metric)
      ),
    },
    micronutrients: [],
    spotlight: [],
    steady: [],
    moreNutrients: [],
    educationCards: [],
    micronutrientsLocked: true,
  };
}
