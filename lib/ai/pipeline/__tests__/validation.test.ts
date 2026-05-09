import { describe, expect, it } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__tests__/test-helpers';
import {
  detectAnomalies,
  THRESHOLDS,
  validateDecompositionOutput,
  validateNutritionOutput,
} from '@/lib/ai/pipeline/validation';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  NutritionAdjustment,
  PipelineResult,
  UnmatchedIngredient,
} from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMatched(
  overrides: Partial<MatchedIngredient> & { ingredientName: string }
): MatchedIngredient {
  return {
    ingredientId: `id-${overrides.ingredientName}`,
    foodCompositionId: 'fc-1',
    matchedName: overrides.ingredientName,
    similarity: 0.9,
    confidence: 'high',
    nutritionPer100g: {
      ...NULL_NUTRITION_VALUES,
      caloriesKcal: 200,
      proteinG: 10,
      carbohydrateG: 30,
      fatG: 5,
    },
    dbState: 'raw',
    ...overrides,
  };
}

function makeDecomposition(
  items: {
    name: string;
    ingredients: { name: string; grams: number; cooking?: string }[];
  }[]
): DecomposedMealItem[] {
  return items.map((mi) => ({
    name: mi.name,
    ingredients: mi.ingredients.map((ing) => ({
      ingredientId: `id-${ing.name}`,
      name: ing.name,
      estimatedGrams: ing.grams,
      cookingMethod: ing.cooking ?? null,
      userFacingUnit: null,
    })),
  }));
}

function makeNutrition(
  items: {
    name: string;
    ingredients: {
      name: string;
      midKcal: number;
      lowKcal?: number;
      highKcal?: number;
      proteinG?: { low: number; mid: number; high: number };
      carbohydrateG?: { low: number; mid: number; high: number };
      fatG?: { low: number; mid: number; high: number };
    }[];
  }[]
): NutritionAdjustment {
  return {
    mealItems: items.map((item) => ({
      mealItemName: item.name,
      ingredients: item.ingredients.map((ing) => {
        const caloriesKcal = {
          low: ing.lowKcal ?? ing.midKcal * 0.8,
          mid: ing.midKcal,
          high: ing.highKcal ?? ing.midKcal * 1.2,
        };
        return {
          ingredientId: `id-${ing.name}`,
          ingredientName: ing.name,
          caloriesKcal,
          proteinG: ing.proteinG ?? { low: 0, mid: 0, high: 0 },
          carbohydrateG: ing.carbohydrateG ?? {
            low: caloriesKcal.low / 4,
            mid: caloriesKcal.mid / 4,
            high: caloriesKcal.high / 4,
          },
          fatG: ing.fatG ?? { low: 0, mid: 0, high: 0 },
        };
      }),
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
              ...NULL_BOUNDED_NUTRITION,
              caloriesKcal: { low: 240, mid: 300, high: 360 },
              proteinG: { low: 4, mid: 6, high: 8 },
              carbohydrateG: { low: 50, mid: 65, high: 80 },
              fatG: { low: 0.5, mid: 1, high: 1.5 },
            },
            displayedNutrition: {
              ...NULL_NUTRITION_VALUES,
              caloriesKcal: 300,
              proteinG: 6,
              carbohydrateG: 65,
              fatG: 1,
            },
          },
        ],
        boundedNutrition: {
          ...NULL_BOUNDED_NUTRITION,
          caloriesKcal: { low: 240, mid: 300, high: 360 },
          proteinG: { low: 4, mid: 6, high: 8 },
          carbohydrateG: { low: 50, mid: 65, high: 80 },
          fatG: { low: 0.5, mid: 1, high: 1.5 },
        },
        displayedNutrition: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 300,
          proteinG: 6,
          carbohydrateG: 65,
          fatG: 1,
        },
      },
    ],
    mealSlot: 'lunch',
    confidenceOverall: 'high',
    boundedNutrition: {
      ...NULL_BOUNDED_NUTRITION,
      caloriesKcal: { low: 240, mid: 300, high: 360 },
      proteinG: { low: 4, mid: 6, high: 8 },
      carbohydrateG: { low: 50, mid: 65, high: 80 },
      fatG: { low: 0.5, mid: 1, high: 1.5 },
    },
    displayedNutrition: {
      ...NULL_NUTRITION_VALUES,
      caloriesKcal: 300,
      proteinG: 6,
      carbohydrateG: 65,
      fatG: 1,
    },
    unmatchedIngredients: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateDecompositionOutput
// ---------------------------------------------------------------------------

describe('validateDecompositionOutput', () => {
  const base = {
    mealItemId: 'meal-1',
    name: 'Cơm cá',
    cookingMethod: 'kho',
    ingredients: [
      {
        ingredientId: 'ing-1',
        rawName: 'cá lóc',
        canonicalName: 'Cá quả',
        grams: 100,
      },
    ],
  };

  it('flags zero grams as implausible_grams', () => {
    const anomalies = validateDecompositionOutput([
      {
        ...base,
        ingredients: [{ ...base.ingredients[0], grams: 0 }],
      },
    ]);

    expect(anomalies).toMatchObject([
      {
        type: 'implausible_grams',
        severity: 'warning',
        ingredientId: 'ing-1',
        mealItemId: 'meal-1',
      },
    ]);
  });

  it('flags negative grams as implausible_grams', () => {
    const anomalies = validateDecompositionOutput([
      {
        ...base,
        ingredients: [{ ...base.ingredients[0], grams: -5 }],
      },
    ]);

    expect(anomalies.some((a) => a.type === 'implausible_grams')).toBe(true);
  });

  it('does not flag positive grams of any size', () => {
    expect(
      validateDecompositionOutput([
        {
          ...base,
          ingredients: [{ ...base.ingredients[0], grams: 600 }],
        },
      ])
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateNutritionOutput
// ---------------------------------------------------------------------------

describe('validateNutritionOutput', () => {
  it('returns empty array for plausible nutrition', () => {
    const nutrition = makeNutrition([
      { name: 'Cơm', ingredients: [{ name: 'Gạo tẻ', midKcal: 300 }] },
    ]);
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    const decomp = makeDecomposition([
      { name: 'Cơm', ingredients: [{ name: 'Gạo tẻ', grams: 200 }] },
    ]);
    expect(validateNutritionOutput(nutrition, matched, decomp)).toEqual([]);
  });

  it('flags calorie density when DB kcal/100g exceeds threshold', () => {
    const matched = [
      makeMatched({
        ingredientName: 'Dầu ăn',
        nutritionPer100g: {
          ...NULL_NUTRITION_VALUES,
          caloriesKcal: 950, // > 900
          proteinG: 0,
          carbohydrateG: 0,
          fatG: 100,
        },
      }),
    ];
    const nutrition = makeNutrition([
      { name: 'Xào', ingredients: [{ name: 'Dầu ăn', midKcal: 90 }] },
    ]);
    const decomp = makeDecomposition([
      { name: 'Xào', ingredients: [{ name: 'Dầu ăn', grams: 10 }] },
    ]);
    const anomalies = validateNutritionOutput(nutrition, matched, decomp);
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
    const decomp = makeDecomposition([
      {
        name: 'Bữa lớn',
        ingredients: [
          { name: 'Gạo tẻ', grams: 300 },
          { name: 'Thịt', grams: 300 },
        ],
      },
    ]);
    const anomalies = validateNutritionOutput(nutrition, [], decomp);
    expect(anomalies.some((a) => a.type === 'meal_item_cap')).toBe(true);
    expect(
      anomalies.find((a) => a.type === 'meal_item_cap')?.message
    ).toContain('1600');
  });

  it('flags DB-anchor deviation when LLM mid diverges from DB-scaled value', () => {
    // DB: 200 kcal/100g, 150g raw → DB-scaled = 300 kcal
    // LLM says mid = 500 kcal → 67% deviation > 50% threshold
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    const nutrition = makeNutrition([
      {
        name: 'Cơm',
        ingredients: [{ name: 'Gạo tẻ', midKcal: 500 }],
      },
    ]);
    const decomp = makeDecomposition([
      { name: 'Cơm', ingredients: [{ name: 'Gạo tẻ', grams: 150 }] },
    ]);
    const anomalies = validateNutritionOutput(nutrition, matched, decomp);
    expect(anomalies.some((a) => a.type === 'db_deviation')).toBe(true);
    expect(anomalies.find((a) => a.type === 'db_deviation')?.message).toContain(
      '67%'
    );
  });

  it('does not flag DB-anchor deviation within threshold', () => {
    // DB: 200 kcal/100g, 150g raw → DB-scaled = 300 kcal
    // LLM says mid = 330 kcal → 10% deviation < 50% threshold
    const matched = [makeMatched({ ingredientName: 'Gạo tẻ' })];
    const nutrition = makeNutrition([
      {
        name: 'Cơm',
        ingredients: [{ name: 'Gạo tẻ', midKcal: 330 }],
      },
    ]);
    const decomp = makeDecomposition([
      { name: 'Cơm', ingredients: [{ name: 'Gạo tẻ', grams: 150 }] },
    ]);
    const anomalies = validateNutritionOutput(nutrition, matched, decomp);
    expect(anomalies.some((a) => a.type === 'db_deviation')).toBe(false);
  });

  describe('density envelope (§1.4)', () => {
    // density_envelope is triggered by per-100g protein/carb/fat density,
    // not by caloriesKcal. With highKcal=1100 and grams=100, makeNutrition
    // defaults carbohydrateG.high = 1100/4 = 275 → 275 g/100g, which
    // exceeds DENSITY_CARB_PER_100G_MAX (100). Naming the test after the
    // input we set (kcal) hid which guard was actually firing.
    it('fires when default-derived carbohydrateG density exceeds 100g/100g', () => {
      const anomalies = validateNutritionOutput(
        makeNutrition([
          {
            name: 'M',
            ingredients: [
              {
                name: 'cá hồi',
                midKcal: 950,
                lowKcal: 800,
                highKcal: 1100,
              },
            ],
          },
        ]),
        [makeMatched({ ingredientName: 'cá hồi' })],
        makeDecomposition([
          { name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] },
        ])
      );

      expect(
        anomalies.find((a) => a.type === 'density_envelope')
      ).toBeDefined();
    });

    it('flags negative low bound', () => {
      const anomalies = validateNutritionOutput(
        makeNutrition([
          {
            name: 'M',
            ingredients: [
              {
                name: 'cá hồi',
                midKcal: 100,
                proteinG: { low: -1, mid: 5, high: 10 },
              },
            ],
          },
        ]),
        [makeMatched({ ingredientName: 'cá hồi' })],
        makeDecomposition([
          { name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] },
        ])
      );

      expect(
        anomalies.find((a) => a.type === 'density_envelope')
      ).toBeDefined();
    });

    it('fires for unmatched ingredients too via default-derived carb density', () => {
      const anomalies = validateNutritionOutput(
        makeNutrition([
          {
            name: 'M',
            ingredients: [
              {
                name: 'mystery sauce',
                midKcal: 950,
                lowKcal: 800,
                highKcal: 1100,
              },
            ],
          },
        ]),
        [],
        makeDecomposition([
          {
            name: 'M',
            ingredients: [{ name: 'mystery sauce', grams: 100 }],
          },
        ])
      );

      expect(
        anomalies.find((a) => a.type === 'density_envelope')
      ).toBeDefined();
    });

    it('does not flag legal densities', () => {
      const anomalies = validateNutritionOutput(
        makeNutrition([
          {
            name: 'M',
            ingredients: [
              { name: 'cá hồi', midKcal: 130, lowKcal: 100, highKcal: 160 },
            ],
          },
        ]),
        [makeMatched({ ingredientName: 'cá hồi' })],
        makeDecomposition([
          { name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] },
        ])
      );

      expect(
        anomalies.find((a) => a.type === 'density_envelope')
      ).toBeUndefined();
    });
  });

  describe('macro consistency invariant (§1.3)', () => {
    it('flags >20% deviation between caloriesKcal.mid and 4P+4C+9F', () => {
      const anomalies = validateNutritionOutput(
        makeNutrition([
          {
            name: 'M',
            ingredients: [
              {
                name: 'cá hồi',
                midKcal: 400,
                lowKcal: 350,
                highKcal: 450,
                proteinG: { low: 4, mid: 5, high: 6 },
                carbohydrateG: { low: 28, mid: 30, high: 32 },
                fatG: { low: 9, mid: 10, high: 11 },
              },
            ],
          },
        ]),
        [makeMatched({ ingredientName: 'cá hồi' })],
        makeDecomposition([
          { name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] },
        ])
      );

      expect(
        anomalies.find((a) => a.type === 'macro_inconsistent')
      ).toBeDefined();
    });

    it('accepts within 20% (fiber/alcohol/rounding)', () => {
      const anomalies = validateNutritionOutput(
        makeNutrition([
          {
            name: 'M',
            ingredients: [
              {
                name: 'cá hồi',
                midKcal: 260,
                lowKcal: 230,
                highKcal: 290,
                proteinG: { low: 4, mid: 5, high: 6 },
                carbohydrateG: { low: 28, mid: 30, high: 32 },
                fatG: { low: 9, mid: 10, high: 11 },
              },
            ],
          },
        ]),
        [makeMatched({ ingredientName: 'cá hồi' })],
        makeDecomposition([
          { name: 'M', ingredients: [{ name: 'cá hồi', grams: 100 }] },
        ])
      );

      expect(
        anomalies.find((a) => a.type === 'macro_inconsistent')
      ).toBeUndefined();
    });
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
    expect(anomalies[0].severity).toBe('warning');
  });

  it('flags 0-calorie result as error severity', () => {
    const result = makePipelineResult({
      boundedNutrition: {
        ...makePipelineResult().boundedNutrition,
        caloriesKcal: { low: 0, mid: 0, high: 0 },
      },
    });
    const anomalies = detectAnomalies(result, [], []);
    expect(anomalies.some((a) => a.type === 'total_calories')).toBe(true);
    expect(anomalies[0].severity).toBe('error');
    expect(anomalies[0].message).toContain('LLM failure');
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
    expect(THRESHOLDS.DENSITY_PROTEIN_PER_100G_MAX).toBe(100);
    expect(THRESHOLDS.DENSITY_CARB_PER_100G_MAX).toBe(100);
    expect(THRESHOLDS.DENSITY_FAT_PER_100G_MAX).toBe(100);
    expect(THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE).toBe(0.2);
  });
});

// ---------------------------------------------------------------------------
// id-keyed anomaly attribution (Task 1.11)
// ---------------------------------------------------------------------------

describe('validateNutritionOutput — id-keyed anomaly attribution', () => {
  it('attributes anomalies to the correct ingredient when two share a display name', () => {
    // Two dishes both contain an ingredient called 'nước dùng' with
    // distinct ingredientIds. Only ing-2's macros are implausibly high
    // (DB-deviation > 50%). Anomaly must reference ing-2, not ing-1.
    const decomposition: DecomposedMealItem[] = [
      {
        mealItemId: 'meal-A',
        name: 'phở bò',
        ingredients: [
          {
            ingredientId: 'ing-1',
            name: 'nước dùng',
            estimatedGrams: 300,
            cookingMethod: null,
            userFacingUnit: '1 tô',
          },
        ],
      },
      {
        mealItemId: 'meal-B',
        name: 'bún bò Huế',
        ingredients: [
          {
            ingredientId: 'ing-2',
            name: 'nước dùng',
            estimatedGrams: 280,
            cookingMethod: null,
            userFacingUnit: '1 tô',
          },
        ],
      },
    ];

    const matched: MatchedIngredient[] = [
      makeMatched({ ingredientId: 'ing-1', ingredientName: 'nước dùng' }),
      makeMatched({ ingredientId: 'ing-2', ingredientName: 'nước dùng' }),
    ];

    // ing-1: DB-scaled = (300/100) * 200 = 600 kcal, LLM mid = 600 → ~0% deviation
    // ing-2: DB-scaled = (280/100) * 200 = 560 kcal, LLM mid = 9500 → ~1596% deviation
    const nutrition: NutritionAdjustment = {
      mealItems: [
        {
          mealItemId: 'meal-A',
          mealItemName: 'phở bò',
          ingredients: [
            {
              ingredientId: 'ing-1',
              ingredientName: 'nước dùng',
              caloriesKcal: { low: 540, mid: 600, high: 660 },
              proteinG: { low: 5, mid: 10, high: 15 },
              carbohydrateG: { low: 20, mid: 30, high: 40 },
              fatG: { low: 2, mid: 5, high: 8 },
            },
          ],
        },
        {
          mealItemId: 'meal-B',
          mealItemName: 'bún bò Huế',
          ingredients: [
            {
              ingredientId: 'ing-2',
              ingredientName: 'nước dùng',
              caloriesKcal: { low: 9000, mid: 9500, high: 10000 },
              proteinG: { low: 5, mid: 10, high: 15 },
              carbohydrateG: { low: 20, mid: 30, high: 40 },
              fatG: { low: 2, mid: 5, high: 8 },
            },
          ],
        },
      ],
    };

    const anomalies = validateNutritionOutput(
      nutrition,
      matched,
      decomposition
    );
    const dbDeviationIds = anomalies
      .filter((a) => a.type === 'db_deviation')
      .map((a) => a.ingredientId);
    expect(dbDeviationIds).toContain('ing-2');
    expect(dbDeviationIds).not.toContain('ing-1');
  });
});
