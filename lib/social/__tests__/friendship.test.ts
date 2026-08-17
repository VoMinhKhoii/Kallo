import { describe, expect, it } from 'vitest';
import { orderedPair } from '@/lib/social/friendship';

describe('orderedPair', () => {
  const a = '00000000-0000-0000-0000-000000000001';
  const b = '00000000-0000-0000-0000-000000000002';

  it('returns userLow < userHigh', () => {
    const { userLow, userHigh } = orderedPair(a, b);
    expect(userLow < userHigh).toBe(true);
    expect(userLow).toBe(a);
    expect(userHigh).toBe(b);
  });

  it('is commutative — argument order does not matter', () => {
    expect(orderedPair(a, b)).toEqual(orderedPair(b, a));
  });

  it('orders regardless of which argument is larger', () => {
    expect(orderedPair(b, a)).toEqual({ userLow: a, userHigh: b });
  });

  it('throws when both ids are identical', () => {
    expect(() => orderedPair(a, a)).toThrow();
  });
});
