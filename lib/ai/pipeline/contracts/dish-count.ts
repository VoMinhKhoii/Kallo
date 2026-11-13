import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { resolveUnitType } from '@/lib/ai/portion/lexicon/unit-lexicon';
import { nameKey } from '@/lib/core/text/name-key';

/**
 * Whether a part's count is the dish's count rather than an amount the user
 * gave for that part. Call 1 puts a counted dish's count on every part it
 * splits into ("2 burgers" → bun, patty and frying oil, each `count: 2,
 * unitToken: "burger"`), so a count another part of the dish shares, in the
 * same unit, belongs to the dish. A shared spoon, cup or gram measure ("1
 * muỗng dầu, 1 muỗng nước mắm") is still each part's own amount. Code that
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
  return dish.ingredients.some(
    (other) =>
      other !== part &&
      other.count === part.count &&
      nameKey(other.unitToken ?? '') === key
  );
}
