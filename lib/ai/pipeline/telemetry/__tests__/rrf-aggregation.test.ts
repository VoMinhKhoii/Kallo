import { describe, expect, it } from 'vitest';
import { aggregateRrfMeasurements } from '@/lib/ai/pipeline/telemetry/rrf-aggregation';

describe('aggregateRrfMeasurements', () => {
  it('returns null fields when no measurements were sampled', () => {
    expect(aggregateRrfMeasurements([])).toEqual({
      rrfSampled: false,
      rrfDisagreementCount: null,
      rrfIngredientsObserved: null,
      rrfMeasurementLatencyMs: null,
    });
  });

  it('counts disagreements and observed ingredients', () => {
    const out = aggregateRrfMeasurements([
      { topVectorEqualsTopFuzzy: true, latencyMs: 12 },
      { topVectorEqualsTopFuzzy: false, latencyMs: 18 },
      { topVectorEqualsTopFuzzy: false, latencyMs: 9 },
    ]);

    expect(out.rrfSampled).toBe(true);
    expect(out.rrfDisagreementCount).toBe(2);
    expect(out.rrfIngredientsObserved).toBe(3);
    expect(out.rrfMeasurementLatencyMs).toBe(18);
  });

  it('rounds max latency to integer milliseconds', () => {
    const out = aggregateRrfMeasurements([
      { topVectorEqualsTopFuzzy: false, latencyMs: 14.7 },
    ]);

    expect(out.rrfMeasurementLatencyMs).toBe(15);
  });
});
