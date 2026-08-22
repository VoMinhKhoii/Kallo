import { describe, expect, it } from 'vitest';
import {
  createCompactIdSequence,
  isCompactPipelineId,
  isLegacyPipelineUuid,
} from '@/lib/ai/pipeline/contracts/compact-id';

describe('createCompactIdSequence', () => {
  it('returns deterministic run-scoped meal and ingredient IDs', () => {
    const sequence = createCompactIdSequence();

    expect(sequence.nextMealItemId()).toBe('m1');
    expect(sequence.nextMealItemId()).toBe('m2');
    expect(sequence.nextIngredientId()).toBe('i1');
    expect(sequence.nextIngredientId()).toBe('i2');
  });

  it('skips already used IDs while preserving deterministic order', () => {
    const sequence = createCompactIdSequence();
    const seen = new Set(['m1', 'i1']);

    expect(sequence.nextMealItemId(seen)).toBe('m2');
    expect(sequence.nextIngredientId(seen)).toBe('i2');
  });
});

describe('pipeline id predicates', () => {
  it('accepts compact run-scoped IDs and rejects malformed values', () => {
    expect(isCompactPipelineId('m1')).toBe(true);
    expect(isCompactPipelineId('i42')).toBe(true);
    expect(isCompactPipelineId('meal-1')).toBe(false);
    expect(isCompactPipelineId('m0')).toBe(false);
  });

  it('recognizes legacy UUIDs for migration normalization', () => {
    expect(isLegacyPipelineUuid('11111111-1111-4111-8111-111111111111')).toBe(
      true
    );
    expect(isLegacyPipelineUuid('m1')).toBe(false);
  });
});
