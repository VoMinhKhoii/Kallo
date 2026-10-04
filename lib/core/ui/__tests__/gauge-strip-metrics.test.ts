import { describe, expect, it } from 'vitest';
import { DOCK_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
import {
  sizeAtCap,
  sizeStrip,
  stripHeight,
} from '@/lib/core/ui/gauge-strip-metrics';

describe('sizeStrip', () => {
  it('keeps one line where the four marks fit', () => {
    expect(sizeStrip(460, DOCK_MACRO_CAP).stacked).toBe(false);
  });

  it('stacks when asked even though one line fits', () => {
    expect(sizeStrip(460, DOCK_MACRO_CAP, true).stacked).toBe(true);
  });

  it('still stacks a column too narrow for one line', () => {
    expect(sizeStrip(120, DOCK_MACRO_CAP).stacked).toBe(true);
  });

  it('reserves at least the stacked height a phone column settles into', () => {
    // An unmeasured phone dashboard must not reserve the one-row height and
    // then grow by ~110px when the stacked dial lands.
    const reserved = stripHeight(sizeAtCap(DOCK_MACRO_CAP, true));
    for (const width of [318, 358, 398]) {
      expect(reserved).toBeGreaterThanOrEqual(
        stripHeight(sizeStrip(width, DOCK_MACRO_CAP, true))
      );
    }
    expect(reserved).toBeGreaterThan(stripHeight(sizeAtCap(DOCK_MACRO_CAP)));
  });
});
