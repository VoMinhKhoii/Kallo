/**
 * Checks on what Call 1 wrote about a food, beside its amounts
 * (`weights.ts`, `calories.ts`): the basis of a typed weight it describes as dry or raw,
 * and the language of a display name.
 */
import type {
  DecomposedIngredientV2,
  MealDecompositionV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { fold } from '@/lib/core/text/fold';

/** A food Call 1 itself describes as dry, raw or uncooked ("dry rolled oats", "gạo", "thịt bò sống"). */
const DESCRIBED_RAW =
  /(?<!\p{L})(?:dry|dried|uncooked|raw|khô|sống|chưa nấu)(?!\p{L})|^gạo(?!\p{L})/iu;
const DESCRIBED_COOKED =
  /(?<!\p{L})(?:cooked|boiled|steamed|grilled|roasted|baked|fried|seared|braised|stewed|simmered|poached|toasted|smoked|chín|luộc|hấp|nướng|chiên|rán|xào|kho|nấu)(?!\p{L})/iu;

/**
 * A weight typed on a food Call 1 describes as dry or raw is a raw weight,
 * in place: "80g arborio rice" in a risotto recipe, "40g dry oats". Without
 * this the basis is Call 2's to guess, run by run, and the typed grams are
 * priced on whichever row it picks: 80 g on a cooked rice row is 104 kcal, on
 * the dry row 280. Marked `raw_weight`, the search keeps raw rows only and
 * Call 2 is told the figure is raw. Only this direction: a food described as
 * cooked often has no cooked row of its own, and Call 2 then rightly prices
 * it on the raw one (Arena train: 145 of 491 such picks).
 */
export function holdWeighStateToDescription(
  decomposition: MealDecompositionV2
): void {
  for (const dish of decomposition.mealItems) {
    for (const ing of dish.ingredients) {
      if (!ing.explicitMass) continue;
      if (ing.stateHint === 'raw_weight' || ing.stateHint === 'cooked_weight')
        continue;
      const described = `${ing.rawName} ${ing.queryEn ?? ''}`.normalize('NFC');
      if (
        !DESCRIBED_RAW.test(ing.rawName.normalize('NFC')) &&
        !DESCRIBED_RAW.test(described)
      )
        continue;
      if (DESCRIBED_COOKED.test(described)) continue;
      ing.stateHint = 'raw_weight';
    }
  }
}

/**
 * Letters only Vietnamese uses. "é", "à" or "ã" alone are not enough: they
 * are also French, Spanish and Portuguese ("béarnaise", "jalapeño", "açaí").
 */
const VIETNAMESE_ONLY = /[ăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/iu;

/**
 * In an English answer, a food name in Vietnamese that the user did not type
 * is replaced by Call 1's English name for it, in place. Call 1 also writes a
 * Vietnamese name for every food (`nameVi`, for search), and now and then puts
 * it in the display name ("Dầu ăn" beside "Beef bulgogi"). A Vietnamese name
 * the user typed themselves ("bánh mì", or "banh mi" without its accents) is
 * theirs and stays.
 */
export function holdNamesToEnglish(
  decomposition: MealDecompositionV2,
  mealText: string
): void {
  const text = foldedWords(mealText);
  const typedWords = new Set(
    mealText
      .normalize('NFC')
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
  );
  for (const dish of decomposition.mealItems) {
    for (const ing of dish.ingredients) {
      if (!VIETNAMESE_ONLY.test(ing.rawName.normalize('NFC'))) continue;
      if (text.includes(foldedWords(ing.rawName))) continue;
      // "Phở bò" for a typed "phở": every Vietnamese word of the name is the
      // user's own, accents and all.
      const vietnamese = ing.rawName
        .normalize('NFC')
        .toLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter((w) => VIETNAMESE_ONLY.test(w));
      if (vietnamese.every((w) => typedWords.has(w))) continue;
      const english = englishName(ing);
      if (!english) continue;
      console.warn(
        `[call1-check] Vietnamese name "${ing.rawName}" in an English answer shown as "${english}"`
      );
      ing.rawName = english;
    }
  }
}

/** The words of a text without accents or case, each between spaces. */
function foldedWords(text: string): string {
  return ` ${fold(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
    .join(' ')} `;
}

function englishName(ing: DecomposedIngredientV2): string | undefined {
  return [ing.canonicalName, ing.queryEn].find(
    (name) => name && !VIETNAMESE_ONLY.test(name.normalize('NFC'))
  );
}
