import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RRF_FLAG_KEY,
  RRF_RATE_KEY,
  shouldSampleForRrf,
} from '../rrf-sampling';

describe('shouldSampleForRrf deterministic request sampling', () => {
  beforeEach(() => {
    vi.stubEnv(RRF_FLAG_KEY, 'true');
    vi.stubEnv(RRF_RATE_KEY, '0.05');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns false when the flag is off', () => {
    vi.stubEnv(RRF_FLAG_KEY, 'false');
    vi.stubEnv(RRF_RATE_KEY, '1.0');

    expect(shouldSampleForRrf('req_abc')).toBe(false);
  });

  it('returns true at rate 1.0', () => {
    vi.stubEnv(RRF_RATE_KEY, '1.0');

    expect(shouldSampleForRrf('req_abc')).toBe(true);
    expect(shouldSampleForRrf('req_xyz')).toBe(true);
  });

  it('returns false at rate 0.0', () => {
    vi.stubEnv(RRF_RATE_KEY, '0.0');

    expect(shouldSampleForRrf('req_abc')).toBe(false);
  });

  it('is deterministic per requestId', () => {
    const first = shouldSampleForRrf('req_stable');
    const second = shouldSampleForRrf('req_stable');
    const third = shouldSampleForRrf('req_stable');

    expect(first).toBe(second);
    expect(second).toBe(third);
  });

  it('produces approximately the configured rate over a large sample', () => {
    vi.stubEnv(RRF_RATE_KEY, '0.05');
    let hits = 0;
    const sampleCount = 10_000;

    for (let i = 0; i < sampleCount; i++) {
      if (shouldSampleForRrf(`req_${i}`)) hits++;
    }

    const observedRate = hits / sampleCount;
    expect(observedRate).toBeGreaterThan(0.035);
    expect(observedRate).toBeLessThan(0.065);
  });

  it('rejects malformed sample rates', () => {
    vi.stubEnv(RRF_RATE_KEY, 'not-a-number');

    expect(shouldSampleForRrf('req_abc')).toBe(false);
  });

  it('clamps sample rates outside [0, 1]', () => {
    vi.stubEnv(RRF_RATE_KEY, '1.5');
    expect(shouldSampleForRrf('req_abc')).toBe(true);

    vi.stubEnv(RRF_RATE_KEY, '-0.1');
    expect(shouldSampleForRrf('req_abc')).toBe(false);
  });
});
