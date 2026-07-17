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
