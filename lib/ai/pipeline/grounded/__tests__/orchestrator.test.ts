import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createMockGemini,
  createSourceAwareMockDb,
} from '@/lib/ai/__fixtures__/test-helpers';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { analyzeMealV2 } from '@/lib/ai/pipeline/grounded/orchestrator';
import type { UserContext } from '@/lib/ai/types/user-context';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const userContext: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

/** Build a Gemini mock that returns the given Call 1 decomposition and Call
 *  2 grounded estimation in order. Embedding calls return a flat vector.
 */
function geminiReturning(
  call1: MealDecompositionV2,
  call2: GroundedEstimation
) {
  let call = 0;
  return createMockGemini({
    generateStructuredOutputStream: vi.fn().mockImplementation(async () => {
      // First structured call = decomposition v2, second = grounded.
      const out = call === 0 ? call1 : call2;
      call++;
      return out;
    }),
  });
}

describe('analyzeMealV2 — accepted candidate, server-anchored P/C', () => {
  it('still runs Call 2 for a fully grounded exact match', async () => {
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'đùi gà nướng',
          cookingMethod: 'nướng',
          ingredients: [{ rawName: 'đùi gà', canonicalName: 'Đùi gà' }],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'đùi gà nướng',
          ingredients: [
            {
              ingredientName: 'đùi gà',
              selectedCandidateId: 'c1',
              grossG: 150,
              refusePct: 0,
              caloriesKcal: { low: 0, mid: 0, high: 0 },
              proteinG: { low: 0, mid: 0, high: 0 }, // server overrides anyway
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 20, mid: 21, high: 22 },
            },
          ],
        },
      ],
    };
    const gemini = geminiReturning(call1, call2);
    const db = createSourceAwareMockDb({
      exact: [
        {
          id: 'fc-thigh',
          name_primary: 'Đùi gà',
          state: 'cooked',
        },
      ],
      fao_vector: [
        {
          id: 'fc-thigh',
          name_primary: 'Đùi gà',
          name_alt: null,
          name_en: 'Chicken thigh',
          state: 'cooked',
          similarity: 0.92,
        },
      ],
      nutrition: [
        {
          id: 'fc-thigh',
          calories_kcal: 220,
          protein_g: 24,
          carbohydrate_g: 0,
          fat_g: 14,
          inedible_portion_pct: 0,
        },
      ],
    });

    const result = await analyzeMealV2(
      '1 đùi gà nướng',
      userContext,
      db,
      gemini
    );
    expect(result.success).toBe(true);
    // Call 1 plus Call 2. Before the mandatory-Call-2 change, this exact-match
    // + curated portion-prior case qualified for the fast path and called the
    // model only once.
    expect(gemini.generateStructuredOutputStream).toHaveBeenCalledTimes(2);
    if (result.success) {
      const pr = result.data;
      expect(pr.mealItems).toHaveLength(1);
      const ing = pr.mealItems[0].ingredients[0];
      // base.proteinG = 24 × 150 / 100 = 36; flat triple (no prep notes).
      expect(ing.boundedNutrition.proteinG?.mid).toBeCloseTo(36, 1);
      // base.fatG = 14 × 150 / 100 = 21; LLM passed 21 within guard.
      expect(ing.boundedNutrition.fatG?.mid).toBeCloseTo(21, 1);
      // kcal derived: 4×36 + 9×21 = 333.
      expect(ing.boundedNutrition.caloriesKcal?.mid).toBeCloseTo(333, 1);
    }
  });
});

describe('analyzeMealV2 — rejected verdict ("none") routes through unmatched path', () => {
  it('passes LLM macros through verbatim when CRAG rejects all candidates', async () => {
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'ức gà',
          cookingMethod: 'nướng',
          ingredients: [{ rawName: 'ức gà', canonicalName: 'Ức gà' }],
        },
      ],
    };
    // Matching returns a candidate (the whole-bird aggregate), but Call 2
    // rejects it as a category mismatch — server should treat as unmatched.
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'ức gà',
          ingredients: [
            {
              ingredientName: 'ức gà',
              selectedCandidateId: 'none',
              rejectReason: 'ức gà ≠ Thịt gà ta whole-bird aggregate',
              grossG: 150,
              refusePct: 0,
              caloriesKcal: { low: 160, mid: 180, high: 200 },
              proteinG: { low: 30, mid: 33, high: 35 },
              carbohydrateG: { low: 0, mid: 0, high: 0 },
              fatG: { low: 3, mid: 4, high: 5 },
            },
          ],
        },
      ],
    };
    const gemini = geminiReturning(call1, call2);
    const db = createSourceAwareMockDb({
      fao_vector: [
        {
          id: 'fc-thitga',
          name_primary: 'Thịt gà ta',
          name_alt: null,
          name_en: 'Chicken meat, average',
          state: 'cooked',
          similarity: 0.81,
        },
      ],
      nutrition: [
        {
          id: 'fc-thitga',
          calories_kcal: 199,
          protein_g: 20.3,
          carbohydrate_g: 0,
          fat_g: 13.1,
          inedible_portion_pct: 52,
        },
      ],
    });

    const result = await analyzeMealV2('150g ức gà', userContext, db, gemini);
    expect(result.success).toBe(true);
    if (result.success) {
      const ing = result.data.mealItems[0].ingredients[0];
      // Unmatched path: protein from LLM (mid=33), not from DB row anchoring.
      expect(ing.boundedNutrition.proteinG?.mid).toBeCloseTo(33, 1);
      expect(ing.boundedNutrition.fatG?.mid).toBeCloseTo(4, 1);
      // Calories derived: 4×33 + 9×4 = 168.
      expect(ing.boundedNutrition.caloriesKcal?.mid).toBeCloseTo(168, 1);
      expect(result.data.unmatchedIngredients).toHaveLength(1);
      expect(result.data.unmatchedIngredients[0].mealContext).toMatch(
        /rejected:/
      );
    }
  });
});

