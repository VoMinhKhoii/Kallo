import '@/lib/__test-utils__/server-only-shim';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  parseModelSpec,
  prepareFixtureImage,
  runModelOnImage,
} from './runners';
import {
  formatComparisonMarkdown,
  formatReportMarkdown,
  scoreCard,
  selectFixtures,
  summarizeModel,
} from './scoring';
import type {
  BenchmarkFixture,
  BenchmarkReport,
  CardRunResult,
  ModelSpec,
  PreprocessMode,
} from './types';

const FIXTURES_DIR = path.resolve(
  'lib/ai/pipeline/estimator/macro-card-ocr/__tests__/fixtures/real-macro-benchmark'
);
const DEFAULT_MODELS = [
  'gemini-3.1-flash-lite:low',
  'gemini-3.1-flash-lite:minimal',
  'gemini-3.5-flash-lite:low',
  'claude-haiku-5-5',
  'claude-sonnet-5-5',
];

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function runPool<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        results[index] = await worker(items[index], index);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function runCompareMode(beforePath: string, afterPath: string) {
  const before = JSON.parse(
    await readFile(beforePath, 'utf8')
  ) as BenchmarkReport;
  const after = JSON.parse(
    await readFile(afterPath, 'utf8')
  ) as BenchmarkReport;
  console.log(formatComparisonMarkdown(before, after));
}

async function evaluateModel(
  spec: ModelSpec,
  fixtures: readonly BenchmarkFixture[],
  preprocess: PreprocessMode,
  concurrency: number
): Promise<CardRunResult[]> {
  console.log(
    `\n=== Running ${spec.id} (${fixtures.length} cards, preprocess=${preprocess}, concurrency=${concurrency}) ===`
  );
  return runPool(fixtures, concurrency, async (fixture, idx) => {
    const rawBytes = await readFile(path.join(FIXTURES_DIR, fixture.filename));
    const image = await prepareFixtureImage(
      rawBytes,
      fixture.filename,
      preprocess
    );
    const out = await runModelOnImage(spec, image);
    const perServing =
      out.parsed?.basis === 'per_serving' ? out.parsed.perServing : null;
    const actual =
      out.parsed && perServing
        ? {
            calories: perServing.calories,
            proteinGrams: perServing.proteinGrams,
            carbsGrams: perServing.carbsGrams,
            fatGrams: perServing.fatGrams,
            productName: out.parsed.productName,
            confidence: out.parsed.confidence,
          }
        : null;
    const scores = scoreCard(fixture.expected, actual);
    const mark = scores.allMatch ? 'PASS' : 'FAIL';
    console.log(
      `  [${idx + 1}/${fixtures.length}] ${mark} ${fixture.code} (${out.latencyMs}ms)`
    );
    return {
      fixtureId: fixture.id,
      code: fixture.code,
      category: fixture.category,
      dishName: fixture.dishName,
      modelId: spec.id,
      preprocess,
      status: out.status,
      errorMessage: out.errorMessage,
      latencyMs: out.latencyMs,
      costUsd: out.costUsd,
      tokens: out.tokens,
      expected: fixture.expected,
      actual,
      scores,
    };
  });
}

async function main() {
  const compareIdx = process.argv.indexOf('--compare');
  if (compareIdx >= 0) {
    const beforePath = process.argv[compareIdx + 1];
    const afterPath = process.argv[compareIdx + 2];
    if (!beforePath || !afterPath) {
      throw new Error('Usage: --compare <before.json> <after.json>');
    }
    await runCompareMode(beforePath, afterPath);
    return;
  }

  const tierRaw = argValue('--tier') ?? 'core';
  const tier = tierRaw === 'preflight' || tierRaw === 'full' ? tierRaw : 'core';
  const preprocess: PreprocessMode =
    argValue('--preprocess') === '1280px' ? '1280px' : 'raw';
  const label = argValue('--label') ?? 'baseline';
  const concurrency = Math.max(1, Number(argValue('--concurrency') ?? '3'));
  const modelTokens = (argValue('--models') ?? DEFAULT_MODELS.join(','))
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const specs = modelTokens.map(parseModelSpec);

  const manifest = JSON.parse(
    await readFile(path.join(FIXTURES_DIR, 'manifest.json'), 'utf8')
  ) as BenchmarkFixture[];
  const fixtures = selectFixtures(manifest, tier);

  const allResults: CardRunResult[] = [];
  const summaries = [];
  for (const spec of specs) {
    const runs = await evaluateModel(spec, fixtures, preprocess, concurrency);
    allResults.push(...runs);
    summaries.push(summarizeModel(spec.id, preprocess, runs));
  }

  const report: BenchmarkReport = {
    label,
    tier,
    preprocess,
    createdAt: new Date().toISOString(),
    summaries,
    results: allResults,
  };

  const md = formatReportMarkdown(report);
  console.log(`\n${md}`);

  const outDir = argValue('--out-dir');
  if (outDir) {
    await mkdir(outDir, { recursive: true });
    const stem = `${label}-${tier}-${preprocess}`;
    await writeFile(
      path.join(outDir, `${stem}.json`),
      `${JSON.stringify(report, null, 2)}\n`,
      'utf8'
    );
    await writeFile(path.join(outDir, `${stem}.md`), md, 'utf8');
    console.log(`Saved report to ${path.join(outDir, `${stem}.json`)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
