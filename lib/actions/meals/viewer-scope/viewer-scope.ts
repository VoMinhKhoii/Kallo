import type { PersistedMeal } from '@/lib/actions/meals/types';
import { checkFeatureGate } from '@/lib/domain/billing/feature-gate';
import { scopeNutritionForViewer } from '@/lib/domain/nutrition/premium-scope';

type MealResponse = PersistedMeal[] | { meal: PersistedMeal | null };

function scopePersistedMeal(meal: PersistedMeal): PersistedMeal {
  return {
    ...meal,
    nutrition: scopeNutritionForViewer(meal.nutrition, true),
    mealItemGroups: meal.mealItemGroups.map((group) => ({
      ...group,
      nutrition: scopeNutritionForViewer(group.nutrition, true),
      ingredients: group.ingredients.map((ingredient) => ({
        ...ingredient,
        nutrition: scopeNutritionForViewer(ingredient.nutrition, true),
      })),
    })),
  };
}

/**
 * Hide the persisted meals in `response` from a viewer without micronutrient
 * access. The gate resolves once, alongside the read or write and outside its
 * transaction/pool slot. A gate failure degrades to locked: the read or the
 * save that already committed still returns, with micronutrients hidden.
 * Response-only — stored nutrition always stays complete.
 */
export async function scopeMealResponseForViewer<T extends MealResponse>(
  userId: string,
  response: Promise<T>
): Promise<T> {
  const [gate, result] = await Promise.all([
    checkFeatureGate({ userId }, 'micronutrients').catch((error) => {
      console.error('Failed to resolve meal micronutrient access:', error);
      return { locked: true } as const;
    }),
    response,
  ]);
  if (!gate.locked) return result;
  if (Array.isArray(result)) return result.map(scopePersistedMeal) as T;
  return {
    ...result,
    meal: result.meal ? scopePersistedMeal(result.meal) : null,
  };
}
