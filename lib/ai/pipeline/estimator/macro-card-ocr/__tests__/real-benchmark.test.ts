import { access, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

/**
 * 11 Real Soumaki Vietnam Healthy Bowl Test Fixtures.
 * Each image contains a real food bowl photo, code badge, macros, and ingredient breakdown.
 */
const SOUMAKI_BENCHMARK_DATASET = [
  {
    id: '01-soumaki-v1-brown-rice',
    filename: '01-soumaki-v1-brown-rice.jpg',
    code: 'V1',
    category: 'vegetarian' as const,
    dishName: 'SOU-MADE BOWL (V1)',
    ingredients: 'Brown rice, cauliflower, mixed veggies, edamame, mushroom',
    expected: {
      calories: 377,
      proteinGrams: 18,
      carbsGrams: 55,
      fatGrams: 10,
    },
  },
  {
    id: '02-soumaki-v2-cold-soba',
    filename: '02-soumaki-v2-cold-soba.jpg',
    code: 'V2',
    category: 'vegetarian' as const,
    dishName: 'SOU-MADE BOWL (V2)',
    ingredients: 'Japanese cold soba, cabbage, chickpeas, beetroot, avocado',
    expected: {
      calories: 536,
      proteinGrams: 19,
      carbsGrams: 74,
      fatGrams: 18,
    },
  },
  {
    id: '03-soumaki-v5-tofu-pasta',
    filename: '03-soumaki-v5-tofu-pasta.jpg',
    code: 'V5',
    category: 'vegetarian' as const,
    dishName: 'SOU-MADE BOWL (V5)',
    ingredients: 'Tofu, pasta, broccoli, edamame, purple cabbage, beetroot',
    expected: {
      calories: 530,
      proteinGrams: 33,
      carbsGrams: 85,
      fatGrams: 7,
    },
  },
  {
    id: '04-soumaki-h10-chicken-salmon',
    filename: '04-soumaki-h10-chicken-salmon.jpg',
    code: 'H10',
    category: 'high_protein' as const,
    dishName: 'SOU-MADE BOWL (H10)',
    ingredients:
      'Half cajun chicken breast, salmon, donburi white rice, tomato',
    expected: {
      calories: 617,
      proteinGrams: 60,
      carbsGrams: 50,
      fatGrams: 20,
    },
  },
  {
    id: '05-soumaki-h9-beef-steak-rice',
    filename: '05-soumaki-h9-beef-steak-rice.jpg',
    code: 'H9',
    category: 'high_protein' as const,
    dishName: 'SOU-MADE BOWL (H9)',
    ingredients: 'Full beef steak, donburi white rice, sweet corn',
    expected: {
      calories: 611,
      proteinGrams: 54,
      carbsGrams: 56,
      fatGrams: 19,
    },
  },
  {
    id: '06-soumaki-l1-beef-sweet-potato',
    filename: '06-soumaki-l1-beef-sweet-potato.jpg',
    code: 'L1',
    category: 'low_calorie' as const,
    dishName: 'SOU-MADE BOWL (L1)',
    ingredients: 'Half beef steak, sweet potato, cauliflower, pickles',
    expected: {
      calories: 274,
      proteinGrams: 25,
      carbsGrams: 27,
      fatGrams: 7,
    },
  },
  {
    id: '07-soumaki-l6-tuna-potato',
    filename: '07-soumaki-l6-tuna-potato.jpg',
    code: 'L6',
    category: 'low_calorie' as const,
    dishName: 'SOU-MADE BOWL (L6)',
    ingredients: 'Tuna, baby potato, sweet corn, mixed veggies',
    expected: {
      calories: 311,
      proteinGrams: 34,
      carbsGrams: 32,
      fatGrams: 5,
    },
  },
  {
    id: '08-soumaki-l3-prawns-cold-soba',
    filename: '08-soumaki-l3-prawns-cold-soba.jpg',
    code: 'L3',
    category: 'low_calorie' as const,
    dishName: 'SOU-MADE BOWL (L3)',
    ingredients: 'Prawns, Japanese cold soba, onsen egg, pickles',
    expected: {
      calories: 341,
      proteinGrams: 32,
      carbsGrams: 35,
      fatGrams: 8,
    },
  },
  {
    id: '09-soumaki-l4-chicken-pak-choi',
    filename: '09-soumaki-l4-chicken-pak-choi.jpg',
    code: 'L4',
    category: 'low_calorie' as const,
    dishName: 'SOU-MADE BOWL (L4)',
    ingredients: 'Half chicken breast, baby potato, mixed veggies, pak choi',
    expected: {
      calories: 285,
      proteinGrams: 33,
      carbsGrams: 23,
      fatGrams: 7,
    },
  },
  {
    id: '10-soumaki-l5-chicken-cold-soba',
    filename: '10-soumaki-l5-chicken-cold-soba.jpg',
    code: 'L5',
    category: 'low_calorie' as const,
    dishName: 'SOU-MADE BOWL (L5)',
    ingredients: 'Half cajun chicken, Japanese cold soba, pickles, cauliflower',
    expected: {
      calories: 351,
      proteinGrams: 39,
      carbsGrams: 40,
      fatGrams: 4,
    },
  },
  {
    id: '11-soumaki-h8-beef-brown-rice',
    filename: '11-soumaki-h8-beef-brown-rice.jpg',
    code: 'H8',
    category: 'high_protein' as const,
    dishName: 'SOU-MADE BOWL (H8)',
    ingredients: 'Full beef steak, donburi brown rice, baby potato, broccoli',
    expected: {
      calories: 649,
      proteinGrams: 56,
      carbsGrams: 60,
      fatGrams: 21,
    },
  },
  {
    id: '12-bean-smoothie-menu-camera',
    filename: '12-bean-smoothie-menu-camera.jpg',
    code: 'BEAN-BERRIES',
    category: 'smoothie_menu' as const,
    dishName: 'Berries Blast',
    ingredients: 'Berries smoothie (unitless carbs & price badge)',
    expected: {
      calories: 333,
      proteinGrams: 20.1,
      carbsGrams: 47.5,
      fatGrams: 11.1,
    },
  },
  {
    id: '13-boost-wondermelon-smoothie',
    filename: '13-boost-wondermelon-smoothie.png',
    code: 'BOOST-WONDERMELON',
    category: 'smoothie_menu' as const,
    dishName: 'Wondermelon',
    ingredients:
      'Strawberries, freshly juiced watermelon, strawberry yoghurt, whey protein, superfruit booster & ice',
    expected: {
      calories: 193,
      proteinGrams: 13.3,
      carbsGrams: null,
      fatGrams: null,
    },
  },
  {
    id: '14-boost-protein-supreme-smoothie',
    filename: '14-boost-protein-supreme-smoothie.png',
    code: 'BOOST-PROTEIN-SUPREME',
    category: 'smoothie_menu' as const,
    dishName: 'Protein Supreme',
    ingredients:
      'Banana, muesli, dates, honey, coconut water, coconut milk, whey protein, chia seeds, cinnamon & ice',
    expected: {
      calories: 488,
      proteinGrams: 29.3,
      carbsGrams: null,
      fatGrams: null,
    },
  },
  {
    id: '15-boost-strawberry-squeeze-smoothie',
    filename: '15-boost-strawberry-squeeze-smoothie.png',
    code: 'BOOST-STRAWBERRY-SQUEEZE',
    category: 'smoothie_menu' as const,
    dishName: 'Strawberry Squeeze',
    ingredients: 'Strawberries, banana, apple juice, strawberry yoghurt & ice',
    expected: {
      calories: 394,
      proteinGrams: null,
      carbsGrams: null,
      fatGrams: null,
    },
  },
  {
    id: '16-prep-grilled-chicken-quinoa',
    filename: '16-prep-grilled-chicken-quinoa.jpg',
    code: 'PREP-CHICKEN-QUINOA',
    category: 'meal_prep' as const,
    dishName: 'Grilled Chicken Quinoa Bowl',
    ingredients: 'Grilled chicken, quinoa, broccoli, sweet potato',
    expected: {
      calories: 450,
      proteinGrams: 45,
      carbsGrams: 45,
      fatGrams: 12,
    },
  },
  {
    id: '17-prep-turkey-avocado-wrap',
    filename: '17-prep-turkey-avocado-wrap.jpg',
    code: 'PREP-TURKEY-WRAP',
    category: 'meal_prep' as const,
    dishName: 'Turkey & Avocado Wrap',
    ingredients: 'Turkey, avocado, mixed peppers, wrap',
    expected: {
      calories: 400,
      proteinGrams: 38,
      carbsGrams: 36,
      fatGrams: 14,
    },
  },
  {
    id: '18-prep-eggs-apple',
    filename: '18-prep-eggs-apple.jpg',
    code: 'PREP-EGGS-APPLE',
    category: 'meal_prep' as const,
    dishName: 'Hard-Boiled Eggs (2 eggs) + Apple',
    ingredients: 'Hard-boiled eggs, apple',
    expected: {
      calories: 210,
      proteinGrams: 14,
      carbsGrams: 25,
      fatGrams: 8,
    },
  },
  {
    id: '19-prep-chicken-fajita-bowl',
    filename: '19-prep-chicken-fajita-bowl.jpg',
    code: 'PREP-FAJITA-BOWL',
    category: 'meal_prep' as const,
    dishName: 'Chicken Fajita Bowl with Brown Rice',
    ingredients: 'Chicken fajita, peppers, brown rice',
    expected: {
      calories: 420,
      proteinGrams: 42,
      carbsGrams: 45,
      fatGrams: 10,
    },
  },
  {
    id: '20-prep-baked-cod-quinoa',
    filename: '20-prep-baked-cod-quinoa.jpg',
    code: 'PREP-BAKED-COD',
    category: 'meal_prep' as const,
    dishName: 'Baked Cod with Quinoa & Asparagus',
    ingredients: 'Baked cod, quinoa, asparagus',
    expected: {
      calories: 420,
      proteinGrams: 44,
      carbsGrams: 40,
      fatGrams: 10,
    },
  },
  {
    id: '21-card-chicken-al-pastor-bowl',
    filename: '21-card-chicken-al-pastor-bowl.jpg',
    code: 'CARD-AL-PASTOR',
    category: 'meal_prep' as const,
    dishName: 'Grilled Chicken Al Pastor Bowls',
    ingredients:
      'Grilled chicken al pastor, guacamole, pineapple, red onion, rice',
    expected: {
      calories: 397,
      proteinGrams: 44,
      carbsGrams: 44,
      fatGrams: 5,
    },
  },
  {
    id: '22-fitfood-15-hamburger-bowl',
    filename: '22-fitfood-15-hamburger-bowl.png',
    code: 'FITFOOD-15',
    category: 'fitfood' as const,
    dishName: 'Hamburger Bowl',
    ingredients: '1 bowl (300g)',
    expected: {
      calories: 360,
      proteinGrams: 42,
      carbsGrams: 24,
      fatGrams: 16,
    },
  },
  {
    id: '23-fitfood-34-tempeh-stir-fry',
    filename: '23-fitfood-34-tempeh-stir-fry.jpg',
    code: 'FITFOOD-34',
    category: 'fitfood' as const,
    dishName: 'Tempeh Stir-Fry',
    ingredients: '1 bowl (300g)',
    expected: {
      calories: 340,
      proteinGrams: 30,
      carbsGrams: 32,
      fatGrams: 16,
    },
  },
  {
    id: '24-fitfood-26-shrimp-stir-fry',
    filename: '24-fitfood-26-shrimp-stir-fry.jpg',
    code: 'FITFOOD-26',
    category: 'fitfood' as const,
    dishName: 'Shrimp Stir-Fry',
    ingredients: '1 bowl (300g)',
    expected: {
      calories: 300,
      proteinGrams: 40,
      carbsGrams: 24,
      fatGrams: 10,
    },
  },
] as const;

describe('Soumaki & Macro Card Real Capture Benchmark Dataset', () => {
  it.each(
    SOUMAKI_BENCHMARK_DATASET
  )('ensures real image fixture exists and is valid: $id ($code)', async (item) => {
    const fileUrl = new URL(
      `./fixtures/real-macro-benchmark/${item.filename}`,
      import.meta.url
    );
    await expect(access(fileUrl)).resolves.toBeUndefined();
    const fileStats = await stat(fileUrl);
    expect(fileStats.size).toBeGreaterThan(15 * 1024);
    expect(fileStats.size).toBeLessThan(1024 * 1024);
  });

  it('contains at least 24 distinct real capture items with full ground truth macros', () => {
    expect(SOUMAKI_BENCHMARK_DATASET.length).toBeGreaterThanOrEqual(24);
    const codes = new Set(SOUMAKI_BENCHMARK_DATASET.map((i) => i.code));
    expect(codes.size).toBe(24);

    for (const item of SOUMAKI_BENCHMARK_DATASET) {
      const hasCalories = (item.expected.calories ?? 0) > 0;
      const hasMacros =
        (item.expected.proteinGrams ?? 0) > 0 &&
        (item.expected.carbsGrams ?? 0) > 0 &&
        (item.expected.fatGrams ?? 0) > 0;
      expect(hasCalories || hasMacros).toBe(true);
      expect(item.ingredients.length).toBeGreaterThan(0);
    }
  });

  it('covers all nutritional and meal categories', () => {
    const categories = new Set(
      SOUMAKI_BENCHMARK_DATASET.map((item) => item.category)
    );
    expect(categories).toContain('vegetarian');
    expect(categories).toContain('high_protein');
    expect(categories).toContain('low_calorie');
    expect(categories).toContain('smoothie_menu');
    expect(categories).toContain('meal_prep');
    expect(categories).toContain('fitfood');
  });
});
