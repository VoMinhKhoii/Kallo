import { describe, expect, it } from 'vitest';
import type {
  MatchedIngredient,
  NutritionAdjustment,
  PipelineResult,
  UnmatchedIngredient,
} from '../types';
import {
  detectAnomalies,
  THRESHOLDS,
  validateNutritionOutput,
} from '../validation';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatched(
  overrides: Partial<MatchedIngredient> & { ingredientName: string }
): MatchedIngredient {
  return {
    foodCompositionId: 'fc-1',
    matchedName: overrides.ingredientName,
    similarity: 0.9,
    confidence: 'high',
    nutritionPer100g: {
      caloriesKcal: 200,
      proteinG: 10,
      carbohydrateG: 30,
      fatG: 5,
      fiberG: null,
      sugarG: null,
      sodiumMg: null,
      potassiumMg: null,
      calciumMg: null,
      ironMg: null,
      zincMg: null,
      phosphorusMg: null,
      magnesiumMg: null,
      manganeseMg: null,
      copperMg: null,
      seleniumMcg: null,
      vitaminAMcg: null,
      vitaminB1Mg: null,
      vitaminB2Mg: null,
      vitaminB3Mg: null,
      vitaminB6Mg: null,
      vitaminB9Mcg: null,
      vitaminB12Mcg: null,
      vitaminCMg: null,
      vitaminDMcg: null,
      cholesterolMg: null,
      saturatedFatG: null,
      waterG: null,
    },
    ...overrides,
  };
}

function makeNutrition(
  items: {
    name: string;
    ingredients: {
      name: string;
      midKcal: number;
      lowKcal?: number;
      highKcal?: number;
    }[];
  }[]
): NutritionAdjustment {
  return {
    mealItems: items.map((item) => ({
      mealItemName: item.name,
      ingredients: item.ingredients.map((ing) => ({
        ingredientName: ing.name,
        caloriesKcal: {
          low: ing.lowKcal ?? ing.midKcal * 0.8,
          mid: ing.midKcal,
          high: ing.highKcal ?? ing.midKcal * 1.2,
        },
        proteinG: { low: 5, mid: 10, high: 15 },
        carbohydrateG: { low: 20, mid: 30, high: 40 },
        fatG: { low: 2, mid: 5, high: 8 },
      })),
    })),
  };
}

