import { describe, expect, it } from 'vitest';
import {
  ASSUMPTION_TEXT,
  buildDecompositionPrompt,
  buildNutritionPrompt,
} from '../prompts';
import type {
  DecomposedMealItem,
  MatchedIngredient,
  UnmatchedIngredient,
  UserContext,
} from '../types';

const sampleUserContext: UserContext = {
  goal: 'cutting',
  aggression: 0.5,
  regionalProfile: 'mien_nam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    sugarBraised: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'finish_it',
  },
};

describe('buildDecompositionPrompt', () => {
  it('includes regional profile in system prompt', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('mien_nam');
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
    expect(prompt).toContain('estimatedGrams');
  });

  it('includes meal slot classification instruction', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('mealSlot');
  });

  it('includes isFood classification instruction (D6)', () => {
    const prompt = buildDecompositionPrompt(sampleUserContext);
    expect(prompt).toContain('isFood');
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

  it('includes cooking habits context', () => {
    const prompt = buildNutritionPrompt(
      sampleMealItems,
      sampleMatched,
      [],
      sampleUserContext
    );
    expect(prompt).toContain('oil_usage: normal');
  });

  it('includes unmatched ingredients with fallback instruction', () => {
    const unmatched: UnmatchedIngredient[] = [
      { ingredientName: 'nước mắm đặc biệt', mealContext: 'cơm' },
    ];

    const prompt = buildNutritionPrompt(
      sampleMealItems,
      sampleMatched,
      unmatched,
      sampleUserContext
    );
    expect(prompt).toContain('nước mắm đặc biệt');
    expect(prompt).toContain('fallback');
  });

  it('only asks for 5 key nutrients (D5)', () => {
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
    expect(prompt).toContain('fiberG');
    // Should NOT ask for all 28 nutrients
    expect(prompt).not.toContain('sodiumMg');
    expect(prompt).not.toContain('vitaminB12Mcg');
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
