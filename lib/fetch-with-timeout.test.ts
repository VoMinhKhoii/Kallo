import { describe, expect, it } from 'vitest';
import { AppError } from '@/lib/errors';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

describe('fetchWithTimeout', () => {
  it('resolves when fn completes before timeout', async () => {
    const result = await fetchWithTimeout(async () => 'ok', 5000, 'test-fast');
    expect(result).toBe('ok');
  });

  it('passes AbortSignal to fn', async () => {
    let receivedSignal: AbortSignal | undefined;
    await fetchWithTimeout(
      async (signal) => {
        receivedSignal = signal;
        return 'done';
      },
      5000,
      'test-signal'
    );
    expect(receivedSignal).toBeInstanceOf(AbortSignal);
    expect(receivedSignal?.aborted).toBe(false);
  });

  it('throws PIPELINE_TIMEOUT on timeout', async () => {
    const promise = fetchWithTimeout(
      async (signal) =>
        new Promise((_resolve, reject) => {
          const timer = setTimeout(() => _resolve('late'), 5000);
          signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          });
        }),
      50,
      'test-slow'
    );

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({ code: 'PIPELINE_TIMEOUT' });
  });

  it('throws PIPELINE_TIMEOUT even when fn ignores AbortSignal', async () => {
    const startedAt = Date.now();
    const promise = fetchWithTimeout(
      async () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('late'), 5000);
        }),
      50,
      'test-non-abort-aware'
    );

    await expect(promise).rejects.toThrow(AppError);
    await expect(promise).rejects.toMatchObject({ code: 'PIPELINE_TIMEOUT' });
    expect(Date.now() - startedAt).toBeLessThan(1000);
  });

  it('propagates non-abort errors as-is', async () => {
    const original = new Error('network failure');
    await expect(
      fetchWithTimeout(
        async () => {
          throw original;
        },
        5000,
        'test-error'
      )
    ).rejects.toBe(original);
  });
});
