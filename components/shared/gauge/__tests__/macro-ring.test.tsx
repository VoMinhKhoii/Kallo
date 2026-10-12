import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { compositionFromGrams } from '@/components/shared/nutrition/composition';
import { MacroRing, macroRingArcs } from '../macro-ring';

describe('macroRingArcs', () => {
  it('draws protein, carbs, fat clockwise from 12 o’clock', () => {
    const { segments } = compositionFromGrams({
      protein: 38.4,
      carbohydrate: 45.2,
      fat: 14.5,
    });
    const arcs = macroRingArcs(segments, 128, 12, 2);
    expect(arcs.map((a) => a.key)).toEqual(['protein', 'carbohydrate', 'fat']);
    // The first arc starts just right of 12 o'clock (x > centre, near the top).
    const [, x, y] = arcs[0].d.match(/^M([\d.]+) ([\d.]+)/) ?? [];
    expect(Number(x)).toBeGreaterThan(64);
    expect(Number(y)).toBeLessThan(10);
  });

  it('omits a macro with no energy instead of drawing a dot', () => {
    const { segments } = compositionFromGrams({
      protein: 10,
      carbohydrate: 0,
      fat: 10,
    });
    expect(macroRingArcs(segments, 128, 12, 2).map((a) => a.key)).toEqual([
      'protein',
      'fat',
    ]);
  });
});

describe('MacroRing', () => {
  it('names its calories and closes into one ring for a single macro', () => {
    const { container } = render(
      <MacroRing kcal={88.4} grams={{ protein: 0, carbohydrate: 0, fat: 10 }} />
    );
    expect(screen.getByRole('img', { name: '88 kcal' })).toBeInTheDocument();
    expect(container.querySelectorAll('path')).toHaveLength(0);
    expect(container.querySelector('circle')).not.toBeNull();
  });
});
