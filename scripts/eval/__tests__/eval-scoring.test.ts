import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { aggregateResults, scoreCase } from '../eval-scoring';
import type {
  EvalCaseResult,
  EvalFixtureCase,
  EvalIngredientResult,
} from '../eval-types';
import { fixtureFileSchema } from '../eval-types';
import { parseEvalArgs } from '../run-eval';

const fixture: EvalFixtureCase = {
  id: 'pho',
  input: '1 phở',
  tags: ['vi', 'staple'],
  tier: 'core',
  expect: {
    isFood: true,
    staples: ['phở'],
    kcalRange: [300, 700],
    noSilentZeros: true,
    expectClarify: true,
  },
};

function observed(): Omit<EvalCaseResult, 'checks' | 'pass' | 'expectClarify'> {
  return {
    id: fixture.id,
    input: fixture.input,
    tags: fixture.tags,
    durationMs: 1200,
    stages: {
      decompositionMs: 300,
      matchingMs: 200,
      nutritionMs: 600,
      assemblyMs: 100,
    },
    isFood: true,
    ingredients: [
      {
        mealItemName: 'Phở bò',
        ingredientName: 'Phở',
        outcome: 'accepted',
        provenance: 'vector',
        similarity: 0.91,
        matchedDbName: 'Phở bò',
        foodCompositionId: 'food-1',
      },
    ],
    mealKcal: { low: 400, mid: 500, high: 600 },
    mealMacros: null,
    silentZeroViolations: [],
    error: null,
    timedOut: false,
  };
}

describe('eval scoring', () => {
  it('scores DB-grounded staples and keeps clarify reporting-only', () => {
    const result = scoreCase(fixture, observed());
    expect(result.pass).toBe(true);
    expect(result.expectClarify).toBe(true);
    expect(result.checks.map((check) => check.name)).not.toContain(
      'expectClarify'
    );
  });

  it('rejects a staple that only appears on an unmatched ingredient', () => {
    const input = observed();
    input.ingredients[0] = {
      ...input.ingredients[0],
      outcome: 'unmatched',
      provenance: 'unmatched',
      matchedDbName: null,
      foodCompositionId: null,
    } satisfies EvalIngredientResult;
    const result = scoreCase(fixture, input);
    expect(result.pass).toBe(false);
    expect(
      result.checks.find((check) => check.name === 'staple:phở')?.pass
    ).toBe(false);
  });

  it('computes aggregate rates and nearest-rank latency percentiles', () => {
    const first = scoreCase(fixture, observed());
    const second: EvalCaseResult = {
      ...first,
      id: 'slow',
      durationMs: 2400,
      pass: false,
    };
    const aggregate = aggregateResults([first, second]);
    expect(aggregate.passed).toBe(2);
    expect(aggregate.failed).toBe(0);
    expect(aggregate.latencyP50Ms).toBe(1200);
    expect(aggregate.latencyP90Ms).toBe(2400);
  });
});

describe('eval CLI', () => {
  it('validates the curated fixture contract', () => {
    const fixtures = fixtureFileSchema.parse(
      JSON.parse(readFileSync('scripts/eval/fixtures/meals.json', 'utf8'))
    );
    expect(fixtures.cases.length).toBeGreaterThan(50);
  });

  it('parses spaced and inline flags with safe defaults', () => {
    expect(parseEvalArgs(['--filter', 'vi', '--profile=next'])).toEqual({
      filter: 'vi',
      concurrency: 2,
      profile: 'next',
      estimator: 'gemini',
    });
  });

  it('rejects unsafe concurrency', () => {
    expect(() => parseEvalArgs(['--concurrency', '0'])).toThrow();
  });

  it('parses --estimator and rejects an unknown adapter', () => {
    expect(parseEvalArgs(['--estimator', 'claude'])).toEqual({
      concurrency: 2,
      profile: 'stable',
      estimator: 'claude',
    });
    expect(() => parseEvalArgs(['--estimator', 'bogus'])).toThrow();
  });
});
