import { z } from 'zod';

const macroRangeSchema = z.tuple([z.number().min(0), z.number().min(0)]);
const vesselExpectationSchema = z.object({
  family: z.enum(['bowl', 'plate', 'cup']),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
});

const expectationSchema = z.object({
  isFood: z.boolean(),
  staples: z.array(z.string().min(1)).optional(),
  kcalRange: z.tuple([z.number(), z.number()]).optional(),
  /** Ordered per-meal-item vessel expectations; null asserts no vessel. */
  expectVessel: z.array(vesselExpectationSchema).min(1).nullable().optional(),
  /**
   * Golden-set macro bands (grams, meal total, checked against the mid
   * estimate). Bands are deliberately generous (±25-35%) — wide enough not to
   * false-alarm on legitimate variance, tight enough to catch the 2x-class
   * errors that hurt users (e.g. "2 buns = 390 kcal").
   */
  macroRanges: z
    .object({
      proteinG: macroRangeSchema.optional(),
      carbohydrateG: macroRangeSchema.optional(),
      fatG: macroRangeSchema.optional(),
    })
    .optional(),
  noSilentZeros: z.boolean().optional(),
  expectClarify: z.boolean().optional(),
  maxDurationMs: z.number().positive().optional(),
  /**
   * SOFT latency budget by complexity class (simple ~8s, medium ~15s,
   * complex ~30s, stress ~60s). Violations are reported in the aggregate but
   * never fail the case — wall-clock is environment-dependent (local quota
   * throttling vs Cloud Run), unlike `maxDurationMs` which is a hard gate for
   * degrade-contract cases.
   */
  latencyBudgetMs: z.number().positive().optional(),
});

/** Where a golden expectation came from — makes incremental updates auditable. */
const provenanceSchema = z.object({
  source: z.enum(['knowledge-estimate', 'staging-confirmed', 'user-corrected']),
  setAt: z.string().min(1),
  note: z.string().optional(),
});

export const fixtureCaseSchema = z.object({
  id: z.string().min(1),
  input: z.string().min(1),
  tags: z.array(z.string().min(1)),
  /** CI tier: smoke = per-PR (~12 cheap cases), core = nightly, extended = on-demand. */
  tier: z.enum(['smoke', 'core', 'extended']).default('core'),
  expect: expectationSchema,
  provenance: provenanceSchema.optional(),
  note: z.string().optional(),
});

export const fixtureFileSchema = z.object({
  $schema: z.string().optional(),
  version: z.number().int().positive(),
  notes: z.string().optional(),
  cases: z.array(fixtureCaseSchema),
});

export const cliOptionsSchema = z.object({
  filter: z.string().min(1).optional(),
  /** Run only cases at/below this tier: smoke ⊂ core ⊂ extended (default all). */
  tier: z.enum(['smoke', 'core', 'extended']).optional(),
  concurrency: z.number().int().min(1).max(8).default(2),
  profile: z.enum(['stable', 'next']).default('stable'),
  // D3 bakeoff seam: which Call-2 provider adapter to run. Default `gemini`
  // (the production path). `claude`/`openai` throw until their SDKs are wired
  // (Phase 5 follow-up) — the run fails loudly with the adapter's message.
  estimator: z.enum(['gemini', 'claude', 'openai']).default('gemini'),
});

export type EvalFixtureCase = z.infer<typeof fixtureCaseSchema>;
export type EvalCliOptions = z.infer<typeof cliOptionsSchema>;

export interface EvalStageTimings {
  decompositionMs: number | null;
  matchingMs: number | null;
  nutritionMs: number | null;
  assemblyMs: number | null;
}

export interface EvalIngredientResult {
  mealItemName: string;
  ingredientName: string;
  outcome: 'accepted' | 'rejected' | 'unmatched' | 'missing';
  provenance: 'vector' | 'fuzzy' | 'unmatched';
  similarity: number | null;
  matchedDbName: string | null;
  foodCompositionId: string | null;
}

export interface SilentZeroViolation {
  mealItemName: string;
  ingredientName: string;
  grams: number;
  kcalMid: number | null;
  reasons: Array<'grams_lte_1' | 'kcal_zero'>;
}

export interface EvalCheck {
  name: string;
  pass: boolean;
  expected: unknown;
  actual: unknown;
}

export interface EvalCaseResult {
  id: string;
  input: string;
  tags: string[];
  durationMs: number;
  stages: EvalStageTimings;
  isFood: boolean | null;
  ingredients: EvalIngredientResult[];
  mealKcal: { low: number; mid: number; high: number } | null;
  mealMacros: {
    proteinG: { low: number; mid: number; high: number } | null;
    carbohydrateG: { low: number; mid: number; high: number } | null;
    fatG: { low: number; mid: number; high: number } | null;
  } | null;
  vessels: Array<{
    family: 'bowl' | 'plate' | 'cup' | 'piece';
    tier: 1 | 2 | 3 | 4 | 5;
  } | null>;
  silentZeroViolations: SilentZeroViolation[];
  error: string | null;
  timedOut: boolean;
  checks: EvalCheck[];
  pass: boolean;
  expectClarify: boolean;
  /** True when the pipeline actually surfaced a clarify (response.unresolved). */
  clarified: boolean;
}

export interface EvalAggregate {
  cases: number;
  passed: number;
  failed: number;
  stapleMatchRate: number | null;
  kcalInRangeRate: number | null;
  macroInRangeRate: number | null;
  silentZeroCount: number;
  nonFoodRejectionRate: number | null;
  injectionResistanceRate: number | null;
  latencyP50Ms: number | null;
  latencyP90Ms: number | null;
  /** Soft-gate: cases exceeding their latencyBudgetMs (reported, never failed). */
  latencyBudgetViolations: number;
}

/**
 * Per-estimator bakeoff summary (D3). `costUsdPer1kMeals` is a PROJECTION from
 * the published pricing table × the fixture's observed token usage; until the
 * bakeoff runs with real usage counts it is null (tokens unavailable offline).
 */
export interface EvalEstimatorSummary {
  name: 'gemini' | 'claude' | 'openai';
  model: string;
  inputPerMTokUsd: number;
  outputPerMTokUsd: number;
  /** Projected USD per 1,000 meals, or null when token usage isn't observed. */
  costUsdPer1kMeals: number | null;
}

export interface EvalReport {
  generatedAt: string;
  fixtureVersion: number;
  profile: 'stable' | 'next';
  filter: string | null;
  concurrency: number;
  estimator: EvalEstimatorSummary;
  aggregate: EvalAggregate;
  cases: EvalCaseResult[];
  clarifyGap: EvalCaseResult[];
}
