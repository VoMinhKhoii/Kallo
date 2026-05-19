/**
 * V2 streaming parsers — adapt v1's incremental decode for the grounded
 * estimation schema. The Call 1 (decomposition) regex in `./parsers.ts` is
 * schema-agnostic (matches `"name": "..."` followed by `cookingMethod` or
 * `ingredients`) and works against v2 verbatim, so it is reused as-is.
 *
 * What's v2-specific:
 *   1. `extractCompletedGroundedMealItems` — same outer detection as v1's
 *      `extractCompletedMealItemNutrition` (looks for `{"mealItemName":` markers)
 *      but parses into the v2 `GroundedMealItem` shape (with `grams`,
 *      `selectedCandidateId`).
 *   2. `resolveStreamingV2MealItem` — bridges a streamed v2 meal item into
 *      the v1 `MealItemNutrition` shape with server-anchored macros, so the
 *      existing `computeStreamingMealItem` (goal-adjusted display sum) can
 *      run unchanged.
 */
import type { IngredientV2MatchResult } from '../matching/v2-cascade';
import type { RawNutritionAdjustment } from '../pipeline/nutrition';
import { __testing as nutritionTesting } from '../pipeline/nutrition';
import type {
  DecomposedIngredientV2,
  GroundedIngredientEstimate,
  GroundedMealItem,
} from '../pipeline/schemas';
import type {
  IngredientLlmNutrition,
  MacroBase,
  MealItemNutrition,
} from '../types';

const ZERO_TRIPLE = { low: 0, mid: 0, high: 0 } as const;

/**
 * Same partial-JSON marker as v1's nutrition stream. Each `{"mealItemName":`
 * starts a new meal item; the previous one is "complete" once the next
 * marker appears.
 */
const MEAL_ITEM_START_RE = /\{\s*"mealItemName"\s*:\s*"/g;

/**
 * Detect meal items whose JSON has fully streamed in. A meal item is
 * "complete" when the next `{"mealItemName":` marker appears in the
 * accumulated stream.
 *
 * Mirrors the v1 helper for the grounded estimation schema; safe to call on
 * every chunk.
 */
export function extractCompletedGroundedMealItems(
  accumulated: string,
  lastExtractedCount: number
): { items: GroundedMealItem[]; newCount: number } {
  MEAL_ITEM_START_RE.lastIndex = 0;
  const positions: number[] = [];
  let match = MEAL_ITEM_START_RE.exec(accumulated);
  while (match !== null) {
    positions.push(match.index);
    match = MEAL_ITEM_START_RE.exec(accumulated);
  }

  const completedCount = Math.max(0, positions.length - 1);
  if (completedCount <= lastExtractedCount) {
    return { items: [], newCount: lastExtractedCount };
  }

  const newItems: GroundedMealItem[] = [];
  for (let i = lastExtractedCount; i < completedCount; i++) {
    const start = positions[i];
    const end = positions[i + 1];
    let itemStr = accumulated.slice(start, end).trim();
    if (itemStr.endsWith(',')) itemStr = itemStr.slice(0, -1);
    try {
      const parsed = JSON.parse(itemStr);
      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        typeof parsed.mealItemName === 'string' &&
        Array.isArray(parsed.ingredients)
      ) {
        newItems.push(parsed as GroundedMealItem);
      }
    } catch {
      // Partial/malformed — skip; will be picked up once the chunk closes.
    }
  }
  return { items: newItems, newCount: completedCount };
}

/**
 * Resolve a streamed v2 meal item into the v1 `MealItemNutrition` shape with
 * server-anchored macros applied. Mirrors `bridgeV2ToV1` per-ingredient but
 * works on ONE meal item at a time, on the fly.
 *
 * For each ingredient in the streamed item:
 *   - `selectedCandidateId = "c1"..` and candidate exists → MATCHED.
 *     base = candidate.per_100g × grams / 100; apply
 *     `resolveIngredientMacros(rawIng, base, grams, prepNotesPresent)` so
 *     P/C anchor to base (or move within prep-notes band) and fat keeps the
 *     LLM triple subject to the guard.
 *   - `selectedCandidateId = "none"` or missing → UNMATCHED. Pass macros
 *     verbatim through `resolveIngredientMacros(rawIng, undefined, grams)`
 *     so the density clamp still fires.
 *
 * The result is exactly the shape `computeStreamingMealItem` consumes.
 *
 * `decomposedIngredients` is the meal-item's slice from the v2 decomposition
 * (in stream order), used to look up `prepNotes`.
 *
 * `matchResults` is the full flat top-K result array; `flatIngredientStart`
 * tells us the offset into that array for the first ingredient of this
 * meal item.
 */
