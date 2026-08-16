import { describe, expect, it } from 'vitest';
import { mealDecompositionSchema } from '@/lib/ai/pipeline/contracts/schemas/decomposition';
import { nutritionAdjustmentSchema } from '@/lib/ai/pipeline/contracts/schemas/nutrition-adjustment';
import {
  buildCompressedDecompositionPrompt,
  buildCompressedNutritionPrompt,
  buildDecompositionPrompt,
  buildNutritionPrompt,
} from '@/lib/ai/prompts';
import { toProviderJsonSchema } from '@/lib/ai/prompts/schema';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { MatchedIngredient, UserContext } from '@/lib/ai/types';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PROMPT_CONTEXT_VI: PromptPersonalizationContext = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
  inputLanguage: 'vi',
  outputLanguage: 'vi',
};

const PROMPT_CONTEXT_EN: PromptPersonalizationContext = {
  ...PROMPT_CONTEXT_VI,
  inputLanguage: 'en',
  outputLanguage: 'en',
};

const USER_CONTEXT_VI: UserContext = {
  goal: 'maintaining',
  aggression: 0.5,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: PROMPT_CONTEXT_VI.cookingHabits,
  inputLanguage: 'vi',
  outputLanguage: 'vi',
};

const SAMPLE_DECOMPOSITION_PAYLOAD = {
  isFood: true,
  mealSlot: 'lunch',
  mealItems: [
    {
      mealItemId: 'm1',
      name: 'cơm trắng',
      cookingMethod: 'steamed',
      ingredients: [
        {
          ingredientId: 'i1',
          rawName: 'gạo',
          canonicalName: 'gạo tẻ',
          grams: 200,
        },
      ],
    },
  ],
};

const SAMPLE_DECOMPOSITION_NO_IDS = {
  isFood: true,
  mealSlot: 'lunch',
  mealItems: [
    {
      name: 'cơm trắng',
      cookingMethod: 'steamed',
      ingredients: [
        {
          rawName: 'gạo',
          canonicalName: 'gạo tẻ',
          grams: 200,
        },
      ],
    },
  ],
};

const NUTRITION_FIELDS = [
  'caloriesKcal',
  'proteinG',
  'carbohydrateG',
  'fatG',
  'fiberG',
  'sodiumMg',
  'calciumMg',
  'ironMg',
  'magnesiumMg',
  'phosphorusMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'betaCaroteneMcg',
  'vitaminAMcg',
  'vitaminDMcg',
  'vitaminEMg',
  'vitaminKMcg',
  'vitaminCMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminB9Mcg',
  'vitaminB12Mcg',
  'vitaminHMcg',
] as const;

const NUTRITION_PER_100G = Object.fromEntries(
  NUTRITION_FIELDS.map((key) => [key, key === 'caloriesKcal' ? 130 : null])
) as unknown as MatchedIngredient['nutritionPer100g'];

const MATCHED_INGREDIENT: MatchedIngredient = {
  ingredientName: 'Gạo',
  ingredientId: 'i1',
  matchedName: 'Gạo tẻ',
  foodCompositionId: 'food-1',
  similarity: 0.92,
  confidence: 'high',
  source: 'fao',
  nutritionPer100g: NUTRITION_PER_100G,
  dbState: 'cooked',
};