describe('analyzeMealV2 — no candidates → unmatched, LLM macros flow through', () => {
  it('produces a result without a Matched anchor when matching returns empty', async () => {
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'snack',
      mealItems: [
        {
          name: 'nem lụi',
          cookingMethod: 'nướng',
          ingredients: [{ rawName: 'nem lụi', canonicalName: 'Nem lụi' }],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'nem lụi',
          ingredients: [
            {
              ingredientName: 'nem lụi',
              grossG: 200,
              refusePct: 0,
              caloriesKcal: { low: 480, mid: 540, high: 600 },
              proteinG: { low: 28, mid: 32, high: 36 },
              carbohydrateG: { low: 4, mid: 5, high: 6 },
              fatG: { low: 28, mid: 34, high: 40 },
            },
          ],
        },
      ],
    };
    const gemini = geminiReturning(call1, call2);
    // Empty matching results for all sources / fuzzy.
    const db = createSourceAwareMockDb({});

    const result = await analyzeMealV2(
      '8 cây nem lụi',
      userContext,
      db,
      gemini
    );
    expect(result.success).toBe(true);
    if (result.success) {
      const ing = result.data.mealItems[0].ingredients[0];
      expect(ing.boundedNutrition.fatG?.mid).toBeCloseTo(34, 1);
      expect(ing.boundedNutrition.proteinG?.mid).toBeCloseTo(32, 1);
      expect(result.data.unmatchedIngredients).toHaveLength(1);
    }
  });
});

describe('analyzeMealV2 — vessel result surface', () => {
  it.each([
    { enabled: false, env: 'false' },
    { enabled: true, env: 'true' },
  ])('attaches vessel metadata only when flag enabled=$enabled', async ({
    enabled,
    env,
  }) => {
    vi.stubEnv('PORTION_VESSEL_ENABLED', env);
    const call1: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'phở bò',
          cookingMethod: 'ninh',
          vesselToken: 'tô',
          ingredients: [{ rawName: 'phở bò', canonicalName: 'Phở bò' }],
        },
      ],
    };
    const call2: GroundedEstimation = {
      mealItems: [
        {
          mealItemName: 'phở bò',
          ingredients: [
            {
              ingredientName: 'phở bò',
              grossG: 500,
              refusePct: 0,
              caloriesKcal: { low: 400, mid: 450, high: 500 },
              proteinG: { low: 20, mid: 25, high: 30 },
              carbohydrateG: { low: 50, mid: 55, high: 60 },
              fatG: { low: 10, mid: 12, high: 14 },
            },
          ],
        },
      ],
    };

    const result = await analyzeMealV2(
      '1 tô phở bò',
      userContext,
      createSourceAwareMockDb({}),
      geminiReturning(call1, call2)
    );

    expect(result.success).toBe(true);
    if (result.success) {
      if (enabled) {
        expect(result.data.mealItems[0].vessel).toMatchObject({
          family: 'bowl',
          tier: 2,
          dishClass: 'soup',
          provenance: 'vessel_prior',
        });
      } else {
        expect(result.data.mealItems[0]).not.toHaveProperty('vessel');
      }
    }
  });
});

describe('analyzeMealV2 — non-food fast path', () => {
  it('returns non-food response when Call 1 says isFood=false', async () => {
    const call1: MealDecompositionV2 = {
      isFood: false,
      mealSlot: null,
      mealItems: [],
    };
    const call2: GroundedEstimation = { mealItems: [] };
    const gemini = geminiReturning(call1, call2);
    const db = createSourceAwareMockDb({});

    const result = await analyzeMealV2(
      'hello, this is not food',
      userContext,
      db,
      gemini
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.type).toBe('non_food_input');
    }
  });
});
