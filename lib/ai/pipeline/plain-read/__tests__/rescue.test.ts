import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  goalAdjustNutrition,
  sumBoundedNutrition,
} from '@/lib/ai/pipeline/assemble/goal-adjustment';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import {
  type BoundedNutrition,
  NUTRITION_KEYS,
  type NutritionValues,
} from '@/lib/ai/types/nutrition-values';
import type {
  PipelineResult,
  ProcessedIngredient,
} from '@/lib/ai/types/result';
import type { HoldResult } from '../hold';
import {
  applyRescueEdits,
  holdDivergence,
  runSeeingRescue,
  shouldRunSeeingRescue,
} from '../rescue';
import {
  RESCUE_DIVERGENCE_THRESHOLD,
  RESCUE_MODEL,
  RESCUE_TIMEOUT_MS,
} from '../rescue-prompt';

function bounded(kcal: number, protein: number): BoundedNutrition {
  const out = {} as Record<string, unknown>;
  for (const k of NUTRITION_KEYS) out[k] = null;
  out.caloriesKcal = { low: kcal * 0.9, mid: kcal, high: kcal * 1.1 };
  out.proteinG = { low: protein * 0.9, mid: protein, high: protein * 1.1 };
  return out as BoundedNutrition;
}

function ingredient(
  name: string,
  grams: number,
  kcal: number,
  extra?: Partial<ProcessedIngredient>
): ProcessedIngredient {
  const b = bounded(kcal, kcal / 20);
  return {
    ingredientName: name,
    foodCompositionId: null,
    estimatedGrams: grams,
    rawEquivalentGrams: grams,
    cookingMethod: null,
    userFacingUnit: null,
    matchConfidence: null,
    boundedNutrition: b,
    displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
    ...extra,
  };
}

function meal(parts: ProcessedIngredient[]): PipelineResult {
  const b = sumBoundedNutrition(parts.map((p) => p.boundedNutrition));
  return {
    mealItems: [
      {
        name: 'dish',
        ingredients: parts,
        boundedNutrition: b,
        displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
      },
    ],
    mealSlot: null,
    confidenceOverall: 'medium',
    boundedNutrition: b,
    displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
    unmatchedIngredients: [],
  };
}

const kcalOf = (v: NutritionValues) => v.caloriesKcal ?? 0;

function client(impl: GeminiClient['generateStructuredOutput']): GeminiClient {
  return { generateStructuredOutput: impl } as unknown as GeminiClient;
}

const NO_COUNTRY = { countryOfOrigin: null, countryOfResidence: null };

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('shouldRunSeeingRescue', () => {
  const baseHold = (overrides: Partial<HoldResult>): HoldResult => ({
    result: meal([ingredient('rice', 200, 260)]),
    outcome: 'held',
    appKcal: 260,
    readKcal: 260,
    factor: 1,
    gramsFactor: 1,
    rawGramsFactor: 1,
    ...overrides,
  });

  it('triggers when factor and rawGramsFactor diverge past the threshold', () => {
    expect(holdDivergence(1.04, 5)).toBeCloseTo(5 / 1.04);
    expect(
      shouldRunSeeingRescue(baseHold({ factor: 1.04, rawGramsFactor: 5 }))
    ).toBe(true);
    expect(
      shouldRunSeeingRescue(
        baseHold({ outcome: 'within_band', factor: 1, rawGramsFactor: 1.67 })
      )
    ).toBe(true);
  });

  it('skips when divergence is below the threshold', () => {
    expect(
      shouldRunSeeingRescue(
        baseHold({
          factor: 1.1,
          rawGramsFactor: 1.1 * (RESCUE_DIVERGENCE_THRESHOLD - 0.05),
        })
      )
    ).toBe(false);
  });

  it.each([
    'no_read',
    'typed_parts',
    'no_calories',
  ] as const)('skips on %s even with large divergence', (outcome) => {
    expect(
      shouldRunSeeingRescue(baseHold({ outcome, factor: 1, rawGramsFactor: 4 }))
    ).toBe(false);
  });

  it('respects the PLAIN_READ_RESCUE_ENABLED=false kill switch', () => {
    vi.stubEnv('PLAIN_READ_RESCUE_ENABLED', 'false');
    expect(
      shouldRunSeeingRescue(baseHold({ factor: 1, rawGramsFactor: 5 }))
    ).toBe(false);
  });
});

