import type { RrfMeasurement } from '@/lib/ai/matching/rrf-measurement';

export interface RrfAggregate {
  rrfSampled: boolean;
  rrfDisagreementCount: number | null;
  rrfIngredientsObserved: number | null;
  rrfMeasurementLatencyMs: number | null;
}

export function aggregateRrfMeasurements(
  measurements: readonly RrfMeasurement[]
): RrfAggregate {
  if (measurements.length === 0) {
    return {
      rrfSampled: false,
      rrfDisagreementCount: null,
      rrfIngredientsObserved: null,
      rrfMeasurementLatencyMs: null,
    };
  }

  const maxLatency = Math.max(...measurements.map((m) => m.latencyMs));

  return {
    rrfSampled: true,
    rrfDisagreementCount: measurements.filter((m) => !m.topVectorEqualsTopFuzzy)
      .length,
    rrfIngredientsObserved: measurements.length,
    rrfMeasurementLatencyMs: Math.round(maxLatency),
  };
}
