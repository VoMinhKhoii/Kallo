import { describe, expect, it } from 'vitest';
import {
  BENCHMARK_MEALS,
  BENCHMARK_VARIANTS,
  type BenchmarkResult,
  evaluateLatencyGate,
  getBenchmarkMealsForCli,
  getBenchmarkVariantsForCli,
  redactEnvForDisplay,
  summarizeBenchmarkResults,
} from '../benchmark-ai-pipeline-latency';

// -----------------------------------------------------------------------------
// Meal Set Tests
// -----------------------------------------------------------------------------

describe('BENCHMARK_MEALS', () => {
  it('should have exactly 5 meals', () => {
    expect(BENCHMARK_MEALS).toHaveLength(5);
  });

  it('should contain exact expected meals', () => {
    const expected = [
      'Phở bò tái',
      'Bún chả Hà Nội',
      '2 mực kho + cơm',
      'mực kho với nước mắm đường dầu ăn và cơm trắng',
      'chicken breast with white rice',
    ];

    expect(BENCHMARK_MEALS).toEqual(expected);
  });
});

describe('getBenchmarkMealsForCli', () => {
  it('should return all meals by default', () => {
    expect(getBenchmarkMealsForCli()).toEqual(BENCHMARK_MEALS);
  });

  it('should return one exact meal', () => {
    expect(getBenchmarkMealsForCli('Phở bò tái')).toEqual(['Phở bò tái']);
  });

  it('should throw for unknown meals', () => {
    expect(() => getBenchmarkMealsForCli('unknown meal')).toThrow(
      /Unknown meal/
    );
  });
});

// -----------------------------------------------------------------------------
// Variant Tests
// -----------------------------------------------------------------------------

describe('BENCHMARK_VARIANTS', () => {
  it('should have all expected variants', () => {
    const labels = BENCHMARK_VARIANTS.map((v) => v.label);
    expect(labels).toEqual([
      'all-off',
      'slim-schema-only',
      'compressed-decomposition-only',
      'compressed-nutrition-only',
      'all-compressed',
    ]);
  });

  it('should have stable model profile for all variants', () => {
    for (const variant of BENCHMARK_VARIANTS) {
      expect(variant.modelProfile).toBe('stable');
      expect(variant.env.PIPELINE_MODEL_PROFILE).toBe('stable');
    }
  });

  it('should have correct env for all-off variant', () => {
    const allOff = BENCHMARK_VARIANTS.find((v) => v.label === 'all-off');
    expect(allOff).toBeDefined();
    expect(allOff!.env).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    });
  });

  it('should have correct env for slim-schema-only variant', () => {
    const slimOnly = BENCHMARK_VARIANTS.find(
      (v) => v.label === 'slim-schema-only'
    );
    expect(slimOnly).toBeDefined();
    expect(slimOnly!.env).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    });
  });

  it('should have correct env for compressed-decomposition-only variant', () => {
    const decompOnly = BENCHMARK_VARIANTS.find(
      (v) => v.label === 'compressed-decomposition-only'
    );
    expect(decompOnly).toBeDefined();
    expect(decompOnly!.env).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    });
  });

  it('should have correct env for compressed-nutrition-only variant', () => {
    const nutritionOnly = BENCHMARK_VARIANTS.find(
      (v) => v.label === 'compressed-nutrition-only'
    );
    expect(nutritionOnly).toBeDefined();
    expect(nutritionOnly!.env).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: 'compressed',
    });
  });

  it('should have correct env for all-compressed variant', () => {
    const allCompressed = BENCHMARK_VARIANTS.find(
      (v) => v.label === 'all-compressed'
    );
    expect(allCompressed).toBeDefined();
    expect(allCompressed!.env).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      PIPELINE_NUTRITION_PROMPT_LABEL: 'compressed',
    });
  });
});

// -----------------------------------------------------------------------------
// Variant Selection Tests
// -----------------------------------------------------------------------------

