import { QueryClient } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementsResponse } from '@/hooks/billing/use-entitlements';

const fetchEntitlements = vi.fn();
const reconcileEntitlements = vi.fn();

vi.mock('@/hooks/billing/use-entitlements', () => ({
  entitlementsKeys: {
    all: ['entitlements'],
    user: (userId: string) => ['entitlements', userId],
  },
  fetchEntitlements: (...args: unknown[]) => fetchEntitlements(...args),
  reconcileEntitlements: (...args: unknown[]) => reconcileEntitlements(...args),
}));

const { pollUntilPremium } = await import('./paywall-activation');

function snapshot(tier: 'free' | 'premium'): EntitlementsResponse {
  return {
    userId: 'user-a',
    purchasesEnabled: true,
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
    features: {
      ai_analysis: {
        allowed: tier === 'premium',
        reason: tier === 'premium' ? 'entitled' : 'not_entitled',
      },
    },
  };
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
});
