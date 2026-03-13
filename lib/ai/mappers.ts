import type { userProfiles } from '@/lib/db/schema';
import type { MacroBreakdown, MealItem, ParsedMeal } from '@/lib/types/meal';
import type { PipelineResult, UserContext } from './types';

type ProfileRow = typeof userProfiles.$inferSelect;

/**
 * Builds UserContext from a user profile DB row.
 * Shared by both the server action and the API route.
 */
export function buildUserContext(profile: ProfileRow): UserContext {
  return {
    goal: profile.goal as UserContext['goal'],
    aggression: profile.aggression ? Number(profile.aggression) : 0,
    regionalProfile: profile.regionalProfile as UserContext['regionalProfile'],
    cookingHabits: {
      oilUsage: (profile.oilUsage ??
        'normal') as UserContext['cookingHabits']['oilUsage'],
      defaultRicePortion: (profile.defaultRicePortion ??
        'medium') as UserContext['cookingHabits']['defaultRicePortion'],
      sugarBraised: (profile.sugarBraised ??
        'medium') as UserContext['cookingHabits']['sugarBraised'],
      defaultProteinPortion: (profile.defaultProteinPortion ??
        'medium') as UserContext['cookingHabits']['defaultProteinPortion'],
      brothConsumption: (profile.brothConsumption ??
        'some') as UserContext['cookingHabits']['brothConsumption'],
    },
  };
}

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
export function toParsedMeal(result: PipelineResult): ParsedMeal {
  const items: MealItem[] = result.mealItems.map((mealItem, idx) => ({
    id: `item-${idx + 1}`,
    name: mealItem.name,
    quantity: mealItem.ingredients.reduce(
      (sum, ing) => sum + ing.estimatedGrams,
      0
    ),
    unit:
      mealItem.ingredients.length === 1
        ? (mealItem.ingredients[0].userFacingUnit ?? 'g')
        : 'g',
    macros: toMacros(mealItem.displayedNutrition),
  }));

  return {
    mealName: result.mealItems.map((item) => item.name).join(', '),
    items,
    totalMacros: toMacros(result.displayedNutrition),
  };
}
