import { describe, expect, it } from 'vitest';
import {
  assertPartsValid,
  copyFactorFor,
  evenParts,
  MAX_PARTICIPANTS,
  MIN_PARTS,
  TOTAL_PARTS,
} from '@/lib/domain/social/splits/parts';

describe('evenParts', () => {
  it('splits 20 evenly and hands the remainder to the earliest seats', () => {
    expect(evenParts(2)).toEqual([10, 10]);
    // 20 is not divisible by 3: the odd part goes to the earlier seats, which
    // is why an even three-way split reads 35 / 35 / 30 and not 33 / 33 / 33.
    expect(evenParts(3)).toEqual([7, 7, 6]);
    expect(evenParts(4)).toEqual([5, 5, 5, 5]);
    expect(evenParts(5)).toEqual([4, 4, 4, 4, 4]);
    expect(evenParts(6)).toEqual([4, 4, 3, 3, 3, 3]);
  });

  it('always sums to TOTAL_PARTS and never breaks the floor', () => {
    for (let p = 2; p <= MAX_PARTICIPANTS; p++) {
      const parts = evenParts(p);
      expect(parts).toHaveLength(p);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(TOTAL_PARTS);
      expect(Math.min(...parts)).toBeGreaterThanOrEqual(MIN_PARTS);
    }
  });

  it('refuses a party the control could not draw', () => {
    expect(() => evenParts(1)).toThrow();
    expect(() => evenParts(MAX_PARTICIPANTS + 1)).toThrow();
  });
});

describe('assertPartsValid', () => {
  it('accepts a sum of exactly TOTAL_PARTS', () => {
    expect(() =>
      assertPartsValid(10, [{ userId: 'a', parts: 10 }])
    ).not.toThrow();
    expect(() =>
      assertPartsValid(8, [
        { userId: 'a', parts: 7 },
        { userId: 'b', parts: 5 },
      ])
    ).not.toThrow();
  });

  it('rejects a sum that is not TOTAL_PARTS', () => {
    expect(() => assertPartsValid(9, [{ userId: 'a', parts: 10 }])).toThrow();
    expect(() => assertPartsValid(11, [{ userId: 'a', parts: 10 }])).toThrow();
  });

  it('rejects anyone under the floor, sender included', () => {
    expect(() => assertPartsValid(19, [{ userId: 'a', parts: 1 }])).toThrow();
    expect(() => assertPartsValid(1, [{ userId: 'a', parts: 19 }])).toThrow();
  });

  it('rejects more participants than the control has seats', () => {
    const six = Array.from({ length: MAX_PARTICIPANTS }, (_, i) => ({
      userId: `u${i}`,
      parts: 3,
    }));
    // six friends + the sender is seven participants.
    expect(() => assertPartsValid(2, six)).toThrow();
  });

  it('rejects a duplicated recipient', () => {
    expect(() =>
      assertPartsValid(10, [
        { userId: 'a', parts: 5 },
        { userId: 'a', parts: 5 },
      ])
    ).toThrow();
  });

  it('rejects non-integer parts', () => {
    expect(() => assertPartsValid(10, [{ userId: 'a', parts: 9.5 }])).toThrow();
  });
});

describe('copyFactorFor', () => {
  it('is exactly 1 for an even two-way split, matching the shipped behaviour', () => {
    expect(copyFactorFor(10, 10)).toBe(1);
  });

  it('is the ratio of the recipient run to the sender run', () => {
    expect(copyFactorFor(7, 13)).toBeCloseTo(7 / 13);
    expect(copyFactorFor(13, 7)).toBeCloseTo(13 / 7);
  });

  it('refuses a sender run of zero rather than dividing by it', () => {
    expect(() => copyFactorFor(10, 0)).toThrow();
  });
});
