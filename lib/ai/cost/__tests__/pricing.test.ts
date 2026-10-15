import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { attemptCostUsd, MODEL_RATES } from '../pricing';

describe('MODEL_RATES', () => {
  it('keeps cached input cheaper than input for every model', () => {
    for (const rate of Object.values(MODEL_RATES)) {
      expect(rate.cachedInputPerMTokUsd).toBeLessThan(rate.inputPerMTokUsd);
    }
  });
});

describe('attemptCostUsd', () => {
  const none = {
    inputTokens: 0,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    thoughtTokens: 0,
  };

  it('bills fresh input, cached input, output and thinking at their rates', () => {
    // gemini-3.1-flash-lite: 0.25 in, 0.025 cached, 1.50 out per 1M tokens.
    const usd = attemptCostUsd('gemini-3.1-flash-lite', {
      ...none,
      inputTokens: 10_000,
      cachedTokens: 4_000,
      outputTokens: 1_000,
      thoughtTokens: 500,
    });
    // 6000*0.25 + 4000*0.025 + 1500*1.5 = 1500 + 100 + 2250 = 3850 per 1M.
    expect(usd).toBeCloseTo(0.00385, 10);
  });

  it('bills Claude cache writes at 1.25x input', () => {
    // claude-haiku-5-5: 0.10 in, 0.01 cached, 0.50 out per 1M tokens.
    const usd = attemptCostUsd('claude-haiku-5-5', {
      ...none,
      inputTokens: 5_000,
      cachedTokens: 1_000,
      cacheWriteTokens: 3_000,
      outputTokens: 400,
    });
    // 1000*0.10 + 1000*0.01 + 3000*0.125 + 400*0.50 = 100 + 10 + 375 + 200.
    expect(usd).toBeCloseTo(0.000685, 10);
  });

  it('prices a model missing from the card as null, never zero', () => {
    expect(
      attemptCostUsd('gpt-unknown', { ...none, inputTokens: 1 })
    ).toBeNull();
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
