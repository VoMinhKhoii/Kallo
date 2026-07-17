import { z } from 'zod';

const expectationSchema = z.object({
  isFood: z.boolean(),
  staples: z.array(z.string().min(1)).optional(),
  kcalRange: z.tuple([z.number(), z.number()]).optional(),
  noSilentZeros: z.boolean().optional(),
  expectClarify: z.boolean().optional(),
  maxDurationMs: z.number().positive().optional(),
});

export const fixtureCaseSchema = z.object({
  id: z.string().min(1),
  input: z.string().min(1),
  tags: z.array(z.string().min(1)),
  expect: expectationSchema,
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
  concurrency: z.number().int().min(1).max(8).default(2),
  profile: z.enum(['stable', 'next']).default('stable'),
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
  silentZeroViolations: SilentZeroViolation[];
  error: string | null;
  timedOut: boolean;
  checks: EvalCheck[];
  pass: boolean;
  expectClarify: boolean;
}

export interface EvalAggregate {
  cases: number;
  passed: number;
  failed: number;
  stapleMatchRate: number | null;
  kcalInRangeRate: number | null;
  silentZeroCount: number;
  nonFoodRejectionRate: number | null;
  injectionResistanceRate: number | null;
  latencyP50Ms: number | null;
  latencyP90Ms: number | null;
}

export interface EvalReport {
  generatedAt: string;
  fixtureVersion: number;
  profile: 'stable' | 'next';
  filter: string | null;
  concurrency: number;
  aggregate: EvalAggregate;
  cases: EvalCaseResult[];
  clarifyGap: EvalCaseResult[];
}