describe('applyRescueEdits', () => {
  it('updates unlocked ingredients and keeps dish, meal, and confirm totals in sync', () => {
    const raw = meal([
      ingredient('Bánh canh', 200, 233, { typedAmount: 'grams' }),
      ingredient('Tôm', 22, 19),
      ingredient('Dầu ăn', 12, 108),
    ]);

    const rescued = applyRescueEdits(raw, [
      { index: 1, grams: 40, kcal: 40 },
      { index: 2, grams: 10, kcal: 90 },
    ]);

    const [noodles, shrimp, oil] = rescued.mealItems[0].ingredients;
    expect(noodles).toBe(raw.mealItems[0].ingredients[0]);
    expect(shrimp.estimatedGrams).toBe(40);
    expect(kcalOf(shrimp.displayedNutrition)).toBeCloseTo(40);
    expect(oil.estimatedGrams).toBe(10);
    expect(kcalOf(oil.displayedNutrition)).toBeCloseTo(90);

    // Confirm re-derives shown values from bounded triples: they must match.
    const reDerived = goalAdjustNutrition(
      sumBoundedNutrition(
        rescued.mealItems[0].ingredients.map((i) => i.boundedNutrition)
      ),
      'cutting',
      0.5
    );
    expect(kcalOf(reDerived)).toBeCloseTo(kcalOf(rescued.displayedNutrition));
  });

  it('never edits locked ingredients even if the model returns their index', () => {
    const raw = meal([
      ingredient('Bơ sáp', 120, 207, { typedAmount: 'grams' }),
      ingredient('Sữa đặc', 30, 100),
    ]);

    const rescued = applyRescueEdits(raw, [
      { index: 0, grams: 240, kcal: 414 },
    ]);
    expect(rescued).toBe(raw);
    expect(rescued.mealItems[0].ingredients[0].estimatedGrams).toBe(120);
  });

  it('caps edited density at 9 kcal/g, forces 0 g to 0 kcal, and blocks smuggling onto pure oil even under bulking', () => {
    const bulkingOil = ingredient('Dầu ăn', 10, 88.4);
    bulkingOil.displayedNutrition = goalAdjustNutrition(
      bulkingOil.boundedNutrition,
      'bulking',
      1
    );
    const raw = meal([
      ingredient('Garlic sauce', 15, 24),
      bulkingOil,
      ingredient('Herbs', 10, 5),
    ]);

    const rescued = applyRescueEdits(raw, [
      // Exceeds pure fat (9 kcal/g): clamped to 15 * 9 = 135 kcal.
      { index: 0, grams: 15, kcal: 200 },
      // Smuggling spring rolls onto oil (2.73 kcal/g on an 8.84 kcal/g row under bulking): rejected.
      { index: 1, grams: 83, kcal: 227 },
      // Zero grams cannot carry positive calories.
      { index: 2, grams: 0, kcal: 50 },
    ]);

    const [sauce, oil, herbs] = rescued.mealItems[0].ingredients;
    expect(sauce.estimatedGrams).toBe(15);
    expect(kcalOf(sauce.displayedNutrition)).toBeCloseTo(135);
    expect(oil).toBe(raw.mealItems[0].ingredients[1]);
    expect(herbs.estimatedGrams).toBe(0);
    expect(kcalOf(herbs.displayedNutrition)).toBe(0);
  });

  it('shifts excess density into fat so P + C + F never exceeds grams and confirm stays exact', () => {
    const b = bounded(24, 0.5);
    b.carbohydrateG = { low: 4.05, mid: 4.5, high: 4.95 };
    b.fatG = { low: 0.36, mid: 0.4, high: 0.44 };
    const sauce: ProcessedIngredient = {
      ...ingredient('Garlic sauce', 15, 24),
      boundedNutrition: b,
      displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
    };
    const raw = meal([sauce]);

    const rescued = applyRescueEdits(raw, [{ index: 0, grams: 15, kcal: 100 }]);
    const [after] = rescued.mealItems[0].ingredients;
    const d = after.displayedNutrition;
    const macroSum = (d.proteinG ?? 0) + (d.carbohydrateG ?? 0) + (d.fatG ?? 0);

    expect(after.estimatedGrams).toBe(15);
    expect(kcalOf(d)).toBeCloseTo(100);
    expect(macroSum).toBeLessThanOrEqual(15 + 1e-6);
    expect(d.fatG ?? 0).toBeGreaterThan(7);

    const reDerived = goalAdjustNutrition(
      sumBoundedNutrition([after.boundedNutrition]),
      'cutting',
      0.5
    );
    expect(kcalOf(reDerived)).toBeCloseTo(kcalOf(rescued.displayedNutrition));
    expect(reDerived.fatG).toBeCloseTo(d.fatG ?? 0);
  });

  it('scales micronutrients on a 0-kcal ingredient when resized', () => {
    const b = bounded(0, 0);
    b.sodiumMg = { low: 1080, mid: 1200, high: 1320 };
    const broth: ProcessedIngredient = {
      ...ingredient('Bone broth', 300, 0),
      boundedNutrition: b,
      displayedNutrition: goalAdjustNutrition(b, 'cutting', 0.5),
    };
    const raw = meal([broth]);

    const zeroed = applyRescueEdits(raw, [{ index: 0, grams: 0, kcal: 0 }]);
    expect(zeroed.mealItems[0].ingredients[0].displayedNutrition.sodiumMg).toBe(
      0
    );
    expect(zeroed.displayedNutrition.sodiumMg).toBe(0);

    const doubled = applyRescueEdits(raw, [{ index: 0, grams: 600, kcal: 0 }]);
    expect(
      doubled.mealItems[0].ingredients[0].displayedNutrition.sodiumMg
    ).toBeCloseTo((broth.displayedNutrition.sodiumMg ?? 0) * 2);
  });

  it('leaves the unheld meal intact when edits are empty', () => {
    const raw = meal([ingredient('Sữa đặc', 30, 100)]);
    expect(applyRescueEdits(raw, [])).toBe(raw);
  });
});

