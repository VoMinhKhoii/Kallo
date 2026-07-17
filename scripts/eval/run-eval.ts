#!/usr/bin/env bun

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  ESTIMATOR_PRICING,
  selectEstimator,
} from '@/lib/ai/pipeline/estimator/select';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { PipelineResponse, UserContext } from '@/lib/ai/types';
import { buildIngredientResults, findSilentZeros } from './eval-diagnostics';
import { renderMarkdownReport } from './eval-report';
import { aggregateResults, scoreCase } from './eval-scoring';
import {
  cliOptionsSchema,
  type EvalCaseResult,
  type EvalCliOptions,
  type EvalEstimatorSummary,
  type EvalFixtureCase,
  type EvalStageTimings,
  fixtureFileSchema,
} from './eval-types';

type StageKey = keyof EvalStageTimings;

const USER_CONTEXT: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

export function parseEvalArgs(argv: string[]): EvalCliOptions {
  const raw: Record<string, unknown> = {};
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const [flag, inline] = arg.split('=', 2);
    if (
      !['--filter', '--concurrency', '--profile', '--estimator'].includes(flag)
    ) {
      throw new Error(`Unknown argument: ${arg}`);
    }
    const value = inline ?? argv[++index];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${flag}`);
    }
    raw[flag.slice(2)] = flag === '--concurrency' ? Number(value) : value;
  }
  return cliOptionsSchema.parse(raw);
}

function createStageTracker() {
  const timings: EvalStageTimings = {
    decompositionMs: null,
    matchingMs: null,
    nutritionMs: null,
    assemblyMs: null,
  };
  const stageMap: Record<string, StageKey> = {
    decomposing: 'decompositionMs',
    matching: 'matchingMs',
    estimating: 'nutritionMs',
    assembling: 'assemblyMs',
  };
  let current: StageKey | null = null;
  let startedAt = 0;

  const close = (now = Date.now()) => {
    if (!current) return;
    timings[current] = (timings[current] ?? 0) + (now - startedAt);
    current = null;
  };
  const onEvent = (event: StreamEvent) => {
    if (event.type !== 'stage') return;
    const next = stageMap[event.stage];
    if (!next || next === current) return;
    close();
    current = next;
    startedAt = Date.now();
  };
  return { timings, onEvent, close };
}

async function runCase(
  fixture: EvalFixtureCase,
  dependencies: Awaited<ReturnType<typeof loadPipeline>>
): Promise<EvalCaseResult> {
  const tracker = createStageTracker();
  const startedAt = Date.now();
  let diagnostics:
    | import('@/lib/ai/pipeline/grounded-orchestrator').V2PipelineDiagnostics
    | undefined;
  let response: PipelineResponse | undefined;
  let thrownError: string | null = null;

  // Harness-level hard ceiling so one internally-retrying case (Gemini
  // backoff, a wedged deadline) can never stall the whole run — the pipeline's
  // own deadlines bound each LLM call, but a case with many calls + retries can
  // still exceed a sane per-case budget. 90s covers the 55s stress fixture plus
  // headroom; anything past it is recorded as a harness timeout, not a hang.
  const HARNESS_CASE_TIMEOUT_MS = 90_000;
  try {
    response = await Promise.race([
      dependencies.analyzeMealV2(
        fixture.input,
        USER_CONTEXT,
        dependencies.db,
        dependencies.gemini,
        tracker.onEvent,
        {
          onDiagnostics: (value) => (diagnostics = value),
          estimator: dependencies.estimator,
        }
      ),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `harness timeout: case exceeded ${HARNESS_CASE_TIMEOUT_MS}ms`
              )
            ),
          HARNESS_CASE_TIMEOUT_MS
        ).unref()
      ),
    ]);
  } catch (error) {
    thrownError = error instanceof Error ? error.message : String(error);
  } finally {
    tracker.close();
  }

  const durationMs = Date.now() - startedAt;
  const successData = response?.success ? response.data : null;
  const responseError = response && !response.success ? response.error : null;
  const error = thrownError ?? responseError?.message ?? null;
  const isFood = response?.success
    ? true
    : responseError?.type === 'non_food_input'
      ? false
      : null;
  const mealKcal = successData?.boundedNutrition.caloriesKcal ?? null;
  const observed = {
    id: fixture.id,
    input: fixture.input,
    tags: fixture.tags,
    durationMs,
    stages: tracker.timings,
    isFood,
    ingredients: diagnostics ? buildIngredientResults(diagnostics) : [],
    mealKcal,
    silentZeroViolations: successData
      ? findSilentZeros(successData, fixture.tags.includes('zero-cal'))
      : [],
    error,
    timedOut: /took too long|timeout|timed out/i.test(error ?? ''),
  };
  return scoreCase(fixture, observed);
}

async function loadPipeline(estimatorName: EvalCliOptions['estimator']) {
  const [{ analyzeMealV2 }, geminiModule, { db }, { resolveModelProfile }] =
    await Promise.all([
      import('@/lib/ai/pipeline/grounded-orchestrator'),
      import('@/lib/ai/gemini'),
      import('@/lib/db'),
      import('@/lib/ai/pipeline/config/model-profile'),
    ]);
  const gemini = geminiModule.createGeminiClient(
    geminiModule.resolveGeminiProvider()
  );
  // Build the selected Call-2 adapter. `gemini` is the production path;
  // `claude`/`openai` are stubs that throw when their `estimate` is first
  // called (fully-grounded fast-path meals never reach it — by design).
  const estimator = selectEstimator(estimatorName, {
    gemini,
    geminiModel: resolveModelProfile().nutritionModel,
  });
  return { analyzeMealV2, db, gemini, estimator };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await fn(items[index]);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const options = parseEvalArgs(process.argv.slice(2));
  process.env.PIPELINE_MODEL_PROFILE = options.profile;
  const fixtureUrl = new URL('./fixtures/meals.json', import.meta.url);
  const fixture = fixtureFileSchema.parse(
    JSON.parse(readFileSync(fixtureUrl, 'utf8'))
  );
  const selected = options.filter
    ? fixture.cases.filter((item) => item.tags.includes(options.filter!))
    : fixture.cases;
  if (selected.length === 0) {
    throw new Error(`No fixture cases matched tag: ${options.filter}`);
  }

  const dependencies = await loadPipeline(options.estimator);
  const results = await mapConcurrent(selected, options.concurrency, (item) =>
    runCase(item, dependencies)
  );
  const generatedAt = new Date().toISOString();
  const pricing = ESTIMATOR_PRICING[options.estimator];
  const estimatorSummary: EvalEstimatorSummary = {
    name: options.estimator,
    model: dependencies.estimator.model,
    inputPerMTokUsd: pricing.inputPerMTokUsd,
    outputPerMTokUsd: pricing.outputPerMTokUsd,
    // Token usage isn't surfaced through the offline harness yet, so the
    // per-1k-meals cost projection is deferred to the live bakeoff (tomorrow).
    costUsdPer1kMeals: null,
  };
  const report = {
    generatedAt,
    fixtureVersion: fixture.version,
    profile: options.profile,
    filter: options.filter ?? null,
    concurrency: options.concurrency,
    estimator: estimatorSummary,
    aggregate: aggregateResults(results),
    cases: results,
    clarifyGap: results.filter((result) => result.expectClarify),
  };
  const markdown = renderMarkdownReport(report);
  const reportsDir = fileURLToPath(new URL('./reports', import.meta.url));
  const timestamp = generatedAt.replaceAll(':', '-');
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    `${reportsDir}/${timestamp}.json`,
    `${JSON.stringify(report, null, 2)}\n`
  );
  writeFileSync(`${reportsDir}/${timestamp}.md`, markdown);
  process.stdout.write(markdown);
  if (report.aggregate.failed > 0) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
