import { describe, expect, it } from 'vitest';
import manifest from '@/lib/ai/pipeline/estimator/macro-card-ocr/__tests__/fixtures/real-macro-benchmark/manifest.json';
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

const ALL = manifest as readonly BenchmarkFixture[];

describe('macro-card OCR benchmark scoring', () => {
  it('selects 1 preflight card, 36 stratified core cards across all categories, and all 162 full cards', () => {
    expect(selectFixtures(ALL, 'preflight')).toHaveLength(1);
    const core = selectFixtures(ALL, 'core');
    expect(core).toHaveLength(36);
    const cats = new Set(core.map((c) => c.category));
    expect(cats.size).toBe(10);
    expect(selectFixtures(ALL, 'full')).toHaveLength(162);
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
