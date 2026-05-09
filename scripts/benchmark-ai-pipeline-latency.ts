#!/usr/bin/env bun

import { readFileSync, writeFileSync } from 'node:fs';

/**
 * Benchmark AI Pipeline Latency - Safe Slice 1
 *
 * Pure benchmark helpers and tests only.
 * No production pipeline modifications.
 * No real Gemini/DB calls in this slice.
 */

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export type BenchmarkVariant = {
  label: string;
  modelProfile: 'stable';
  env: Record<string, string | undefined>;
};

export type LatencyGateResult = {
  pass: boolean;
  reason?: string;
};

export type BenchmarkResult = {
  meal: string;
  variant: string;
  success: boolean;
  totalMs: number;
  stages: {
    decompositionMs: number | null;
    matchingMs: number | null;
    nutritionMs: number | null;
  };
  providerAttempts: {
    decomposition: number;
    nutrition: number;
  };
  retryStep2Count: number;
  unmatchedCount: number;
  error?: string;
};

export type BenchmarkSummary = {
  count: number;
  successCount: number;
  maxTotalMs: number;
  retryStep2Count: number;
  maxNutritionAttempts: number;
};

// -----------------------------------------------------------------------------
// Benchmark Meal Set
// -----------------------------------------------------------------------------

export const BENCHMARK_MEALS = [
  'Phở bò tái',
  'Bún chả Hà Nội',
  '2 mực kho + cơm',
  'mực kho với nước mắm đường dầu ăn và cơm trắng',
  'chicken breast with white rice',
];

// -----------------------------------------------------------------------------
// Benchmark Variants
// -----------------------------------------------------------------------------

export const BENCHMARK_VARIANTS: BenchmarkVariant[] = [
  {
    label: 'all-off',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    },
  },
  {
    label: 'slim-schema-only',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    },
  },
  {
    label: 'compressed-decomposition-only',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    },
  },
  {
    label: 'compressed-nutrition-only',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: 'compressed',
    },
  },
  {
    label: 'all-compressed',
    modelProfile: 'stable',
    env: {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      PIPELINE_NUTRITION_PROMPT_LABEL: 'compressed',
    },
  },
];

// -----------------------------------------------------------------------------
// Variant Selection
// -----------------------------------------------------------------------------

export function getBenchmarkVariantsForCli(
  selection: string
): BenchmarkVariant[] {
  if (selection === 'all') {
    return BENCHMARK_VARIANTS;
  }

  if (selection === 'default') {
    return [
      {
        label: 'default',
        modelProfile: 'stable',
        env: {
          PIPELINE_MODEL_PROFILE: 'stable',
          PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
          PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
          PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
        },
      },
    ];
  }

  const variant = BENCHMARK_VARIANTS.find((v) => v.label === selection);
  if (!variant) {
    throw new Error(
      `Unknown variant: ${selection}. Available: ${BENCHMARK_VARIANTS.map((v) => v.label).join(', ')}, all, default`
    );
  }

  return [variant];
}

export function getBenchmarkMealsForCli(selection = 'all'): string[] {
  if (selection === 'all') {
    return BENCHMARK_MEALS;
  }

  const meal = BENCHMARK_MEALS.find((candidate) => candidate === selection);
  if (!meal) {
    throw new Error(
      `Unknown meal: ${selection}. Available: ${BENCHMARK_MEALS.join(' | ')}`
    );
  }

  return [meal];
}

// -----------------------------------------------------------------------------
// Latency Gate
// -----------------------------------------------------------------------------

export function evaluateLatencyGate(params: {
  targetMs: number;
  mainWarmP50Ms: number;
  branchWarmP50Ms: number;
}): LatencyGateResult {
  const { targetMs, mainWarmP50Ms, branchWarmP50Ms } = params;

  if (branchWarmP50Ms > targetMs) {
    return {
      pass: false,
      reason: 'branch_warm_latency_exceeds_target',
    };
  }

  if (branchWarmP50Ms > mainWarmP50Ms * 1.25) {
    return {
      pass: false,
      reason: 'branch_materially_slower_than_main',
    };
  }

  return { pass: true };
}

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------

export function summarizeBenchmarkResults(
  results: BenchmarkResult[]
): BenchmarkSummary {
  if (results.length === 0) {
    return {
      count: 0,
      successCount: 0,
      maxTotalMs: 0,
      retryStep2Count: 0,
      maxNutritionAttempts: 0,
    };
  }

  return {
    count: results.length,
    successCount: results.filter((r) => r.success).length,
    maxTotalMs: Math.max(...results.map((r) => r.totalMs)),
    retryStep2Count: results.reduce((sum, r) => sum + r.retryStep2Count, 0),
    maxNutritionAttempts: Math.max(
      ...results.map((r) => r.providerAttempts.nutrition)
    ),
  };
}

