// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAsyncAction } from './use-async-action';

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: { error: (...args: unknown[]) => toastError(...args) },
}));

const OPTS = { logLabel: 'failed:', errorMessage: 'oops' };

beforeEach(() => {
  toastError.mockClear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useAsyncAction', () => {
  it('flips pending during the action and resets it on success', async () => {
    const { result } = renderHook(() => useAsyncAction());
    expect(result.current.pending).toBe(false);

    let resolve: () => void = () => {};
    const action = () => new Promise<void>((r) => (resolve = r));

    let runPromise!: Promise<void>;
    act(() => {
      runPromise = result.current.run(action, OPTS);
    });
    expect(result.current.pending).toBe(true);

    await act(async () => {
      resolve();
      await runPromise;
    });
    expect(result.current.pending).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('keeps pending after success when keepPendingOnSuccess is set', async () => {
    const { result } = renderHook(() => useAsyncAction());
    await act(async () => {
      await result.current.run(async () => {}, {
        ...OPTS,
        keepPendingOnSuccess: true,
      });
    });
    expect(result.current.pending).toBe(true);
  });

  it('resets pending and toasts on failure', async () => {
    const { result } = renderHook(() => useAsyncAction());
    await act(async () => {
      await result.current.run(async () => {
        throw new Error('boom');
      }, OPTS);
    });
    expect(result.current.pending).toBe(false);
    expect(toastError).toHaveBeenCalledWith('oops');
    expect(console.error).toHaveBeenCalled();
  });

  it('ignores re-entry while an action is in flight', async () => {
    const { result } = renderHook(() => useAsyncAction());
    const action = vi.fn(() => new Promise<void>((r) => setTimeout(r, 0)));

    await act(async () => {
      const first = result.current.run(action, OPTS);
      const second = result.current.run(action, OPTS); // should no-op
      await Promise.all([first, second]);
    });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
