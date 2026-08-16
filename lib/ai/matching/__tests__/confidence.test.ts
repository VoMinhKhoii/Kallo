import { describe, expect, it } from 'vitest';
import {
  CONFIDENCE_THRESHOLDS,
  classifyConfidence,
  FUZZY_FALLBACK_THRESHOLD,
  FUZZY_SIMILARITY_THRESHOLD,
  VECTOR_SIMILARITY_THRESHOLD,
} from '@/lib/ai/matching/match-constants';

describe('classifyConfidence', () => {
  it('returns high for similarity >= 0.85', () => {
    expect(classifyConfidence(0.85)).toBe('high');
    expect(classifyConfidence(0.9)).toBe('high');
  });

  it('returns medium for similarity >= 0.7 and < 0.85', () => {
    expect(classifyConfidence(0.7)).toBe('medium');
    expect(classifyConfidence(0.84)).toBe('medium');
  });

  it('returns low for similarity < 0.7', () => {
    expect(classifyConfidence(0.69)).toBe('low');
    expect(classifyConfidence(0.5)).toBe('low');
  });

  it('threshold constants are correct', () => {
    expect(CONFIDENCE_THRESHOLDS.high).toBe(0.85);
    expect(CONFIDENCE_THRESHOLDS.medium).toBe(0.7);
  });

  it('similarity threshold constants are correct', () => {
    expect(FUZZY_SIMILARITY_THRESHOLD).toBe(0.4);
    expect(VECTOR_SIMILARITY_THRESHOLD).toBe(0.7);
    expect(FUZZY_FALLBACK_THRESHOLD).toBe(0.7);
  });
});
