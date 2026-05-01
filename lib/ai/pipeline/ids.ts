import { randomUUID } from 'node:crypto';
import type {
  DecomposedIngredient,
  DecomposedMealItem,
  MealDecomposition,
} from '../types';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isValidUuid = (v: unknown): v is string =>
  typeof v === 'string' && UUID_RE.test(v);

export const generateMealItemId = (): string => randomUUID();
export const generateIngredientId = (): string => randomUUID();

/**
 * Decomposition shape with `mealItemId` / `ingredientId` guaranteed to be
 * present and valid. Returned by `ensureIdsOnDecomposition` so downstream
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
 * Runtime is authoritative for ids. Even though the LLM must emit them, we
 * replace any non-UUID or duplicate id with a fresh UUID. Spec §0.1.
 */
export function ensureIdsOnDecomposition(
  decomp: MealDecomposition
): MealDecompositionWithIds {
  const seenItem = new Set<string>();
  const seenIng = new Set<string>();
  return {
    ...decomp,
    mealItems: decomp.mealItems.map((mi) => {
      const id =
        isValidUuid(mi.mealItemId) && !seenItem.has(mi.mealItemId)
          ? mi.mealItemId
          : generateMealItemId();
      seenItem.add(id);
      return {
        ...mi,
        mealItemId: id,
        ingredients: mi.ingredients.map((ing) => {
          const ingId =
            isValidUuid(ing.ingredientId) && !seenIng.has(ing.ingredientId)
              ? ing.ingredientId
              : generateIngredientId();
          seenIng.add(ingId);
          return { ...ing, ingredientId: ingId };
        }),
      };
    }),
  };
}
