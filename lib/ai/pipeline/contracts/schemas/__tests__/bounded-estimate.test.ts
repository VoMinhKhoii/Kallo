import { describe, expect, it } from 'vitest';
import {
  boundedEstimateSchema,
  normalizeBoundedEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/bounded-estimate';

describe('boundedEstimateSchema', () => {
  it('accepts valid bounded estimate', () => {
    const result = boundedEstimateSchema.safeParse({
      low: 100,
      mid: 150,
      high: 200,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ low: 100, mid: 150, high: 200 });
    }
  });

  it('accepts equal low/mid/high (exact match)', () => {
    const result = boundedEstimateSchema.safeParse({
      low: 100,
      mid: 100,
      high: 100,
    });
    expect(result.success).toBe(true);
  });

  it('accepts out-of-order bounds (normalization happens post-parse)', () => {
    const result = boundedEstimateSchema.safeParse({
      low: 200,
      mid: 150,
      high: 300,
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing mid', () => {
    const result = boundedEstimateSchema.safeParse({ low: 100, high: 200 });
    expect(result.success).toBe(false);
  });
});

describe('normalizeBoundedEstimate', () => {
  it('returns same values when already ordered', () => {
    expect(normalizeBoundedEstimate({ low: 1, mid: 2, high: 3 })).toEqual({
      low: 1,
      mid: 2,
      high: 3,
    });
  });

  it('sorts out-of-order values', () => {
    expect(normalizeBoundedEstimate({ low: 3, mid: 1, high: 2 })).toEqual({
      low: 1,
      mid: 2,
      high: 3,
    });
  });
});
