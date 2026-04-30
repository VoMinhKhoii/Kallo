import { describe, expect, it } from 'vitest';
import { pipelineRuns } from '@/lib/db/schema';

describe('pipelineRuns Drizzle schema', () => {
  it('exports a Drizzle table with the spec §0.4 columns', () => {
    const cols = Object.keys(pipelineRuns);
    for (const c of [
      'id',
      'createdAt',
      'userIdHash',
      'requestId',
      'modelCall1',
      'modelCall2',
      'escalated',
      'cacheHitL4',
      'retryCount',
      'totalMs',
      'ingredientCount',
      'matchedCount',
      'unmatchedCount',
      'anomalyTypes',
      'preMatchAliasHits',
      'cookedToRawFactorFires',
      'densityEnvelopeFires',
      'macroInconsistentFires',
      'dbStateUnknownFires',
      'retryStep2Count',
      'promptPersonalizationFields',
    ]) {
      expect(cols).toContain(c);
    }
  });

  it('does NOT redeclare columns owned by the admin worktree', () => {
    // Per the Coordination section, prompt/schema versions live in
    // pipeline_requests.prompt_versions_used (admin worktree) and per-stage
    // timing lives in pipeline_stage_logs.duration_ms (admin worktree).
    // pipeline_runs must NOT duplicate those columns.
    const cols = Object.keys(pipelineRuns);
    for (const forbidden of [
      'decompositionPromptVersion',
      'nutritionPromptVersion',
      'decompositionSchemaVersion',
      'nutritionSchemaVersion',
      'decomposeMs',
      'matchMs',
      'nutritionMs',
    ]) {
      expect(cols).not.toContain(forbidden);
    }
  });
});
