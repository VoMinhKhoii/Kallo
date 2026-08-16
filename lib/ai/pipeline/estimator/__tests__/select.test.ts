import { describe, expect, it } from 'vitest';
import { createMockGemini } from '@/lib/ai/__tests__/test-helpers';
import {
  ESTIMATOR_NAMES,
  ESTIMATOR_PRICING,
  estimatorCostUsd,
  isEstimatorName,
  selectEstimator,
} from '../select';

// ---------------------------------------------------------------------------
// D3: selector + pricing table for the bakeoff harness
// ---------------------------------------------------------------------------

describe('selectEstimator + pricing', () => {
  it('selects the Gemini adapter for "gemini" and the stubs for the others', () => {
    const gemini = createMockGemini({});
    const deps = { gemini, geminiModel: 'gemini-3-flash' };
    expect(selectEstimator('gemini', deps).id).toBe('gemini');
    expect(selectEstimator('claude', deps).id).toBe('claude');
    expect(selectEstimator('openai', deps).id).toBe('openai');
  });

  it('isEstimatorName validates the CLI flag values', () => {
    expect(isEstimatorName('gemini')).toBe(true);
    expect(isEstimatorName('claude')).toBe(true);
    expect(isEstimatorName('bogus')).toBe(false);
    for (const name of ESTIMATOR_NAMES)
      expect(isEstimatorName(name)).toBe(true);
  });

  it('has a pricing entry for every estimator and computes token cost', () => {
    for (const name of ESTIMATOR_NAMES) {
      const p = ESTIMATOR_PRICING[name];
      expect(p.inputPerMTokUsd).toBeGreaterThan(0);
      expect(p.outputPerMTokUsd).toBeGreaterThan(0);
    }
    // 1M input + 1M output tokens for gemini = input rate + output rate.
    const cost = estimatorCostUsd('gemini', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(
      ESTIMATOR_PRICING.gemini.inputPerMTokUsd +
        ESTIMATOR_PRICING.gemini.outputPerMTokUsd,
      6
    );
  });
});
