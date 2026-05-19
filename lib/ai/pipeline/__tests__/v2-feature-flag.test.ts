import { describe, expect, it } from 'vitest';
import {
  isPipelineV2Enabled,
  isPipelineV2ShadowEnabled,
} from '../v2-feature-flag';

describe('isPipelineV2Enabled', () => {
  it('defaults to true (v2 is the production default)', () => {
    expect(isPipelineV2Enabled({})).toBe(true);
  });

  it('honors truthy values', () => {
    expect(isPipelineV2Enabled({ PIPELINE_V2_ENABLED: 'true' })).toBe(true);
    expect(isPipelineV2Enabled({ PIPELINE_V2_ENABLED: '1' })).toBe(true);
    expect(isPipelineV2Enabled({ PIPELINE_V2_ENABLED: 'on' })).toBe(true);
  });

  it('honors falsy values explicitly (v1 fallback)', () => {
    expect(isPipelineV2Enabled({ PIPELINE_V2_ENABLED: 'false' })).toBe(false);
    expect(isPipelineV2Enabled({ PIPELINE_V2_ENABLED: '0' })).toBe(false);
  });

  it('falls back to the default (true) on unknown values', () => {
    expect(isPipelineV2Enabled({ PIPELINE_V2_ENABLED: 'garbage' })).toBe(true);
  });
});

describe('isPipelineV2ShadowEnabled', () => {
  it('defaults to false and toggles independently of the master flag', () => {
    expect(isPipelineV2ShadowEnabled({})).toBe(false);
    expect(
      isPipelineV2ShadowEnabled({
        PIPELINE_V2_ENABLED: 'true',
      })
    ).toBe(false);
    expect(
      isPipelineV2ShadowEnabled({
        PIPELINE_V2_SHADOW: 'true',
      })
    ).toBe(true);
  });
});