// -----------------------------------------------------------------------------
// Env Redaction
// -----------------------------------------------------------------------------

const SECRET_KEYS = [
  'GEMINI_API_KEY',
  'GOOGLE_GENERATIVE_AI_API_KEY',
  'API_KEY',
  'SECRET',
  'PASSWORD',
  'TOKEN',
];

export function redactEnvForDisplay(
  env: Record<string, string | undefined>
): Record<string, string> {
  const redacted: Record<string, string> = {};

  for (const [key, value] of Object.entries(env)) {
    const upperKey = key.toUpperCase();
    const isSecret = SECRET_KEYS.some((secretKey) =>
      upperKey.includes(secretKey)
    );

    if (isSecret) {
      redacted[key] = value ? '<set>' : '<unset>';
    } else {
      redacted[key] = value !== undefined ? value : '<undefined>';
    }
  }

  return redacted;
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2);
  const flags: {
    dryRun: boolean;
    variant: string;
    meal: string;
    runs: number;
    output?: string;
    compare?: string;
  } = {
    dryRun: false,
    variant: 'default',
    meal: 'all',
    runs: 1,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      flags.dryRun = true;
    } else if (arg.startsWith('--variant=')) {
      flags.variant = arg.split('=')[1];
    } else if (arg.startsWith('--meal=')) {
      flags.meal = arg.split('=')[1];
    } else if (arg.startsWith('--runs=')) {
      flags.runs = Number.parseInt(arg.split('=')[1] ?? '1', 10);
    } else if (arg.startsWith('--output=')) {
      flags.output = arg.split('=')[1];
    } else if (arg.startsWith('--compare=')) {
      flags.compare = arg.split('=')[1];
    }
  }

  return flags;
}

function printDryRun(variants: BenchmarkVariant[], meals: string[]) {
  console.log('Dry-run mode: no Gemini/DB calls\n');

  console.log('Benchmark Meals:');
  for (const meal of meals) {
    console.log(`  - ${meal}`);
  }
  console.log();

  console.log('Variants:');
  for (const variant of variants) {
    console.log(`\n  ${variant.label}:`);
    console.log(`    modelProfile: ${variant.modelProfile}`);
    const redacted = redactEnvForDisplay(variant.env);
    for (const [key, value] of Object.entries(redacted)) {
      console.log(`    ${key}: ${value}`);
    }
  }
  console.log();
}

