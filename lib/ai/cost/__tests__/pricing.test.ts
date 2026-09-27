import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODEL_RATES } from '../pricing';

describe('MODEL_RATES', () => {
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
