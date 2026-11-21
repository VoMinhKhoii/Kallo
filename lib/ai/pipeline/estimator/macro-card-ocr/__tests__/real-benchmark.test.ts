import { access, stat } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import benchmarkDataset from './fixtures/real-macro-benchmark/manifest.json';

interface BenchmarkEntry {
  readonly id: string;
  readonly filename: string;
  readonly code: string;
  readonly category:
    | 'vegetarian'
    | 'balanced'
    | 'high_protein'
    | 'low_calorie'
    | 'smoothie_menu'
    | 'meal_prep'
    | 'fitfood'
    | 'restaurant_bowl'
    | 'energy_only'
    | 'european_card';
  readonly dishName: string;
  readonly ingredients: string;
  readonly expected: {
    readonly calories: number | null;
    readonly proteinGrams: number | null;
    readonly carbsGrams: number | null;
    readonly fatGrams: number | null;
  };
}

const MACRO_CARD_BENCHMARK_DATASET =
  benchmarkDataset as readonly BenchmarkEntry[];

describe('Macro Card Real Capture Benchmark Dataset', () => {
  it.each(
    MACRO_CARD_BENCHMARK_DATASET
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

  it('contains at least 162 distinct real capture items with valid ground truth', () => {
    expect(MACRO_CARD_BENCHMARK_DATASET.length).toBeGreaterThanOrEqual(162);
    const codes = new Set(MACRO_CARD_BENCHMARK_DATASET.map((i) => i.code));
    expect(codes.size).toBe(MACRO_CARD_BENCHMARK_DATASET.length);

    for (const item of MACRO_CARD_BENCHMARK_DATASET) {
      const hasCalories = (item.expected.calories ?? 0) > 0;
      const hasMacros =
        (item.expected.proteinGrams ?? 0) > 0 &&
        (item.expected.carbsGrams ?? 0) > 0 &&
        (item.expected.fatGrams ?? 0) > 0;
      expect(hasCalories || hasMacros).toBe(true);
      expect(item.ingredients.length).toBeGreaterThan(0);
    }
  });

  it('covers all nutritional, regional, and meal card categories', () => {
    const categories = new Set(
      MACRO_CARD_BENCHMARK_DATASET.map((item) => item.category)
    );
    expect(categories).toContain('vegetarian');
    expect(categories).toContain('balanced');
    expect(categories).toContain('high_protein');
    expect(categories).toContain('low_calorie');
    expect(categories).toContain('smoothie_menu');
    expect(categories).toContain('meal_prep');
    expect(categories).toContain('fitfood');
    expect(categories).toContain('restaurant_bowl');
    expect(categories).toContain('energy_only');
    expect(categories).toContain('european_card');
  });
});
