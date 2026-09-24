import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Package } from '@/lib/domain/billing/web-purchases';

const mocks = vi.hoisted(() => ({
  purchasePackage: vi.fn(),
  pollUntilPremium: vi.fn(),
}));

vi.mock('@/lib/domain/billing/web-purchases', () => ({
  purchasePackage: mocks.purchasePackage,
}));
vi.mock('@/lib/domain/billing/activation/paywall-activation', () => ({
  pollUntilPremium: mocks.pollUntilPremium,
}));
vi.mock('@/lib/domain/billing/activation/activation-pending', () => ({
  markActivationPending: vi.fn(),
  clearActivationPending: vi.fn(),
}));
vi.mock('@/lib/infra/telemetry/analytics/track', () => ({ track: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () => (key: string) => key,
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({}) }));

import { usePaywallPurchase } from '../use-paywall-purchase';

const PKG = { identifier: '$rc_annual' } as unknown as Package;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

describe('usePaywallPurchase', () => {
  beforeEach(() => {
    mocks.purchasePackage.mockReset();
    mocks.pollUntilPremium.mockReset();
  });

  it("ignores a checkout that resolves after the account changed — never another account's receipt", async () => {
    const checkout = deferred<{ status: string }>();
    mocks.purchasePackage.mockReturnValue(checkout.promise);
    mocks.pollUntilPremium.mockResolvedValue(true);
    const { result, rerender } = renderHook(
      ({ userId }) => usePaywallPurchase(userId),
      { initialProps: { userId: 'user-a' } }
    );

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.select(PKG);
    });
    rerender({ userId: 'user-b' });
    await act(async () => {
      checkout.resolve({ status: 'payment_pending' });
      await pending;
    });

    expect(result.current.activationPending).toBe(false);
    expect(result.current.succeeded).toBe(false);
    expect(result.current.purchasing).toBe(false);
  });

  it('clears everything when the account changes', async () => {
    mocks.purchasePackage.mockResolvedValue({ status: 'payment_pending' });
    const { result, rerender } = renderHook(
      ({ userId }) => usePaywallPurchase(userId),
      { initialProps: { userId: 'user-a' } }
    );
    await act(async () => {
      await result.current.select(PKG);
    });
    expect(result.current.activationPending).toBe(true);

    rerender({ userId: 'user-b' });
    expect(result.current.activationPending).toBe(false);
  });

  it('clearReceipt drops a finished purchase but keeps an unresolved one', async () => {
    mocks.purchasePackage.mockResolvedValue({ status: 'payment_pending' });
    const { result } = renderHook(() => usePaywallPurchase('user-a'));
    await act(async () => {
      await result.current.select(PKG);
    });

    act(() => result.current.clearReceipt());
    // Money may still be moving: the pending status (and its "check again")
    // must survive, or the buy button returns and invites a second checkout.
    expect(result.current.activationPending).toBe(true);
  });

  it('clearReceipt clears the success state', async () => {
    mocks.purchasePackage.mockResolvedValue({ status: 'success' });
    mocks.pollUntilPremium.mockResolvedValue(true);
    const { result } = renderHook(() => usePaywallPurchase('user-a'));
    await act(async () => {
      await result.current.select(PKG);
    });
    expect(result.current.succeeded).toBe(true);

    act(() => result.current.clearReceipt());
    expect(result.current.succeeded).toBe(false);
  });
});
