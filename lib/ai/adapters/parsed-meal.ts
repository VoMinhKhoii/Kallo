import { isRenderableVessel } from '@/lib/ai/portion/vessel/geometry';
import type {
  ClientVessel,
  PipelineVessel,
} from '@/lib/ai/portion/vessel/types';
import type { PipelineResult } from '@/lib/ai/types/result';
import type {
  MacroBreakdown,
  MealItem,
  ParsedMeal,
} from '@/lib/core/types/meal';

function toMacros(nutrition: {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
}): MacroBreakdown {
  return {
    calories: Math.round(nutrition.caloriesKcal ?? 0),
    protein: Math.round(nutrition.proteinG ?? 0),
    carbs: Math.round(nutrition.carbohydrateG ?? 0),
    fat: Math.round(nutrition.fatG ?? 0),
  };
}

/**
 * Maps PipelineResult → ParsedMeal for the /api/analyze-meal response.
 * Uses meal item names (user-facing cooked names) for display, not raw DB ingredient names.
 * estimatedGrams (cooked weight) is the display weight — rawEquivalentGrams is internal only.
 */
/**
 * Strips the pipeline's `provenance` discriminator and drops any vessel a
 * client picker could not safely render (see `isRenderableVessel`).
 *
 * The vessel is optional by design, so dropping it is the correct degradation:
 * the dish simply shows no portion line. Doing it HERE means web and Flutter
 * inherit one guarantee instead of each re-deriving it, and it covers stored
 * pending analyses too — `loadPendingAnalysesByDate` re-runs this mapper on
 * read, so a bad row written by an older pipeline is cleaned on its way out.
 */
function toClientVessel(vessel?: PipelineVessel): ClientVessel | undefined {
  if (!vessel) return undefined;
  const client: ClientVessel =
    vessel.provenance === 'piece_prior'
      ? {
          family: 'piece',
          tier: vessel.tier,
          count: vessel.count,
          kind: vessel.kind,
        }
      : {
          family: vessel.family,
          tier: vessel.tier,
          dishClass: vessel.dishClass,
        };
  return isRenderableVessel(client) ? client : undefined;
}

export function toParsedMeal(result: PipelineResult): ParsedMeal {
  const items: MealItem[] = result.mealItems.map((mealItem, idx) => ({
    id: `item-${idx + 1}`,
    name: mealItem.name,
    quantity: Math.round(
      mealItem.ingredients.reduce((sum, ing) => sum + ing.estimatedGrams, 0)
    ),
    unit: 'g',
    macros: toMacros(mealItem.displayedNutrition),
    vessel: toClientVessel(mealItem.vessel),
  }));

  return {
    mealName: result.mealItems.map((item) => item.name).join(', '),
    items,
    totalMacros: toMacros(result.displayedNutrition),
  };
}
