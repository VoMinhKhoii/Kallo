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

import { mealItemHasDiscreteOil } from '@/lib/ai/absorbed-oil';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/top-k-cascade';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedIngredientEstimate,
  GroundedMealItem,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { RawNutritionAdjustment } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { __testing as nutritionTesting } from '@/lib/ai/pipeline/resolve/macro-resolution';
import { resolveGroundedMass } from '@/lib/ai/pipeline/resolve/refuse-mass';
import { ZERO_TRIPLE } from '@/lib/ai/pipeline/resolve/verdicts';
import type {
  IngredientLlmNutrition,
  MacroBase,
  MealItemNutrition,
} from '@/lib/ai/types';

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
  dishCookingMethod: string | null,
  matchResults: IngredientV2MatchResult[],
  flatIngredientStart: number
): { nutrition: MealItemNutrition; totalGrams: number } {
  const ingredients: IngredientLlmNutrition[] = [];
  let totalGrams = 0;

  // Call-2 output follows the PROMPT's sorted ingredient order, not
  // decomposition order — map each streamed ingredient back to its
  // decomposition slot by normalized name + occurrence (mirrors the bridge's
  // pairing) so candidates/nutrition never attach to the wrong ingredient.
  const localIdxByName = new Map<string, number[]>();
  decomposedIngredients.forEach((d, i) => {
    const key = d.rawName.trim().toLocaleLowerCase('vi-VN');
    const queue = localIdxByName.get(key);
    if (queue) queue.push(i);
    else localIdxByName.set(key, [i]);
  });

  // Same rule the reconciled path applies (`nutrition.ts`): one discrete oil
  // row suppresses its siblings' absorbed-oil allowance. Without it the
  // streamed preview shows the oil twice and then silently corrects itself
  // once reconciliation lands.
  const siblingOilPresent = mealItemHasDiscreteOil(
    rawItem.ingredients.map((ing) => ing.ingredientName)
  );

  rawItem.ingredients.forEach((rawIng, streamIdx) => {
    const nameKey = rawIng.ingredientName.trim().toLocaleLowerCase('vi-VN');
    const localIdx = localIdxByName.get(nameKey)?.shift() ?? streamIdx;
    const flatIdx = flatIngredientStart + localIdx;
    const matchResult = matchResults[flatIdx];
    const candidates = matchResult?.candidates ?? [];
    const decompForName = decomposedIngredients[localIdx];
    const prepNotesPresent =
      (decompForName?.prepNotes ?? []).some(
        (n) => typeof n === 'string' && n.trim().length > 0
      ) ?? false;
    const cookingMethod =
      decompForName?.cookingMethod ?? dishCookingMethod ?? null;

    const selectedCandidate = candidateFromVerdict(rawIng, candidates);
    const mass = resolveGroundedMass({
      ground: rawIng,
      candidateInediblePct: selectedCandidate?.inediblePct ?? null,
      canonicalName: decompForName?.canonicalName ?? rawIng.ingredientName,
      rawName: decompForName?.rawName ?? rawIng.ingredientName,
      prepNotes: decompForName?.prepNotes,
    });
    const grams = mass.edibleG ?? 0;
    totalGrams += grams;

    const base = computeBaseFromVerdict(rawIng, candidates, grams);

    // Every macro triple is schema-REQUIRED now, so a well-formed Call-2
    // response can never omit one. These defaults survive for exactly one
    // reason: this speculative streaming path reads partial chunks with no zod
    // parse, so a triple can still be absent mid-stream from truncation. Zero
    // is the safe placeholder — a matched ingredient has it replaced by
    // resolveIngredientMacros from the DB anchor, and the final reconciliation
    // re-parses the complete payload.
    const rawAdjustment: RawNutritionAdjustment['mealItems'][number]['ingredients'][number] =
      {
        ingredientName: rawIng.ingredientName,
        caloriesKcal: rawIng.caloriesKcal ?? ZERO_TRIPLE,
        proteinG: rawIng.proteinG ?? ZERO_TRIPLE,
        carbohydrateG: rawIng.carbohydrateG ?? ZERO_TRIPLE,
        fatG: rawIng.fatG,
      };

    const resolved = nutritionTesting.resolveIngredientMacros(
      rawAdjustment,
      base,
      grams,
      prepNotesPresent,
      cookingMethod,
      decompForName?.prepNotes,
      siblingOilPresent
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

function candidateFromVerdict(
  rawIng: GroundedIngredientEstimate,
  candidates: IngredientV2MatchResult['candidates']
): IngredientV2MatchResult['candidates'][number] | null {
  const selected = rawIng.selectedCandidateId;
  if (!selected || selected === 'none') return null;
  const match = /^c(\d+)$/.exec(selected);
  if (!match) return null;
  const idx = Number.parseInt(match[1], 10) - 1;
  return idx >= 0 && idx < candidates.length ? candidates[idx] : null;
}

export interface MealItemOffset {
  decomposedIngredients: DecomposedIngredientV2[];
  dishCookingMethod: string | null;
  flatIngredientStart: number;
}

/**
 * Identity-based offset lookup keyed by `${lowercased name}::${occurrence}`
 * (1-based occurrence handles duplicate dish names like "Cơm trắng" × 2).
 *
 * Why (Phase 4, D4): Call 2's prompt sorts meal items + ingredients for
 * deterministic prompt caching (`buildIngredientDataBlock`), so the model
 * streams meal items back in SORTED order. The positional `perItemOffsets[i]`
 * built from the ORIGINAL decomposition order therefore attaches the wrong
 * decomposition slice (and thus the wrong candidate/prepNotes) to a streamed
 * item whenever sorted order ≠ original order. Matching on the streamed
 * `mealItemName` instead of array position attributes each `item_macros`
 * event to the correct meal item regardless of stream order — and is robust
 * to the D3 output-shape change.
 */
export function buildMealItemOffsetByName(
  v2MealItems: Array<{
    name: string;
    ingredients: DecomposedIngredientV2[];
    cookingMethod: string;
  }>
): Map<string, MealItemOffset> {
  const byName = new Map<string, MealItemOffset>();
  const occ = new Map<string, number>();
  let start = 0;
  for (const mi of v2MealItems) {
    const key = mi.name.trim().toLocaleLowerCase('vi-VN');
    const n = (occ.get(key) ?? 0) + 1;
    occ.set(key, n);
    byName.set(`${key}::${n}`, {
      decomposedIngredients: mi.ingredients,
      dishCookingMethod: mi.cookingMethod,
      flatIngredientStart: start,
    });
    start += mi.ingredients.length;
  }
  return byName;
}