export function resolveStreamingV2MealItem(
  rawItem: GroundedMealItem,
  decomposedIngredients: DecomposedIngredientV2[],
  matchResults: IngredientV2MatchResult[],
  flatIngredientStart: number
): { nutrition: MealItemNutrition; totalGrams: number } {
  const ingredients: IngredientLlmNutrition[] = [];
  let totalGrams = 0;

  rawItem.ingredients.forEach((rawIng, localIdx) => {
    const flatIdx = flatIngredientStart + localIdx;
    const matchResult = matchResults.find((m) => m.ingredientIndex === flatIdx);
    const candidates = matchResult?.candidates ?? [];
    const decompForName = decomposedIngredients.find(
      (d) => d.rawName === rawIng.ingredientName
    );
    const prepNotesPresent =
      (decompForName?.prepNotes ?? []).some(
        (n) => typeof n === 'string' && n.trim().length > 0
      ) ?? false;

    const grams = rawIng.grams > 0 ? rawIng.grams : 1;
    totalGrams += grams;

    const base = computeBaseFromVerdict(rawIng, candidates, grams);

    const rawAdjustment: RawNutritionAdjustment['mealItems'][number]['ingredients'][number] =
      {
        ingredientName: rawIng.ingredientName,
        caloriesKcal: rawIng.caloriesKcal,
        proteinG: rawIng.proteinG,
        carbohydrateG: rawIng.carbohydrateG,
        fatG: rawIng.fatG,
      };

    const resolved = nutritionTesting.resolveIngredientMacros(
      rawAdjustment,
      base,
      grams,
      prepNotesPresent
    );

    ingredients.push({
      // Stream-time MealItemNutrition; the final reconciliation supplies the
      // run-scoped ids. The display layer ignores this id field.
      ingredientId: '',
      ingredientName: rawIng.ingredientName,
      ...resolved,
    });
  });

  return {
    nutrition: {
      mealItemId: undefined,
      mealItemName: rawItem.mealItemName,
      ingredients,
    },
    totalGrams,
  };
}

/**
 * Map a streamed verdict to the corresponding `MacroBase`. Returns
 * `undefined` when there's no DB anchor (rejected or no-candidate) — the
 * caller's resolver falls back to the unmatched path (LLM macros verbatim +
 * density clamp).
 */
function computeBaseFromVerdict(
  rawIng: GroundedIngredientEstimate,
  candidates: IngredientV2MatchResult['candidates'],
  grams: number
): MacroBase | undefined {
  const selected = rawIng.selectedCandidateId;
  if (!selected || selected === 'none') return undefined;
  const match = /^c(\d+)$/.exec(selected);
  if (!match) return undefined;
  const idx = Number.parseInt(match[1], 10) - 1;
  if (idx < 0 || idx >= candidates.length) return undefined;
  const candidate = candidates[idx];
  const per100g = candidate.nutrition;
  if (!per100g) return undefined;
  return {
    caloriesKcal: (per100g.caloriesKcal ?? 0) * (grams / 100),
    proteinG: (per100g.proteinG ?? 0) * (grams / 100),
    carbohydrateG: (per100g.carbohydrateG ?? 0) * (grams / 100),
    fatG: (per100g.fatG ?? 0) * (grams / 100),
  };
}

/**
 * Map each v2 meal item to the `(decomposed ingredients slice, flat-ingredient
 * start offset)` pair the streaming resolver needs. Computed once per request
 * from the parsed v2 decomposition, so streaming chunks just look up by
 * meal-item index.
 */
export function buildPerMealItemOffsetMap(
  v2MealItems: Array<{ ingredients: DecomposedIngredientV2[] }>
): Array<{
  decomposedIngredients: DecomposedIngredientV2[];
  flatIngredientStart: number;
}> {
  let start = 0;
  return v2MealItems.map((mi) => {
    const entry = {
      decomposedIngredients: mi.ingredients,
      flatIngredientStart: start,
    };
    start += mi.ingredients.length;
    return entry;
  });
}

// Re-export the zero triple for tests that need a deterministic placeholder.
export const __testingV2Stream = { ZERO_TRIPLE };