describe('getBenchmarkVariantsForCli', () => {
  it('should return all variants for "all"', () => {
    const variants = getBenchmarkVariantsForCli('all');
    expect(variants).toHaveLength(5);
    expect(variants).toEqual(BENCHMARK_VARIANTS);
  });

  it('should return default variant with stable profile and no compression', () => {
    const variants = getBenchmarkVariantsForCli('default');
    expect(variants).toHaveLength(1);
    expect(variants[0].label).toBe('default');
    expect(variants[0].modelProfile).toBe('stable');
    expect(variants[0].env).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_NUTRITION_PROMPT_LABEL: undefined,
    });
  });

  it('should return specific variant by label', () => {
    const variants = getBenchmarkVariantsForCli('all-off');
    expect(variants).toHaveLength(1);
    expect(variants[0].label).toBe('all-off');
  });

  it('should throw for unknown variant', () => {
    expect(() => getBenchmarkVariantsForCli('unknown')).toThrow(
      /Unknown variant/
    );
  });
});

// -----------------------------------------------------------------------------
// Latency Gate Tests
// -----------------------------------------------------------------------------

describe('evaluateLatencyGate', () => {
  it('should fail when branch exceeds 10s target', () => {
    const result = evaluateLatencyGate({
      targetMs: 10_000,
      mainWarmP50Ms: 8_000,
      branchWarmP50Ms: 11_000,
    });

    expect(result.pass).toBe(false);
    expect(result.reason).toBe('branch_warm_latency_exceeds_target');
  });

  it('should fail when main is slower than 10s but branch is >25% slower than main', () => {
    const result = evaluateLatencyGate({
      targetMs: 10_000,
      mainWarmP50Ms: 12_000,
      branchWarmP50Ms: 15_100,
    });

    expect(result.pass).toBe(false);
    expect(result.reason).toBe('branch_warm_latency_exceeds_target');
  });

  it('should fail when branch is under target but >25% slower than main', () => {
    const result = evaluateLatencyGate({
      targetMs: 10_000,
      mainWarmP50Ms: 6_000,
      branchWarmP50Ms: 7_600,
    });

    expect(result.pass).toBe(false);
    expect(result.reason).toBe('branch_materially_slower_than_main');
  });

  it('should pass when branch is under target and within 25% of main', () => {
    const result = evaluateLatencyGate({
      targetMs: 10_000,
      mainWarmP50Ms: 8_000,
      branchWarmP50Ms: 9_000,
    });

    expect(result.pass).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should pass when branch equals main', () => {
    const result = evaluateLatencyGate({
      targetMs: 10_000,
      mainWarmP50Ms: 8_000,
      branchWarmP50Ms: 8_000,
    });

    expect(result.pass).toBe(true);
  });

  it('should pass when branch is exactly 25% slower than main', () => {
    const result = evaluateLatencyGate({
      targetMs: 10_000,
      mainWarmP50Ms: 8_000,
      branchWarmP50Ms: 10_000,
    });

    expect(result.pass).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Summary Tests
// -----------------------------------------------------------------------------

describe('summarizeBenchmarkResults', () => {
  it('should summarize one result', () => {
    const results: BenchmarkResult[] = [
      {
        meal: 'Phở bò tái',
        variant: 'all-off',
        success: true,
        totalMs: 5_000,
        stages: {
          decompositionMs: 1_000,
          matchingMs: 500,
          nutritionMs: 3_500,
        },
        providerAttempts: {
          decomposition: 1,
          nutrition: 1,
        },
        retryStep2Count: 0,
        unmatchedCount: 0,
      },
    ];

    const summary = summarizeBenchmarkResults(results);

    expect(summary).toEqual({
      count: 1,
      successCount: 1,
      maxTotalMs: 5_000,
      retryStep2Count: 0,
      maxNutritionAttempts: 1,
    });
  });

  it('should handle empty array safely', () => {
    const summary = summarizeBenchmarkResults([]);

    expect(summary).toEqual({
      count: 0,
      successCount: 0,
      maxTotalMs: 0,
      retryStep2Count: 0,
      maxNutritionAttempts: 0,
    });
  });

  it('should calculate max values correctly', () => {
    const results: BenchmarkResult[] = [
      {
        meal: 'Meal 1',
        variant: 'v1',
        success: true,
        totalMs: 3_000,
        stages: {
          decompositionMs: 1_000,
          matchingMs: 500,
          nutritionMs: 1_500,
        },
        providerAttempts: {
          decomposition: 1,
          nutrition: 1,
        },
        retryStep2Count: 0,
        unmatchedCount: 0,
      },
      {
        meal: 'Meal 2',
        variant: 'v1',
        success: false,
        totalMs: 8_000,
        stages: {
          decompositionMs: 2_000,
          matchingMs: 500,
          nutritionMs: 5_500,
        },
        providerAttempts: {
          decomposition: 1,
          nutrition: 3,
        },
        retryStep2Count: 1,
        unmatchedCount: 2,
      },
      {
        meal: 'Meal 3',
        variant: 'v1',
        success: true,
        totalMs: 5_000,
        stages: {
          decompositionMs: 1_500,
          matchingMs: 500,
          nutritionMs: 3_000,
        },
        providerAttempts: {
          decomposition: 1,
          nutrition: 2,
        },
        retryStep2Count: 1,
        unmatchedCount: 1,
      },
    ];

    const summary = summarizeBenchmarkResults(results);

    expect(summary).toEqual({
      count: 3,
      successCount: 2,
      maxTotalMs: 8_000,
      retryStep2Count: 2,
      maxNutritionAttempts: 3,
    });
  });
});

// -----------------------------------------------------------------------------
// Env Redaction Tests
// -----------------------------------------------------------------------------

describe('redactEnvForDisplay', () => {
  it('should redact GEMINI_API_KEY as <set> when set', () => {
    const env = {
      GEMINI_API_KEY: 'secret-key-123',
      PIPELINE_MODEL_PROFILE: 'stable',
    };

    const redacted = redactEnvForDisplay(env);

    expect(redacted).toEqual({
      GEMINI_API_KEY: '<set>',
      PIPELINE_MODEL_PROFILE: 'stable',
    });
  });

  it('should redact GOOGLE_GENERATIVE_AI_API_KEY as <set> when set', () => {
    const env = {
      GOOGLE_GENERATIVE_AI_API_KEY: 'secret-key-456',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
    };

    const redacted = redactEnvForDisplay(env);

    expect(redacted).toEqual({
      GOOGLE_GENERATIVE_AI_API_KEY: '<set>',
      PIPELINE_PROVIDER_SCHEMA_MODE: 'slim',
    });
  });

  it('should leave PIPELINE_MODEL_PROFILE visible', () => {
    const env = {
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
    };

    const redacted = redactEnvForDisplay(env);

    expect(redacted).toEqual({
      PIPELINE_MODEL_PROFILE: 'stable',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
    });
  });

  it('should redact any key containing API_KEY, SECRET, PASSWORD, or TOKEN', () => {
    const env = {
      MY_API_KEY: 'key1',
      DB_PASSWORD: 'pass1',
      AUTH_TOKEN: 'token1',
      APP_SECRET: 'secret1',
      NORMAL_CONFIG: 'visible',
    };

    const redacted = redactEnvForDisplay(env);

    expect(redacted).toEqual({
      MY_API_KEY: '<set>',
      DB_PASSWORD: '<set>',
      AUTH_TOKEN: '<set>',
      APP_SECRET: '<set>',
      NORMAL_CONFIG: 'visible',
    });
  });

  it('should handle empty strings as <unset>', () => {
    const env = {
      GEMINI_API_KEY: '',
      PIPELINE_MODEL_PROFILE: 'stable',
    };

    const redacted = redactEnvForDisplay(env);

    expect(redacted).toEqual({
      GEMINI_API_KEY: '<unset>',
      PIPELINE_MODEL_PROFILE: 'stable',
    });
  });

  it('should display undefined values as <undefined>', () => {
    const env = {
      PIPELINE_PROVIDER_SCHEMA_MODE: undefined,
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: undefined,
      PIPELINE_MODEL_PROFILE: 'stable',
    };

    const redacted = redactEnvForDisplay(env);

    expect(redacted).toEqual({
      PIPELINE_PROVIDER_SCHEMA_MODE: '<undefined>',
      PIPELINE_DECOMPOSITION_PROMPT_LABEL: '<undefined>',
      PIPELINE_MODEL_PROFILE: 'stable',
    });
  });
});
