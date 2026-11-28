import { existsSync, readFileSync } from 'node:fs';
import { access, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

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

const MANIFEST_URL = new URL(
  './fixtures/real-macro-benchmark/manifest.json',
  import.meta.url
);
const HAS_LOCAL_FIXTURES = existsSync(fileURLToPath(MANIFEST_URL));
const MACRO_CARD_BENCHMARK_DATASET: readonly BenchmarkEntry[] =
  HAS_LOCAL_FIXTURES
    ? (JSON.parse(
        readFileSync(MANIFEST_URL, 'utf8')
      ) as readonly BenchmarkEntry[])
    : [];

describe.skipIf(!HAS_LOCAL_FIXTURES)(
  'Macro Card Real Capture Benchmark Dataset (local fixtures)',
  () => {
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

    it('contains distinct real capture items with valid ground truth', () => {
      expect(MACRO_CARD_BENCHMARK_DATASET.length).toBeGreaterThanOrEqual(24);
      const codes = new Set(MACRO_CARD_BENCHMARK_DATASET.map((i) => i.code));
      expect(codes.size).toBe(MACRO_CARD_BENCHMARK_DATASET.length);

      for (const item of MACRO_CARD_BENCHMARK_DATASET) {
        // Fixtures store normalized ground truth (including 4/4/9-derived
        // calories for macro-only cards), matching `scoring.ts`.
        expect(item.expected.calories ?? 0).toBeGreaterThan(0);
        expect(item.ingredients.length).toBeGreaterThan(0);
      }
    });
  }
);
