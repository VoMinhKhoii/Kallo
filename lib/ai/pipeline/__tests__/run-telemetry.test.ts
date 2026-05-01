import { describe, expect, it } from 'vitest';
import { buildPipelineRunRow, hashUserId } from '../run-telemetry';

describe('hashUserId', () => {
  it('returns SHA-256 hex of user id', () => {
    const h = hashUserId('user-123');
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });
  it('is deterministic', () => {
    expect(hashUserId('u')).toBe(hashUserId('u'));
  });
});

describe('buildPipelineRunRow', () => {
  it('captures every spec §0.4 column with safe defaults', () => {
    const row = buildPipelineRunRow({
      userId: 'u-1',
      requestId: 'req-1',
      modelCall1: 'gemini-2.5-flash-lite',
      modelCall2: 'gemini-2.5-flash-lite',
      timings: { total: 4500 },
      counts: { ingredient: 5, matched: 4, unmatched: 1 },
      anomalyTypes: [],
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
    expect(row.totalMs).toBe(4500);
    expect(row.promptPersonalizationFields).not.toContain('goal');
  });

  it('rejects payload that includes goal/aggression in promptPersonalizationFields', () => {
    expect(() =>
      buildPipelineRunRow({
        userId: 'u-1',
        requestId: 'req-1',
        modelCall1: 'gemini-2.5-flash-lite',
        modelCall2: 'gemini-2.5-flash-lite',
        timings: { total: 3 },
        counts: { ingredient: 1, matched: 1, unmatched: 0 },
        anomalyTypes: [],
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
        promptPersonalizationFields: ['goal'],
      })
    ).toThrow(/goal|aggression/i);
  });

  it('passes anomaly types and per-run anomaly counters through to the row', () => {
    const row = buildPipelineRunRow({
      userId: 'u-1',
      requestId: 'req-1',
      modelCall1: 'gemini-2.5-flash-lite',
      modelCall2: 'gemini-2.5-flash-lite',
      timings: { total: 4500 },
      counts: { ingredient: 5, matched: 4, unmatched: 1 },
      anomalyTypes: ['density_envelope', 'macro_inconsistent'],
      counters: {
        preMatchAliasHits: 0,
        cookedToRawFactorFires: 0,
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
    expect(row.anomalyTypes).toEqual([
      'density_envelope',
      'macro_inconsistent',
    ]);
  });
});
