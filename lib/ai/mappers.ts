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
 * Flattens meal items into a simple list with 4-macro display.
 */
export function toParsedMeal(result: PipelineResult): ParsedMeal {
  const items: MealItem[] = [];
  let counter = 1;

  for (const mealItem of result.mealItems) {
    for (const ingredient of mealItem.ingredients) {
      items.push({
        id: `item-${counter++}`,
        name: ingredient.ingredientName,
        quantity: ingredient.estimatedGrams,
        unit: ingredient.userFacingUnit ?? 'g',
        macros: toMacros(ingredient.displayedNutrition),
      });
    }
  }

  return {
    mealName: result.mealItems.map((item) => item.name).join(', '),
    items,
    totalMacros: toMacros(result.displayedNutrition),
  };
}
