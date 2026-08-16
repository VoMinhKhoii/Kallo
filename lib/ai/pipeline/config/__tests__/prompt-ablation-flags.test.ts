import { describe, expect, it } from 'vitest';
import {
  isPromptSizingHintsEnabled,
  isProteinPortionDefaultEnabled,
  isVesselGuardEnabled,
} from '../prompt-ablation-flags';

describe('prompt ablation flags', () => {
  it('preserves production defaults and toggles independently', () => {
    expect(isProteinPortionDefaultEnabled({})).toBe(true);
    expect(isPromptSizingHintsEnabled({})).toBe(true);
    expect(isVesselGuardEnabled({})).toBe(true);
    expect(
      isProteinPortionDefaultEnabled({ PROTEIN_PORTION_DEFAULT: 'off' })
    ).toBe(false);
    expect(isPromptSizingHintsEnabled({ PROMPT_SIZING_HINTS: 'off' })).toBe(
      false
    );
    expect(isVesselGuardEnabled({ VESSEL_GUARD: 'off' })).toBe(false);
  });
});
