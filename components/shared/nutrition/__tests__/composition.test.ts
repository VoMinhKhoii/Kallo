import { describe, expect, it } from 'vitest';
import { compositionFromGrams } from '../composition';

describe('compositionFromGrams', () => {
  it('splits by calorie share, not gram weight', () => {
    // 10g of each: fat carries 9 kcal/g against the others' 4, so by weight it
    // would read a third and by energy it reads over half.
    const { segments, totalKcal } = compositionFromGrams({
      protein: 10,
      carbohydrate: 10,
      fat: 10,
    });

    expect(totalKcal).toBe(170);
    expect(segments.map((s) => Math.round(s.pct))).toEqual([24, 24, 53]);
  });

  it('counts a missing macro as zero rather than collapsing the bar', () => {
    const { segments } = compositionFromGrams({
      protein: 30,
      carbohydrate: 30,
      fat: null,
    });

    expect(segments.map((s) => s.pct)).toEqual([50, 50, 0]);
  });

  it('has nothing to split when nothing was logged', () => {
    const { segments, totalKcal } = compositionFromGrams({
      protein: 0,
      carbohydrate: null,
      fat: undefined,
    });

    expect(totalKcal).toBe(0);
    expect(segments.every((s) => s.pct === 0)).toBe(true);
  });
});
