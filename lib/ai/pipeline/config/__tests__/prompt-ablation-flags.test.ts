import { describe, expect, it } from 'vitest';
import { isVesselGuardEnabled } from '../prompt-ablation-flags';

describe('prompt ablation flags', () => {
  it('keeps the vessel guard on by default and lets it be switched off', () => {
    expect(isVesselGuardEnabled({})).toBe(true);
    expect(isVesselGuardEnabled({ VESSEL_GUARD: 'off' })).toBe(false);
  });
});
