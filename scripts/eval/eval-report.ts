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
    `| Cost / 1k meals | ${
      report.estimator.costUsdPer1kMeals == null
        ? 'n/a (token usage deferred to live bakeoff)'
        : `$${report.estimator.costUsdPer1kMeals.toFixed(2)}`
    } |`,
    '',
    '_Pricing is a placeholder from published list prices — CONFIRM before trusting the cost ranking (see `estimator/select.ts`)._',
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
