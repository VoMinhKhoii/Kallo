import type {
  BenchmarkFixture,
  BenchmarkReport,
  CardRunResult,
  FieldScores,
  ModelSummary,
  PreprocessMode,
} from './types';

const CORE_SLICE_LIMITS: Record<string, number> = {
  vegetarian: 1,
  low_calorie: 1,
  balanced: 1,
  high_protein: 1,
  smoothie_menu: 4, // 1 Bean + 3 Boost Juice
  fitfood: 3,
  restaurant_bowl: 4, // Sweetgreen
  energy_only: 4, // Itsu UK
  european_card: 4, // Fittaste DE
};

/** Select a deterministic stratified subset per tier. */
export function selectFixtures(
  all: readonly BenchmarkFixture[],
  tier: 'preflight' | 'core' | 'full'
): readonly BenchmarkFixture[] {
  if (tier === 'preflight') return all.slice(0, 1);
  if (tier === 'full') return all;

  const picked: BenchmarkFixture[] = [];
  const counts: Record<string, number> = {};

  // For `meal_prep`, pick 6 original prep/badge cards + 4 MegaFit + 3 Clean Eatz = 13
  let origPrep = 0;
  let megafit = 0;
  let cleaneatz = 0;

  for (const item of all) {
    if (item.category === 'meal_prep') {
      if (item.code.startsWith('PREP-') || item.code.startsWith('CARD-')) {
        if (origPrep < 6) {
          picked.push(item);
          origPrep += 1;
        }
      } else if (
        item.code.startsWith('MEGAFIT-') ||
        item.code.startsWith('MF-')
      ) {
        if (megafit < 4) {
          picked.push(item);
          megafit += 1;
        }
      } else if (item.code.startsWith('CE-')) {
        if (cleaneatz < 3) {
          picked.push(item);
          cleaneatz += 1;
        }
      }
      continue;
    }

    const limit = CORE_SLICE_LIMITS[item.category] ?? 2;
    const seen = counts[item.category] ?? 0;
    if (seen < limit) {
      picked.push(item);
      counts[item.category] = seen + 1;
    }
  }
  return picked;
}

function matchValue(
  expected: number | null,
  actual: number | null,
  tolerance: number
): boolean {
  if (expected === null && actual === null) return true;
  if (expected === null || actual === null) return false;
  return Math.abs(expected - actual) <= tolerance;
}

export function scoreCard(
  expected: BenchmarkFixture['expected'],
  actual: CardRunResult['actual']
): FieldScores {
  if (!actual) {
    return {
      calories: false,
      proteinGrams: false,
      carbsGrams: false,
      fatGrams: false,
      allMatch: false,
      nullPreserved: false,
    };
  }
  const calories = matchValue(expected.calories, actual.calories, 2);
  const proteinGrams = matchValue(
    expected.proteinGrams,
    actual.proteinGrams,
    0.2
  );
  const carbsGrams = matchValue(expected.carbsGrams, actual.carbsGrams, 0.2);
  const fatGrams = matchValue(expected.fatGrams, actual.fatGrams, 0.2);

  const nullPreserved =
    (expected.calories !== null || actual.calories === null) &&
    (expected.proteinGrams !== null || actual.proteinGrams === null) &&
    (expected.carbsGrams !== null || actual.carbsGrams === null) &&
    (expected.fatGrams !== null || actual.fatGrams === null);

  return {
    calories,
    proteinGrams,
    carbsGrams,
    fatGrams,
    allMatch: calories && proteinGrams && carbsGrams && fatGrams,
    nullPreserved,
  };
}

function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)
  );
  return Math.round(sorted[idx]);
}

function pct(num: number, den: number): number {
  return den === 0 ? 0 : Math.round((num / den) * 1000) / 10;
}

