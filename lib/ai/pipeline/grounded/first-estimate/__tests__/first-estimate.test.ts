import { describe, expect, it, vi } from 'vitest';
import {
  isFirstEstimateEnabled,
  renderFirstEstimate,
  startFirstEstimate,
} from '@/lib/ai/pipeline/grounded/first-estimate/first-estimate';
import type { GeminiClient } from '@/lib/ai/provider/provider';

const llm = (generateStructuredOutput: unknown) =>
  ({ generateStructuredOutput }) as unknown as GeminiClient;
const estimate = {
  foods: [{ name: 'Phở bò', grams: 650.4, kcal: 520.2 }],
  totalKcal: 520.2,
};
const start = (gemini: GeminiClient) =>
  startFirstEstimate({ gemini, model: 'm', mealText: '1 tô phở' });

describe('isFirstEstimateEnabled', () => {
  it('is off until a deploy turns it on', () => {
    expect(isFirstEstimateEnabled({})).toBe(false);
    expect(isFirstEstimateEnabled({ FIRST_ESTIMATE_ENABLED: 'true' })).toBe(
      true
    );
  });
});

describe('renderFirstEstimate', () => {
  it('writes one line per food and the total', () => {
    expect(renderFirstEstimate(estimate)).toBe(
      '- Phở bò: 650 g, 520 kcal\nTotal about 520 kcal.'
    );
  });
});

describe('startFirstEstimate', () => {
  it('returns the rendered estimate', async () => {
    const gemini = llm(vi.fn(async () => estimate));
    expect(await start(gemini).settle()).toContain('Phở bò: 650 g');
  });

  it('asks from the meal text alone, and meters the call', async () => {
    const call = vi.fn(async () => estimate);
    const onAttemptComplete = vi.fn();
    await startFirstEstimate({
      gemini: llm(call),
      model: 'm',
      mealText: '1 tô phở',
      onAttemptComplete,
    }).settle();
    const [params, opts] = call.mock.calls[0] as unknown as [
      { userMessage: string },
      unknown,
    ];
    expect(params.userMessage).toContain('1 tô phở');
    expect(opts).toEqual({ onAttemptComplete });
  });

  it('gives Call 2 nothing when the call fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const gemini = llm(
      vi.fn(async () => {
        throw new Error('overloaded');
      })
    );
    expect(await start(gemini).settle()).toBeUndefined();
  });

  it('gives Call 2 nothing for an answer with no foods', async () => {
    const gemini = llm(vi.fn(async () => ({ foods: [], totalKcal: 0 })));
    expect(await start(gemini).settle()).toBeUndefined();
  });

  it('stops waiting for a late estimate and cancels it', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const gemini = llm(
      vi.fn((p: { abortSignal: AbortSignal }) => {
        signal = p.abortSignal;
        return new Promise(() => {});
      })
    );
    const out = start(gemini).settle();
    await vi.advanceTimersByTimeAsync(1_500);
    expect(await out).toBeUndefined();
    expect(signal?.aborted).toBe(true);
    vi.useRealTimers();
  });
});
