import { describe, expect, it } from 'vitest';
import { buildWeightTrendSummary } from './weight-trend';

describe('buildWeightTrendSummary', () => {
  it('projects the end weight from elapsed logged days', () => {
    const summary = buildWeightTrendSummary({
      weights: [68.2, 67.8, 67.4],
      periodStartWeight: 68.2,
      expectedEndWeight: 66.5,
      goalDirection: 'down',
      range: '30d',
      elapsedDays: 14,
    });

    expect(summary.canProject).toBe(true);
    expect(summary.projectedEndWeight).toBeCloseTo(66.49, 2);
  });

  it('marks a small maintenance trend as stable', () => {
    const summary = buildWeightTrendSummary({
      weights: [70, 70.05, 70.1],
      periodStartWeight: 70,
      expectedEndWeight: 70,
      goalDirection: 'flat',
      range: '30d',
      elapsedDays: 14,
    });

    expect(summary.status).toBe('stable');
  });

  it('marks loss faster than plan as ahead', () => {
    const summary = buildWeightTrendSummary({
      weights: [72, 71, 70.8],
      periodStartWeight: 72,
      expectedEndWeight: 70.4,
      goalDirection: 'down',
      range: '30d',
      elapsedDays: 14,
    });

    expect(summary.status).toBe('ahead');
  });

  it('requires at least two weights for a verdict', () => {
    const summary = buildWeightTrendSummary({
      weights: [72],
      periodStartWeight: 72,
      expectedEndWeight: 70.4,
      goalDirection: 'down',
      range: '30d',
      elapsedDays: 1,
    });

    expect(summary.status).toBe('insufficient');
  });
});
