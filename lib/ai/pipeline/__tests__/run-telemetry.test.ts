import { describe, expect, it } from 'vitest';
import { buildPipelineRunRow, hashUserId } from '../telemetry/run-telemetry';

describe('hashUserId', () => {
  it('returns HMAC-SHA256 hex of user id', () => {
    const h = hashUserId('user-123');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is deterministic for the same pepper', () => {
    expect(hashUserId('u')).toBe(hashUserId('u'));
  });
  it('differs from raw SHA-256 (proves pepper is applied)', () => {
    // If hashUserId regressed to plain SHA-256, this would fail because the
    // unkeyed digest of 'user-123' is well-known.
    const sha256OfUser123 =
      '36b362ad259b88beb14e0e94f4f0fbb4d04eebe8e6cdce6df17e53cb7c2adf2c';
    expect(hashUserId('user-123')).not.toBe(sha256OfUser123);
  });
});

describe('buildPipelineRunRow', () => {
  it('captures every spec §0.4 column with safe defaults', () => {
    const row = buildPipelineRunRow({
      userId: 'u-1',
      requestId: 'req-1',
      pipelineVersion: 'v1',
      modelCall1: 'gemini-2.5-flash-lite',
      modelCall2: 'gemini-2.5-flash-lite',
      timings: { total: 4500 },
      counts: { ingredient: 5, matched: 4, unmatched: 1 },
      anomalyTypes: [],
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
      promptPersonalizationFields: ['countryOfOrigin', 'cookingHabits'],
    });
    expect(row.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.requestId).toBe('req-1');
    expect(row.pipelineVersion).toBe('v1');
    expect(row.totalMs).toBe(4500);
    expect(row.promptPersonalizationFields).not.toContain('goal');
  });

  it('rejects payload that includes goal/aggression/calorie target in promptPersonalizationFields', () => {
    expect(() =>
      buildPipelineRunRow({
        userId: 'u-1',
        requestId: 'req-1',
        pipelineVersion: 'v1',
        modelCall1: 'gemini-2.5-flash-lite',
        modelCall2: 'gemini-2.5-flash-lite',
        timings: { total: 3 },
        counts: { ingredient: 1, matched: 1, unmatched: 0 },
        anomalyTypes: [],
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
        promptPersonalizationFields: ['calorieTargetKcal'],
      })
    ).toThrow(/goal|aggression|calorieTarget/i);
  });

  it('passes anomaly types and per-run anomaly counters through to the row', () => {
    const row = buildPipelineRunRow({
      userId: 'u-1',
      requestId: 'req-1',
      pipelineVersion: 'v1',
      modelCall1: 'gemini-2.5-flash-lite',
      modelCall2: 'gemini-2.5-flash-lite',
      timings: { total: 4500 },
      counts: { ingredient: 5, matched: 4, unmatched: 1 },
      anomalyTypes: ['density_envelope', 'macro_inconsistent'],
      ambiguityFlagCounts: {
        cross_cuisine_ingredient: 2,
      },
      rrf: {
        rrfSampled: true,
        rrfDisagreementCount: 2,
        rrfIngredientsObserved: 5,
        rrfMeasurementLatencyMs: 18,
      },
      counters: {
        preMatchAliasHits: 0,
        cookedToRawFactorFires: 2,
        densityEnvelopeFires: 1,
        macroInconsistentFires: 2,
        dbStateUnknownFires: 0,
        retryStep2Count: 0,
      },
      escalated: false,
      cacheHitL4: false,
      retryCount: 0,
      promptPersonalizationFields: ['countryOfOrigin', 'cookingHabits'],
    });

    expect(row.densityEnvelopeFires).toBe(1);
    expect(row.macroInconsistentFires).toBe(2);
    expect(row.cookedToRawFactorFires).toBe(2);
    expect(row.anomalyTypes).toEqual([
      'density_envelope',
      'macro_inconsistent',
    ]);
    expect(row.ambiguityFlagCounts).toEqual({
      cross_cuisine_ingredient: 2,
    });
    expect(row.rrfSampled).toBe(true);
    expect(row.rrfDisagreementCount).toBe(2);
    expect(row.rrfIngredientsObserved).toBe(5);
    expect(row.rrfMeasurementLatencyMs).toBe(18);
  });
});
