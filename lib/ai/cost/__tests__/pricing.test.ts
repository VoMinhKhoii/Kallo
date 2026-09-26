import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { costUsd, MODEL_RATES, type TokenUsage } from '../pricing';

const usage = (
  u: Pick<TokenUsage, 'model'> & Partial<TokenUsage>
): TokenUsage => ({
  inputTokens: null,
  outputTokens: null,
  cachedTokens: null,
  thoughtTokens: null,
  ...u,
});

describe('costUsd', () => {
  it('bills uncached input, cached input and output at their own rates', () => {
    // flash-lite: $0.25 in, $0.025 cached, $1.50 out per 1M.
    const usd = costUsd(
      usage({
        model: 'gemini-3.1-flash-lite',
        inputTokens: 1_000_000,
        cachedTokens: 400_000,
        outputTokens: 100_000,
      })
    );
    expect(usd).toBeCloseTo(0.6 * 0.25 + 0.4 * 0.025 + 0.1 * 1.5, 9);
  });

  it('bills thinking tokens at the output rate on top of visible output', () => {
    const withThinking = costUsd(
      usage({
        model: 'gemini-3.1-flash-lite',
        inputTokens: 0,
        outputTokens: 1000,
        thoughtTokens: 3000,
      })
    );
    expect(withThinking).toBeCloseTo((4000 * 1.5) / 1_000_000, 12);
  });

  it('matches the measured prod meal (13.1k in, 990 out) at about half a cent', () => {
    const usd = costUsd(
      usage({
        model: 'gemini-3.1-flash-lite',
        inputTokens: 13_082,
        outputTokens: 989,
      })
    );
    expect(usd).toBeCloseTo(0.0047539, 6);
  });

  it('never bills more cached tokens than input tokens', () => {
    const usd = costUsd(
      usage({
        model: 'gemini-3.1-flash-lite',
        inputTokens: 100,
        cachedTokens: 500,
        outputTokens: 0,
      })
    );
    expect(usd).toBeCloseTo((100 * 0.025) / 1_000_000, 12);
  });

  it('returns null for a model with no rate rather than pricing it at zero', () => {
    expect(
      costUsd(
        usage({ model: 'unknown-model', inputTokens: 10, outputTokens: 10 })
      )
    ).toBeNull();
  });

  it('keeps cached input cheaper than input for every model', () => {
    for (const rate of Object.values(MODEL_RATES)) {
      expect(rate.cachedInputPerMTokUsd).toBeLessThan(rate.inputPerMTokUsd);
    }
  });
});

describe('scripts/bench/ai-cost.sql rate mirror', () => {
  // The dashboard query repeats the rate card inline (psql cannot import TS).
  // This keeps the copies from drifting: every rates CTE must list exactly the
  // models on the card, at the card's prices.
  const sql = readFileSync('scripts/bench/ai-cost.sql', 'utf8');
  const row = /\('([^']+)', ([\d.]+), ([\d.]+), ([\d.]+)\)/g;
  const blocks = sql
    .split('rates(model, input_rate, cached_rate, output_rate)')
    .slice(1);

  it('has at least one rates block', () => {
    expect(blocks.length).toBeGreaterThan(0);
  });

  it.each(
    blocks.map((block, i) => [i, block] as const)
  )('rates block %i matches MODEL_RATES', (_i, block) => {
    const values = block.slice(0, block.indexOf(')),') + 2);
    const parsed = Object.fromEntries(
      [...values.matchAll(row)].map(([, model, input, cached, output]) => [
        model,
        {
          inputPerMTokUsd: Number(input),
          cachedInputPerMTokUsd: Number(cached),
          outputPerMTokUsd: Number(output),
        },
      ])
    );
    expect(parsed).toEqual(MODEL_RATES);
  });
});
