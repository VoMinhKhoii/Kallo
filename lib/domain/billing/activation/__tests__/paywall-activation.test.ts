import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEATURES } from '@/lib/domain/billing/entitlement/features';
import type { EntitlementsResponse } from '@/lib/domain/billing/entitlements-client';

const fetchEntitlements = vi.fn();
const reconcileEntitlements = vi.fn();

vi.mock('@/lib/domain/billing/entitlements-client', () => ({
  entitlementsKeys: {
    all: ['entitlements'],
    user: (userId: string) => ['entitlements', userId],
  },
  fetchEntitlements: (...args: unknown[]) => fetchEntitlements(...args),
  reconcileEntitlements: (...args: unknown[]) => reconcileEntitlements(...args),
}));

const { pollUntilPremium } = await import('../paywall-activation');

function snapshot(tier: 'free' | 'premium'): EntitlementsResponse {
  return {
    userId: 'user-a',
    purchasesEnabled: true,
    enforcementEnabled: false,
    tier,
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
    features: entitlementFeatures(tier === 'premium'),
  };
}

// Every gated feature answers the same way in these tests; derive them from
// the catalog so adding a feature never breaks this fixture.
function entitlementFeatures(
  allowed: boolean
): EntitlementsResponse['features'] {
  return Object.fromEntries(
    Object.keys(FEATURES).map((key) => [
      key,
      { allowed, reason: allowed ? 'entitled' : 'not_entitled' },
    ])
  ) as EntitlementsResponse['features'];
}

/**
 * Never settles on its own; rejects only when an abort budget expires. Called
 * without a signal it hangs forever — which is exactly the regression this
 * guards, so do not "fix" the optional signal away.
 */
function hangUntilAborted(_userId: string, signal?: AbortSignal) {
  return new Promise<never>((_resolve, reject) => {
    signal?.addEventListener('abort', () => reject(new Error('aborted')));
  });
}

describe('paywall activation polling', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    fetchEntitlements.mockReset();
    reconcileEntitlements.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns as soon as the tier flips', async () => {
    reconcileEntitlements.mockResolvedValue(snapshot('premium'));

    const result = pollUntilPremium(new QueryClient(), 'user-a');
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(true);
    expect(fetchEntitlements).not.toHaveBeenCalled();
  });

  it('gives up when the deadline elapses without a grant', async () => {
    reconcileEntitlements.mockResolvedValue(snapshot('free'));
    fetchEntitlements.mockResolvedValue(snapshot('free'));

    const result = pollUntilPremium(new QueryClient(), 'user-a');
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBe(false);
    const pollsAfterDeadline = fetchEntitlements.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchEntitlements.mock.calls.length).toBe(pollsAfterDeadline);
  });

  it('retries the provider once when the purchase lands after the first reconcile', async () => {
    // The observed sandbox failure: the first reconcile ran ~5s before the
    // provider recorded the purchase, so it correctly found nothing. Local
    // reads can never discover a grant the database does not have, so without
    // a second provider call activation depends entirely on the webhook.
    reconcileEntitlements
      .mockResolvedValueOnce(snapshot('free'))
      .mockResolvedValueOnce(snapshot('premium'));
    fetchEntitlements.mockResolvedValue(snapshot('free'));

    const result = pollUntilPremium(new QueryClient(), 'user-a');
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBe(true);
    expect(reconcileEntitlements).toHaveBeenCalledTimes(2);
  });

  it('never spends more than two provider calls per activation', async () => {
    reconcileEntitlements.mockResolvedValue(snapshot('free'));
    fetchEntitlements.mockResolvedValue(snapshot('free'));

    const result = pollUntilPremium(new QueryClient(), 'user-a');
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBe(false);
    expect(reconcileEntitlements).toHaveBeenCalledTimes(2);
  });

  it('does not let a hung request outlive the polling window', async () => {
    // Without a per-request budget this reconcile would never settle and the
    // paywall would spin forever.
    reconcileEntitlements.mockImplementation(hangUntilAborted);
    fetchEntitlements.mockResolvedValue(snapshot('free'));

    const result = pollUntilPremium(new QueryClient(), 'user-a');
    await vi.advanceTimersByTimeAsync(30_000);

    await expect(result).resolves.toBe(false);
  });

  it('stops immediately when the attempt is superseded', async () => {
    reconcileEntitlements.mockResolvedValue(snapshot('free'));
    fetchEntitlements.mockResolvedValue(snapshot('free'));

    const result = pollUntilPremium(
      new QueryClient(),
      'user-a',
      () => false // a newer purchase attempt owns the flow
    );
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
    expect(reconcileEntitlements).not.toHaveBeenCalled();
    expect(fetchEntitlements).not.toHaveBeenCalled();
  });

  it('never caches a poll result once the attempt is superseded', async () => {
    // The attempt is current when the fetch starts and stale by the time it
    // resolves — a second checkout in the same session. Caching the older
    // snapshot here would overwrite the `premium` the newer purchase wrote and
    // drop a paying user back to free in the UI.
    // gcTime must outlive the fake-timer run: runAllTimersAsync advances past
    // the default 5-minute collection window and would evict the very entry
    // this test is asserting on.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } },
    });
    queryClient.setQueryData(['entitlements', 'user-a'], snapshot('premium'));

    // Reconcile must fail, not resolve: a successful reconcile legitimately
    // caches its own snapshot first, which would mask what this test measures.
    let current = true;
    reconcileEntitlements.mockRejectedValue(new Error('provider unavailable'));
    fetchEntitlements.mockImplementation(async () => {
      current = false;
      return snapshot('free');
    });

    const result = pollUntilPremium(queryClient, 'user-a', () => current);
    await vi.runAllTimersAsync();

    await expect(result).resolves.toBe(false);
    expect(fetchEntitlements).toHaveBeenCalled();
    expect(queryClient.getQueryData(['entitlements', 'user-a'])).toEqual(
      snapshot('premium')
    );
  });
});
