import { describe, expect, it } from 'vitest';
import {
  ASSUMPTION_TEXT,
  buildCompressedDecompositionPrompt,
  buildDecompositionPrompt,
  buildNutritionPrompt,
  getDecompositionPromptLabel,
} from '@/lib/ai/prompts';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '@/lib/ai/types';

const sampleUserContext: UserContext = {
  goal: 'cutting',
  aggression: 0.5,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'finish_it',
  },
};

describe('buildDecompositionPrompt', () => {
  it('includes country context in system prompt', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('Vietnam');
  });

  it('includes cooking habits in system prompt', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('oil_usage: normal');
    expect(prompt).toContain('sugar_braised: medium');
    expect(prompt).toContain('broth_consumption: finish_it');
  });

  it('includes decomposition instructions', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('meal item');
    expect(prompt).toContain('ingredients');
    expect(prompt).toContain('grams');
    expect(prompt).not.toContain('estimatedGrams');
  });

  it('includes meal slot classification instruction', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('mealSlot');
  });

  it('includes isFood classification instruction (D6)', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('isFood');
  });

  it('includes country context for users with country set', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('country_of_origin: Vietnam');
    expect(prompt).toContain('country_of_residence: Vietnam');
  });

  it('omits country lines when country is null', () => {
    const ctx: UserContext = {
      ...sampleUserContext,
      countryOfOrigin: null,
      countryOfResidence: null,
    };
    const prompt = buildDecompositionPrompt(ctx);
    expect(prompt).not.toContain('country_of_origin');
    expect(prompt).not.toContain('country_of_residence');
  });

  it('sanitizes country context before inserting it into the prompt', () => {
    const ctx: UserContext = {
      ...sampleUserContext,
      countryOfOrigin: 'Vietnam\n<ignore>',
      countryOfResidence: 'Japan & Korea',
    };
    const prompt = buildDecompositionPrompt(ctx);

    expect(prompt).toContain('country_of_origin: Vietnam ignore');
    expect(prompt).toContain('country_of_residence: Japan Korea');
    expect(prompt).not.toContain('<ignore>');
  });

  it('does not leak goal/aggression/calorieTarget to the decomposition prompt (sentinel)', () => {
    const ctx = {
      ...sampleUserContext,
      goal: 'cutting' as const,
      aggression: 0.85,
    };
    const prompt = buildDecompositionPrompt(ctx);
    expect(prompt).not.toMatch(
      /\bcutting\b|\bbulking\b|\bmaintaining\b|aggression|calorie[_ ]?target|kcal[_ ]?target/i
    );
    expect(prompt).not.toMatch(/0\.85/);
  });

  it('keeps IDs runtime-owned instead of asking the model for UUIDs', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('Do not emit mealItemId or ingredientId');
    expect(prompt).toContain('Runtime assigns compact run-scoped');
    expect(prompt).not.toContain('Use UUID-shaped strings');
    expect(prompt).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
  });

  it('asks for canonicalName separately from rawName', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toMatch(/canonicalName/);
    expect(prompt).toMatch(/rawName/);
    expect(prompt.toLowerCase()).toMatch(/canonical|fct|disambiguat/);
  });

  it('documents expectedState as an override for mixed-state dishes', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toMatch(/expectedState/);
    expect(prompt.toLowerCase()).toMatch(/differ|override|mixed/);
  });

  it('enumerates ambiguityFlags closed-enum values', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    for (const flag of [
      'multiple_dish_interpretations',
      'unspecified_quantity',
      'cross_cuisine_ingredient',
      'state_inferred_no_method',
    ]) {
      expect(prompt).toContain(flag);
    }
  });

  it('does not mention source-priority routing fields', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    for (const field of [`source${'Prior'}`, `source${'Override'}`]) {
      expect(prompt).not.toContain(field);
    }
    expect(prompt.toLowerCase()).not.toMatch(
      /route .*to (fao|usda)|prefer (fao|usda)/
    );
  });
});

