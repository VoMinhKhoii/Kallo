import type {
  DecomposedIngredient,
  DecomposedMealItem,
  MealDecomposition,
} from '@/lib/ai/types';
import { createCompactIdSequence, isCompactPipelineId } from './compact-id';

export const generateMealItemId = (): string =>
  createCompactIdSequence().nextMealItemId();
export const generateIngredientId = (): string =>
  createCompactIdSequence().nextIngredientId();

/**
 * Decomposition shape with compact `mealItemId` / `ingredientId` guaranteed to
 * be present and valid. Returned by `ensureIdsOnDecomposition` so downstream
 * consumers (assembly, validation, SSE) can rely on stable ids without
 * non-null assertions.
 */
export type DecomposedIngredientWithId = DecomposedIngredient & {
  ingredientId: string;
};
export type DecomposedMealItemWithId = Omit<
  DecomposedMealItem,
  'ingredients'
> & {
  mealItemId: string;
  ingredients: DecomposedIngredientWithId[];
};
export type MealDecompositionWithIds = Omit<MealDecomposition, 'mealItems'> & {
  mealItems: DecomposedMealItemWithId[];
};

/**
 * Runtime is authoritative for ids. We preserve unique compact IDs and replace
 * missing, legacy UUID, malformed, or duplicate IDs with run-scoped compact IDs.
 */
export function ensureIdsOnDecomposition(
  decomp: MealDecomposition
): MealDecompositionWithIds {
  const seenItem = new Set<string>();
  const seenIng = new Set<string>();
  const sequence = createCompactIdSequence();
  return {
    ...decomp,
    mealItems: decomp.mealItems.map((mi) => {
      const id =
        isCompactPipelineId(mi.mealItemId) && !seenItem.has(mi.mealItemId)
          ? mi.mealItemId
          : sequence.nextMealItemId(seenItem);
      seenItem.add(id);
      return {
        ...mi,
        mealItemId: id,
        ingredients: mi.ingredients.map((ing) => {
          const ingId =
            isCompactPipelineId(ing.ingredientId) &&
            !seenIng.has(ing.ingredientId)
              ? ing.ingredientId
              : sequence.nextIngredientId(seenIng);
          seenIng.add(ingId);
          return { ...ing, ingredientId: ingId };
        }),
      };
    }),
  };
}
