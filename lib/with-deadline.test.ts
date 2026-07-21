import { afterEach, describe, expect, it, vi } from 'vitest';
import { withDeadline } from './with-deadline';

describe('withDeadline', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves with the value when the promise settles before the deadline', async () => {
    await expect(withDeadline(Promise.resolve('ok'), 1000)).resolves.toBe('ok');
  });

  it('propagates a real rejection unchanged (does not mask it as a timeout)', async () => {
    const boom = new Error('boom');
    await expect(withDeadline(Promise.reject(boom), 1000)).rejects.toBe(boom);
  });

  it('rejects with PIPELINE_TIMEOUT when the promise stalls past the deadline', async () => {
    vi.useFakeTimers();
    const stalled = new Promise<string>(() => {
      // never settles — simulates a wedged postgres.js query
    });

    const pending = withDeadline(stalled, 1000);
    const assertion = expect(pending).rejects.toMatchObject({
      code: 'PIPELINE_TIMEOUT',
      retryable: true,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it('uses a custom onTimeout error when provided', async () => {
    vi.useFakeTimers();
    const stalled = new Promise<string>(() => {});
    const custom = new Error('custom-timeout');

    const pending = withDeadline(stalled, 500, () => custom);
    const assertion = expect(pending).rejects.toBe(custom);

    await vi.advanceTimersByTimeAsync(500);
    await assertion;
  });
});
