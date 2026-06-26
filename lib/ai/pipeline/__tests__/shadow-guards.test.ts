import { describe, expect, it, vi } from 'vitest';
import {
  createPrimaryLatencyTracker,
  createShadowGuard,
  type ShadowGuardClock,
} from '../shadow/shadow-guards';

describe('createShadowGuard', () => {
  it('admits the first run', async () => {
    const guard = createShadowGuard({ clock: makeClock(0) });

    expect(await guard.shouldRun()).toEqual({ run: true });
  });

  it('blocks for 30 minutes when primary p95 exceeds threshold', async () => {
    const clock = makeClock(0);
    const p95Source = { value: 5000 };
    const guard = createShadowGuard({
      clock,
      primaryP95Ms: () => p95Source.value,
      primaryP95ThresholdMs: 4000,
    });

    expect(await guard.shouldRun()).toEqual({
      run: false,
      reason: 'aborted_primary_p95',
    });

    clock.advance(29 * 60_000);
    expect(await guard.shouldRun()).toMatchObject({
      run: false,
      reason: 'aborted_primary_p95',
    });

    clock.advance(2 * 60_000);
    p95Source.value = 3000;
    expect((await guard.shouldRun()).run).toBe(true);
  });

  it('skips one run if DB pool wait is high with no cooldown', async () => {
    const clock = makeClock(0);
    const pool = { value: 1500 };
    const guard = createShadowGuard({
      clock,
      dbPoolWaitMs: () => pool.value,
      dbPoolWaitThresholdMs: 1000,
    });

    expect(await guard.shouldRun()).toMatchObject({
      run: false,
      reason: 'aborted_pool_wait',
    });

    pool.value = 200;
    expect((await guard.shouldRun()).run).toBe(true);
  });

  it('skips one run on embedding rate-limit error', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      embeddingRateLimited: () => true,
    });

    expect(await guard.shouldRun()).toMatchObject({
      run: false,
      reason: 'aborted_embed_rate_limit',
    });
  });

  it('blocks shadow work when the shadow quota is exhausted', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      nonessentialGuard: async () => ({
        allowed: false,
        reason: 'shadow_quota',
        retryAfterSeconds: 60,
      }),
    });

    expect(await guard.shouldRun()).toEqual({
      run: false,
      reason: 'aborted_shadow_quota',
    });
  });

  it('blocks shadow work when the global budget is exhausted', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      nonessentialGuard: async () => ({
        allowed: false,
        reason: 'global_budget',
        retryAfterSeconds: 60,
      }),
    });

    expect(await guard.shouldRun()).toEqual({
      run: false,
      reason: 'aborted_global_budget',
    });
  });

  it('blocks shadow work during provider pressure', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      nonessentialGuard: async () => ({
        allowed: false,
        reason: 'provider_pressure',
        retryAfterSeconds: 60,
      }),
    });

    expect(await guard.shouldRun()).toEqual({
      run: false,
      reason: 'aborted_provider_pressure',
    });
  });

  it('runs only after the nonessential guard admits the shadow run', async () => {
    const guard = createShadowGuard({
      clock: makeClock(0),
      nonessentialGuard: async () => ({ allowed: true }),
    });

    expect(await guard.shouldRun()).toEqual({ run: true });
  });

  it('does not call the async nonessential guard when cheap latency guards block first', async () => {
    const nonessentialGuard = vi.fn().mockResolvedValue({ allowed: true });
    const guard = createShadowGuard({
      clock: makeClock(0),
      primaryP95Ms: () => 5000,
      primaryP95ThresholdMs: 4000,
      nonessentialGuard,
    });

    expect(await guard.shouldRun()).toMatchObject({
      run: false,
      reason: 'aborted_primary_p95',
    });
    expect(nonessentialGuard).not.toHaveBeenCalled();
  });
});

describe('createPrimaryLatencyTracker', () => {
  it('tracks rolling p95 inside the configured time window', () => {
    const clock = makeClock(0);
    const tracker = createPrimaryLatencyTracker({ clock, windowMs: 5000 });

    tracker.record(100);
    tracker.record(200);
    tracker.record(3000);

    expect(tracker.p95Ms()).toBe(3000);

    clock.advance(6000);
    tracker.record(250);

    expect(tracker.p95Ms()).toBe(250);
  });
});

function makeClock(
  start: number
): ShadowGuardClock & { advance: (ms: number) => void } {
  let t = start;
  return {
    now: () => t,
    advance: (ms) => {
      t += ms;
    },
  };
}
