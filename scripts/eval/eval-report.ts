import type { EvalAggregate, EvalCaseResult, EvalReport } from './eval-types';

const percent = (value: number | null) =>
  value == null ? 'n/a' : `${(value * 100).toFixed(1)}%`;

const milliseconds = (value: number | null) =>
  value == null ? 'n/a' : `${value} ms`;

function failedChecks(result: EvalCaseResult): string {
  const failed = result.checks
    .filter((check) => !check.pass)
    .map((check) => check.name);
  return failed.length > 0 ? failed.join(', ') : '—';
}

function aggregateTable(aggregate: EvalAggregate): string[] {
  return [
    '| Metric | Value |',
    '| --- | ---: |',
    `| Cases passed | ${aggregate.passed}/${aggregate.cases} |`,
    `| Staple match rate | ${percent(aggregate.stapleMatchRate)} |`,
    `| Kcal in range | ${percent(aggregate.kcalInRangeRate)} |`,
    `| Macros in range | ${percent(aggregate.macroInRangeRate)} |`,
    `| Latency-budget violations (soft) | ${aggregate.latencyBudgetViolations} |`,
    `| Silent-zero violations | ${aggregate.silentZeroCount} |`,
    `| Non-food rejection rate | ${percent(aggregate.nonFoodRejectionRate)} |`,
    `| Injection resistance | ${percent(aggregate.injectionResistanceRate)} |`,
    `| Latency p50 | ${milliseconds(aggregate.latencyP50Ms)} |`,
    `| Latency p90 | ${milliseconds(aggregate.latencyP90Ms)} |`,
  ];
}

function usageTable(report: EvalReport): string[] {
  const cases = report.cases.length || 1;
  const mean = (pick: (r: EvalCaseResult) => number) =>
    Math.round(report.cases.reduce((sum, r) => sum + pick(r), 0) / cases);
  const cost = report.estimator.costUsdPer1kMeals;
  return [
    '| Per case (mean) | Value |',
    '| --- | ---: |',
    `| LLM calls | ${(report.cases.reduce((sum, r) => sum + r.usage.calls, 0) / cases).toFixed(2)} |`,
    `| Input tokens | ${mean((r) => r.usage.inputTokens)} |`,
    `| of which cached | ${mean((r) => r.usage.cachedTokens)} |`,
    `| Output tokens | ${mean((r) => r.usage.outputTokens)} |`,
    `| Thinking tokens | ${mean((r) => r.usage.thoughtTokens)} |`,
    `| Cost / 1k meals | ${cost == null ? 'n/a (model without a rate)' : `$${cost.toFixed(2)}`} |`,
  ];
}

export function renderMarkdownReport(report: EvalReport): string {
  const lines = [
    '# V2 meal-analysis eval',
    '',
    `Generated: ${report.generatedAt}`,
    `Profile: ${report.profile}`,
    `Filter: ${report.filter ?? 'all'}`,
    `Concurrency: ${report.concurrency}`,
    '',
    '## Estimator (Call 2)',
    '',
    '| Field | Value |',
    '| --- | ---: |',
    `| Adapter | ${report.estimator.name} |`,
    `| Model | ${report.estimator.model} |`,
    `| Input $/1M tok | $${report.estimator.inputPerMTokUsd.toFixed(2)} |`,
    `| Output $/1M tok | $${report.estimator.outputPerMTokUsd.toFixed(2)} |`,
    '',
    '## Cost (whole pipeline, observed tokens)',
    '',
    ...usageTable(report),
    '',
    '_Rates: `lib/ai/cost/pricing.ts` (verified list prices; re-check the date there)._',
    '',
    '## Aggregate',
    '',
    ...aggregateTable(report.aggregate),
    '',
    '## Cases',
    '',
    '| Case | Result | Duration | Failed checks |',
    '| --- | --- | ---: | --- |',
    ...report.cases.map((result) => {
      const outcome = result.expectClarify
        ? 'CLARIFY-GAP'
        : result.pass
          ? 'PASS'
          : 'FAIL';
      return `| ${result.id} | ${outcome} | ${result.durationMs} ms | ${failedChecks(result)} |`;
    }),
    '',
    '## Clarify gap (reporting only)',
    '',
  ];

  if (report.clarifyGap.length === 0) {
    lines.push('No clarify-gap cases were selected.');
  } else {
    lines.push(
      '| Case | Current outcome | Eval result |',
      '| --- | --- | --- |',
      ...report.clarifyGap.map(
        (result) =>
          `| ${result.id} | isFood=${String(result.isFood)}; kcal=${result.mealKcal?.mid ?? 'n/a'} | ${failedChecks(result)} (not scored) |`
      )
    );
  }

  return `${lines.join('\n')}\n`;
}
