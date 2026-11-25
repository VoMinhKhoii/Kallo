/**
 * Keep a dish's parts off the whole dish's row. Call 1 splits a dish into
 * parts ("chả lá lốt" → minced pork, lá lốt leaves, egg, oil); card retrieval
 * can then offer the whole "chả lá lốt, rán" row for the part "lá lốt", and a
 * Call 2 that picks it counts the dish again inside one of its own parts.
 *
 * A candidate goes when its card says it is a whole dish (`eatenState`
 * 'dish') and one of its names holds every word of the meal item's name,
 * unless the part is that dish: Call 1 logged the dish itself as a part
 * ("chả lá lốt" or "chả lá lốt rán" inside "chả lá lốt"), so the part names
 * the dish and the row names the part. A part like "vỏ bánh giò" (the
 * wrapper) names the dish too, but the whole "bánh giò" row lacks "vỏ".
 * Language-neutral: words are compared folded (case, diacritics, đ), with no
 * cue-word lists.
 */
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { fold } from '@/lib/core/text/fold';
import { isDiscreteOilIngredient } from '@/lib/domain/nutrition/absorbed-oil';

const words = (s: string | null | undefined) =>
  fold(s ?? '')
    .split(/[^\p{L}]+/u)
    .filter(Boolean);

/** Every one of `wanted` appears among the words of `name`. */
function covers(name: string | null | undefined, wanted: readonly string[]) {
  const have = new Set(words(name));
  return wanted.every((w) => have.has(w));
}

/**
 * `matchResults` in flat-ingredient order (as `buildCallTwoPayload` reads
 * them). Returns new results with the whole-dish rows taken off each part;
 * the input is not modified. Only meal items with at least two non-oil parts
 * are touched, and a list is never emptied.
 */
export function dropWholeDishRowsFromParts(
  decomposition: MealDecompositionV2,
  matchResults: IngredientV2MatchResult[]
): IngredientV2MatchResult[] {
  const out = [...matchResults];
  let flat = 0;
  for (const mealItem of decomposition.mealItems) {
    const start = flat;
    flat += mealItem.ingredients.length;
    const dish = words(mealItem.name);
    if (dish.length === 0) continue;
    const parts = mealItem.ingredients.filter(
      (ing) => !isDiscreteOilIngredient(ing.rawName)
    );
    if (parts.length < 2) continue;
    mealItem.ingredients.forEach((ing, i) => {
      const result = out[start + i];
      if (!result || result.candidates.length === 0) return;
      // The part's names that name the whole dish, as words. `nameVi` is the
      // part's plain Vietnamese name ("bánh chưng" for "Bánh chưng chiên",
      // "chả lá lốt" for "Chả"), so it still names the dish when the raw name
      // carries a cooking word or the canonical name is English.
      const asDish = [ing.rawName, ing.canonicalName, ing.nameVi]
        .filter((n) => covers(n, dish))
        .map(words);
      const kept = result.candidates.filter((c) => {
        if (c.info.eatenState !== 'dish') return true;
        const names = c.info.rowNames ?? [];
        if (!names.some((n) => covers(n, dish))) return true;
        // The part is the dish itself: its row is the right one.
        return asDish.some((p) => names.some((n) => covers(n, p)));
      });
      if (kept.length === 0 || kept.length === result.candidates.length) return;
      out[start + i] = { ...result, candidates: kept };
    });
  }
  return out;
}
