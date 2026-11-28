import { describe, expect, it } from 'vitest';
import {
  formatComparisonMarkdown,
  scoreCard,
  selectFixtures,
  summarizeModel,
} from '../scoring';
import type {
  BenchmarkFixture,
  BenchmarkReport,
  CardRunResult,
} from '../types';

function makeFixture(
  id: string,
  category: string,
  code: string
): BenchmarkFixture {
  return {
    id,
    filename: `card-${id}.jpg`,
    code,
    category,
    dishName: `Dish ${code}`,
    ingredients: 'chicken, rice',
    expected:
      category === 'energy_only'
        ? {
            calories: 250,
            proteinGrams: null,
            carbsGrams: null,
            fatGrams: null,
          }
        : { calories: 450, proteinGrams: 35, carbsGrams: 45, fatGrams: 14 },
  };
}

const SYNTHETIC_FIXTURES: readonly BenchmarkFixture[] = [
  ...[
    'vegetarian',
    'low_calorie',
    'balanced',
    'high_protein',
    'smoothie_menu',
    'fitfood',
    'restaurant_bowl',
    'european_card',
    'energy_only',
  ].flatMap((category, catIdx) =>
    Array.from({ length: 5 }, (_, i) =>
      makeFixture(`${catIdx * 5 + i + 1}`, category, `C${catIdx}-${i}`)
    )
  ),
  ...Array.from({ length: 7 }, (_, i) =>
    makeFixture(`p${i}`, 'meal_prep', `PREP-${i}`)
  ),
  ...Array.from({ length: 5 }, (_, i) =>
    makeFixture(`m${i}`, 'meal_prep', `MF-${i}`)
  ),
  ...Array.from({ length: 4 }, (_, i) =>
    makeFixture(`c${i}`, 'meal_prep', `CE-${i}`)
  ),
];

describe('macro-card OCR benchmark scoring', () => {
  it('selects 1 preflight card, stratified core cards across all categories, and full dataset', () => {
    expect(selectFixtures(SYNTHETIC_FIXTURES, 'preflight')).toHaveLength(1);
    const core = selectFixtures(SYNTHETIC_FIXTURES, 'core');
    expect(core).toHaveLength(36);
    const cats = new Set(core.map((c) => c.category));
    expect(cats.size).toBe(10);
    expect(selectFixtures(SYNTHETIC_FIXTURES, 'full')).toHaveLength(
      SYNTHETIC_FIXTURES.length
    );
  });

  it('enforces exact null preservation and numeric tolerances', () => {
    const energyOnly = {
      calories: 137,
      proteinGrams: null,
      carbsGrams: null,
      fatGrams: null,
    };
    expect(
      scoreCard(energyOnly, {
        calories: 138,
        proteinGrams: null,
        carbsGrams: null,
        fatGrams: null,
        productName: 'miso soup',
        confidence: 'high',
      })
    ).toMatchObject({ allMatch: true, nullPreserved: true });

    // Hallucinating 0 for an unprinted nutrient must fail both allMatch and nullPreserved
    expect(
      scoreCard(energyOnly, {
        calories: 137,
        proteinGrams: 0,
        carbsGrams: null,
        fatGrams: null,
        productName: 'miso soup',
        confidence: 'high',
      })
    ).toMatchObject({ allMatch: false, nullPreserved: false });
  });

  it('computes before-vs-after accuracy delta cleanly', () => {
    const makeRun = (ok: boolean): CardRunResult => ({
      fixtureId: '01',
      code: 'V1',
      category: 'vegetarian',
      dishName: 'Bowl',
      modelId: 'claude-haiku-5-5',
      preprocess: 'raw',
      status: 'ok',
      errorMessage: null,
      latencyMs: 1200,
      costUsd: 0.0002,
      tokens: {
        inputTokens: 1000,
        cachedTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 100,
        thoughtTokens: 0,
      },
      expected: {
        calories: 377,
        proteinGrams: 18,
        carbsGrams: 55,
        fatGrams: 10,
      },
      actual: null,
      scores: {
        calories: ok,
        proteinGrams: ok,
        carbsGrams: ok,
        fatGrams: ok,
        allMatch: ok,
        nullPreserved: true,
      },
    });

    const before: BenchmarkReport = {
      label: 'baseline',
      tier: 'core',
      preprocess: 'raw',
      createdAt: '2026-11-19T00:00:00Z',
      summaries: [
        summarizeModel('claude-haiku-5-5', 'raw', [
          makeRun(true),
          makeRun(false),
        ]),
      ],
      results: [],
    };
    const after: BenchmarkReport = {
      ...before,
      label: 'after',
      summaries: [
        summarizeModel('claude-haiku-5-5', 'raw', [
          makeRun(true),
          makeRun(true),
        ]),
      ],
    };

    const md = formatComparisonMarkdown(before, after);
    expect(md).toContain('+50%');
    expect(md).toContain('claude-haiku-5-5');
  });
});
