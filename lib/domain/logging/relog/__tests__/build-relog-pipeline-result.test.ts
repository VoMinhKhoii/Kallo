/**
 * Unit tests for the frozen-relog PipelineResult builders — the correctness
 * heart of routing relog picks through the AI review card. The load-bearing
 * claim: a relogged dish carries FINAL goal-adjusted macros with no bounded
 * snapshot, yet confirm re-runs goalAdjustNutrition on every ingredient. These
 * tests prove the degenerate-triple trick neutralizes that re-adjustment (and
 * survives a gram edit), so confirmed numbers equal the picked numbers exactly.
 */
import { describe, expect, it } from 'vitest';
import type { ResolvedDish } from '@/lib/actions/meals/relog/expand-refs';
import { goalAdjustNutrition } from '@/lib/ai/pipeline/assemble/goal-adjustment';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import { NUTRITION_KEYS } from '@/lib/ai/types/nutrition-values';
import type { PipelineMealItem } from '@/lib/ai/types/result';
import {
  buildFrozenMealItem,
  buildPickPipelineResult,
  mergeRelogIntoPipelineResult,
  type RelogSourceRow,
  toDegenerateBounded,
} from '@/lib/domain/logging/relog/build-relog-pipeline-result';

// A meal_items-shaped row. Only the fields the builder reads matter; nutrient
// columns are keyed by NUTRITION_KEYS (extractNutritionValues reads them).
function row(
  overrides: Partial<RelogSourceRow> &
    Partial<Record<keyof NutritionValues, number | null>> & {
      mealItemName: string;
    }
): RelogSourceRow & Record<string, unknown> {
  const base: Record<string, unknown> = {};
  for (const key of NUTRITION_KEYS) base[key] = null;
  return {
    mealId: 'm1',
    mealItemOrder: 0,
    ingredientName: 'ing',
    foodCompositionId: null,
    estimatedGrams: 100,
    userFacingUnit: 'g',
    cookingMethod: null,
    matchConfidence: 0.9,
    ...base,
    ...overrides,
  } as RelogSourceRow & Record<string, unknown>;
}

function dish(
  name: string,
  rows: (RelogSourceRow & Record<string, unknown>)[]
): ResolvedDish<RelogSourceRow> {
  // `refIndex` tags which staged pick produced the dish; these builders never
  // read it, so one value is enough here.
  return { name, rows, refIndex: 0 };
}

describe('toDegenerateBounded', () => {
  it('maps a value v to {low:v, mid:v, high:v} and null to null', () => {
    const values = { caloriesKcal: 420, proteinG: null } as NutritionValues;
    const bounded = toDegenerateBounded(values);
    expect(bounded.caloriesKcal).toEqual({ low: 420, mid: 420, high: 420 });
    expect(bounded.proteinG).toBeNull();
  });
});

describe('degenerate triple survives goal adjustment (confirm no-op)', () => {
  it('returns the exact stored value under an aggressive cutting profile', () => {
    const values = {
      caloriesKcal: 420,
      proteinG: 20,
      carbohydrateG: 60,
      fatG: 10,
    } as NutritionValues;
    const adjusted = goalAdjustNutrition(
      toDegenerateBounded(values),
      'cutting',
      0.8
    );
    expect(adjusted.caloriesKcal).toBe(420);
    expect(adjusted.proteinG).toBe(20);
    expect(adjusted.carbohydrateG).toBe(60);
    expect(adjusted.fatG).toBe(10);
  });

  it('stays a no-op after a gram edit scales the triple', () => {
    // Confirm's scaleIngredient multiplies low/mid/high by one ratio. Emulate a
    // 1.5× gram edit on a degenerate triple and re-adjust: still exact.
    const bounded = toDegenerateBounded({
      caloriesKcal: 420,
    } as NutritionValues);
    const ratio = 1.5;
    const scaled = {
      ...bounded,
      caloriesKcal: {
        low: bounded.caloriesKcal!.low * ratio,
        mid: bounded.caloriesKcal!.mid * ratio,
        high: bounded.caloriesKcal!.high * ratio,
      },
    };
    expect(goalAdjustNutrition(scaled, 'bulking', 0.8).caloriesKcal).toBe(630);
  });
});

