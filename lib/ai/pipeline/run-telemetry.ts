import { createHash } from 'node:crypto';
import type { AmbiguityFlag } from '@/lib/ai/types';
import type { AppDb } from '@/lib/db';

export const hashUserId = (id: string): string =>
  createHash('sha256').update(id).digest('hex');

const FORBIDDEN_PERSONALIZATION_FIELDS = new Set([
  'goal',
  'aggression',
  'calorieTarget',
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
    preMatchAliasHits: input.counters.preMatchAliasHits,
    cookedToRawFactorFires: input.counters.cookedToRawFactorFires,
    densityEnvelopeFires: input.counters.densityEnvelopeFires,
    macroInconsistentFires: input.counters.macroInconsistentFires,
    dbStateUnknownFires: input.counters.dbStateUnknownFires,
    retryStep2Count: input.counters.retryStep2Count,
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
