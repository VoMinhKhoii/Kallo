import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { applyEvalRelations } from '../eval-relations';
import type { EvalCaseResult, EvalFixtureRelation } from '../eval-types';
import { fixtureFileSchema } from '../eval-types';

function result(id: string, fatMid: number): EvalCaseResult {
  return {
    id,
    input: id,
    tags: ['cooking-fat'],
    durationMs: 1,
    stages: {
      decompositionMs: null,
      matchingMs: null,
      nutritionMs: null,
      assemblyMs: null,
    },
    isFood: true,
    ingredients: [],
    mealKcal: null,
    mealMacros: {
      proteinG: null,
      carbohydrateG: null,
      fatG: { low: fatMid, mid: fatMid, high: fatMid },
    },
    vessels: [],
    silentZeroViolations: [],
    error: null,
    timedOut: false,
    checks: [],
    pass: true,
    expectClarify: false,
    clarified: false,
  };
}

const relation: EvalFixtureRelation = {
  id: 'tofu-oil-monotonic',
  kind: 'strictlyIncreasingFatMid',
  caseIds: ['no-oil', 'light-oil', 'deep-oil'],
};

describe('eval cross-case relations', () => {
  it('loads the cooking-fat fixture and its monotonic relation', () => {
    const fixture = fixtureFileSchema.parse(
      JSON.parse(readFileSync('scripts/eval/fixtures/cooking-fat.json', 'utf8'))
    );
    expect(fixture.cases).toHaveLength(4);
    expect(fixture.relations?.[0]).toEqual(
      expect.objectContaining({
        id: 'fat-vn-tofu-oil-monotonic',
        caseIds: [
          'fat-vn-tofu-no-oil',
          'fat-vn-tofu-light-oil',
          'fat-vn-tofu-deep-oil',
        ],
      })
    );
  });

  it('passes one strict fat-monotonicity assertion for ordered variants', () => {
    const results = applyEvalRelations(
      [result('no-oil', 9), result('light-oil', 15), result('deep-oil', 28)],
      [relation]
    );
    const check = results[2].checks[0];
    expect(check.name).toContain('strictlyIncreasingFatMid');
    expect(check.pass).toBe(true);
    expect(check.actual).toEqual([9, 15, 28]);
  });

  it('fails the relation when deep-fried fat falls below light-oil fat', () => {
    const results = applyEvalRelations(
      [result('no-oil', 9), result('light-oil', 15), result('deep-oil', 9)],
      [relation]
    );
    expect(results[2].checks[0].pass).toBe(false);
    expect(results[2].pass).toBe(false);
  });
});
