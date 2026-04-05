import { describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/errors';
import { withRetry } from '@/lib/retry';

describe('withRetry', () => {
  it('returns on first success without retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries and succeeds on second attempt', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce('recovered');

    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('exhausts all retries and throws last error', async () => {
    const err = new Error('persistent');
    const fn = vi.fn().mockRejectedValue(err);

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toBe(err);
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('does not retry non-retriable AppError', async () => {
    const fn = vi.fn().mockRejectedValue(Errors.notAuthenticated());

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 1 })
    ).rejects.toMatchObject({ code: 'NOT_AUTHENTICATED' });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('retries retriable AppError', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(Errors.pipelineTimeout())
      .mockResolvedValueOnce('ok');

    const result = await withRetry(fn, { baseDelayMs: 1 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('respects custom isRetriable', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('custom'))
      .mockResolvedValueOnce('ok');

    // Never retry
    await expect(
      withRetry(fn, {
        maxAttempts: 3,
        baseDelayMs: 1,
        isRetriable: () => false,
      })
    ).rejects.toThrow('custom');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('respects maxAttempts=1 (no retries)', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(
      withRetry(fn, { maxAttempts: 1, baseDelayMs: 1 })
    ).rejects.toThrow('fail');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('applies exponential backoff with jitter between retries', async () => {
    // Fix jitter: delay = base * 2^(attempt-1) * (0.5 + 0.5) = base * 2^(attempt-1)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const callTimes: number[] = [];
    const fn = vi.fn().mockImplementation(async () => {
      callTimes.push(performance.now());
      if (fn.mock.calls.length < 3) throw new Error('fail');
      return 'ok';
    });

    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 50 });

    expect(fn).toHaveBeenCalledTimes(3);

    const delay1 = callTimes[1] - callTimes[0]; // ~50ms (50 * 2^0 * 1.0)
    const delay2 = callTimes[2] - callTimes[1]; // ~100ms (50 * 2^1 * 1.0)

    // Verify delays are roughly correct (allow margin for event loop)
    expect(delay1).toBeGreaterThanOrEqual(30);
    expect(delay1).toBeLessThan(120);
    expect(delay2).toBeGreaterThanOrEqual(70);
    expect(delay2).toBeLessThan(200);
    // Second delay should be ~2x first (exponential)
    expect(delay2).toBeGreaterThan(delay1 * 1.3);

    vi.restoreAllMocks();
  });
});
