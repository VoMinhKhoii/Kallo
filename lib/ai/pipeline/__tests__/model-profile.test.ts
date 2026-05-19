import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type ModelProfile,
  NEXT_PROFILE,
  resolveModelProfile,
  STABLE_PROFILE,
} from '../model-profile';

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
});
