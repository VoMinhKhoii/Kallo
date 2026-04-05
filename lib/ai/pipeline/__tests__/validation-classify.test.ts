import { describe, expect, it } from 'vitest';
import {
  classifyAnomalies,
  type ValidationAnomaly,
} from '@/lib/ai/pipeline/validation';

function anomaly(
  severity: 'warning' | 'error',
  type = 'total_calories' as const
): ValidationAnomaly {
  return { type, severity, message: 'test' };
}

describe('classifyAnomalies', () => {
  it('returns "proceed" for empty anomalies', () => {
    expect(classifyAnomalies([])).toBe('proceed');
  });

  it('returns "flag_and_proceed" for warnings only', () => {
    expect(classifyAnomalies([anomaly('warning')])).toBe('flag_and_proceed');
  });

  it('returns "flag_and_proceed" for multiple warnings', () => {
    expect(classifyAnomalies([anomaly('warning'), anomaly('warning')])).toBe(
      'flag_and_proceed'
    );
  });

  it('returns "retry_step2" for a single error', () => {
    expect(classifyAnomalies([anomaly('error')])).toBe('retry_step2');
  });

  it('returns "retry_step2" for error mixed with warnings', () => {
    expect(classifyAnomalies([anomaly('error'), anomaly('warning')])).toBe(
      'retry_step2'
    );
  });

  it('returns "reject" for multiple errors with no warnings', () => {
    expect(classifyAnomalies([anomaly('error'), anomaly('error')])).toBe(
      'reject'
    );
  });

  it('returns "retry_step2" for multiple errors with warnings (some data present)', () => {
    expect(
      classifyAnomalies([
        anomaly('error'),
        anomaly('error'),
        anomaly('warning'),
      ])
    ).toBe('retry_step2');
  });
});
