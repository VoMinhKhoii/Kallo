import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { resolveUnitType } from '@/lib/ai/portion/lexicon/unit-lexicon';
import { nameKey } from '@/lib/core/text/name-key';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';

/**
 * Whether a part's count is the dish's count rather than an amount the user
 * gave for that part. Call 1 puts a counted dish's count on every part it
 * splits into ("2 burgers" → bun, patty and frying oil, each `count: 2,
 * unitToken: "burger"`), so a count that every food of the dish carries, in
 * the same unit, belongs to the dish. The cooking oil may or may not carry
 * it, so it is not asked. A dish where only some foods are counted ("2 quả
 * trứng, 2 quả cà chua và rau") keeps those as typed, and so does a shared
 * spoon, cup or gram measure ("1 muỗng dầu, 1 muỗng nước mắm"). Code that
 * treats a counted part as typed (a stated oil, a part's fixed size in a
 * weighed dish) asks this first.
 */
export function isDishCount(
  dish: DecomposedDishV2,
  part: DecomposedIngredientV2
): boolean {
  if (part.count == null) return false;
  const unit = resolveUnitType(part.unitToken);
  if (unit === 'volume' || unit === 'mass') return false;
  const key = nameKey(part.unitToken ?? '');
  const foods = dish.ingredients.filter(
    (i) => !isDiscreteOilIngredient(i.rawName)
  );
  // One food's count is its own amount; the oil beside it only copies it.
  const needed = isDiscreteOilIngredient(part.rawName) ? 1 : 2;
  return (
    foods.length >= needed &&
    foods.every(
      (food) =>
        food.count === part.count && nameKey(food.unitToken ?? '') === key
    )
  );
}
