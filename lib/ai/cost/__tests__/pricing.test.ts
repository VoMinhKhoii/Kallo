import { describe, expect, it } from 'vitest';
import { costUsd, MODEL_RATES } from '../pricing';

describe('costUsd', () => {
  it('bills uncached input, cached input and output at their own rates', () => {
    // flash-lite: $0.25 in, $0.025 cached, $1.50 out per 1M.
    const usd = costUsd({
      model: 'gemini-3.1-flash-lite',
      inputTokens: 1_000_000,
      cachedTokens: 400_000,
      outputTokens: 100_000,
    });
    expect(usd).toBeCloseTo(0.6 * 0.25 + 0.4 * 0.025 + 0.1 * 1.5, 9);
  });

  it('bills thinking tokens at the output rate on top of visible output', () => {
    const withThinking = costUsd({
      model: 'gemini-3.1-flash-lite',
      inputTokens: 0,
      outputTokens: 1000,
      thoughtTokens: 3000,
    });
    expect(withThinking).toBeCloseTo((4000 * 1.5) / 1_000_000, 12);
  });

  it('matches the measured prod meal (13.1k in, 990 out) at about half a cent', () => {
    const usd = costUsd({
      model: 'gemini-3.1-flash-lite',
      inputTokens: 13_082,
      outputTokens: 989,
    });
    expect(usd).toBeCloseTo(0.0047539, 6);
  });

  it('never bills more cached tokens than input tokens', () => {
    const usd = costUsd({
      model: 'gemini-3.1-flash-lite',
      inputTokens: 100,
      cachedTokens: 500,
      outputTokens: 0,
    });
    expect(usd).toBeCloseTo((100 * 0.025) / 1_000_000, 12);
  });

  it('returns null for a model with no rate rather than pricing it at zero', () => {
    expect(
      costUsd({ model: 'unknown-model', inputTokens: 10, outputTokens: 10 })
    ).toBeNull();
  });

  it('keeps cached input cheaper than input for every model', () => {
    for (const rate of Object.values(MODEL_RATES)) {
      expect(rate.cachedInputPerMTokUsd).toBeLessThan(rate.inputPerMTokUsd);
    }
  });
});