describe('buildFrozenMealItem', () => {
  it('copies per-ingredient metadata verbatim', () => {
    const item = buildFrozenMealItem(
      dish('Phở bò', [
        row({
          mealItemName: 'Phở bò',
          ingredientName: 'bánh phở',
          userFacingUnit: 'bowl',
          cookingMethod: 'nấu',
          matchConfidence: 0.75,
          foodCompositionId: 'fc-1',
          caloriesKcal: 300,
        }),
      ])
    );
    const ing = item.ingredients[0];
    expect(ing.userFacingUnit).toBe('bowl');
    expect(ing.cookingMethod).toBe('nấu');
    expect(ing.matchConfidence).toBe(0.75);
    expect(ing.foodCompositionId).toBe('fc-1');
    // Degenerate triple mirrors the stored displayed value.
    expect(ing.boundedNutrition.caloriesKcal).toEqual({
      low: 300,
      mid: 300,
      high: 300,
    });
    expect(ing.displayedNutrition.caloriesKcal).toBe(300);
  });
});

/** The dishes a caller used to hand in directly, now frozen first — the
 *  resolver does this step so a scanned product can join the same list. */
function frozen(dishes: Parameters<typeof buildFrozenMealItem>[0][]) {
  return dishes.map((d) => buildFrozenMealItem(d));
}

describe('buildPickPipelineResult', () => {
  it('sums meal nutrition from the frozen rows and empties unmatched', () => {
    const result = buildPickPipelineResult(
      frozen([
        dish('A', [row({ mealItemName: 'A', caloriesKcal: 100, proteinG: 5 })]),
        dish('B', [row({ mealItemName: 'B', caloriesKcal: 250, proteinG: 8 })]),
      ]),
      'high'
    );
    expect(result.displayedNutrition.caloriesKcal).toBe(350);
    expect(result.displayedNutrition.proteinG).toBe(13);
    expect(result.unmatchedIngredients).toEqual([]);
    expect(result.mealSlot).toBeNull();
  });

  it('carries the confidence the resolver decided, unchanged', () => {
    // Deciding it is `resolveComposerPicks`' job — the weakest across the
    // source meals, or 'high' when every pick was a scanned label.
    expect(
      buildPickPipelineResult(
        frozen([dish('A', [row({ mealItemName: 'A' })])]),
        'low'
      ).confidenceOverall
    ).toBe('low');
  });

  it('keeps duplicate picks as distinct items (no group merge / halving)', () => {
    // Two picks of the same dish → two items. Confirm keys meal_item_order on
    // array index, so this is what stops the pair collapsing into one halved
    // group.
    const result = buildPickPipelineResult(
      frozen([
        dish('Cà phê', [row({ mealItemName: 'Cà phê', caloriesKcal: 50 })]),
        dish('Cà phê', [row({ mealItemName: 'Cà phê', caloriesKcal: 50 })]),
      ]),
      'medium'
    );
    expect(result.mealItems).toHaveLength(2);
    expect(result.displayedNutrition.caloriesKcal).toBe(100);
  });
});

describe('mergeRelogIntoPipelineResult', () => {
  const aiItem: PipelineMealItem = {
    name: '2 eggs',
    ingredients: [],
    boundedNutrition: toDegenerateBounded({
      caloriesKcal: 150,
    } as NutritionValues),
    displayedNutrition: { caloriesKcal: 150 } as NutritionValues,
  };
  const aiResult = {
    mealItems: [aiItem],
    mealSlot: 'breakfast' as const,
    confidenceOverall: 'high' as const,
    boundedNutrition: aiItem.boundedNutrition,
    displayedNutrition: aiItem.displayedNutrition,
    unmatchedIngredients: [{ ingredientName: 'x', mealContext: 'y' }],
  };

  it('appends relog items after AI items and sums totals', () => {
    const relogItem = buildFrozenMealItem(
      dish('Cà phê', [row({ mealItemName: 'Cà phê', caloriesKcal: 50 })])
    );
    const merged = mergeRelogIntoPipelineResult(
      aiResult,
      [relogItem],
      'medium'
    );
    expect(merged.mealItems.map((i) => i.name)).toEqual(['2 eggs', 'Cà phê']);
    expect(merged.displayedNutrition.caloriesKcal).toBe(200);
    // Weakest of AI ('high') and relog ('medium').
    expect(merged.confidenceOverall).toBe('medium');
    // AI's unmatched carries through; relog adds none.
    expect(merged.unmatchedIngredients).toHaveLength(1);
    expect(merged.mealSlot).toBe('breakfast');
  });
});
