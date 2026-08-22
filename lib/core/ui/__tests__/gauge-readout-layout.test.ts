import { describe, expect, it } from 'vitest';
import { gaugeTipOffset } from '@/lib/core/ui/gauge-arc-geometry';
import {
  GAUGE_LINE_GAP,
  gaugeReadoutLayout,
} from '@/lib/core/ui/gauge-readout-layout';

/** Where the second line's middle lands, given a layout and its lines. */
function secondLineMiddle(
  layout: { readoutTop: number },
  [primary, secondary]: number[]
): number {
  return layout.readoutTop + primary + GAUGE_LINE_GAP + secondary / 2;
}

describe('gaugeReadoutLayout', () => {
  it('centres the second line on the arc tips', () => {
    const lines = [44, 20, 16];
    const layout = gaugeReadoutLayout(104, lines);

    expect(secondLineMiddle(layout, lines) - layout.arcTop).toBeCloseTo(
      104 + gaugeTipOffset(104),
      5
    );
  });

  it('holds that rule at every size the app draws', () => {
    for (const radius of [104, 52, 44, 30]) {
      const lines = [20, 16];
      const layout = gaugeReadoutLayout(radius, lines);

      expect(secondLineMiddle(layout, lines) - layout.arcTop).toBeCloseTo(
        radius + gaugeTipOffset(radius),
        5
      );
    }
  });

  it('reserves room for a line that hangs below the arc', () => {
    // gaugeHeight(104) is 169; the readout runs to 100 + 44 + 2 + 20 + 2 + 16.
    expect(gaugeReadoutLayout(104, [44, 20, 16])).toMatchObject({
      arcTop: 0,
      readoutTop: 100,
      height: 184,
    });
  });

  it('drops the arc instead of starting the readout above the box', () => {
    // A macro dial shrunk to fit a narrow row, at a raised text size: the two
    // lines together are taller than the space over the tip line. Flutter hit
    // this first, as a negative SizedBox at radius ~19.
    const lines = [24, 20];
    const layout = gaugeReadoutLayout(19, lines);

    expect(layout.readoutTop).toBe(0);
    expect(layout.arcTop).toBeGreaterThan(0);
    // The rule still holds; the whole dial just sits lower in a taller box.
    expect(secondLineMiddle(layout, lines) - layout.arcTop).toBeCloseTo(
      19 + gaugeTipOffset(19),
      5
    );
  });
});
