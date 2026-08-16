import { describe, expect, it, vi } from 'vitest';
import {
  buildPipelineRunRow,
  writePipelineRun,
} from '@/lib/ai/pipeline/telemetry/run-telemetry';
import type { AppDb } from '@/lib/db';

// ---------------------------------------------------------------------------
// D2: the new `v2_anomaly_causes` column ships with an UNAPPLIED migration.
// writePipelineRun must tolerate the column's absence — on Postgres
// undefined_column (42703) it strips the field and retries, so the rest of the
// telemetry row still persists (mirrors Phase 0's pipeline_version tolerance).
// ---------------------------------------------------------------------------

function baseRow() {
  return buildPipelineRunRow({
    userId: 'user-1',
    requestId: 'req-1',
    pipelineVersion: 'v2',
    modelCall1: 'gemini-3.1-flash-lite',
    modelCall2: 'gemini-3-flash-preview',
    timings: { total: 1000 },
    counts: { ingredient: 2, matched: 1, unmatched: 1 },
    anomalyTypes: ['v2_run'],
    ambiguityFlagCounts: {},
    rrf: {
      rrfSampled: false,
      rrfDisagreementCount: null,
      rrfIngredientsObserved: null,
      rrfMeasurementLatencyMs: null,
    },
    counters: {
      preMatchAliasHits: 0,
      cookedToRawFactorFires: 0,
      densityEnvelopeFires: 0,
      macroInconsistentFires: 0,
      dbStateUnknownFires: 0,
      retryStep2Count: 0,
    },
    escalated: false,
    cacheHitL4: false,
    retryCount: 0,
    promptPersonalizationFields: [],
  });
}

const V2_CAUSES = {
  wrong_row: 1,
  wrong_state: 0,
  implausible_grams: 0,
  macro_inconsistent: 2,
  unmatched_high_uncertainty: 0,
  legit_prep_adjustment: 0,
};

describe('writePipelineRun — v2_anomaly_causes column tolerance', () => {
  it('inserts the row WITH v2AnomalyCauses when the column exists (single insert)', async () => {
    const values = vi.fn().mockResolvedValue(undefined);
    const db = { insert: () => ({ values }) } as unknown as AppDb;

    await writePipelineRun(db, { ...baseRow(), v2AnomalyCauses: V2_CAUSES });

    expect(values).toHaveBeenCalledTimes(1);
    expect(values.mock.calls[0][0]).toHaveProperty(
      'v2AnomalyCauses',
      V2_CAUSES
    );
  });

  it('strips v2AnomalyCauses and retries on undefined_column (42703)', async () => {
    const err = Object.assign(
      new Error('column "v2_anomaly_causes" does not exist'),
      {
        code: '42703',
      }
    );
    const values = vi
      .fn()
      .mockRejectedValueOnce(err) // first attempt: column missing
      .mockResolvedValueOnce(undefined); // retry without the column
    const db = { insert: () => ({ values }) } as unknown as AppDb;

    await writePipelineRun(db, { ...baseRow(), v2AnomalyCauses: V2_CAUSES });

    expect(values).toHaveBeenCalledTimes(2);
    // Retry payload must NOT carry the missing column, but must keep the rest.
    const retryPayload = values.mock.calls[1][0];
    expect(retryPayload).not.toHaveProperty('v2AnomalyCauses');
    expect(retryPayload).toHaveProperty('pipelineVersion', 'v2');
    expect(retryPayload).toHaveProperty('anomalyTypes', ['v2_run']);
  });

  it('re-throws a non-column error without retrying', async () => {
    const err = Object.assign(new Error('connection reset'), { code: '08006' });
    const values = vi.fn().mockRejectedValue(err);
    const db = { insert: () => ({ values }) } as unknown as AppDb;

    await expect(
      writePipelineRun(db, { ...baseRow(), v2AnomalyCauses: V2_CAUSES })
    ).rejects.toThrow('connection reset');
    expect(values).toHaveBeenCalledTimes(1);
  });
});
