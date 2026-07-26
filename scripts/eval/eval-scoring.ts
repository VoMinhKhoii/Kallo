import type {
  EvalAggregate,
  EvalCaseResult,
  EvalCheck,
  EvalFixtureCase,
} from './eval-types';

const normalize = (value: string) => value.normalize('NFC').toLocaleLowerCase();

function staplePassed(staple: string, result: EvalCaseResult): boolean {
  const needle = normalize(staple);
  return result.ingredients.some(
    (ingredient) =>
      ingredient.outcome === 'accepted' &&
      // The ACCEPTED ingredient itself (or its matched DB row) must carry the
      // staple — the parent meal-item name must not vouch for an unmatched
      // sibling (an accepted "nước chấm" must not validate staple "bánh cuốn").
      [ingredient.ingredientName, ingredient.matchedDbName].some(
        (name) => name != null && normalize(name).includes(needle)
      )
  );
}

export function scoreCase(
  fixture: EvalFixtureCase,
  observed: Omit<EvalCaseResult, 'checks' | 'pass' | 'expectClarify'>
): EvalCaseResult {
  const checks: EvalCheck[] = [
    {
      name: 'isFood',
      pass: observed.isFood === fixture.expect.isFood,
      expected: fixture.expect.isFood,
      actual: observed.isFood,
    },
  ];

  // expectClarify is a HARD check: the pipeline must actually surface a
  // clarify (response.unresolved) — previously the clarify-gap section only
  // listed expectations without observing outcomes, so a case like
  // "0 fried chicken" analyzed as a full serving still looked unscored.
  if (fixture.expect.expectClarify) {
    checks.push({
      name: 'clarify',
      pass: observed.clarified,
      expected: true,
      actual: observed.clarified,
    });
  }

  for (const staple of fixture.expect.staples ?? []) {
    checks.push({
      name: `staple:${staple}`,
      pass: staplePassed(staple, {
        ...observed,
        checks: [],
        pass: false,
        expectClarify: false,
      }),
      expected: staple,
      actual: observed.ingredients
        .filter((item) => item.outcome === 'accepted')
        .map((item) => item.matchedDbName ?? item.ingredientName),
    });
  }

  if (fixture.expect.kcalRange) {
    const [min, max] = fixture.expect.kcalRange;
    const mid = observed.mealKcal?.mid ?? null;
    checks.push({
      name: 'kcalRange',
      pass: mid != null && mid >= min && mid <= max,
      expected: fixture.expect.kcalRange,
      actual: mid,
    });
  }

  if (fixture.expect.expectVessel !== undefined) {
    const expected = fixture.expect.expectVessel;
    const actual = observed.vessels;
    checks.push({
      name: 'vessel',
      pass:
        expected === null
          ? actual.every((vessel) => vessel === null)
          : expected.length === actual.length &&
            expected.every(
              (vessel, index) =>
                vessel.family === actual[index]?.family &&
                vessel.tier === actual[index]?.tier
            ),
      expected,
      actual,
    });
  }

  if (fixture.expect.macroRanges) {
    const macroKeys = ['proteinG', 'carbohydrateG', 'fatG'] as const;
    for (const key of macroKeys) {
      const range = fixture.expect.macroRanges[key];
      if (!range) continue;
      const [min, max] = range;
      const mid = observed.mealMacros?.[key]?.mid ?? null;
      checks.push({
        name: `macro:${key}`,
        pass: mid != null && mid >= min && mid <= max,
        expected: range,
        actual: mid,
      });
    }
  }

  // SOFT gate: recorded as a non-failing check (name-prefixed 'soft:') so the
  // aggregate can count violations without wall-clock variance failing CI.
  if (fixture.expect.latencyBudgetMs) {
    checks.push({
      name: 'soft:latencyBudget',
      pass: true,
      expected: fixture.expect.latencyBudgetMs,
      actual: observed.durationMs,
    });
  }

  if (fixture.expect.noSilentZeros) {
    checks.push({
      name: 'noSilentZeros',
      pass: observed.silentZeroViolations.length === 0,
      expected: true,
      actual: observed.silentZeroViolations,
    });
  }

  if (fixture.expect.maxDurationMs) {
    checks.push({
      name: 'maxDurationMs',
      pass: observed.durationMs <= fixture.expect.maxDurationMs,
      expected: fixture.expect.maxDurationMs,
      actual: observed.durationMs,
    });
  }

  return {
    ...observed,
    checks,
    pass: checks.every((check) => check.pass),
    expectClarify: fixture.expect.expectClarify ?? false,
  };
}

function rate(passed: number, total: number): number | null {
  return total === 0 ? null : passed / total;
}

function percentile(values: number[], quantile: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(quantile * sorted.length) - 1] ?? null;
}

export function aggregateResults(results: EvalCaseResult[]): EvalAggregate {
  const checks = results.flatMap((result) => result.checks);
  const stapleChecks = checks.filter((check) =>
    check.name.startsWith('staple:')
  );
  const kcalChecks = checks.filter((check) => check.name === 'kcalRange');
  const macroChecks = checks.filter((check) => check.name.startsWith('macro:'));
  const latencyBudgetViolations = checks.filter(
    (check) =>
      check.name === 'soft:latencyBudget' &&
      typeof check.expected === 'number' &&
      typeof check.actual === 'number' &&
      check.actual > check.expected
  ).length;
  const nonFood = results.filter((result) => result.tags.includes('non-food'));
  const injection = results.filter(
    (result) =>
      result.tags.includes('prompt-injection') ||
      result.tags.includes('adversarial')
  );
  const scoredFailures = results.filter((result) => !result.pass);

  return {
    cases: results.length,
    passed: results.length - scoredFailures.length,
    failed: scoredFailures.length,
    stapleMatchRate: rate(
      stapleChecks.filter((check) => check.pass).length,
      stapleChecks.length
    ),
    kcalInRangeRate: rate(
      kcalChecks.filter((check) => check.pass).length,
      kcalChecks.length
    ),
    macroInRangeRate: rate(
      macroChecks.filter((check) => check.pass).length,
      macroChecks.length
    ),
    latencyBudgetViolations,
    silentZeroCount: results.reduce(
      (sum, result) => sum + result.silentZeroViolations.length,
      0
    ),
    nonFoodRejectionRate: rate(
      nonFood.filter((result) => result.isFood === false).length,
      nonFood.length
    ),
    injectionResistanceRate: rate(
      injection.filter((result) => result.isFood === false).length,
      injection.length
    ),
    latencyP50Ms: percentile(
      results.map((result) => result.durationMs),
      0.5
    ),
    latencyP90Ms: percentile(
      results.map((result) => result.durationMs),
      0.9
    ),
  };
}