function makePipelineResult(
  overrides: Partial<PipelineResult> = {}
): PipelineResult {
  return {
    mealItems: [
      {
        name: 'Cơm trắng',
        ingredients: [
          {
            ingredientName: 'Gạo tẻ',
            foodCompositionId: 'fc-1',
            estimatedGrams: 200,
            rawEquivalentGrams: 200,
            cookingMethod: null,
            userFacingUnit: null,
            matchConfidence: 0.9,
            boundedNutrition: {
              caloriesKcal: { low: 240, mid: 300, high: 360 },
              proteinG: { low: 4, mid: 6, high: 8 },
              carbohydrateG: { low: 50, mid: 65, high: 80 },
              fatG: { low: 0.5, mid: 1, high: 1.5 },
              fiberG: null,
              sugarG: null,
              sodiumMg: null,
              potassiumMg: null,
              calciumMg: null,
              ironMg: null,
              zincMg: null,
              phosphorusMg: null,
              magnesiumMg: null,
              manganeseMg: null,
              copperMg: null,
              seleniumMcg: null,
              vitaminAMcg: null,
              vitaminB1Mg: null,
              vitaminB2Mg: null,
              vitaminB3Mg: null,
              vitaminB6Mg: null,
              vitaminB9Mcg: null,
              vitaminB12Mcg: null,
              vitaminCMg: null,
              vitaminDMcg: null,
              cholesterolMg: null,
              saturatedFatG: null,
              waterG: null,
            },
            displayedNutrition: {
              caloriesKcal: 300,
              proteinG: 6,
              carbohydrateG: 65,
              fatG: 1,
              fiberG: null,
              sugarG: null,
              sodiumMg: null,
              potassiumMg: null,
              calciumMg: null,
              ironMg: null,
              zincMg: null,
              phosphorusMg: null,
              magnesiumMg: null,
              manganeseMg: null,
              copperMg: null,
              seleniumMcg: null,
              vitaminAMcg: null,
              vitaminB1Mg: null,
              vitaminB2Mg: null,
              vitaminB3Mg: null,
              vitaminB6Mg: null,
              vitaminB9Mcg: null,
              vitaminB12Mcg: null,
              vitaminCMg: null,
              vitaminDMcg: null,
              cholesterolMg: null,
              saturatedFatG: null,
              waterG: null,
            },
          },
        ],
        boundedNutrition: {
          caloriesKcal: { low: 240, mid: 300, high: 360 },
          proteinG: { low: 4, mid: 6, high: 8 },
          carbohydrateG: { low: 50, mid: 65, high: 80 },
          fatG: { low: 0.5, mid: 1, high: 1.5 },
          fiberG: null,
          sugarG: null,
          sodiumMg: null,
          potassiumMg: null,
          calciumMg: null,
          ironMg: null,
          zincMg: null,
          phosphorusMg: null,
          magnesiumMg: null,
          manganeseMg: null,
          copperMg: null,
          seleniumMcg: null,
          vitaminAMcg: null,
          vitaminB1Mg: null,
          vitaminB2Mg: null,
          vitaminB3Mg: null,
          vitaminB6Mg: null,
          vitaminB9Mcg: null,
          vitaminB12Mcg: null,
          vitaminCMg: null,
          vitaminDMcg: null,
          cholesterolMg: null,
          saturatedFatG: null,
          waterG: null,
        },
        displayedNutrition: {
          caloriesKcal: 300,
          proteinG: 6,
          carbohydrateG: 65,
          fatG: 1,
          fiberG: null,
          sugarG: null,
          sodiumMg: null,
          potassiumMg: null,
          calciumMg: null,
          ironMg: null,
          zincMg: null,
          phosphorusMg: null,
          magnesiumMg: null,
          manganeseMg: null,
          copperMg: null,
          seleniumMcg: null,
          vitaminAMcg: null,
          vitaminB1Mg: null,
          vitaminB2Mg: null,
          vitaminB3Mg: null,
          vitaminB6Mg: null,
          vitaminB9Mcg: null,
          vitaminB12Mcg: null,
          vitaminCMg: null,
          vitaminDMcg: null,
          cholesterolMg: null,
          saturatedFatG: null,
          waterG: null,
        },
      },
    ],
    mealSlot: 'lunch',
    confidenceOverall: 'high',
    boundedNutrition: {
      caloriesKcal: { low: 240, mid: 300, high: 360 },
      proteinG: { low: 4, mid: 6, high: 8 },
      carbohydrateG: { low: 50, mid: 65, high: 80 },
      fatG: { low: 0.5, mid: 1, high: 1.5 },
      fiberG: null,
      sugarG: null,
      sodiumMg: null,
      potassiumMg: null,
      calciumMg: null,
      ironMg: null,
      zincMg: null,
      phosphorusMg: null,
      magnesiumMg: null,
      manganeseMg: null,
      copperMg: null,
      seleniumMcg: null,
      vitaminAMcg: null,
      vitaminB1Mg: null,
      vitaminB2Mg: null,
      vitaminB3Mg: null,
      vitaminB6Mg: null,
      vitaminB9Mcg: null,
      vitaminB12Mcg: null,
      vitaminCMg: null,
      vitaminDMcg: null,
      cholesterolMg: null,
      saturatedFatG: null,
      waterG: null,
    },
    displayedNutrition: {
      caloriesKcal: 300,
      proteinG: 6,
      carbohydrateG: 65,
      fatG: 1,
      fiberG: null,
      sugarG: null,
      sodiumMg: null,
      potassiumMg: null,
      calciumMg: null,
      ironMg: null,
      zincMg: null,
      phosphorusMg: null,
      magnesiumMg: null,
      manganeseMg: null,
      copperMg: null,
      seleniumMcg: null,
      vitaminAMcg: null,
      vitaminB1Mg: null,
      vitaminB2Mg: null,
      vitaminB3Mg: null,
      vitaminB6Mg: null,
      vitaminB9Mcg: null,
      vitaminB12Mcg: null,
      vitaminCMg: null,
      vitaminDMcg: null,
      cholesterolMg: null,
      saturatedFatG: null,
      waterG: null,
    },
    unmatchedIngredients: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateNutritionOutput
// ---------------------------------------------------------------------------

describe('validateNutritionOutput', () => {
  it('returns empty array for plausible nutrition', () => {
    const nutrition = makeNutrition([
      { name: 'Cơm', ingredients: [{ name: 'Gạo tẻ', midKcal: 300 }] },
    ]);
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    expect(validateNutritionOutput(nutrition, matched)).toEqual([]);
  });

  it('flags calorie density when DB kcal/100g exceeds threshold', () => {
    const matched = [
      makeMatched({
        ingredientName: 'Dầu ăn',
        nutritionPer100g: {
          caloriesKcal: 950, // > 900
          proteinG: 0,
          carbohydrateG: 0,
          fatG: 100,
          fiberG: null,
          sugarG: null,
          sodiumMg: null,
          potassiumMg: null,
          calciumMg: null,
          ironMg: null,
          zincMg: null,
          phosphorusMg: null,
          magnesiumMg: null,
          manganeseMg: null,
          copperMg: null,
          seleniumMcg: null,
          vitaminAMcg: null,
          vitaminB1Mg: null,
          vitaminB2Mg: null,
          vitaminB3Mg: null,
          vitaminB6Mg: null,
          vitaminB9Mcg: null,
          vitaminB12Mcg: null,
          vitaminCMg: null,
          vitaminDMcg: null,
          cholesterolMg: null,
          saturatedFatG: null,
          waterG: null,
        },
      }),
    ];
    const nutrition = makeNutrition([
      { name: 'Xào', ingredients: [{ name: 'Dầu ăn', midKcal: 90 }] },
    ]);
    const anomalies = validateNutritionOutput(nutrition, matched);
    expect(anomalies.some((a) => a.type === 'calorie_density')).toBe(true);
  });

  it('flags meal item exceeding calorie cap', () => {
    const nutrition = makeNutrition([
      {
        name: 'Bữa lớn',
        ingredients: [
          { name: 'Gạo tẻ', midKcal: 800 },
          { name: 'Thịt', midKcal: 800 },
        ],
      },
    ]);
    const anomalies = validateNutritionOutput(nutrition, []);
    expect(anomalies.some((a) => a.type === 'meal_item_cap')).toBe(true);
    expect(
      anomalies.find((a) => a.type === 'meal_item_cap')?.message
    ).toContain('1600');
  });

  it('flags wide bounds suggesting high uncertainty', () => {
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    const nutrition = makeNutrition([
      {
        name: 'Cơm',
        ingredients: [
          { name: 'Gạo tẻ', midKcal: 300, lowKcal: 50, highKcal: 600 },
        ],
      },
    ]);
    const anomalies = validateNutritionOutput(nutrition, matched);
    expect(anomalies.some((a) => a.type === 'db_deviation')).toBe(true);
  });

  it('does not flag normal bounds', () => {
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    const nutrition = makeNutrition([
      {
        name: 'Cơm',
        ingredients: [
          { name: 'Gạo tẻ', midKcal: 300, lowKcal: 270, highKcal: 330 },
        ],
      },
    ]);
    const anomalies = validateNutritionOutput(nutrition, matched);
    expect(anomalies.some((a) => a.type === 'db_deviation')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// detectAnomalies
// ---------------------------------------------------------------------------

describe('detectAnomalies', () => {
  it('returns empty array for normal result', () => {
    const result = makePipelineResult();
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    expect(detectAnomalies(result, matched, [])).toEqual([]);
  });

  it('flags suspiciously low total calories', () => {
    const result = makePipelineResult({
      boundedNutrition: {
        ...makePipelineResult().boundedNutrition,
        caloriesKcal: { low: 10, mid: 30, high: 45 },
      },
    });
    const anomalies = detectAnomalies(result, [], []);
    expect(anomalies.some((a) => a.type === 'total_calories')).toBe(true);
    expect(anomalies[0].message).toContain('30');
  });

  it('flags suspiciously high total calories', () => {
    const result = makePipelineResult({
      boundedNutrition: {
        ...makePipelineResult().boundedNutrition,
        caloriesKcal: { low: 2800, mid: 3500, high: 4000 },
      },
    });
    const anomalies = detectAnomalies(result, [], []);
    expect(anomalies.some((a) => a.type === 'total_calories')).toBe(true);
    expect(anomalies[0].message).toContain('3500');
  });

  it('flags implausible ingredient weight', () => {
    const result = makePipelineResult();
    result.mealItems[0].ingredients[0].estimatedGrams = 600;
    const anomalies = detectAnomalies(result, [], []);
    expect(anomalies.some((a) => a.type === 'weight_implausible')).toBe(true);
    expect(anomalies[0].message).toContain('600g');
  });

  it('flags high unmatched ratio', () => {
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    const unmatched: UnmatchedIngredient[] = [
      { ingredientName: 'Tôm', mealContext: 'Canh' },
      { ingredientName: 'Rau', mealContext: 'Canh' },
      { ingredientName: 'Gia vị', mealContext: 'Canh' },
    ];
    const result = makePipelineResult();
    const anomalies = detectAnomalies(result, matched, unmatched);
    expect(anomalies.some((a) => a.type === 'unmatched_ratio')).toBe(true);
    expect(anomalies[0].message).toContain('3/4');
  });

  it('does not flag when unmatched ratio is acceptable', () => {
    const matched = [
      makeMatched({ ingredientName: 'Gạo tẻ' }),
      makeMatched({ ingredientName: 'Thịt' }),
    ];
    const unmatched: UnmatchedIngredient[] = [
      { ingredientName: 'Gia vị', mealContext: 'Cơm' },
    ];
    const result = makePipelineResult();
    const anomalies = detectAnomalies(result, matched, unmatched);
    expect(anomalies.some((a) => a.type === 'unmatched_ratio')).toBe(false);
  });

  it('does not flag zero calories (empty input)', () => {
    const result = makePipelineResult({
      boundedNutrition: {
        ...makePipelineResult().boundedNutrition,
        caloriesKcal: { low: 0, mid: 0, high: 0 },
      },
    });
    expect(detectAnomalies(result, [], [])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Threshold sanity checks
// ---------------------------------------------------------------------------

describe('THRESHOLDS', () => {
  it('exports all expected thresholds', () => {
    expect(THRESHOLDS.MAX_KCAL_PER_100G).toBe(900);
    expect(THRESHOLDS.MAX_MEAL_ITEM_KCAL).toBe(1500);
    expect(THRESHOLDS.MIN_TOTAL_KCAL).toBe(50);
    expect(THRESHOLDS.MAX_TOTAL_KCAL).toBe(3000);
    expect(THRESHOLDS.MAX_INGREDIENT_GRAMS).toBe(500);
    expect(THRESHOLDS.UNMATCHED_RATIO).toBe(0.5);
    expect(THRESHOLDS.DB_DEVIATION_RATIO).toBe(0.5);
  });
});