describe('runSeeingRescue', () => {
  const raw = meal([
    ingredient('Bơ sáp', 120, 207, { typedAmount: 'grams' }),
    ingredient('Sữa đặc', 30, 100),
  ]);
  const read = {
    totalKcal: 310,
    foods: [
      { name: 'Bơ sáp', pieces: 1, gramsEach: 120, grams: 120, kcal: 207 },
      { name: 'Sữa đặc', pieces: 2, gramsEach: 15, grams: 30, kcal: 100 },
      { name: 'Đá xay', pieces: 1, gramsEach: 100, grams: 100, kcal: 0 },
    ],
  };
  const hold: HoldResult = {
    result: raw,
    outcome: 'within_band',
    appKcal: kcalOf(raw.displayedNutrition),
    readKcal: 310,
    factor: 1,
    gramsFactor: 1,
    rawGramsFactor: 4.2,
  };

  it('calls the rescue model and returns a rescued HoldResult', async () => {
    const call = vi.fn().mockResolvedValue({
      diagnosis: 'Crushed ice omitted; solids already accurate.',
      edits: [],
    });

    const out = await runSeeingRescue({
      raw,
      read,
      hold,
      mealText: '120g bơ sáp, 2 muỗng sữa đặc, đá xay',
      profile: NO_COUNTRY,
      gemini: client(call),
      signal: new AbortController().signal,
    });

    expect(out?.outcome).toBe('rescued');
    expect(out?.result).toBe(raw);
    expect(out?.rawGramsFactor).toBe(4.2);
    const params = call.mock.calls[0][0];
    expect(params.model).toBe(RESCUE_MODEL);
    expect(params.userMessage).toContain('[LOCKED: user typed grams]');
    expect(params.userMessage).toContain('Sữa đặc');
  });

  it('returns null and aborts when the rescue misses RESCUE_TIMEOUT_MS', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let rescueSignal: AbortSignal | undefined;
    const call = vi.fn((params: { abortSignal: AbortSignal }) => {
      rescueSignal = params.abortSignal;
      return new Promise((_, reject) => {
        params.abortSignal.addEventListener('abort', () =>
          reject(new Error('AbortError'))
        );
      });
    });

    const pending = runSeeingRescue({
      raw,
      read,
      hold,
      mealText: 'test',
      profile: NO_COUNTRY,
      gemini: client(
        call as unknown as GeminiClient['generateStructuredOutput']
      ),
      signal: new AbortController().signal,
    });

    await vi.advanceTimersByTimeAsync(RESCUE_TIMEOUT_MS);
    await expect(pending).resolves.toBeNull();
    expect(rescueSignal?.aborted).toBe(true);
  });

  it('returns null when the rescue call fails or empties meal calories', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const failed = await runSeeingRescue({
      raw,
      read,
      hold,
      mealText: 'test',
      profile: NO_COUNTRY,
      gemini: client(vi.fn().mockRejectedValue(new Error('overloaded'))),
      signal: new AbortController().signal,
    });
    expect(failed).toBeNull();

    const unlockedOnly = meal([ingredient('Soup', 200, 150)]);
    const zeroed = await runSeeingRescue({
      raw: unlockedOnly,
      read,
      hold: { ...hold, result: unlockedOnly },
      mealText: 'test',
      profile: NO_COUNTRY,
      gemini: client(
        vi.fn().mockResolvedValue({
          diagnosis: 'zero',
          edits: [{ index: 0, grams: 0, kcal: 0 }],
        })
      ),
      signal: new AbortController().signal,
    });
    expect(zeroed).toBeNull();
  });

  it('falls back to null when all requested edits are rejected by guards', async () => {
    const out = await runSeeingRescue({
      raw,
      read,
      hold,
      mealText: '120g bơ sáp, 2 muỗng sữa đặc',
      profile: NO_COUNTRY,
      gemini: client(
        vi.fn().mockResolvedValue({
          diagnosis: 'Try editing locked index and out-of-range index',
          edits: [
            { index: 0, grams: 240, kcal: 400 },
            { index: 9, grams: 50, kcal: 50 },
          ],
        })
      ),
      signal: new AbortController().signal,
    });
    expect(out).toBeNull();
  });

  it('falls back to null on floating-point zeroed totals and extreme calorie/gram hallucinations', async () => {
    const multi = meal([
      ingredient('a', 100, 110.3),
      ingredient('b', 100, 220.6),
      ingredient('c', 100, 330.9),
    ]);
    const zeroedResidue = await runSeeingRescue({
      raw: multi,
      read,
      hold: {
        ...hold,
        result: multi,
        appKcal: kcalOf(multi.displayedNutrition),
      },
      mealText: 'test',
      profile: NO_COUNTRY,
      gemini: client(
        vi.fn().mockResolvedValue({
          diagnosis: 'zero all',
          edits: [
            { index: 0, grams: 0, kcal: 0 },
            { index: 1, grams: 0, kcal: 0 },
            { index: 2, grams: 0, kcal: 0 },
          ],
        })
      ),
      signal: new AbortController().signal,
    });
    expect(zeroedResidue).toBeNull();

    const extreme = await runSeeingRescue({
      raw,
      read,
      hold,
      mealText: 'test',
      profile: NO_COUNTRY,
      gemini: client(
        vi.fn().mockResolvedValue({
          diagnosis: 'injection',
          edits: [{ index: 1, grams: 50_000, kcal: 100_000 }],
        })
      ),
      signal: new AbortController().signal,
    });
    expect(extreme).toBeNull();
  });
});
