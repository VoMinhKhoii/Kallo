import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { GRACE_MS, startPlainRead, usableReadKcal } from '../plain-read';
import { PLAIN_READ_MODEL } from '../prompt';

const read = (totalKcal: number, foods: number[] = [totalKcal]) => ({
  totalKcal,
  foods: foods.map((kcal, i) => ({
    name: `f${i}`,
    pieces: 1,
    gramsEach: 100,
    grams: 100,
    kcal,
  })),
});

function client(impl: GeminiClient['generateStructuredOutput']): GeminiClient {
  return { generateStructuredOutput: impl } as unknown as GeminiClient;
}

const live = () => new AbortController().signal;

afterEach(() => {
  vi.useRealTimers();
});

describe('usableReadKcal', () => {
  it('keeps a sane total', () => {
    expect(usableReadKcal(read(520, [300, 220]))).toBe(520);
  });

  it('rejects a total outside the meal range', () => {
    expect(usableReadKcal(read(0, []))).toBeNull();
    expect(usableReadKcal(read(50_000))).toBeNull();
  });

  it('rejects a total with no foods behind it', () => {
    expect(usableReadKcal(read(1000, []))).toBeNull();
  });

  it('rejects a total its own foods do not add up to', () => {
    expect(usableReadKcal(read(900, [200, 150]))).toBeNull();
  });
});

describe('startPlainRead', () => {
  it('asks the plain-read model with the meal text as data', async () => {
    const call = vi.fn().mockResolvedValue(read(640));
    const r = startPlainRead({
      gemini: client(call),
      signal: live(),
      mealText: '1 tô phở bò',
    });

    await expect(r.settle()).resolves.toMatchObject({ totalKcal: 640 });
    const params = call.mock.calls[0][0];
    expect(params.model).toBe(PLAIN_READ_MODEL);
    expect(params.userMessage).toContain('1 tô phở bò');
    expect(params.abortSignal.aborted).toBe(true);
  });

  it('returns null and aborts when the read misses the grace window', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const call = vi.fn((params: { abortSignal: AbortSignal }) => {
      signal = params.abortSignal;
      return new Promise(() => {});
    });
    const r = startPlainRead({
      gemini: client(
        call as unknown as GeminiClient['generateStructuredOutput']
      ),
      signal: live(),
      mealText: 'cơm tấm',
    });

    const settled = r.settle();
    await vi.advanceTimersByTimeAsync(GRACE_MS);
    await expect(settled).resolves.toBeNull();
    expect(signal?.aborted).toBe(true);
  });

  it('returns null when the client throws before returning a promise', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const call = vi.fn(() => {
      throw new TypeError('not a function');
    });
    const r = startPlainRead({
      gemini: client(
        call as unknown as GeminiClient['generateStructuredOutput']
      ),
      signal: live(),
      mealText: 'xôi gà',
    });

    await expect(r.settle()).resolves.toBeNull();
  });

  it('cancels the read and settles at once when the client hangs up', async () => {
    let readSignal: AbortSignal | undefined;
    const call = vi.fn((params: { abortSignal: AbortSignal }) => {
      readSignal = params.abortSignal;
      return new Promise(() => {});
    });
    const request = new AbortController();
    const r = startPlainRead({
      gemini: client(
        call as unknown as GeminiClient['generateStructuredOutput']
      ),
      signal: request.signal,
      mealText: 'bún chả',
    });
    await Promise.resolve();

    const settled = r.settle();
    request.abort();
    await expect(settled).resolves.toBeNull();
    expect(readSignal?.aborted).toBe(true);
  });

  it('returns null when the read fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const call = vi.fn().mockRejectedValue(new Error('overloaded'));
    const r = startPlainRead({
      gemini: client(call),
      signal: live(),
      mealText: 'bánh mì',
    });

    await expect(r.settle()).resolves.toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});