export function summarizeModel(
  modelId: string,
  preprocess: PreprocessMode,
  runs: readonly CardRunResult[]
): ModelSummary {
  const total = runs.length;
  const strictPass = runs.filter((r) => r.scores.allMatch).length;
  const latencies = runs.map((r) => r.latencyMs).sort((a, b) => a - b);
  const totalCostUsd = runs.reduce((acc, r) => acc + (r.costUsd ?? 0), 0);

  const byCategory: ModelSummary['byCategory'] = {};
  for (const r of runs) {
    const slot = byCategory[r.category] ?? {
      total: 0,
      strictPass: 0,
      strictRatePct: 0,
    };
    slot.total += 1;
    if (r.scores.allMatch) slot.strictPass += 1;
    byCategory[r.category] = slot;
  }
  for (const slot of Object.values(byCategory)) {
    slot.strictRatePct = pct(slot.strictPass, slot.total);
  }

  return {
    modelId,
    preprocess,
    total,
    strictPass,
    strictRatePct: pct(strictPass, total),
    caloriesPct: pct(runs.filter((r) => r.scores.calories).length, total),
    proteinPct: pct(runs.filter((r) => r.scores.proteinGrams).length, total),
    carbsPct: pct(runs.filter((r) => r.scores.carbsGrams).length, total),
    fatPct: pct(runs.filter((r) => r.scores.fatGrams).length, total),
    nullPreservedPct: pct(
      runs.filter((r) => r.scores.nullPreserved).length,
      total
    ),
    errorCount: runs.filter((r) => r.status === 'error').length,
    noLabelCount: runs.filter((r) => r.status === 'no_label').length,
    p50Ms: percentile(latencies, 50),
    p90Ms: percentile(latencies, 90),
    p95Ms: percentile(latencies, 95),
    totalCostUsd: Math.round(totalCostUsd * 1e6) / 1e6,
    costPer1kUsd:
      total === 0 ? 0 : Math.round((totalCostUsd / total) * 1000 * 1000) / 1000,
    byCategory,
  };
}

export function formatReportMarkdown(report: BenchmarkReport): string {
  const lines: string[] = [
    `# Macro-Card OCR Benchmark — ${report.label} (${report.tier}, preprocess=${report.preprocess})`,
    '',
    '| Model | Strict Acc | Cal | P | C | F | Null OK | Errors | p50 ms | p90 ms | $/1k Scans |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const s of report.summaries) {
    lines.push(
      `| \`${s.modelId}\` | **${s.strictRatePct}%** (${s.strictPass}/${s.total}) | ${s.caloriesPct}% | ${s.proteinPct}% | ${s.carbsPct}% | ${s.fatPct}% | ${s.nullPreservedPct}% | ${s.errorCount + s.noLabelCount} | ${s.p50Ms} | ${s.p90Ms} | $${s.costPer1kUsd.toFixed(3)} |`
    );
  }
  lines.push('', '## Per-Category Strict Accuracy', '');
  const cats = Object.keys(report.summaries[0]?.byCategory ?? {}).sort();
  lines.push(
    `| Category | ${report.summaries.map((s) => `\`${s.modelId}\``).join(' | ')} |`
  );
  lines.push(`|---|${report.summaries.map(() => '---:').join('|')}|`);
  for (const cat of cats) {
    const cells = report.summaries.map((s) => {
      const c = s.byCategory[cat];
      return c ? `${c.strictRatePct}% (${c.strictPass}/${c.total})` : '-';
    });
    lines.push(`| ${cat} | ${cells.join(' | ')} |`);
  }

  const failures = report.results.filter((r) => !r.scores.allMatch);
  if (failures.length > 0) {
    lines.push('', `## Failures (${failures.length})`, '');
    lines.push(
      '| Model | Card | Category | Expected (cal/P/C/F) | Actual | Status |'
    );
    lines.push('|---|---|---|---|---|---|');
    for (const f of failures.slice(0, 60)) {
      const exp = `${f.expected.calories}/${f.expected.proteinGrams}/${f.expected.carbsGrams}/${f.expected.fatGrams}`;
      const act = f.actual
        ? `${f.actual.calories}/${f.actual.proteinGrams}/${f.actual.carbsGrams}/${f.actual.fatGrams}`
        : (f.errorMessage ?? f.status).slice(0, 45);
      lines.push(
        `| \`${f.modelId}\` | \`${f.code}\` | ${f.category} | ${exp} | ${act} | ${f.status} |`
      );
    }
  }
  return `${lines.join('\n')}\n`;
}

export function formatComparisonMarkdown(
  before: BenchmarkReport,
  after: BenchmarkReport
): string {
  const lines: string[] = [
    `# Before vs. After Comparison (${before.label} → ${after.label})`,
    '',
    '| Model | Before Acc | After Acc | Delta | Before p90 | After p90 | Before $/1k | After $/1k |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
  ];
  for (const a of after.summaries) {
    const b = before.summaries.find((s) => s.modelId === a.modelId);
    if (!b) continue;
    const delta = Math.round((a.strictRatePct - b.strictRatePct) * 10) / 10;
    const sign = delta > 0 ? '+' : '';
    lines.push(
      `| \`${a.modelId}\` | ${b.strictRatePct}% | **${a.strictRatePct}%** | **${sign}${delta}%** | ${b.p90Ms} ms | ${a.p90Ms} ms | $${b.costPer1kUsd.toFixed(3)} | $${a.costPer1kUsd.toFixed(3)} |`
    );
  }
  return `${lines.join('\n')}\n`;
}