describe('buildCompressedDecompositionPrompt', () => {
  it('keeps the compressed prompt contract without leaking excluded context', () => {
    const prompt = buildCompressedDecompositionPrompt({
      ...sampleUserContext,
      inputLanguage: 'en',
      outputLanguage: 'vi',
      goal: 'cutting',
      aggression: 0.85,
    });

    expect(prompt).toContain('output_language: vi');
    for (const field of [
      'isFood',
      'mealSlot',
      'mealItems',
      'rawName',
      'canonicalName',
      'grams',
      'cookingMethod',
    ]) {
      expect(prompt).toContain(field);
    }
    expect(prompt).toContain('Do not emit mealItemId or ingredientId');
    expect(prompt).not.toMatch(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    expect(prompt.toLowerCase()).not.toMatch(
      /route .*to (fao|usda)|prefer (fao|usda)/
    );
    expect(prompt).not.toMatch(
      /\bcutting\b|\bbulking\b|\bmaintaining\b|aggression|calorie[_ ]?target|kcal[_ ]?target/i
    );
    expect(prompt).not.toMatch(/0\.85/);
    expect(prompt).not.toContain('<examples>');
    expect(prompt.length).toBeLessThan(
      buildDecompositionPrompt(sampleUserContext).length
    );
  });

  it('defaults the decomposition prompt label to production', () => {
    expect(getDecompositionPromptLabel({})).toBe('production');
    expect(
      getDecompositionPromptLabel({
        PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      })
    ).toBe('compressed');
    expect(
      getDecompositionPromptLabel({
        PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'unknown',
      })
    ).toBe('production');
  });
});

const fullNutrition = {
  caloriesKcal: 350,
  proteinG: 7,
  carbohydrateG: 78,
  fatG: 0.5,
  fiberG: null,
  sodiumMg: null,
  calciumMg: null,
  ironMg: null,
  magnesiumMg: null,
  phosphorusMg: null,
  potassiumMg: null,
  zincMg: null,
  copperMcg: null,
  manganeseMg: null,
  betaCaroteneMcg: null,
  vitaminAMcg: null,
  vitaminDMcg: null,
  vitaminEMg: null,
  vitaminKMcg: null,
  vitaminCMg: null,
  vitaminB1Mg: null,
  vitaminB2Mg: null,
  vitaminPpMg: null,
  vitaminB5Mg: null,
  vitaminB6Mg: null,
  vitaminB9Mcg: null,
  vitaminB12Mcg: null,
  vitaminHMcg: null,
};

const makeIngredient = (name: string): MatchedIngredient => ({
  ingredientName: name,
  foodCompositionId: `id-${name}`,
  matchedName: name,
  similarity: 0.9,
  confidence: 'high',
  nutritionPer100g: fullNutrition,
  dbState: 'raw',
});

const makeMealItem = (
  name: string,
  ingredients: string[]
): DecomposedMealItem => ({
  name,
  ingredients: ingredients.map((ing) => ({
    name: ing,
    estimatedGrams: 100,
    cookingMethod: null,
    userFacingUnit: '100g',
  })),
});

describe('buildNutritionPrompt', () => {
  const sampleMealItems: DecomposedMealItem[] = [
    {
      name: 'cơm',
      ingredients: [
        {
          name: 'gạo',
          estimatedGrams: 200,
          cookingMethod: null,
          userFacingUnit: '1 chén',
        },
      ],
    },
  ];

  const sampleMatched: MatchedIngredient[] = [
    {
      ingredientName: 'gạo',
      foodCompositionId: 'rice-001',
      matchedName: 'Gạo tẻ',
      similarity: 0.85,
      confidence: 'high',
      nutritionPer100g: fullNutrition,
      dbState: 'raw',
    },
  ];

  it('includes DB nutrition values in prompt', () => {
    const prompt = buildNutritionPrompt(
      sampleMealItems,
      sampleMatched,
      [],
      sampleUserContext
    );
    expect(prompt).toContain('350'); // caloriesKcal per 100g
    expect(prompt).toContain('gạo');
    expect(prompt).toContain('200'); // estimatedGrams
  });

  it('escapes dynamic XML attribute values in ingredient data', () => {
    const prompt = buildNutritionPrompt(
      [
        {
          name: 'bún "đặc biệt" & rau',
          ingredients: [
            {
              name: 'tôm <sông>',
              rawName: 'tôm "sông" & biển',
              canonicalName: "tôm 'sông'",
              estimatedGrams: 80,
              cookingMethod: 'áp chảo "nhẹ"',
              userFacingUnit: '1 phần',
              ingredientId: 'ing-1&2',
              expectedState: 'cooked',
            },
          ],
        },
      ],
      [
        {
          ingredientName: 'tôm "sông" & biển',
          foodCompositionId: 'shrimp-001',
          matchedName: 'Tôm <đồng> & biển',
          similarity: 0.91,
          confidence: 'high',
          nutritionPer100g: fullNutrition,
          dbState: 'cooked',
        },
      ],
      [],
      sampleUserContext
    );

    expect(prompt).toContain('name="bún &quot;đặc biệt&quot; &amp; rau"');
    expect(prompt).toContain('name="tôm &quot;sông&quot; &amp; biển"');
    expect(prompt).toContain('id="ing-1&amp;2"');
    expect(prompt).toContain('canonicalName="tôm &apos;sông&apos;"');
    expect(prompt).toContain('db_name="Tôm &lt;đồng&gt; &amp; biển"');
    expect(prompt).toContain('cooking="áp chảo &quot;nhẹ&quot;"');
  });

  it('includes cooking habits context', () => {
    const prompt = buildNutritionPrompt(
      sampleMealItems,
      sampleMatched,
      [],
      sampleUserContext
    );
    expect(prompt).toContain('oil_usage: normal');
  });

  it('includes unmatched ingredients grouped by meal item', () => {
    const mealItemsWithUnmatched: DecomposedMealItem[] = [
      {
        name: 'cơm',
        ingredients: [
          {
            name: 'gạo',
            estimatedGrams: 200,
            cookingMethod: null,
            userFacingUnit: '1 chén',
          },
          {
            name: 'nước mắm đặc biệt',
            estimatedGrams: 5,
            cookingMethod: null,
            userFacingUnit: null,
          },
        ],
      },
    ];

    const unmatched: UnmatchedIngredient[] = [
      { ingredientName: 'nước mắm đặc biệt', mealContext: 'cơm trắng' },
    ];

    const prompt = buildNutritionPrompt(
      mealItemsWithUnmatched,
      sampleMatched,
      unmatched,
      sampleUserContext
    );
    expect(prompt).toContain('nước mắm đặc biệt');
    expect(prompt).toContain('<meal_item name="cơm">');
    expect(prompt).toContain("culinary knowledge of the user's cuisine");
  });

  it('groups unmatched ingredients under their parent meal items', () => {
    const multiMealItems: DecomposedMealItem[] = [
      {
        name: 'canh rau lang tôm',
        ingredients: [
          {
            name: 'tôm',
            estimatedGrams: 80,
            cookingMethod: 'luộc',
            userFacingUnit: null,
          },
          {
            name: 'nước dùng',
            estimatedGrams: 200,
            cookingMethod: null,
            userFacingUnit: null,
          },
        ],
      },
      {
        name: 'bún bò Huế',
        ingredients: [
          {
            name: 'bún',
            estimatedGrams: 200,
            cookingMethod: null,
            userFacingUnit: null,
          },
          {
            name: 'nước dùng',
            estimatedGrams: 300,
            cookingMethod: null,
            userFacingUnit: null,
          },
        ],
      },
    ];

    const matched: MatchedIngredient[] = [
      {
        ingredientName: 'tôm',
        foodCompositionId: 'shrimp-001',
        matchedName: 'Tôm',
        similarity: 0.9,
        confidence: 'high',
        nutritionPer100g: fullNutrition,
        dbState: 'raw',
      },
      {
        ingredientName: 'bún',
        foodCompositionId: 'noodle-001',
        matchedName: 'Bún',
        similarity: 0.85,
        confidence: 'high',
        nutritionPer100g: fullNutrition,
        dbState: 'raw',
      },
    ];

    const unmatched: UnmatchedIngredient[] = [
      {
        ingredientName: 'nước dùng',
        mealContext: 'canh rau lang tôm, bún bò Huế',
      },
    ];

    const prompt = buildNutritionPrompt(
      multiMealItems,
      matched,
      unmatched,
      sampleUserContext
    );

    // Should have two <meal_item> wrappers for the same unmatched ingredient
    expect(prompt).toContain('<meal_item name="canh rau lang tôm">');
    expect(prompt).toContain('<meal_item name="bún bò Huế">');

    // Each should contain nước dùng with the correct as-eaten grams.
    expect(prompt).toContain('name="nước dùng" as_eaten_grams="200"');
    expect(prompt).toContain('name="nước dùng" as_eaten_grams="300"');
  });

  it('unmatched_rule instructs LLM to use meal item context', () => {
    const mealItemsWithUnmatched: DecomposedMealItem[] = [
      {
        name: 'canh',
        ingredients: [
          {
            name: 'nước dùng',
            estimatedGrams: 200,
            cookingMethod: null,
            userFacingUnit: null,
          },
        ],
      },
    ];

    const unmatched: UnmatchedIngredient[] = [
      { ingredientName: 'nước dùng', mealContext: 'canh' },
    ];

    const prompt = buildNutritionPrompt(
      mealItemsWithUnmatched,
      [],
      unmatched,
      sampleUserContext
    );

    expect(prompt).toContain('parent <meal_item>');
    expect(prompt).toContain('MUST use the meal item name as primary context');
    expect(prompt).toContain('canh rau lang tôm');
    expect(prompt).toContain('bún bò Huế');
  });

  it('only asks for 4 key macros (D5)', () => {
    const prompt = buildNutritionPrompt(
      sampleMealItems,
      sampleMatched,
      [],
      sampleUserContext
    );
    expect(prompt).toContain('caloriesKcal');
    expect(prompt).toContain('proteinG');
    expect(prompt).toContain('carbohydrateG');
    expect(prompt).toContain('fatG');
    // Should NOT ask for all 28 nutrients or fiber (now DB-passthrough)
    expect(prompt).not.toContain('fiberG');
    expect(prompt).not.toContain('sodiumMg');
    expect(prompt).not.toContain('vitaminB12Mcg');
  });

  it('does not leak goal/aggression/calorieTarget to the nutrition prompt (sentinel)', () => {
    const ctx = {
      ...sampleUserContext,
      goal: 'cutting' as const,
      aggression: 0.85,
    };
    const mealItems = [makeMealItem('Phở bò', ['gạo tẻ', 'thịt bò bắp'])];
    const matched = [makeIngredient('gạo tẻ'), makeIngredient('thịt bò bắp')];
    const prompt = buildNutritionPrompt(mealItems, matched, [], ctx);
    expect(prompt).not.toMatch(
      /\bcutting\b|\bbulking\b|\bmaintaining\b|aggression|calorie[_ ]?target|kcal[_ ]?target/i
    );
    expect(prompt).not.toMatch(/0\.85/);
  });

  it('emits db_state per matched ingredient when present', () => {
    const matched = [
      { ...makeIngredient('gạo tẻ'), dbState: 'raw' as const },
      { ...makeIngredient('thịt bò bắp'), dbState: 'cooked' as const },
    ];
    const mealItems = [makeMealItem('Phở bò', ['gạo tẻ', 'thịt bò bắp'])];
    const prompt = buildNutritionPrompt(
      mealItems,
      matched,
      [],
      sampleUserContext
    );
    expect(prompt).toMatch(/db_state="raw"/);
    expect(prompt).toMatch(/db_state="cooked"/);
  });

  it('emits db_state="unknown" for unknown-state matches', () => {
    const unknownStateMatch = {
      ...makeIngredient('gạo tẻ'),
      dbState: 'unknown' as const,
    };
    const mealItems = [makeMealItem('Cơm trắng', ['gạo tẻ'])];
    const prompt = buildNutritionPrompt(
      mealItems,
      [unknownStateMatch],
      [],
      sampleUserContext
    );
    expect(prompt).toMatch(/db_state="unknown"/);
  });

  it('emits as_eaten_grams (not raw_grams) and dbState-aware <calculation>', () => {
    const matched = [
      {
        ...makeIngredient('thịt bò bắp'),
        dbState: 'cooked' as const,
        ingredientId: 'i1',
      },
      {
        ...makeIngredient('gạo tẻ'),
        dbState: 'raw' as const,
        ingredientId: 'i2',
      },
    ];
    const mealItems = [makeMealItem('Phở bò', ['thịt bò bắp', 'gạo tẻ'])];
    const prompt = buildNutritionPrompt(
      mealItems,
      matched,
      [],
      sampleUserContext
    );

    expect(prompt).toMatch(/as_eaten_grams="\d+"/);
    expect(prompt).not.toMatch(/raw_grams=/);
    expect(prompt).toMatch(/db_state="cooked"/);
    expect(prompt).toMatch(/db_state="raw"/);
    expect(prompt).toMatch(/db_state[\s\S]*"cooked"[\s\S]*as_eaten_grams/);
    expect(prompt).toMatch(
      /db_state[\s\S]*"raw"[\s\S]*adjust for cooking method/
    );
  });

  it('includes cooking method attribute in ingredient data', () => {
    const khoMealItems: DecomposedMealItem[] = [
      {
        name: 'thịt kho',
        ingredients: [
          {
            name: 'thịt lợn',
            estimatedGrams: 100,
            cookingMethod: 'kho',
            userFacingUnit: null,
          },
        ],
      },
    ];
    const matched: MatchedIngredient[] = [
      {
        ingredientName: 'thịt lợn',
        foodCompositionId: 'pork-001',
        matchedName: 'Thịt lợn',
        similarity: 0.9,
        confidence: 'high',
        nutritionPer100g: fullNutrition,
        dbState: 'raw',
      },
    ];
    const prompt = buildNutritionPrompt(
      khoMealItems,
      matched,
      [],
      sampleUserContext
    );
    expect(prompt).toContain('cooking="kho"');
    expect(prompt).toContain('cooking method');
  });
});

describe('ASSUMPTION_TEXT', () => {
  it('has text for all three goals', () => {
    expect(ASSUMPTION_TEXT.cutting).toBeDefined();
    expect(ASSUMPTION_TEXT.bulking).toBeDefined();
    expect(ASSUMPTION_TEXT.maintaining).toBeDefined();
  });

  it('each goal has a heading and bullets', () => {
    for (const goal of ['cutting', 'bulking', 'maintaining'] as const) {
      expect(ASSUMPTION_TEXT[goal].heading).toBeTruthy();
      expect(ASSUMPTION_TEXT[goal].bullets.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('text is in English', () => {
    for (const goal of ['cutting', 'bulking', 'maintaining'] as const) {
      const text = ASSUMPTION_TEXT[goal];
      expect(text.heading).toMatch(/^[\x20-\x7E]+$/);
    }
  });
});

// ---------------------------------------------------------------------------
// Prompt determinism / sorting (B4)
// ---------------------------------------------------------------------------

describe('buildNutritionPrompt — deterministic ordering', () => {
  it('produces identical prompt regardless of ingredient array order', () => {
    const matched = ['gạo', 'thịt gà', 'rau muống'].map(makeIngredient);
    const matchedReversed = [...matched].reverse();

    const mealItemsA = [
      makeMealItem('cơm gà', ['gạo', 'thịt gà']),
      makeMealItem('rau xào', ['rau muống']),
    ];
    const mealItemsB = [
      makeMealItem('rau xào', ['rau muống']),
      makeMealItem('cơm gà', ['thịt gà', 'gạo']),
    ];

    const promptA = buildNutritionPrompt(
      mealItemsA,
      matched,
      [],
      sampleUserContext
    );
    const promptB = buildNutritionPrompt(
      mealItemsB,
      matchedReversed,
      [],
      sampleUserContext
    );

    // After sorting, both should produce the same XML order
    expect(promptA).toBe(promptB);
  });

  it('sorts Vietnamese and English ingredient names stably', () => {
    const mealItems = [makeMealItem('dish', ['thịt bò', 'bún', 'giá đỗ'])];
    const matched = ['thịt bò', 'bún', 'giá đỗ'].map(makeIngredient);

    const prompt1 = buildNutritionPrompt(
      mealItems,
      matched,
      [],
      sampleUserContext
    );
    // Shuffle and rebuild
    const shuffled = [...mealItems];
    shuffled[0] = makeMealItem('dish', ['giá đỗ', 'thịt bò', 'bún']);
    const prompt2 = buildNutritionPrompt(
      shuffled,
      [...matched].reverse(),
      [],
      sampleUserContext
    );

    expect(prompt1).toBe(prompt2);
  });

  it('same result for same inputs called multiple times', () => {
    const mealItems = [makeMealItem('phở', ['thịt bò', 'bánh phở'])];
    const matched = ['thịt bò', 'bánh phở'].map(makeIngredient);

    const p1 = buildNutritionPrompt(mealItems, matched, [], sampleUserContext);
    const p2 = buildNutritionPrompt(mealItems, matched, [], sampleUserContext);
    const p3 = buildNutritionPrompt(mealItems, matched, [], sampleUserContext);

    expect(p1).toBe(p2);
    expect(p2).toBe(p3);
  });
});
