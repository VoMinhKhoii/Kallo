import {
  COOKED_TO_RAW_FACTOR,
  DEFAULT_COOKED_TO_RAW_FACTOR,
} from '@/lib/ai/portion/data/cooking-yield';

/** Convert cooked/as-eaten weight to raw equivalent using cooking method factor.
 * Normalizes the input to lowercase before lookup — LLM structured output
 * frequently emits Title-cased English methods ("Boiled", "Grilled") and
 * the table is keyed in lowercase, so without normalization a Boiled meat
 * silently falls through to factor=1.0 (~33% gram overestimate). */
export function convertCookedToRaw(
  cookedGrams: number,
  cookingMethod: string | null
): number {
  const factor = cookingMethod
    ? (COOKED_TO_RAW_FACTOR[cookingMethod.toLowerCase().trim()] ??
      DEFAULT_COOKED_TO_RAW_FACTOR)
    : DEFAULT_COOKED_TO_RAW_FACTOR;
  return Math.round(cookedGrams * factor);
}