function applyVariantEnv(variant: BenchmarkVariant) {
  for (const [key, value] of Object.entries(variant.env)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

type PipelineMetricsLog = {
  decomposeMs?: number;
  matchMs?: number;
  nutritionMs?: number;
  totalMs?: number;
  unmatchedCount?: number;
};

function parsePipelineMetricsLog(args: unknown[]): PipelineMetricsLog | null {
  if (args[0] !== '[pipeline] metrics' || typeof args[1] !== 'string') {
    return null;
  }

  try {
    return JSON.parse(args[1]) as PipelineMetricsLog;
  } catch {
    return null;
  }
}

function compareBenchmarkFiles(compare: string) {
  const [leftPath, rightPath] = compare.split(',');
  if (!leftPath || !rightPath) {
    throw new Error('--compare expects two comma-separated JSON file paths');
  }

  const left = JSON.parse(readFileSync(leftPath, 'utf8')) as BenchmarkResult[];
  const right = JSON.parse(
    readFileSync(rightPath, 'utf8')
  ) as BenchmarkResult[];

  console.log('Left summary:', summarizeBenchmarkResults(left));
  console.log('Right summary:', summarizeBenchmarkResults(right));
}

/**
 * Round-robin key rotation for free-tier benchmarking. Each Google Cloud
 * project's free tier caps `generate_content` at 20 requests/day. With
 * `GEMINI_API_KEY_1..N` set, this cycles through them so a single full
 * variant matrix (~75 calls) can fit across multiple free-tier projects
 * (4 keys × 20 = 80 calls).
 *
 * Falls back to `GEMINI_API_KEY` when the numbered slots are empty.
 */
let keyRotationIndex = 0;
function nextApiKey(): string {
  const numbered: string[] = [];
  for (let i = 1; i <= 8; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k) numbered.push(k);
  }
  const pool =
    numbered.length > 0 ? numbered : [process.env.GEMINI_API_KEY ?? ''];
  const key = pool[keyRotationIndex % pool.length];
  keyRotationIndex += 1;
  if (!key) {
    throw new Error(
      'No Gemini API key available. Set GEMINI_API_KEY or GEMINI_API_KEY_1..N.'
    );
  }
  return key;
}

async function runBenchmarkMeal(
  meal: string,
  variant: BenchmarkVariant
): Promise<BenchmarkResult> {
  applyVariantEnv(variant);

  const [{ analyzeMeal }, { createGeminiClient }, { db }] = await Promise.all([
    import('@/lib/ai/pipeline'),
    import('@/lib/ai/gemini'),
    import('@/lib/db'),
  ]);

  const apiKey = nextApiKey();

  let currentStage: 'decomposing' | 'matching' | 'estimating' | 'assembling' =
    'decomposing';
  // Closure assignment fools TS narrowing; the explicit container keeps the
  // type as PipelineMetricsLog | null at every read site.
  const metricsRef: { current: PipelineMetricsLog | null } = { current: null };
  let retryStep2Count = 0;
  const providerAttempts = { decomposition: 0, nutrition: 0 };
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;

  const recordProviderAttempt = (args: unknown[]) => {
    if (
      typeof args[0] === 'string' &&
      args[0].startsWith('[gemini]') &&
      args[0].includes('-stream attempt')
    ) {
      if (currentStage === 'decomposing') {
        providerAttempts.decomposition += 1;
      } else if (currentStage === 'estimating') {
        providerAttempts.nutrition += 1;
      }
    }
  };

  console.info = (...args: unknown[]) => {
    const parsedMetrics = parsePipelineMetricsLog(args);
    if (parsedMetrics) {
      metricsRef.current = parsedMetrics;
    }

    recordProviderAttempt(args);
    originalInfo(...args);
  };

  console.warn = (...args: unknown[]) => {
    recordProviderAttempt(args);

    if (
      typeof args[0] === 'string' &&
      (args[0].includes('retry_step2') || args[0].includes('retrying Call 2'))
    ) {
      retryStep2Count += 1;
    }

    originalWarn(...args);
  };

  console.error = (...args: unknown[]) => {
    recordProviderAttempt(args);
    originalError(...args);
  };

  const startedAt = Date.now();
  try {
    const userContext = {
      goal: 'maintaining',
      aggression: 0,
      countryOfOrigin: 'Vietnam',
      countryOfResidence: 'Vietnam',
      inputLanguage: undefined,
      outputLanguage: undefined,
      cookingHabits: {
        oilUsage: 'normal',
        defaultRicePortion: 'medium',
        sugarBraised: 'medium',
        defaultProteinPortion: 'medium',
        brothConsumption: 'some',
      },
    } as const;

    const result = await analyzeMeal(
      meal,
      userContext,
      db,
      createGeminiClient(apiKey),
      (event) => {
        if (event.type === 'stage') {
          currentStage = event.stage as typeof currentStage;
        }
      }
    );

    return {
      meal,
      variant: variant.label,
      success: result.success,
      totalMs: Date.now() - startedAt,
      stages: {
        decompositionMs: metricsRef.current?.decomposeMs ?? null,
        matchingMs: metricsRef.current?.matchMs ?? null,
        nutritionMs: metricsRef.current?.nutritionMs ?? null,
      },
      providerAttempts,
      retryStep2Count,
      unmatchedCount: metricsRef.current?.unmatchedCount ?? 0,
      ...(result.success ? {} : { error: result.error.message }),
    };
  } catch (error) {
    return {
      meal,
      variant: variant.label,
      success: false,
      totalMs: Date.now() - startedAt,
      stages: {
        decompositionMs: metricsRef.current?.decomposeMs ?? null,
        matchingMs: metricsRef.current?.matchMs ?? null,
        nutritionMs: metricsRef.current?.nutritionMs ?? null,
      },
      providerAttempts,
      retryStep2Count,
      unmatchedCount: metricsRef.current?.unmatchedCount ?? 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
}

async function runBenchmark(
  variants: BenchmarkVariant[],
  meals: string[],
  runs: number
) {
  const results: BenchmarkResult[] = [];

  for (const variant of variants) {
    for (const meal of meals) {
      await runBenchmarkMeal(meal, variant);

      for (let i = 0; i < runs; i++) {
        const result = await runBenchmarkMeal(meal, variant);
        results.push(result);
        console.log(
          `${result.success ? 'PASS' : 'FAIL'} ${variant.label} "${meal}" ${result.totalMs}ms`
        );
      }
    }
  }

  return results;
}

async function main() {
  const flags = parseArgs();

  if (flags.dryRun) {
    const variants = getBenchmarkVariantsForCli(flags.variant);
    const meals = getBenchmarkMealsForCli(flags.meal);
    printDryRun(variants, meals);
    return;
  }

  if (flags.compare) {
    compareBenchmarkFiles(flags.compare);
    return;
  }

  if (!flags.output) {
    console.error('--output=<path> is required for real benchmark execution.');
    process.exit(1);
  }

  const variants = getBenchmarkVariantsForCli(flags.variant);
  const meals = getBenchmarkMealsForCli(flags.meal);
  const results = await runBenchmark(variants, meals, flags.runs);
  writeFileSync(flags.output, `${JSON.stringify(results, null, 2)}\n`);

  if (results.some((result) => !result.success)) {
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
