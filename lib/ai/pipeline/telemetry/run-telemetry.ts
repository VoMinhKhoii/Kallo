import { createHmac, randomUUID } from 'node:crypto';
import type { AmbiguityFlag } from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';
import type { RrfAggregate } from '../rrf-aggregation';

// In-test default pepper so unit tests can run without mutating process.env.
// Production / preview / staging supply ANALYSIS_GUARD_HASH_SECRET via the
// Cloud Run --set-secrets bindings, same pepper the rate-limit guard uses.
const TEST_HASH_SECRET = 'pipeline-telemetry-test-secret';

function getTelemetryPepper(): string {
  const secret = process.env.ANALYSIS_GUARD_HASH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return TEST_HASH_SECRET;
  // Production must supply a pepper. Plain SHA-256 leaves user_id_hash
  // re-identifiable from the raw UUID anywhere in the stack — fail closed.
  throw new Error(
    'ANALYSIS_GUARD_HASH_SECRET is required for pipeline telemetry hashing'
  );
}

export const hashUserId = (id: string): string =>
  createHmac('sha256', getTelemetryPepper()).update(`user:${id}`).digest('hex');

const FORBIDDEN_PERSONALIZATION_FIELDS = new Set([
  'goal',
  'aggression',
  'calorieTarget',
  'calorieTargetKcal',
  'macroTargets',
  'bodyMetrics',
  'weightKg',
  'heightCm',
]);

export interface BuildPipelineRunRowInput {
  userId: string;
  requestId: string | null;
  modelCall1: string;
  modelCall2: string;
  timings: { total: number };
  counts: { ingredient: number; matched: number; unmatched: number };
  anomalyTypes: string[];
  ambiguityFlagCounts: Partial<Record<AmbiguityFlag, number>>;
  rrf: RrfAggregate;
  counters: {
    preMatchAliasHits: number;
    cookedToRawFactorFires: number;
    densityEnvelopeFires: number;
    macroInconsistentFires: number;
    dbStateUnknownFires: number;
    retryStep2Count: number;
  };
  escalated: boolean;
  cacheHitL4: boolean;
  retryCount: number;
  /** Phase A.6 substage signals. */
  languageGuardMisfire?: boolean;
  languageRetryCount?: number;
  aliasFallbackFired?: boolean;
  promptPersonalizationFields: string[];
}

export function buildPipelineRunRow(input: BuildPipelineRunRowInput) {
  for (const f of input.promptPersonalizationFields) {
    if (FORBIDDEN_PERSONALIZATION_FIELDS.has(f)) {
      throw new Error(
        `Principle A violation: '${f}' must not appear in prompts. ` +
          'Goal-preference application is goal-adjustment.ts territory.'
      );
    }
  }
  return {
    id: randomUUID(),
    userIdHash: hashUserId(input.userId),
    requestId: input.requestId,
    modelCall1: input.modelCall1,
    modelCall2: input.modelCall2,
    escalated: input.escalated,
    cacheHitL4: input.cacheHitL4,
    retryCount: input.retryCount,
    totalMs: input.timings.total,
    ingredientCount: input.counts.ingredient,
    matchedCount: input.counts.matched,
    unmatchedCount: input.counts.unmatched,
    anomalyTypes: input.anomalyTypes,
    ambiguityFlagCounts: input.ambiguityFlagCounts,
    rrfSampled: input.rrf.rrfSampled,
    rrfDisagreementCount: input.rrf.rrfDisagreementCount,
    rrfIngredientsObserved: input.rrf.rrfIngredientsObserved,
    rrfMeasurementLatencyMs: input.rrf.rrfMeasurementLatencyMs,
    preMatchAliasHits: input.counters.preMatchAliasHits,
    cookedToRawFactorFires: input.counters.cookedToRawFactorFires,
    densityEnvelopeFires: input.counters.densityEnvelopeFires,
    macroInconsistentFires: input.counters.macroInconsistentFires,
    dbStateUnknownFires: input.counters.dbStateUnknownFires,
    retryStep2Count: input.counters.retryStep2Count,
    languageGuardMisfire: input.languageGuardMisfire ?? false,
    languageRetryCount: input.languageRetryCount ?? 0,
    aliasFallbackFired: input.aliasFallbackFired ?? false,
    promptPersonalizationFields: input.promptPersonalizationFields,
  };
}

export type PipelineRunRow = ReturnType<typeof buildPipelineRunRow>;

export async function writePipelineRun(
  db: AppDb,
  row: PipelineRunRow
): Promise<void> {
  const { pipelineRuns } = await import('@/lib/db/schema');
  await db.insert(pipelineRuns).values(row);
}
