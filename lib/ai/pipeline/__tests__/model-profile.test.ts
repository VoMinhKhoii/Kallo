import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ModelProfile,
  NEXT_PROFILE,
  resolveModelProfile,
  STABLE_PROFILE,
} from '../config/model-profile';

describe('resolveModelProfile', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.PIPELINE_MODEL_PROFILE;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.PIPELINE_MODEL_PROFILE;
    } else {
      process.env.PIPELINE_MODEL_PROFILE = saved;
    }
  });

  it('returns STABLE_PROFILE when env is unset', () => {
    delete process.env.PIPELINE_MODEL_PROFILE;

    expect(resolveModelProfile()).toEqual(STABLE_PROFILE);
  });

  it('returns STABLE_PROFILE for "stable"', () => {
    process.env.PIPELINE_MODEL_PROFILE = 'stable';

    expect(resolveModelProfile()).toEqual(STABLE_PROFILE);
  });

  it('returns NEXT_PROFILE for "next"', () => {
    process.env.PIPELINE_MODEL_PROFILE = 'next';

    expect(resolveModelProfile()).toEqual(NEXT_PROFILE);
  });

  it('falls back to STABLE_PROFILE for unknown values', () => {
    process.env.PIPELINE_MODEL_PROFILE = 'experimental-rollout-v9';

    expect(resolveModelProfile()).toEqual(STABLE_PROFILE);
  });

  it('STABLE_PROFILE matches today’s production constants exactly', () => {
    expect(STABLE_PROFILE).toEqual({
      decompositionModel: 'gemini-3.1-flash-lite',
      nutritionModel: 'gemini-3.1-flash-lite',
      escalationModel: null,
    } satisfies ModelProfile);
  });

  it('NEXT_PROFILE introduces an escalation model', () => {
    expect(NEXT_PROFILE.escalationModel).not.toBeNull();
  });

  // Phase 4 (D1): Call-2 A/B candidate.
  it('NEXT_PROFILE moves Call 2 to gemini-3-flash-preview while Call 1 stays flash-lite', () => {
    expect(NEXT_PROFILE.nutritionModel).toBe('gemini-3-flash-preview');
    expect(NEXT_PROFILE.decompositionModel).toBe('gemini-3.1-flash-lite');
    expect(NEXT_PROFILE.escalationModel).toBe('gemini-3-flash-preview');
  });

  it('deployed default is UNCHANGED — resolveModelProfile still returns stable when env is unset', () => {
    // The Phase-4 flip is an ops decision via PIPELINE_MODEL_PROFILE, NOT a
    // code default. Default resolution must stay entirely on flash-lite.
    delete process.env.PIPELINE_MODEL_PROFILE;
    const resolved = resolveModelProfile();
    expect(resolved.nutritionModel).toBe('gemini-3.1-flash-lite');
    expect(resolved).toEqual(STABLE_PROFILE);
  });
});
