import { describe, expect, it } from 'vitest';
import { isPortionVesselEnabled } from '../portion-vessel-flag';

describe('isPortionVesselEnabled', () => {
  it('defaults on and accepts an explicit off override', () => {
    expect(isPortionVesselEnabled({})).toBe(true);
    expect(isPortionVesselEnabled({ PORTION_VESSEL_ENABLED: 'false' })).toBe(
      false
    );
  });
});
