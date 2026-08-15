import { describe, expect, it } from 'vitest';
import { readBooleanEnv } from '../config/feature-flags';
import { isPortionVesselEnabled } from '../config/portion-vessel-flag';
import {
  isPromptSizingHintsEnabled,
  isProteinPortionDefaultEnabled,
  isVesselGuardEnabled,
} from '../config/prompt-ablation-flags';

describe('readBooleanEnv', () => {
  it('falls back to default when the env var is unset', () => {
    expect(readBooleanEnv('SOME_FLAG', true, {})).toBe(true);
    expect(readBooleanEnv('SOME_FLAG', false, {})).toBe(false);
  });

  it('falls back to default when the env var is empty', () => {
    expect(readBooleanEnv('SOME_FLAG', true, { SOME_FLAG: '' })).toBe(true);
    expect(readBooleanEnv('SOME_FLAG', false, { SOME_FLAG: '   ' })).toBe(
      false
    );
  });

  it.each([
    ['true', true],
    ['1', true],
    ['on', true],
    ['yes', true],
    ['enabled', true],
    ['enable', true],
    ['TRUE', true],
    ['  on  ', true],
  ])('parses %s as true', (input, expected) => {
    expect(readBooleanEnv('SOME_FLAG', false, { SOME_FLAG: input })).toBe(
      expected
    );
  });

  it.each([
    ['false', false],
    ['0', false],
    ['off', false],
    ['no', false],
    ['disabled', false],
    ['disable', false],
    ['FALSE', false],
    ['  off  ', false],
  ])('parses %s as false', (input, expected) => {
    expect(readBooleanEnv('SOME_FLAG', true, { SOME_FLAG: input })).toBe(
      expected
    );
  });

  it('falls back to default for unrecognized values rather than guessing', () => {
    expect(readBooleanEnv('SOME_FLAG', true, { SOME_FLAG: 'maybe' })).toBe(
      true
    );
    expect(readBooleanEnv('SOME_FLAG', false, { SOME_FLAG: 'sometimes' })).toBe(
      false
    );
  });

  it('reads from process.env by default', () => {
    const original = process.env.PIPELINE_TEST_FLAG;
    try {
      process.env.PIPELINE_TEST_FLAG = 'off';
      expect(readBooleanEnv('PIPELINE_TEST_FLAG', true)).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.PIPELINE_TEST_FLAG;
      } else {
        process.env.PIPELINE_TEST_FLAG = original;
      }
    }
  });
});

describe('isPortionVesselEnabled', () => {
  it('defaults on and accepts an explicit off override', () => {
    expect(isPortionVesselEnabled({})).toBe(true);
    expect(isPortionVesselEnabled({ PORTION_VESSEL_ENABLED: 'false' })).toBe(
      false
    );
  });
});

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
