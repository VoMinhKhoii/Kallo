import { describe, expect, it, vi } from 'vitest';
import { FEATURES } from '@/lib/domain/billing/entitlement/features';
import type { EntitlementsResponse } from '@/lib/domain/billing/entitlements-client';
import { createEntitlementLifecycleSync } from '../entitlement-lifecycle';

function snapshot(
  overrides: Partial<EntitlementsResponse> = {}
): EntitlementsResponse {
  return {
    userId: 'user-a',
    purchasesEnabled: true,
    enforcementEnabled: false,
    tier: 'free',
    reconciliationRequired: false,
    isLifetime: false,
    expiresAt: null,
    willRenew: false,
    source: null,
    store: null,
    managementUrl: null,
    managementStore: null,
    hasActiveSubscription: false,
    trial: { active: false, endsAt: null, daysRemaining: 0 },
    features: Object.fromEntries(
      Object.keys(FEATURES).map((key) => [
        key,
        { allowed: false, reason: 'not_entitled' },
      ])
    ) as EntitlementsResponse['features'],
    ...overrides,
  };
}

function harness(options: { requiresReconciliation?: boolean } = {}) {
  const refresh = vi.fn(async () =>
    snapshot({
      reconciliationRequired: options.requiresReconciliation ?? false,
    })
  );
  const reconcile = vi.fn(async () => snapshot({ tier: 'premium' }));
  let clock = 0;
  const sync = createEntitlementLifecycleSync({
    refresh,
    reconcile,
    now: () => clock,
  });
  return {
    refresh,
    reconcile,
    sync,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('entitlement lifecycle sync', () => {
  it('reads the cheap snapshot and spends no provider budget when healthy', async () => {
    const { sync, refresh, reconcile } = harness();

    await sync.synchronize('user-a');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('recovers through the provider only when the server asks for it', async () => {
    const { sync, refresh, reconcile } = harness({
      requiresReconciliation: true,
    });

    await sync.synchronize('user-a');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith('user-a', expect.any(AbortSignal));
  });

  it('recovers when the caller overrides, even though the server sees nothing', async () => {
    // The gap this closes: `reconciliationRequired` is derived from existing
    // grant rows, so a first purchase that never projected leaves no rows, no
    // winning grant, and no signal — the user would sit on free forever.
    const refresh = vi.fn(async () => snapshot({ tier: 'free' }));
    const reconcile = vi.fn(async () => snapshot({ tier: 'premium' }));
    const sync = createEntitlementLifecycleSync({
      refresh,
      reconcile,
      shouldRecover: (s) => s.reconciliationRequired || s.tier !== 'premium',
    });

    await sync.synchronize('user-a');

    expect(reconcile).toHaveBeenCalledTimes(1);
  });

  it('still defers to the server signal by default', async () => {
    const { sync, reconcile } = harness({ requiresReconciliation: false });
    await sync.synchronize('user-a');
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('runs at most once per fifteen minutes across lifecycle signals', async () => {
    const { sync, refresh, advance } = harness();

    await sync.synchronize('user-a');
    advance(14 * 60 * 1000);
    await sync.synchronize('user-a');
    expect(refresh).toHaveBeenCalledTimes(1);

    advance(60 * 1000);
    await sync.synchronize('user-a');
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('consumes the interval even when the refresh fails', async () => {
    const refresh = vi.fn(async () => {
      throw new Error('offline');
    });
    const reconcile = vi.fn(async () => snapshot());
    let clock = 0;
    const sync = createEntitlementLifecycleSync({
      refresh,
      reconcile,
      now: () => clock,
    });

    // A failure must neither reject nor be retried on every focus change.
    await expect(sync.synchronize('user-a')).resolves.toBeUndefined();
    clock += 60 * 1000;
    await sync.synchronize('user-a');

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('coalesces overlapping signals onto the in-flight operation', async () => {
    let release: (() => void) | undefined;
    const refresh = vi.fn(
      () =>
        new Promise<EntitlementsResponse>((resolve) => {
          release = () => resolve(snapshot());
        })
    );
    const sync = createEntitlementLifecycleSync({
      refresh,
      reconcile: vi.fn(async () => snapshot()),
    });

    const first = sync.synchronize('user-a');
    const second = sync.synchronize('user-a');
    expect(refresh).toHaveBeenCalledTimes(1);

    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    release?.();
    await Promise.all([first, second]);
  });

  it('abandons in-flight work when the account changes', async () => {
    const signals: AbortSignal[] = [];
    const releases: ((value: EntitlementsResponse) => void)[] = [];
    const refresh = vi.fn((_userId: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<EntitlementsResponse>((resolve) => {
        releases.push(resolve);
      });
    });
    const reconcile = vi.fn(async () => snapshot());
    const sync = createEntitlementLifecycleSync({ refresh, reconcile });

    const first = sync.synchronize('user-a');
    await vi.waitFor(() => expect(releases).toHaveLength(1));

    sync.synchronize('user-b');
    expect(signals[0]?.aborted).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(2);

    // The abandoned snapshot must not trigger recovery for the new account.
    releases[0]?.(snapshot({ reconciliationRequired: true }));
    await first;
    expect(reconcile).not.toHaveBeenCalled();
  });
});
