import { describe, expect, it } from 'vitest';
import { DOCK_MACRO_CAP } from '@/lib/core/ui/gauge-strip-layout';
import { sizeStrip } from '@/lib/core/ui/gauge-strip-metrics';

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
});
