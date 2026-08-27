import { describe, expect, it } from 'vitest';
import {
  gaugeCalorieLines,
  gaugeMacroLines,
  gaugeReadoutHeights,
} from '@/components/shared/gauge/gauge-lines';

/** Every radius the two surfaces' caps and minimums can land the dials on. */
const RADII = [20, 26, 28, 31, 38, 47, 48, 53, 58, 72, 89, 91, 104];

const CALORIE = {
  figure: '2,219',
  unit: 'kcal remaining',
  detail: '375 over 1,844',
};
const MACRO = { figure: '196g', target: '/161g' };

describe('gaugeReadoutHeights', () => {
  it('matches the heights the lines are actually rendered at', () => {
    // This is why the heights live beside the constructors. The strip measures
    // a dial's stack to align two arcs by their centres, and the dial renders
    // each line at its own `heightPx`. If the two ever disagree the arcs drift
    // apart by the difference — silently, and only at some radii.
    for (const radius of RADII) {
      const calorie = gaugeCalorieLines(CALORIE, radius);
      expect(gaugeReadoutHeights(radius, 'calorie')).toEqual([
        calorie.primary.heightPx,
        calorie.secondary.heightPx,
        calorie.tertiary.heightPx,
      ]);

      const macro = gaugeMacroLines(MACRO, radius);
      expect(gaugeReadoutHeights(radius, 'macro')).toEqual([
        macro.primary.heightPx,
        macro.secondary.heightPx,
      ]);
    }
  });
});

describe('the readout hierarchy', () => {
  it('never lets the quiet detail outgrow the line that names the figure', () => {
    // The two sizes ride different curves — the unit line is held down by the
    // tip opening the long wording has to clear, the detail hangs below the arc
    // and is bounded by nothing. Left alone the detail overtakes the unit from
    // about r45 to r77, which is exactly where both surfaces land.
    for (const radius of RADII) {
      const { primary, secondary, tertiary } = gaugeCalorieLines(
        CALORIE,
        radius
      );
      expect(secondary.fontSizePx).toBeGreaterThanOrEqual(tertiary.fontSizePx);
      expect(primary.fontSizePx).toBeGreaterThanOrEqual(secondary.fontSizePx);
    }
  });

  it('does not let the overshoot pigment change the line box', () => {
    // The detail line swaps colour past target. If that also changed its height
    // the readout would shift the moment a day crossed its target.
    for (const radius of RADII) {
      expect(gaugeCalorieLines(CALORIE, radius, true).tertiary.heightPx).toBe(
        gaugeCalorieLines(CALORIE, radius).tertiary.heightPx
      );
      expect(
        gaugeCalorieLines(CALORIE, radius, true).tertiary.className
      ).toContain('text-kallo-danger');
    }
  });

  it('grows every line with the mark', () => {
    const small = gaugeCalorieLines(CALORIE, 28);
    const large = gaugeCalorieLines(CALORIE, 104);
    expect(large.primary.fontSizePx).toBeGreaterThan(small.primary.fontSizePx);
    expect(large.secondary.fontSizePx).toBeGreaterThan(
      small.secondary.fontSizePx
    );
  });
});
