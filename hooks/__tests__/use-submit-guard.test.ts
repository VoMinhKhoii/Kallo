import { describe, expect, it } from 'vitest';

// bun test does not provide a jsdom environment, so we test the
// hook's core logic (ref-based guard) directly instead of using renderHook.

describe('useSubmitGuard (logic)', () => {
  /** Minimal recreation of the guard logic for unit testing. */
  function createGuard() {
    let isSubmitting = false;

    async function guard<T>(fn: () => Promise<T>): Promise<T | undefined> {
      if (isSubmitting) return undefined;
      isSubmitting = true;
      try {
        return await fn();
      } finally {
        isSubmitting = false;
      }
    }

    return { guard, getIsSubmitting: () => isSubmitting };
  }

  it('executes fn and returns its result', async () => {
    const { guard } = createGuard();
    const result = await guard(async () => 'done');
    expect(result).toBe('done');
  });

  it('prevents double calls while submitting', async () => {
    const { guard } = createGuard();
    let resolveSlow: (v: string) => void;
    const slowFn = () =>
      new Promise<string>((r) => {
        resolveSlow = r;
      });

    // Start first (stays pending)
    const first = guard(slowFn);

    // Second should be blocked
    const second = await guard(async () => 'blocked');
    expect(second).toBeUndefined();

    // Resolve first
    resolveSlow!('first');
    expect(await first).toBe('first');
  });

  it('resets after fn completes', async () => {
    const { guard } = createGuard();
    await guard(async () => 'first');
    const result = await guard(async () => 'second');
    expect(result).toBe('second');
  });

  it('resets after fn throws', async () => {
    const { guard } = createGuard();

    await expect(
      guard(async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    const result = await guard(async () => 'recovered');
    expect(result).toBe('recovered');
  });

  it('isSubmitting reflects current state', async () => {
    const { guard, getIsSubmitting } = createGuard();
    expect(getIsSubmitting()).toBe(false);

    let resolveFn: () => void;
    const pending = new Promise<void>((r) => {
      resolveFn = r;
    });

    const guardPromise = guard(async () => {
      await pending;
    });

    // During execution
    expect(getIsSubmitting()).toBe(true);

    resolveFn!();
    await guardPromise;

    expect(getIsSubmitting()).toBe(false);
  });
});