const NUTRITION_DECOMPOSITION_INPUT = [
  {
    mealItemId: 'm1',
    name: 'Cơm',
    cookingMethod: 'steamed',
    ingredients: [
      {
        ingredientId: 'i1',
        rawName: 'Gạo',
        canonicalName: 'Gạo tẻ',
        grams: 200,
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Decomposition prompt parity
// ---------------------------------------------------------------------------

describe('decomposition prompt canary parity', () => {
  it('compressed variant is shorter than production', () => {
    const production = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const compressed = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    expect(compressed.length).toBeLessThan(production.length);
  });

  it('both variants embed the configured output language', () => {
    const productionVi = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const compressedVi = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    expect(productionVi.toLowerCase()).toContain('vi');
    expect(compressedVi).toContain('output_language=vi');

    const productionEn = buildDecompositionPrompt(PROMPT_CONTEXT_EN);
    const compressedEn = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_EN);
    expect(productionEn.toLowerCase()).toContain('en');
    expect(compressedEn).toContain('output_language=en');
  });

  it('compressed variant has imperative language directive that overrides country bias', () => {
    const compressed = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    // Imperative phrasing
    expect(compressed).toContain('Always emit');
    // Explicit country-fields-do-not-override clause
    expect(compressed).toContain('country_of_origin');
    expect(compressed).toContain('Never let them override output_language');
    // Bilingual examples (anchors output regardless of input language)
    expect(compressed).toContain('"Cơm" → "rice"');
    expect(compressed).toContain('"rice" → "cơm"');
  });

  it('both variants forbid emitting runtime-owned IDs', () => {
    const production = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const compressed = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    for (const prompt of [production, compressed]) {
      expect(prompt.toLowerCase()).toContain('mealitemid');
      expect(prompt.toLowerCase()).toContain('ingredientid');
      // Both must phrase the directive as a negative — a positive instruction
      // would invite the LLM to echo IDs, which the runtime overwrites anyway.
      expect(prompt.toLowerCase()).toMatch(/do not emit|don't emit/);
    }
  });

  it('both variants reference the dish-wrapped schema fields', () => {
    const production = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const compressed = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    for (const prompt of [production, compressed]) {
      expect(prompt).toContain('mealItems');
      expect(prompt).toContain('ingredients');
      expect(prompt).toContain('canonicalName');
      expect(prompt).toContain('grams');
    }
  });

  it('both variants embed the user country context when provided', () => {
    const production = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const compressed = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    for (const prompt of [production, compressed]) {
      expect(prompt).toContain('Vietnam');
    }
  });

  it('both variants are deterministic for identical context', () => {
    const a = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const b = buildDecompositionPrompt(PROMPT_CONTEXT_VI);
    const c = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    const d = buildCompressedDecompositionPrompt(PROMPT_CONTEXT_VI);
    expect(a).toBe(b);
    expect(c).toBe(d);
  });
});

// ---------------------------------------------------------------------------
// Nutrition prompt parity
// ---------------------------------------------------------------------------

describe('nutrition prompt canary parity', () => {
  it('compressed variant is shorter than production', () => {
    const production = buildNutritionPrompt(
      NUTRITION_DECOMPOSITION_INPUT,
      [MATCHED_INGREDIENT],
      [],
      USER_CONTEXT_VI
    );
    const compressed = buildCompressedNutritionPrompt(
      NUTRITION_DECOMPOSITION_INPUT,
      [MATCHED_INGREDIENT],
      [],
      USER_CONTEXT_VI
    );
    expect(compressed.length).toBeLessThan(production.length);
  });

  it('both variants embed the matched ingredient reference values', () => {
    const production = buildNutritionPrompt(
      NUTRITION_DECOMPOSITION_INPUT,
      [MATCHED_INGREDIENT],
      [],
      USER_CONTEXT_VI
    );
    const compressed = buildCompressedNutritionPrompt(
      NUTRITION_DECOMPOSITION_INPUT,
      [MATCHED_INGREDIENT],
      [],
      USER_CONTEXT_VI
    );
    for (const prompt of [production, compressed]) {
      expect(prompt).toContain('Gạo tẻ');
      // 130 kcal/100g shows up as the matched calorie reference.
      expect(prompt).toContain('130');
    }
  });

  it('both variants are deterministic for identical inputs', () => {
    const matched = [MATCHED_INGREDIENT];
    expect(
      buildNutritionPrompt(
        NUTRITION_DECOMPOSITION_INPUT,
        matched,
        [],
        USER_CONTEXT_VI
      )
    ).toBe(
      buildNutritionPrompt(
        NUTRITION_DECOMPOSITION_INPUT,
        matched,
        [],
        USER_CONTEXT_VI
      )
    );
    expect(
      buildCompressedNutritionPrompt(
        NUTRITION_DECOMPOSITION_INPUT,
        matched,
        [],
        USER_CONTEXT_VI
      )
    ).toBe(
      buildCompressedNutritionPrompt(
        NUTRITION_DECOMPOSITION_INPUT,
        matched,
        [],
        USER_CONTEXT_VI
      )
    );
  });
});

// ---------------------------------------------------------------------------
// Provider schema parity
// ---------------------------------------------------------------------------

describe('mealDecompositionSchema provider mode parity', () => {
  it('slim is shorter than full', () => {
    const full = JSON.stringify(
      toProviderJsonSchema(mealDecompositionSchema, { mode: 'full' })
    );
    const slim = JSON.stringify(
      toProviderJsonSchema(mealDecompositionSchema, { mode: 'slim' })
    );
    expect(slim.length).toBeLessThan(full.length);
  });

  it('slim drops only mealItemId / ingredientId from the property set', () => {
    const fullProps = collectPropertyKeys(
      toProviderJsonSchema(mealDecompositionSchema, { mode: 'full' })
    );
    const slimProps = collectPropertyKeys(
      toProviderJsonSchema(mealDecompositionSchema, { mode: 'slim' })
    );
    const dropped = [...fullProps].filter((k) => !slimProps.has(k)).sort();
    // slim removes runtime-owned IDs and nothing else
    expect(dropped).toEqual(['ingredientId', 'mealItemId']);
  });

  it('Zod parse accepts the same payload regardless of provider schema mode', () => {
    // Provider schema mode only affects what we send to Gemini — Zod
    // validation must keep accepting both shapes the LLM might return.
    expect(() =>
      mealDecompositionSchema.parse(SAMPLE_DECOMPOSITION_PAYLOAD)
    ).not.toThrow();
    expect(() =>
      mealDecompositionSchema.parse(SAMPLE_DECOMPOSITION_NO_IDS)
    ).not.toThrow();
  });
});

describe('nutritionAdjustmentSchema provider mode parity', () => {
  it('slim is shorter than full', () => {
    const full = JSON.stringify(
      toProviderJsonSchema(nutritionAdjustmentSchema, { mode: 'full' })
    );
    const slim = JSON.stringify(
      toProviderJsonSchema(nutritionAdjustmentSchema, { mode: 'slim' })
    );
    expect(slim.length).toBeLessThan(full.length);
  });

  it('slim drops only mealItemId / ingredientId from the property set', () => {
    const fullProps = collectPropertyKeys(
      toProviderJsonSchema(nutritionAdjustmentSchema, { mode: 'full' })
    );
    const slimProps = collectPropertyKeys(
      toProviderJsonSchema(nutritionAdjustmentSchema, { mode: 'slim' })
    );
    const dropped = [...fullProps].filter((k) => !slimProps.has(k)).sort();
    expect(dropped).toEqual(['ingredientId', 'mealItemId']);
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectPropertyKeys(
  value: unknown,
  acc = new Set<string>()
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectPropertyKeys(item, acc);
    return acc;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (
      'properties' in obj &&
      obj.properties &&
      typeof obj.properties === 'object'
    ) {
      for (const key of Object.keys(
        obj.properties as Record<string, unknown>
      )) {
        acc.add(key);
      }
    }
    for (const child of Object.values(obj)) {
      collectPropertyKeys(child, acc);
    }
  }
  return acc;
}
